/**
 * Q&A Export Service Tests
 * Story: E8.6 - Excel Export (AC: #1, #2, #3, #5, #6, #7)
 *
 * Tests for the Q&A Excel export service:
 * - generateQAExcel function (integration test with real exceljs)
 * - groupQAItemsByCategory helper
 * - generateQAExportFilename helper
 */

import { describe, it, expect } from 'vitest'
import {
  generateQAExcel,
  generateQAExportFilename,
  groupQAItemsByCategory,
} from '@/lib/services/qa-export'
import type { QAItem, QACategory } from '@/lib/types/qa'

// Helper to create mock QA items
function createMockQAItem(overrides: Partial<QAItem> = {}): QAItem {
  return {
    id: '1',
    dealId: 'deal-1',
    question: 'Test question?',
    category: 'Financials',
    priority: 'medium',
    answer: null,
    comment: null,
    sourceFindingId: null,
    createdBy: 'user-1',
    dateAdded: '2025-12-09T10:00:00Z',
    dateAnswered: null,
    updatedAt: '2025-12-09T10:00:00Z',
    ...overrides,
  }
}

describe('qa-export service', () => {
  describe('groupQAItemsByCategory', () => {
    it('groups items by category in fixed order (AC #3)', () => {
      const items: QAItem[] = [
        createMockQAItem({ id: '1', category: 'Technology' }),
        createMockQAItem({ id: '2', category: 'Financials' }),
        createMockQAItem({ id: '3', category: 'Legal' }),
        createMockQAItem({ id: '4', category: 'Financials' }),
      ]

      const grouped = groupQAItemsByCategory(items)

      // Should follow fixed order: Financials, Legal, Operations, Market, Technology, HR
      const categoryOrder = Array.from(grouped.keys())
      expect(categoryOrder).toEqual(['Financials', 'Legal', 'Technology'])

      // Financials should have 2 items
      expect(grouped.get('Financials')).toHaveLength(2)

      // Legal should have 1 item
      expect(grouped.get('Legal')).toHaveLength(1)

      // Technology should have 1 item
      expect(grouped.get('Technology')).toHaveLength(1)
    })

    it('omits empty categories (AC #3)', () => {
      const items: QAItem[] = [
        createMockQAItem({ id: '1', category: 'Financials' }),
        createMockQAItem({ id: '2', category: 'Legal' }),
      ]

      const grouped = groupQAItemsByCategory(items)

      // Should not include empty categories
      expect(grouped.has('Operations')).toBe(false)
      expect(grouped.has('Market')).toBe(false)
      expect(grouped.has('Technology')).toBe(false)
      expect(grouped.has('HR')).toBe(false)
    })

    it('handles empty input', () => {
      const grouped = groupQAItemsByCategory([])
      expect(grouped.size).toBe(0)
    })

    it('includes all six categories when items exist', () => {
      const categories: QACategory[] = [
        'Financials',
        'Legal',
        'Operations',
        'Market',
        'Technology',
        'HR',
      ]

      const items = categories.map((category, i) =>
        createMockQAItem({ id: String(i), category })
      )

      const grouped = groupQAItemsByCategory(items)

      // All 6 categories should be present in correct order
      expect(Array.from(grouped.keys())).toEqual(categories)
    })
  })

  describe('generateQAExportFilename', () => {
    it('generates filename with company name and date (AC #5)', () => {
      const filename = generateQAExportFilename('Acme Corp')

      // Should follow pattern {company_name}_QA_List_{YYYY-MM-DD}.xlsx
      expect(filename).toMatch(/^Acme_Corp_QA_List_\d{4}-\d{2}-\d{2}\.xlsx$/)
    })

    it('sanitizes special characters in company name (AC #5)', () => {
      const filename = generateQAExportFilename('Company & Co (Holding)')

      // Should replace special chars - result should not contain & or ()
      expect(filename).not.toContain('&')
      expect(filename).not.toContain('(')
      expect(filename).not.toContain(')')
      expect(filename).toMatch(/\.xlsx$/)
    })

    it('handles company names with multiple spaces', () => {
      const filename = generateQAExportFilename('Company   Name   Here')

      // Should normalize spaces to single underscores
      expect(filename).not.toContain('   ')
      expect(filename).toMatch(/^Company_Name_Here_QA_List_/)
    })

    it('defaults to Project when company name is empty', () => {
      const filename = generateQAExportFilename('')

      expect(filename).toMatch(/^Project_QA_List_/)
    })

    it('handles special characters only company name', () => {
      const filename = generateQAExportFilename('!!!@@@###')

      // Should default to Project
      expect(filename).toMatch(/^Project_QA_List_/)
    })
  })

  describe('generateQAExcel', () => {
    it('returns a valid buffer (AC #1)', async () => {
      const items: QAItem[] = [
        createMockQAItem({ id: '1', category: 'Financials' }),
      ]

      const buffer = await generateQAExcel(items, 'Test Project')

      expect(buffer).toBeInstanceOf(Buffer)
      expect(buffer.length).toBeGreaterThan(0)
    })

    it('handles empty items array', async () => {
      const buffer = await generateQAExcel([], 'Test Project')

      expect(buffer).toBeInstanceOf(Buffer)
    })

    it('processes items with all categories', async () => {
      const categories: QACategory[] = [
        'Financials',
        'Legal',
        'Operations',
        'Market',
        'Technology',
        'HR',
      ]

      const items = categories.map((category, i) =>
        createMockQAItem({
          id: String(i),
          category,
          question: `Question for ${category}`,
        })
      )

      // Should not throw
      const buffer = await generateQAExcel(items, 'Multi-Category Project')
      expect(buffer).toBeInstanceOf(Buffer)
    })

    it('processes items with different priorities (AC #6)', async () => {
      const items: QAItem[] = [
        createMockQAItem({ id: '1', priority: 'high' }),
        createMockQAItem({ id: '2', priority: 'medium' }),
        createMockQAItem({ id: '3', priority: 'low' }),
      ]

      // Should not throw - colors should be applied
      const buffer = await generateQAExcel(items, 'Priority Test')
      expect(buffer).toBeInstanceOf(Buffer)
    })

    it('handles answered and pending items (AC #7)', async () => {
      const items: QAItem[] = [
        // Pending item - dateAnswered is null
        createMockQAItem({
          id: '1',
          dateAnswered: null,
          answer: null,
        }),
        // Answered item - dateAnswered has value
        createMockQAItem({
          id: '2',
          dateAnswered: '2025-12-09T12:00:00Z',
          answer: 'This is the answer',
        }),
      ]

      // Should not throw
      const buffer = await generateQAExcel(items, 'Answer Status Test')
      expect(buffer).toBeInstanceOf(Buffer)
    })

    it('processes long question text with wrapping', async () => {
      const longQuestion = 'This is a very long question '.repeat(20)

      const items: QAItem[] = [
        createMockQAItem({
          id: '1',
          question: longQuestion,
        }),
      ]

      // Should not throw - text wrapping should be applied
      const buffer = await generateQAExcel(items, 'Long Text Test')
      expect(buffer).toBeInstanceOf(Buffer)
    })
  })
})
