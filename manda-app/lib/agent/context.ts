/**
 * Conversation Context Manager
 *
 * Manages conversation context for multi-turn conversations with token-aware truncation.
 * Story: E5.6 - Add Conversation Context and Multi-turn Support
 * Story: E11.2 - Conversation Summarization (LLM-based)
 *
 * Features:
 * - Load conversation history from database
 * - Token counting using tiktoken
 * - Automatic truncation when exceeding token limit
 * - Optional LLM-based summarization of older messages (E11.2)
 *
 * P4 Compliance (from agent-behavior-spec.md):
 * - Clear follow-ups: assume same context, state assumption briefly
 * - Ambiguous follow-ups: ask for clarification
 * - Topic shifts: treat as new query, reset context
 */

import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

/**
 * Configuration options for context management
 */
export interface ConversationContextOptions {
  /** Maximum number of messages to include (default: 10) */
  maxMessages: number
  /** Maximum tokens for context window (default: 8000) */
  maxTokens: number
  /** Enable summarization of older messages (default: false) */
  enableSummarization: boolean
}

/**
 * Default context options
 */
export const DEFAULT_CONTEXT_OPTIONS: ConversationContextOptions = {
  maxMessages: 10,
  maxTokens: 8000,
  enableSummarization: false,
}

/**
 * Formatted context ready for LLM consumption
 */
export interface FormattedContext {
  /** LangChain message objects for the agent */
  messages: BaseMessage[]
  /** Total token count of the context */
  tokenCount: number
  /** Whether truncation was applied */
  wasTruncated: boolean
  /** Summary of truncated messages (if summarization enabled) */
  summary?: string
  /** Original message count before truncation */
  originalMessageCount: number
}

/**
 * Database message format (from Supabase)
 */
export interface DatabaseMessage {
  id: string
  conversation_id: string
  role: 'human' | 'ai' | 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: unknown
  tool_results?: unknown
  sources?: unknown
  created_at: string
}

/**
 * Conversation message format
 */
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp?: string
  toolCalls?: unknown
  sources?: unknown
}

/**
 * Normalize message role from database to standard format
 * Database uses 'human'/'ai', code uses 'user'/'assistant'
 */
export function normalizeMessageRole(
  role: DatabaseMessage['role']
): 'user' | 'assistant' | 'system' {
  switch (role) {
    case 'human':
    case 'user':
      return 'user'
    case 'ai':
    case 'assistant':
      return 'assistant'
    case 'system':
      return 'system'
    case 'tool':
      // Tool messages are treated as assistant messages in context
      return 'assistant'
    default:
      return 'user'
  }
}

/**
 * Convert database messages to conversation messages
 */
export function convertDatabaseMessages(
  dbMessages: DatabaseMessage[]
): ConversationMessage[] {
  return dbMessages.map((msg) => ({
    role: normalizeMessageRole(msg.role),
    content: msg.content,
    timestamp: msg.created_at,
    toolCalls: msg.tool_calls,
    sources: msg.sources,
  }))
}

/**
 * Convert conversation messages to LangChain message format
 */
