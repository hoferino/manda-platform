/**
 * Agent System v2.0 - Retrieval Node
 *
 * Story: 3-1 Implement Retrieval Node with Graphiti Integration (AC: #1-#5)
 *
 * Searches Graphiti knowledge graph for deal-specific context.
 * This node implements the "Select" pillar of context engineering,
 * retrieving relevant knowledge from the deal's document corpus.
 *
 * Key Features:
 * - Query complexity-based search method selection (AC: #2)
 *   - Simple queries → vector-only search (~100ms)
 *   - Medium/Complex queries → full hybrid search (vector + BM25 + graph, ~300-500ms)
 * - Graphiti integration via callGraphitiSearch with search_method parameter
 * - Deal namespace isolation via dealId
 * - Source citation tracking with SourceCitation[] output
 * - Graceful degradation on errors (returns empty sources, not throw)
 * - Latency logging with 500ms warning threshold (NFR3)
 *
 * Graph Integration:
 * ```
 * User Message → Supervisor → (decides to retrieve) → Retrieval Node → Supervisor → Response
 * ```
 *
 * Note: Deal context is populated via createInitialState() in the API route.
 * Only dealId is guaranteed populated. Do NOT assume other fields exist.
 *
 * References:
 * - [Source: lib/agent/retrieval.ts:319-347] - callGraphitiSearch function
 * - [Source: lib/agent/retrieval.ts:79-96] - HybridSearchResult/Response types
 * - [Source: lib/agent/v2/types.ts:38-58] - SourceCitation interface
 * - [Source: lib/agent/intent.ts:259-297] - classifyComplexity function
 * - [Source: CLAUDE.md#Agent System v2.0] - Naming conventions
 */

import type { AgentStateType } from '../state'
import type { SourceCitation } from '../types'
import { callGraphitiSearch, type SearchMethod } from '@/lib/agent/retrieval'
import { classifyComplexity, type ComplexityLevel } from '@/lib/agent/intent'

// =============================================================================
// Types
// =============================================================================

/**
 * Hybrid search result from Graphiti API.
 * Note: The actual API response includes citation.id which is not in the
 * TypeScript definition at lib/agent/retrieval.ts:79-87.
 */
interface HybridSearchResult {
  content: string
  score: number
  citation?: {
    type: string
    title: string
    page?: number
    id?: string // Not in types but present in API response
  }
}

/**
 * Response from Graphiti hybrid search API.
 */
interface HybridSearchResponse {
  results: HybridSearchResult[]
  entities: string[]
  latency_ms: number
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * Latency warning threshold in milliseconds (NFR3: <500ms for simple retrieval)
 */
const LATENCY_TARGET_MS = 500

// =============================================================================
// Search Method Selection (AC: #2)
// =============================================================================

/**
 * Map query complexity to search method for performance optimization.
 * Story: 3-1 AC #2 - Search method selection based on query type.
 *
 * - Simple queries (e.g., "What is Q3 revenue?") → vector-only (~100ms)
 * - Medium/Complex queries (e.g., "Analyze revenue trends") → hybrid (~300-500ms)
 *
 * @param complexity - Query complexity level from classifyComplexity()
 * @returns SearchMethod to use for this query
 */
function getSearchMethodForComplexity(complexity: ComplexityLevel): SearchMethod {
  switch (complexity) {
    case 'simple':
      return 'vector'
    case 'medium':
    case 'complex':
    default:
      return 'hybrid'
  }
}

// =============================================================================
// Retrieval Node
// =============================================================================

/**
 * Retrieval Node - searches Graphiti knowledge graph for deal-specific context.
 *
 * Story: 3-1 Implement Retrieval Node with Graphiti Integration (AC: #1-#5)
 *
 * @param state - Current agent state with messages and dealContext
 * @returns Partial state update with sources array
 *
 * @example
 * ```typescript
 * const graphBuilder = new StateGraph(AgentState)
 *   .addNode('retrieval', retrievalNode)
 * ```
 */
export async function retrievalNode(
  state: AgentStateType
): Promise<Partial<AgentStateType>> {
  // 1. Extract query from last user message
  const lastMessage = state.messages.at(-1)
  const query =
    typeof lastMessage?.content === 'string' ? lastMessage.content : ''

  if (!query) {
    console.log('[retrieval] No query in messages, skipping')
    return { sources: [] }
  }

  // 2. Get dealId from context (populated by createInitialState in API route)
  const dealId = state.dealContext?.dealId
  if (!dealId) {
    console.warn('[retrieval] No dealId in state.dealContext, skipping retrieval')
    return { sources: [] }
  }

  // 3. Classify query complexity and select search method (AC: #2)
  const { complexity, confidence: complexityConfidence } = classifyComplexity(query)
  const searchMethod = getSearchMethodForComplexity(complexity)

  // 4. Call Graphiti with selected search method
  const startTime = performance.now()
  let result: HybridSearchResponse | null = null

  try {
    result = await callGraphitiSearch(query, dealId, searchMethod)
  } catch (error) {
    console.error('[retrieval] Graphiti search failed:', error)
    return { sources: [] }
  }

  const latencyMs = Math.round(performance.now() - startTime)

  // 5. Log with complexity, method, and latency warning (NFR3: < 500ms)
  const truncatedQuery = query.length > 50 ? `${query.slice(0, 50)}...` : query
  console.log(
    `[retrieval] query="${truncatedQuery}" dealId=${dealId} complexity=${complexity} method=${searchMethod} latency=${latencyMs}ms results=${result?.results?.length ?? 0}`
  )
  if (latencyMs > LATENCY_TARGET_MS) {
    console.warn(`[retrieval] Latency exceeded target: ${latencyMs}ms > ${LATENCY_TARGET_MS}ms`)
  }

  // 6. Transform to SourceCitation
  if (!result?.results?.length) {
    return { sources: [] }
  }

  const sources: SourceCitation[] = result.results.map((r, index) => ({
    documentId: r.citation?.id || `graphiti-${index}`,
    documentName: r.citation?.title || 'Unknown source',
    location: r.citation?.page ? { page: r.citation.page } : undefined,
    snippet: r.content,
    relevanceScore: r.score,
    retrievedAt: new Date().toISOString(),
  }))

  return { sources }
}

// Export helper for testing
export { getSearchMethodForComplexity }
