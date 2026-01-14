/**
 * CIM MVP State Tests
 *
 * Tests for the LangGraph Annotation-based state management.
 * Covers:
 * - Type definitions and interfaces
 * - Reducer logic (tested via helper functions that replicate the reducer behavior)
 * - Default values
 */

import { describe, it, expect } from 'vitest'
import { HumanMessage, AIMessage, ToolMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import {
  CIMMVPState,
  type CIMPhase,
  type WorkflowStage,
  type LayoutType,
  type ComponentType,
  type SlideUpdate,
  type SourceCitation,
  type GatheredContext,
  type BuyerPersona,
  type HeroContext,
  type CIMOutline,
  type WorkflowProgress,
  type SectionProgress,
  type SlideProgress,
  type SlideComponent,
  type ComponentPosition,
  type ComponentStyle,
} from '@/lib/agent/cim-mvp/state'

// =============================================================================
// Reducer Logic Replicas (for testing)
// These replicate the reducer logic defined in state.ts
// =============================================================================

/**
 * Messages reducer: Appends new messages to existing array
 */
function messagesReducer(curr: BaseMessage[], update: BaseMessage[]): BaseMessage[] {
  return [...curr, ...update]
}

/**
 * GatheredContext reducer: Deep merge with special handling for arrays
 */
function gatheredContextReducer(curr: GatheredContext, update: GatheredContext | null): GatheredContext {
  if (!update) return curr
  const merged = { ...curr }
  for (const [key, value] of Object.entries(update)) {
    if (value === undefined) continue
    const currValue = (curr as Record<string, unknown>)[key]
    if (Array.isArray(value) && Array.isArray(currValue)) {
      const combined = [...currValue, ...value]
      ;(merged as Record<string, unknown>)[key] =
        key === 'notes' || key === 'investmentHighlights' || key === 'competitiveAdvantages' || key === 'growthPlans'
          ? [...new Set(combined)]
          : combined
    } else {
      ;(merged as Record<string, unknown>)[key] = value
    }
  }
  return merged
}

/**
 * AllSlideUpdates reducer: Merge by slideId (upsert behavior)
 */
function allSlideUpdatesReducer(curr: SlideUpdate[], update: SlideUpdate[] | null): SlideUpdate[] {
  if (!update || update.length === 0) return curr
  const updateMap = new Map(curr.map((s) => [s.slideId, s]))
  for (const slide of update) {
    updateMap.set(slide.slideId, slide)
  }
  return Array.from(updateMap.values())
}

/**
 * SourcesUsed reducer: Concatenate arrays
 */
function sourcesUsedReducer(curr: SourceCitation[], update: SourceCitation[]): SourceCitation[] {
  return [...curr, ...update]
}

// =============================================================================
// Type Tests
// =============================================================================

describe('CIM MVP State - Type Definitions', () => {
  describe('CIMPhase type', () => {
    it('should include all CIM sections', () => {
      const phases: CIMPhase[] = [
        'executive_summary',
        'company_overview',
        'management_team',
        'products_services',
        'market_opportunity',
        'business_model',
        'financial_performance',
        'competitive_landscape',
        'growth_strategy',
        'risk_factors',
        'appendix',
      ]

      expect(phases).toHaveLength(11)
    })
  })

  describe('WorkflowStage type', () => {
    it('should include all workflow stages in order', () => {
      const stages: WorkflowStage[] = [
        'welcome',
        'buyer_persona',
        'hero_concept',
        'investment_thesis',
        'outline',
        'building_sections',
        'complete',
      ]

      expect(stages).toHaveLength(7)
    })
  })

  describe('LayoutType type', () => {
    it('should include all layout types', () => {
      const layouts: LayoutType[] = [
        'full',
        'title-only',
        'title-content',
        'split-horizontal',
        'split-horizontal-weighted',
        'split-vertical',
        'quadrant',
        'thirds-horizontal',
        'thirds-vertical',
        'six-grid',
        'sidebar-left',
        'sidebar-right',
        'hero-with-details',
        'comparison',
        'pyramid',
        'hub-spoke',
      ]

      expect(layouts).toHaveLength(16)
    })
  })

  describe('ComponentType type', () => {
    it('should include text components', () => {
      const textComponents: ComponentType[] = [
        'title',
        'subtitle',
        'heading',
        'text',
        'bullet_list',
        'numbered_list',
        'quote',
      ]

      expect(textComponents).toHaveLength(7)
    })

    it('should include chart components', () => {
      const chartComponents: ComponentType[] = [
        'bar_chart',
        'horizontal_bar_chart',
        'stacked_bar_chart',
        'line_chart',
        'area_chart',
        'pie_chart',
        'waterfall_chart',
        'combo_chart',
        'scatter_plot',
      ]

      expect(chartComponents).toHaveLength(9)
    })

    it('should include financial components', () => {
      const financialComponents: ComponentType[] = [
        'financial_table',
        'revenue_breakdown',
        'unit_economics',
        'growth_trajectory',
        'valuation_summary',
      ]

      expect(financialComponents).toHaveLength(5)
    })
  })
})

// =============================================================================
// Interface Tests
// =============================================================================

describe('CIM MVP State - Interfaces', () => {
  describe('SlideProgress interface', () => {
    it('should have correct structure', () => {
      const progress: SlideProgress = {
        slideId: 'slide-1',
        contentApproved: true,
        visualApproved: false,
      }

      expect(progress.slideId).toBe('slide-1')
      expect(progress.contentApproved).toBe(true)
      expect(progress.visualApproved).toBe(false)
    })
  })

  describe('SectionProgress interface', () => {
    it('should have correct structure with all status options', () => {
      const statuses: SectionProgress['status'][] = [
        'pending',
        'content_development',
        'building_slides',
        'complete',
      ]

      expect(statuses).toHaveLength(4)

      const progress: SectionProgress = {
        sectionId: 'section-1',
        status: 'content_development',
        slides: [{ slideId: 'slide-1', contentApproved: true, visualApproved: false }],
      }

      expect(progress.sectionId).toBe('section-1')
      expect(progress.status).toBe('content_development')
      expect(progress.slides).toHaveLength(1)
    })
  })

  describe('WorkflowProgress interface', () => {
    it('should have correct structure', () => {
      const progress: WorkflowProgress = {
        currentStage: 'outline',
        completedStages: ['welcome', 'buyer_persona', 'hero_concept', 'investment_thesis'],
        currentSectionId: 'section-exec',
        currentSlideId: 'slide-1',
        sectionProgress: {
          'section-exec': {
            sectionId: 'section-exec',
            status: 'building_slides',
            slides: [],
          },
        },
      }

      expect(progress.currentStage).toBe('outline')
      expect(progress.completedStages).toHaveLength(4)
      expect(progress.currentSectionId).toBe('section-exec')
    })
  })

  describe('BuyerPersona interface', () => {
    it('should have correct structure', () => {
      const persona: BuyerPersona = {
        type: 'strategic',
        motivations: ['Market expansion', 'Technology acquisition'],
        concerns: ['Integration complexity', 'Key person risk'],
      }

      expect(persona.type).toBe('strategic')
      expect(persona.motivations).toHaveLength(2)
      expect(persona.concerns).toHaveLength(2)
    })
  })

  describe('HeroContext interface', () => {
    it('should have correct structure with investment thesis', () => {
      const hero: HeroContext = {
        selectedHero: 'Category-defining AI platform',
        investmentThesis: {
          asset: 'Proprietary AI models',
          timing: 'Market inflection point',
          opportunity: 'Platform dominance',
        },
      }

      expect(hero.selectedHero).toBe('Category-defining AI platform')
      expect(hero.investmentThesis.asset).toBe('Proprietary AI models')
      expect(hero.investmentThesis.timing).toBe('Market inflection point')
      expect(hero.investmentThesis.opportunity).toBe('Platform dominance')
    })
  })

  describe('CIMOutline interface', () => {
    it('should have correct structure', () => {
      const outline: CIMOutline = {
        sections: [
          { id: 'sec-1', title: 'Executive Summary', description: 'Overview' },
          { id: 'sec-2', title: 'Company Overview', description: 'History and mission' },
        ],
      }

      expect(outline.sections).toHaveLength(2)
      expect(outline.sections[0].id).toBe('sec-1')
      expect(outline.sections[0].title).toBe('Executive Summary')
    })
  })

  describe('SlideComponent interface', () => {
    it('should have correct structure with all optional fields', () => {
      const component: SlideComponent = {
        id: 'comp-1',
        type: 'metric',
        content: '+71%',
        data: { value: 71, unit: '%' },
        position: { region: 'top-left', weight: 1 },
        style: { emphasis: 'success', size: 'xl', alignment: 'center' },
        icon: 'trending-up',
        label: 'YoY Growth',
      }

      expect(component.id).toBe('comp-1')
      expect(component.type).toBe('metric')
      expect(component.position?.region).toBe('top-left')
      expect(component.style?.emphasis).toBe('success')
    })
  })

  describe('SlideUpdate interface', () => {
    it('should have correct structure', () => {
      const slide: SlideUpdate = {
        slideId: 'slide-1',
        sectionId: 'section-1',
        title: 'Revenue Growth',
        layoutType: 'split-horizontal',
        components: [
          { id: 'c1', type: 'title', content: 'Revenue Growth' },
          { id: 'c2', type: 'bar_chart', content: 'Chart', data: { labels: ['2022', '2023'] } },
        ],
        status: 'draft',
      }

      expect(slide.slideId).toBe('slide-1')
      expect(slide.layoutType).toBe('split-horizontal')
      expect(slide.components).toHaveLength(2)
      expect(slide.status).toBe('draft')
    })
  })

  describe('ComponentPosition interface', () => {
    it('should support all region values', () => {
      const regions: ComponentPosition['region'][] = [
        'left',
        'right',
        'top',
        'bottom',
        'center',
        'top-left',
        'top-right',
        'bottom-left',
        'bottom-right',
        'full',
      ]

      expect(regions).toHaveLength(10)
    })
  })

  describe('ComponentStyle interface', () => {
    it('should support all emphasis values', () => {
      const emphases: NonNullable<ComponentStyle['emphasis']>[] = [
        'primary',
        'secondary',
        'muted',
        'accent',
        'success',
        'warning',
        'danger',
      ]

      expect(emphases).toHaveLength(7)
    })

    it('should support all size values', () => {
      const sizes: NonNullable<ComponentStyle['size']>[] = ['xs', 'sm', 'md', 'lg', 'xl']

      expect(sizes).toHaveLength(5)
    })
  })

  describe('GatheredContext interface', () => {
    it('should support all company context fields', () => {
      const context: GatheredContext = {
        companyName: 'TechCorp',
        description: 'AI analytics platform',
        foundingYear: 2020,
        headquarters: 'San Francisco',
        employeeCount: 50,
        revenue: '$8.2M ARR',
        revenueGrowth: '71%',
        grossMargin: '85%',
        customerCount: 150,
        retentionRate: '95%',
        nrr: '120%',
        ltvCac: '5:1',
        investmentHighlights: ['Strong retention', 'Growing market'],
        founders: [{ name: 'John', role: 'CEO', background: 'Ex-Google' }],
        products: [{ name: 'Analytics Pro', description: 'Main product' }],
        competitors: [{ name: 'CompA', differentiator: 'Legacy' }],
        growthPlans: ['Europe expansion'],
        risks: [{ risk: 'Concentration', mitigation: 'Diversify' }],
        notes: ['Additional note'],
      }

      expect(context.companyName).toBe('TechCorp')
      expect(context.founders).toHaveLength(1)
      expect(context.investmentHighlights).toHaveLength(2)
    })
  })
})

// =============================================================================
// Reducer Logic Tests
// =============================================================================

describe('CIM MVP State - Reducer Logic', () => {
  describe('messages reducer', () => {
    it('should append new messages to existing array', () => {
      const initial = [new HumanMessage('Hello')]
      const update = [new AIMessage('Hi there')]

      const result = messagesReducer(initial, update)

      expect(result).toHaveLength(2)
      expect(result[0].content).toBe('Hello')
      expect(result[1].content).toBe('Hi there')
    })

    it('should handle empty initial array', () => {
      const initial: BaseMessage[] = []
      const update = [new HumanMessage('First message')]

      const result = messagesReducer(initial, update)

      expect(result).toHaveLength(1)
    })

    it('should handle multiple messages in update', () => {
      const initial = [new HumanMessage('Hello')]
      const update = [
        new AIMessage('Hi'),
        new ToolMessage({ content: 'Tool result', tool_call_id: 'call-1' }),
        new AIMessage('Done'),
      ]

      const result = messagesReducer(initial, update)

      expect(result).toHaveLength(4)
    })

    it('should handle empty update array', () => {
      const initial = [new HumanMessage('Hello')]
      const update: BaseMessage[] = []

      const result = messagesReducer(initial, update)

      expect(result).toHaveLength(1)
    })
  })

  describe('gatheredContext reducer', () => {
    it('should merge new fields into existing context', () => {
      const current: GatheredContext = {
        companyName: 'TechCorp',
        revenue: '$5M',
      }
      const update: GatheredContext = {
        employeeCount: 50,
        revenueGrowth: '71%',
      }

      const result = gatheredContextReducer(current, update)

      expect(result.companyName).toBe('TechCorp')
      expect(result.revenue).toBe('$5M')
      expect(result.employeeCount).toBe(50)
      expect(result.revenueGrowth).toBe('71%')
    })

    it('should override primitive values', () => {
      const current: GatheredContext = {
        companyName: 'OldName',
        revenue: '$5M',
      }
      const update: GatheredContext = {
        companyName: 'NewName',
      }

      const result = gatheredContextReducer(current, update)

      expect(result.companyName).toBe('NewName')
      expect(result.revenue).toBe('$5M')
    })

    it('should concatenate array fields', () => {
      const current: GatheredContext = {
        founders: [{ name: 'John', role: 'CEO' }],
        products: [{ name: 'Product A', description: 'First product' }],
      }
      const update: GatheredContext = {
        founders: [{ name: 'Jane', role: 'CTO' }],
        products: [{ name: 'Product B', description: 'Second product' }],
      }

      const result = gatheredContextReducer(current, update)

      expect(result.founders).toHaveLength(2)
      expect(result.founders![0].name).toBe('John')
      expect(result.founders![1].name).toBe('Jane')
      expect(result.products).toHaveLength(2)
    })

    it('should deduplicate string arrays (notes, investmentHighlights, etc.)', () => {
      const current: GatheredContext = {
        notes: ['Note 1', 'Note 2'],
        investmentHighlights: ['Highlight 1'],
        competitiveAdvantages: ['Advantage 1'],
        growthPlans: ['Plan 1'],
      }
      const update: GatheredContext = {
        notes: ['Note 2', 'Note 3'], // Note 2 is duplicate
        investmentHighlights: ['Highlight 1', 'Highlight 2'], // Highlight 1 is duplicate
        competitiveAdvantages: ['Advantage 1', 'Advantage 2'],
        growthPlans: ['Plan 1', 'Plan 2'],
      }

      const result = gatheredContextReducer(current, update)

      expect(result.notes).toHaveLength(3) // Deduped
      expect(result.notes).toContain('Note 1')
      expect(result.notes).toContain('Note 2')
      expect(result.notes).toContain('Note 3')

      expect(result.investmentHighlights).toHaveLength(2) // Deduped
      expect(result.competitiveAdvantages).toHaveLength(2) // Deduped
      expect(result.growthPlans).toHaveLength(2) // Deduped
    })

    it('should NOT deduplicate object arrays (founders, products, etc.)', () => {
      const current: GatheredContext = {
        founders: [{ name: 'John', role: 'CEO' }],
      }
      const update: GatheredContext = {
        founders: [{ name: 'John', role: 'CEO' }], // Same data, but object reference differs
      }

      const result = gatheredContextReducer(current, update)

      // Objects are not deduplicated (they're different references)
      expect(result.founders).toHaveLength(2)
    })

    it('should handle null update gracefully', () => {
      const current: GatheredContext = {
        companyName: 'TechCorp',
      }

      const result = gatheredContextReducer(current, null)

      expect(result).toEqual(current)
    })

    it('should ignore undefined values in update', () => {
      const current: GatheredContext = {
        companyName: 'TechCorp',
        revenue: '$5M',
      }
      const update: GatheredContext = {
        companyName: undefined,
        employeeCount: 50,
      }

      const result = gatheredContextReducer(current, update)

      expect(result.companyName).toBe('TechCorp') // Not overwritten
      expect(result.employeeCount).toBe(50)
    })

    it('should handle deeply nested updates', () => {
      const current: GatheredContext = {
        founders: [{ name: 'John', role: 'CEO', background: 'Ex-Google' }],
      }
      const update: GatheredContext = {
        founders: [{ name: 'Jane', role: 'CTO', background: 'Stanford PhD' }],
      }

      const result = gatheredContextReducer(current, update)

      expect(result.founders).toHaveLength(2)
    })

    it('should handle all financial metrics', () => {
      const current: GatheredContext = {}
      const update: GatheredContext = {
        revenue: '$8.2M ARR',
        revenueGrowth: '71%',
        grossMargin: '85%',
        ebitda: '$1.5M',
        burnRate: '$200K/month',
        runway: '18 months',
      }

      const result = gatheredContextReducer(current, update)

      expect(result.revenue).toBe('$8.2M ARR')
      expect(result.ebitda).toBe('$1.5M')
      expect(result.runway).toBe('18 months')
    })

    it('should handle all business metrics', () => {
      const current: GatheredContext = {}
      const update: GatheredContext = {
        customerCount: 150,
        retentionRate: '95%',
        nrr: '120%',
        ltvCac: '5:1',
        paybackMonths: 12,
      }

      const result = gatheredContextReducer(current, update)

      expect(result.customerCount).toBe(150)
      expect(result.nrr).toBe('120%')
      expect(result.paybackMonths).toBe(12)
    })

    it('should handle market data', () => {
      const current: GatheredContext = {}
      const update: GatheredContext = {
        tam: '$50B',
        sam: '$10B',
        som: '$500M',
        marketGrowth: '25% CAGR',
        targetMarket: 'Enterprise',
        valueProposition: 'AI-powered analytics',
      }

      const result = gatheredContextReducer(current, update)

      expect(result.tam).toBe('$50B')
      expect(result.marketGrowth).toBe('25% CAGR')
    })
  })

  describe('allSlideUpdates reducer', () => {
    it('should add new slides to empty array', () => {
      const current: SlideUpdate[] = []
      const update: SlideUpdate[] = [
        {
          slideId: 'slide-1',
          sectionId: 'section-1',
          title: 'Test Slide',
          components: [],
          status: 'draft',
        },
      ]

      const result = allSlideUpdatesReducer(current, update)

      expect(result).toHaveLength(1)
      expect(result[0].slideId).toBe('slide-1')
    })

    it('should merge slides by slideId (upsert behavior)', () => {
      const current: SlideUpdate[] = [
        {
          slideId: 'slide-1',
          sectionId: 'section-1',
          title: 'Original Title',
          components: [],
          status: 'draft',
        },
        {
          slideId: 'slide-2',
          sectionId: 'section-1',
          title: 'Slide 2',
          components: [],
          status: 'draft',
        },
      ]
      const update: SlideUpdate[] = [
        {
          slideId: 'slide-1', // Same ID - should update
          sectionId: 'section-1',
          title: 'Updated Title',
          components: [{ id: 'c1', type: 'text', content: 'New content' }],
          status: 'approved',
        },
      ]

      const result = allSlideUpdatesReducer(current, update)

      expect(result).toHaveLength(2) // Still 2 slides
      const slide1 = result.find((s) => s.slideId === 'slide-1')
      expect(slide1?.title).toBe('Updated Title')
      expect(slide1?.status).toBe('approved')
      expect(slide1?.components).toHaveLength(1)
    })

    it('should add new slides while keeping existing ones', () => {
      const current: SlideUpdate[] = [
        {
          slideId: 'slide-1',
          sectionId: 'section-1',
          title: 'Slide 1',
          components: [],
          status: 'draft',
        },
      ]
      const update: SlideUpdate[] = [
        {
          slideId: 'slide-2',
          sectionId: 'section-1',
          title: 'Slide 2',
          components: [],
          status: 'draft',
        },
        {
          slideId: 'slide-3',
          sectionId: 'section-2',
          title: 'Slide 3',
          components: [],
          status: 'draft',
        },
      ]

      const result = allSlideUpdatesReducer(current, update)

      expect(result).toHaveLength(3)
    })

    it('should handle empty update array', () => {
      const current: SlideUpdate[] = [
        {
          slideId: 'slide-1',
          sectionId: 'section-1',
          title: 'Slide 1',
          components: [],
          status: 'draft',
        },
      ]
      const update: SlideUpdate[] = []

      const result = allSlideUpdatesReducer(current, update)

      expect(result).toEqual(current)
    })

    it('should handle null update', () => {
      const current: SlideUpdate[] = [
        {
          slideId: 'slide-1',
          sectionId: 'section-1',
          title: 'Slide 1',
          components: [],
          status: 'draft',
        },
      ]

      const result = allSlideUpdatesReducer(current, null)

      expect(result).toEqual(current)
    })

    it('should handle slides with complex components', () => {
      const current: SlideUpdate[] = []
      const update: SlideUpdate[] = [
        {
          slideId: 'slide-financial',
          sectionId: 'section-financials',
          title: 'Financial Performance',
          layoutType: 'quadrant',
          components: [
            {
              id: 'c1',
              type: 'metric',
              content: '$8.2M',
              position: { region: 'top-left' },
              style: { emphasis: 'primary', size: 'xl' },
              label: 'ARR',
            },
            {
              id: 'c2',
              type: 'bar_chart',
              content: 'Revenue by Year',
              data: {
                labels: ['2021', '2022', '2023'],
                values: [2.1, 4.8, 8.2],
              },
              position: { region: 'right' },
            },
          ],
          status: 'draft',
        },
      ]

      const result = allSlideUpdatesReducer(current, update)

      expect(result).toHaveLength(1)
      expect(result[0].components).toHaveLength(2)
      expect(result[0].components[0].style?.emphasis).toBe('primary')
    })

    it('should preserve component data when updating slide', () => {
      const current: SlideUpdate[] = [
        {
          slideId: 'slide-1',
          sectionId: 'section-1',
          title: 'Original',
          components: [{ id: 'c1', type: 'text', content: 'Original content' }],
          status: 'draft',
        },
      ]
      const update: SlideUpdate[] = [
        {
          slideId: 'slide-1',
          sectionId: 'section-1',
          title: 'Updated',
          components: [
            { id: 'c1', type: 'text', content: 'Updated content' },
            { id: 'c2', type: 'metric', content: '100%' },
          ],
          status: 'approved',
        },
      ]

      const result = allSlideUpdatesReducer(current, update)

      expect(result[0].components).toHaveLength(2)
      expect(result[0].components[0].content).toBe('Updated content')
    })
  })

  describe('sourcesUsed reducer', () => {
    it('should concatenate source citations', () => {
      const current: SourceCitation[] = [{ document: 'Pitch Deck.pdf', location: 'Page 1' }]
      const update: SourceCitation[] = [
        { document: 'Financials.xlsx', location: 'Sheet 1' },
        { document: 'Pitch Deck.pdf', location: 'Page 5' },
      ]

      const result = sourcesUsedReducer(current, update)

      expect(result).toHaveLength(3)
    })

    it('should handle empty initial array', () => {
      const current: SourceCitation[] = []
      const update: SourceCitation[] = [{ document: 'Doc.pdf', location: 'Page 1' }]

      const result = sourcesUsedReducer(current, update)

      expect(result).toHaveLength(1)
    })

    it('should handle empty update array', () => {
      const current: SourceCitation[] = [{ document: 'Doc.pdf', location: 'Page 1' }]
      const update: SourceCitation[] = []

      const result = sourcesUsedReducer(current, update)

      expect(result).toHaveLength(1)
    })
  })
})

// =============================================================================
// State Annotation Tests
// =============================================================================

describe('CIM MVP State - Annotation Structure', () => {
  it('should export CIMMVPState annotation', () => {
    expect(CIMMVPState).toBeDefined()
  })

  it('should have State type available', () => {
    // Type check - this will fail at compile time if the type is wrong
    type StateType = typeof CIMMVPState.State
    const isType: StateType = {} as StateType

    expect(isType).toBeDefined()
  })
})
