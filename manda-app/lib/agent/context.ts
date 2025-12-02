/**
 * Conversation Context Manager
 *
 * Manages conversation context for multi-turn conversations with token-aware truncation.
 * Story: E5.6 - Add Conversation Context and Multi-turn Support
 *
 * Features:
 * - Load conversation history from database
 * - Token counting using tiktoken
 * - Automatic truncation when exceeding token limit
 * - Optional summarization of older messages
 *
 * P4 Compliance (from agent-behavior-spec.md):
 * - Clear follow-ups: assume same context, state assumption briefly
 * - Ambiguous follow-ups: ask for clarification
 * - Topic shifts: treat as new query, reset context
 */

import { HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

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
 */
export class ConversationContextManager {
  private options: ConversationContextOptions
  private tokenCounter: TokenCounter

  constructor(options: Partial<ConversationContextOptions> = {}) {
    this.options = { ...DEFAULT_CONTEXT_OPTIONS, ...options }
    this.tokenCounter = getTokenCounter()
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
    let contextMessages = [...messages].slice(-this.options.maxMessages * 2)

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
   * Optional: Summarize older messages (future enhancement)
   *
   * This is a placeholder for future LLM-based summarization.
   * Currently returns a simple truncation message.
   *
   * @param messages - Messages to summarize
   * @returns Summary string
   */
  async summarizeOlderMessages(messages: ConversationMessage[]): Promise<string> {
    // For now, return a simple summary
    // Future: Use LLM to generate a proper summary
    if (messages.length === 0) {
      return ''
    }

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
}

/**
 * Create a context manager with custom options
 */
export function createContextManager(
  options?: Partial<ConversationContextOptions>
): ConversationContextManager {
  return new ConversationContextManager(options)
}
