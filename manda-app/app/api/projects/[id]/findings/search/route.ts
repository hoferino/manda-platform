/**
 * Findings Search API Route
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #2, #3, #7, #8)
 * Updated: E10.8 - PostgreSQL Cleanup (switched to Graphiti hybrid search)
 *
 * Uses Graphiti hybrid search (vector + BM25 + graph) with Voyage reranking
 * instead of pgvector match_findings RPC.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import type { Finding, FindingDomain, FindingStatus, ValidationEvent } from '@/lib/types/findings'

// E10.8: Graphiti hybrid search endpoint configuration
const PROCESSING_API_URL = process.env.PROCESSING_API_URL || 'http://localhost:8000'
const PROCESSING_API_KEY = process.env.PROCESSING_API_KEY || ''

// Request body validation schema
const SearchRequestSchema = z.object({
  query: z.string().min(1, 'Search query is required').max(1000, 'Query too long'),
  limit: z.number().int().min(1).max(100).optional().default(20),
  filters: z
    .object({
      documentId: z.string().uuid().optional(),
      domain: z.array(z.enum(['financial', 'operational', 'market', 'legal', 'technical'])).optional(),
      status: z.array(z.enum(['pending', 'validated', 'rejected'])).optional(),
      confidenceMin: z.number().min(0).max(1).optional(),
      confidenceMax: z.number().min(0).max(1).optional(),
    })
    .optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// Search timeout in milliseconds (3 seconds as per AC#7)
const SEARCH_TIMEOUT_MS = 3000

/**
 * FindingWithSimilarity type for search results
 */
export interface FindingWithSimilarity extends Finding {
  similarity: number
}

/**
 * Search response type
 */
export interface SearchResponse {
  findings: FindingWithSimilarity[]
  total: number
  searchTime: number
  query: string
  latencyMs?: number  // E10.8: Graphiti latency
  entities?: string[] // E10.8: Extracted entities
}

/**
 * Graphiti hybrid search response (E10.7)
 */
interface GraphitiSearchResult {
  id: string
  content: string
  score: number
  source_type: 'episode' | 'entity' | 'fact'
  source_channel: string
  confidence: number
  citation: {
    type: 'document' | 'qa' | 'chat'
    id: string
    title: string
    excerpt?: string
    page?: number
    chunk_index?: number
    confidence: number
  } | null
}

interface GraphitiSearchResponse {
  query: string
  results: GraphitiSearchResult[]
  sources: Array<{
    type: 'document' | 'qa' | 'chat'
    id: string
    title: string
    excerpt?: string
    page?: number
    chunk_index?: number
    confidence: number
  }>
  entities: string[]
  latency_ms: number
  result_count: number
}

/**
 * POST /api/projects/[id]/findings/search
 * Perform semantic search on findings using Graphiti hybrid search
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const startTime = Date.now()

  try {
    const { id: projectId } = await context.params

    // Parse and validate request body
    const body = await request.json()
    const parseResult = SearchRequestSchema.safeParse(body)

    if (!parseResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parseResult.error.flatten() },
        { status: 400 }
      )
    }

    const { query, limit } = parseResult.data

    const supabase = await createClient()

    // Authenticate user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Verify user has access to this project
    const { data: project, error: projectError } = await supabase
      .from('deals')
      .select('id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // E10.8: Call Graphiti hybrid search endpoint
    let graphitiResponse: GraphitiSearchResponse
    try {
      const response = await fetch(`${PROCESSING_API_URL}/api/search/hybrid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': PROCESSING_API_KEY,
        },
        body: JSON.stringify({
          query,
          deal_id: projectId,
          num_results: limit,
        }),
        signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[api/findings/search] Graphiti search error:', response.status, errorText)
        return NextResponse.json(
          { error: 'Search service unavailable' },
          { status: 503 }
        )
      }

      graphitiResponse = await response.json()
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.name === 'TimeoutError') {
        return NextResponse.json(
          { error: 'Search timeout. Please try a shorter query.' },
          { status: 504 }
        )
      }
      console.error('[api/findings/search] Fetch error:', fetchError)
      return NextResponse.json(
        { error: 'Failed to connect to search service' },
        { status: 503 }
      )
    }

    // E10.8: Transform Graphiti results to FindingWithSimilarity format
    const findings: FindingWithSimilarity[] = graphitiResponse.results.map((result) => ({
      id: result.id,
      dealId: projectId,
      documentId: result.citation?.id || null,
      chunkId: null,
      userId: user.id,
      text: result.content,
      sourceDocument: result.citation?.title || null,
      pageNumber: result.citation?.page || null,
      confidence: result.confidence,
      findingType: null,
      domain: null as FindingDomain | null,
      status: 'validated' as FindingStatus, // Graphiti facts are validated
      validationHistory: [] as ValidationEvent[],
      metadata: {
        source_type: result.source_type,
        source_channel: result.source_channel,
      },
      createdAt: new Date().toISOString(), // Graphiti doesn't return created_at
      updatedAt: null,
      similarity: result.score,
    }))

    const searchTime = Date.now() - startTime

    return NextResponse.json({
      findings,
      total: findings.length,
      searchTime,
      query,
      latencyMs: graphitiResponse.latency_ms,
      entities: graphitiResponse.entities,
    } satisfies SearchResponse)
  } catch (err) {
    console.error('[api/findings/search] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
