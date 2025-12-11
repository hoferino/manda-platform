/**
 * CIM Types
 *
 * TypeScript interfaces for CIM Builder workflow
 * Story: E9.1 - CIM Database Schema & Deal Integration
 *
 * CIM (Confidential Information Memorandum) entities represent the core value-add
 * of the Manda platform. This file defines all types for the agent-guided CIM creation workflow.
 */

import { z } from 'zod'

// ============================================================================
// Enums and Constants
// ============================================================================

/**
 * CIM workflow phases in order of progression
 */
export const CIM_PHASES = [
  'persona',
  'thesis',
  'outline',
  'content_creation',
  'visual_concepts',
  'review',
  'complete',
] as const
export type CIMPhase = (typeof CIM_PHASES)[number]

/**
 * Buyer types for CIM targeting
 */
export const BUYER_TYPES = ['strategic', 'financial', 'management', 'other'] as const
export type BuyerType = (typeof BUYER_TYPES)[number]

/**
 * Slide component types
 */
export const COMPONENT_TYPES = [
  'title',
  'subtitle',
  'text',
  'bullet',
  'chart',
  'image',
  'table',
] as const
export type ComponentType = (typeof COMPONENT_TYPES)[number]

/**
 * Visual layout types for slides
 */
export const LAYOUT_TYPES = [
  'title_slide',
  'content',
  'two_column',
  'chart_focus',
  'image_focus',
] as const
export type LayoutType = (typeof LAYOUT_TYPES)[number]

/**
 * Chart types for visual recommendations
 */
export const CHART_TYPES = ['bar', 'line', 'pie', 'area', 'table'] as const
export type ChartType = (typeof CHART_TYPES)[number]

/**
 * Source reference types
 */
export const SOURCE_TYPES = ['document', 'finding', 'qa'] as const
export type SourceType = (typeof SOURCE_TYPES)[number]

/**
 * Narrative roles for slides within a section
 * Story: E9.12 - Narrative Structure Dependencies
 *
 * Each slide can have a narrative role that defines its purpose within a section's
 * story arc. This enables detection of content-role mismatches when content moves
 * between slides with incompatible roles.
 */
export const NARRATIVE_ROLES = [
  'introduction',   // Sets context, hooks reader
  'context',        // Background information, market/industry context
  'evidence',       // Data points, facts, supporting information
  'analysis',       // Interpretation of evidence, insights
  'implications',   // What the analysis means for buyer
  'projections',    // Forward-looking statements, forecasts
  'conclusion',     // Summary, call to action
] as const
export type NarrativeRole = (typeof NARRATIVE_ROLES)[number]

/**
 * Slide status
 */
export const SLIDE_STATUSES = ['draft', 'approved', 'locked'] as const
export type SlideStatus = (typeof SLIDE_STATUSES)[number]

/**
 * Outline section status
 * Story: E9.13 - Added 'needs_review' for flagging sections with incomplete dependencies
 */
export const SECTION_STATUSES = ['pending', 'in_progress', 'complete', 'needs_review'] as const
export type SectionStatus = (typeof SECTION_STATUSES)[number]

/**
 * Navigation event types for tracking user navigation patterns
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export const NAVIGATION_TYPES = ['sequential', 'jump', 'backward', 'forward'] as const
export type NavigationType = (typeof NAVIGATION_TYPES)[number]

// ============================================================================
// Core Types
// ============================================================================

/**
 * Workflow state tracking CIM creation progress
 */
export interface WorkflowState {
  current_phase: CIMPhase
  current_section_index: number | null
  current_slide_index: number | null
  completed_phases: CIMPhase[]
  is_complete: boolean
}

/**
 * Buyer persona captured during persona phase
 */
export interface BuyerPersona {
  buyer_type: BuyerType
  buyer_description: string
  priorities: string[]
  concerns: string[]
  key_metrics: string[]
}

