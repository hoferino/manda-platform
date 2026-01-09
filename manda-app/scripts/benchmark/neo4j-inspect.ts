/**
 * Neo4j Inspection Utilities
 *
 * Helper functions for querying Neo4j knowledge graph during benchmark validation.
 * Story: E13 Retrospective - Phased Validation System
 */

import { executeRead } from '@/lib/neo4j/client'

/**
 * Entity counts by type for a deal
 */
export interface EntityCounts {
  companies: number
  people: number
  financialMetrics: number
  risks: number
  findings: number
  documents: number
  total: number
}

/**
 * Relationship counts for a deal
 */
export interface RelationshipCounts {
  extractedFrom: number
  supports: number
  contradicts: number
  supersedes: number
  basedOn: number
  total: number
}

/**
 * Graphiti entity summary
 */
export interface GraphitiEntity {
  uuid: string
  name: string
  entityType: string
  groupId: string
  createdAt: string
}

/**
 * Knowledge graph summary for a deal
 */
export interface KnowledgeGraphSummary {
  dealId: string
  groupId: string
  entityCounts: EntityCounts
  relationshipCounts: RelationshipCounts
  recentEntities: GraphitiEntity[]
  lastUpdated: string | null
}

/**
 * Get entity counts for a deal using Graphiti's group_id
 *
 * @param groupId - The deal's group_id (usually same as deal_id)
 */
export async function getEntityCounts(groupId: string): Promise<EntityCounts> {
  // Query Graphiti entities by group_id
  // Graphiti uses Entity nodes with entity_type property
  const result = await executeRead<{
    entityType: string
    count: number | { toNumber: () => number }
  }>(
    `
    MATCH (e:Entity)
    WHERE e.group_id = $groupId
    RETURN e.entity_type AS entityType, count(e) AS count
    `,
    { groupId }
  )

  const counts: EntityCounts = {
    companies: 0,
    people: 0,
    financialMetrics: 0,
    risks: 0,
    findings: 0,
    documents: 0,
    total: 0,
  }

  for (const row of result) {
    const count =
      typeof row.count === 'number' ? row.count : row.count.toNumber()
    const entityType = (row.entityType || '').toLowerCase()

    if (entityType.includes('company') || entityType.includes('organization')) {
      counts.companies += count
    } else if (entityType.includes('person') || entityType.includes('people')) {
      counts.people += count
    } else if (
      entityType.includes('financial') ||
      entityType.includes('metric') ||
      entityType.includes('revenue') ||
      entityType.includes('ebitda')
    ) {
      counts.financialMetrics += count
    } else if (entityType.includes('risk')) {
      counts.risks += count
    } else if (entityType.includes('finding')) {
      counts.findings += count
    } else if (entityType.includes('document')) {
      counts.documents += count
    }

    counts.total += count
  }

  return counts
}

/**
 * Get relationship counts for a deal
 *
 * @param groupId - The deal's group_id
 */
export async function getRelationshipCounts(
  groupId: string
): Promise<RelationshipCounts> {
  // Query relationships between entities in this group
  const result = await executeRead<{
    relType: string
    count: number | { toNumber: () => number }
  }>(
    `
    MATCH (e1:Entity)-[r]->(e2:Entity)
    WHERE e1.group_id = $groupId AND e2.group_id = $groupId
    RETURN type(r) AS relType, count(r) AS count
    `,
    { groupId }
  )

  const counts: RelationshipCounts = {
    extractedFrom: 0,
    supports: 0,
    contradicts: 0,
    supersedes: 0,
    basedOn: 0,
    total: 0,
  }

  for (const row of result) {
    const count =
      typeof row.count === 'number' ? row.count : row.count.toNumber()
    const relType = (row.relType || '').toUpperCase()

    if (relType.includes('EXTRACTED') || relType.includes('FROM')) {
      counts.extractedFrom += count
    } else if (relType.includes('SUPPORT')) {
      counts.supports += count
    } else if (relType.includes('CONTRADICT')) {
      counts.contradicts += count
    } else if (relType.includes('SUPERSEDE')) {
      counts.supersedes += count
    } else if (relType.includes('BASED')) {
      counts.basedOn += count
    }

    counts.total += count
  }

  return counts
}

