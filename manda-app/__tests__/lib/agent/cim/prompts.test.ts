/**
 * CIM Agent Prompts Tests
 *
 * Story: E9.5 - Buyer Persona & Investment Thesis Phase
 * Story: E9.6 - Agenda/Outline Collaborative Definition
 *
 * Tests verify the acceptance criteria for the persona, thesis, and outline phases:
 * - AC #1: Agent's first message in persona phase asks about target buyer
 * - AC #2: Buyer type options clearly presented
 * - AC #3: Probing questions for priorities, concerns, key metrics
 * - AC #4: RAG queries for thesis angle discovery
 * - AC #5: 2-3 thesis angle options presented with evidence
 * - AC #6: Persona and thesis saved before phase transition
 *
 * E9.6 Outline Phase:
 * - AC #1: Initial outline suggestion based on buyer persona and thesis
 * - AC #5: Section purpose explanations
 */

import { describe, it, expect } from 'vitest'
import {
  PHASE_PROMPTS,
  getPhaseIntroduction,
  getCIMSystemPrompt,
  getTransitionGuidance,
} from '@/lib/agent/cim/prompts'

describe('E9.5 - Buyer Persona & Investment Thesis Phase', () => {
  describe('AC #1: Initial Buyer Question', () => {
    it('should have persona phase introduction that asks about target buyer', () => {
      const intro = getPhaseIntroduction('persona')

      // Check it asks about target buyer
      expect(intro.toLowerCase()).toContain('target buyer')
      expect(intro.toLowerCase()).toContain('who is')
    })

    it('should include buyer type options in the introduction', () => {
      const intro = getPhaseIntroduction('persona')

      // Check all buyer types are mentioned
      expect(intro.toLowerCase()).toContain('strategic')
      expect(intro.toLowerCase()).toContain('financial')
      expect(intro.toLowerCase()).toContain('management')
    })

    it('should have CRITICAL section in persona prompt requiring first message asks about buyer', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check for explicit requirement
      expect(prompt).toContain('CRITICAL')
      expect(prompt.toLowerCase()).toContain('first message')
      expect(prompt.toLowerCase()).toContain('must ask')
    })
  })

  describe('AC #2: Buyer Type Options', () => {
    it('should present structured buyer type options', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check all buyer types are clearly defined
      expect(prompt.toLowerCase()).toContain('strategic acquirer')
      expect(prompt.toLowerCase()).toContain('financial sponsor')
      expect(prompt.toLowerCase()).toContain('management team')
      expect(prompt.toLowerCase()).toContain('other')
    })

    it('should include descriptions for each buyer type', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check buyer type descriptions
      expect(prompt.toLowerCase()).toContain('pe firm')
      expect(prompt.toLowerCase()).toContain('synerg')
      expect(prompt.toLowerCase()).toContain('mbo')
    })
  })

  describe('AC #3: Probing Questions', () => {
    it('should include probing questions for buyer priorities', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check priorities section exists
      expect(prompt.toLowerCase()).toContain('priorities')
      expect(prompt.toLowerCase()).toContain('growth')
      expect(prompt.toLowerCase()).toContain('profitability')
      expect(prompt.toLowerCase()).toContain('synerg')
    })

    it('should include probing questions for buyer concerns', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check concerns section exists
      expect(prompt.toLowerCase()).toContain('concern')
      expect(prompt.toLowerCase()).toContain('integration')
      expect(prompt.toLowerCase()).toContain('customer')
    })

    it('should include probing questions for key metrics', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check metrics section exists
      expect(prompt.toLowerCase()).toContain('metric')
      expect(prompt.toLowerCase()).toContain('ebitda')
      expect(prompt.toLowerCase()).toContain('revenue')
    })

    it('should require capturing 2-3 priorities', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check requirement for multiple priorities
      expect(prompt).toMatch(/2-3\s+priorities/i)
    })

    it('should require capturing 2-3 key metrics', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check requirement for multiple metrics
      expect(prompt).toMatch(/2-3\s+(key\s+)?metrics/i)
    })
  })

  describe('AC #4: RAG Query for Thesis Angles', () => {
    it('should instruct agent to search deal documents in thesis phase', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check RAG instruction
      expect(prompt.toLowerCase()).toContain('search')
      expect(prompt.toLowerCase()).toContain('query_knowledge_base')
    })

    it('should include suggested search queries for thesis angles', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check search categories
      expect(prompt.toLowerCase()).toContain('strengths')
      expect(prompt.toLowerCase()).toContain('differentiator')
      expect(prompt.toLowerCase()).toContain('financial performance')
      expect(prompt.toLowerCase()).toContain('market position')
      expect(prompt.toLowerCase()).toContain('growth opportunit')
    })

    it('should mark RAG search as CRITICAL requirement', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check for critical marker
      expect(prompt).toContain('CRITICAL')
      expect(prompt.toLowerCase()).toContain('must search')
    })
  })

  describe('AC #5: Thesis Angle Options', () => {
    it('should instruct agent to present 2-3 thesis angle options', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check for thesis options
      expect(prompt).toMatch(/2-3\s+thesis/i)
      expect(prompt.toLowerCase()).toContain('option')
    })

    it('should require evidence/sources with thesis options', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check for evidence requirement
      expect(prompt.toLowerCase()).toContain('supporting evidence')
      expect(prompt.toLowerCase()).toContain('cite')
    })

    it('should include example thesis structures', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check for templates by buyer type
      expect(prompt.toLowerCase()).toContain('strategic acquirer')
      expect(prompt.toLowerCase()).toContain('financial sponsor')
    })

    it('should require thesis to be 2-3 sentences', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check length requirement (prompt says "2-3 sentence" or "2-3 concise sentences")
      expect(prompt).toMatch(/2-3\s+(concise\s+)?sentence/i)
    })
  })

  describe('AC #6: Persistence Tools', () => {
    it('should instruct agent to use save_buyer_persona tool', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check tool usage instruction
      expect(prompt.toLowerCase()).toContain('save_buyer_persona')
      expect(prompt.toLowerCase()).toContain('after user confirms')
    })

    it('should instruct agent to use save_investment_thesis tool', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check tool usage instruction
      expect(prompt.toLowerCase()).toContain('save_investment_thesis')
      expect(prompt.toLowerCase()).toContain('after')
      expect(prompt.toLowerCase()).toContain('approval')
    })

    it('should instruct agent to use transition_phase tool', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check transition tool instruction
      expect(prompt.toLowerCase()).toContain('transition_phase')
    })
  })

  describe('Phase Transition Criteria', () => {
    it('should define clear transition criteria for persona phase', () => {
      const prompt = PHASE_PROMPTS.persona

      // Check transition criteria
      expect(prompt.toLowerCase()).toContain('transition')
      expect(prompt.toLowerCase()).toContain('buyer type')
      expect(prompt.toLowerCase()).toContain('priorities')
      expect(prompt.toLowerCase()).toContain('metrics')
      expect(prompt.toLowerCase()).toContain('confirm')
    })

    it('should define clear transition criteria for thesis phase', () => {
      const prompt = PHASE_PROMPTS.thesis

      // Check transition criteria
      expect(prompt.toLowerCase()).toContain('transition')
      expect(prompt.toLowerCase()).toContain('approved')
      expect(prompt.toLowerCase()).toContain('value driver')
    })
  })

  describe('System Prompt Integration', () => {
    it('should include phase-specific prompt in system prompt', () => {
      const systemPrompt = getCIMSystemPrompt('persona')

      // Check persona prompt is included
      expect(systemPrompt).toContain('Buyer Persona Definition')
      expect(systemPrompt.toLowerCase()).toContain('target buyer')
    })

    it('should include deal name context when provided', () => {
      const systemPrompt = getCIMSystemPrompt('persona', 'Test Company')

      // Check deal context
      expect(systemPrompt).toContain('Test Company')
    })
  })

  describe('Phase Transition Guidance', () => {
    it('should provide transition guidance from persona to thesis', () => {
      const guidance = getTransitionGuidance('persona', 'thesis')

      // Check transition message
      expect(guidance.toLowerCase()).toContain('persona')
      expect(guidance.toLowerCase()).toContain('thesis')
    })
  })
})