/**
 * Narrative structure definition for a section
 * Story: E9.12 - Narrative Structure Dependencies
 *
 * Captures the expected narrative flow pattern for a section type.
 * This enables detection of structural violations when slides are reordered
 * or content is moved between slides with incompatible roles.
 */
export interface NarrativeStructure {
  /** Expected sequence of roles for this section type */
  expectedRoleSequence: NarrativeRole[]
  /** Which roles are required for the section to be complete */
  requiredRoles: NarrativeRole[]
  /** Optional roles that can be included but aren't mandatory */
  optionalRoles: NarrativeRole[]
}

/**
 * A section in the CIM outline
 */
export interface OutlineSection {
  id: string
  title: string
  description: string
  order: number
  status: SectionStatus
  slide_ids: string[]
  /** E9.12: Narrative structure definition for this section */
  narrativeStructure?: NarrativeStructure
}

/**
 * Reference to a source document, finding, or Q&A item
 */
export interface SourceReference {
  type: SourceType
  id: string
  title: string
  excerpt?: string
}

/**
 * Chart recommendation for visual concepts
 */
export interface ChartRecommendation {
  type: ChartType
  data_description: string
  purpose: string
}

/**
 * Visual concept for a slide
 */
export interface VisualConcept {
  layout_type: LayoutType
  chart_recommendations?: ChartRecommendation[]
  image_suggestions?: string[]
  notes: string
}

/**
 * A component within a slide (title, bullet, chart, etc.)
 */
export interface SlideComponent {
  id: string
  type: ComponentType
  content: string
  metadata?: Record<string, unknown>
  source_refs?: SourceReference[]
}

/**
 * A slide in the CIM
 */
export interface Slide {
  id: string
  section_id: string
  title: string
  components: SlideComponent[]
  visual_concept: VisualConcept | null
  status: SlideStatus
  /** E9.12: This slide's narrative role within its section */
  narrative_role?: NarrativeRole
  created_at: string
  updated_at: string
}

/**
 * Dependency graph tracking cross-slide dependencies
 */
export interface DependencyGraph {
  /** slide_id -> array of slide_ids that depend on it */
  dependencies: Record<string, string[]>
  /** slide_id -> array of slide_ids it references */
  references: Record<string, string[]>
}

// ============================================================================
// Navigation Types (E9.13 - Non-Linear Navigation with Context)
// ============================================================================

/**
 * Warning about incomplete dependencies when navigating
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export interface NavigationWarning {
  /** Type of warning */
  type: 'incomplete_dependency' | 'missing_content' | 'stale_reference'
  /** The section/slide that has the issue */
  sourceId: string
  /** Human-readable warning message */
  message: string
  /** IDs of dependencies that are incomplete */
  incompleteDependencies: string[]
  /** Severity level */
  severity: 'info' | 'warning' | 'error'
}

/**
 * A navigation event recorded in history
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export interface NavigationEvent {
  /** Unique event ID */
  id: string
  /** Type of navigation that occurred */
  type: NavigationType
  /** Section navigated from (null if first navigation) */
  fromSectionId: string | null
  /** Section navigated to */
  toSectionId: string
  /** Timestamp of the navigation */
  timestamp: string
  /** Any warnings generated during navigation */
  warnings: NavigationWarning[]
  /** Whether user acknowledged warnings before proceeding */
  warningsAcknowledged: boolean
}

/**
 * Current navigation state for CIM builder
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export interface NavigationState {
  /** Currently active section ID */
  currentSectionId: string | null
  /** Currently active slide ID within the section */
  currentSlideId: string | null
  /** History of navigation events */
  history: NavigationEvent[]
  /** Current position in history (for forward/backward) */
  historyIndex: number
  /** Sections flagged with warnings */
  flaggedSections: Record<string, NavigationWarning[]>
}

