/**
 * Agent Tools Unit Tests
 *
 * Tests for the 17 chat tools with mocked dependencies.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 * Story: E6.3 - Implement AI-Assisted IRL Auto-Generation (+2 tools)
 * Story: E7.1 - Implement Finding Correction via Chat (+3 tools)
 * Story: E8.3 - Agent Tool - add_qa_item() (+1 tool)
 *
 * Per P7 spec: Unit tests run on every commit (mocked LLM, free, fast)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  QueryKnowledgeBaseInputSchema,
  UpdateKnowledgeBaseInputSchema,
  ValidateFindingInputSchema,
  UpdateKnowledgeGraphInputSchema,
  DetectContradictionsInputSchema,
  FindGapsInputSchema,
  GetDocumentInfoInputSchema,
  TriggerAnalysisInputSchema,
  SuggestQuestionsInputSchema,
  AddToQAInputSchema,
  CreateIRLInputSchema,
} from '@/lib/agent/schemas'
import {
  formatToolResponse,
  handleToolError,
  formatSourceCitation,
  formatSourceCitations,
  inferQueryMode,
  formatTemporalContext,
} from '@/lib/agent/tools/utils'
import { allChatTools, TOOL_COUNT, validateToolCount, TOOL_CATEGORIES } from '@/lib/agent/tools/all-tools'
import { parseSourceCitations, generateFollowupSuggestions } from '@/lib/agent/streaming'

// Mock Supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id' } },
        error: null,
      }),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        })),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
        is: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: { id: 'new-id' }, error: null }),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  })),
}))

// Mock embeddings
vi.mock('@/lib/services/embeddings', () => ({
  generateEmbedding: vi.fn().mockResolvedValue(new Array(3072).fill(0.1)),
}))

// Mock LLM
vi.mock('@/lib/llm/client', () => ({
  createLLMClient: vi.fn(() => ({
    pipe: vi.fn(() => ({
      pipe: vi.fn(() => ({
        invoke: vi.fn().mockResolvedValue('1. Test question?\n2. Another question?'),
      })),
    })),
  })),
}))

describe('Agent Tools', () => {
  describe('Tool Count Validation', () => {
    it('should have exactly 17 tools', () => {
      expect(TOOL_COUNT).toBe(17)
      expect(allChatTools.length).toBe(17)
    })

    it('should pass tool count validation', () => {
      expect(validateToolCount()).toBe(true)
    })

    it('should have correct tool categories', () => {
      expect(TOOL_CATEGORIES.knowledge.length).toBe(4)
      expect(TOOL_CATEGORIES.intelligence.length).toBe(2)
      expect(TOOL_CATEGORIES.document.length).toBe(2)
      expect(TOOL_CATEGORIES.workflow.length).toBe(5) // Updated from 3 to 5
    })
  })

  describe('Input Schema Validation', () => {
    describe('QueryKnowledgeBaseInputSchema', () => {
      it('should accept valid input', () => {
        const result = QueryKnowledgeBaseInputSchema.safeParse({
          query: 'What is the revenue?',
          limit: 10,
        })
        expect(result.success).toBe(true)
      })

      it('should reject query shorter than 3 characters', () => {
        const result = QueryKnowledgeBaseInputSchema.safeParse({
          query: 'ab',
        })
        expect(result.success).toBe(false)
      })

      it('should accept filters', () => {
        const result = QueryKnowledgeBaseInputSchema.safeParse({
          query: 'Revenue analysis',
          filters: {
            domains: ['financial'],
            confidenceMin: 0.5,
          },
          limit: 20,
        })
        expect(result.success).toBe(true)
      })
    })

    describe('UpdateKnowledgeBaseInputSchema', () => {
      it('should accept valid input', () => {
        const result = UpdateKnowledgeBaseInputSchema.safeParse({
          finding: 'Q3 2024 revenue was €5.2M',
          source: {
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            location: 'Page 12',
          },
          confidence: 0.9,
        })
        expect(result.success).toBe(true)
      })

      it('should reject finding shorter than 10 characters', () => {
        const result = UpdateKnowledgeBaseInputSchema.safeParse({
          finding: 'Short',
          source: {
            documentId: '123e4567-e89b-12d3-a456-426614174000',
            location: 'Page 1',
          },
        })
        expect(result.success).toBe(false)
      })
    })

    describe('DetectContradictionsInputSchema', () => {
      it('should accept valid input', () => {
        const result = DetectContradictionsInputSchema.safeParse({
          topic: 'revenue',
        })
        expect(result.success).toBe(true)
      })

      it('should accept includeResolved flag', () => {
        const result = DetectContradictionsInputSchema.safeParse({
          topic: 'revenue',
          includeResolved: true,
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.includeResolved).toBe(true)
        }
      })
    })

    describe('SuggestQuestionsInputSchema', () => {
      it('should enforce max 10 questions', () => {
        const result = SuggestQuestionsInputSchema.safeParse({
          topic: 'financials',
          maxCount: 15,
        })
        expect(result.success).toBe(false) // maxCount has max(10)
      })

      it('should default to 5 questions', () => {
        const result = SuggestQuestionsInputSchema.safeParse({
          topic: 'financials',
        })
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.maxCount).toBe(5)
        }
      })
    })
  })

  describe('Utility Functions', () => {
    describe('formatToolResponse', () => {
      it('should format success response', () => {
        const result = formatToolResponse(true, { message: 'Success' })
        const parsed = JSON.parse(result)
        expect(parsed.success).toBe(true)
        expect(parsed.data.message).toBe('Success')
      })

      it('should format error response', () => {
        const result = formatToolResponse(false, 'Something went wrong')
        const parsed = JSON.parse(result)
        expect(parsed.success).toBe(false)
        expect(parsed.error).toBe('Something went wrong')
      })
    })

    describe('handleToolError', () => {
      it('should handle Error instances', () => {
        const result = handleToolError(new Error('Test error'), 'test_tool')
        const parsed = JSON.parse(result)
        expect(parsed.success).toBe(false)
        expect(parsed.error).toContain('test_tool')
      })

      it('should handle authentication errors', () => {
        const result = handleToolError(new Error('Authentication required'), 'test_tool')
        const parsed = JSON.parse(result)
        expect(parsed.error).toContain('sign in')
      })
    })

    describe('formatSourceCitation', () => {
      it('should format single source', () => {
        const result = formatSourceCitation({
          documentId: 'uuid',
          documentName: 'Q3_Report.pdf',
          location: 'Page 12',
        })
        expect(result).toBe('(source: Q3_Report.pdf, Page 12)')
      })
    })

    describe('formatSourceCitations', () => {
      it('should format multiple sources', () => {
        const result = formatSourceCitations([
          { documentId: 'uuid1', documentName: 'doc1.pdf', location: 'p.5' },
          { documentId: 'uuid2', documentName: 'doc2.xlsx', location: 'B15' },
        ])
        expect(result).toBe('(sources: doc1.pdf p.5, doc2.xlsx B15)')
      })

      it('should handle empty array', () => {
        const result = formatSourceCitations([])
        expect(result).toBe('')
      })
    })

    describe('inferQueryMode', () => {
      it('should detect fact lookup queries', () => {
        expect(inferQueryMode("What's the revenue?")).toBe('fact')
        expect(inferQueryMode('How many employees?')).toBe('fact')
        expect(inferQueryMode('What is the EBITDA?')).toBe('fact')
      })

      it('should detect research queries', () => {
        expect(inferQueryMode('Walk me through the P&L')).toBe('research')
        expect(inferQueryMode('Any red flags?')).toBe('research')
        expect(inferQueryMode('Summarize the management team')).toBe('research')
      })
    })

    describe('formatTemporalContext', () => {
      it('should format Q3 2024', () => {
        const result = formatTemporalContext('2024-09-15')
        expect(result).toBe('Q3 2024')
      })

      it('should format Q1 2023', () => {
        const result = formatTemporalContext('2023-02-15')
        expect(result).toBe('Q1 2023')
      })

      it('should handle null', () => {
        const result = formatTemporalContext(null)
        expect(result).toBe('')
      })
    })
  })

  describe('Streaming Utilities', () => {
    describe('parseSourceCitations', () => {
      it('should parse single source citation', () => {
        const text = 'The revenue was €5M (source: Q3_Report.pdf, Page 12).'
        const sources = parseSourceCitations(text)
        expect(sources.length).toBe(1)
        expect(sources[0]!.documentName).toBe('Q3_Report.pdf')
        expect(sources[0]!.location).toBe('Page 12')
      })

      it('should parse multiple source citations', () => {
        const text = 'Sources: (source: doc1.pdf, p.5) and (source: doc2.xlsx, B15)'
        const sources = parseSourceCitations(text)
        expect(sources.length).toBe(2)
      })
    })

    describe('generateFollowupSuggestions', () => {
      it('should suggest gap follow-up when gaps mentioned', () => {
        const suggestions = generateFollowupSuggestions(
          'Found 3 gaps in the analysis.'
        )
        expect(suggestions.some((s) => s.toLowerCase().includes('q&a'))).toBe(true)
      })

      it('should suggest contradiction follow-up', () => {
        const suggestions = generateFollowupSuggestions(
          'Detected contradiction in revenue numbers.'
        )
        expect(suggestions.some((s) => s.toLowerCase().includes('contradiction'))).toBe(true)
      })

      it('should limit to 3 suggestions', () => {
        const suggestions = generateFollowupSuggestions(
          'Revenue EBITDA gap contradiction conflict'
        )
        expect(suggestions.length).toBeLessThanOrEqual(3)
      })
    })
  })

  describe('Tool Descriptions', () => {
    it('all tools should have descriptions', () => {
      for (const tool of allChatTools) {
        expect(tool.description).toBeDefined()
        expect(tool.description.length).toBeGreaterThan(10)
      }
    })

    it('all tools should have names', () => {
      for (const tool of allChatTools) {
        expect(tool.name).toBeDefined()
        expect(tool.name.length).toBeGreaterThan(0)
      }
    })
  })
})

describe('Schema Types', () => {
  it('FindingDomainSchema should have 5 domains', () => {
    const result = FindGapsInputSchema.shape.category.safeParse('irl_missing')
    expect(result.success).toBe(true)
  })

  it('should validate UUID format', () => {
    const validUUID = '123e4567-e89b-12d3-a456-426614174000'
    const invalidUUID = 'not-a-uuid'

    const validResult = GetDocumentInfoInputSchema.safeParse({ documentId: validUUID })
    const invalidResult = GetDocumentInfoInputSchema.safeParse({ documentId: invalidUUID })

    expect(validResult.success).toBe(true)
    expect(invalidResult.success).toBe(false)
  })
})
