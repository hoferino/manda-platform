/**
 * Agent System v2.0 - Specialist Tool Definitions Tests
 *
 * Story: 2-1 Implement Supervisor Node with Tool-Calling (AC: #2)
 * Story: 4-2 Implement Specialist Tool Definitions
 *
 * Tests for specialist tool definitions ensuring:
 * - Tools have correct names (kebab-case)
 * - Tools have descriptions for LLM understanding
 * - Input schemas validate correctly
 * - Tools can be invoked (stub behavior)
 */

import { describe, it, expect } from 'vitest'
import {
  financialAnalystTool,
  documentResearcherTool,
  kgExpertTool,
  dueDiligenceTool,
  specialistTools,
  SPECIALIST_TOOL_NAMES,
  FinancialAnalystInputSchema,
  DocumentResearcherInputSchema,
  KGExpertInputSchema,
  DueDiligenceInputSchema,
} from '../specialist-definitions'

describe('Specialist Tool Definitions', () => {
  describe('Tool Naming Convention', () => {
    it('should use kebab-case for tool names', () => {
      expect(financialAnalystTool.name).toBe('financial-analyst')
      expect(documentResearcherTool.name).toBe('document-researcher')
      expect(kgExpertTool.name).toBe('kg-expert')
      expect(dueDiligenceTool.name).toBe('due-diligence')
    })

    it('should have SPECIALIST_TOOL_NAMES constants matching tool names', () => {
      expect(SPECIALIST_TOOL_NAMES.FINANCIAL_ANALYST).toBe('financial-analyst')
      expect(SPECIALIST_TOOL_NAMES.DOCUMENT_RESEARCHER).toBe('document-researcher')
      expect(SPECIALIST_TOOL_NAMES.KG_EXPERT).toBe('kg-expert')
      expect(SPECIALIST_TOOL_NAMES.DUE_DILIGENCE).toBe('due-diligence')
    })
  })

  describe('Tool Descriptions', () => {
    it('financial-analyst should have description mentioning financial analysis', () => {
      expect(financialAnalystTool.description).toContain('financial')
      expect(financialAnalystTool.description.toLowerCase()).toContain('revenue')
      expect(financialAnalystTool.description.toLowerCase()).toContain('valuation')
    })

    it('document-researcher should have description mentioning document analysis', () => {
      expect(documentResearcherTool.description).toContain('document')
      expect(documentResearcherTool.description.toLowerCase()).toContain('research')
    })

    it('kg-expert should have description mentioning knowledge graph', () => {
      expect(kgExpertTool.description).toContain('knowledge graph')
      expect(kgExpertTool.description.toLowerCase()).toContain('relationship')
    })

    it('due-diligence should have description mentioning due diligence', () => {
      expect(dueDiligenceTool.description).toContain('due diligence')
      expect(dueDiligenceTool.description.toLowerCase()).toContain('risk')
    })
  })

  describe('specialistTools Array', () => {
    it('should contain all 4 specialist tools', () => {
      expect(specialistTools).toHaveLength(4)
    })

    it('should contain all expected tools', () => {
      const toolNames = specialistTools.map((t) => t.name)
      expect(toolNames).toContain('financial-analyst')
      expect(toolNames).toContain('document-researcher')
      expect(toolNames).toContain('kg-expert')
      expect(toolNames).toContain('due-diligence')
    })
  })

  describe('Input Schema Validation', () => {
    describe('FinancialAnalystInputSchema', () => {
      it('should accept valid input with query only', () => {
        const result = FinancialAnalystInputSchema.safeParse({
          query: 'What is the EBITDA margin?',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.focusArea).toBe('general') // default
          expect(result.data.includeCharts).toBe(false) // default
        }
      })

      it('should accept valid input with all fields', () => {
        const result = FinancialAnalystInputSchema.safeParse({
          query: 'Analyze revenue growth',
          focusArea: 'revenue',
          includeCharts: true,
        })
        expect(result.success).toBe(true)
      })

      it('should reject invalid focusArea', () => {
        const result = FinancialAnalystInputSchema.safeParse({
          query: 'Test query',
          focusArea: 'invalid',
        })
        expect(result.success).toBe(false)
      })

      it('should reject missing query', () => {
        const result = FinancialAnalystInputSchema.safeParse({})
        expect(result.success).toBe(false)
      })
    })

    describe('DocumentResearcherInputSchema', () => {
      it('should accept valid input with query only', () => {
        const result = DocumentResearcherInputSchema.safeParse({
          query: 'Find all mentions of earn-out',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.searchDepth).toBe('deep') // default
        }
      })

      it('should accept valid document IDs', () => {
        const result = DocumentResearcherInputSchema.safeParse({
          query: 'Search for revenue figures',
          documentIds: ['123e4567-e89b-12d3-a456-426614174000'],
          searchDepth: 'exhaustive',
        })
        expect(result.success).toBe(true)
      })

      it('should reject invalid UUID in documentIds', () => {
        const result = DocumentResearcherInputSchema.safeParse({
          query: 'Test query',
          documentIds: ['not-a-uuid'],
        })
        expect(result.success).toBe(false)
      })
    })

    describe('KGExpertInputSchema', () => {
      it('should accept valid input with defaults', () => {
        const result = KGExpertInputSchema.safeParse({
          query: 'How are Company A and Company B related?',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.maxHops).toBe(2) // default
        }
      })

      it('should accept valid maxHops within range', () => {
        const result = KGExpertInputSchema.safeParse({
          query: 'Find connections',
          maxHops: 3,
          entityTypes: ['Company', 'Person'],
        })
        expect(result.success).toBe(true)
      })

      it('should reject maxHops out of range', () => {
        const result = KGExpertInputSchema.safeParse({
          query: 'Test',
          maxHops: 10, // max is 5
        })
        expect(result.success).toBe(false)
      })
    })

    describe('DueDiligenceInputSchema', () => {
      it('should accept valid input with defaults', () => {
        const result = DueDiligenceInputSchema.safeParse({
          query: 'What are the main risks?',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.category).toBe('general') // default
          expect(result.data.riskLevel).toBe('all') // default
        }
      })

      it('should accept valid category and riskLevel', () => {
        const result = DueDiligenceInputSchema.safeParse({
          query: 'Show high risk legal items',
          category: 'legal',
          riskLevel: 'high',
        })
        expect(result.success).toBe(true)
      })

      it('should reject invalid category', () => {
        const result = DueDiligenceInputSchema.safeParse({
          query: 'Test',
          category: 'invalid_category',
        })
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Tool Invocation (Stub Behavior)', () => {
    it('financial-analyst should return stub response', async () => {
      const result = await financialAnalystTool.invoke({
        query: 'What is EBITDA?',
        focusArea: 'profitability',
      })
      const parsed = JSON.parse(result)
      expect(parsed._stub).toBe(true)
      expect(parsed.query).toBe('What is EBITDA?')
      expect(parsed.focusArea).toBe('profitability')
    })

    it('document-researcher should return stub response', async () => {
      const result = await documentResearcherTool.invoke({
        query: 'Find earn-out provisions',
        searchDepth: 'exhaustive',
      })
      const parsed = JSON.parse(result)
      expect(parsed._stub).toBe(true)
      expect(parsed.query).toBe('Find earn-out provisions')
      expect(parsed.searchDepth).toBe('exhaustive')
    })

    it('kg-expert should return stub response', async () => {
      const result = await kgExpertTool.invoke({
        query: 'Related entities',
        maxHops: 3,
      })
      const parsed = JSON.parse(result)
      expect(parsed._stub).toBe(true)
      expect(parsed.maxHops).toBe(3)
    })

    it('due-diligence should return stub response', async () => {
      const result = await dueDiligenceTool.invoke({
        query: 'High risk items',
        category: 'financial',
        riskLevel: 'high',
      })
      const parsed = JSON.parse(result)
      expect(parsed._stub).toBe(true)
      expect(parsed.category).toBe('financial')
      expect(parsed.riskLevel).toBe('high')
    })
  })
})
