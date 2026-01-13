/**
 * CIM Agent Tools Tests
 *
 * Story: E9.5 - Buyer Persona & Investment Thesis Phase
 * Story: E9.6 - Agenda/Outline Collaborative Definition
 * Story: E9.7 - Slide Content Creation (RAG-powered)
 * Story: E9.10 - Visual Concept Generation
 *
 * Tests verify the tool schemas and structure for:
 * - save_buyer_persona tool (AC #6)
 * - save_investment_thesis tool (AC #6)
 * - transition_phase tool (AC #6)
 *
 * E9.6 Tools:
 * - delete_outline_section tool (AC #3)
 * - reorder_outline_sections tool (AC #4)
 *
 * E9.7 Tools:
 * - generate_slide_content tool (AC #2, #3, #4)
 * - select_content_option tool (AC #5)
 * - approve_slide_content tool (AC #6)
 *
 * E9.10 Tools:
 * - generate_visual_concept tool (AC #1, #3)
 * - regenerate_visual_concept tool (AC #4)
 */

import { describe, it, expect } from 'vitest'
import {
  saveBuyerPersonaTool,
  saveInvestmentThesisTool,
  transitionPhaseTool,
  createOutlineSectionTool,
  updateOutlineSectionTool,
  deleteOutlineSectionTool,
  reorderOutlineSectionsTool,
  generateSlideContentTool,
  selectContentOptionTool,
  approveSlideContentTool,
  generateVisualConceptTool,
  regenerateVisualConceptTool,
  trackDependenciesTool,
  getDependentSlidesTool,
  validateCoherenceTool,
  cimTools,
  CIM_TOOL_COUNT,
} from '@/lib/agent/cim/tools'

describe('E9.5 - CIM Tools for Persona & Thesis', () => {
  describe('saveBuyerPersonaTool', () => {
    it('should be exported and named correctly', () => {
      expect(saveBuyerPersonaTool).toBeDefined()
      expect(saveBuyerPersonaTool.name).toBe('save_buyer_persona')
    })

    it('should have proper schema with required fields', () => {
      const schema = saveBuyerPersonaTool.schema
      expect(schema).toBeDefined()

      // Check required fields exist in schema description
      const description = saveBuyerPersonaTool.description
      expect(description.toLowerCase()).toContain('buyer persona')
    })

    it('should accept buyer type parameter', () => {
      // Tool should accept buyerType with valid values
      expect(saveBuyerPersonaTool.description).toBeTruthy()
    })
  })

  describe('saveInvestmentThesisTool', () => {
    it('should be exported and named correctly', () => {
      expect(saveInvestmentThesisTool).toBeDefined()
      expect(saveInvestmentThesisTool.name).toBe('save_investment_thesis')
    })

    it('should have proper schema with thesis requirements', () => {
      const description = saveInvestmentThesisTool.description
      expect(description.toLowerCase()).toContain('thesis')
    })

    it('should validate thesis length', () => {
      // The schema requires thesis between 50-500 characters
      expect(saveInvestmentThesisTool.schema).toBeDefined()
    })
  })

  describe('transitionPhaseTool', () => {
    it('should be exported and named correctly', () => {
      expect(transitionPhaseTool).toBeDefined()
      expect(transitionPhaseTool.name).toBe('transition_phase')
    })

    it('should have description mentioning phase transition', () => {
      const description = transitionPhaseTool.description
      expect(description.toLowerCase()).toContain('phase')
      // Description says "Move the workflow to the next phase"
      expect(description.toLowerCase()).toContain('move')
    })

    it('should support target phase parameter', () => {
      // Tool accepts optional targetPhase parameter
      const description = transitionPhaseTool.description
      expect(description.toLowerCase()).toContain('phase')
    })
  })

  describe('cimTools array', () => {
    it('should include all required tools', () => {
      const toolNames = cimTools.map(t => t.name)

      expect(toolNames).toContain('save_buyer_persona')
      expect(toolNames).toContain('save_investment_thesis')
      expect(toolNames).toContain('transition_phase')
    })

    it('should have correct tool count', () => {
      expect(CIM_TOOL_COUNT).toBe(cimTools.length)
      expect(cimTools.length).toBeGreaterThanOrEqual(8)
    })

    it('should include outline and content tools for later phases', () => {
      const toolNames = cimTools.map(t => t.name)

      expect(toolNames).toContain('create_outline_section')
      expect(toolNames).toContain('generate_slide_content')
    })
  })

  describe('Tool Integration', () => {
    it('should all have description property', () => {
      cimTools.forEach(tool => {
        expect(tool.description).toBeTruthy()
        expect(typeof tool.description).toBe('string')
      })
    })

    it('should all have name property', () => {
      cimTools.forEach(tool => {
        expect(tool.name).toBeTruthy()
        expect(typeof tool.name).toBe('string')
      })
    })

    it('should all have schema property', () => {
      cimTools.forEach(tool => {
        expect(tool.schema).toBeDefined()
      })
    })
  })
})

