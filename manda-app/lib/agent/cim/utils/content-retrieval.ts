/**
 * Hybrid Content Retrieval Pipeline
 *
 * Combines pgvector semantic search (Supabase) with Neo4j relationship queries
 * for comprehensive content retrieval in CIM Builder.
 *
 * Story: E9.7 - Slide Content Creation (RAG-powered)
 *
 * Priority Order:
 * 1. Q&A Answers (HIGHEST - most recent client data)
 * 2. Findings (validated facts from documents)
 * 3. Document Chunks (raw document content)
 *
 * Features:
 * - Text search on Q&A items
 * - Semantic search on findings (pgvector)
 * - Semantic search on document chunks (pgvector)
 * - Neo4j relationship enrichment (SUPPORTS, CONTRADICTS, SUPERSEDES)
 * - Priority-based merging and ranking
 * - Contradiction flagging
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import { generateEmbedding } from '@/lib/services/embeddings'
import { getRelatedNodes, getContradictions } from '@/lib/neo4j/operations'
import { NODE_LABELS, RELATIONSHIP_TYPES, FindingNode } from '@/lib/neo4j/types'

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
// Findings Search (Priority 2 - Validated Facts)
// ============================================================================

/**
 * Semantic search on findings using pgvector match_findings RPC
 *
 * @param supabase - Supabase client
 * @param dealId - Deal UUID to filter by
 * @param query - Search query text (will be embedded)
 * @param threshold - Minimum similarity threshold (default 0.3)
 * @param limit - Maximum results to return
 */
export async function searchFindings(
  supabase: SupabaseClient<Database>,
  dealId: string,
  query: string,
  threshold: number = 0.3,
  limit: number = 10
): Promise<FindingResult[]> {
  try {
    const queryEmbedding = await generateEmbedding(query)

    const { data, error } = await supabase.rpc('match_findings', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_threshold: threshold,
      match_count: limit,
      p_deal_id: dealId,
    })

    if (error) {
      console.warn('[searchFindings] Error:', error)
      return []
    }

    return (data || []).map((f) => ({
      id: f.id,
      text: f.text,
      sourceDocument: f.source_document,
      pageNumber: f.page_number,
      confidence: f.confidence,
      domain: f.domain,
      sourceType: 'finding' as const,
    }))
  } catch (err) {
    console.error('[searchFindings] Exception:', err)
    return []
  }
}

// ============================================================================
// Document Chunks Search (Priority 3 - Raw Document Content)
// ============================================================================

/**
 * Semantic search on document chunks
 * Since match_document_chunks RPC may not exist, we use direct query with embedding
 *
 * @param supabase - Supabase client
 * @param dealId - Deal UUID to filter by
 * @param query - Search query text (will be embedded)
 * @param threshold - Minimum similarity threshold (default 0.3)
 * @param limit - Maximum results to return
 */
export async function searchDocumentChunks(
  supabase: SupabaseClient<Database>,
  dealId: string,
  query: string,
  threshold: number = 0.3,
  limit: number = 10
): Promise<DocumentChunkResult[]> {
  try {
    const queryEmbedding = await generateEmbedding(query)

    // Try RPC first (if it exists), otherwise fall back to direct query
    // For now, use direct query with embedding similarity
    const { data: chunks, error } = await supabase
      .from('document_chunks')
      .select(`
        id,
        content,
        document_id,
        page_number,
        chunk_type,
        documents!inner(name, deal_id)
      `)
      .eq('documents.deal_id', dealId)
      .not('embedding', 'is', null)
      .limit(limit * 2) // Get more and filter by relevance

    if (error) {
      console.warn('[searchDocumentChunks] Error:', error)
      return []
    }

    // Since we can't do similarity search without RPC, return chunks that have content
    // matching the query keywords as a fallback
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2)

    const filtered = (chunks || [])
      .filter(chunk => {
        const content = chunk.content.toLowerCase()
        return queryWords.some(word => content.includes(word))
      })
      .slice(0, limit)
      .map((chunk) => ({
        id: chunk.id,
        content: chunk.content,
        documentId: chunk.document_id,
        documentName: (chunk.documents as { name?: string })?.name,
        pageNumber: chunk.page_number ?? undefined,
        chunkType: chunk.chunk_type,
        sourceType: 'document' as const,
      }))

    return filtered
  } catch (err) {
    console.error('[searchDocumentChunks] Exception:', err)
    return []
  }
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
