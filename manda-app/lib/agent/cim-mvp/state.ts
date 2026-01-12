/**
 * CIM MVP Agent State
 *
 * Minimal state schema for the simplified CIM workflow.
 * Uses LangGraph Annotation pattern for type-safe state management.
 *
 * Story: CIM MVP Fast Track
 */

import { Annotation } from '@langchain/langgraph'
import { BaseMessage } from '@langchain/core/messages'

// CIM phases matching the workflow
export type CIMPhase =
  | 'executive_summary'
  | 'company_overview'
  | 'management_team'
  | 'products_services'
  | 'market_opportunity'
  | 'business_model'
  | 'financial_performance'
  | 'competitive_landscape'
  | 'growth_strategy'
  | 'risk_factors'
  | 'appendix'

export interface SlideComponent {
  id: string
  type: 'heading' | 'text' | 'bullet_list' | 'table' | 'chart' | 'metric'
  content: string
  data?: unknown
}

export interface SlideUpdate {
  slideId: string
  sectionId: string
  title: string
  components: SlideComponent[]
  status: 'draft' | 'approved'
}

export interface SourceCitation {
  document: string
  location: string
  findingId?: string
}

/**
 * CIM MVP Agent State using LangGraph Annotation
 */
export const CIMMVPState = Annotation.Root({
  // Conversation messages
  messages: Annotation<BaseMessage[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),

  // Knowledge context (loaded on demand, optional)
  knowledgeLoaded: Annotation<boolean>({ default: () => false }),
  knowledgeAttempted: Annotation<boolean>({ default: () => false }),
  companyName: Annotation<string>({ default: () => '' }),
  knowledgePath: Annotation<string>({ default: () => '' }),

  // CIM workflow tracking
  currentPhase: Annotation<CIMPhase>({ default: () => 'executive_summary' }),
  completedPhases: Annotation<CIMPhase[]>({ default: () => [] }),

  // Slide outputs (for real-time UI updates)
  pendingSlideUpdate: Annotation<SlideUpdate | null>({ default: () => null }),
  allSlideUpdates: Annotation<SlideUpdate[]>({
    reducer: (curr, update) => {
      if (!update || update.length === 0) return curr
      // Merge updates by slideId
      const updateMap = new Map(curr.map((s) => [s.slideId, s]))
      for (const slide of update) {
        updateMap.set(slide.slideId, slide)
      }
      return Array.from(updateMap.values())
    },
    default: () => [],
  }),

  // Sources for attribution
  sourcesUsed: Annotation<SourceCitation[]>({
    reducer: (curr, update) => [...curr, ...update],
    default: () => [],
  }),

  // Error state
  error: Annotation<string | null>({ default: () => null }),
})

export type CIMMVPStateType = typeof CIMMVPState.State
