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
 * Gathered company context - structured information extracted from conversation
 * This accumulates as the user provides information, ensuring the agent
 * remembers what was discussed even across multiple messages.
 */
export interface GatheredContext {
  // Company basics
  companyName?: string
  description?: string
  foundingYear?: number
  headquarters?: string
  employeeCount?: number

  // Financial metrics
  revenue?: string
  revenueGrowth?: string
  grossMargin?: string
  ebitda?: string
  burnRate?: string
  runway?: string

  // Business metrics
  customerCount?: number
  retentionRate?: string
  nrr?: string // Net Revenue Retention
  ltvCac?: string
  paybackMonths?: number

  // Investment highlights (freeform list)
  investmentHighlights?: string[]

  // Management team
  founders?: Array<{ name: string; role: string; background?: string }>
  keyExecutives?: Array<{ name: string; role: string; background?: string }>

  // Products & Services
  products?: Array<{ name: string; description: string }>
  targetMarket?: string
  valueProposition?: string

  // Market
  tam?: string
  sam?: string
  som?: string
  marketGrowth?: string

  // Competitors
  competitors?: Array<{ name: string; differentiator?: string }>
  competitiveAdvantages?: string[]

  // Growth strategy
  growthPlans?: string[]

  // Risks
  risks?: Array<{ risk: string; mitigation?: string }>

  // Raw notes - catch-all for anything else
  notes?: string[]
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

  // Gathered context - accumulated company information from conversation
  // Uses a merge reducer so new info adds to existing, doesn't replace
  gatheredContext: Annotation<GatheredContext>({
    reducer: (curr, update) => {
      if (!update) return curr
      // Deep merge: arrays concatenate, objects merge, primitives override
      const merged = { ...curr }
      for (const [key, value] of Object.entries(update)) {
        if (value === undefined) continue
        const currValue = (curr as Record<string, unknown>)[key]
        if (Array.isArray(value) && Array.isArray(currValue)) {
          // Concatenate arrays, avoiding duplicates for simple strings
          const combined = [...currValue, ...value]
          ;(merged as Record<string, unknown>)[key] = key === 'notes' || key === 'investmentHighlights' || key === 'competitiveAdvantages' || key === 'growthPlans'
            ? [...new Set(combined)]
            : combined
        } else {
          ;(merged as Record<string, unknown>)[key] = value
        }
      }
      return merged
    },
    default: () => ({}),
  }),

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
