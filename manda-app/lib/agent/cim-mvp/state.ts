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

// Workflow stages for structured CIM creation
export type WorkflowStage =
  | 'welcome'
  | 'buyer_persona'
  | 'hero_concept'
  | 'investment_thesis'
  | 'outline'
  | 'building_sections'
  | 'complete'

// Layout types for slide design
export type LayoutType =
  | 'full'
  | 'title-only'
  | 'title-content'
  | 'split-horizontal'
  | 'split-horizontal-weighted'
  | 'split-vertical'
  | 'quadrant'
  | 'thirds-horizontal'
  | 'thirds-vertical'
  | 'six-grid'
  | 'sidebar-left'
  | 'sidebar-right'
  | 'hero-with-details'
  | 'comparison'
  | 'pyramid'
  | 'hub-spoke'

// Component types for slide content
export type ComponentType =
  // Text components
  | 'title'
  | 'subtitle'
  | 'heading'
  | 'text'
  | 'bullet_list'
  | 'numbered_list'
  | 'quote'
  // Data visualization - Charts
  | 'bar_chart'
  | 'horizontal_bar_chart'
  | 'stacked_bar_chart'
  | 'line_chart'
  | 'area_chart'
  | 'pie_chart'
  | 'waterfall_chart'
  | 'combo_chart'
  | 'scatter_plot'
  // Data visualization - Other
  | 'table'
  | 'comparison_table'
  | 'metric'
  | 'metric_group'
  | 'gauge'
  | 'progress_bar'
  | 'sparkline'
  // Process & Flow
  | 'timeline'
  | 'milestone_timeline'
  | 'flowchart'
  | 'funnel'
  | 'pipeline'
  | 'process_steps'
  | 'cycle'
  | 'gantt_chart'
  // Organizational
  | 'org_chart'
  | 'team_grid'
  | 'hierarchy'
  // Comparison & Analysis
  | 'swot'
  | 'matrix'
  | 'venn'
  | 'versus'
  | 'pros_cons'
  | 'feature_comparison'
  // Geographic
  | 'map'
  | 'location_list'
  // Visual elements
  | 'image'
  | 'image_placeholder'
  | 'logo_grid'
  | 'icon_grid'
  | 'screenshot'
  | 'diagram'
  // Callouts & Highlights
  | 'callout'
  | 'callout_group'
  | 'stat_highlight'
  | 'key_takeaway'
  | 'annotation'
  // Financial specific
  | 'financial_table'
  | 'revenue_breakdown'
  | 'unit_economics'
  | 'growth_trajectory'
  | 'valuation_summary'

// Workflow progress tracking interfaces
export interface SlideProgress {
  slideId: string
  contentApproved: boolean
  visualApproved: boolean
}

export interface SectionProgress {
  sectionId: string
  status: 'pending' | 'content_development' | 'building_slides' | 'complete'
  slides: SlideProgress[]
}

export interface WorkflowProgress {
  currentStage: WorkflowStage
  completedStages: WorkflowStage[]
  currentSectionId?: string
  currentSlideId?: string
  sectionProgress: Record<string, SectionProgress>
}

// Buyer persona for targeting
export interface BuyerPersona {
  type: string
  motivations: string[]
  concerns: string[]
}

// Hero concept and investment thesis
export interface HeroContext {
  selectedHero: string
  investmentThesis: {
    asset: string
    timing: string
    opportunity: string
  }
}

// CIM outline structure
export interface CIMSection {
  id: string
  title: string
  description: string
}

export interface CIMOutline {
  sections: CIMSection[]
}

// Component position for layout placement
export interface ComponentPosition {
  region: 'left' | 'right' | 'top' | 'bottom' | 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'full'
  weight?: number
}

// Component style options
export interface ComponentStyle {
  emphasis?: 'primary' | 'secondary' | 'muted' | 'accent' | 'success' | 'warning' | 'danger'
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  alignment?: 'left' | 'center' | 'right'
}

export interface SlideComponent {
  id: string
  type: ComponentType
  content: string | string[] | Record<string, unknown>
  data?: unknown
  position?: ComponentPosition
  style?: ComponentStyle
  icon?: string
  label?: string
}

export interface SlideUpdate {
  slideId: string
  sectionId: string
  title: string
  layoutType?: LayoutType
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
  knowledgeLoaded: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  knowledgeAttempted: Annotation<boolean>({
    reducer: (_, next) => next,
    default: () => false,
  }),
  companyName: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),
  knowledgePath: Annotation<string>({
    reducer: (_, next) => next,
    default: () => '',
  }),

  // CIM workflow tracking (legacy phase-based)
  currentPhase: Annotation<CIMPhase>({
    reducer: (_, next) => next,
    default: () => 'executive_summary',
  }),
  completedPhases: Annotation<CIMPhase[]>({
    reducer: (_, next) => next,
    default: () => [],
  }),

  // New workflow-based tracking
  workflowProgress: Annotation<WorkflowProgress>({
    reducer: (_, next) => next,
    default: () => ({
      currentStage: 'welcome',
      completedStages: [],
      sectionProgress: {},
    }),
  }),

  // Buyer persona (who we're targeting)
  buyerPersona: Annotation<BuyerPersona | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // Hero concept and investment thesis
  heroContext: Annotation<HeroContext | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

  // CIM outline structure
  cimOutline: Annotation<CIMOutline | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),

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
  pendingSlideUpdate: Annotation<SlideUpdate | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
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
  error: Annotation<string | null>({
    reducer: (_, next) => next,
    default: () => null,
  }),
})

export type CIMMVPStateType = typeof CIMMVPState.State
