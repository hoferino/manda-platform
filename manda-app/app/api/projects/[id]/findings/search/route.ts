/**
 * Findings Search API Route
 * Performs semantic search on findings using pgvector similarity
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #2, #3, #7, #8)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { generateEmbedding } from '@/lib/services/embeddings'
import type { Finding, FindingDomain, FindingStatus, ValidationEvent } from '@/lib/types/findings'

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
  cached?: boolean
}

/**
 * POST /api/projects/[id]/findings/search
 * Perform semantic search on findings
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

    const { query, limit, filters } = parseResult.data

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

    // Generate embedding for the search query
    let queryEmbedding: number[]
    try {
      queryEmbedding = await generateEmbedding(query)
    } catch (embeddingError) {
      console.error('[api/findings/search] Embedding generation error:', embeddingError)
      return NextResponse.json(
        { error: 'Failed to process search query. Please try again.' },
        { status: 503 }
      )
    }

    // Check if we're approaching timeout
    const elapsedMs = Date.now() - startTime
    if (elapsedMs > SEARCH_TIMEOUT_MS - 500) {
      return NextResponse.json(
        { error: 'Search timeout. Please try a shorter query.' },
        { status: 504 }
      )
    }

    // Call the similarity search RPC function
    // This function should be created in Supabase: match_findings
    // Type assertion needed until migration is applied and types regenerated
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: searchResults, error: searchError } = await (supabase.rpc as any)('match_findings', {
      query_embedding: queryEmbedding,
      match_threshold: 0.0, // Return all results, let similarity ordering handle relevance
      match_count: limit,
      p_deal_id: projectId,
      p_document_id: filters?.documentId || null,
      p_domains: filters?.domain || null,
      p_statuses: filters?.status || null,
      p_confidence_min: filters?.confidenceMin ?? null,
      p_confidence_max: filters?.confidenceMax ?? null,
    })

    if (searchError) {
      console.error('[api/findings/search] Search error:', searchError)

      // If the RPC doesn't exist, return a helpful error
      if (searchError.message.includes('function') && searchError.message.includes('does not exist')) {
        return NextResponse.json(
          { error: 'Semantic search is not yet configured. Database function pending migration.' },
          { status: 503 }
        )
      }

      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    // Transform results to API response format
    const findings: FindingWithSimilarity[] = (searchResults || []).map(
      (row: {
        id: string
        deal_id: string
        document_id: string | null
        chunk_id: string | null
        user_id: string
        text: string
        source_document: string | null
        page_number: number | null
        confidence: number | null
        finding_type: Finding['findingType']
        domain: FindingDomain | null
        status: FindingStatus | null
        validation_history: ValidationEvent[] | null
        metadata: Record<string, unknown> | null
        created_at: string
        updated_at: string | null
        similarity: number
      }) => ({
        id: row.id,
        dealId: row.deal_id,
        documentId: row.document_id,
        chunkId: row.chunk_id,
        userId: row.user_id,
        text: row.text,
        sourceDocument: row.source_document,
        pageNumber: row.page_number,
        confidence: row.confidence,
        findingType: row.finding_type,
        domain: row.domain,
        status: row.status || 'pending',
        validationHistory: row.validation_history || [],
        metadata: row.metadata,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        similarity: row.similarity,
      })
    )

    const searchTime = Date.now() - startTime

    return NextResponse.json({
      findings,
      total: findings.length,
      searchTime,
      query,
    } satisfies SearchResponse)
  } catch (err) {
    console.error('[api/findings/search] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
