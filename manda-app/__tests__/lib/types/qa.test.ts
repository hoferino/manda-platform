/**
 * Q&A Types Unit Tests
 * Story: E8.1 - Q&A Data Model and CRUD API
 * Tests for Zod validation, helper functions, and type utilities
 */

import { describe, it, expect } from 'vitest'
import {
  // Types
  QAItem,
  QACategory,
  QAPriority,
  QASummary,
  CreateQAItemInput,
  UpdateQAItemInput,
  QAConflictError,
  // Schemas
  CreateQAItemInputSchema,
  UpdateQAItemInputSchema,
  QAFiltersSchema,
  QACategorySchema,
  QAPrioritySchema,
  // Helper functions
  isPending,
  isAnswered,
  getQAItemStatus,
  isQAConflictError,
  getCategoryInfo,
  getPriorityInfo,
  mapDbRowToQAItem,
  mapQAItemToDbInsert,
  mapQAItemToDbUpdate,
  calculateQASummary,
  // Constants
  QA_CATEGORIES,
  QA_PRIORITIES,
} from '@/lib/types/qa'

// ============================================================================
// Test Fixtures
// ============================================================================

const mockPendingItem: QAItem = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  dealId: '123e4567-e89b-12d3-a456-426614174001',
  question: 'What is the revenue growth rate for 2023?',
  category: 'Financials',
  priority: 'high',
  answer: null,
  comment: null,
  sourceFindingId: null,
  createdBy: '123e4567-e89b-12d3-a456-426614174002',
  dateAdded: '2024-01-15T10:00:00Z',
  dateAnswered: null,
  updatedAt: '2024-01-15T10:00:00Z',
}

const mockAnsweredItem: QAItem = {
  ...mockPendingItem,
  id: '123e4567-e89b-12d3-a456-426614174003',
  answer: 'Revenue grew 15% YoY in 2023.',
  dateAnswered: '2024-01-20T14:30:00Z',
  updatedAt: '2024-01-20T14:30:00Z',
}

// ============================================================================
// Constants Tests
// ============================================================================

describe('Q&A Constants', () => {
  it('should have 6 valid categories', () => {
    expect(QA_CATEGORIES).toHaveLength(6)
    expect(QA_CATEGORIES).toContain('Financials')
    expect(QA_CATEGORIES).toContain('Legal')
    expect(QA_CATEGORIES).toContain('Operations')
    expect(QA_CATEGORIES).toContain('Market')
    expect(QA_CATEGORIES).toContain('Technology')
    expect(QA_CATEGORIES).toContain('HR')
  })

  it('should have 3 valid priorities', () => {
    expect(QA_PRIORITIES).toHaveLength(3)
    expect(QA_PRIORITIES).toContain('high')
    expect(QA_PRIORITIES).toContain('medium')
    expect(QA_PRIORITIES).toContain('low')
  })
})

// ============================================================================
// Zod Schema Tests
// ============================================================================