/**
 * Get recent entities for a deal
 *
 * @param groupId - The deal's group_id
 * @param limit - Maximum entities to return
 */
export async function getRecentEntities(
  groupId: string,
  limit = 10
): Promise<GraphitiEntity[]> {
  const result = await executeRead<{
    uuid: string
    name: string
    entityType: string
    groupId: string
    createdAt: string
  }>(
    `
    MATCH (e:Entity)
    WHERE e.group_id = $groupId
    RETURN
      e.uuid AS uuid,
      e.name AS name,
      e.entity_type AS entityType,
      e.group_id AS groupId,
      e.created_at AS createdAt
    ORDER BY e.created_at DESC
    LIMIT toInteger($limit)
    `,
    { groupId, limit: Math.floor(limit) }
  )

  return result.map((row) => ({
    uuid: row.uuid || '',
    name: row.name || '',
    entityType: row.entityType || 'Unknown',
    groupId: row.groupId || groupId,
    createdAt: row.createdAt || '',
  }))
}

/**
 * Get last update timestamp for a deal
 *
 * @param groupId - The deal's group_id
 */
export async function getLastUpdated(groupId: string): Promise<string | null> {
  const result = await executeRead<{ lastUpdated: string }>(
    `
    MATCH (e:Entity)
    WHERE e.group_id = $groupId
    RETURN max(e.created_at) AS lastUpdated
    `,
    { groupId }
  )

  return result[0]?.lastUpdated || null
}

/**
 * Get complete knowledge graph summary for a deal
 *
 * @param dealId - The deal ID (used as group_id)
 */
export async function getKnowledgeGraphSummary(
  dealId: string
): Promise<KnowledgeGraphSummary> {
  const groupId = dealId // Graphiti uses deal_id as group_id

  const [entityCounts, relationshipCounts, recentEntities, lastUpdated] =
    await Promise.all([
      getEntityCounts(groupId),
      getRelationshipCounts(groupId),
      getRecentEntities(groupId, 10),
      getLastUpdated(groupId),
    ])

  return {
    dealId,
    groupId,
    entityCounts,
    relationshipCounts,
    recentEntities,
    lastUpdated,
  }
}

/**
 * Format entity counts for console output
 */
export function formatEntityCounts(counts: EntityCounts): string {
  const lines = [
    `   Companies:        ${counts.companies}`,
    `   People:           ${counts.people}`,
    `   Financial Metrics: ${counts.financialMetrics}`,
    `   Risks:            ${counts.risks}`,
    `   Findings:         ${counts.findings}`,
    `   Documents:        ${counts.documents}`,
    `   ────────────────────`,
    `   Total:            ${counts.total}`,
  ]
  return lines.join('\n')
}

/**
 * Format relationship counts for console output
 */
export function formatRelationshipCounts(counts: RelationshipCounts): string {
  const lines = [
    `   EXTRACTED_FROM:   ${counts.extractedFrom}`,
    `   SUPPORTS:         ${counts.supports}`,
    `   CONTRADICTS:      ${counts.contradicts}`,
    `   SUPERSEDES:       ${counts.supersedes}`,
    `   BASED_ON:         ${counts.basedOn}`,
    `   ────────────────────`,
    `   Total:            ${counts.total}`,
  ]
  return lines.join('\n')
}

/**
 * Check if Neo4j has any data for a deal
 */
export async function hasGraphData(dealId: string): Promise<boolean> {
  const result = await executeRead<{ count: number | { toNumber: () => number } }>(
    `
    MATCH (e:Entity)
    WHERE e.group_id = $groupId
    RETURN count(e) AS count
    LIMIT 1
    `,
    { groupId: dealId }
  )

  const count = result[0]?.count
  if (!count) return false
  return (typeof count === 'number' ? count : count.toNumber()) > 0
}