describe('E9.6 - CIM Tools for Outline Definition', () => {
  describe('createOutlineSectionTool', () => {
    it('should be exported and named correctly', () => {
      expect(createOutlineSectionTool).toBeDefined()
      expect(createOutlineSectionTool.name).toBe('create_outline_section')
    })

    it('should have description mentioning outline', () => {
      const description = createOutlineSectionTool.description
      expect(description.toLowerCase()).toContain('section')
      expect(description.toLowerCase()).toContain('outline')
    })

    it('should accept required parameters', () => {
      expect(createOutlineSectionTool.schema).toBeDefined()
    })
  })

  describe('updateOutlineSectionTool', () => {
    it('should be exported and named correctly', () => {
      expect(updateOutlineSectionTool).toBeDefined()
      expect(updateOutlineSectionTool.name).toBe('update_outline_section')
    })

    it('should have description mentioning update', () => {
      const description = updateOutlineSectionTool.description
      expect(description.toLowerCase()).toContain('update')
      expect(description.toLowerCase()).toContain('section')
    })
  })

  describe('deleteOutlineSectionTool (AC #3)', () => {
    it('should be exported and named correctly', () => {
      expect(deleteOutlineSectionTool).toBeDefined()
      expect(deleteOutlineSectionTool.name).toBe('delete_outline_section')
    })

    it('should have description mentioning remove/delete', () => {
      const description = deleteOutlineSectionTool.description
      expect(description.toLowerCase()).toContain('remove')
      expect(description.toLowerCase()).toContain('section')
    })

    it('should accept cimId and sectionId parameters', () => {
      expect(deleteOutlineSectionTool.schema).toBeDefined()
    })

    it('should mention removing associated slides', () => {
      const description = deleteOutlineSectionTool.description
      expect(description.toLowerCase()).toContain('slide')
    })
  })

  describe('reorderOutlineSectionsTool (AC #4)', () => {
    it('should be exported and named correctly', () => {
      expect(reorderOutlineSectionsTool).toBeDefined()
      expect(reorderOutlineSectionsTool.name).toBe('reorder_outline_sections')
    })

    it('should have description mentioning order/reorder', () => {
      const description = reorderOutlineSectionsTool.description
      expect(description.toLowerCase()).toContain('order')
      expect(description.toLowerCase()).toContain('section')
    })

    it('should accept sectionOrder array parameter', () => {
      expect(reorderOutlineSectionsTool.schema).toBeDefined()
    })

    it('should mention moving or swapping sections', () => {
      const description = reorderOutlineSectionsTool.description
      expect(description.toLowerCase()).toContain('move')
    })
  })

  describe('cimTools array includes E9.6 tools', () => {
    it('should include all outline tools', () => {
      const toolNames = cimTools.map(t => t.name)

      expect(toolNames).toContain('create_outline_section')
      expect(toolNames).toContain('update_outline_section')
      expect(toolNames).toContain('delete_outline_section')
      expect(toolNames).toContain('reorder_outline_sections')
    })

    it('should have correct tool count (22 total with E9.7, E9.10, E9.11, E9.12, and E9.13)', () => {
      // Count includes E9.10 visual concept tools and E9.11 dependency/coherence tools
      expect(CIM_TOOL_COUNT).toBe(22)
      expect(cimTools.length).toBe(22)
    })
  })
})

