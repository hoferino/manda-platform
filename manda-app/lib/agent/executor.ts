/**
 * Agent Executor
 *
 * LangChain tool-calling agent with streaming support.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E11.1 - Tool Result Isolation
 * Story: E11.2 - Conversation Summarization
 * Story: E11.4 - Intent-Aware Knowledge Retrieval
 *
 * Features:
 * - Tool-calling agent with createReactAgent (LangGraph)
 * - Streaming token generation
 * - Context management for multi-turn conversations
 * - Error handling with graceful degradation
 * - Tool result isolation (E11.1) - summaries in context, full results in cache
 * - Conversation summarization (E11.2) - compress long conversations
 * - Pre-model retrieval hook (E11.4) - proactive knowledge injection
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { createLLMClient, createLLMClientWithFallback, type LLMConfig } from '@/lib/llm/client'
import { allChatTools, validateToolCount } from './tools/all-tools'
import { getSystemPrompt, getSystemPromptWithContext } from './prompts'
import {
  createToolResultCache,
  isolateAllTools,
  type ToolResultCache,
  type IsolationConfig,
  DEFAULT_ISOLATION_CONFIG,
} from './tool-isolation'
import {
  preModelRetrievalHook,
  type PreModelHookResult,
  type RetrievalMetrics,
} from './retrieval'
import {
  summarizeConversationHistory,
  shouldSummarize,
  estimateMessagesTokens,
  type SummarizationMetrics,
  type SummarizationConfig,
} from './summarization'
import { logLLMUsage, logFeatureUsage, calculateLLMCost } from '@/lib/observability/usage'
import { toUserFacingError } from '@/lib/errors/types'
import { getLLMConfig } from '@/lib/llm/config'

/**
 * Agent type returned by createReactAgent
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactAgentType = ReturnType<typeof createReactAgent>

/**
 * Configuration for the chat agent
 */
export interface ChatAgentConfig {
  dealId: string
  userId: string
  dealName?: string
  llmConfig?: Partial<LLMConfig>
  verbose?: boolean
  /** Tool isolation config (enabled by default) - E11.1 */
  isolation?: Partial<IsolationConfig>
  /** Disable tool isolation (for debugging) - E11.1 */
  disableIsolation?: boolean
}

/**
 * Extended agent type with tool result cache access
 * Story: E11.1 - Tool Result Isolation
 */
export interface ChatAgentWithCache {
  agent: ReactAgentType
  toolResultCache: ToolResultCache
}

/**
 * Message in conversation history
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
}

/**
 * Convert conversation messages to LangChain message format
 */
export function convertToLangChainMessages(messages: ConversationMessage[]): BaseMessage[] {
  return messages.map((msg) => {
    switch (msg.role) {
      case 'user':
        return new HumanMessage(msg.content)
      case 'assistant':
        return new AIMessage(msg.content)
      case 'system':
        return new SystemMessage(msg.content)
      default:
        return new HumanMessage(msg.content)
    }
  })
}

/**
 * Create a chat agent for M&A due diligence
 *
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E11.1 - Tool Result Isolation
 *
 * @param config - Agent configuration
 * @returns ChatAgentWithCache containing agent and tool result cache
 *
 * @example
 * ```typescript
 * const { agent, toolResultCache } = createChatAgent({
 *   dealId: 'uuid-1234',
 *   userId: 'uuid-5678',
 *   dealName: 'Project Alpha',
 * })
 *
 * const result = await executeChat(agent, "What's the Q3 revenue?")
 * // Access full tool results via toolResultCache if needed
 * ```
 */
export function createChatAgent(config: ChatAgentConfig): ChatAgentWithCache {
  // Validate that all 17 tools are present
  if (!validateToolCount()) {
    throw new Error('Tool validation failed: Expected 17 tools')
  }

  // Create LLM client with fallback (E12.6: Claude → Gemini on 429/503)
  const llm = createLLMClientWithFallback(config.llmConfig)

  // Get system prompt
  const systemPrompt = config.dealName
    ? getSystemPromptWithContext(config.dealName)
    : getSystemPrompt()

  // Create tool result cache for isolation (E11.1)
  const toolResultCache = createToolResultCache()

  // Determine tools to use - isolated or raw
  const isolationConfig: IsolationConfig = {
    ...DEFAULT_ISOLATION_CONFIG,
    ...config.isolation,
    verbose: config.verbose ?? false,
  }

  const tools = config.disableIsolation
    ? allChatTools
    : isolateAllTools(allChatTools, toolResultCache, isolationConfig)

  // Create the agent using LangGraph's createReactAgent
  const agent = createReactAgent({
    llm,
    tools,
    messageModifier: systemPrompt,
  })

  return { agent, toolResultCache }
}

