/**
 * Vanilla LLM Path
 *
 * Direct LLM response without tools or retrieval.
 * Used for greetings, general chat, and off-topic questions.
 *
 * This provides a ChatGPT-like experience for non-document queries.
 */

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

// =============================================================================
// Configuration
// =============================================================================

/**
 * System prompt for vanilla path - general assistant, NOT M&A specific
 */
const VANILLA_SYSTEM_PROMPT = `You are a helpful assistant. You can help with general questions, explanations, and conversation.

Keep your responses concise and helpful. If someone greets you, respond warmly but briefly.

If someone asks about specific documents, deals, or company data that would require searching a database, let them know you'd be happy to help - just ask them to phrase the question as a query about the deal documents.`

/**
 * Model configuration for vanilla path (fast and cheap)
 */
const VANILLA_MODEL_CONFIG = {
  modelName: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 500,
}

// =============================================================================
// Types
// =============================================================================

export interface VanillaPathInput {
  message: string
  chatHistory?: BaseMessage[]
}

export interface VanillaPathResult {
  content: string
  latencyMs: number
  model: string
  inputTokens?: number
  outputTokens?: number
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Execute the vanilla LLM path
 *
 * @param input - User message and optional chat history
 * @returns LLM response with metrics
 */
export async function executeVanillaPath(input: VanillaPathInput): Promise<VanillaPathResult> {
  const startTime = Date.now()

  // Create lightweight LLM client
  const llm = new ChatOpenAI({
    ...VANILLA_MODEL_CONFIG,
    streaming: false,
  })

  // Build messages
  const messages: BaseMessage[] = [
    new SystemMessage(VANILLA_SYSTEM_PROMPT),
    ...(input.chatHistory || []),
    new HumanMessage(input.message),
  ]

  // Invoke LLM
  const response = await llm.invoke(messages)

  const content = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content)

  return {
    content,
    latencyMs: Date.now() - startTime,
    model: VANILLA_MODEL_CONFIG.modelName,
    // Token counts from response metadata if available
    inputTokens: response.usage_metadata?.input_tokens,
    outputTokens: response.usage_metadata?.output_tokens,
  }
}

/**
 * Stream the vanilla LLM path
 *
 * @param input - User message and optional chat history
 * @param onToken - Callback for each token
 * @returns Final response with metrics
 */
export async function streamVanillaPath(
  input: VanillaPathInput,
  onToken: (token: string) => void
): Promise<VanillaPathResult> {
  const startTime = Date.now()

  // Create streaming LLM client
  const llm = new ChatOpenAI({
    ...VANILLA_MODEL_CONFIG,
    streaming: true,
  })

  // Build messages
  const messages: BaseMessage[] = [
    new SystemMessage(VANILLA_SYSTEM_PROMPT),
    ...(input.chatHistory || []),
    new HumanMessage(input.message),
  ]

  // Stream response
  let fullContent = ''
  const stream = await llm.stream(messages)

  for await (const chunk of stream) {
    const content = typeof chunk.content === 'string' ? chunk.content : ''
    if (content) {
      fullContent += content
      onToken(content)
    }
  }

  return {
    content: fullContent,
    latencyMs: Date.now() - startTime,
    model: VANILLA_MODEL_CONFIG.modelName,
  }
}

/**
 * Convert conversation messages to LangChain format
 */
export function convertToBaseMessages(
  messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>
): BaseMessage[] {
  return messages.map(msg => {
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