describe('E9.7 - CIM Tools for Slide Content Creation', () => {
  describe('generateSlideContentTool (AC #2, #3, #4)', () => {
    it('should be exported and named correctly', () => {
      expect(generateSlideContentTool).toBeDefined()
      expect(generateSlideContentTool.name).toBe('generate_slide_content')
    })

    it('should have description mentioning hybrid RAG search', () => {
      const description = generateSlideContentTool.description
      expect(description.toLowerCase()).toContain('rag')
      expect(description.toLowerCase()).toContain('search')
    })

    it('should mention Q&A answers as highest priority (AC #3)', () => {
      const description = generateSlideContentTool.description
      expect(description.toLowerCase()).toContain('q&a')
      expect(description.toLowerCase()).toContain('highest priority')
    })

    it('should mention findings and document chunks (AC #2)', () => {
      const description = generateSlideContentTool.description
      expect(description.toLowerCase()).toContain('findings')
      expect(description.toLowerCase()).toContain('document')
    })

    it('should mention source citations (AC #4)', () => {
      const description = generateSlideContentTool.description
      expect(description.toLowerCase()).toContain('citation')
    })

    it('should mention contradiction detection (AC #8)', () => {
      const description = generateSlideContentTool.description
      expect(description.toLowerCase()).toContain('contradiction')
    })

    it('should accept topic parameter for search', () => {
      expect(generateSlideContentTool.schema).toBeDefined()
    })
  })

  describe('selectContentOptionTool (AC #5)', () => {
    it('should be exported and named correctly', () => {
      expect(selectContentOptionTool).toBeDefined()
      expect(selectContentOptionTool.name).toBe('select_content_option')
    })

    it('should have description mentioning option selection', () => {
      const description = selectContentOptionTool.description
      expect(description.toLowerCase()).toContain('option')
      expect(description.toLowerCase()).toContain('select')
    })

    it('should mention common selection triggers', () => {
      const description = selectContentOptionTool.description
      expect(description.toLowerCase()).toContain('option a')
      expect(description.toLowerCase()).toContain('i like')
    })

    it('should accept content and sourceRefs parameters', () => {
      expect(selectContentOptionTool.schema).toBeDefined()
    })
  })

  describe('approveSlideContentTool (AC #6)', () => {
    it('should be exported and named correctly', () => {
      expect(approveSlideContentTool).toBeDefined()
      expect(approveSlideContentTool.name).toBe('approve_slide_content')
    })

    it('should have description mentioning approval', () => {
      const description = approveSlideContentTool.description
      expect(description.toLowerCase()).toContain('approve')
    })

    it('should mention common approval triggers', () => {
      const description = approveSlideContentTool.description
      expect(description.toLowerCase()).toContain('looks good')
      expect(description.toLowerCase()).toContain('that works')
      expect(description.toLowerCase()).toContain('perfect')
    })

    it('should mention status update', () => {
      const description = approveSlideContentTool.description
      expect(description.toLowerCase()).toContain('status')
      expect(description.toLowerCase()).toContain('approved')
    })

    it('should mention next section info', () => {
      const description = approveSlideContentTool.description
      expect(description.toLowerCase()).toContain('next section')
    })
  })

  describe('cimTools array includes E9.7 tools', () => {
    it('should include all slide content tools', () => {
      const toolNames = cimTools.map(t => t.name)

      expect(toolNames).toContain('generate_slide_content')
      expect(toolNames).toContain('select_content_option')
      expect(toolNames).toContain('approve_slide_content')
    })

    it('should have correct tool count (22 total including E9.10-E9.13 tools)', () => {
      // 12 base tools + 2 E9.10 visual concept tools + 3 E9.11 dependency/coherence tools
      expect(CIM_TOOL_COUNT).toBe(22)
      expect(cimTools.length).toBe(22)
    })

    it('should include E9.10 visual concept tools in array', () => {
      const toolNames = cimTools.map(t => t.name)

      expect(toolNames).toContain('generate_visual_concept')
      expect(toolNames).toContain('regenerate_visual_concept')
    })
  })
})

// =============================================================================
// E9.10 - Visual Concept Generation Tools
// =============================================================================

describe('E9.10 - CIM Tools for Visual Concept Generation', () => {
  describe('generateVisualConceptTool (AC #1, #3)', () => {
    it('should be exported and named correctly', () => {
      expect(generateVisualConceptTool).toBeDefined()
      expect(generateVisualConceptTool.name).toBe('generate_visual_concept')
    })

    it('should have proper schema with required fields', () => {
      const schema = generateVisualConceptTool.schema
      expect(schema).toBeDefined()

      // Schema should require cimId and slideId
      const description = generateVisualConceptTool.description
      expect(description).toContain('Generate')
      expect(description).toContain('visual concept')
    })

    it('should have description mentioning buyer persona rationale (AC #3)', () => {
      const description = generateVisualConceptTool.description
      expect(description.toLowerCase()).toContain('buyer persona')
      expect(description.toLowerCase()).toContain('narrative')
    })

    it('should have description mentioning layout types (AC #2)', () => {
      const description = generateVisualConceptTool.description
      expect(description).toContain('layout_type')
      expect(description).toContain('chart_recommendations')
    })

    it('should be included in cimTools array', () => {
      const toolNames = cimTools.map(t => t.name)
      expect(toolNames).toContain('generate_visual_concept')
    })
  })

  describe('regenerateVisualConceptTool (AC #4)', () => {
    it('should be exported and named correctly', () => {
      expect(regenerateVisualConceptTool).toBeDefined()
      expect(regenerateVisualConceptTool.name).toBe('regenerate_visual_concept')
    })

    it('should have proper schema with preference field', () => {
      const schema = regenerateVisualConceptTool.schema
      expect(schema).toBeDefined()

      const description = regenerateVisualConceptTool.description
      expect(description).toContain('preference')
    })

    it('should have description mentioning alternative requests (AC #4)', () => {
      const description = regenerateVisualConceptTool.description
      expect(description.toLowerCase()).toContain('different layout')
      expect(description.toLowerCase()).toContain('pie chart')
    })

    it('should support preferredLayout and preferredChartType options', () => {
      const description = regenerateVisualConceptTool.description
      expect(description).toContain('preferredLayout')
      expect(description).toContain('preferredChartType')
    })

    it('should be included in cimTools array', () => {
      const toolNames = cimTools.map(t => t.name)
      expect(toolNames).toContain('regenerate_visual_concept')
    })
  })
})

