/**
 * Neo4j CRUD Operations
 * Helper functions for common graph database operations
 * Story: E1.7 - Configure Neo4j Graph Database (AC: #5)
 */

import { executeRead, executeWrite } from './client'
import {
  NODE_LABELS,
  RELATIONSHIP_TYPES,
  type NodeLabel,
  type RelationshipType,
  type DealNode,
  type DocumentNode,
  type FindingNode,
  type InsightNode,
} from './types'

// ===================
// Generic Node Operations
// ===================

/**
 * Create a node with the specified label and properties
 */
export async function createNode<T extends Record<string, unknown>>(
  label: NodeLabel,
  properties: T
): Promise<T> {
  const result = await executeWrite<{ n: T }>(
    `CREATE (n:${label} $props) RETURN n`,
    { props: properties }
  )
  if (!result[0]?.n) {
    throw new Error(`Failed to create ${label} node`)
  }
  return result[0].n
}

/**
 * Get a node by its ID
 */
export async function getNodeById<T>(
  label: NodeLabel,
  id: string
): Promise<T | null> {
  const result = await executeRead<{ n: T }>(
    `MATCH (n:${label} {id: $id}) RETURN n`,
    { id }
  )
  return result[0]?.n ?? null
}

/**
 * Update a node's properties (merge with existing)
 */
export async function updateNode<T extends Record<string, unknown>>(
  label: NodeLabel,
  id: string,
  properties: Partial<T>
): Promise<T | null> {
  const result = await executeWrite<{ n: T }>(
    `MATCH (n:${label} {id: $id}) SET n += $props RETURN n`,
    { id, props: properties }
  )
  return result[0]?.n ?? null
}

/**
 * Delete a node and all its relationships
 */
export async function deleteNode(label: NodeLabel, id: string): Promise<boolean> {
  const result = await executeWrite<{ count: unknown }>(
    `MATCH (n:${label} {id: $id}) DETACH DELETE n RETURN count(n) AS count`,
    { id }
  )
  const count = result[0]?.count
  if (count === undefined || count === null) return false
  if (typeof count === 'number') return count > 0
  // Neo4j Integer type has toNumber()
  if (typeof count === 'object' && 'toNumber' in count) {
    return (count as { toNumber: () => number }).toNumber() > 0
  }
  return false
}

/**
 * Find nodes by property
 */
export async function findNodesByProperty<T>(
  label: NodeLabel,
  property: string,
  value: unknown
): Promise<T[]> {
  const result = await executeRead<{ n: T }>(
    `MATCH (n:${label}) WHERE n[$property] = $value RETURN n`,
    { property, value }
  )
  return result.map((r) => r.n)
}

// ===================
// Relationship Operations
// ===================

/**
 * Create a relationship between two nodes
 */
export async function createRelationship<T extends Record<string, unknown>>(
  fromLabel: NodeLabel,
  fromId: string,
  toLabel: NodeLabel,
  toId: string,
  relationshipType: RelationshipType,
  properties?: T
): Promise<boolean> {
  const propsClause = properties ? ' $props' : ''
  const result = await executeWrite<{ r: unknown }>(
    `MATCH (a:${fromLabel} {id: $fromId})
     MATCH (b:${toLabel} {id: $toId})
     CREATE (a)-[r:${relationshipType}${propsClause}]->(b)
     RETURN r`,
    { fromId, toId, ...(properties && { props: properties }) }
  )
  return result.length > 0
}

/**
 * Delete a relationship between two nodes
 */
export async function deleteRelationship(
  fromLabel: NodeLabel,
  fromId: string,
  toLabel: NodeLabel,
  toId: string,
  relationshipType: RelationshipType
): Promise<boolean> {
  const result = await executeWrite<{ count: unknown }>(
    `MATCH (a:${fromLabel} {id: $fromId})-[r:${relationshipType}]->(b:${toLabel} {id: $toId})
     DELETE r
     RETURN count(r) AS count`,
    { fromId, toId }
  )
  const count = result[0]?.count
  if (count === undefined || count === null) return false
  if (typeof count === 'number') return count > 0
  if (typeof count === 'object' && 'toNumber' in count) {
    return (count as { toNumber: () => number }).toNumber() > 0
  }
  return false
}

/**
 * Get all nodes related to a node via a specific relationship
 */
export async function getRelatedNodes<T>(
  fromLabel: NodeLabel,
  fromId: string,
  relationshipType: RelationshipType,
  toLabel: NodeLabel,
  direction: 'outgoing' | 'incoming' | 'both' = 'outgoing'
): Promise<T[]> {
  let pattern: string
  switch (direction) {
    case 'outgoing':
      pattern = `-[r:${relationshipType}]->`
      break
    case 'incoming':
      pattern = `<-[r:${relationshipType}]-`
      break
    case 'both':
      pattern = `-[r:${relationshipType}]-`
      break
  }

  const result = await executeRead<{ b: T }>(
    `MATCH (a:${fromLabel} {id: $fromId})${pattern}(b:${toLabel}) RETURN b`,
    { fromId }
  )
  return result.map((r) => r.b)
}

