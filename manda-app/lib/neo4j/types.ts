/**
 * Neo4j Node and Relationship Type Definitions
 * Schema for the knowledge graph data model
 * Story: E1.7 - Configure Neo4j Graph Database (AC: #3, #4, #6)
 */

// ===================
// Node Types
// ===================

/**
 * Deal node - represents a project/deal
 * Corresponds to 'deals' table in PostgreSQL
 */
export interface DealNode {
  id: string // UUID from PostgreSQL
  name: string
  user_id: string
  created_at?: string
  [key: string]: unknown // Index signature for Neo4j compatibility
}

/**
 * Document node - represents an uploaded document
 * Corresponds to 'documents' table in PostgreSQL
 */
export interface DocumentNode {
  id: string // UUID from PostgreSQL
  name: string
  doc_type: string // 'pdf', 'xlsx', 'docx', etc.
  upload_date: string // ISO date
  deal_id: string
  [key: string]: unknown // Index signature for Neo4j compatibility
}

/**
 * Finding node - represents an extracted fact with temporal metadata
 * Core entity for knowledge graph relationships
 */
export interface FindingNode {
  id: string // UUID
  text: string
  confidence: number // 0.0 to 1.0
  category: string // 'financial', 'legal', 'operational', etc.
  date_referenced: string // The date the data refers to (e.g., "2024-09-30" for Q3 2024)
  date_extracted: string // When the finding was extracted (ISO date)
  source_document_id: string
  source_location: string // "Page 5", "Cell B15", etc.
  deal_id: string
  user_id: string
  status: 'pending' | 'validated' | 'rejected' // Validation status
  [key: string]: unknown // Index signature for Neo4j compatibility
}

/**
 * Insight node - represents an analyzed pattern or insight
 * Derived from multiple findings
 */
export interface InsightNode {
  id: string // UUID
  text: string
  insight_type: 'pattern' | 'contradiction' | 'gap' | 'trend'
  confidence: number // 0.0 to 1.0
  deal_id: string
  created_at: string // ISO date
  [key: string]: unknown // Index signature for Neo4j compatibility
}

// ===================
// Relationship Types
// ===================

/**
 * EXTRACTED_FROM - Finding was extracted from Document
 * Source attribution for traceability
 */
export interface ExtractedFromRel {
  page?: number // Page number in document
  cell?: string // Cell reference for spreadsheets (e.g., "B15")
  section?: string // Section name in document
  extracted_at: string // ISO date
}

/**
 * CONTRADICTS - Finding contradicts another Finding
 * Temporal awareness: only true contradictions if same time period
 */
export interface ContradictsRel {
  detected_at: string // ISO date
  reason?: string // Why they contradict
  confidence: number // 0.0 to 1.0
  resolved: boolean // Has this contradiction been resolved?
}

/**
 * SUPERSEDES - Newer Finding supersedes older Finding
 * Temporal evolution of data
 */
export interface SupersedesRel {
  reason: string // "Newer data available", "Correction", etc.
  superseded_at: string // ISO date
}

/**
 * SUPPORTS - Finding supports another Finding
 * Corroborating evidence
 */
export interface SupportsRel {
  strength: number // 0.0 to 1.0 (how strongly it supports)
  detected_at: string // ISO date
}

/**
 * PATTERN_DETECTED - Cross-domain pattern relationship
 * Links findings that form a pattern across domains
 */
export interface PatternDetectedRel {
  pattern_type: string // 'financial_operational', 'legal_compliance', etc.
  confidence: number // 0.0 to 1.0
  detected_at: string // ISO date
}

/**
 * BASED_ON - Insight is based on Finding(s)
 * Links insights to their source findings
 */
export interface BasedOnRel {
  relevance: number // 0.0 to 1.0 (how relevant the finding is to the insight)
}

/**
 * BELONGS_TO - Node belongs to Deal
 * Establishes ownership/hierarchy
 */
export interface BelongsToRel {
  added_at: string // ISO date
}

// ===================
// Node Labels (Constants)
// ===================

export const NODE_LABELS = {
  DEAL: 'Deal',
  DOCUMENT: 'Document',
  FINDING: 'Finding',
  INSIGHT: 'Insight',
} as const

export type NodeLabel = (typeof NODE_LABELS)[keyof typeof NODE_LABELS]

// ===================
// Relationship Types (Constants)
// ===================

export const RELATIONSHIP_TYPES = {
  EXTRACTED_FROM: 'EXTRACTED_FROM',
  CONTRADICTS: 'CONTRADICTS',
  SUPERSEDES: 'SUPERSEDES',
  SUPPORTS: 'SUPPORTS',
  PATTERN_DETECTED: 'PATTERN_DETECTED',
  BASED_ON: 'BASED_ON',
  BELONGS_TO: 'BELONGS_TO',
} as const

export type RelationshipType =
  (typeof RELATIONSHIP_TYPES)[keyof typeof RELATIONSHIP_TYPES]