/**
 * Result of a navigation operation
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export interface NavigationResult {
  /** Whether navigation was successful */
  success: boolean
  /** The navigation event that was created */
  event: NavigationEvent | null
  /** Updated navigation state */
  state: NavigationState
  /** Warnings about incomplete dependencies */
  warnings: NavigationWarning[]
  /** If navigation requires confirmation due to warnings */
  requiresConfirmation: boolean
  /** User-friendly message about the navigation */
  message: string
}

/**
 * Options for navigation operations
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export interface NavigationOptions {
  /** Skip coherence checks (not recommended) */
  skipCoherenceCheck?: boolean
  /** Auto-acknowledge warnings */
  acknowledgeWarnings?: boolean
  /** Include context summary in result */
  includeContextSummary?: boolean
}

/**
 * A message in the CIM conversation history
 */
export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    phase?: CIMPhase
    slide_ref?: string
    component_ref?: string
    sources?: SourceReference[]
  }
}

/**
 * Full CIM entity stored in database
 */
export interface CIM {
  id: string
  dealId: string
  title: string
  userId: string
  version: number
  workflowState: WorkflowState
  buyerPersona: BuyerPersona | null
  investmentThesis: string | null
  outline: OutlineSection[]
  slides: Slide[]
  dependencyGraph: DependencyGraph
  conversationHistory: ConversationMessage[]
  exportFormats: string[] | null
  createdAt: string
  updatedAt: string
}

/**
 * Input for creating a new CIM
 */
export interface CreateCIMInput {
  title: string
}

/**
 * Input for updating a CIM
 */
export interface UpdateCIMInput {
  title?: string
  workflowState?: WorkflowState
  buyerPersona?: BuyerPersona | null
  investmentThesis?: string | null
  outline?: OutlineSection[]
  slides?: Slide[]
  dependencyGraph?: DependencyGraph
  conversationHistory?: ConversationMessage[]
}

/**
 * CIM list item (lighter version for list views)
 */
export interface CIMListItem {
  id: string
  dealId: string
  title: string
  workflowState: WorkflowState
  slideCount: number
  createdAt: string
  updatedAt: string
}

// ============================================================================
// Zod Validation Schemas
// ============================================================================

/**
 * Schema for CIM phase
 */
export const CIMPhaseSchema = z.enum(CIM_PHASES)

/**
 * Schema for buyer type
 */
export const BuyerTypeSchema = z.enum(BUYER_TYPES)

/**
 * Schema for component type
 */
export const ComponentTypeSchema = z.enum(COMPONENT_TYPES)

/**
 * Schema for layout type
 */
export const LayoutTypeSchema = z.enum(LAYOUT_TYPES)

/**
 * Schema for chart type
 */
export const ChartTypeSchema = z.enum(CHART_TYPES)

/**
 * Schema for source type
 */
export const SourceTypeSchema = z.enum(SOURCE_TYPES)

/**
 * Schema for slide status
 */
export const SlideStatusSchema = z.enum(SLIDE_STATUSES)

/**
 * Schema for section status
 */
export const SectionStatusSchema = z.enum(SECTION_STATUSES)

/**
 * Schema for narrative role
 * Story: E9.12 - Narrative Structure Dependencies
 */
export const NarrativeRoleSchema = z.enum(NARRATIVE_ROLES)

/**
 * Schema for narrative structure
 * Story: E9.12 - Narrative Structure Dependencies
 */
export const NarrativeStructureSchema = z.object({
  expectedRoleSequence: z.array(NarrativeRoleSchema),
  requiredRoles: z.array(NarrativeRoleSchema),
  optionalRoles: z.array(NarrativeRoleSchema),
})

/**
 * Schema for workflow state
 */
export const WorkflowStateSchema = z.object({
  current_phase: CIMPhaseSchema,
  current_section_index: z.number().int().nullable(),
  current_slide_index: z.number().int().nullable(),
  completed_phases: z.array(CIMPhaseSchema),
  is_complete: z.boolean(),
})

/**
 * Schema for buyer persona
 */
