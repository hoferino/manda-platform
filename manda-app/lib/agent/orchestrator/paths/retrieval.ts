/**
 * Retrieval Path
 *
 * Queries Neo4j/Graphiti for relevant context, then injects it into the LLM prompt.
 * Used for questions about deal documents, company data, financials, etc.
 *
 * NO TOOLS - just retrieval + context injection + LLM response.
 */

import { ChatOpenAI } from '@langchain/openai'
import { HumanMessage, SystemMessage, AIMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'

// =============================================================================
// Configuration
// =============================================================================

const PROCESSING_API_URL = process.env.PROCESSING_API_URL || 'http://localhost:8000'
const PROCESSING_API_KEY = process.env.PROCESSING_API_KEY || ''

/**
 * System prompt for retrieval path - M&A assistant with document context
 */
const RETRIEVAL_SYSTEM_PROMPT = `You are an M&A Due Diligence Assistant helping analysts review documents and extract insights.

## Your Role
You answer questions about deal documents, company information, and financial data based on the context provided to you.

## Key Rules
1. **Only use provided context** - Base your answers on the knowledge provided below. If the information isn't in the context, say so clearly.
2. **Cite sources** - When referencing specific facts, mention the source document.
3. **Be concise** - Give direct answers without unnecessary preamble.
4. **Acknowledge gaps** - If you can't find information in the provided context, offer to help the user create a Q&A item for the target company.

## Handling Missing Information
If the user asks about something not in the provided context:
- Say: "I don't see that information in the uploaded documents."
- Offer: "Would you like me to add this to your Q&A list for the target company?"
- DO NOT make up information or speculate about data not in the context.`

/**
 * Model configuration for retrieval path
 */
const RETRIEVAL_MODEL_CONFIG = {
  modelName: 'gpt-4o-mini',
  temperature: 0.3, // Lower temperature for factual responses
  maxTokens: 2000,
}

/** Maximum tokens for retrieval context */
const MAX_CONTEXT_TOKENS = 2000

// =============================================================================
// Types
// =============================================================================

export interface RetrievalPathInput {
  message: string
  dealId: string
  organizationId?: string
  chatHistory?: BaseMessage[]
}

export interface RetrievalPathResult {
  content: string
  latencyMs: number
  retrievalLatencyMs: number
  model: string
  sources: Array<{
    documentName?: string
    page?: number
    excerpt?: string
  }>
  hadContext: boolean
  inputTokens?: number
  outputTokens?: number
}

/**
 * Result from Graphiti hybrid search
 */
interface HybridSearchResult {
  content: string
  score: number
  citation?: {
    type: string
    title: string
    page?: number
  }
}

/**
 * Response from Graphiti hybrid search API
 */
interface HybridSearchResponse {
  results: HybridSearchResult[]
  entities: string[]
  latency_ms: number
}

// =============================================================================
// Retrieval
// =============================================================================

/**
 * Call Graphiti hybrid search API
 */
async function searchGraphiti(
  query: string,
  dealId: string
): Promise<HybridSearchResponse | null> {
  try {
    const response = await fetch(`${PROCESSING_API_URL}/api/search/hybrid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': PROCESSING_API_KEY,
      },
      body: JSON.stringify({
        query,
        deal_id: dealId,
        num_results: 8, // Retrieve more for better context
      }),
    })

    if (!response.ok) {
      console.warn(`[RetrievalPath] Graphiti search failed: ${response.status}`)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('[RetrievalPath] Graphiti search error:', error)
    return null
  }
}

/**
 * Format retrieved results into context string
 */
function formatContext(
  results: HybridSearchResult[],
  maxTokens: number = MAX_CONTEXT_TOKENS
): { context: string; tokenCount: number; sources: RetrievalPathResult['sources'] } {
  let context = ''
  let estimatedTokens = 0
  const sources: RetrievalPathResult['sources'] = []

  for (const result of results) {
    const source = result.citation?.title || 'Unknown'
    const page = result.citation?.page ? ` (p${result.citation.page})` : ''
    const line = `- ${result.content} [Source: ${source}${page}]\n`
    const lineTokens = Math.ceil(line.length / 4)

    if (estimatedTokens + lineTokens > maxTokens) {
      break
    }

    context += line
    estimatedTokens += lineTokens

    sources.push({
      documentName: result.citation?.title,
      page: result.citation?.page,
      excerpt: result.content.slice(0, 200),
    })
  }

  return { context: context.trim(), tokenCount: estimatedTokens, sources }
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Execute the retrieval path
 *
 * 1. Query Graphiti for relevant context
 * 2. Inject context into system prompt
 * 3. Generate LLM response
 *
 * @param input - User message, deal ID, and optional chat history
 * @returns LLM response with retrieval metrics and sources
 */
export async function executeRetrievalPath(input: RetrievalPathInput): Promise<RetrievalPathResult> {
  const startTime = Date.now()

  // Step 1: Retrieve context from Graphiti
  const retrievalStart = Date.now()
  const searchResult = await searchGraphiti(input.message, input.dealId)
  const retrievalLatencyMs = Date.now() - retrievalStart

  // Format context
  let contextSection = ''
  let sources: RetrievalPathResult['sources'] = []
  let hadContext = false

  if (searchResult?.results?.length) {
    const formatted = formatContext(searchResult.results)
    contextSection = `\n\n## Relevant Knowledge from Documents\n${formatted.context}`
    sources = formatted.sources
    hadContext = true
    console.log(`[RetrievalPath] Retrieved ${searchResult.results.length} results (${formatted.tokenCount} tokens) in ${retrievalLatencyMs}ms`)
  } else {
    contextSection = '\n\n## Note\nNo relevant documents were found for this query. The Data Room may not contain information about this topic.'
    console.log(`[RetrievalPath] No results found in ${retrievalLatencyMs}ms`)
  }

  // Step 2: Build system prompt with context
  const fullSystemPrompt = RETRIEVAL_SYSTEM_PROMPT + contextSection

  // Step 3: Create LLM client and invoke
  const llm = new ChatOpenAI({
    ...RETRIEVAL_MODEL_CONFIG,
    streaming: false,
  })

  const messages: BaseMessage[] = [
    new SystemMessage(fullSystemPrompt),
    ...(input.chatHistory || []),
    new HumanMessage(input.message),
  ]

  const response = await llm.invoke(messages)

  const content = typeof response.content === 'string'
    ? response.content
    : JSON.stringify(response.content)

  return {
    content,
    latencyMs: Date.now() - startTime,
    retrievalLatencyMs,
    model: RETRIEVAL_MODEL_CONFIG.modelName,
    sources,
    hadContext,
    inputTokens: response.usage_metadata?.input_tokens,
    outputTokens: response.usage_metadata?.output_tokens,
  }
}

/**
 * Stream the retrieval path
 *
 * @param input - User message, deal ID, and optional chat history
 * @param onToken - Callback for each token
 * @returns Final response with metrics
 */
export async function streamRetrievalPath(
  input: RetrievalPathInput,
  onToken: (token: string) => void
): Promise<RetrievalPathResult> {
  const startTime = Date.now()

  // Step 1: Retrieve context from Graphiti
  const retrievalStart = Date.now()
  const searchResult = await searchGraphiti(input.message, input.dealId)
  const retrievalLatencyMs = Date.now() - retrievalStart

  // Format context
  let contextSection = ''
  let sources: RetrievalPathResult['sources'] = []
  let hadContext = false

  if (searchResult?.results?.length) {
    const formatted = formatContext(searchResult.results)
    contextSection = `\n\n## Relevant Knowledge from Documents\n${formatted.context}`
    sources = formatted.sources
    hadContext = true
    console.log(`[RetrievalPath] Retrieved ${searchResult.results.length} results in ${retrievalLatencyMs}ms`)
  } else {
    contextSection = '\n\n## Note\nNo relevant documents were found for this query. The Data Room may not contain information about this topic.'
    console.log(`[RetrievalPath] No results found in ${retrievalLatencyMs}ms`)
  }

  // Step 2: Build system prompt with context
  const fullSystemPrompt = RETRIEVAL_SYSTEM_PROMPT + contextSection

  // Step 3: Create streaming LLM client
  const llm = new ChatOpenAI({
    ...RETRIEVAL_MODEL_CONFIG,
    streaming: true,
  })

  const messages: BaseMessage[] = [
    new SystemMessage(fullSystemPrompt),
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
    retrievalLatencyMs,
    model: RETRIEVAL_MODEL_CONFIG.modelName,
    sources,
    hadContext,
  }
}
