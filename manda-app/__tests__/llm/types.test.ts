/**
 * LLM Types and Structured Output Tests
 *
 * Tests for types.ts - Zod schemas and structured output validation
 * Story: E5.1 - Integrate LLM via LangChain (AC: 5, 6)
 */

import { describe, it, expect } from 'vitest'
import {
  FindingSchema,
  FindingsResponseSchema,
  ChatResponseSchema,
  SourceCitationSchema,
  QAPairSchema,
  ContradictionSchema,
  GapSchema,
  ErrorResponseSchema,
  validateResponse,
  safeParseResponse,
  describeSchema,
  Schemas,
} from '@/lib/llm/types'

describe('Zod Schema Validation', () => {
  describe('FindingSchema', () => {
    it('validates a valid finding', () => {
      const finding = {
        text: 'Q3 2024 revenue was €5.2M, up 15% YoY',
        confidence: 0.95,
        domain: 'financial',
        sourceLocation: 'Page 12, Section 3.2',
        dateReferenced: '2024-09-30T00:00:00Z',
      }

      const result = FindingSchema.safeParse(finding)
      expect(result.success).toBe(true)
    })

    it('rejects finding with text too short', () => {
      const finding = {
        text: 'short',
        confidence: 0.8,
        domain: 'financial',
      }

      const result = FindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })

    it('rejects confidence outside 0-1 range', () => {
      const finding = {
        text: 'This is a valid finding text',
        confidence: 1.5,
        domain: 'financial',
      }

      const result = FindingSchema.safeParse(finding)
      expect(result.success).toBe(false)
    })

    it('allows optional fields to be omitted', () => {
      const finding = {
        text: 'This is a valid finding text',
        confidence: 0.8,
        domain: 'financial',
      }

      const result = FindingSchema.safeParse(finding)
      expect(result.success).toBe(true)
    })
  })

  describe('SourceCitationSchema', () => {
    it('validates a valid source citation', () => {
      const source = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        documentName: 'Q3_2024_Report.pdf',
        location: 'Page 12',
        textSnippet: 'Revenue increased to...',
      }

      const result = SourceCitationSchema.safeParse(source)
      expect(result.success).toBe(true)
    })

    it('rejects invalid UUID for documentId', () => {
      const source = {
        documentId: 'not-a-uuid',
        documentName: 'test.pdf',
        location: 'Page 1',
      }

      const result = SourceCitationSchema.safeParse(source)
      expect(result.success).toBe(false)
    })

    it('truncates long text snippets validation', () => {
      const source = {
        documentId: '550e8400-e29b-41d4-a716-446655440000',
        documentName: 'test.pdf',
        location: 'Page 1',
        textSnippet: 'x'.repeat(600), // Exceeds 500 char limit
      }

      const result = SourceCitationSchema.safeParse(source)
      expect(result.success).toBe(false)
    })
  })

  describe('ChatResponseSchema', () => {
    it('validates a valid chat response', () => {
      const response = {
        content: 'Based on the Q3 report, revenue was €5.2M.',
        sources: [
          {
            documentId: '550e8400-e29b-41d4-a716-446655440000',
            documentName: 'Q3_Report.pdf',
            location: 'Page 12',
          },
        ],
        suggestedFollowups: ['How does this compare to Q2?'],
        confidence: 0.9,
      }

      const result = ChatResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
    })

    it('defaults sources to empty array', () => {
      const response = {
        content: 'I could not find relevant information.',
      }

      const result = ChatResponseSchema.safeParse(response)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.sources).toEqual([])
      }
    })

    it('limits suggested followups to 5', () => {
      const response = {
        content: 'Some content',
        suggestedFollowups: [
          'Q1', 'Q2', 'Q3', 'Q4', 'Q5', 'Q6', // 6 items
        ],
      }

      const result = ChatResponseSchema.safeParse(response)
      expect(result.success).toBe(false)
    })
  })

  describe('QAPairSchema', () => {
    it('validates a valid Q&A pair', () => {
      const qa = {
        question: 'What was the Q3 2024 revenue?',
        answer: 'Q3 2024 revenue was €5.2M according to the financial report.',
        sources: [],
        priority: 'high',
      }

      const result = QAPairSchema.safeParse(qa)
      expect(result.success).toBe(true)
    })

    it('defaults priority to medium', () => {
      const qa = {
        question: 'What was the Q3 2024 revenue?',
        answer: 'Q3 2024 revenue was €5.2M according to the financial report.',
      }

      const result = QAPairSchema.safeParse(qa)
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.priority).toBe('medium')
      }
    })

    it('validates priority enum values', () => {
      const qa = {
        question: 'Valid question here',
        answer: 'Valid answer here too',
        priority: 'critical', // Invalid
      }

      const result = QAPairSchema.safeParse(qa)
      expect(result.success).toBe(false)
    })
  })

  describe('ContradictionSchema', () => {
    it('validates a valid contradiction', () => {
      const contradiction = {
        findingA: {
          text: 'Revenue was €5.2M',
          source: 'Q3_Report.pdf',
        },
        findingB: {
          text: 'Revenue was €4.8M',
          source: 'Management_Deck.pptx',
        },
        explanation: 'Different revenue figures reported in different documents',
        severity: 'high',
        confidence: 0.85,
      }

      const result = ContradictionSchema.safeParse(contradiction)
      expect(result.success).toBe(true)
    })

    it('validates severity enum', () => {
      const contradiction = {
        findingA: { text: 'Finding A', source: 'A.pdf' },
        findingB: { text: 'Finding B', source: 'B.pdf' },
        explanation: 'Contradiction explanation',
        severity: 'critical', // Invalid
        confidence: 0.8,
      }

      const result = ContradictionSchema.safeParse(contradiction)
      expect(result.success).toBe(false)
    })
  })

  describe('GapSchema', () => {
    it('validates a valid gap', () => {
      const gap = {
        category: 'financial',
        description: 'Missing Q4 2024 financial statements',
        priority: 'high',
        suggestedAction: 'Request Q4 statements from management',
      }

      const result = GapSchema.safeParse(gap)
      expect(result.success).toBe(true)
    })

    it('allows optional suggestedAction', () => {
      const gap = {
        category: 'legal',
        description: 'No employment contracts provided',
        priority: 'medium',
      }

      const result = GapSchema.safeParse(gap)
      expect(result.success).toBe(true)
    })
  })

  describe('ErrorResponseSchema', () => {
    it('validates an error response', () => {
      const error = {
        success: false,
        error: 'Failed to connect to database',
        code: 'DB_CONNECTION_ERROR',
      }

      const result = ErrorResponseSchema.safeParse(error)
      expect(result.success).toBe(true)
    })

    it('requires success to be false', () => {
      const error = {
        success: true,
        error: 'This should fail',
      }

      const result = ErrorResponseSchema.safeParse(error)
      expect(result.success).toBe(false)
    })
  })
})