export const BuyerPersonaSchema = z.object({
  buyer_type: BuyerTypeSchema,
  buyer_description: z.string().min(10, 'Buyer description must be at least 10 characters'),
  priorities: z.array(z.string()).min(1, 'At least one priority is required'),
  concerns: z.array(z.string()),
  key_metrics: z.array(z.string()),
})

/**
 * Schema for source reference
 */
export const SourceReferenceSchema = z.object({
  type: SourceTypeSchema,
  id: z.string().uuid(),
  title: z.string(),
  excerpt: z.string().optional(),
})

/**
 * Schema for chart recommendation
 */
export const ChartRecommendationSchema = z.object({
  type: ChartTypeSchema,
  data_description: z.string(),
  purpose: z.string(),
})

/**
 * Schema for visual concept
 */
export const VisualConceptSchema = z.object({
  layout_type: LayoutTypeSchema,
  chart_recommendations: z.array(ChartRecommendationSchema).optional(),
  image_suggestions: z.array(z.string()).optional(),
  notes: z.string(),
})

/**
 * Schema for slide component
 */
export const SlideComponentSchema = z.object({
  id: z.string(),
  type: ComponentTypeSchema,
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  source_refs: z.array(SourceReferenceSchema).optional(),
})

/**
 * Schema for outline section
 */
export const OutlineSectionSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, 'Section title is required'),
  description: z.string(),
  order: z.number().int().min(0),
  status: SectionStatusSchema,
  slide_ids: z.array(z.string().uuid()),
  narrativeStructure: NarrativeStructureSchema.optional(),
})

/**
 * Schema for slide
 */
export const SlideSchema = z.object({
  id: z.string(),
  section_id: z.string().uuid(),
  title: z.string(),
  components: z.array(SlideComponentSchema),
  visual_concept: VisualConceptSchema.nullable(),
  status: SlideStatusSchema,
  narrative_role: NarrativeRoleSchema.optional(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
})

/**
 * Schema for dependency graph
 */
export const DependencyGraphSchema = z.object({
  dependencies: z.record(z.string(), z.array(z.string())),
  references: z.record(z.string(), z.array(z.string())),
})

/**
 * Schema for navigation type
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export const NavigationTypeSchema = z.enum(NAVIGATION_TYPES)

/**
 * Schema for navigation warning
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export const NavigationWarningSchema = z.object({
  type: z.enum(['incomplete_dependency', 'missing_content', 'stale_reference']),
  sourceId: z.string(),
  message: z.string(),
  incompleteDependencies: z.array(z.string()),
  severity: z.enum(['info', 'warning', 'error']),
})

/**
 * Schema for navigation event
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export const NavigationEventSchema = z.object({
  id: z.string(),
  type: NavigationTypeSchema,
  fromSectionId: z.string().nullable(),
  toSectionId: z.string(),
  timestamp: z.string().datetime(),
  warnings: z.array(NavigationWarningSchema),
  warningsAcknowledged: z.boolean(),
})

/**
 * Schema for navigation state
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export const NavigationStateSchema = z.object({
  currentSectionId: z.string().nullable(),
  currentSlideId: z.string().nullable(),
  history: z.array(NavigationEventSchema),
  historyIndex: z.number().int().min(-1),
  flaggedSections: z.record(z.string(), z.array(NavigationWarningSchema)),
})

/**
 * Schema for navigation result
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export const NavigationResultSchema = z.object({
  success: z.boolean(),
  event: NavigationEventSchema.nullable(),
  state: NavigationStateSchema,
  warnings: z.array(NavigationWarningSchema),
  requiresConfirmation: z.boolean(),
  message: z.string(),
})

/**
 * Schema for navigation options
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export const NavigationOptionsSchema = z.object({
  skipCoherenceCheck: z.boolean().optional(),
  acknowledgeWarnings: z.boolean().optional(),
  includeContextSummary: z.boolean().optional(),
})

/**
 * Schema for conversation message
 */
export const ConversationMessageSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  timestamp: z.string().datetime(),
  metadata: z
    .object({
      phase: CIMPhaseSchema.optional(),
      slide_ref: z.string().optional(),
      component_ref: z.string().optional(),
      sources: z.array(SourceReferenceSchema).optional(),
    })
    .optional(),
})

