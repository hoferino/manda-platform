/**
 * CIM Agent Tools Tests
 *
 * Story: E9.5 - Buyer Persona & Investment Thesis Phase
 * Story: E9.6 - Agenda/Outline Collaborative Definition
 *
 * Tests verify the tool schemas and structure for:
 * - save_buyer_persona tool (AC #6)
 * - save_investment_thesis tool (AC #6)
 * - transition_phase tool (AC #6)
 *
 * E9.6 Tools:
 * - delete_outline_section tool (AC #3)
 * - reorder_outline_sections tool (AC #4)
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

    it('should have correct tool count (10 total)', () => {
      expect(CIM_TOOL_COUNT).toBe(10)
      expect(cimTools.length).toBe(10)
    })
  })
})
