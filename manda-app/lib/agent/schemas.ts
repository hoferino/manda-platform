/**
 * Agent Tool Schemas
 *
 * Zod schemas for tool input/output validation (TypeScript equivalent of Pydantic v2).
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Features:
 * - Input validation for all 11 chat tools
 * - Type-safe tool definitions
 * - Error messages optimized for LLM understanding
 */

import { z } from 'zod'

// =============================================================================
// Common Schemas
// =============================================================================

/**
 * Source citation for attributing findings to documents
 */
export const SourceCitationSchema = z.object({
  documentId: z.string().uuid().describe('UUID of the source document'),
  documentName: z.string().describe('Human-readable document name'),
  location: z.string().describe('Location in document (page, cell, section)'),
  textSnippet: z.string().max(500).optional().describe('Relevant excerpt'),
})

export type SourceCitation = z.infer<typeof SourceCitationSchema>

/**
 * Finding domain categories
 */
export const FindingDomainSchema = z.enum([
  'financial',
  'operational',
  'market',
  'legal',
  'technical',
])

export type FindingDomain = z.infer<typeof FindingDomainSchema>

/**
 * Finding status values
 */
export const FindingStatusSchema = z.enum(['pending', 'validated', 'rejected'])

export type FindingStatus = z.infer<typeof FindingStatusSchema>

/**
 * Relationship types for knowledge graph
 */
export const RelationshipTypeSchema = z.enum([
  'SUPPORTS',
  'CONTRADICTS',
  'SUPERSEDES',
])

export type RelationshipType = z.infer<typeof RelationshipTypeSchema>

// =============================================================================
// Knowledge Tools Input Schemas
// =============================================================================

/**
 * query_knowledge_base - Semantic search for findings
 * AC: #1 - Performs semantic search via pgvector match_findings RPC
 */
