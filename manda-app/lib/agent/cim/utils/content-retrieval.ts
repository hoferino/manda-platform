/**
 * Hybrid Content Retrieval Pipeline
 *
 * Story: E9.7 - Slide Content Creation (RAG-powered)
 * Updated: E10.8 - PostgreSQL Cleanup (switched to Graphiti hybrid search)
 *
 * Uses Graphiti hybrid search (vector + BM25 + graph) with Voyage reranking
 * for comprehensive content retrieval in CIM Builder.
 *
 * Priority Order:
 * 1. Q&A Answers (from Supabase text search + Graphiti qa_response channel)
 * 2. Facts (from Graphiti fact edges - validated findings)
 * 3. Episodes (from Graphiti EpisodicNodes - document chunks)
 *
 * Features:
 * - Graphiti hybrid search with Voyage reranking (20-35% accuracy improvement)
 * - Temporal filtering via Graphiti's invalid_at (SUPERSEDES awareness)
 * - Source citations from Graphiti episode metadata
 * - Neo4j relationship enrichment (via Graphiti graph traversal)
 * - Priority-based merging and ranking
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { getRelatedNodes } from '@/lib/neo4j/operations'
import { NODE_LABELS, RELATIONSHIP_TYPES, FindingNode } from '@/lib/neo4j/types'

// E10.8: Graphiti hybrid search endpoint configuration
const PROCESSING_API_URL = process.env.PROCESSING_API_URL || 'http://localhost:8000'
const PROCESSING_API_KEY = process.env.PROCESSING_API_KEY || ''

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

// ============================================================================
// Types
// ============================================================================

export interface QAResult {
  id: string
  question: string
  answer: string
  category: string
  dateAnswered: string
  sourceType: 'qa'
}

export interface FindingResult {
  id: string
  text: string
  sourceDocument: string
  pageNumber?: number
  confidence: number
  domain?: string
  sourceType: 'finding'
}

export interface DocumentChunkResult {
  id: string
  content: string
  documentId: string
  documentName?: string
  pageNumber?: number
  chunkType: string
  sourceType: 'document'
}

export interface RelationshipInfo {
  supports: FindingResult[]
  contradicts: FindingResult[]
  supersedes: FindingResult[]
}

export interface RankedContentItem {
  id: string
  content: string
  sourceType: 'qa' | 'finding' | 'document'
  citation: string
  priority: number // Lower is higher priority
  confidence?: number
  hasContradiction?: boolean
  contradictionInfo?: string
  relationships?: RelationshipInfo
}

export interface ContentRetrievalResult {
  items: RankedContentItem[]
  totalQA: number
  totalFindings: number
  totalChunks: number
  contradictionWarnings: string[]
}

// ============================================================================
// Q&A Search (Priority 1 - Most Recent Data)
// ============================================================================

/**
 * Search Q&A items by text matching on question and answer fields
 * Only returns answered Q&As (date_answered IS NOT NULL)
 *
 * @param supabase - Supabase client
 * @param dealId - Deal UUID to filter by
 * @param query - Search query text
 * @param limit - Maximum results to return
 */
export async function searchQAItems(
  supabase: SupabaseClient<Database>,
  dealId: string,
  query: string,
  limit: number = 10
): Promise<QAResult[]> {
  try {
    // Text search on question and answer fields
    const { data, error } = await supabase
      .from('qa_items')
      .select('id, question, answer, category, date_answered')
      .eq('deal_id', dealId)
      .not('date_answered', 'is', null) // Only answered Q&As
      .not('answer', 'is', null)
      .or(`question.ilike.%${query}%,answer.ilike.%${query}%`)
      .order('date_answered', { ascending: false })
      .limit(limit)

    if (error) {
      console.warn('[searchQAItems] Error:', error)
      return []
    }

    return (data || []).map((item) => ({
      id: item.id,
      question: item.question,
      answer: item.answer || '',
      category: item.category,
      dateAnswered: item.date_answered || '',
      sourceType: 'qa' as const,
    }))
  } catch (err) {
    console.error('[searchQAItems] Exception:', err)
    return []
  }
}

// ============================================================================
// Graphiti Hybrid Search (E10.8 - replaces pgvector search)
// ============================================================================

/**
 * Search Graphiti for findings (facts) and document content
 * E10.8: Replaces searchFindings and searchDocumentChunks with unified Graphiti search
 *
 * @param dealId - Deal UUID to filter by (Graphiti namespace)
 * @param query - Search query text
 * @param limit - Maximum results to return
 */
