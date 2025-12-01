/**
 * Agent Executor
 *
 * LangChain tool-calling agent with streaming support.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Features:
 * - Tool-calling agent with createReactAgent (LangGraph)
 * - Streaming token generation
 * - Context management for multi-turn conversations
 * - Error handling with graceful degradation
 */

import { createReactAgent } from '@langchain/langgraph/prebuilt'
import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import { createLLMClient, type LLMConfig } from '@/lib/llm/client'
import { allChatTools, validateToolCount } from './tools/all-tools'
import { getSystemPrompt, getSystemPromptWithContext } from './prompts'

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
 * @param config - Agent configuration
 * @returns ReactAgent instance with all 11 chat tools
 *
 * @example
 * ```typescript
 * const agent = await createChatAgent({
 *   dealId: 'uuid-1234',
 *   userId: 'uuid-5678',
 *   dealName: 'Project Alpha',
 * })
 *
 * const result = await executeChat(agent, "What's the Q3 revenue?")
 * ```
 */
export function createChatAgent(config: ChatAgentConfig): ReactAgentType {
  // Validate that all 11 tools are present
  if (!validateToolCount()) {
    throw new Error('Tool validation failed: Expected 11 tools')
  }

  // Create LLM client
  const llm = createLLMClient(config.llmConfig)

  // Get system prompt
  const systemPrompt = config.dealName
    ? getSystemPromptWithContext(config.dealName)
    : getSystemPrompt()

  // Create the agent using LangGraph's createReactAgent
  const agent = createReactAgent({
    llm,
    tools: allChatTools,
    messageModifier: systemPrompt,
  })

  return agent
}

/**
 * Execute a chat query with the agent
 *
 * @param agent - ReactAgent instance
 * @param input - User input message
 * @param chatHistory - Previous conversation messages
 * @returns Agent response with tool calls
 */
export async function executeChat(
  agent: ReactAgentType,
  input: string,
  chatHistory: ConversationMessage[] = []
): Promise<{
  output: string
  intermediateSteps: Array<{ action: { tool: string; toolInput: unknown }; observation: string }>
}> {
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
 * Stream chat execution with token-by-token output
 *
 * @param agent - ReactAgent instance
 * @param input - User input message
 * @param chatHistory - Previous conversation messages
 * @param callbacks - Streaming callbacks
 */
export async function streamChat(
  agent: ReactAgentType,
  input: string,
  chatHistory: ConversationMessage[] = [],
  callbacks: {
    onToken?: (token: string) => void
    onToolStart?: (tool: string, input: unknown) => void
    onToolEnd?: (tool: string, output: string) => void
    onError?: (error: Error) => void
  } = {}
): Promise<string> {
  const langChainHistory = convertToLangChainMessages(chatHistory)

  try {
    const messages = [...langChainHistory, new HumanMessage(input)]

    // Use streaming with events
    const eventStream = agent.streamEvents(
      { messages },
      { version: 'v2' }
    )

    let fullOutput = ''

    for await (const event of eventStream) {
      const kind = event.event

      if (kind === 'on_chat_model_stream') {
        // Token streaming
        const content = event.data?.chunk?.content
        if (content && typeof content === 'string') {
          fullOutput += content
          callbacks.onToken?.(content)
        }
      } else if (kind === 'on_tool_start') {
        // Tool invocation started
        callbacks.onToolStart?.(event.name, event.data?.input)
      } else if (kind === 'on_tool_end') {
        // Tool invocation ended
        callbacks.onToolEnd?.(event.name, event.data?.output as string)
      }
    }

    return fullOutput
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    console.error('[streamChat] Error:', err)
    callbacks.onError?.(err)
    throw err
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
