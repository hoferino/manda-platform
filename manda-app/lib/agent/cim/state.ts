/**
 * CIM Agent State
 *
 * Defines the state schema for the CIM Builder LangGraph workflow.
 * Story: E9.4 - Agent Orchestration Core
 *
 * Features:
 * - Phase tracking for sequential workflow
 * - Accumulated context (buyer persona, thesis, outline, slides)
 * - Interrupt points for human-in-the-loop
 * - State serialization/deserialization
 */

import { Annotation, MessagesAnnotation } from '@langchain/langgraph'
import { BaseMessage, HumanMessage, AIMessage, SystemMessage } from '@langchain/core/messages'
import {
  CIMPhase,
  CIM_PHASES,
  BuyerPersona,
  OutlineSection,
  Slide,
  DependencyGraph,
  SourceReference,
  createDefaultDependencyGraph,
} from '@/lib/types/cim'

// ============================================================================
// State Types
// ============================================================================

/**
 * Pending approval state for human-in-the-loop
 */
export interface PendingApproval {
  type: 'phase_complete' | 'outline_change' | 'content_approval' | 'visual_approval'
  data: unknown
  requestedAt: string
}

/**
 * CIM Workflow State for LangGraph
 * Extends MessagesAnnotation for conversation history
 */
export const CIMAgentState = Annotation.Root({
  // Include messages from MessagesAnnotation
  ...MessagesAnnotation.spec,

  // ==========================================
  // Workflow Phase Tracking
  // ==========================================

  /** Current workflow phase */
  currentPhase: Annotation<CIMPhase>({
    reducer: (_, next) => next,
    default: () => 'persona',
  }),

  /** Index of current section being worked on (for content creation) */
  currentSectionIndex: Annotation<number | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Index of current slide being worked on */
  currentSlideIndex: Annotation<number | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Phases that have been completed */
  completedPhases: Annotation<CIMPhase[]>({
    reducer: (prev, next) => {
      // Union of existing and new phases
      const combined = new Set([...prev, ...next])
      return Array.from(combined)
    },
    default: () => [],
  }),

  /** Whether the workflow is complete */
  isComplete: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),

  // ==========================================
  // Accumulated Context
  // ==========================================

  /** Buyer persona defined in persona phase */
  buyerPersona: Annotation<BuyerPersona | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Investment thesis co-created in thesis phase */
  investmentThesis: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** CIM outline sections */
  outline: Annotation<OutlineSection[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  /** Generated slides */
  slides: Annotation<Slide[]>({
    reducer: (prev, next) => {
      // Merge slides by ID (allows updating existing slides)
      const slideMap = new Map(prev.map(s => [s.id, s]))
      for (const slide of next) {
        slideMap.set(slide.id, slide)
      }
      return Array.from(slideMap.values())
    },
    default: () => [],
  }),

  /** Dependency tracking between slides */
  dependencyGraph: Annotation<DependencyGraph>({
    reducer: (_, next) => next,
    default: () => createDefaultDependencyGraph(),
  }),

  // ==========================================
  // Human-in-the-Loop
  // ==========================================

  /** Pending user approval (workflow pauses here) */
  pendingApproval: Annotation<PendingApproval | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // ==========================================
  // Metadata
  // ==========================================

  /** CIM ID for database operations */
  cimId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  /** Deal ID for context */
  dealId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  /** User ID */
  userId: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  /** Component reference from click-to-reference */
  componentRef: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Sources referenced in current response */
  sources: Annotation<SourceReference[]>({
    reducer: (prev, next) => {
      // Accumulate unique sources
      const seen = new Set(prev.map(s => `${s.type}:${s.id}`))
      const newSources = next.filter(s => !seen.has(`${s.type}:${s.id}`))
      return [...prev, ...newSources]
    },
    default: () => [],
  }),

  // ==========================================
  // Error Tracking
  // ==========================================

  /** Last error encountered */
  lastError: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  /** Retry count for current operation */
  retryCount: Annotation<number>({
    reducer: (_, next) => next,
    default: () => 0,
  }),
})

/**
 * Type of the CIM Agent State
 */
export type CIMAgentStateType = typeof CIMAgentState.State

// ============================================================================
// State Helpers
// ============================================================================

/**
 * Check if a phase has been completed
 */
export function isPhaseCompleted(state: CIMAgentStateType, phase: CIMPhase): boolean {
  return state.completedPhases.includes(phase)
}

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
 * Calculate workflow progress as a percentage
 */
export function calculateProgress(state: CIMAgentStateType): number {
  if (state.isComplete) {
    return 100
  }
  const totalPhases = CIM_PHASES.length - 1 // Exclude 'complete'
  const completedCount = state.completedPhases.filter(p => p !== 'complete').length
  return Math.round((completedCount / totalPhases) * 100)
}