export const QueryKnowledgeBaseInputSchema = z.object({
  query: z.string().min(3).max(1000).describe('Search query text (3-1000 chars)'),
  filters: z
    .object({
      dealId: z.string().uuid().optional().describe('Filter by deal/project ID'),
      documentId: z.string().uuid().optional().describe('Filter by specific document'),
      domains: z.array(FindingDomainSchema).optional().describe('Filter by domains'),
      statuses: z.array(FindingStatusSchema).optional().describe('Filter by status'),
      confidenceMin: z.number().min(0).max(1).optional().describe('Minimum confidence 0-1'),
      confidenceMax: z.number().min(0).max(1).optional().describe('Maximum confidence 0-1'),
    })
    .optional()
    .describe('Optional filters to narrow search'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe('Maximum results to return (default: 10, max: 50)'),
})

export type QueryKnowledgeBaseInput = z.infer<typeof QueryKnowledgeBaseInputSchema>

/**
 * update_knowledge_base - Store new findings with temporal metadata
 * AC: #6 - Stores analyst-provided findings with temporal metadata
 */
export const UpdateKnowledgeBaseInputSchema = z.object({
  finding: z.string().min(10).max(2000).describe('The finding text to store (10-2000 chars)'),
  source: z
    .object({
      documentId: z.string().uuid().describe('Source document UUID'),
      location: z.string().describe('Location in document (page, cell, section)'),
    })
    .describe('Source attribution for the finding'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .default(0.8)
    .describe('Confidence score 0-1 (default: 0.8)'),
  dateReferenced: z
    .string()
    .optional()
    .describe('Date the data refers to (e.g., "2024-09-30" for Q3 2024)'),
  domains: z.array(FindingDomainSchema).optional().describe('Domain categories'),
})

export type UpdateKnowledgeBaseInput = z.infer<typeof UpdateKnowledgeBaseInputSchema>

/**
 * validate_finding - Check for contradictions with temporal awareness
 * AC: #5 - Validates findings with temporal awareness
 */
export const ValidateFindingInputSchema = z.object({
  finding: z.string().min(10).describe('The finding text to validate'),
  context: z.string().optional().describe('Additional context for validation'),
  dateReferenced: z
    .string()
    .optional()
    .describe('Temporal context - only compare with same time period'),
})

export type ValidateFindingInput = z.infer<typeof ValidateFindingInputSchema>

/**
 * update_knowledge_graph - Create Neo4j relationships
 * AC: #8 - Creates Neo4j relationships (SUPPORTS, CONTRADICTS, etc.)
 */
export const UpdateKnowledgeGraphInputSchema = z.object({
  findingId: z.string().uuid().describe('The finding to create relationships from'),
  relationships: z
    .array(
      z.object({
        type: RelationshipTypeSchema.describe('Relationship type'),
        targetId: z.string().uuid().describe('Target finding UUID'),
      })
    )
    .min(1)
    .describe('Relationships to create'),
})

export type UpdateKnowledgeGraphInput = z.infer<typeof UpdateKnowledgeGraphInputSchema>

// =============================================================================
// Intelligence Tools Input Schemas
// =============================================================================

/**
 * detect_contradictions - Query Neo4j for CONTRADICTS relationships
 * AC: #2 - Returns conflicting findings side-by-side with temporal context
 */
export const DetectContradictionsInputSchema = z.object({
  topic: z.string().min(3).describe('Topic or domain to check for contradictions'),
  includeResolved: z
    .boolean()
    .default(false)
    .describe('Include previously resolved contradictions'),
})

export type DetectContradictionsInput = z.infer<typeof DetectContradictionsInputSchema>

/**
 * find_gaps - Analyze coverage against IRL requirements
 * AC: #4 - Returns gap analysis grouped by domain
 */
export const FindGapsInputSchema = z.object({
  category: z
    .enum(['irl_missing', 'information_gap', 'all'])
    .default('all')
    .describe('Gap category to analyze'),
})

export type FindGapsInput = z.infer<typeof FindGapsInputSchema>

// =============================================================================
// Document Tools Input Schemas
// =============================================================================

/**
 * get_document_info - Retrieve document metadata
 * AC: #3 - Returns document metadata (name, type, upload date, processing status)
 */
export const GetDocumentInfoInputSchema = z.object({
  documentId: z.string().uuid().describe('Document UUID to retrieve info for'),
})

export type GetDocumentInfoInput = z.infer<typeof GetDocumentInfoInputSchema>

/**
 * trigger_analysis - Enqueue document processing job
 * AC: #8 - Triggers document analysis via pg-boss
 */
export const TriggerAnalysisInputSchema = z.object({
  documentId: z.string().uuid().describe('Document UUID to analyze'),
  analysisType: z
    .enum(['full', 'financial', 'embedding'])
    .default('full')
    .describe('Type of analysis to perform'),
})

export type TriggerAnalysisInput = z.infer<typeof TriggerAnalysisInputSchema>

// =============================================================================
// Workflow Tools Input Schemas
// =============================================================================

/**
 * suggest_questions - Generate Q&A suggestions
 * AC: #7 - Hard cap of 10 questions, returns M&A-relevant questions
 */
export const SuggestQuestionsInputSchema = z.object({
  topic: z.string().min(3).describe('Topic to generate questions about'),
  maxCount: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(5)
    .describe('Maximum questions to generate (hard cap: 10)'),
})

export type SuggestQuestionsInput = z.infer<typeof SuggestQuestionsInputSchema>

/**
 * add_to_qa - Store Q&A item
 * AC: #8 - Stores Q&A item with sources and priority
 */
export const AddToQAInputSchema = z.object({
  question: z.string().min(10).describe('The question to add'),
  answer: z.string().min(10).describe('The answer to the question'),
  dealId: z.string().uuid().describe('Deal/project ID for the Q&A item'),
  sources: z.array(SourceCitationSchema).optional().describe('Source citations'),
  priority: z
    .enum(['high', 'medium', 'low'])
    .default('medium')
    .describe('Priority level'),
})

export type AddToQAInput = z.infer<typeof AddToQAInputSchema>

/**
 * create_irl - Create IRL structure
 * AC: #8 - Returns IRL structure (stub until Epic 6)
 */
export const CreateIRLInputSchema = z.object({
  dealType: z
    .string()
    .optional()
    .describe('Type of deal for IRL template selection'),
})

export type CreateIRLInput = z.infer<typeof CreateIRLInputSchema>

/**
 * generate_irl_suggestions - Generate IRL item suggestions based on deal context
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents
 * AC: #1, #2, #4, #5 - Suggests IRL items based on deal type and uploaded documents
 */
export const GenerateIRLSuggestionsInputSchema = z.object({
  dealId: z.string().uuid().describe('The deal/project ID to generate suggestions for'),
  currentIRLId: z
    .string()
    .uuid()
    .optional()
    .describe('Optional: The current IRL ID to compare against for gap analysis'),
  dealType: z
    .string()
    .optional()
    .describe('Optional: Deal type for template-based suggestions (tech_ma, industrial, pharma, financial)'),
})

export type GenerateIRLSuggestionsInput = z.infer<typeof GenerateIRLSuggestionsInputSchema>

/**
 * add_to_irl - Add a suggested item to an IRL
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents
 * AC: #3 - Adds suggested item to user's active IRL
 */
export const AddToIRLInputSchema = z.object({
  irlId: z.string().uuid().describe('The IRL ID to add the item to'),
  category: z.string().min(1).describe('Category for the IRL item'),
  itemName: z.string().min(1).describe('Name of the IRL item'),
  priority: z
    .enum(['high', 'medium', 'low'])
    .default('medium')
    .describe('Priority level for the item'),
  description: z.string().optional().describe('Optional description for the item'),
})

export type AddToIRLInput = z.infer<typeof AddToIRLInputSchema>

/**
 * IRL Suggestion output type
 * AC: #2 - Includes category, item name, priority, and rationale
 */
export const IRLSuggestionSchema = z.object({
  category: z.string().describe('Category for the suggested item'),
  itemName: z.string().describe('Name of the suggested item'),
  priority: z.enum(['high', 'medium', 'low']).describe('Priority level'),
  rationale: z.string().describe('Explanation of why this item is recommended'),
})

export type IRLSuggestion = z.infer<typeof IRLSuggestionSchema>

// =============================================================================
// Output Schemas
// =============================================================================

/**
 * Finding with source attribution for tool responses
 */
export const FindingWithSourceSchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  confidence: z.number().min(0).max(1).nullable(),
  domain: FindingDomainSchema.nullable(),
  status: FindingStatusSchema,
  source: SourceCitationSchema,
  dateReferenced: z.string().nullable(),
  similarity: z.number().min(0).max(1).optional(),
})

