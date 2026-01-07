/**
 * CIM Agent LangGraph Workflow
 *
 * Defines the state machine for CIM creation workflow.
 * Story: E9.4 - Agent Orchestration Core
 * Story: E11.1 - Tool Result Isolation
 *
 * Features:
 * - Phase-based sequential workflow
 * - Human-in-the-loop checkpoints
 * - State persistence
 * - Error handling with retry
 * - Tool result isolation (E11.1) - summaries in context, full results in cache
 */

import { StateGraph, END, START } from '@langchain/langgraph'
import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { AIMessage, HumanMessage, SystemMessage, BaseMessage } from '@langchain/core/messages'
import { createLLMClient, type LLMConfig } from '@/lib/llm/client'
import { CIMAgentState, CIMAgentStateType, getNextPhase, serializeState } from './state'
import { getCIMSystemPrompt, getPhaseIntroduction, getTransitionGuidance } from './prompts'
import { cimTools } from './tools'
import { CIMPhase, CIM_PHASES } from '@/lib/types/cim'
import { queryKnowledgeBaseTool } from '@/lib/agent/tools/knowledge-tools'
import {
  createToolResultCache,
  isolateAllTools,
  type ToolResultCache,
  DEFAULT_ISOLATION_CONFIG,
} from '@/lib/agent/tool-isolation'
import { getCheckpointer, createCIMThreadId } from '@/lib/agent/checkpointer'

// ============================================================================
// Configuration
// ============================================================================

/**
 * Configuration for creating a CIM agent
 */
export interface CIMAgentConfig {
  dealId: string
  userId: string
  cimId: string
  dealName?: string
  llmConfig?: Partial<LLMConfig>
  verbose?: boolean
  /** Disable tool isolation (for debugging) - E11.1 */
  disableIsolation?: boolean
}

/**
 * Module-level tool result cache for CIM workflow
 * Shared across all agent node invocations within a workflow instance
 * Story: E11.1 - Tool Result Isolation
 */
let cimToolResultCache: ToolResultCache | null = null

/**
 * Get or create the CIM tool result cache
 */
export function getCIMToolResultCache(): ToolResultCache {
  if (!cimToolResultCache) {
    cimToolResultCache = createToolResultCache()
  }
  return cimToolResultCache
}

/**
 * Clear the CIM tool result cache (e.g., on workflow completion)
 */
export function clearCIMToolResultCache(): void {
  cimToolResultCache = null
}

/**
 * Maximum retries for errors
 */
const MAX_RETRIES = 3

// ============================================================================
// Node Functions
// ============================================================================

/**
 * Router node - determines the next step based on current state
 */
async function routerNode(state: CIMAgentStateType): Promise<Partial<CIMAgentStateType>> {
  // If there's a pending approval, we're waiting for human input
  if (state.pendingApproval) {
    return {}
  }

  // Check if workflow is complete
  if (state.currentPhase === 'complete' || state.isComplete) {
    return { isComplete: true }
  }

  return {}
}

/**
 * Error handler node - handles errors with retry logic
 */
async function errorHandlerNode(state: CIMAgentStateType): Promise<Partial<CIMAgentStateType>> {
  const retryCount = state.retryCount || 0

  if (retryCount >= MAX_RETRIES) {
    // Max retries exceeded, surface error to user
    const errorMessage = new AIMessage(
      `I encountered an issue and couldn't complete the operation after ${MAX_RETRIES} attempts. ` +
      `Error: ${state.lastError || 'Unknown error'}. Would you like me to try a different approach?`
    )

    return {
      messages: [...state.messages, errorMessage],
      lastError: null,
      retryCount: 0,
    }
  }

  // Increment retry count and clear error to retry
  return {
    retryCount: retryCount + 1,
    lastError: null,
  }
}

/**
 * Create the main agent node with phase-aware prompts
 * Story: E11.1 - Tool Result Isolation
 */