/**
 * Get a human-readable description of the current phase
 */
export function getPhaseDescription(phase: CIMPhase): string {
  const descriptions: Record<CIMPhase, string> = {
    persona: 'Defining Buyer Persona',
    thesis: 'Creating Investment Thesis',
    outline: 'Building Outline',
    content_creation: 'Creating Content',
    visual_concepts: 'Adding Visual Concepts',
    review: 'Final Review',
    complete: 'Complete',
  }
  return descriptions[phase] || phase
}

// ============================================================================
// Serialization/Deserialization
// ============================================================================

/**
 * Serialized state for database storage
 */
export interface SerializedCIMState {
  currentPhase: CIMPhase
  currentSectionIndex: number | null
  currentSlideIndex: number | null
  completedPhases: CIMPhase[]
  isComplete: boolean
  buyerPersona: BuyerPersona | null
  investmentThesis: string | null
  outline: OutlineSection[]
  slides: Slide[]
  dependencyGraph: DependencyGraph
  pendingApproval: PendingApproval | null
  lastError: string | null
  retryCount: number
}

/**
 * Serialize workflow state for database storage
 * Excludes messages (stored separately) and metadata (provided at runtime)
 */
export function serializeState(state: CIMAgentStateType): SerializedCIMState {
  return {
    currentPhase: state.currentPhase,
    currentSectionIndex: state.currentSectionIndex,
    currentSlideIndex: state.currentSlideIndex,
    completedPhases: state.completedPhases,
    isComplete: state.isComplete,
    buyerPersona: state.buyerPersona,
    investmentThesis: state.investmentThesis,
    outline: state.outline,
    slides: state.slides,
    dependencyGraph: state.dependencyGraph,
    pendingApproval: state.pendingApproval,
    lastError: state.lastError,
    retryCount: state.retryCount,
  }
}

/**
 * Deserialize state from database
 * Creates a partial state that can be used to initialize the workflow
 */
export function deserializeState(
  serialized: SerializedCIMState,
  metadata: {
    cimId: string
    dealId: string
    userId: string
  }
): Partial<CIMAgentStateType> {
  return {
    currentPhase: serialized.currentPhase,
    currentSectionIndex: serialized.currentSectionIndex,
    currentSlideIndex: serialized.currentSlideIndex,
    completedPhases: serialized.completedPhases,
    isComplete: serialized.isComplete,
    buyerPersona: serialized.buyerPersona,
    investmentThesis: serialized.investmentThesis,
    outline: serialized.outline,
    slides: serialized.slides,
    dependencyGraph: serialized.dependencyGraph,
    pendingApproval: serialized.pendingApproval,
    lastError: serialized.lastError,
    retryCount: serialized.retryCount,
    cimId: metadata.cimId,
    dealId: metadata.dealId,
    userId: metadata.userId,
  }
}

/**
 * Convert conversation messages to LangChain format
 */
export function convertToLangChainMessages(
  messages: Array<{ role: string; content: string }>
): BaseMessage[] {
  return messages.map(msg => {
    switch (msg.role) {
      case 'user':
        return new HumanMessage(msg.content)
      case 'assistant':
        return new AIMessage(msg.content)
      case 'system':
        return new SystemMessage(msg.content)
      default:
        return new HumanMessage(msg.content)
    }
  })
}

/**
 * Convert LangChain messages to storage format
 */
export function convertFromLangChainMessages(
  messages: BaseMessage[]
): Array<{ id: string; role: 'user' | 'assistant' | 'system'; content: string; timestamp: string }> {
  return messages.map(msg => {
    let role: 'user' | 'assistant' | 'system' = 'user'
    if (msg._getType() === 'ai') {
      role = 'assistant'
    } else if (msg._getType() === 'system') {
      role = 'system'
    }

    return {
      id: crypto.randomUUID(),
      role,
      content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
      timestamp: new Date().toISOString(),
    }
  })
}

/**
 * Create initial state for a new CIM workflow
 */
export function createInitialState(
  cimId: string,
  dealId: string,
  userId: string
): Partial<CIMAgentStateType> {
  return {
    currentPhase: 'persona',
    currentSectionIndex: null,
    currentSlideIndex: null,
    completedPhases: [],
    isComplete: false,
    buyerPersona: null,
    investmentThesis: null,
    outline: [],
    slides: [],
    dependencyGraph: createDefaultDependencyGraph(),
    pendingApproval: null,
    lastError: null,
    retryCount: 0,
    cimId,
    dealId,
    userId,
    componentRef: null,
    sources: [],
    messages: [],
  }
}