describe('E9.7 - Slide Content Creation (RAG-powered)', () => {
  describe('AC #1: Section-Based Content Initiation', () => {
    it('should have CRITICAL section requiring opening message for each section', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt).toContain('CRITICAL')
      expect(prompt.toLowerCase()).toContain('section')
      expect(prompt.toLowerCase()).toContain('let\'s create content for')
    })

    it('should require 4-step flow pattern: Context → Search → Present → Finalize', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('step 1')
      expect(prompt.toLowerCase()).toContain('context')
      expect(prompt.toLowerCase()).toContain('step 2')
      expect(prompt.toLowerCase()).toContain('search')
      expect(prompt.toLowerCase()).toContain('step 3')
      expect(prompt.toLowerCase()).toContain('present')
      expect(prompt.toLowerCase()).toContain('step 4')
      expect(prompt.toLowerCase()).toContain('finalize')
    })
  })

  describe('AC #3: Q&A Priority', () => {
    it('should mention Q&A priority - Q&A answers first as most recent', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('q&a')
      expect(prompt.toLowerCase()).toContain('highest priority')
      expect(prompt.toLowerCase()).toContain('most recent')
    })

    it('should define content retrieval priority order', () => {
      const prompt = PHASE_PROMPTS.content_creation

      // Check for priority order: Q&A > Findings > Document Chunks
      expect(prompt).toContain('Content Retrieval Priority')
      expect(prompt.toLowerCase()).toContain('q&a answers')
      expect(prompt.toLowerCase()).toContain('findings')
      expect(prompt.toLowerCase()).toContain('document chunks')
    })
  })

  describe('AC #4: Content Options Presentation', () => {
    it('should require 2-3 content options presentation', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt).toMatch(/2-3\s+content\s+options/i)
    })

    it('should enforce source citation format: (qa:), (finding:), (source:)', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt).toContain('(qa:')
      expect(prompt).toContain('(finding:')
      expect(prompt).toContain('(source:')
    })

    it('should include example options with source citations', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt).toContain('Option A')
      expect(prompt).toContain('Option B')
    })
  })

  describe('AC #7: Forward Context Flow', () => {
    it('should reference buyer persona in context flow', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('buyer persona')
      expect(prompt.toLowerCase()).toContain('reference the buyer persona')
    })

    it('should reference investment thesis in context flow', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('investment thesis')
      expect(prompt.toLowerCase()).toContain('connect to investment thesis')
    })

    it('should mention prior slides context', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('prior slides')
      expect(prompt.toLowerCase()).toContain('reference prior slides')
    })

    it('should include example of forward context flow', () => {
      const prompt = PHASE_PROMPTS.content_creation

      // Check for example text
      expect(prompt.toLowerCase()).toContain('given your target')
      expect(prompt.toLowerCase()).toContain('building on our thesis')
    })
  })

  describe('AC #8: Contradiction Awareness', () => {
    it('should include contradiction handling guidance', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt).toContain('Contradiction Handling')
      expect(prompt).toContain('CONTRADICTS')
    })

    it('should alert user before including conflicting data', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('alert the user')
      expect(prompt.toLowerCase()).toContain('conflicting')
    })

    it('should require presenting both sides of contradiction', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('present both sides')
    })

    it('should let user decide on contradictions', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('let user decide')
    })
  })

  describe('Content Selection Flow (AC #5 related)', () => {
    it('should include content selection flow patterns', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt).toContain('Content Selection Flow')
    })

    it('should handle option selection phrases', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('option a')
      expect(prompt.toLowerCase()).toContain('i like a')
    })

    it('should handle modification requests', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('change the bullet')
      expect(prompt.toLowerCase()).toContain('modify')
    })

    it('should handle alternative requests', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('more options')
      expect(prompt.toLowerCase()).toContain('different angle')
    })
  })

  describe('Content Approval Flow (AC #6 related)', () => {
    it('should include content approval flow', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt).toContain('Content Approval Flow')
    })

    it('should recognize approval phrases', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('looks good')
      expect(prompt.toLowerCase()).toContain('approve')
      expect(prompt.toLowerCase()).toContain('that works')
    })

    it('should update status to approved when user approves', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('status')
      expect(prompt.toLowerCase()).toContain('approved')
    })
  })

  describe('Phase Introduction', () => {
    it('should have content_creation introduction mentioning options', () => {
      const intro = getPhaseIntroduction('content_creation')

      expect(intro.toLowerCase()).toContain('options')
      expect(intro.toLowerCase()).toContain('source')
    })

    it('should mention Q&A, findings, and documents in introduction', () => {
      const intro = getPhaseIntroduction('content_creation')

      expect(intro.toLowerCase()).toContain('q&a')
      expect(intro.toLowerCase()).toContain('findings')
      expect(intro.toLowerCase()).toContain('documents')
    })
  })

  describe('Transition Criteria', () => {
    it('should define clear transition criteria for content_creation phase', () => {
      const prompt = PHASE_PROMPTS.content_creation

      expect(prompt.toLowerCase()).toContain('transition criteria')
      expect(prompt.toLowerCase()).toContain('approved')
      expect(prompt.toLowerCase()).toContain('contradictions')
    })
  })
})