export async function searchGraphiti(
  dealId: string,
  query: string,
  limit: number = 20
): Promise<{ findings: FindingResult[]; chunks: DocumentChunkResult[] }> {
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
        num_results: limit,
      }),
    })

    if (!response.ok) {
      console.warn('[searchGraphiti] Error:', response.status)
      return { findings: [], chunks: [] }
    }

    const data: GraphitiSearchResponse = await response.json()

    // Separate results into findings (facts) and chunks (episodes)
    const findings: FindingResult[] = []
    const chunks: DocumentChunkResult[] = []

    for (const result of data.results) {
      if (result.source_type === 'fact') {
        // Fact edges are validated findings
        findings.push({
          id: result.id,
          text: result.content,
          sourceDocument: result.citation?.title || 'Unknown source',
          pageNumber: result.citation?.page,
          confidence: result.confidence,
          domain: undefined, // Graphiti doesn't use domains
          sourceType: 'finding' as const,
        })
      } else if (result.source_type === 'episode') {
        // Episodes are document chunks
        chunks.push({
          id: result.id,
          content: result.content,
          documentId: result.citation?.id || '',
          documentName: result.citation?.title,
          pageNumber: result.citation?.page,
          chunkType: 'text', // Default, Graphiti tracks this internally
          sourceType: 'document' as const,
        })
      }
      // Entity nodes are skipped for content retrieval (they're for entity resolution)
    }

    return { findings, chunks }
  } catch (err) {
    console.error('[searchGraphiti] Exception:', err)
    return { findings: [], chunks: [] }
  }
}

/**
 * @deprecated E10.8 - Use searchGraphiti instead
 * Legacy function signature for backwards compatibility
 */
export async function searchFindings(
  supabase: SupabaseClient<Database>,
  dealId: string,
  query: string,
  threshold: number = 0.3,
  limit: number = 10
): Promise<FindingResult[]> {
  const { findings } = await searchGraphiti(dealId, query, limit)
  return findings
}

/**
 * @deprecated E10.8 - Use searchGraphiti instead
 * Legacy function signature for backwards compatibility
 */
export async function searchDocumentChunks(
  supabase: SupabaseClient<Database>,
  dealId: string,
  query: string,
  threshold: number = 0.3,
  limit: number = 10
): Promise<DocumentChunkResult[]> {
  const { chunks } = await searchGraphiti(dealId, query, limit)
  return chunks
}

// ============================================================================
// Neo4j Relationship Enrichment
// ============================================================================

/**
 * Enrich findings with Neo4j relationship data (SUPPORTS, CONTRADICTS, SUPERSEDES)
 *
 * @param findingIds - Array of finding UUIDs to enrich
 */
export async function enrichWithRelationships(
  findingIds: string[]
): Promise<Map<string, RelationshipInfo>> {
  const relationshipMap = new Map<string, RelationshipInfo>()

  if (findingIds.length === 0) {
    return relationshipMap
  }

  try {
    // Process each finding to get its relationships
    for (const findingId of findingIds) {
      const info: RelationshipInfo = {
        supports: [],
        contradicts: [],
        supersedes: [],
      }

      // Get SUPPORTS relationships (outgoing)
      try {
        const supports = await getRelatedNodes<FindingNode>(
          NODE_LABELS.FINDING,
          findingId,
          RELATIONSHIP_TYPES.SUPPORTS,
          NODE_LABELS.FINDING,
          'outgoing'
        )
        info.supports = supports.map(f => ({
          id: f.id,
          text: f.text,
          sourceDocument: f.source_location || '',
          confidence: f.confidence,
          sourceType: 'finding' as const,
        }))
      } catch (e) {
        // Neo4j may not be available, continue without relationships
      }

      // Get CONTRADICTS relationships (both directions)
      try {
        const contradicts = await getRelatedNodes<FindingNode>(
          NODE_LABELS.FINDING,
          findingId,
          RELATIONSHIP_TYPES.CONTRADICTS,
          NODE_LABELS.FINDING,
          'both'
        )
        info.contradicts = contradicts.map(f => ({
          id: f.id,
          text: f.text,
          sourceDocument: f.source_location || '',
          confidence: f.confidence,
          sourceType: 'finding' as const,
        }))
      } catch (e) {
        // Neo4j may not be available
      }

      // Get SUPERSEDES relationships (outgoing - what this finding supersedes)
      try {
        const supersedes = await getRelatedNodes<FindingNode>(
          NODE_LABELS.FINDING,
          findingId,
          RELATIONSHIP_TYPES.SUPERSEDES,
          NODE_LABELS.FINDING,
          'outgoing'
        )
        info.supersedes = supersedes.map(f => ({
          id: f.id,
          text: f.text,
          sourceDocument: f.source_location || '',
          confidence: f.confidence,
          sourceType: 'finding' as const,
        }))
      } catch (e) {
        // Neo4j may not be available
      }

      relationshipMap.set(findingId, info)
    }
  } catch (err) {
    console.warn('[enrichWithRelationships] Neo4j enrichment failed:', err)
  }

  return relationshipMap
}

// ============================================================================
// Merge and Rank Results
// ============================================================================