export function convertToLangChainMessages(
  messages: ConversationMessage[]
): BaseMessage[] {
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
 * Token counter using character-based estimation
 *
 * Uses ~4 characters per token approximation (industry standard for GPT/Claude)
 * This avoids WASM dependencies that don't work with Next.js Edge runtime
 */
export class TokenCounter {
  /**
   * Count tokens in a string
   *
   * Uses character-based estimation: ~4 characters per token
   * This is a conservative estimate that works well for English text
   */
  countTokens(text: string): number {
    // Average ~4 characters per token for English text
    // This is a standard approximation used across LLM tooling
    return Math.ceil(text.length / 4)
  }

  /**
   * Count tokens in a message
   */
  countMessageTokens(message: ConversationMessage): number {
    // Account for role prefix and formatting overhead (~4 tokens)
    const roleOverhead = 4
    return this.countTokens(message.content) + roleOverhead
  }

  /**
   * Count tokens in an array of messages
   */
  countMessagesTokens(messages: ConversationMessage[]): number {
    return messages.reduce((total, msg) => total + this.countMessageTokens(msg), 0)
  }

  /**
   * Dispose method (no-op, kept for API compatibility)
   */
  dispose(): void {
    // No resources to clean up with character-based estimation
  }
}

/**
 * Global token counter instance
 */
let globalTokenCounter: TokenCounter | null = null

/**
 * Get or create the global token counter
 */
export function getTokenCounter(): TokenCounter {
  if (!globalTokenCounter) {
    globalTokenCounter = new TokenCounter()
  }
  return globalTokenCounter
}

/**
 * Estimate tokens in text (convenience function)
 */
export function estimateTokens(text: string): number {
  return getTokenCounter().countTokens(text)
}

/**
 * Conversation Context Manager
 *
 * Handles loading, formatting, and token-aware truncation of conversation history.
 * Story: E11.2 - Now supports optional LLM for summarization
 */
export class ConversationContextManager {
  private options: ConversationContextOptions
  private tokenCounter: TokenCounter
  /** Optional LLM for E11.2 summarization */
  private llm?: BaseChatModel

  /**
   * Create a new ConversationContextManager
   *
   * @param options - Context management options
   * @param llm - Optional LLM for LLM-based summarization (E11.2)
   */
  constructor(options: Partial<ConversationContextOptions> = {}, llm?: BaseChatModel) {
    this.options = { ...DEFAULT_CONTEXT_OPTIONS, ...options }
    this.tokenCounter = getTokenCounter()
    this.llm = llm
  }

  /**
   * Format messages for LLM context with token-aware truncation
   *
   * @param messages - Conversation messages to format
   * @returns Formatted context ready for LLM
   */
  formatContext(messages: ConversationMessage[]): FormattedContext {
    const originalCount = messages.length

    // Start with the most recent messages
    const contextMessages = [...messages].slice(-this.options.maxMessages * 2)

    // Count tokens
    let tokenCount = this.tokenCounter.countMessagesTokens(contextMessages)

    // Truncate oldest messages if over token limit
    let wasTruncated = false
    while (
      tokenCount > this.options.maxTokens &&
      contextMessages.length > 2 // Keep at least last Q&A pair
    ) {
      contextMessages.shift() // Remove oldest message
      tokenCount = this.tokenCounter.countMessagesTokens(contextMessages)
      wasTruncated = true
    }

    // Log truncation for debugging
    if (wasTruncated) {
      console.log(
        `[ConversationContextManager] Truncated context: ${originalCount} → ${contextMessages.length} messages, ${tokenCount} tokens`
      )
    }

    // Convert to LangChain format
    const langChainMessages = convertToLangChainMessages(contextMessages)

    return {
      messages: langChainMessages,
      tokenCount,
      wasTruncated,
      originalMessageCount: originalCount,
    }
  }

  /**
   * Load conversation history from database messages
   *
   * @param dbMessages - Raw database messages
   * @returns Formatted context ready for LLM
   */
  loadFromDatabase(dbMessages: DatabaseMessage[]): FormattedContext {
    const conversationMessages = convertDatabaseMessages(dbMessages)
    return this.formatContext(conversationMessages)
  }

  /**
   * Count tokens in messages
   */
  countTokens(messages: ConversationMessage[]): number {
    return this.tokenCounter.countMessagesTokens(messages)
  }

  /**
   * Truncate messages to fit within token limit
   *
   * @param messages - Messages to truncate
   * @param maxTokens - Maximum token limit (uses default if not specified)
   * @returns Truncated messages
   */
  truncateToFit(
    messages: ConversationMessage[],
    maxTokens?: number
  ): ConversationMessage[] {
    const limit = maxTokens ?? this.options.maxTokens
    const result = [...messages]

    while (this.tokenCounter.countMessagesTokens(result) > limit && result.length > 2) {
      result.shift()
    }

    return result
  }

  /**
   * Summarize older messages using LLM or fallback to topic extraction
   *
   * Story: E11.2 - Conversation Summarization
   *
   * If LLM is available, delegates to the new LLM-based summarization.
   * Otherwise, falls back to simple topic extraction.
   *
   * @param messages - Messages to summarize
   * @returns Summary string
   */
  async summarizeOlderMessages(messages: ConversationMessage[]): Promise<string> {
    if (messages.length === 0) {
      return ''
    }

    // E11.2: If LLM is available, use the new summarization module
    if (this.llm) {
      try {
        // Import dynamically to avoid circular dependencies
        const { summarizeConversationHistory } = await import('./summarization')
        const langChainMessages = convertToLangChainMessages(messages)
        const result = await summarizeConversationHistory(langChainMessages, this.llm)
        return result.summaryText || this.extractTopics(messages)
      } catch (error) {
        console.warn('[ConversationContextManager] LLM summarization failed, using fallback:', error)
        return this.extractTopics(messages)
      }
    }

    // Fallback to simple topic extraction
    return this.extractTopics(messages)
  }

  /**
   * Extract topics from messages (simple fallback for summarization)
   *
   * @param messages - Messages to extract topics from
   * @returns Topic summary string
   */
  private extractTopics(messages: ConversationMessage[]): string {
    const topics = new Set<string>()
    messages.forEach((msg) => {
      // Extract potential topics from user messages
      if (msg.role === 'user') {
        // Simple topic extraction - look for key patterns
        const revenueMatch = msg.content.match(/revenue|EBITDA|margin|profit/i)
        const companyMatch = msg.content.match(/company|team|management|employee/i)
        const financialMatch = msg.content.match(/financial|P&L|balance sheet/i)

        if (revenueMatch) topics.add('financial metrics')
        if (companyMatch) topics.add('company information')
        if (financialMatch) topics.add('financial statements')
      }
    })

    if (topics.size === 0) {
      return `Previous conversation included ${messages.length} earlier exchanges.`
    }

    return `Earlier in this conversation, we discussed: ${Array.from(topics).join(', ')}.`
  }

  /**
   * Get configuration options
   */
  getOptions(): ConversationContextOptions {
    return { ...this.options }
  }

  /**
   * Format context with LLM-based summarization
   *
   * Story: E11.2 - Conversation Summarization
   *
   * Enhanced version of formatContext that uses LLM summarization
   * when available and context exceeds threshold.
   *
   * @param messages - Conversation messages to format
   * @returns FormattedContext with optional summary
   */
  async formatContextWithSummarization(messages: ConversationMessage[]): Promise<FormattedContext> {
    const originalCount = messages.length

    // If under threshold or no LLM, use standard formatting
    if (messages.length <= this.options.maxMessages * 2 || !this.llm) {
      return this.formatContext(messages)
    }

    // Split messages: older ones for summarization, recent ones to keep
    const messagesToSummarize = messages.slice(0, -this.options.maxMessages)
    const recentMessages = messages.slice(-this.options.maxMessages)

    // Generate summary of older messages
    const summary = await this.summarizeOlderMessages(messagesToSummarize)

    // Convert recent messages to LangChain format
    const langChainMessages = convertToLangChainMessages(recentMessages)

    // Add summary as a system message at the start
    if (summary) {
      langChainMessages.unshift(new SystemMessage(`Previous context: ${summary}`))
    }

    const tokenCount = this.tokenCounter.countMessagesTokens(recentMessages)

    return {
      messages: langChainMessages,
      tokenCount,
      wasTruncated: true,
      summary,
      originalMessageCount: originalCount,
    }
  }

  /**
   * Check if LLM is available for summarization
   */
  hasLLM(): boolean {
    return !!this.llm
  }

  /**
   * Set LLM for summarization (allows updating after construction)
   *
   * @param llm - LangChain chat model
   */
  setLLM(llm: BaseChatModel): void {
    this.llm = llm
  }
}

/**
 * Create a context manager with custom options
 *
 * @param options - Context management options
 * @param llm - Optional LLM for summarization (E11.2)
 */
export function createContextManager(
  options?: Partial<ConversationContextOptions>,
  llm?: BaseChatModel
): ConversationContextManager {
  return new ConversationContextManager(options, llm)
}