/**
 * Get the tool result cache from a ChatAgentWithCache
 *
 * Story: E11.1 - Tool Result Isolation (AC: #4)
 */
export function getAgentToolCache(agentWithCache: ChatAgentWithCache): ToolResultCache {
  return agentWithCache.toolResultCache
}

/**
 * Execute a chat query with the agent
 *
 * @param agentOrWithCache - ReactAgent instance or ChatAgentWithCache
 * @param input - User input message
 * @param chatHistory - Previous conversation messages
 * @returns Agent response with tool calls
 */
export async function executeChat(
  agentOrWithCache: ReactAgentType | ChatAgentWithCache,
  input: string,
  chatHistory: ConversationMessage[] = []
): Promise<{
  output: string
  intermediateSteps: Array<{ action: { tool: string; toolInput: unknown }; observation: string }>
}> {
  // Support both raw agent and ChatAgentWithCache (E11.1)
  const agent = 'agent' in agentOrWithCache ? agentOrWithCache.agent : agentOrWithCache

  const langChainHistory = convertToLangChainMessages(chatHistory)

  try {
    // Build messages array
    const messages = [...langChainHistory, new HumanMessage(input)]

    // Invoke agent
    const result = await agent.invoke({ messages })

    // Extract output from last AI message
    const resultMessages = result.messages as BaseMessage[] | undefined
    const lastMessage = resultMessages?.[resultMessages.length - 1]
    const output = typeof lastMessage?.content === 'string'
      ? lastMessage.content
      : 'I was unable to generate a response.'

    return {
      output,
      intermediateSteps: [], // LangGraph API doesn't expose steps the same way
    }
  } catch (error) {
    console.error('[executeChat] Error:', error)

    // Return graceful error message
    return {
      output: 'I encountered an issue processing your request. Please try again or rephrase your question.',
      intermediateSteps: [],
    }
  }
}

/**
 * Options for streamChat and executeChat
 * Story: E11.2 - Conversation Summarization
 * Story: E11.4 - Intent-Aware Knowledge Retrieval
 * Story: E12.2 - Usage Logging Integration
 */
export interface ChatExecutionOptions {
  /** Deal ID for pre-model retrieval namespace isolation */
  dealId?: string
  /** User ID for usage attribution */
  userId?: string
  /** Organization ID for multi-tenant isolation (E12.9) */
  organizationId?: string
  /** Disable pre-model retrieval (for debugging) */
  disableRetrieval?: boolean
  /** Disable conversation summarization (for debugging) - E11.2 */
  disableSummarization?: boolean
}

/**
 * Stream chat execution with token-by-token output
 *
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E11.2 - Conversation Summarization (AC: #4, #5)
 * Story: E11.4 - Intent-Aware Knowledge Retrieval (AC: #3, #4)
 *
 * Hook Order (CRITICAL - per E11.2 spec):
 * 1. Summarization FIRST - reduces message count
 * 2. Retrieval SECOND - adds context to reduced messages
 *
 * Final message order:
 * 1. Retrieval context (SystemMessage) - from E11.4
 * 2. Conversation summary (SystemMessage) - from E11.2
 * 3. Recent messages (last 10 verbatim)
 * 4. New user message
 *
 * @param agentOrWithCache - ReactAgent instance or ChatAgentWithCache
 * @param input - User input message
 * @param chatHistory - Previous conversation messages
 * @param callbacks - Streaming callbacks
 * @param options - Execution options (dealId for pre-model retrieval)
 */
