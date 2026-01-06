/**
 * Specialist Node Implementations
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #2, #3, #6)
 *
 * LangGraph node implementations for specialist agents.
 * E13.5 (Financial Analyst) and E13.6 (Knowledge Graph) are stubs - full implementations pending.
 *
 * Node Pattern:
 * - Each node receives SupervisorState
 * - Returns partial state update with specialistResults
 * - Uses reducer aggregation for parallel execution
 *
 * References:
 * - [Source: docs/sprint-artifacts/stories/e13-4-supervisor-agent-pattern.md]
 * - [Source: manda-app/lib/agent/executor.ts] - createChatAgent pattern
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { createLLMClient } from '@/lib/llm/client'
import { allChatTools } from '../tools/all-tools'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import {
  type SupervisorState,
  type SpecialistResult,
  createSpecialistResult,
} from './state'
import { SPECIALIST_IDS } from './routing'

// =============================================================================
// Configuration
// =============================================================================

/**
 * Timeout for specialist execution (30 seconds)
 */
const SPECIALIST_TIMEOUT_MS = 30000

/**
 * System prompts for specialist agents
 */
const SPECIALIST_PROMPTS = {
  [SPECIALIST_IDS.FINANCIAL_ANALYST]: `You are a Financial Analyst specialist for M&A due diligence.
Your expertise includes:
- Revenue analysis and forecasting
- EBITDA calculations and margin analysis
- Valuation multiples and DCF modeling
- Working capital and cash flow analysis
- Financial statement analysis (P&L, Balance Sheet, Cash Flow)
- Key financial metrics (ROI, IRR, NPV, WACC)

Guidelines:
1. Provide precise numerical analysis when data is available
2. Clearly state assumptions and limitations
3. Use professional M&A financial terminology
4. Cite specific documents/sources when referencing data
5. Highlight key risks and opportunities
6. Be concise but thorough

Note: This is a preliminary stub implementation. Full specialist agent coming in E13.5.`,

  [SPECIALIST_IDS.KNOWLEDGE_GRAPH]: `You are a Knowledge Graph specialist for M&A due diligence.
Your expertise includes:
- Entity identification and resolution
- Relationship mapping (people, companies, subsidiaries)
- Contradiction and inconsistency detection
- Timeline and historical analysis
- Organizational structure analysis
- Data lineage and provenance

Guidelines:
1. Focus on entities, relationships, and connections
2. Identify contradictions or inconsistencies in data
3. Provide clear relationship chains when relevant
4. Note when information may be outdated or superseded
5. Cite specific sources for entity information
6. Flag potential data quality issues

Note: This is a preliminary stub implementation. Full specialist agent coming in E13.6.`,

  [SPECIALIST_IDS.GENERAL]: `You are a general M&A due diligence assistant.
You help with questions that don't require specialized financial or knowledge graph analysis.

Guidelines:
1. Provide helpful, accurate information
2. Use available tools to search and analyze documents
3. Be clear about uncertainty or limitations
4. Cite sources when possible
5. Direct users to specialized agents when appropriate`,
}

// =============================================================================
// Specialist Node Types
// =============================================================================

/**
 * Node function signature for LangGraph
 * Returns partial state update with specialistResults
 */
export type SpecialistNode = (
  state: SupervisorState
) => Promise<Partial<SupervisorState>>

// =============================================================================
// Financial Analyst Node (AC: #2) - STUB
// =============================================================================

/**
 * Financial Analyst Specialist Node
 * Story: E13.4 (AC: #2) - Route to financial_analyst for financial queries
 *
 * NOTE: Full implementation in E13.5. This stub uses the general agent
 * with a financial-focused system prompt.
 *
 * @param state - Current supervisor state
 * @returns Partial state update with specialist result
 */
