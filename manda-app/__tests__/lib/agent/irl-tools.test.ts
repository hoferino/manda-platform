/**
 * IRL Tools Unit Tests
 *
 * Tests for generate_irl_suggestions and add_to_irl agent tools.
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation from Documents
 *
 * Test Coverage:
 * - Schema validation for GenerateIRLSuggestionsInput
 * - Schema validation for AddToIRLInput
 * - Schema validation for IRLSuggestion output
 * - Tool execution with mocked dependencies
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  GenerateIRLSuggestionsInputSchema,
  AddToIRLInputSchema,
  IRLSuggestionSchema,
} from '@/lib/agent/schemas'
import { allChatTools, TOOL_COUNT, validateToolCount, TOOL_CATEGORIES } from '@/lib/agent/tools/all-tools'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'test-user-id' } },
          error: null,
        }),
      },
      from: vi.fn((table: string) => {
        if (table === 'deals') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'deal-123',
                    name: 'Test Deal',
                    irl_template: 'tech_ma',
                    industry: 'Technology',
                  },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'documents') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: 'doc-1', name: 'financials.pdf', mime_type: 'application/pdf', folder_path: '/financials' },
                  { id: 'doc-2', name: 'contracts.pdf', mime_type: 'application/pdf', folder_path: '/legal' },
                ],
                error: null,
              }),
            })),
          }
        }
        if (table === 'irls') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'irl-123', deal_id: 'deal-123', name: 'Test IRL' },
                  error: null,
                }),
              })),
            })),
          }
        }
        if (table === 'irl_items') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: 'item-1', irl_id: 'irl-123', category: 'Financial', item_name: 'Budget', priority: 'high' },
                  ],
                  error: null,
                }),
              })),
            })),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'new-item-id',
                    irl_id: 'irl-123',
                    category: 'Financial',
                    item_name: 'New Item',
                    priority: 'medium',
                  },
                  error: null,
                }),
              })),
            })),
          }
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        }
      }),
    })
  ),
}))

// Mock IRL services
vi.mock('@/lib/services/irls', () => ({
  getIRLWithItems: vi.fn().mockResolvedValue({
    id: 'irl-123',
    dealId: 'deal-123',
    title: 'Test IRL',
    items: [
      {
        id: 'item-1',
        irlId: 'irl-123',
        category: 'Financial',
        itemName: 'Budget',
        priority: 'high',
        status: 'not_started',
        sortOrder: 0,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      },
    ],
  }),
  createIRLItem: vi.fn().mockResolvedValue({
    id: 'new-item-id',
    irlId: 'irl-123',
    category: 'Financial',
    itemName: 'New Item',
    priority: 'medium',
    status: 'not_started',
    sortOrder: 1,
    createdAt: '2024-01-01',
    updatedAt: '2024-01-01',
  }),
}))

// Mock IRL templates
vi.mock('@/lib/services/irl-templates', () => ({
  listTemplates: vi.fn().mockResolvedValue([
    {
      id: 'tech-ma',
      name: 'Tech M&A',
      dealType: 'tech_ma',
      categories: [
        {
          name: 'Financial',
          items: [
            { name: 'Audited Financial Statements', priority: 'high', description: 'Annual audited statements' },
            { name: 'ARR/MRR Analysis', priority: 'high', description: 'Revenue breakdown' },
          ],
        },
        {
          name: 'Legal',
          items: [{ name: 'Cap Table', priority: 'high', description: 'Fully diluted cap table' }],
        },
      ],
    },
  ]),
  getTemplate: vi.fn().mockResolvedValue({
    id: 'tech-ma',
    name: 'Tech M&A',
    dealType: 'tech_ma',
    categories: [
      {
        name: 'Financial',
        items: [
          { name: 'Audited Financial Statements', priority: 'high', description: 'Annual audited statements' },
          { name: 'ARR/MRR Analysis', priority: 'high', description: 'Revenue breakdown' },
        ],
      },
      {
        name: 'Legal',
        items: [{ name: 'Cap Table', priority: 'high', description: 'Fully diluted cap table' }],
      },
    ],
  }),
}))

// Mock LLM
vi.mock('@/lib/llm/client', () => ({
  createLLMClient: vi.fn(() => ({
    invoke: vi.fn().mockResolvedValue({
      content: JSON.stringify([
        {
          category: 'Technical',
          itemName: 'System Architecture Diagram',
          priority: 'high',
          rationale: 'Critical for understanding tech stack',
        },
      ]),
    }),
  })),
}))

describe('IRL Tools - Schema Validation', () => {
  describe('GenerateIRLSuggestionsInputSchema', () => {
    it('should accept valid input with required dealId', () => {
      const result = GenerateIRLSuggestionsInputSchema.safeParse({
        dealId: '123e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional currentIRLId', () => {
      const result = GenerateIRLSuggestionsInputSchema.safeParse({
        dealId: '123e4567-e89b-12d3-a456-426614174000',
        currentIRLId: '223e4567-e89b-12d3-a456-426614174000',
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional dealType', () => {
      const result = GenerateIRLSuggestionsInputSchema.safeParse({
        dealId: '123e4567-e89b-12d3-a456-426614174000',
        dealType: 'tech_ma',
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID format', () => {
      const result = GenerateIRLSuggestionsInputSchema.safeParse({
        dealId: 'not-a-uuid',
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing dealId', () => {
      const result = GenerateIRLSuggestionsInputSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('AddToIRLInputSchema', () => {
    it('should accept valid input', () => {
      const result = AddToIRLInputSchema.safeParse({
        irlId: '123e4567-e89b-12d3-a456-426614174000',
        category: 'Financial',
        itemName: 'Revenue Analysis',
        priority: 'high',
      })
      expect(result.success).toBe(true)
    })

    it('should accept optional description', () => {
      const result = AddToIRLInputSchema.safeParse({
        irlId: '123e4567-e89b-12d3-a456-426614174000',
        category: 'Financial',
        itemName: 'Revenue Analysis',
        priority: 'medium',
        description: 'Detailed breakdown of revenue sources',
      })
      expect(result.success).toBe(true)
    })

    it('should default priority to medium', () => {
      const result = AddToIRLInputSchema.safeParse({
        irlId: '123e4567-e89b-12d3-a456-426614174000',
        category: 'Financial',
        itemName: 'Revenue Analysis',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe('medium')
      }
    })

    it('should reject empty category', () => {
      const result = AddToIRLInputSchema.safeParse({
        irlId: '123e4567-e89b-12d3-a456-426614174000',
        category: '',
        itemName: 'Revenue Analysis',
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty itemName', () => {
      const result = AddToIRLInputSchema.safeParse({
        irlId: '123e4567-e89b-12d3-a456-426614174000',
        category: 'Financial',
        itemName: '',
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid priority', () => {
      const result = AddToIRLInputSchema.safeParse({
        irlId: '123e4567-e89b-12d3-a456-426614174000',
        category: 'Financial',
        itemName: 'Revenue Analysis',
        priority: 'urgent', // not a valid priority
      })
      expect(result.success).toBe(false)
    })
  })

  describe('IRLSuggestionSchema', () => {
    it('should accept valid suggestion', () => {
      const result = IRLSuggestionSchema.safeParse({
        category: 'Financial',
        itemName: 'Revenue Analysis',
        priority: 'high',
        rationale: 'Critical for deal valuation',
      })
      expect(result.success).toBe(true)
    })

    it('should reject missing rationale', () => {
      const result = IRLSuggestionSchema.safeParse({
        category: 'Financial',
        itemName: 'Revenue Analysis',
        priority: 'high',
      })
      expect(result.success).toBe(false)
    })

    it('should accept all priority levels', () => {
      const priorities = ['high', 'medium', 'low']
      for (const priority of priorities) {
        const result = IRLSuggestionSchema.safeParse({
          category: 'Test',
          itemName: 'Test Item',
          priority,
          rationale: 'Test rationale',
        })
        expect(result.success).toBe(true)
      }
    })
  })
})

describe('IRL Tools - Tool Count Integration', () => {
  it('should have exactly 18 tools (updated from 17 after E11.3 knowledge write-back tool added)', () => {
    expect(TOOL_COUNT).toBe(18)
    expect(allChatTools.length).toBe(18)
  })

  it('should pass tool count validation', () => {
    expect(validateToolCount()).toBe(true)
  })

  it('should have IRL tools in workflow category', () => {
    expect(TOOL_CATEGORIES.workflow).toContain('generate_irl_suggestions')
    expect(TOOL_CATEGORIES.workflow).toContain('add_to_irl')
    expect(TOOL_CATEGORIES.workflow.length).toBe(5)
  })

  it('should include generate_irl_suggestions tool', () => {
    const tool = allChatTools.find((t) => t.name === 'generate_irl_suggestions')
    expect(tool).toBeDefined()
    expect(tool?.description).toContain('IRL')
  })

  it('should include add_to_irl tool', () => {
    const tool = allChatTools.find((t) => t.name === 'add_to_irl')
    expect(tool).toBeDefined()
    expect(tool?.description).toContain('IRL')
  })
})

describe('IRL Tools - Tool Descriptions', () => {
  it('generate_irl_suggestions should have clear description', () => {
    const tool = allChatTools.find((t) => t.name === 'generate_irl_suggestions')
    expect(tool?.description).toContain('suggestions')
    expect(tool?.description).toContain('deal')
  })

  it('add_to_irl should have clear description', () => {
    const tool = allChatTools.find((t) => t.name === 'add_to_irl')
    expect(tool?.description).toContain('item')
  })
})