/**
 * Merge and rank content from all sources
 * Priority: Q&A (1) > Findings (2) > Document Chunks (3)
 * Boost findings with SUPPORTS relationships
 * Flag findings with unresolved CONTRADICTS
 *
 * @param qa - Q&A search results
 * @param findings - Findings search results
 * @param chunks - Document chunk search results
 * @param relationships - Neo4j relationship map for findings
 */
export function mergeAndRankResults(
  qa: QAResult[],
  findings: FindingResult[],
  chunks: DocumentChunkResult[],
  relationships: Map<string, RelationshipInfo>
): RankedContentItem[] {
  const results: RankedContentItem[] = []

  // Priority 1: Q&A Items (most recent data)
  for (const item of qa) {
    results.push({
      id: item.id,
      content: item.answer,
      sourceType: 'qa',
      citation: `(qa: "${item.question.slice(0, 50)}${item.question.length > 50 ? '...' : ''}")`,
      priority: 1,
    })
  }

  // Priority 2: Findings (validated facts)
  for (const item of findings) {
    const rels = relationships.get(item.id)
    const hasSupports = rels && rels.supports.length > 0
    const hasContradiction = rels && rels.contradicts.length > 0

    // Boost priority if has supporting evidence
    const priority = hasSupports ? 1.5 : 2

    results.push({
      id: item.id,
      content: item.text,
      sourceType: 'finding',
      citation: `(finding: "${item.text.slice(0, 50)}${item.text.length > 50 ? '...' : ''}")`,
      priority,
      confidence: item.confidence,
      hasContradiction,
      contradictionInfo: hasContradiction
        ? `Conflicts with: ${rels!.contradicts.map(c => c.text.slice(0, 30)).join('; ')}`
        : undefined,
      relationships: rels,
    })
  }

  // Priority 3: Document Chunks (raw content)
  for (const item of chunks) {
    const pagePart = item.pageNumber ? `, page ${item.pageNumber}` : ''
    results.push({
      id: item.id,
      content: item.content,
      sourceType: 'document',
      citation: `(source: ${item.documentName || 'document'}${pagePart})`,
      priority: 3,
    })
  }

  // Sort by priority (lower is better), then by confidence for findings
  results.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority
    }
    // For same priority, sort by confidence if available
    const aConf = a.confidence ?? 0.5
    const bConf = b.confidence ?? 0.5
    return bConf - aConf
  })

  return results
}

// ============================================================================
// Main Retrieval Function
// ============================================================================

/**
 * Perform hybrid content retrieval for slide content generation
 *
 * @param supabase - Supabase client
 * @param dealId - Deal UUID
 * @param query - Search query/topic
 * @param options - Search options
 */
export async function retrieveContentForSlide(
  supabase: SupabaseClient<Database>,
  dealId: string,
  query: string,
  options: {
    qaLimit?: number
    findingsLimit?: number
    chunksLimit?: number
    confidenceThreshold?: number
    includeNeo4jEnrichment?: boolean
  } = {}
): Promise<ContentRetrievalResult> {
  const {
    qaLimit = 5,
    findingsLimit = 10,
    chunksLimit = 5,
    confidenceThreshold = 0.3,
    includeNeo4jEnrichment = true,
  } = options

  // Execute searches in parallel
  const [qaResults, findingsResults, chunksResults] = await Promise.all([
    searchQAItems(supabase, dealId, query, qaLimit),
    searchFindings(supabase, dealId, query, confidenceThreshold, findingsLimit),
    searchDocumentChunks(supabase, dealId, query, confidenceThreshold, chunksLimit),
  ])

  // Enrich findings with Neo4j relationships if enabled
  let relationships = new Map<string, RelationshipInfo>()
  if (includeNeo4jEnrichment && findingsResults.length > 0) {
    const findingIds = findingsResults.map(f => f.id)
    relationships = await enrichWithRelationships(findingIds)
  }

  // Merge and rank results
  const rankedItems = mergeAndRankResults(
    qaResults,
    findingsResults,
    chunksResults,
    relationships
  )

  // Collect contradiction warnings
  const contradictionWarnings: string[] = []
  for (const item of rankedItems) {
    if (item.hasContradiction && item.contradictionInfo) {
      contradictionWarnings.push(
        `⚠️ "${item.content.slice(0, 50)}..." ${item.contradictionInfo}`
      )
    }
  }

  return {
    items: rankedItems,
    totalQA: qaResults.length,
    totalFindings: findingsResults.length,
    totalChunks: chunksResults.length,
    contradictionWarnings,
  }
}

/**
 * Format source citation for display
 * Creates properly formatted citation strings based on source type
 */
export function formatSourceCitation(item: RankedContentItem): string {
  return item.citation
}

/**
 * Get contradiction warnings for a set of content items
 */
export function getContradictionWarnings(items: RankedContentItem[]): string[] {
  return items
    .filter(item => item.hasContradiction)
    .map(item => item.contradictionInfo || '')
    .filter(Boolean)
}
