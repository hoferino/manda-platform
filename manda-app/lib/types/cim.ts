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
 * Slide status
 */
export const SLIDE_STATUSES = ['draft', 'approved', 'locked'] as const
export type SlideStatus = (typeof SLIDE_STATUSES)[number]

/**
 * Outline section status
 */
export const SECTION_STATUSES = ['pending', 'in_progress', 'complete'] as const
export type SectionStatus = (typeof SECTION_STATUSES)[number]

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
 * A section in the CIM outline
 */
export interface OutlineSection {
  id: string
  title: string
  description: string
  order: number
  status: SectionStatus
  slide_ids: string[]
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
