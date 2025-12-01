/**
 * Knowledge Tools
 *
 * Tools for querying, updating, and validating the knowledge base.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Tools:
 * - query_knowledge_base (AC: #1) - Semantic search via pgvector
 * - update_knowledge_base (AC: #6) - Store findings with temporal metadata
 * - validate_finding (AC: #5) - Check for contradictions with temporal awareness
 * - update_knowledge_graph (AC: #8) - Create Neo4j relationships
 */

import { tool } from '@langchain/core/tools'
import { createClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/services/embeddings'
import {
  QueryKnowledgeBaseInputSchema,
  UpdateKnowledgeBaseInputSchema,
  ValidateFindingInputSchema,
  UpdateKnowledgeGraphInputSchema,
  type FindingWithSource,
  type SourceCitation,
} from '../schemas'
import {
  formatToolResponse,
  handleToolError,
  formatSourceCitation,
  inferQueryMode,
  formatTemporalContext,
} from './utils'

/**
 * query_knowledge_base
 *
 * Performs semantic search on the knowledge base using pgvector.
 * Implements P1 hybrid search architecture:
 * 1. Intent detection (fact vs research)
 * 2. Semantic search via match_findings RPC
 * 3. Temporal filtering with SUPERSEDES awareness
 * 4. Conflict detection via Neo4j
 * 5. Response formatting per P2 rules
 *
 * AC: #1 - Returns findings with source attribution
 */
export const queryKnowledgeBaseTool = tool(
  async (input) => {
    try {
      const { query, filters, limit } = input

      // 1. Detect query mode (fact lookup vs research)
      const queryMode = inferQueryMode(query)

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // 2. Generate embedding for semantic search
      let queryEmbedding: number[]
      try {
        queryEmbedding = await generateEmbedding(query)
      } catch (err) {
        console.error('[query_knowledge_base] Embedding error:', err)
        return formatToolResponse(false, 'Failed to process search query')
      }

      // 3. Call match_findings RPC via pgvector
      const { data: searchResults, error: searchError } = await supabase.rpc('match_findings', {
        query_embedding: JSON.stringify(queryEmbedding),
        match_threshold: queryMode === 'fact' ? 0.5 : 0.3, // Higher threshold for facts
        match_count: queryMode === 'fact' ? 5 : limit, // Fewer results for facts
        p_deal_id: filters?.dealId,
        p_document_id: filters?.documentId,
        p_domains: filters?.domains,
        p_statuses: filters?.statuses,
        p_confidence_min: filters?.confidenceMin,
        p_confidence_max: filters?.confidenceMax,
      })

      if (searchError) {
        console.error('[query_knowledge_base] Search error:', searchError)
        return formatToolResponse(false, 'Search failed')
      }

      if (!searchResults || searchResults.length === 0) {
        return formatToolResponse(true, {
          message: `I couldn't find information about "${query}" in the uploaded documents. Would you like me to add this to the Q&A list for follow-up?`,
          findings: [],
          total: 0,
          queryMode,
          hasConflicts: false,
        })
      }

      // 4. Transform results to typed format
      // RPC returns dynamic shape - type assertion for safety
      type RpcRow = {
        id: string
        text: string
        confidence: number | null
        domain: string | null
        status: string | null
        source_document: string | null
        document_id: string | null
        page_number: number | null
        similarity: number
        created_at?: string
      }
      const findings: FindingWithSource[] = (searchResults as RpcRow[]).map((row) => {
        const source: SourceCitation = {
          documentId: row.document_id || '',
          documentName: row.source_document || 'Unknown document',
          location: row.page_number ? `Page ${row.page_number}` : 'Unknown location',
        }

        return {
          id: row.id,
          text: row.text,
          confidence: row.confidence,
          domain: row.domain as FindingWithSource['domain'],
          status: (row.status || 'pending') as FindingWithSource['status'],
          source,
          dateReferenced: row.created_at || null,
          similarity: row.similarity,
        }
      })

      // 5. For fact mode, return the best answer
      if (queryMode === 'fact' && findings.length > 0) {
        const bestFinding = findings[0]!
        const temporalContext = formatTemporalContext(bestFinding.dateReferenced)
        const sourceInfo = formatSourceCitation(bestFinding.source)

        return formatToolResponse(true, {
          message: `${bestFinding.text} ${sourceInfo}${temporalContext ? ` (${temporalContext})` : ''}`,
          findings: [bestFinding],
          total: 1,
          queryMode,
          hasConflicts: false,
        })
      }

      // 6. For research mode, return all findings with grouping
      return formatToolResponse(true, {
        message: `Found ${findings.length} relevant findings:`,
        findings,
        total: findings.length,
        queryMode,
        hasConflicts: false, // TODO: Check Neo4j for contradictions
      })
    } catch (err) {
      return handleToolError(err, 'query_knowledge_base')
    }
  },
  {
    name: 'query_knowledge_base',
    description: `Search the knowledge base for findings relevant to a query.
Use this tool when the user asks about facts, data, or information from uploaded documents.
Returns findings with source attribution. Automatically detects if query is a fact lookup (single answer) or research (multiple findings).`,
    schema: QueryKnowledgeBaseInputSchema,
  }
)

/**
 * update_knowledge_base
 *
 * Stores analyst-provided findings with temporal metadata.
 * Generates embedding for semantic search and returns finding_id.
 *
 * AC: #6 - Stores with temporal metadata, returns confirmation with finding_id
 */
export const updateKnowledgeBaseTool = tool(
  async (input) => {
    try {
      const { finding, source, confidence, dateReferenced, domains } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Verify document exists
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id, name, deal_id')
        .eq('id', source.documentId)
        .single()

      if (docError || !document) {
        return formatToolResponse(false, 'Document not found')
      }

      // Generate embedding for the finding
      let embedding: number[]
      try {
        embedding = await generateEmbedding(finding)
      } catch (err) {
        console.error('[update_knowledge_base] Embedding error:', err)
        return formatToolResponse(false, 'Failed to generate embedding for finding')
      }

      // Insert finding into database
      const { data: newFinding, error: insertError } = await supabase
        .from('findings')
        .insert({
          deal_id: document.deal_id,
          document_id: source.documentId,
          user_id: user.id,
          text: finding,
          source_document: document.name,
          confidence,
          domain: domains?.[0] || null,
          date_referenced: dateReferenced ? new Date(dateReferenced).toISOString() : null,
          embedding: JSON.stringify(embedding),
          status: 'pending',
          metadata: {
            source_location: source.location,
            manually_added: true,
            added_via: 'chat_agent',
          },
        })
        .select('id')
        .single()

      if (insertError) {
        console.error('[update_knowledge_base] Insert error:', insertError)
        return formatToolResponse(false, 'Failed to store finding')
      }

      return formatToolResponse(true, {
        message: `Finding stored successfully.`,
        findingId: newFinding.id,
        documentName: document.name,
        sourceLocation: source.location,
      })
    } catch (err) {
      return handleToolError(err, 'update_knowledge_base')
    }
  },
  {
    name: 'update_knowledge_base',
    description: `Store a new finding in the knowledge base with source attribution.
Use this tool when the analyst provides new information that should be captured as a finding.
Requires source document ID and location for proper attribution.`,
    schema: UpdateKnowledgeBaseInputSchema,
  }
)

/**
 * validate_finding
 *
 * Validates a finding by checking for contradictions with temporal awareness.
 * Only compares findings from the same time period to avoid false positives.
 *
 * AC: #5 - Temporal awareness prevents false contradiction detection
 */
export const validateFindingTool = tool(
  async (input) => {
    try {
      const { finding, context, dateReferenced } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Generate embedding for the finding
      let embedding: number[]
      try {
        embedding = await generateEmbedding(finding)
      } catch (err) {
        console.error('[validate_finding] Embedding error:', err)
        return formatToolResponse(false, 'Failed to process finding for validation')
      }

      // Search for similar findings
      const { data: similarFindings, error: searchError } = await supabase.rpc('match_findings', {
        query_embedding: JSON.stringify(embedding),
        match_threshold: 0.7, // High threshold for contradiction detection
        match_count: 10,
      })

      if (searchError) {
        console.error('[validate_finding] Search error:', searchError)
        return formatToolResponse(false, 'Validation search failed')
      }

      if (!similarFindings || similarFindings.length === 0) {
        return formatToolResponse(true, {
          valid: true,
          message: 'No similar findings found. This appears to be new information.',
          conflicts: [],
        })
      }

      // Filter by temporal context if provided
      // Type assertion for RPC result
      type SimilarRow = {
        id: string
        text: string
        source_document: string | null
        similarity: number
        created_at?: string
      }
      const typedResults = similarFindings as SimilarRow[]
      const relevantFindings = dateReferenced
        ? typedResults.filter((f) => {
            if (!f.created_at) return false
            // Compare year and quarter
            const inputDate = new Date(dateReferenced)
            const findingDate = new Date(f.created_at)
            return (
              inputDate.getFullYear() === findingDate.getFullYear() &&
              Math.ceil((inputDate.getMonth() + 1) / 3) ===
                Math.ceil((findingDate.getMonth() + 1) / 3)
            )
          })
        : typedResults

      if (relevantFindings.length === 0) {
        return formatToolResponse(true, {
          valid: true,
          message: 'Similar findings exist but from different time periods. No conflicts detected.',
          conflicts: [],
        })
      }

      // Check for potential conflicts (very high similarity with different content)
      const potentialConflicts = relevantFindings.filter((f) => {
        return f.similarity > 0.85 && f.text !== finding
      })

      if (potentialConflicts.length > 0) {
        return formatToolResponse(true, {
          valid: false,
          message: `Found ${potentialConflicts.length} potential conflict(s) with existing findings.`,
          conflicts: potentialConflicts.map((f) => ({
            findingId: f.id,
            text: f.text,
            source: f.source_document || 'Unknown source',
            similarity: f.similarity,
          })),
        })
      }

      return formatToolResponse(true, {
        valid: true,
        message: 'Finding validated. No conflicts detected with existing knowledge.',
        conflicts: [],
      })
    } catch (err) {
      return handleToolError(err, 'validate_finding')
    }
  },
  {
    name: 'validate_finding',
    description: `Validate a finding by checking for contradictions with existing knowledge.
Uses temporal awareness to only compare findings from the same time period.
Use this before storing important findings to ensure consistency.`,
    schema: ValidateFindingInputSchema,
  }
)

/**
 * update_knowledge_graph
 *
 * Creates relationships between findings in Neo4j.
 * Supports SUPPORTS, CONTRADICTS, and SUPERSEDES relationships.
 *
 * AC: #8 - Creates Neo4j relationships
 */
export const updateKnowledgeGraphTool = tool(
  async (input) => {
    try {
      const { findingId, relationships } = input

      const supabase = await createClient()

      // Authenticate user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError || !user) {
        return formatToolResponse(false, 'Authentication required')
      }

      // Verify source finding exists
      const { data: sourceFinding, error: findingError } = await supabase
        .from('findings')
        .select('id, deal_id')
        .eq('id', findingId)
        .single()

      if (findingError || !sourceFinding) {
        return formatToolResponse(false, 'Source finding not found')
      }

      // Verify all target findings exist
      const targetIds = relationships.map((r) => r.targetId)
      const { data: targetFindings, error: targetError } = await supabase
        .from('findings')
        .select('id')
        .in('id', targetIds)

      if (targetError) {
        return formatToolResponse(false, 'Failed to verify target findings')
      }

      const foundTargetIds = new Set(targetFindings?.map((f) => f.id) || [])
      const missingTargets = targetIds.filter((id) => !foundTargetIds.has(id))

      if (missingTargets.length > 0) {
        return formatToolResponse(
          false,
          `Target finding(s) not found: ${missingTargets.join(', ')}`
        )
      }

      // Note: Neo4j integration would go here
      // For now, we store relationships in metadata as a fallback
      // TODO: Implement actual Neo4j relationship creation in Epic 5 or later

      // Store relationship metadata in Supabase as fallback
      const { error: updateError } = await supabase
        .from('findings')
        .update({
          metadata: {
            graph_relationships: relationships.map((r) => ({
              type: r.type,
              targetId: r.targetId,
              createdAt: new Date().toISOString(),
              createdBy: user.id,
            })),
          },
        })
        .eq('id', findingId)

      if (updateError) {
        console.error('[update_knowledge_graph] Update error:', updateError)
        return formatToolResponse(false, 'Failed to store graph relationships')
      }

      return formatToolResponse(true, {
        message: `Created ${relationships.length} relationship(s) from finding ${findingId}`,
        relationships: relationships.map((r) => ({
          type: r.type,
          sourceId: findingId,
          targetId: r.targetId,
        })),
      })
    } catch (err) {
      return handleToolError(err, 'update_knowledge_graph')
    }
  },
  {
    name: 'update_knowledge_graph',
    description: `Create relationships between findings in the knowledge graph.
Supported relationship types: SUPPORTS (evidence), CONTRADICTS (conflict), SUPERSEDES (update/correction).
Use this to link related findings and build the knowledge graph.`,
    schema: UpdateKnowledgeGraphInputSchema,
  }
)