/**
 * Schema for creating a CIM
 */
export const CreateCIMInputSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be 200 characters or less'),
})

/**
 * Schema for updating a CIM
 */
export const UpdateCIMInputSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be 200 characters or less')
    .optional(),
  workflowState: WorkflowStateSchema.optional(),
  buyerPersona: BuyerPersonaSchema.nullable().optional(),
  investmentThesis: z.string().nullable().optional(),
  outline: z.array(OutlineSectionSchema).optional(),
  slides: z.array(SlideSchema).optional(),
  dependencyGraph: DependencyGraphSchema.optional(),
  conversationHistory: z.array(ConversationMessageSchema).optional(),
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get the next phase in the workflow
 */
export function getNextPhase(currentPhase: CIMPhase): CIMPhase | null {
  const index = CIM_PHASES.indexOf(currentPhase)
  if (index < 0 || index >= CIM_PHASES.length - 1) {
    return null
  }
  const nextPhase = CIM_PHASES[index + 1]
  return nextPhase !== undefined ? nextPhase : null
}

/**
 * Get the previous phase in the workflow
 */
export function getPreviousPhase(currentPhase: CIMPhase): CIMPhase | null {
  const index = CIM_PHASES.indexOf(currentPhase)
  if (index <= 0) {
    return null
  }
  const prevPhase = CIM_PHASES[index - 1]
  return prevPhase !== undefined ? prevPhase : null
}

/**
 * Check if a phase has been completed
 */
export function isPhaseCompleted(workflowState: WorkflowState, phase: CIMPhase): boolean {
  return workflowState.completed_phases.includes(phase)
}

/**
 * Check if the CIM workflow is complete
 */
export function isCIMComplete(workflowState: WorkflowState): boolean {
  return workflowState.is_complete
}

/**
 * Calculate CIM progress as a percentage
 */
export function calculateCIMProgress(workflowState: WorkflowState): number {
  if (workflowState.is_complete) {
    return 100
  }
  const totalPhases = CIM_PHASES.length - 1 // Exclude 'complete'
  const completedCount = workflowState.completed_phases.filter((p) => p !== 'complete').length
  return Math.round((completedCount / totalPhases) * 100)
}

/**
 * Get a summary description of the current workflow state
 */
export function getWorkflowStateDescription(workflowState: WorkflowState): string {
  if (workflowState.is_complete) {
    return 'Complete'
  }
  const phaseLabels: Record<CIMPhase, string> = {
    persona: 'Defining Buyer Persona',
    thesis: 'Creating Investment Thesis',
    outline: 'Building Outline',
    content_creation: 'Creating Content',
    visual_concepts: 'Adding Visual Concepts',
    review: 'In Review',
    complete: 'Complete',
  }
  return phaseLabels[workflowState.current_phase] || workflowState.current_phase
}

/**
 * Create default workflow state for a new CIM
 */
export function createDefaultWorkflowState(): WorkflowState {
  return {
    current_phase: 'persona',
    current_section_index: null,
    current_slide_index: null,
    completed_phases: [],
    is_complete: false,
  }
}

/**
 * Create default dependency graph for a new CIM
 */
export function createDefaultDependencyGraph(): DependencyGraph {
  return {
    dependencies: {},
    references: {},
  }
}