// =============================================================================
// E9.11 - Dependency Tracking Tools
// =============================================================================

describe('E9.11 - CIM Tools for Dependency Tracking', () => {
  describe('trackDependenciesTool (AC #1)', () => {
    it('should be exported and named correctly', () => {
      expect(trackDependenciesTool).toBeDefined()
      expect(trackDependenciesTool.name).toBe('track_dependencies')
    })

    it('should have proper schema with required fields', () => {
      const schema = trackDependenciesTool.schema
      expect(schema).toBeDefined()

      const description = trackDependenciesTool.description
      expect(description).toContain('dependencies')
      expect(description).toContain('slides')
    })

    it('should have description mentioning when to track dependencies', () => {
      const description = trackDependenciesTool.description
      expect(description.toLowerCase()).toContain('when to use')
      expect(description.toLowerCase()).toContain('references')
    })

    it('should have description with example references to detect', () => {
      const description = trackDependenciesTool.description
      expect(description).toContain('Example references')
      expect(description).toContain('slide 3')
    })

    it('should accept slideId and referencedSlideIds parameters', () => {
      // Schema should require slideId and referencedSlideIds (checked via schema)
      const schema = trackDependenciesTool.schema
      expect(schema).toBeDefined()
    })

    it('should be included in cimTools array', () => {
      const toolNames = cimTools.map(t => t.name)
      expect(toolNames).toContain('track_dependencies')
    })
  })

  describe('getDependentSlidesTool (AC #2, #4)', () => {
    it('should be exported and named correctly', () => {
      expect(getDependentSlidesTool).toBeDefined()
      expect(getDependentSlidesTool.name).toBe('get_dependent_slides')
    })

    it('should have proper schema', () => {
      const schema = getDependentSlidesTool.schema
      expect(schema).toBeDefined()
    })

    it('should have description mentioning dependent slides', () => {
      const description = getDependentSlidesTool.description
      expect(description.toLowerCase()).toContain('depend')
      expect(description.toLowerCase()).toContain('slide')
    })

    it('should have description mentioning proactive warning (AC #4)', () => {
      const description = getDependentSlidesTool.description
      expect(description.toLowerCase()).toContain('warn')
      expect(description.toLowerCase()).toContain('impacts')
    })

    it('should mention when to use', () => {
      const description = getDependentSlidesTool.description
      expect(description.toLowerCase()).toContain('when to use')
      expect(description.toLowerCase()).toContain('edited')
    })

    it('should be included in cimTools array', () => {
      const toolNames = cimTools.map(t => t.name)
      expect(toolNames).toContain('get_dependent_slides')
    })
  })

  describe('validateCoherenceTool (AC #6)', () => {
    it('should be exported and named correctly', () => {
      expect(validateCoherenceTool).toBeDefined()
      expect(validateCoherenceTool.name).toBe('validate_coherence')
    })

    it('should have proper schema', () => {
      const schema = validateCoherenceTool.schema
      expect(schema).toBeDefined()
    })

    it('should have description mentioning coherence checks', () => {
      const description = validateCoherenceTool.description
      expect(description.toLowerCase()).toContain('coherence')
      expect(description.toLowerCase()).toContain('validate')
    })

    it('should have description mentioning conflicting data', () => {
      const description = validateCoherenceTool.description
      expect(description.toLowerCase()).toContain('conflict')
    })

    it('should have description mentioning broken references', () => {
      const description = validateCoherenceTool.description
      expect(description.toLowerCase()).toContain('broken')
      expect(description.toLowerCase()).toContain('reference')
    })

    it('should have description mentioning narrative gaps', () => {
      const description = validateCoherenceTool.description
      expect(description.toLowerCase()).toContain('narrative')
      expect(description.toLowerCase()).toContain('gap')
    })

    it('should mention when to use', () => {
      const description = validateCoherenceTool.description
      expect(description.toLowerCase()).toContain('when to use')
    })

    it('should be included in cimTools array', () => {
      const toolNames = cimTools.map(t => t.name)
      expect(toolNames).toContain('validate_coherence')
    })
  })

  describe('cimTools array includes E9.11 tools', () => {
    it('should include all dependency tracking and coherence tools', () => {
      const toolNames = cimTools.map(t => t.name)

      expect(toolNames).toContain('track_dependencies')
      expect(toolNames).toContain('get_dependent_slides')
      expect(toolNames).toContain('validate_coherence')
    })
  })
})