function createAgentNode(config: CIMAgentConfig) {
  // Get or create shared cache for this workflow
  const toolResultCache = getCIMToolResultCache()

  return async (state: CIMAgentStateType): Promise<Partial<CIMAgentStateType>> => {
    try {
      // Get phase-specific system prompt
      const systemPrompt = getCIMSystemPrompt(state.currentPhase, config.dealName)

      // Create LLM client
      const llm = createLLMClient(config.llmConfig)

      // Combine CIM tools with knowledge tools
      const baseTools = [
        ...cimTools,
        queryKnowledgeBaseTool,
      ]

      // Apply tool isolation unless disabled (E11.1)
      const allTools = config.disableIsolation
        ? baseTools
        : isolateAllTools(baseTools, toolResultCache, {
            ...DEFAULT_ISOLATION_CONFIG,
            verbose: config.verbose ?? false,
          })

      // Create agent with current phase context
      const agent = createReactAgent({
        llm,
        tools: allTools,
        messageModifier: systemPrompt,
      })

      // Build messages for agent
      const messages = state.messages.filter(
        m => m._getType() === 'human' || m._getType() === 'ai'
      )

      // Invoke agent
      const result = await agent.invoke({ messages })

      // Extract response messages
      const resultMessages = result.messages as BaseMessage[] | undefined
      if (!resultMessages || resultMessages.length === 0) {
        throw new Error('No response from agent')
      }

      // Get the new messages (after our input)
      const newMessages = resultMessages.slice(messages.length)

      // Check if agent made any tool calls
      const lastMessage = resultMessages[resultMessages.length - 1]
      const content = typeof lastMessage?.content === 'string'
        ? lastMessage.content
        : ''

      // Clear error state on success
      return {
        messages: [...state.messages, ...newMessages],
        lastError: null,
        retryCount: 0,
      }
    } catch (error) {
      console.error('[CIM Agent] Error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'

      return {
        lastError: errorMessage,
      }
    }
  }
}

/**
 * Phase transition node - handles moving between phases
 */
async function phaseTransitionNode(state: CIMAgentStateType): Promise<Partial<CIMAgentStateType>> {
  const nextPhase = getNextPhase(state.currentPhase)

  if (!nextPhase) {
    return { isComplete: true }
  }

  // Add transition message
  const transitionMessage = new AIMessage(
    getTransitionGuidance(state.currentPhase, nextPhase)
  )

  // Update completed phases
  const completedPhases = [...state.completedPhases]
  if (!completedPhases.includes(state.currentPhase)) {
    completedPhases.push(state.currentPhase)
  }

  return {
    currentPhase: nextPhase,
    completedPhases,
    messages: [...state.messages, transitionMessage],
    pendingApproval: null,
  }
}

/**
 * Welcome node - sends initial phase introduction
 */
async function welcomeNode(state: CIMAgentStateType): Promise<Partial<CIMAgentStateType>> {
  // Only add welcome message if this is the start of a new workflow
  const hasWelcome = state.messages.some(
    m => m._getType() === 'ai' && typeof m.content === 'string' &&
    m.content.includes("Let's start")
  )

  if (hasWelcome || state.messages.length > 2) {
    return {}
  }

  const welcomeMessage = new AIMessage(getPhaseIntroduction(state.currentPhase))

  return {
    messages: [...state.messages, welcomeMessage],
  }
}

// ============================================================================
// Conditional Edges
// ============================================================================

/**
 * Determine next node based on state
 */
function shouldContinue(state: CIMAgentStateType): string {
  // Check for errors
  if (state.lastError) {
    return 'error_handler'
  }

  // Check if complete
  if (state.isComplete || state.currentPhase === 'complete') {
    return END
  }

  // Check for pending approval (human-in-the-loop)
  if (state.pendingApproval) {
    return END // Wait for human input
  }

  // Continue to agent
  return 'agent'
}

/**
 * Determine next step after agent
 */
function afterAgent(state: CIMAgentStateType): string {
  // Check for errors
  if (state.lastError) {
    return 'error_handler'
  }

  // Always return to router after agent completes
  return 'router'
}

/**
 * Handle error node routing
 */
function afterError(state: CIMAgentStateType): string {
  if (state.retryCount >= MAX_RETRIES) {
    return 'router' // Go back to router with error message
  }
  return 'agent' // Retry
}

// ============================================================================
// Workflow Creation
// ============================================================================

/**
 * Create the CIM agent workflow graph
 *
 * Story: E13.9 - Now uses PostgresSaver for durable state persistence
 *
 * @param config - CIM agent configuration
 * @returns Promise<CompiledStateGraph> - Compiled workflow graph
 */
export async function createCIMWorkflow(config: CIMAgentConfig) {
  // Create agent node with config
  const agentNode = createAgentNode(config)

  // Build the state graph
  const workflow = new StateGraph(CIMAgentState)
    .addNode('welcome', welcomeNode)
    .addNode('router', routerNode)
    .addNode('agent', agentNode)
    .addNode('error_handler', errorHandlerNode)
    .addNode('phase_transition', phaseTransitionNode)

  // Define edges
  workflow
    .addEdge(START, 'welcome')
    .addEdge('welcome', 'router')
    .addConditionalEdges('router', shouldContinue, {
      agent: 'agent',
      error_handler: 'error_handler',
      [END]: END,
    })
    .addConditionalEdges('agent', afterAgent, {
      router: 'router',
      error_handler: 'error_handler',
    })
    .addConditionalEdges('error_handler', afterError, {
      agent: 'agent',
      router: 'router',
    })
    .addEdge('phase_transition', 'router')

  // Get shared checkpointer (PostgresSaver with MemorySaver fallback)
  // Story: E13.9 - Durable state persistence across server restarts
  const checkpointer = await getCheckpointer()

  // Compile the graph
  const app = workflow.compile({ checkpointer })

  return app
}

/**
 * Type for the compiled CIM workflow
 * Story: E13.9 - Now async, returns Promise
 */
export type CIMWorkflow = Awaited<ReturnType<typeof createCIMWorkflow>>

// ============================================================================
// Execution Helpers
// ============================================================================

/**
 * Execute the CIM workflow with a user message
 */
export async function executeCIMWorkflow(
  workflow: CIMWorkflow,
  userMessage: string,
  threadId: string,
  initialState?: Partial<CIMAgentStateType>
): Promise<{
  messages: BaseMessage[]
  state: CIMAgentStateType
}> {
  // Create human message
  const humanMessage = new HumanMessage(userMessage)

  // Build input state
  const inputState: Partial<CIMAgentStateType> = {
    ...initialState,
    messages: [...(initialState?.messages || []), humanMessage],
  }

  // Configure thread for checkpointing
  const config = {
    configurable: { thread_id: threadId },
  }

  // Invoke workflow
  const result = await workflow.invoke(inputState, config)

  return {
    messages: result.messages,
    state: result,
  }
}

/**
 * Stream CIM workflow execution
 */
export async function* streamCIMWorkflow(
  workflow: CIMWorkflow,
  userMessage: string,
  threadId: string,
  initialState?: Partial<CIMAgentStateType>
): AsyncGenerator<{
  type: 'token' | 'tool_start' | 'tool_end' | 'state_update'
  data: unknown
}> {
  // Create human message
  const humanMessage = new HumanMessage(userMessage)

  // Build input state
  const inputState: Partial<CIMAgentStateType> = {
    ...initialState,
    messages: [...(initialState?.messages || []), humanMessage],
  }

  // Configure thread for checkpointing
  const config = {
    configurable: { thread_id: threadId },
  }

  // Stream execution
  const eventStream = workflow.streamEvents(inputState, {
    ...config,
    version: 'v2',
  })

  for await (const event of eventStream) {
    const kind = event.event

    if (kind === 'on_chat_model_stream') {
      const content = event.data?.chunk?.content
      if (content && typeof content === 'string') {
        yield { type: 'token', data: content }
      }
    } else if (kind === 'on_tool_start') {
      yield { type: 'tool_start', data: { name: event.name, input: event.data?.input } }
    } else if (kind === 'on_tool_end') {
      yield { type: 'tool_end', data: { name: event.name, output: event.data?.output } }
    }
  }

  // Get final state
  const finalState = await workflow.getState(config)
  yield { type: 'state_update', data: finalState.values }
}

/**
 * Resume workflow from a checkpoint
 */
export async function resumeCIMWorkflow(
  workflow: CIMWorkflow,
  threadId: string
): Promise<CIMAgentStateType | null> {
  const config = {
    configurable: { thread_id: threadId },
  }

  try {
    const state = await workflow.getState(config)
    return state.values as CIMAgentStateType
  } catch (error) {
    console.error('[resumeCIMWorkflow] Error:', error)
    return null
  }
}
