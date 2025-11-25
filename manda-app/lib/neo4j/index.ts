/**
 * Neo4j Module Exports
 * Story: E1.7 - Configure Neo4j Graph Database
 */

// Client
export {
  getNeo4jDriver,
  getSession,
  closeNeo4jDriver,
  verifyNeo4jConnection,
  executeRead,
  executeWrite,
} from './client'

// Types
export {
  NODE_LABELS,
  RELATIONSHIP_TYPES,
  type NodeLabel,
  type RelationshipType,
  type DealNode,
  type DocumentNode,
  type FindingNode,
  type InsightNode,
  type ExtractedFromRel,
  type ContradictsRel,
  type SupersedesRel,
  type SupportsRel,
  type PatternDetectedRel,
  type BasedOnRel,
  type BelongsToRel,
} from './types'

// Schema
export {
  initializeNeo4jSchema,
  getNeo4jSchemaStatus,
  dropNeo4jSchema,
} from './schema'

// Operations
export {
  createNode,
  getNodeById,
  updateNode,
  deleteNode,
  findNodesByProperty,
  createRelationship,
  deleteRelationship,
  getRelatedNodes,
  createDealNode,
  createDocumentNode,
  createFindingNode,
  createContradiction,
  createSupport,
  getFindingsWithSources,
  getContradictions,
  getFindingsByTimePeriod,
} from './operations'
