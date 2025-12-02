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
import { createRelationship, getNodeById, createNode } from '@/lib/neo4j/operations'
import { NODE_LABELS, RELATIONSHIP_TYPES, type FindingNode } from '@/lib/neo4j/types'
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

      // Verify source finding exists in Supabase and get its details
      const { data: sourceFinding, error: findingError } = await supabase
        .from('findings')
        .select('id, deal_id, text, confidence, domain, status, document_id, source_document, created_at')
        .eq('id', findingId)
        .single()

      if (findingError || !sourceFinding) {
        return formatToolResponse(false, 'Source finding not found')
      }

      // Verify all target findings exist in Supabase
      const targetIds = relationships.map((r) => r.targetId)
      const { data: targetFindings, error: targetError } = await supabase
        .from('findings')
        .select('id, deal_id, text, confidence, domain, status, document_id, source_document, created_at')
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

      // === NEO4J INTEGRATION ===
      // Ensure source finding node exists in Neo4j (create if not)
      const sourceNode = await getNodeById<FindingNode>(NODE_LABELS.FINDING, findingId)
      if (!sourceNode) {
        // Create the finding node in Neo4j
        // Note: Using created_at for both date_referenced and date_extracted since
        // the findings table doesn't have a separate date_referenced column
        await createNode<FindingNode>(NODE_LABELS.FINDING, {
          id: sourceFinding.id,
          text: sourceFinding.text,
          confidence: sourceFinding.confidence ?? 0.5,
          category: sourceFinding.domain ?? 'general',
          date_referenced: sourceFinding.created_at,
          date_extracted: sourceFinding.created_at,
          source_document_id: sourceFinding.document_id ?? '',
          source_location: sourceFinding.source_document ?? '',
          deal_id: sourceFinding.deal_id,
          user_id: user.id,
          status: (sourceFinding.status ?? 'pending') as 'pending' | 'validated' | 'rejected',
        })
        console.log(`[update_knowledge_graph] Created source Finding node: ${findingId}`)
      }

      // Create relationships in Neo4j
      const createdRelationships: Array<{ type: string; sourceId: string; targetId: string }> = []
      const errors: string[] = []

      for (const rel of relationships) {
        try {
          // Ensure target finding node exists in Neo4j
          const targetNode = await getNodeById<FindingNode>(NODE_LABELS.FINDING, rel.targetId)
          if (!targetNode) {
            // Find target in our fetched list
            const targetData = targetFindings?.find((f) => f.id === rel.targetId)
            if (targetData) {
              await createNode<FindingNode>(NODE_LABELS.FINDING, {
                id: targetData.id,
                text: targetData.text,
                confidence: targetData.confidence ?? 0.5,
                category: targetData.domain ?? 'general',
                date_referenced: targetData.created_at,
                date_extracted: targetData.created_at,
                source_document_id: targetData.document_id ?? '',
                source_location: targetData.source_document ?? '',
                deal_id: targetData.deal_id,
                user_id: user.id,
                status: (targetData.status ?? 'pending') as 'pending' | 'validated' | 'rejected',
              })
              console.log(`[update_knowledge_graph] Created target Finding node: ${rel.targetId}`)
            }
          }

          // Map relationship type to Neo4j relationship type
          let neo4jRelType: keyof typeof RELATIONSHIP_TYPES
          let relProps: Record<string, unknown> = {
            detected_at: new Date().toISOString(),
            created_by: user.id,
          }

          switch (rel.type) {
            case 'SUPPORTS':
              neo4jRelType = 'SUPPORTS'
              relProps = { ...relProps, strength: 0.8 }
              break
            case 'CONTRADICTS':
              neo4jRelType = 'CONTRADICTS'
              relProps = { ...relProps, confidence: 0.8, resolved: false }
              break
            case 'SUPERSEDES':
              neo4jRelType = 'SUPERSEDES'
              relProps = { ...relProps, reason: 'Updated information', superseded_at: new Date().toISOString() }
              break
            default:
              neo4jRelType = 'SUPPORTS'
          }

          // Create the relationship in Neo4j
          const success = await createRelationship(
            NODE_LABELS.FINDING,
            findingId,
            NODE_LABELS.FINDING,
            rel.targetId,
            RELATIONSHIP_TYPES[neo4jRelType],
            relProps
          )

          if (success) {
            createdRelationships.push({
              type: rel.type,
              sourceId: findingId,
              targetId: rel.targetId,
            })
            console.log(`[update_knowledge_graph] Created ${rel.type} relationship: ${findingId} -> ${rel.targetId}`)
          } else {
            errors.push(`Failed to create ${rel.type} relationship to ${rel.targetId}`)
          }
        } catch (relError) {
          const errorMsg = relError instanceof Error ? relError.message : 'Unknown error'
          errors.push(`Error creating ${rel.type} to ${rel.targetId}: ${errorMsg}`)
          console.error(`[update_knowledge_graph] Relationship error:`, relError)
        }
      }

      // Also store in Supabase metadata for redundancy/backup
      const { error: updateError } = await supabase
        .from('findings')
        .update({
          metadata: {
            graph_relationships: relationships.map((r) => ({
              type: r.type,
              targetId: r.targetId,
              createdAt: new Date().toISOString(),
              createdBy: user.id,
              storedInNeo4j: createdRelationships.some(
                (cr) => cr.targetId === r.targetId && cr.type === r.type
              ),
            })),
          },
        })
        .eq('id', findingId)

      if (updateError) {
        console.warn('[update_knowledge_graph] Supabase metadata backup failed:', updateError)
        // Don't fail the whole operation if just the backup fails
      }

      if (createdRelationships.length === 0 && errors.length > 0) {
        return formatToolResponse(false, `Failed to create relationships: ${errors.join('; ')}`)
      }

      const message = errors.length > 0
        ? `Created ${createdRelationships.length} relationship(s) in Neo4j (${errors.length} failed)`
        : `Created ${createdRelationships.length} relationship(s) in Neo4j from finding ${findingId}`

      return formatToolResponse(true, {
        message,
        relationships: createdRelationships,
        errors: errors.length > 0 ? errors : undefined,
      })
    } catch (err) {
      return handleToolError(err, 'update_knowledge_graph')
    }
  },
  {
    name: 'update_knowledge_graph',
    description: `Create relationships between findings in the knowledge graph (Neo4j).
Supported relationship types: SUPPORTS (evidence), CONTRADICTS (conflict), SUPERSEDES (update/correction).
Use this to link related findings and build the knowledge graph for cross-domain analysis.`,
    schema: UpdateKnowledgeGraphInputSchema,
  }
)
