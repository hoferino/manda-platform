/**
 * Agent System v2.0 - Supervisor Node
 *
 * Story: 1-2 Create Base StateGraph Structure (AC: #2)
 * Story: 1-6 Implement Basic Error Recovery (AC: #1, #3)
 * Story: 2-1 Implement Supervisor Node with Tool-Calling (AC: #1, #2, #3, #4)
 * Story: 2-3 Implement Workflow Router Middleware (AC: #5)
 * Story: 3-3 Implement Honest Uncertainty Handling (AC: #1-#5)
 *
 * The supervisor node is the main entry point for chat, irl, and qa workflows.
 * It uses Gemini via Vertex AI with specialist tool bindings to:
 * - Respond naturally to greetings and simple queries (FR17)
 * - Route complex queries to specialists via LLM tool-calling
 * - Never fall back to generic "I don't see that in documents" responses (FR16)
 * - Inject uncertainty context when sources are missing or low-quality (FR41-43)
 *
 * System Prompt Pattern (Story 2.3):
 * - Reads state.systemPrompt set by workflow-router middleware
 * - Falls back to inline build if systemPrompt is null (backward compatibility)
 * - Appends specialist routing guidance on top of base prompt
 *
 * Uncertainty Handling Pattern (Story 3.3):
 * - Detects uncertainty level from state.sources relevance scores
 * - Injects context into system prompt for high/complete uncertainty
 * - Validates responses for prohibited phrases (logging only, soft enforcement)
 * - Defensive: handles missing dealContext gracefully
 *
 * Error Handling Pattern (Story 1.6):
 * - LLM errors are caught and added to state.errors
 * - Recoverable errors (LLM_ERROR) can be retried
 * - Fatal errors (STATE_ERROR) halt execution
 * - TOOL_ERROR allows continuation with reduced capability
 *
 * References:
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Supervisor Node]
 * - [Source: _bmad-output/planning-artifacts/agent-system-architecture.md#Error Handling Patterns]
 * - [Source: docs/langgraph-reference.md]
 */

import { SystemMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

import type { AgentStateType } from '../state'
import type { AgentError } from '../types'
import { AgentErrorCode } from '../types'
import {
  createAgentError,
  isLLMError,
  isRecoverableError,
  logError,
} from '../utils/errors'
import { withRetry } from '../utils/retry'
import {
  detectUncertainty,
  buildUncertaintyContext,
  validateResponseHonesty,
} from '../utils'
import { getSupervisorLLMWithTools } from '../llm/gemini'
import { getSystemPromptWithContext } from '@/lib/agent/prompts'

/**
 * Node identifier for error tracking.
 */
const NODE_ID = 'supervisor'

/**
 * Specialist routing guidance appended to all supervisor prompts.
 *
 * Story: 2-3 Implement Workflow Router Middleware (AC: #5)
 *
 * This guidance is added on top of the base prompt (from middleware or inline)
 * to provide specialist tool routing instructions.
 */
export const SPECIALIST_GUIDANCE = `

## Specialist Delegation (Agent System v2)

When a question requires specialized analysis beyond document search, delegate to the appropriate specialist tool:

| Specialist | Use When |
|------------|----------|
| **financial-analyst** | EBITDA, margins, valuation, comparables, projections, P&L analysis |
| **document-researcher** | Deep multi-document search, cross-referencing, detailed extraction |
| **kg-expert** | Entity relationships, network analysis, how entities connect |
| **due-diligence** | Risk assessment, DD findings, red flags, checklist status |

**IMPORTANT:** Only call specialists for questions requiring their expertise.
- Greetings → respond directly with a friendly, natural response
- Simple factual questions → respond directly if you know the answer
- General questions about the deal → respond directly using available context
- Complex analysis requiring document search → use specialists

**Examples:**
- "Hello" → Respond naturally: "Hello! How can I help you with this deal today?"
- "What's your name?" → Respond directly: "I'm your M&A Due Diligence Assistant."
- "What is the EBITDA margin?" → Use financial-analyst (requires financial analysis)
- "Find all mentions of revenue" → Use document-researcher (deep document search)
- "Who are the key shareholders?" → Use kg-expert (entity relationships)
- "Any red flags?" → Use due-diligence (risk assessment)

Do NOT use generic fallback responses like "I don't see that in the documents" for simple queries.
`

/**
 * Supervisor node - routes messages to appropriate handlers.
 *
 * Story: 2-1 Implement Supervisor Node with Tool-Calling (AC: #1, #2, #3, #4)
 *
 * The supervisor uses Gemini via Vertex AI with specialist tools to:
 * 1. Respond naturally to greetings without searching documents (AC: #2)
 * 2. Answer simple queries directly without unnecessary tool calls (AC: #3)
 * 3. Route complex queries to specialists via LLM tool-calling (AC: #4)
 *
 * Error Handling (Story 1.6):
 * - LLM errors are caught and classified
 * - withRetry provides automatic retry for transient failures
 * - Errors are added to state.errors (reducer auto-appends)
 * - User-friendly messages via toUserFriendlyMessage()
 *
 * @param state - Current agent state with messages and context
 * @returns Partial state update with AI response and optional activeSpecialist
 *
 * @example
 * ```typescript
 * const graphBuilder = new StateGraph(AgentState)
 * graphBuilder.addNode('supervisor', supervisorNode)
 * ```
 */
export async function supervisorNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  // Story 3.3: Defensive check for dealContext
  const dealContext = state.dealContext
  if (!dealContext) {
    console.warn('[uncertainty] dealContext not loaded, assuming no documents')
  }
  const hasDocuments = dealContext?.documentCount != null && dealContext.documentCount > 0

  // Story 3.3: Detect uncertainty from sources (populated by retrieval node)
  // Get query from last human message for context
  const lastHumanMessage = [...state.messages]
    .reverse()
    .find((m) => m._getType() === 'human')
  const query = typeof lastHumanMessage?.content === 'string' ? lastHumanMessage.content : ''

  const { level: uncertaintyLevel } = detectUncertainty(
    state.sources ?? [],
    query
  )

  // Read base prompt from middleware (Story 2.3) or fall back for backward compat
  const dealName = dealContext?.dealName || undefined
  const basePrompt = state.systemPrompt ?? getSystemPromptWithContext(dealName)

  // Story 3.3: Inject uncertainty context between base prompt and specialist guidance
  const uncertaintyContext = buildUncertaintyContext(uncertaintyLevel, hasDocuments)
  const systemPrompt = basePrompt + uncertaintyContext + SPECIALIST_GUIDANCE

  // Construct messages array with system prompt
  const messages = [new SystemMessage(systemPrompt), ...state.messages]

  try {
    // Get LLM with specialist tools bound
    const llm = getSupervisorLLMWithTools()

    // Invoke with retry for transient failures
    // Type assertion needed: LangChain's bindTools() returns a complex generic type
    // (Runnable<BaseLanguageModelInput, AIMessageChunk, ...>) that doesn't cleanly
    // accept BaseMessage[]. This is a known LangChain typing limitation.
    // The runtime behavior is correct - messages array is valid input.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await withRetry(() => llm.invoke(messages as any))

    // Story 3.3: Post-LLM response validation (logging only, don't block)
    const responseContent =
      typeof response.content === 'string' ? response.content : ''
    if (responseContent) {
      const validation = validateResponseHonesty(responseContent)
      if (!validation.isValid) {
        console.warn(
          '[uncertainty] response validation issues:',
          validation.issues
        )
      }
    }

    // Check for tool calls (indicates specialist routing needed)
    // Response from tool-bound LLM has tool_calls property
    const toolCalls = response.tool_calls
    if (toolCalls && toolCalls.length > 0) {
      // Route to first tool call (typically only one specialist per turn)
      const firstToolCall = toolCalls[0]
      // Safely access tool name - should always be present for valid tool calls
      const specialistName = firstToolCall?.name
      if (specialistName) {
        // Convert to AIMessage for proper state handling
        const aiMessage = new AIMessage({
          content: response.content,
          tool_calls: response.tool_calls,
        })
        return {
          messages: [aiMessage],
          activeSpecialist: specialistName, // e.g., 'financial-analyst'
        }
      }
    }

    // Direct response (greetings, simple queries) - no specialist needed
    // Convert to AIMessage for state compatibility
    const aiMessage = new AIMessage({
      content: response.content,
    })
    return { messages: [aiMessage] }
  } catch (err) {
    // Classify error and add to state
    const error = classifyAndLogError(err, state)
    return { errors: [error] }
  }
}