export type FindingWithSource = z.infer<typeof FindingWithSourceSchema>

/**
 * Query knowledge base response
 */
export const QueryKnowledgeBaseOutputSchema = z.object({
  findings: z.array(FindingWithSourceSchema),
  total: z.number().int().nonnegative(),
  hasConflicts: z.boolean(),
  conflicts: z
    .array(
      z.object({
        findingA: FindingWithSourceSchema,
        findingB: FindingWithSourceSchema,
        explanation: z.string(),
      })
    )
    .optional(),
})

export type QueryKnowledgeBaseOutput = z.infer<typeof QueryKnowledgeBaseOutputSchema>

/**
 * Contradiction with full finding data
 */
export const ContradictionOutputSchema = z.object({
  id: z.string().uuid(),
  findingA: FindingWithSourceSchema,
  findingB: FindingWithSourceSchema,
  confidence: z.number().min(0).max(1).nullable(),
  status: z.enum(['unresolved', 'resolved', 'noted', 'investigating']),
  temporalContext: z.string().optional(),
})

export type ContradictionOutput = z.infer<typeof ContradictionOutputSchema>

/**
 * Gap analysis output
 */
export const GapOutputSchema = z.object({
  id: z.string(),
  category: z.enum(['irl_missing', 'information_gap', 'incomplete_analysis']),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  domain: FindingDomainSchema.nullable().optional(),
  suggestedAction: z.string().optional(),
})

export type GapOutput = z.infer<typeof GapOutputSchema>

/**
 * Document info output
 */
export const DocumentInfoOutputSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  uploadedAt: z.string(),
  processingStatus: z.enum(['pending', 'processing', 'completed', 'failed']),
  findingsCount: z.number().int().nonnegative(),
  fileSize: z.number().int().nonnegative().optional(),
})

export type DocumentInfoOutput = z.infer<typeof DocumentInfoOutputSchema>

/**
 * Q&A suggestion output
 */
export const QASuggestionSchema = z.object({
  question: z.string(),
  relevance: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']),
})

export type QASuggestion = z.infer<typeof QASuggestionSchema>

// =============================================================================
// Export all schemas for tool definitions
// =============================================================================

export const ToolSchemas = {
  // Inputs
  QueryKnowledgeBaseInput: QueryKnowledgeBaseInputSchema,
  UpdateKnowledgeBaseInput: UpdateKnowledgeBaseInputSchema,
  ValidateFindingInput: ValidateFindingInputSchema,
  UpdateKnowledgeGraphInput: UpdateKnowledgeGraphInputSchema,
  DetectContradictionsInput: DetectContradictionsInputSchema,
  FindGapsInput: FindGapsInputSchema,
  GetDocumentInfoInput: GetDocumentInfoInputSchema,
  TriggerAnalysisInput: TriggerAnalysisInputSchema,
  SuggestQuestionsInput: SuggestQuestionsInputSchema,
  AddToQAInput: AddToQAInputSchema,
  CreateIRLInput: CreateIRLInputSchema,
  GenerateIRLSuggestionsInput: GenerateIRLSuggestionsInputSchema,
  AddToIRLInput: AddToIRLInputSchema,

  // Outputs
  QueryKnowledgeBaseOutput: QueryKnowledgeBaseOutputSchema,
  ContradictionOutput: ContradictionOutputSchema,
  GapOutput: GapOutputSchema,
  DocumentInfoOutput: DocumentInfoOutputSchema,
  QASuggestion: QASuggestionSchema,
  FindingWithSource: FindingWithSourceSchema,
  IRLSuggestion: IRLSuggestionSchema,
}
