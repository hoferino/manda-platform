/**
 * CIM MVP Prompts Tests
 *
 * Tests for system prompts, workflow instructions, and formatting functions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

import {
  getWorkflowStageInstructions,
  formatWorkflowProgress,
  formatBuyerPersona,
  formatHeroContext,
  formatCIMOutline,
  getSystemPrompt,
  getSystemPromptForCaching,
  getPhaseDescription,
  getAllPhases,
} from '@/lib/agent/cim-mvp/prompts'
import type {
  WorkflowStage,
  WorkflowProgress,
  BuyerPersona,
  HeroContext,
  CIMOutline,
  CIMMVPStateType,
  CIMPhase,
} from '@/lib/agent/cim-mvp/state'

// =============================================================================
// Mock knowledge-loader
// =============================================================================

vi.mock('@/lib/agent/cim-mvp/knowledge-loader', () => ({
  getDataSummary: vi.fn().mockReturnValue('Company: Acme Corp\nRevenue: $10M\nGrowth: 50%'),
  getDataGaps: vi.fn().mockReturnValue({
    missing_sections: ['Management Team'],
    recommendations: ['Add executive bios', 'Include org chart'],
  }),
}))

// =============================================================================
// getWorkflowStageInstructions Tests
// =============================================================================

describe('CIM MVP Prompts - getWorkflowStageInstructions', () => {
  const ALL_STAGES: WorkflowStage[] = [
    'welcome',
    'buyer_persona',
    'hero_concept',
    'investment_thesis',
    'outline',
    'building_sections',
    'complete',
  ]

  it('should return instructions for all workflow stages', () => {
    for (const stage of ALL_STAGES) {
      const instructions = getWorkflowStageInstructions(stage)
      expect(instructions).toBeDefined()
      expect(typeof instructions).toBe('string')
      expect(instructions.length).toBeGreaterThan(50)
    }
  })

  describe('welcome stage', () => {
    it('should include greeting and process explanation', () => {
      const instructions = getWorkflowStageInstructions('welcome')
      expect(instructions).toContain('Greet')
      expect(instructions).toContain('knowledge base')
      expect(instructions).toContain('advance_workflow')
    })

    it('should mention the CIM creation process overview', () => {
      const instructions = getWorkflowStageInstructions('welcome')
      // Current prompts mention stages in the context of getting started
      expect(instructions).toContain('Buyer Persona')
      expect(instructions).toContain('Stage 1')
      expect(instructions).toContain('advance_workflow')
    })

    // Story 6: Comprehensive Prompt Review - v3 patterns (updated for current implementation)
    describe('Story 6: Dynamic Welcome', () => {
      it('should have dynamic opening based on knowledge availability', () => {
        const instructions = getWorkflowStageInstructions('welcome')
        expect(instructions).toContain('DYNAMIC OPENING')
        expect(instructions).toContain('If knowledge base IS loaded')
        expect(instructions).toContain('If NO knowledge base')
      })

      it('should build confidence when knowledge is loaded', () => {
        const instructions = getWorkflowStageInstructions('welcome')
        expect(instructions).toContain('What I found')
        expect(instructions).toContain('key highlights')
      })

      it('should explain alternative path when no knowledge', () => {
        const instructions = getWorkflowStageInstructions('welcome')
        expect(instructions).toContain('gather information as we go')
        expect(instructions).toContain('Buyer Persona')
      })
    })
  })

  describe('buyer_persona stage', () => {
    it('should include buyer type questions', () => {
      const instructions = getWorkflowStageInstructions('buyer_persona')
      // Current implementation uses step structure
      expect(instructions).toContain('Confirm Buyer Type')
      expect(instructions).toContain('strategic')
      expect(instructions).toContain('pe')
    })

    it('should mention save_buyer_persona tool', () => {
      const instructions = getWorkflowStageInstructions('buyer_persona')
      expect(instructions).toContain('save_buyer_persona')
    })

    // Story 6: Comprehensive Prompt Review - updated for current implementation
    describe('Story 6: v3 Prompt Patterns', () => {
      it('should explain goal of this stage', () => {
        const instructions = getWorkflowStageInstructions('buyer_persona')
        expect(instructions).toContain('**Goal:**')
        expect(instructions).toContain('Understand who will be reading')
        expect(instructions).toContain('tailor')
      })

      it('should use step-by-step approach (one topic at a time)', () => {
        const instructions = getWorkflowStageInstructions('buyer_persona')
        expect(instructions).toContain('Step 1: Confirm Buyer Type')
        expect(instructions).toContain('Step 2: Suggest Motivations')
        expect(instructions).toContain('Step 3: Suggest Concerns')
      })

      it('should present numbered options', () => {
        const instructions = getWorkflowStageInstructions('buyer_persona')
        expect(instructions).toContain('numbered options')
        expect(instructions).toContain('(pick 2-3)')
      })

      it('should describe when to save', () => {
        const instructions = getWorkflowStageInstructions('buyer_persona')
        expect(instructions).toContain('When to Save')
        expect(instructions).toContain('Confirm briefly')
      })
    })
  })

  describe('hero_concept stage', () => {
    it('should emphasize data requirement', () => {
      const instructions = getWorkflowStageInstructions('hero_concept')
      expect(instructions).toContain('CRITICAL')
      expect(instructions).toContain('DATA REQUIRED')
      expect(instructions).toContain('CANNOT suggest hero concepts without')
    })

    it('should include example hero concepts', () => {
      const instructions = getWorkflowStageInstructions('hero_concept')
      expect(instructions).toContain('Category Creator')
      expect(instructions).toContain('Growth Machine')
      expect(instructions).toContain('Platform Play')
      expect(instructions).toContain('Market Leader')
    })

    it('should mention save_hero_concept tool', () => {
      const instructions = getWorkflowStageInstructions('hero_concept')
      expect(instructions).toContain('save_hero_concept')
    })

    // Story 6: Comprehensive Prompt Review - updated for current implementation
    describe('Story 6: v3 Prompt Patterns', () => {
      it('should explain goal of this stage', () => {
        const instructions = getWorkflowStageInstructions('hero_concept')
        expect(instructions).toContain('**Goal:**')
        expect(instructions).toContain('story hook')
        expect(instructions).toContain('first impression')
      })

      it('should present 3 options with equal depth', () => {
        const instructions = getWorkflowStageInstructions('hero_concept')
        expect(instructions).toContain('Option A')
        expect(instructions).toContain('Option B')
        expect(instructions).toContain('Option C')
        // Current implementation has hook and data points
        expect(instructions).toContain('hook')
        expect(instructions).toContain('data points')
      })

      it('should connect to buyer context', () => {
        const instructions = getWorkflowStageInstructions('hero_concept')
        expect(instructions).toContain('buyer')
        expect(instructions).toContain('motivations')
      })

      it('should confirm choice', () => {
        const instructions = getWorkflowStageInstructions('hero_concept')
        expect(instructions).toContain('When User Chooses')
        expect(instructions).toContain('will resonate')
      })
    })
  })

  describe('investment_thesis stage', () => {
    it('should include 3-part thesis structure', () => {
      const instructions = getWorkflowStageInstructions('investment_thesis')
      expect(instructions).toContain('THE ASSET')
      expect(instructions).toContain('THE TIMING')
      expect(instructions).toContain('THE OPPORTUNITY')
    })

    it('should emphasize data grounding', () => {
      const instructions = getWorkflowStageInstructions('investment_thesis')
      expect(instructions).toContain('Data-backed')
      expect(instructions).toContain('why should this buyer')
    })

    // Story 6: Comprehensive Prompt Review - updated for current implementation
    describe('Story 6: v3 Prompt Patterns', () => {
      it('should explain goal of this stage', () => {
        const instructions = getWorkflowStageInstructions('investment_thesis')
        expect(instructions).toContain('**Goal:**')
        expect(instructions).toContain('3-part')
        expect(instructions).toContain('investment committee')
      })

      it('should tailor to buyer type', () => {
        const instructions = getWorkflowStageInstructions('investment_thesis')
        expect(instructions).toContain('Tailor to Buyer Type')
        expect(instructions).toContain('PE buyer')
        expect(instructions).toContain('Strategic buyer')
      })

      it('should have process for iteration', () => {
        const instructions = getWorkflowStageInstructions('investment_thesis')
        expect(instructions).toContain('Iterate based on feedback')
        expect(instructions).toContain('Confirm before saving')
      })

      it('should describe approval flow', () => {
        const instructions = getWorkflowStageInstructions('investment_thesis')
        expect(instructions).toContain('When Approved')
        expect(instructions).toContain('Thesis locked in')
      })
    })
  })

  describe('outline stage', () => {
    it('should list typical CIM sections', () => {
      const instructions = getWorkflowStageInstructions('outline')
      expect(instructions).toContain('Executive Summary')
      expect(instructions).toContain('Company Overview')
      expect(instructions).toContain('Financial Performance')
      expect(instructions).toContain('Growth Strategy')
    })

    it('should mention create_outline tool', () => {
      const instructions = getWorkflowStageInstructions('outline')
      expect(instructions).toContain('create_outline')
    })

    // Story 1: Fix Outline Stage HITL Flow - updated for current implementation
    describe('Story 1: Outline HITL Flow', () => {
      it('AC: should require HITL checkpoint before create_outline', () => {
        const instructions = getWorkflowStageInstructions('outline')
        expect(instructions).toContain('HITL REQUIRED')
        expect(instructions).toContain('user approval')
        expect(instructions).toContain('BEFORE')
      })

      it('AC: should present proposed outline structure before saving', () => {
        const instructions = getWorkflowStageInstructions('outline')
        expect(instructions).toContain('Propose Structure')
        expect(instructions).toContain('Sections')
        expect(instructions).toContain('purpose')
      })

      it('AC: should wait for explicit user approval', () => {
        const instructions = getWorkflowStageInstructions('outline')
        expect(instructions).toContain('Wait for Approval')
        expect(instructions).toContain('after explicit approval')
        expect(instructions).toContain('looks good')
      })

      it('AC: should only call create_outline after approval', () => {
        const instructions = getWorkflowStageInstructions('outline')
        expect(instructions).toContain('Only call create_outline after')
        expect(instructions).toContain('approval')
      })

      it('AC: should ask which section first after outline saved', () => {
        const instructions = getWorkflowStageInstructions('outline')
        expect(instructions).toContain('Ask Which Section First')
        expect(instructions).toContain('After saving')
        expect(instructions).toContain('Which section')
      })

      it('AC: should NOT auto-assume section order', () => {
        const instructions = getWorkflowStageInstructions('outline')
        expect(instructions).toContain('Don\'t assume')
        expect(instructions).toContain('Let them choose')
      })

      it('AC: exit criteria requires both outline created AND section choice', () => {
        const instructions = getWorkflowStageInstructions('outline')
        expect(instructions).toContain('Outline created')
        expect(instructions).toContain('user chose')
        expect(instructions).toContain('Do NOT advance until BOTH')
      })
    })
  })

  describe('building_sections stage', () => {
    it('should describe section workflow', () => {
      const instructions = getWorkflowStageInstructions('building_sections')
      expect(instructions).toContain('start_section')
      expect(instructions).toContain('update_slide')
    })

    it('should mention all relevant tools', () => {
      const instructions = getWorkflowStageInstructions('building_sections')
      expect(instructions).toContain('start_section')
      expect(instructions).toContain('knowledge_search')
      expect(instructions).toContain('update_slide')
    })

    // Story 2: Building Sections HITL Flow - updated for current implementation
    describe('Story 2: Building Sections HITL Flow', () => {
      it('AC: should have section workflow', () => {
        const instructions = getWorkflowStageInstructions('building_sections')
        expect(instructions).toContain('SECTION WORKFLOW')
        expect(instructions).toContain('Plan the Section')
      })

      it('AC: Step 1 - should plan section structure', () => {
        const instructions = getWorkflowStageInstructions('building_sections')
        expect(instructions).toContain('Step 1: Plan the Section')
        expect(instructions).toContain('Section Message')
        expect(instructions).toContain('Key Data Points')
        expect(instructions).toContain('Action title')
      })

      it('AC: Step 2 - should build each slide', () => {
        const instructions = getWorkflowStageInstructions('building_sections')
        expect(instructions).toContain('Step 2: Build Each Slide')
        expect(instructions).toContain('Option A')
        expect(instructions).toContain('Option B')
      })

      it('AC: Step 3 - should confirm content', () => {
        const instructions = getWorkflowStageInstructions('building_sections')
        expect(instructions).toContain('Step 3: Confirm Content')
        expect(instructions).toContain('Good to proceed to visual')
      })

      it('AC: Step 4 - should propose visual', () => {
        const instructions = getWorkflowStageInstructions('building_sections')
        expect(instructions).toContain('Step 4: Propose Visual')
        expect(instructions).toContain('Chart type')
      })

      it('AC: Step 5 - should save and move to next', () => {
        const instructions = getWorkflowStageInstructions('building_sections')
        expect(instructions).toContain('Step 5: Save & Next')
        expect(instructions).toContain('update_slide')
      })

      it('AC: should have action title rules', () => {
        const instructions = getWorkflowStageInstructions('building_sections')
        expect(instructions).toContain('Action Titles')
        expect(instructions).toContain('MANDATORY')
        expect(instructions).toContain('key takeaway')
      })

      it('AC: should build slides one at a time', () => {
        const instructions = getWorkflowStageInstructions('building_sections')
        expect(instructions).toContain('One slide at a time')
      })
    })
  })

  describe('complete stage', () => {
    it('should include completion messaging', () => {
      const instructions = getWorkflowStageInstructions('complete')
      expect(instructions).toContain('complete')
      expect(instructions).toContain('Congratulate')
    })

    it('should mention review option', () => {
      const instructions = getWorkflowStageInstructions('complete')
      expect(instructions).toContain('review')
      expect(instructions).toContain('revise')
    })
  })
})

// =============================================================================
// formatWorkflowProgress Tests
// =============================================================================

describe('CIM MVP Prompts - formatWorkflowProgress', () => {
  it('should format all stages with correct status icons', () => {
    const progress: WorkflowProgress = {
      currentStage: 'hero_concept',
      completedStages: ['welcome', 'buyer_persona'],
      sectionProgress: {},
    }

    const formatted = formatWorkflowProgress(progress)

    // Completed stages should have ✅
    expect(formatted).toContain('✅ Welcome & Setup')
    expect(formatted).toContain('✅ Buyer Persona')

    // Current stage should have 👉 and (current)
    expect(formatted).toContain('👉 **Hero Concept** (current)')

    // Future stages should have ⬜
    expect(formatted).toContain('⬜ Investment Thesis')
    expect(formatted).toContain('⬜ Outline')
  })

  it('should show all stages in correct order', () => {
    const progress: WorkflowProgress = {
      currentStage: 'welcome',
      completedStages: [],
      sectionProgress: {},
    }

    const formatted = formatWorkflowProgress(progress)
    const lines = formatted.split('\n')

    // Check order of stages
    const stageLabels = [
      'Welcome & Setup',
      'Buyer Persona',
      'Hero Concept',
      'Investment Thesis',
      'Outline',
      'Building Sections',
      'Complete',
    ]

    for (let i = 0; i < stageLabels.length; i++) {
      expect(lines.some((line) => line.includes(stageLabels[i]!))).toBe(true)
    }
  })

  it('should include section progress when in building_sections stage', () => {
    const progress: WorkflowProgress = {
      currentStage: 'building_sections',
      completedStages: ['welcome', 'buyer_persona', 'hero_concept', 'investment_thesis', 'outline'],
      sectionProgress: {
        'exec-summary': {
          sectionId: 'exec-summary',
          status: 'complete',
          slides: [
            { slideId: 's1', contentApproved: true, visualApproved: true },
            { slideId: 's2', contentApproved: true, visualApproved: true },
          ],
        },
        'company-overview': {
          sectionId: 'company-overview',
          status: 'building_slides',
          slides: [
            { slideId: 's3', contentApproved: true, visualApproved: false },
          ],
        },
        'financials': {
          sectionId: 'financials',
          status: 'pending',
          slides: [],
        },
      },
    }

    const formatted = formatWorkflowProgress(progress)

    expect(formatted).toContain('**Section Progress:**')
    expect(formatted).toContain('✅ exec-summary: complete')
    expect(formatted).toContain('🔨 company-overview: building slides')
    expect(formatted).toContain('⬜ financials: pending')
    expect(formatted).toContain('2/2 slides approved')
    expect(formatted).toContain('0/1 slides approved')
  })

  it('should show current section when in building_sections', () => {
    const progress: WorkflowProgress = {
      currentStage: 'building_sections',
      completedStages: [],
      sectionProgress: {},
      currentSectionId: 'exec-summary',
    }

    const formatted = formatWorkflowProgress(progress)

    expect(formatted).toContain('**Currently working on:** exec-summary')
  })

  it('should handle content_development status', () => {
    const progress: WorkflowProgress = {
      currentStage: 'building_sections',
      completedStages: [],
      sectionProgress: {
        'market': {
          sectionId: 'market',
          status: 'content_development',
          slides: [],
        },
      },
    }

    const formatted = formatWorkflowProgress(progress)

    expect(formatted).toContain('📝 market: content development')
  })
})

// =============================================================================
// formatBuyerPersona Tests
// =============================================================================

describe('CIM MVP Prompts - formatBuyerPersona', () => {
  it('should return default message when persona is null', () => {
    const formatted = formatBuyerPersona(null)
    expect(formatted).toBe('Not yet defined.')
  })

  it('should format complete buyer persona', () => {
    const persona: BuyerPersona = {
      type: 'strategic',
      motivations: ['Market expansion', 'Technology acquisition'],
      concerns: ['Integration risk', 'Customer concentration'],
    }

    const formatted = formatBuyerPersona(persona)

    expect(formatted).toContain('**Type:** strategic')
    expect(formatted).toContain('**Motivations:**')
    expect(formatted).toContain('- Market expansion')
    expect(formatted).toContain('- Technology acquisition')
    expect(formatted).toContain('**Concerns to address:**')
    expect(formatted).toContain('- Integration risk')
    expect(formatted).toContain('- Customer concentration')
  })

  it('should handle empty arrays', () => {
    const persona: BuyerPersona = {
      type: 'financial',
      motivations: [],
      concerns: [],
    }

    const formatted = formatBuyerPersona(persona)

    expect(formatted).toContain('**Type:** financial')
    expect(formatted).toContain('**Motivations:**')
    expect(formatted).toContain('**Concerns to address:**')
  })
})

// =============================================================================
// formatHeroContext Tests
// =============================================================================

describe('CIM MVP Prompts - formatHeroContext', () => {
  it('should return default message when hero is null', () => {
    const formatted = formatHeroContext(null)
    expect(formatted).toBe('Not yet defined.')
  })

  it('should format complete hero context', () => {
    const hero: HeroContext = {
      selectedHero: 'The Growth Machine',
      investmentThesis: {
        asset: 'Proven SaaS platform with 120% NRR',
        timing: 'Market consolidation creating acquisition opportunity',
        opportunity: '$50M revenue synergy potential',
      },
    }

    const formatted = formatHeroContext(hero)

    expect(formatted).toContain('**Hero Concept:** The Growth Machine')
    expect(formatted).toContain('**Investment Thesis:**')
    expect(formatted).toContain('**The Asset:** Proven SaaS platform with 120% NRR')
    expect(formatted).toContain('**The Timing:** Market consolidation creating acquisition opportunity')
    expect(formatted).toContain('**The Opportunity:** $50M revenue synergy potential')
  })
})

// =============================================================================
// formatCIMOutline Tests
// =============================================================================

describe('CIM MVP Prompts - formatCIMOutline', () => {
  it('should return default message when outline is null', () => {
    const formatted = formatCIMOutline(null)
    expect(formatted).toBe('Not yet created.')
  })

  it('should return default message when sections array is empty', () => {
    const outline: CIMOutline = { sections: [] }
    const formatted = formatCIMOutline(outline)
    expect(formatted).toBe('Not yet created.')
  })

  it('should format outline with numbered sections', () => {
    const outline: CIMOutline = {
      sections: [
        { id: 'exec', title: 'Executive Summary', description: 'Key highlights' },
        { id: 'company', title: 'Company Overview', description: 'History and background' },
        { id: 'financials', title: 'Financial Performance', description: 'Revenue and growth' },
      ],
    }

    const formatted = formatCIMOutline(outline)

    expect(formatted).toContain('1. **Executive Summary** - Key highlights')
    expect(formatted).toContain('2. **Company Overview** - History and background')
    expect(formatted).toContain('3. **Financial Performance** - Revenue and growth')
  })
})

// =============================================================================
// getSystemPrompt Tests
// =============================================================================

describe('CIM MVP Prompts - getSystemPrompt', () => {
  describe('basic structure', () => {
    it('should include role description', () => {
      const state = {
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('M&A advisor')
      expect(prompt).toContain('Confidential Information Memorandum')
    })

    it('should include workflow progress section', () => {
      const state = {
        workflowProgress: {
          currentStage: 'buyer_persona' as WorkflowStage,
          completedStages: ['welcome'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Workflow Progress')
      expect(prompt).toContain('✅ Welcome & Setup')
      expect(prompt).toContain('👉 **Buyer Persona** (current)')
    })

    it('should include current stage instructions', () => {
      const state = {
        workflowProgress: {
          currentStage: 'hero_concept' as WorkflowStage,
          completedStages: ['welcome', 'buyer_persona'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Current Stage: HERO CONCEPT')
      expect(prompt).toContain('CRITICAL')
      expect(prompt).toContain('DATA REQUIRED')
    })

    it('should include tools section', () => {
      const state = {
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Tools Available')
      expect(prompt).toContain('### Workflow Tools')
      expect(prompt).toContain('### Content Tools')
      expect(prompt).toContain('### Research Tools')
    })

    // Story 3: Stage Navigation Tool - Prompt Tests
    it('should include navigate_to_stage in workflow tools', () => {
      const state = {
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('navigate_to_stage')
      expect(prompt).toContain('Go back to a previous stage')
    })

    it('should include Stage Navigation guidance section', () => {
      const state = {
        workflowProgress: {
          currentStage: 'building_sections' as WorkflowStage,
          completedStages: ['welcome', 'buyer_persona', 'hero_concept', 'investment_thesis', 'outline'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Stage Navigation')
      expect(prompt).toContain('Going Back')
      expect(prompt).toContain('Acknowledge the cascade')
      expect(prompt).toContain('Preserve their work')
    })

    it('should include critical rules', () => {
      const state = {
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## CRITICAL RULES')
      expect(prompt).toContain('NEVER HALLUCINATE')
      expect(prompt).toContain('ALWAYS Use Tools')
      expect(prompt).toContain('Follow the Workflow')
    })
  })

  describe('company name handling', () => {
    it('should include company name when provided', () => {
      const state = {
        companyName: 'Acme Corporation',
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('for Acme Corporation')
    })

    it('should not include company name when not provided', () => {
      const state = {
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      // The first line should not have a company name
      const firstLine = prompt.split('\n')[0]
      expect(firstLine).not.toMatch(/for [A-Z]/) // No "for CompanyName" pattern
      expect(firstLine).toContain('CIM')
    })
  })

  describe('knowledge base handling', () => {
    it('should show knowledge base summary when loaded', () => {
      const state = {
        knowledgeLoaded: true,
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Knowledge Base Summary')
      expect(prompt).toContain('Company: Acme Corp')
      expect(prompt).toContain('Revenue: $10M')
    })

    it('should show data gaps when knowledge loaded', () => {
      const state = {
        knowledgeLoaded: true,
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Data Gaps Identified')
      expect(prompt).toContain('Management Team')
    })

    it('should show warning when knowledge not loaded', () => {
      const state = {
        knowledgeLoaded: false,
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## No Knowledge Base Loaded')
      expect(prompt).toContain('IMPORTANT')
      expect(prompt).toContain('No company documents have been analyzed')
      expect(prompt).toContain('ZERO company knowledge')
    })
  })

  describe('buyer persona section', () => {
    it('should show buyer persona when defined', () => {
      const state = {
        buyerPersona: {
          type: 'strategic',
          motivations: ['Growth', 'Synergies'],
          concerns: ['Risk'],
        },
        workflowProgress: {
          currentStage: 'hero_concept' as WorkflowStage,
          completedStages: ['welcome', 'buyer_persona'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Buyer Persona')
      expect(prompt).toContain('**Type:** strategic')
      expect(prompt).toContain('- Growth')
    })

    it('should show default when buyer persona not defined', () => {
      const state = {
        workflowProgress: {
          currentStage: 'buyer_persona' as WorkflowStage,
          completedStages: ['welcome'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Buyer Persona')
      expect(prompt).toContain('Not yet defined.')
    })
  })

  describe('hero context section', () => {
    it('should show hero context when defined', () => {
      const state = {
        heroContext: {
          selectedHero: 'The Platform Play',
          investmentThesis: {
            asset: 'Extensible platform',
            timing: 'Market consolidation',
            opportunity: 'Network effects',
          },
        },
        workflowProgress: {
          currentStage: 'investment_thesis' as WorkflowStage,
          completedStages: ['welcome', 'buyer_persona', 'hero_concept'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Hero Concept & Investment Thesis')
      expect(prompt).toContain('**Hero Concept:** The Platform Play')
      expect(prompt).toContain('**The Asset:** Extensible platform')
    })
  })

  describe('outline section', () => {
    it('should show outline when defined', () => {
      const state = {
        cimOutline: {
          sections: [
            { id: 'exec', title: 'Executive Summary', description: 'Overview' },
            { id: 'company', title: 'Company Overview', description: 'History' },
          ],
        },
        workflowProgress: {
          currentStage: 'building_sections' as WorkflowStage,
          completedStages: ['welcome', 'buyer_persona', 'hero_concept', 'investment_thesis', 'outline'] as WorkflowStage[],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## CIM Outline')
      expect(prompt).toContain('1. **Executive Summary** - Overview')
      expect(prompt).toContain('2. **Company Overview** - History')
    })
  })

  describe('gathered context section', () => {
    it('should show gathered context when provided', () => {
      const state = {
        gatheredContext: {
          companyName: 'TechCorp',
          revenue: '$15M',
          revenueGrowth: '80%',
          customerCount: '500',
          investmentHighlights: ['Market leader', 'Strong retention'],
        },
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Information Gathered So Far')
      expect(prompt).toContain('Company: TechCorp')
      expect(prompt).toContain('Revenue: $15M')
      expect(prompt).toContain('Growth: 80%')
      expect(prompt).toContain('Customers: 500')
      expect(prompt).toContain('**Investment Highlights:**')
      expect(prompt).toContain('- Market leader')
    })

    it('should show default when no context gathered', () => {
      const state = {
        gatheredContext: {},
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('No information gathered yet.')
    })
  })

  describe('gathered context - comprehensive fields', () => {
    it('should format financial metrics', () => {
      const state = {
        gatheredContext: {
          revenue: '$10M',
          revenueGrowth: '50%',
          grossMargin: '70%',
          ebitda: '$2M',
          burnRate: '$100K/mo',
          runway: '18 months',
        },
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('**Financials:**')
      expect(prompt).toContain('Revenue: $10M')
      expect(prompt).toContain('Growth: 50%')
      expect(prompt).toContain('Gross Margin: 70%')
      expect(prompt).toContain('EBITDA: $2M')
      expect(prompt).toContain('Burn Rate: $100K/mo')
      expect(prompt).toContain('Runway: 18 months')
    })

    it('should format business metrics', () => {
      const state = {
        gatheredContext: {
          customerCount: '1000',
          retentionRate: '95%',
          nrr: '120%',
          ltvCac: '4.5x',
          paybackMonths: 12,
        },
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('**Business Metrics:**')
      expect(prompt).toContain('Customers: 1000')
      expect(prompt).toContain('Retention: 95%')
      expect(prompt).toContain('NRR: 120%')
      expect(prompt).toContain('LTV/CAC: 4.5x')
      expect(prompt).toContain('Payback: 12 months')
    })

    it('should format team information', () => {
      const state = {
        gatheredContext: {
          founders: [
            { name: 'Jane Doe', role: 'CEO', background: 'Ex-Google' },
            { name: 'John Smith', role: 'CTO' },
          ],
          keyExecutives: [
            { name: 'Alice Brown', role: 'CFO', background: 'Ex-Amazon' },
          ],
        },
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('**Founders:**')
      expect(prompt).toContain('- Jane Doe (CEO): Ex-Google')
      expect(prompt).toContain('- John Smith (CTO)')
      expect(prompt).toContain('**Key Executives:**')
      expect(prompt).toContain('- Alice Brown (CFO): Ex-Amazon')
    })

    it('should format products and market', () => {
      const state = {
        gatheredContext: {
          products: [
            { name: 'Product A', description: 'Main product' },
            { name: 'Product B', description: 'Secondary product' },
          ],
          targetMarket: 'Enterprise B2B',
          valueProposition: 'Save time and money',
          tam: '$50B',
          sam: '$10B',
          som: '$1B',
          marketGrowth: '25% CAGR',
        },
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('**Products/Services:**')
      expect(prompt).toContain('- Product A: Main product')
      expect(prompt).toContain('**Target Market:** Enterprise B2B')
      expect(prompt).toContain('**Value Proposition:** Save time and money')
      expect(prompt).toContain('**Market:**')
      expect(prompt).toContain('TAM: $50B')
      expect(prompt).toContain('SAM: $10B')
      expect(prompt).toContain('SOM: $1B')
      expect(prompt).toContain('Growth: 25% CAGR')
    })

    it('should format competition', () => {
      const state = {
        gatheredContext: {
          competitors: [
            { name: 'Competitor A', differentiator: 'Larger market share' },
            { name: 'Competitor B' },
          ],
          competitiveAdvantages: ['Better technology', 'Lower price'],
        },
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('**Competitors:**')
      expect(prompt).toContain('- Competitor A: Larger market share')
      expect(prompt).toContain('- Competitor B')
      expect(prompt).toContain('**Competitive Advantages:**')
      expect(prompt).toContain('- Better technology')
      expect(prompt).toContain('- Lower price')
    })

    it('should format growth and risks', () => {
      const state = {
        gatheredContext: {
          growthPlans: ['Expand to Europe', 'Launch new product'],
          risks: [
            { risk: 'Market competition', mitigation: 'Strong differentiation' },
            { risk: 'Key person risk' },
          ],
          notes: ['Call scheduled for Monday', 'Waiting on Q4 numbers'],
        },
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('**Growth Plans:**')
      expect(prompt).toContain('- Expand to Europe')
      expect(prompt).toContain('**Risks:**')
      expect(prompt).toContain('- Market competition (Mitigation: Strong differentiation)')
      expect(prompt).toContain('- Key person risk')
      expect(prompt).toContain('**Notes:**')
      expect(prompt).toContain('- Call scheduled for Monday')
    })
  })

  describe('detour handling section', () => {
    it('should include detour handling instructions', () => {
      const state = {
        workflowProgress: {
          currentStage: 'welcome' as WorkflowStage,
          completedStages: [],
          sectionProgress: {},
        },
      } as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toContain('## Handling Detours')
      expect(prompt).toContain('unrelated to the current workflow stage')
      expect(prompt).toContain('save_context')
    })
  })

  describe('default state handling', () => {
    it('should handle completely empty state', () => {
      const state = {} as unknown as CIMMVPStateType

      const prompt = getSystemPrompt(state)

      expect(prompt).toBeDefined()
      expect(prompt).toContain('M&A advisor')
      expect(prompt).toContain('## Current Stage: WELCOME')
    })
  })
})

// =============================================================================
// Story 5: Prompt Caching Tests
// =============================================================================

describe('CIM MVP Prompts - getSystemPromptForCaching (Story 5)', () => {
  it('should return both static and dynamic prompt portions', () => {
    const state = {
      workflowProgress: {
        currentStage: 'welcome' as WorkflowStage,
        completedStages: [],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { staticPrompt, dynamicPrompt } = getSystemPromptForCaching(state)

    expect(staticPrompt).toBeDefined()
    expect(dynamicPrompt).toBeDefined()
    expect(typeof staticPrompt).toBe('string')
    expect(typeof dynamicPrompt).toBe('string')
  })

  it('static prompt should contain tools and rules (cacheable content)', () => {
    const state = {
      workflowProgress: {
        currentStage: 'welcome' as WorkflowStage,
        completedStages: [],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { staticPrompt } = getSystemPromptForCaching(state)

    // Static prompt should have tools
    expect(staticPrompt).toContain('## Tools Available')
    expect(staticPrompt).toContain('advance_workflow')
    expect(staticPrompt).toContain('save_buyer_persona')
    expect(staticPrompt).toContain('update_slide')
    expect(staticPrompt).toContain('knowledge_search')

    // Static prompt should have rules
    expect(staticPrompt).toContain('## CRITICAL RULES')
    expect(staticPrompt).toContain('Rule 0: NEVER HALLUCINATE')
    expect(staticPrompt).toContain('Rule 1: ALWAYS Use Tools')

    // Static prompt should have response style
    expect(staticPrompt).toContain('## Response Style')
  })

  it('static prompt should NOT contain state-specific content', () => {
    const state = {
      companyName: 'TechCorp',
      knowledgeLoaded: true,
      buyerPersona: {
        type: 'strategic',
        motivations: ['Growth'],
        concerns: ['Risk'],
      },
      workflowProgress: {
        currentStage: 'hero_concept' as WorkflowStage,
        completedStages: ['welcome', 'buyer_persona'] as WorkflowStage[],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { staticPrompt } = getSystemPromptForCaching(state)

    // Static prompt should NOT have company-specific content
    expect(staticPrompt).not.toContain('TechCorp')
    expect(staticPrompt).not.toContain('## Workflow Progress')
    expect(staticPrompt).not.toContain('## Current Stage:')
    expect(staticPrompt).not.toContain('## Buyer Persona')
  })

  it('dynamic prompt should contain state-specific content', () => {
    const state = {
      companyName: 'TechCorp',
      knowledgeLoaded: false,
      buyerPersona: {
        type: 'strategic',
        motivations: ['Growth', 'Synergies'],
        concerns: ['Integration risk'],
      },
      heroContext: {
        selectedHero: 'The Growth Machine',
        investmentThesis: {
          asset: 'Strong tech',
          timing: 'Now',
          opportunity: 'Big market',
        },
      },
      workflowProgress: {
        currentStage: 'investment_thesis' as WorkflowStage,
        completedStages: ['welcome', 'buyer_persona', 'hero_concept'] as WorkflowStage[],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { dynamicPrompt } = getSystemPromptForCaching(state)

    // Dynamic prompt should have company context
    expect(dynamicPrompt).toContain('TechCorp')

    // Dynamic prompt should have workflow progress
    expect(dynamicPrompt).toContain('## Workflow Progress')
    expect(dynamicPrompt).toContain('✅ Welcome')
    expect(dynamicPrompt).toContain('✅ Buyer Persona')

    // Dynamic prompt should have current stage
    expect(dynamicPrompt).toContain('## Current Stage: INVESTMENT THESIS')

    // Dynamic prompt should have buyer persona
    expect(dynamicPrompt).toContain('## Buyer Persona')
    expect(dynamicPrompt).toContain('**Type:** strategic')

    // Dynamic prompt should have hero context
    expect(dynamicPrompt).toContain('## Hero Concept & Investment Thesis')
    expect(dynamicPrompt).toContain('The Growth Machine')
  })

  it('dynamic prompt should include stage pointer', () => {
    const state = {
      workflowProgress: {
        currentStage: 'building_sections' as WorkflowStage,
        completedStages: ['welcome', 'buyer_persona', 'hero_concept', 'investment_thesis', 'outline'] as WorkflowStage[],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { dynamicPrompt, staticPrompt } = getSystemPromptForCaching(state)

    // Dynamic prompt should have stage pointer (instructions are now in static)
    expect(dynamicPrompt).toContain('## Current Stage: BUILDING SECTIONS')
    expect(dynamicPrompt).toContain('Follow the')
    expect(dynamicPrompt).toContain('Stage Instructions')

    // Stage instructions should be in static prompt for caching
    expect(staticPrompt).toContain('BUILDING SECTIONS Stage Instructions')
    expect(staticPrompt).toContain('SECTION WORKFLOW')
  })

  it('static prompt should be same regardless of state', () => {
    const state1 = {
      companyName: 'Company A',
      workflowProgress: {
        currentStage: 'welcome' as WorkflowStage,
        completedStages: [],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const state2 = {
      companyName: 'Company B',
      knowledgeLoaded: true,
      workflowProgress: {
        currentStage: 'building_sections' as WorkflowStage,
        completedStages: ['welcome', 'buyer_persona', 'hero_concept', 'investment_thesis', 'outline'] as WorkflowStage[],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { staticPrompt: static1 } = getSystemPromptForCaching(state1)
    const { staticPrompt: static2 } = getSystemPromptForCaching(state2)

    // Static portions should be identical
    expect(static1).toBe(static2)
  })

  it('dynamic prompt should change with state', () => {
    const state1 = {
      companyName: 'Company A',
      workflowProgress: {
        currentStage: 'welcome' as WorkflowStage,
        completedStages: [],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const state2 = {
      companyName: 'Company B',
      workflowProgress: {
        currentStage: 'building_sections' as WorkflowStage,
        completedStages: ['welcome', 'buyer_persona', 'hero_concept', 'investment_thesis', 'outline'] as WorkflowStage[],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { dynamicPrompt: dynamic1 } = getSystemPromptForCaching(state1)
    const { dynamicPrompt: dynamic2 } = getSystemPromptForCaching(state2)

    // Dynamic portions should be different
    expect(dynamic1).not.toBe(dynamic2)
    expect(dynamic1).toContain('Company A')
    expect(dynamic2).toContain('Company B')
  })

  it('static prompt should be long enough for caching (>1024 tokens for Haiku)', () => {
    const state = {
      workflowProgress: {
        currentStage: 'welcome' as WorkflowStage,
        completedStages: [],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { staticPrompt } = getSystemPromptForCaching(state)

    // Rough estimate: 1 token ≈ 4 characters for English text
    // 1024 tokens ≈ 4096 characters (minimum for Haiku caching)
    // Our static prompt should be well above this
    expect(staticPrompt.length).toBeGreaterThan(4000)
  })

  it('should include navigate_to_stage guidance in static prompt', () => {
    const state = {
      workflowProgress: {
        currentStage: 'welcome' as WorkflowStage,
        completedStages: [],
        sectionProgress: {},
      },
    } as unknown as CIMMVPStateType

    const { staticPrompt } = getSystemPromptForCaching(state)

    // Navigation guidance should be in static (it doesn't change)
    expect(staticPrompt).toContain('Stage Navigation')
    expect(staticPrompt).toContain('navigate_to_stage')
    expect(staticPrompt).toContain('Acknowledge the cascade')
  })
})

// =============================================================================
// Legacy Function Tests
// =============================================================================

describe('CIM MVP Prompts - Legacy Functions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  describe('getPhaseDescription', () => {
    const ALL_PHASES: CIMPhase[] = [
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

    it('should return descriptions for all phases', () => {
      for (const phase of ALL_PHASES) {
        const description = getPhaseDescription(phase)
        expect(description).toBeDefined()
        expect(typeof description).toBe('string')
        expect(description.length).toBeGreaterThan(10)
      }
    })

    it('should emit deprecation warning', () => {
      getPhaseDescription('executive_summary')
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEPRECATED')
      )
    })

    it('should return meaningful descriptions', () => {
      expect(getPhaseDescription('executive_summary')).toContain('Hook')
      expect(getPhaseDescription('financial_performance')).toContain('financial')
      expect(getPhaseDescription('risk_factors')).toContain('risk')
    })
  })

  describe('getAllPhases', () => {
    it('should return all 11 phases', () => {
      const phases = getAllPhases()
      expect(phases).toHaveLength(11)
    })

    it('should emit deprecation warning', () => {
      getAllPhases()
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEPRECATED')
      )
    })

    it('should return phases in correct order', () => {
      const phases = getAllPhases()
      expect(phases[0]).toBe('executive_summary')
      expect(phases[1]).toBe('company_overview')
      expect(phases[10]).toBe('appendix')
    })

    it('should include all expected phases', () => {
      const phases = getAllPhases()
      expect(phases).toContain('executive_summary')
      expect(phases).toContain('company_overview')
      expect(phases).toContain('management_team')
      expect(phases).toContain('products_services')
      expect(phases).toContain('market_opportunity')
      expect(phases).toContain('business_model')
      expect(phases).toContain('financial_performance')
      expect(phases).toContain('competitive_landscape')
      expect(phases).toContain('growth_strategy')
      expect(phases).toContain('risk_factors')
      expect(phases).toContain('appendix')
    })
  })
})