/**
 * Build supervisor system prompt extending the existing comprehensive prompt.
 *
 * Story: 2-1 Implement Supervisor Node with Tool-Calling (AC: #1)
 * Story: 2-3 Implement Workflow Router Middleware (AC: #5)
 *
 * **DEPRECATED:** This function is kept for backward compatibility.
 * Prefer using workflow-router middleware to set state.systemPrompt,
 * then let supervisorNode append SPECIALIST_GUIDANCE.
 *
 * Adds specialist routing guidance while preserving all existing behaviors:
 * - Source attribution rules (P2 compliance)
 * - Query behavior patterns (7 use cases)
 * - Multi-turn context handling (P4 compliance)
 * - Q&A suggestion flow
 * - Zero-document scenario handling
 *
 * @param _state - Agent state for context (unused, kept for API compatibility)
 * @param dealName - Optional deal name for context
 * @returns Complete system prompt with specialist guidance
 *
 * @deprecated Use workflow-router middleware + SPECIALIST_GUIDANCE constant instead
 */
export function buildSupervisorSystemPrompt(
  _state: AgentStateType,
  dealName?: string
): string {
  // Start with existing comprehensive prompt (400+ lines)
  const basePrompt = getSystemPromptWithContext(dealName)

  // Add specialist routing guidance (now extracted to SPECIALIST_GUIDANCE constant)
  return basePrompt + SPECIALIST_GUIDANCE
}

/**
 * Classify error and log with context.
 * Helper for node-level error handling.
 *
 * Story: 1-6 Implement Basic Error Recovery (AC: #1)
 *
 * @param err - Unknown error to classify
 * @param state - Current agent state for context
 * @returns Classified AgentError
 *
 * @internal Used by supervisorNode when Story 2.1 adds LLM calls
 */
export function classifyAndLogError(
  err: unknown,
  state: AgentStateType
): AgentError {
  let error: AgentError

  if (isLLMError(err)) {
    error = createAgentError(AgentErrorCode.LLM_ERROR, 'LLM call failed', {
      details: { originalError: String(err) },
      recoverable: true,
      nodeId: NODE_ID,
    })
  } else {
    error = createAgentError(AgentErrorCode.STATE_ERROR, 'Unexpected error', {
      details: { originalError: String(err) },
      recoverable: false,
      nodeId: NODE_ID,
    })
  }

  // Log with context
  logError(error, {
    nodeId: NODE_ID,
    workflowMode: state.workflowMode,
    dealId: state.dealContext?.dealId,
    messageCount: state.messages.length,
  })

  return error
}

// Re-export for testing
export { isRecoverableError }