/**
 * Create default navigation state for a new CIM
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export function createDefaultNavigationState(): NavigationState {
  return {
    currentSectionId: null,
    currentSlideId: null,
    history: [],
    historyIndex: -1,
    flaggedSections: {},
  }
}

/**
 * Determine navigation type based on section indices
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export function determineNavigationType(
  fromIndex: number | null,
  toIndex: number,
  historyIndex: number,
  historyLength: number
): NavigationType {
  // First navigation
  if (fromIndex === null) {
    return 'sequential'
  }

  // Moving through history
  if (historyIndex >= 0 && historyIndex < historyLength - 1) {
    return 'forward'
  }

  // Sequential navigation (next/previous)
  const diff = toIndex - fromIndex
  if (diff === 1) {
    return 'sequential'
  }
  if (diff === -1) {
    return 'backward'
  }

  // Jump navigation (more than 1 section apart)
  return 'jump'
}

/**
 * Check if navigation state can go backward
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export function canNavigateBack(state: NavigationState): boolean {
  return state.historyIndex > 0
}

/**
 * Check if navigation state can go forward
 * Story: E9.13 - Non-Linear Navigation with Context
 */
export function canNavigateForward(state: NavigationState): boolean {
  return state.historyIndex < state.history.length - 1
}

// ============================================================================
// Database Row Mapping
// ============================================================================

/**
 * Database row type matching Supabase generated types
 */
export interface CIMDbRow {
  id: string
  deal_id: string
  title: string
  user_id: string
  version: number
  workflow_state: unknown // Json type from Supabase
  buyer_persona: unknown | null
  investment_thesis: string | null
  outline: unknown | null
  slides: unknown | null
  dependency_graph: unknown | null
  conversation_history: unknown | null
  export_formats: string[] | null
  created_at: string
  updated_at: string
  content: unknown // Legacy field
}

/**
 * Map database row to CIM interface
 * Handles snake_case to camelCase conversion and JSON parsing
 */
export function mapDbRowToCIM(row: CIMDbRow): CIM {
  return {
    id: row.id,
    dealId: row.deal_id,
    title: row.title,
    userId: row.user_id,
    version: row.version,
    workflowState: (row.workflow_state as WorkflowState) ?? createDefaultWorkflowState(),
    buyerPersona: (row.buyer_persona as BuyerPersona) ?? null,
    investmentThesis: row.investment_thesis,
    outline: (row.outline as OutlineSection[]) ?? [],
    slides: (row.slides as Slide[]) ?? [],
    dependencyGraph: (row.dependency_graph as DependencyGraph) ?? createDefaultDependencyGraph(),
    conversationHistory: (row.conversation_history as ConversationMessage[]) ?? [],
    exportFormats: row.export_formats,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Map CIM to database insert format
 */
export function mapCIMToDbInsert(input: CreateCIMInput, dealId: string, userId: string) {
  const workflowState = createDefaultWorkflowState()
  return {
    deal_id: dealId,
    title: input.title,
    user_id: userId,
    workflow_state: workflowState,
    buyer_persona: null,
    investment_thesis: null,
    outline: [],
    slides: [],
    dependency_graph: createDefaultDependencyGraph(),
    conversation_history: [],
  }
}

/**
 * Map UpdateCIMInput to database update format
 */
export function mapCIMToDbUpdate(input: UpdateCIMInput) {
  const update: Record<string, unknown> = {}

  if (input.title !== undefined) update.title = input.title
  if (input.workflowState !== undefined) update.workflow_state = input.workflowState
  if (input.buyerPersona !== undefined) update.buyer_persona = input.buyerPersona
  if (input.investmentThesis !== undefined) update.investment_thesis = input.investmentThesis
  if (input.outline !== undefined) update.outline = input.outline
  if (input.slides !== undefined) update.slides = input.slides
  if (input.dependencyGraph !== undefined) update.dependency_graph = input.dependencyGraph
  if (input.conversationHistory !== undefined)
    update.conversation_history = input.conversationHistory

  return update
}

/**
 * Convert CIM to list item (lighter representation)
 */
export function cimToListItem(cim: CIM): CIMListItem {
  return {
    id: cim.id,
    dealId: cim.dealId,
    title: cim.title,
    workflowState: cim.workflowState,
    slideCount: cim.slides.length,
    createdAt: cim.createdAt,
    updatedAt: cim.updatedAt,
  }
}