describe('E9.6 - Agenda/Outline Collaborative Definition', () => {
  describe('AC #1: Initial Outline Suggestion', () => {
    it('should have CRITICAL section in outline prompt requiring initial proposal', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for CRITICAL marker
      expect(prompt).toContain('CRITICAL')
      expect(prompt.toLowerCase()).toContain('first message')
      expect(prompt.toLowerCase()).toContain('must propose')
    })

    it('should require outline based on buyer persona and investment thesis', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check prompt references persona and thesis
      expect(prompt.toLowerCase()).toContain('buyer persona')
      expect(prompt.toLowerCase()).toContain('investment thesis')
    })

    it('should include outline introduction mentioning buyer persona and thesis', () => {
      const intro = getPhaseIntroduction('outline')

      expect(intro.toLowerCase()).toContain('buyer persona')
      expect(intro.toLowerCase()).toContain('investment thesis')
      expect(intro.toLowerCase()).toContain('outline')
    })

    it('should provide buyer-type-specific outline templates', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for buyer type templates
      expect(prompt.toLowerCase()).toContain('strategic acquirer')
      expect(prompt.toLowerCase()).toContain('financial sponsor')
      expect(prompt.toLowerCase()).toContain('management/mbo')
    })

    it('should include buyer-specific sections in templates', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for buyer-specific sections
      expect(prompt.toLowerCase()).toContain('strategic fit')
      expect(prompt.toLowerCase()).toContain('value creation lever')
      expect(prompt.toLowerCase()).toContain('operational excellence')
    })
  })

  describe('AC #5: Section Purpose Explanations', () => {
    it('should include purpose explanations for standard CIM sections', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for section explanations
      expect(prompt.toLowerCase()).toContain('executive summary')
      expect(prompt.toLowerCase()).toContain('company overview')
      expect(prompt.toLowerCase()).toContain('market opportunity')
      expect(prompt.toLowerCase()).toContain('financial performance')
    })

    it('should explain what each section contains', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for content descriptions
      expect(prompt.toLowerCase()).toContain('elevator pitch')
      expect(prompt.toLowerCase()).toContain('credibility')
      expect(prompt.toLowerCase()).toContain('tam/sam/som')
    })

    it('should differentiate section content by buyer type', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for buyer-specific content guidance
      expect(prompt.toLowerCase()).toContain('strategic buyers')
      expect(prompt.toLowerCase()).toContain('financial sponsors')
      expect(prompt.toLowerCase()).toContain('cultural fit')
      expect(prompt.toLowerCase()).toContain('management depth')
    })
  })

  describe('AC #2, #3, #4: Conversational Operations', () => {
    it('should include instructions for adding sections', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for add section guidance
      expect(prompt.toLowerCase()).toContain('add a section')
      expect(prompt.toLowerCase()).toContain('create_outline_section')
    })

    it('should include instructions for removing sections', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for remove section guidance
      expect(prompt.toLowerCase()).toContain('remove')
      expect(prompt.toLowerCase()).toContain('delete_outline_section')
    })

    it('should include instructions for reordering sections', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for reorder section guidance
      expect(prompt.toLowerCase()).toContain('reorder')
      expect(prompt.toLowerCase()).toContain('move')
      expect(prompt.toLowerCase()).toContain('reorder_outline_sections')
    })

    it('should include example conversational phrases for operations', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for example phrases
      expect(prompt.toLowerCase()).toContain('add a section for team')
      expect(prompt.toLowerCase()).toContain('remove the appendix')
      expect(prompt.toLowerCase()).toContain('move market analysis')
    })

    it('should require confirmation after operations', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check for confirmation patterns
      expect(prompt.toLowerCase()).toContain('confirm')
      expect(prompt.toLowerCase()).toContain('updated outline')
    })
  })

  describe('Transition Criteria', () => {
    it('should define clear transition criteria for outline phase', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check transition criteria
      expect(prompt.toLowerCase()).toContain('transition criteria')
      expect(prompt.toLowerCase()).toContain('all sections are defined')
      expect(prompt.toLowerCase()).toContain('approved')
    })

    it('should require explicit user approval before transition', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check approval requirement
      expect(prompt.toLowerCase()).toContain('explicitly approved')
    })

    it('should require section order to be finalized', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check order finalization
      expect(prompt.toLowerCase()).toContain('order is finalized')
    })
  })

  describe('Tool Usage', () => {
    it('should list all outline tools in approach section', () => {
      const prompt = PHASE_PROMPTS.outline

      // Check tool usage list
      expect(prompt.toLowerCase()).toContain('create_outline_section')
      expect(prompt.toLowerCase()).toContain('update_outline_section')
      expect(prompt.toLowerCase()).toContain('delete_outline_section')
      expect(prompt.toLowerCase()).toContain('reorder_outline_sections')
    })
  })

})