export async function financialAnalystNode(
  state: SupervisorState
): Promise<Partial<SupervisorState>> {
  const startTime = Date.now()
  console.log('[Supervisor] Invoking financial_analyst specialist (stub)')

  try {
    const result = await invokeSpecialistWithAgent(
      SPECIALIST_IDS.FINANCIAL_ANALYST,
      state,
      SPECIALIST_PROMPTS[SPECIALIST_IDS.FINANCIAL_ANALYST]!
    )

    return {
      specialistResults: [{
        ...result,
        stub: true, // Flag for tracing
      }],
    }
  } catch (error) {
    console.error('[Supervisor] Financial analyst error:', error)
    return {
      specialistResults: [
        createSpecialistResult(
          SPECIALIST_IDS.FINANCIAL_ANALYST,
          '',
          0,
          [],
          {
            timing: Date.now() - startTime,
            stub: true,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        ),
      ],
    }
  }
}

// =============================================================================
// Knowledge Graph Node (AC: #2) - STUB
// =============================================================================

/**
 * Knowledge Graph Specialist Node
 * Story: E13.4 (AC: #2) - Route to knowledge_graph for entity/relationship queries
 *
 * NOTE: Full implementation in E13.6. This stub uses the general agent
 * with a knowledge graph-focused system prompt.
 *
 * @param state - Current supervisor state
 * @returns Partial state update with specialist result
 */
export async function knowledgeGraphNode(
  state: SupervisorState
): Promise<Partial<SupervisorState>> {
  const startTime = Date.now()
  console.log('[Supervisor] Invoking knowledge_graph specialist (stub)')

  try {
    const result = await invokeSpecialistWithAgent(
      SPECIALIST_IDS.KNOWLEDGE_GRAPH,
      state,
      SPECIALIST_PROMPTS[SPECIALIST_IDS.KNOWLEDGE_GRAPH]!
    )

    return {
      specialistResults: [{
        ...result,
        stub: true, // Flag for tracing
      }],
    }
  } catch (error) {
    console.error('[Supervisor] Knowledge graph error:', error)
    return {
      specialistResults: [
        createSpecialistResult(
          SPECIALIST_IDS.KNOWLEDGE_GRAPH,
          '',
          0,
          [],
          {
            timing: Date.now() - startTime,
            stub: true,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        ),
      ],
    }
  }
}

// =============================================================================
// General Agent Node (AC: #6) - Fallback
// =============================================================================

/**
 * General Agent Node (Fallback)
 * Story: E13.4 (AC: #6) - Create fallback to general agent if no specialist matches
 *
 * Uses the full tool set and general system prompt.
 * This is the fallback path for queries that don't match specialist domains.
 *
 * @param state - Current supervisor state
 * @returns Partial state update with specialist result
 */
export async function generalAgentNode(
  state: SupervisorState
): Promise<Partial<SupervisorState>> {
  const startTime = Date.now()
  console.log('[Supervisor] Invoking general agent (fallback)')

  try {
    const result = await invokeSpecialistWithAgent(
      SPECIALIST_IDS.GENERAL,
      state,
      SPECIALIST_PROMPTS[SPECIALIST_IDS.GENERAL]!
    )

    return {
      specialistResults: [result],
    }
  } catch (error) {
    console.error('[Supervisor] General agent error:', error)
    return {
      specialistResults: [
        createSpecialistResult(
          SPECIALIST_IDS.GENERAL,
          'I encountered an issue processing your request. Please try rephrasing your question.',
          0.3,
          [],
          {
            timing: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'Unknown error',
          }
        ),
      ],
    }
  }
}

// =============================================================================
// Shared Agent Invocation
// =============================================================================

/**
 * Invoke a specialist using a ReAct agent with custom system prompt
 * This is the shared implementation used by all specialist stubs
 *
 * @param specialistId - Identifier for the specialist
 * @param state - Current supervisor state
 * @param systemPrompt - Custom system prompt for the specialist
 * @returns SpecialistResult
 */
async function invokeSpecialistWithAgent(
  specialistId: string,
  state: SupervisorState,
  systemPrompt: string
): Promise<SpecialistResult> {
  const startTime = Date.now()

  // Create LLM client (use complex tier for specialists)
  const llm = createLLMClient({ complexity: 'complex' })

  // Create agent with specialist prompt
  const agent = createReactAgent({
    llm,
    tools: allChatTools,
    messageModifier: systemPrompt,
  })

  // Build messages with context
  const messages = [
    new SystemMessage(`Deal context: ${state.dealId}`),
    new HumanMessage(state.query),
  ]

  // Invoke with timeout
  const result = await Promise.race([
    agent.invoke({ messages }),
    createTimeout(SPECIALIST_TIMEOUT_MS),
  ])

  // Handle timeout
  if (result === 'TIMEOUT') {
    return createSpecialistResult(
      specialistId,
      'Analysis timed out. The query may be too complex or require more data.',
      0.3,
      [],
      { timing: SPECIALIST_TIMEOUT_MS, error: 'Timeout after 30s' }
    )
  }

  // Extract output from agent result with proper type checking
  const resultMessages = result.messages
  let output = 'Unable to generate analysis.'

  if (Array.isArray(resultMessages) && resultMessages.length > 0) {
    const lastMessage = resultMessages[resultMessages.length - 1]
    if (lastMessage && typeof lastMessage === 'object' && 'content' in lastMessage) {
      const content = lastMessage.content
      if (typeof content === 'string') {
        output = content
      } else if (Array.isArray(content)) {
        // Handle content blocks (e.g., from Claude)
        output = content
          .filter((block): block is { type: string; text: string } =>
            typeof block === 'object' && block !== null && 'text' in block
          )
          .map(block => block.text)
          .join('\n') || 'Unable to generate analysis.'
      }
    }
  }

  // Extract confidence from output (heuristic based on certainty language)
  const confidence = estimateConfidence(output)

  // Extract sources from tool calls (simplified - full implementation in E13.5/E13.6)
  const sources = extractSourcesFromOutput(output)

  return createSpecialistResult(
    specialistId,
    output,
    confidence,
    sources,
    { timing: Date.now() - startTime }
  )
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a timeout promise
 */
function createTimeout(ms: number): Promise<'TIMEOUT'> {
  return new Promise(resolve => setTimeout(() => resolve('TIMEOUT'), ms))
}

/**
 * Estimate confidence from output text (heuristic)
 * Looks for certainty/uncertainty language patterns
 */
function estimateConfidence(output: string): number {
  const lowConfidencePatterns = [
    /\b(unclear|uncertain|might|may|possibly|perhaps|could be|not sure)\b/i,
    /\b(limited data|insufficient|no information|couldn't find)\b/i,
  ]

  const highConfidencePatterns = [
    /\b(clearly|definitely|shows that|confirms|according to|states that)\b/i,
    /\b(the data shows|revenue of \$|EBITDA of \$|margin of)\b/i,
  ]

  let confidence = 0.7 // Default moderate confidence

  // Check for low confidence signals
  for (const pattern of lowConfidencePatterns) {
    if (pattern.test(output)) {
      confidence -= 0.15
    }
  }

  // Check for high confidence signals
  for (const pattern of highConfidencePatterns) {
    if (pattern.test(output)) {
      confidence += 0.1
    }
  }

  // Clamp to valid range
  return Math.max(0.2, Math.min(0.95, confidence))
}

/**
 * Extract source references from output text (simplified heuristic)
 * Full implementation will use tool call results in E13.5/E13.6
 */
function extractSourcesFromOutput(output: string): Array<{ documentName?: string; snippet?: string }> {
  const sources: Array<{ documentName?: string; snippet?: string }> = []

  // Look for document references in common patterns
  const docPatterns = [
    /(?:according to|from|in|per)\s+(?:the\s+)?["']?([^"'\n,]+(?:\.pdf|\.docx?|\.xlsx?))["']?/gi,
    /(?:document|file|report)\s+(?:titled\s+)?["']([^"']+)["']/gi,
  ]

  for (const pattern of docPatterns) {
    let match
    while ((match = pattern.exec(output)) !== null) {
      const docName = match[1]?.trim()
      if (docName && docName.length > 3) {
        sources.push({ documentName: docName })
      }
    }
  }

  return sources.slice(0, 5) // Limit to 5 sources
}

// =============================================================================
// Node Registry
// =============================================================================

/**
 * Map of specialist IDs to their node implementations
 */
export const SPECIALIST_NODES: Record<string, SpecialistNode> = {
  [SPECIALIST_IDS.FINANCIAL_ANALYST]: financialAnalystNode,
  [SPECIALIST_IDS.KNOWLEDGE_GRAPH]: knowledgeGraphNode,
  [SPECIALIST_IDS.GENERAL]: generalAgentNode,
}

/**
 * Get node implementation for a specialist ID
 *
 * @param specialistId - Specialist identifier
 * @returns Node function or undefined if not found
 */
export function getSpecialistNode(specialistId: string): SpecialistNode | undefined {
  return SPECIALIST_NODES[specialistId]
}