describe('Validation Utilities', () => {
  describe('validateResponse', () => {
    it('returns validated data for valid input', () => {
      const data = {
        text: 'This is a valid finding text',
        confidence: 0.8,
        domain: 'financial',
      }

      const result = validateResponse(FindingSchema, data)
      expect(result).toEqual(data)
    })

    it('throws descriptive error for invalid input', () => {
      const data = {
        text: 'short',
        confidence: 2.0, // Invalid
        domain: 'financial',
      }

      expect(() => validateResponse(FindingSchema, data)).toThrow(
        'Response validation failed'
      )
    })
  })

  describe('safeParseResponse', () => {
    it('returns data for valid input', () => {
      const data = {
        text: 'This is a valid finding text',
        confidence: 0.8,
        domain: 'financial',
      }

      const result = safeParseResponse(FindingSchema, data)
      expect(result).toEqual(data)
    })

    it('returns null for invalid input', () => {
      const data = {
        text: 'short',
        confidence: 2.0, // Invalid
      }

      const result = safeParseResponse(FindingSchema, data)
      expect(result).toBeNull()
    })
  })

  describe('describeSchema', () => {
    it('generates description for object schema', () => {
      const description = describeSchema(FindingSchema)
      expect(description).toContain('Object with fields')
      expect(description).toContain('text')
      expect(description).toContain('confidence')
    })
  })
})

describe('Schemas Export', () => {
  it('exports all schemas', () => {
    expect(Schemas.Finding).toBeDefined()
    expect(Schemas.FindingsResponse).toBeDefined()
    expect(Schemas.ChatResponse).toBeDefined()
    expect(Schemas.SourceCitation).toBeDefined()
    expect(Schemas.QAPair).toBeDefined()
    expect(Schemas.QAListResponse).toBeDefined()
    expect(Schemas.Contradiction).toBeDefined()
    expect(Schemas.ContradictionsResponse).toBeDefined()
    expect(Schemas.Gap).toBeDefined()
    expect(Schemas.GapsResponse).toBeDefined()
    expect(Schemas.ErrorResponse).toBeDefined()
  })
})

describe('FindingsResponseSchema', () => {
  it('validates a findings response with multiple findings', () => {
    const response = {
      findings: [
        {
          text: 'Q3 revenue was €5.2M',
          confidence: 0.95,
          domain: 'financial',
        },
        {
          text: 'Employee count is 150 FTEs',
          confidence: 0.88,
          domain: 'operational',
        },
      ],
      totalCount: 2,
      confidence: 0.91,
    }

    const result = FindingsResponseSchema.safeParse(response)
    expect(result.success).toBe(true)
  })

  it('requires totalCount to be non-negative', () => {
    const response = {
      findings: [],
      totalCount: -1,
    }

    const result = FindingsResponseSchema.safeParse(response)
    expect(result.success).toBe(false)
  })
})