export async function streamChat(
  agentOrWithCache: ReactAgentType | ChatAgentWithCache,
  input: string,
  chatHistory: ConversationMessage[] = [],
  callbacks: {
    onToken?: (token: string) => void
    onToolStart?: (tool: string, input: unknown) => void
    onToolEnd?: (tool: string, output: string) => void
    onError?: (error: Error) => void
    /** Callback when pre-model retrieval completes (E11.4) */
    onRetrievalComplete?: (metrics: RetrievalMetrics) => void
    /** Callback when conversation summarization completes (E11.2) */
    onSummarizationComplete?: (metrics: SummarizationMetrics) => void
  } = {},
  options?: ChatExecutionOptions
): Promise<string> {
  // E12.2: Track timing for usage logging
  const chatStartTime = Date.now()

  // Support both raw agent and ChatAgentWithCache (E11.1)
  const agent = 'agent' in agentOrWithCache ? agentOrWithCache.agent : agentOrWithCache

  // Get LLM from agent for summarization (needed for E11.2)
  // Note: Use standard client for summarization (no fallback needed - low-stakes operation)
  // The main agent chat uses fallback via createChatAgent which calls createLLMClientWithFallback
  const llm = createLLMClient()

  const langChainHistory = convertToLangChainMessages(chatHistory)

  try {
    let messages: BaseMessage[] = [...langChainHistory, new HumanMessage(input)]

    // E11.2: Summarization hook FIRST (reduce message count)
    // This must run BEFORE retrieval to compress context
    if (!options?.disableSummarization && shouldSummarize(messages)) {
      const summarizationConfig: SummarizationConfig = {
        dealId: options?.dealId ?? 'default',
      }
      const summarizationResult = await summarizeConversationHistory(
        messages,
        llm,
        summarizationConfig
      )
      messages = summarizationResult.messages

      // Notify callback of summarization metrics
      callbacks.onSummarizationComplete?.(summarizationResult.metrics)
    }

    // E11.4: Pre-model retrieval hook SECOND
    // Proactively retrieve relevant knowledge before LLM generation
    if (options?.dealId && !options?.disableRetrieval) {
      const hookResult = await preModelRetrievalHook(messages, options.dealId)
      messages = hookResult.messages

      // Notify callback of retrieval metrics
      callbacks.onRetrievalComplete?.({
        latencyMs: hookResult.retrievalLatencyMs,
        cacheHit: hookResult.cacheHit,
        skipped: hookResult.skipped,
        intent: hookResult.intent,
        resultCount: hookResult.entities?.length,
      })
    }

    // ==========================================================================
    // TOKEN DEBUG: Diagnostic logging to trace token consumption
    // Remove this block after debugging is complete
    // ==========================================================================
    const systemPrompt = getSystemPrompt()
    const systemPromptTokens = Math.ceil(systemPrompt.length / 4)
    const messageTokens = estimateMessagesTokens(messages)
    const toolCount = allChatTools.length
    const toolDescriptionTokens = allChatTools.reduce((sum, tool) => {
      const descLength = (tool.description || '').length
      const schemaLength = JSON.stringify(tool.schema || {}).length
      return sum + Math.ceil((descLength + schemaLength) / 4)
    }, 0)

    console.log('='.repeat(60))
    console.log('[TOKEN DEBUG] === Per-Request Token Breakdown ===')
    console.log(`[TOKEN DEBUG] System prompt: ~${systemPromptTokens} tokens (${systemPrompt.length} chars)`)
    console.log(`[TOKEN DEBUG] Messages in context: ${messages.length} (~${messageTokens} tokens)`)
    console.log(`[TOKEN DEBUG] Tool definitions: ${toolCount} tools (~${toolDescriptionTokens} tokens)`)
    console.log(`[TOKEN DEBUG] User input: ~${Math.ceil(input.length / 4)} tokens`)
    console.log(`[TOKEN DEBUG] ESTIMATED TOTAL INPUT: ~${systemPromptTokens + messageTokens + toolDescriptionTokens + Math.ceil(input.length / 4)} tokens`)
    console.log('='.repeat(60))

    // Track LLM iterations (ReAct agent loop)
    let llmIterationCount = 0
    let totalStreamedTokens = 0
    // ==========================================================================

    // Use streaming with events
    const eventStream = agent.streamEvents(
      { messages },
      { version: 'v2' }
    )

    let fullOutput = ''

    for await (const event of eventStream) {
      const kind = event.event

      // TOKEN DEBUG: Count LLM iterations
      if (kind === 'on_chat_model_start') {
        llmIterationCount++
        console.log(`[TOKEN DEBUG] LLM iteration #${llmIterationCount} started`)
      }

      if (kind === 'on_chat_model_stream') {
        // Token streaming
        const content = event.data?.chunk?.content
        if (content && typeof content === 'string') {
          fullOutput += content
          totalStreamedTokens++
          callbacks.onToken?.(content)
        }
      } else if (kind === 'on_tool_start') {
        // Tool invocation started
        console.log(`[TOKEN DEBUG] Tool started: ${event.name}`)
        callbacks.onToolStart?.(event.name, event.data?.input)
      } else if (kind === 'on_tool_end') {
        // Tool invocation ended
        const outputStr = typeof event.data?.output === 'string'
          ? event.data.output
          : JSON.stringify(event.data?.output || '')
        console.log(`[TOKEN DEBUG] Tool ended: ${event.name} (output: ~${Math.ceil(outputStr.length / 4)} tokens)`)
        callbacks.onToolEnd?.(event.name, event.data?.output as string)
      }
    }

    // TOKEN DEBUG: Final summary
    console.log('='.repeat(60))
    console.log('[TOKEN DEBUG] === Request Complete ===')
    console.log(`[TOKEN DEBUG] Total LLM iterations: ${llmIterationCount}`)
    console.log(`[TOKEN DEBUG] Output tokens: ~${Math.ceil(fullOutput.length / 4)}`)
    console.log(`[TOKEN DEBUG] If iterations > 1, multiply input estimate by iteration count!`)
    console.log(`[TOKEN DEBUG] ESTIMATED REAL INPUT: ~${(systemPromptTokens + messageTokens + toolDescriptionTokens) * llmIterationCount} tokens`)
    console.log('='.repeat(60))

    // E12.2: Log LLM usage to database
    // NOTE: Token counts are ESTIMATED - LangChain doesn't expose actual usage
    // chars/4 ≈ tokens is a reasonable approximation for cost tracking
    try {
      const estimatedInputTokens = Math.ceil(input.length / 4)
      const estimatedOutputTokens = Math.ceil(fullOutput.length / 4)

      // Get provider/model from config dynamically (fixes hardcoded values)
      const llmConfig = getLLMConfig()
      const provider = llmConfig.provider
      // Normalize model name to match cost lookup format (e.g., 'claude-sonnet-4-0')
      const model = llmConfig.model.includes('claude-sonnet-4')
        ? 'claude-sonnet-4-0'
        : llmConfig.model.includes('gemini-2.5-flash')
          ? 'gemini-2.5-flash'
          : llmConfig.model.includes('gemini-2.5-pro')
            ? 'gemini-2.5-pro'
            : llmConfig.model

      await logLLMUsage({
        organizationId: options?.organizationId,
        dealId: options?.dealId,
        userId: options?.userId,
        provider,
        model,
        feature: 'chat',
        inputTokens: estimatedInputTokens,
        outputTokens: estimatedOutputTokens,
        costUsd: calculateLLMCost(provider, model, estimatedInputTokens, estimatedOutputTokens),
        latencyMs: Date.now() - chatStartTime,
      })
    } catch (loggingError) {
      console.error('[streamChat] Usage logging failed:', loggingError)
      // Don't fail the chat for logging errors - observability is non-blocking
    }

    return fullOutput
  } catch (error) {
    const userError = toUserFacingError(error)
    console.error('[streamChat] Error:', userError.cause ?? error)

    // E12.6: Log error with full context
    try {
      await logFeatureUsage({
        organizationId: options?.organizationId,
        dealId: options?.dealId,
        userId: options?.userId,
        featureName: 'chat',
        status: 'error',
        durationMs: Date.now() - chatStartTime,
        errorMessage: userError.message,
        metadata: {
          errorType: userError.constructor.name,
          isRetryable: userError.isRetryable,
          stack: userError.cause?.stack,
        },
      })
    } catch (loggingError) {
      console.error('[streamChat] Error logging failed:', loggingError)
    }

    callbacks.onError?.(userError)
    throw userError
  }
}

/**
 * Get available tool names
 */
export function getAvailableTools(): string[] {
  return allChatTools.map((tool) => tool.name)
}

/**
 * Context manager for conversation history
 */
export class ConversationContext {
  private messages: ConversationMessage[] = []
  private maxMessages: number

  constructor(maxMessages: number = 10) {
    this.maxMessages = maxMessages
  }

  /**
   * Add a message to the context
   */
  addMessage(role: 'user' | 'assistant', content: string): void {
    this.messages.push({
      role,
      content,
      timestamp: new Date().toISOString(),
    })

    // Trim to max messages (keeping pairs)
    while (this.messages.length > this.maxMessages * 2) {
      this.messages.shift()
    }
  }

  /**
   * Get all messages
   */
  getMessages(): ConversationMessage[] {
    return [...this.messages]
  }

  /**
   * Clear context
   */
  clear(): void {
    this.messages = []
  }

  /**
   * Get message count
   */
  get count(): number {
    return this.messages.length
  }

  /**
   * Load from stored messages
   */
  loadFromStorage(messages: ConversationMessage[]): void {
    this.messages = messages.slice(-this.maxMessages * 2)
  }
}