// ===================
// Domain-Specific Operations
// ===================

/**
 * Create a Deal node
 */
export async function createDealNode(deal: DealNode): Promise<DealNode> {
  return createNode<DealNode>(NODE_LABELS.DEAL, deal)
}

/**
 * Create a Document node linked to a Deal
 */
export async function createDocumentNode(
  document: DocumentNode
): Promise<DocumentNode> {
  const doc = await createNode<DocumentNode>(NODE_LABELS.DOCUMENT, document)

  // Create BELONGS_TO relationship to Deal
  await createRelationship(
    NODE_LABELS.DOCUMENT,
    document.id,
    NODE_LABELS.DEAL,
    document.deal_id,
    RELATIONSHIP_TYPES.BELONGS_TO,
    { added_at: new Date().toISOString() }
  )

  return doc
}

/**
 * Create a Finding node with EXTRACTED_FROM relationship to Document
 */
export async function createFindingNode(
  finding: FindingNode,
  extractedFromProps?: { page?: number; cell?: string; section?: string }
): Promise<FindingNode> {
  const f = await createNode<FindingNode>(NODE_LABELS.FINDING, finding)

  // Create EXTRACTED_FROM relationship to Document
  await createRelationship(
    NODE_LABELS.FINDING,
    finding.id,
    NODE_LABELS.DOCUMENT,
    finding.source_document_id,
    RELATIONSHIP_TYPES.EXTRACTED_FROM,
    {
      ...extractedFromProps,
      extracted_at: finding.date_extracted,
    }
  )

  // Create BELONGS_TO relationship to Deal
  await createRelationship(
    NODE_LABELS.FINDING,
    finding.id,
    NODE_LABELS.DEAL,
    finding.deal_id,
    RELATIONSHIP_TYPES.BELONGS_TO,
    { added_at: new Date().toISOString() }
  )

  return f
}

/**
 * Create a CONTRADICTS relationship between two Findings
 */
export async function createContradiction(
  findingId1: string,
  findingId2: string,
  reason?: string,
  confidence: number = 0.8
): Promise<boolean> {
  return createRelationship(
    NODE_LABELS.FINDING,
    findingId1,
    NODE_LABELS.FINDING,
    findingId2,
    RELATIONSHIP_TYPES.CONTRADICTS,
    {
      detected_at: new Date().toISOString(),
      reason,
      confidence,
      resolved: false,
    }
  )
}

/**
 * Create a SUPPORTS relationship between two Findings
 */
export async function createSupport(
  findingId1: string,
  findingId2: string,
  strength: number = 0.8
): Promise<boolean> {
  return createRelationship(
    NODE_LABELS.FINDING,
    findingId1,
    NODE_LABELS.FINDING,
    findingId2,
    RELATIONSHIP_TYPES.SUPPORTS,
    {
      strength,
      detected_at: new Date().toISOString(),
    }
  )
}

/**
 * Get all findings for a deal with their source documents
 */
export async function getFindingsWithSources(
  dealId: string
): Promise<Array<{ finding: FindingNode; document: DocumentNode }>> {
  const result = await executeRead<{ f: FindingNode; d: DocumentNode }>(
    `MATCH (f:${NODE_LABELS.FINDING})-[:${RELATIONSHIP_TYPES.EXTRACTED_FROM}]->(d:${NODE_LABELS.DOCUMENT})
     WHERE f.deal_id = $dealId
     RETURN f, d`,
    { dealId }
  )
  return result.map((r) => ({ finding: r.f, document: r.d }))
}

/**
 * Get contradicting findings for a deal
 * Only returns true contradictions (same time period)
 */
export async function getContradictions(
  dealId: string
): Promise<Array<{ finding1: FindingNode; finding2: FindingNode; reason?: string }>> {
  const result = await executeRead<{
    f1: FindingNode
    f2: FindingNode
    reason: string | null
  }>(
    `MATCH (f1:${NODE_LABELS.FINDING})-[r:${RELATIONSHIP_TYPES.CONTRADICTS}]->(f2:${NODE_LABELS.FINDING})
     WHERE f1.deal_id = $dealId
       AND f1.date_referenced = f2.date_referenced  // Same time period = true contradiction
       AND r.resolved = false
     RETURN f1, f2, r.reason AS reason`,
    { dealId }
  )
  return result.map((r) => ({
    finding1: r.f1,
    finding2: r.f2,
    reason: r.reason ?? undefined,
  }))
}

/**
 * Get findings by time period for temporal analysis
 */
export async function getFindingsByTimePeriod(
  dealId: string,
  dateReferenced: string
): Promise<FindingNode[]> {
  const result = await executeRead<{ f: FindingNode }>(
    `MATCH (f:${NODE_LABELS.FINDING})
     WHERE f.deal_id = $dealId AND f.date_referenced = $dateReferenced
     RETURN f`,
    { dealId, dateReferenced }
  )
  return result.map((r) => r.f)
}