describe('CreateQAItemInputSchema', () => {
  it('should validate valid input', () => {
    const input: CreateQAItemInput = {
      question: 'What is the total revenue for Q4 2023?',
      category: 'Financials',
      priority: 'high',
    }

    const result = CreateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.question).toBe(input.question)
      expect(result.data.category).toBe('Financials')
      expect(result.data.priority).toBe('high')
    }
  })

  it('should default priority to medium', () => {
    const input = {
      question: 'What is the employee count?',
      category: 'HR',
    }

    const result = CreateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('medium')
    }
  })

  it('should reject question shorter than 10 characters', () => {
    const input = {
      question: 'Revenue?',
      category: 'Financials',
    }

    const result = CreateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      expect(firstIssue).toBeDefined()
      expect(firstIssue?.message).toContain('at least 10 characters')
    }
  })

  it('should reject invalid category', () => {
    const input = {
      question: 'What is the marketing budget?',
      category: 'Marketing', // Invalid category
    }

    const result = CreateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should reject invalid priority', () => {
    const input = {
      question: 'What is the employee count?',
      category: 'HR',
      priority: 'urgent', // Invalid priority
    }

    const result = CreateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should accept optional sourceFindingId as valid UUID', () => {
    const input = {
      question: 'Can you clarify this inconsistency?',
      category: 'Legal',
      sourceFindingId: '123e4567-e89b-12d3-a456-426614174000',
    }

    const result = CreateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('should reject invalid sourceFindingId (not UUID)', () => {
    const input = {
      question: 'Can you clarify this inconsistency?',
      category: 'Legal',
      sourceFindingId: 'not-a-uuid',
    }

    const result = CreateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})

describe('UpdateQAItemInputSchema', () => {
  it('should require updatedAt for optimistic locking', () => {
    const input = {
      question: 'Updated question text here.',
    }

    const result = UpdateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(false)
    if (!result.success) {
      const updatedAtError = result.error.issues.find(i => i.path.includes('updatedAt'))
      expect(updatedAtError).toBeDefined()
    }
  })

  it('should validate update with updatedAt', () => {
    const input: UpdateQAItemInput = {
      question: 'Updated question text here.',
      updatedAt: '2024-01-15T10:00:00Z',
    }

    const result = UpdateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('should allow updating only specific fields', () => {
    const input: UpdateQAItemInput = {
      priority: 'low',
      updatedAt: '2024-01-15T10:00:00Z',
    }

    const result = UpdateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.priority).toBe('low')
      expect(result.data.question).toBeUndefined()
    }
  })

  it('should allow setting answer and dateAnswered', () => {
    const input: UpdateQAItemInput = {
      answer: 'The revenue is $10M',
      dateAnswered: '2024-01-20T14:30:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    }

    const result = UpdateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('should allow null values for answer and dateAnswered', () => {
    const input: UpdateQAItemInput = {
      answer: null,
      dateAnswered: null,
      updatedAt: '2024-01-15T10:00:00Z',
    }

    const result = UpdateQAItemInputSchema.safeParse(input)
    expect(result.success).toBe(true)
  })
})

describe('QAFiltersSchema', () => {
  it('should parse empty filters with defaults', () => {
    const result = QAFiltersSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.limit).toBe(50)
      expect(result.data.offset).toBe(0)
    }
  })

  it('should parse all filter options', () => {
    const input = {
      category: 'Financials',
      priority: 'high',
      status: 'pending',
      limit: '25',
      offset: '10',
    }

    const result = QAFiltersSchema.safeParse(input)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe('Financials')
      expect(result.data.priority).toBe('high')
      expect(result.data.status).toBe('pending')
      expect(result.data.limit).toBe(25)
      expect(result.data.offset).toBe(10)
    }
  })

  it('should cap limit at 100', () => {
    const result = QAFiltersSchema.safeParse({ limit: '200' })
    expect(result.success).toBe(false) // Max is 100
  })
})

// ============================================================================
// Helper Function Tests
// ============================================================================

describe('isPending', () => {
  it('should return true for item with null dateAnswered', () => {
    expect(isPending(mockPendingItem)).toBe(true)
  })

  it('should return false for item with dateAnswered', () => {
    expect(isPending(mockAnsweredItem)).toBe(false)
  })
})

describe('isAnswered', () => {
  it('should return false for item with null dateAnswered', () => {
    expect(isAnswered(mockPendingItem)).toBe(false)
  })

  it('should return true for item with dateAnswered', () => {
    expect(isAnswered(mockAnsweredItem)).toBe(true)
  })
})

describe('getQAItemStatus', () => {
  it('should return "pending" for unanswered item', () => {
    expect(getQAItemStatus(mockPendingItem)).toBe('pending')
  })

  it('should return "answered" for answered item', () => {
    expect(getQAItemStatus(mockAnsweredItem)).toBe('answered')
  })
})

describe('isQAConflictError', () => {
  it('should return true for conflict error object', () => {
    const error: QAConflictError = {
      type: 'conflict',
      message: 'Item was modified',
      currentItem: mockPendingItem,
      yourChanges: { question: 'New question' },
    }

    expect(isQAConflictError(error)).toBe(true)
  })

  it('should return false for regular Error', () => {
    expect(isQAConflictError(new Error('Something went wrong'))).toBe(false)
  })

  it('should return false for null', () => {
    expect(isQAConflictError(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isQAConflictError(undefined)).toBe(false)
  })

  it('should return false for object without type', () => {
    expect(isQAConflictError({ message: 'Error' })).toBe(false)
  })
})

describe('getCategoryInfo', () => {
  it('should return correct info for Financials', () => {
    const info = getCategoryInfo('Financials')
    expect(info.label).toBe('Financials')
    expect(info.color).toContain('green')
  })

  it('should return correct info for Legal', () => {
    const info = getCategoryInfo('Legal')
    expect(info.label).toBe('Legal')
    expect(info.color).toContain('purple')
  })
})

describe('getPriorityInfo', () => {
  it('should return correct info for high priority', () => {
    const info = getPriorityInfo('high')
    expect(info.label).toBe('High')
    expect(info.color).toContain('red')
  })

  it('should return correct info for medium priority', () => {
    const info = getPriorityInfo('medium')
    expect(info.label).toBe('Medium')
    expect(info.color).toContain('yellow')
  })

  it('should return correct info for low priority', () => {
    const info = getPriorityInfo('low')
    expect(info.label).toBe('Low')
    expect(info.color).toContain('gray')
  })
})

// ============================================================================
// Mapping Function Tests
// ============================================================================

describe('mapDbRowToQAItem', () => {
  it('should correctly map database row to QAItem', () => {
    const dbRow = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      deal_id: '123e4567-e89b-12d3-a456-426614174001',
      question: 'What is the revenue?',
      category: 'Financials',
      priority: 'high',
      answer: null,
      comment: 'Please clarify',
      source_finding_id: '123e4567-e89b-12d3-a456-426614174002',
      created_by: '123e4567-e89b-12d3-a456-426614174003',
      date_added: '2024-01-15T10:00:00Z',
      date_answered: null,
      updated_at: '2024-01-15T10:00:00Z',
    }

    const item = mapDbRowToQAItem(dbRow)

    expect(item.id).toBe(dbRow.id)
    expect(item.dealId).toBe(dbRow.deal_id)
    expect(item.question).toBe(dbRow.question)
    expect(item.category).toBe('Financials')
    expect(item.priority).toBe('high')
    expect(item.answer).toBeNull()
    expect(item.comment).toBe('Please clarify')
    expect(item.sourceFindingId).toBe(dbRow.source_finding_id)
    expect(item.createdBy).toBe(dbRow.created_by)
    expect(item.dateAdded).toBe(dbRow.date_added)
    expect(item.dateAnswered).toBeNull()
    expect(item.updatedAt).toBe(dbRow.updated_at)
  })

  it('should default priority to medium if invalid', () => {
    const dbRow = {
      id: '123',
      deal_id: '456',
      question: 'Test?',
      category: 'Financials',
      priority: null,
      answer: null,
      comment: null,
      source_finding_id: null,
      created_by: null,
      date_added: '2024-01-15T10:00:00Z',
      date_answered: null,
      updated_at: '2024-01-15T10:00:00Z',
    }

    const item = mapDbRowToQAItem(dbRow as Parameters<typeof mapDbRowToQAItem>[0])
    expect(item.priority).toBe('medium')
  })
})

describe('mapQAItemToDbInsert', () => {
  it('should correctly map input to database insert format', () => {
    const input: CreateQAItemInput = {
      question: 'What is the revenue?',
      category: 'Financials',
      priority: 'high',
      sourceFindingId: '123e4567-e89b-12d3-a456-426614174000',
      comment: 'Urgent request',
    }

    const dealId = '123e4567-e89b-12d3-a456-426614174001'
    const userId = '123e4567-e89b-12d3-a456-426614174002'

    const dbInsert = mapQAItemToDbInsert(input, dealId, userId)

    expect(dbInsert.deal_id).toBe(dealId)
    expect(dbInsert.question).toBe(input.question)
    expect(dbInsert.category).toBe(input.category)
    expect(dbInsert.priority).toBe(input.priority)
    expect(dbInsert.source_finding_id).toBe(input.sourceFindingId)
    expect(dbInsert.comment).toBe(input.comment)
    expect(dbInsert.created_by).toBe(userId)
  })

  it('should default priority to medium if not provided', () => {
    const input: CreateQAItemInput = {
      question: 'What is the employee count?',
      category: 'HR',
    }

    const dbInsert = mapQAItemToDbInsert(input, 'deal-id')

    expect(dbInsert.priority).toBe('medium')
  })

  it('should set null for optional fields if not provided', () => {
    const input: CreateQAItemInput = {
      question: 'What is the revenue?',
      category: 'Financials',
    }

    const dbInsert = mapQAItemToDbInsert(input, 'deal-id')

    expect(dbInsert.source_finding_id).toBeNull()
    expect(dbInsert.comment).toBeNull()
    expect(dbInsert.created_by).toBeNull()
  })
})

describe('mapQAItemToDbUpdate', () => {
  it('should only include provided fields', () => {
    const input = {
      question: 'Updated question',
      priority: 'low' as QAPriority,
    }

    const dbUpdate = mapQAItemToDbUpdate(input)

    expect(dbUpdate.question).toBe('Updated question')
    expect(dbUpdate.priority).toBe('low')
    expect(dbUpdate.category).toBeUndefined()
    expect(dbUpdate.answer).toBeUndefined()
  })

  it('should return empty object if no fields provided', () => {
    const dbUpdate = mapQAItemToDbUpdate({})
    expect(Object.keys(dbUpdate)).toHaveLength(0)
  })

  it('should map dateAnswered to date_answered', () => {
    const input = {
      dateAnswered: '2024-01-20T14:30:00Z',
    }

    const dbUpdate = mapQAItemToDbUpdate(input)
    expect(dbUpdate.date_answered).toBe('2024-01-20T14:30:00Z')
  })
})

// ============================================================================
// Summary Calculation Tests
// ============================================================================

describe('calculateQASummary', () => {
  it('should calculate correct summary for empty list', () => {
    const summary = calculateQASummary([])

    expect(summary.total).toBe(0)
    expect(summary.pending).toBe(0)
    expect(summary.answered).toBe(0)
    expect(summary.byCategory.Financials).toBe(0)
    expect(summary.byPriority.high).toBe(0)
  })

  it('should calculate correct summary for mixed items', () => {
    const items: QAItem[] = [
      mockPendingItem, // Financials, high, pending
      mockAnsweredItem, // Financials, high, answered
      {
        ...mockPendingItem,
        id: 'item-3',
        category: 'Legal',
        priority: 'medium',
      },
      {
        ...mockAnsweredItem,
        id: 'item-4',
        category: 'Technology',
        priority: 'low',
      },
    ]

    const summary = calculateQASummary(items)

    expect(summary.total).toBe(4)
    expect(summary.pending).toBe(2)
    expect(summary.answered).toBe(2)
    expect(summary.byCategory.Financials).toBe(2)
    expect(summary.byCategory.Legal).toBe(1)
    expect(summary.byCategory.Technology).toBe(1)
    expect(summary.byCategory.Operations).toBe(0)
    expect(summary.byPriority.high).toBe(2)
    expect(summary.byPriority.medium).toBe(1)
    expect(summary.byPriority.low).toBe(1)
  })
})
