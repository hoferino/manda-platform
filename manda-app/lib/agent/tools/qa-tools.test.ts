/**
 * Q&A Tools Unit Tests
 *
 * Story: E8.3 - Agent Tool - add_qa_item()
 *
 * Tests:
 * - AddQAItemInputSchema validation
 * - Tool registration
 * - Parameter validation
 */

import { describe, it, expect } from 'vitest'
import { AddQAItemInputSchema } from '../schemas'
import { addQAItemTool, qaTools } from './qa-tools'
import { allChatTools, TOOL_COUNT, TOOL_CATEGORIES, validateToolCount } from './all-tools'

describe('AddQAItemInputSchema', () => {
  const validInput = {
    dealId: '123e4567-e89b-12d3-a456-426614174000',
    question: 'What is the company annual revenue for the last 3 years?',
    category: 'Financials' as const,
    priority: 'medium' as const,
  }

  describe('Valid Input', () => {
    it('should accept valid input with all fields', () => {
      const result = AddQAItemInputSchema.safeParse(validInput)
      expect(result.success).toBe(true)
    })

    it('should accept valid input with optional sourceFindingId', () => {
      const input = {
        ...validInput,
        sourceFindingId: '223e4567-e89b-12d3-a456-426614174000',
      }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('should default priority to medium if not provided', () => {
      const input = {
        dealId: validInput.dealId,
        question: validInput.question,
        category: validInput.category,
      }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe('medium')
      }
    })

    it('should accept all valid categories (AC #1)', () => {
      const categories = ['Financials', 'Legal', 'Operations', 'Market', 'Technology', 'HR'] as const
      for (const category of categories) {
        const result = AddQAItemInputSchema.safeParse({ ...validInput, category })
        expect(result.success).toBe(true)
      }
    })

    it('should accept all valid priorities', () => {
      const priorities = ['high', 'medium', 'low'] as const
      for (const priority of priorities) {
        const result = AddQAItemInputSchema.safeParse({ ...validInput, priority })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('Invalid Input - Category (AC #2)', () => {
    it('should reject invalid category', () => {
      const input = { ...validInput, category: 'InvalidCategory' }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('Invalid Input - Priority (AC #2)', () => {
    it('should reject invalid priority', () => {
      const input = { ...validInput, priority: 'urgent' }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('Invalid Input - Question Length (AC #6)', () => {
    it('should reject question shorter than 10 characters', () => {
      const input = { ...validInput, question: 'Short?' }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(false)
      if (!result.success && result.error.issues[0]) {
        expect(result.error.issues[0].message).toContain('10 characters')
      }
    })

    it('should accept question with exactly 10 characters', () => {
      const input = { ...validInput, question: '1234567890' }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('should reject question longer than 2000 characters', () => {
      const input = { ...validInput, question: 'x'.repeat(2001) }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(false)
      if (!result.success && result.error.issues[0]) {
        expect(result.error.issues[0].message).toContain('2000 characters')
      }
    })
  })

  describe('Invalid Input - dealId', () => {
    it('should reject non-UUID dealId', () => {
      const input = { ...validInput, dealId: 'not-a-uuid' }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('should reject empty dealId', () => {
      const input = { ...validInput, dealId: '' }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })

  describe('Invalid Input - sourceFindingId', () => {
    it('should reject non-UUID sourceFindingId', () => {
      const input = { ...validInput, sourceFindingId: 'invalid-uuid' }
      const result = AddQAItemInputSchema.safeParse(input)
      expect(result.success).toBe(false)
    })
  })
})

describe('addQAItemTool', () => {
  it('should have correct tool name', () => {
    expect(addQAItemTool.name).toBe('add_qa_item')
  })

  it('should have a description', () => {
    expect(addQAItemTool.description).toBeTruthy()
    expect(addQAItemTool.description.length).toBeGreaterThan(50)
  })

  it('should include schema', () => {
    expect(addQAItemTool.schema).toBeDefined()
  })
})

describe('qaTools array', () => {
  it('should export qaTools array', () => {
    expect(Array.isArray(qaTools)).toBe(true)
  })

  it('should include addQAItemTool', () => {
    expect(qaTools).toContain(addQAItemTool)
  })

  it('should have exactly 1 tool', () => {
    expect(qaTools.length).toBe(1)
  })
})

describe('Tool Registration (AC #7)', () => {
  it('should be registered in allChatTools', () => {
    const toolNames = allChatTools.map((t) => t.name)
    expect(toolNames).toContain('add_qa_item')
  })

  it('should be in the qa category', () => {
    expect(TOOL_CATEGORIES.qa).toContain('add_qa_item')
  })

  it('should have correct total tool count', () => {
    expect(TOOL_COUNT).toBe(17)
    expect(validateToolCount()).toBe(true)
  })
})
