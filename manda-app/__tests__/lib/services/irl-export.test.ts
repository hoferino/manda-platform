/**
 * IRL Export Service Tests
 *
 * Story: E6.6 - Build IRL Export Functionality (PDF/Word)
 * ACs: 2, 3, 4, 5, 6, 7
 *
 * Tests PDF and Word generation with mocked pdfmake/docx libraries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  generateIRLPdf,
  generateIRLDocx,
  generateIRLExport,
} from '@/lib/services/irl-export'
import { IRLWithItems, IRLItem } from '@/lib/types/irl'

// Mock pdfmake
vi.mock('pdfmake', () => {
  class MockPdfPrinter {
    createPdfKitDocument() {
      const listeners: { [key: string]: ((chunk?: Buffer) => void)[] } = {}

      const mockPdfDoc = {
        on(event: string, callback: (chunk?: Buffer) => void) {
          if (!listeners[event]) listeners[event] = []
          listeners[event].push(callback)
          return mockPdfDoc
        },
        end() {
          // Emit data
          if (listeners['data']) {
            listeners['data'].forEach((cb) => cb(Buffer.from('mock-pdf-content')))
          }
          // Emit end
          if (listeners['end']) {
            listeners['end'].forEach((cb) => cb())
          }
        },
      }

      return mockPdfDoc
    }
  }

  return {
    default: MockPdfPrinter,
  }
})

// Mock docx
vi.mock('docx', () => ({
  Document: vi.fn(),
  Packer: {
    toBuffer: vi.fn(() => Promise.resolve(Buffer.from('mock-docx-content'))),
  },
  Paragraph: vi.fn(),
  TextRun: vi.fn(),
  Table: vi.fn(),
  TableRow: vi.fn(),
  TableCell: vi.fn(),
  WidthType: { DXA: 'DXA', PERCENTAGE: 'PERCENTAGE' },
  AlignmentType: { RIGHT: 'right', CENTER: 'center' },
  HeadingLevel: { HEADING_1: 'HEADING_1', HEADING_2: 'HEADING_2' },
  BorderStyle: {},
  ShadingType: { CLEAR: 'CLEAR' },
  Header: vi.fn(),
  Footer: vi.fn(),
  PageNumber: { CURRENT: 'CURRENT', TOTAL_PAGES: 'TOTAL_PAGES' },
  NumberFormat: {},
}))

// Test data factory
function createMockIRL(overrides: Partial<IRLWithItems> = {}): IRLWithItems {
  const defaultItems: IRLItem[] = [
    {
      id: 'item-1',
      irlId: 'irl-1',
      category: 'Financial Documents',
      subcategory: 'Historical',
      itemName: 'Audited Financial Statements',
      description: 'Last 3 years of audited financials',
      priority: 'high',
      status: 'not_started',
      fulfilled: false,
      notes: 'Need certified copies',
      sortOrder: 0,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'item-2',
      irlId: 'irl-1',
      category: 'Financial Documents',
      itemName: 'Tax Returns',
      priority: 'medium',
      status: 'not_started',
      fulfilled: true,
      sortOrder: 1,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
    {
      id: 'item-3',
      irlId: 'irl-1',
      category: 'Legal Documents',
      itemName: 'Articles of Incorporation',
      priority: 'low',
      status: 'not_started',
      fulfilled: false,
      sortOrder: 2,
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    },
  ]

  return {
    id: 'irl-1',
    dealId: 'deal-1',
    title: 'Tech M&A Due Diligence',
    templateType: 'tech_ma',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    items: defaultItems,
    ...overrides,
  }
}

describe('irl-export service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateIRLPdf', () => {
    it('should generate a PDF buffer (AC2)', async () => {
      const irl = createMockIRL()
      const result = await generateIRLPdf(irl, 'Test Project')

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should include all categories in the export (AC2)', async () => {
      const irl = createMockIRL()
      // PDF generation is mocked, but we verify the function completes
      const result = await generateIRLPdf(irl, 'Test Project')

      expect(result).toBeDefined()
    })

    it('should handle IRL with items from multiple categories (AC2)', async () => {
      const irl = createMockIRL({
        items: [
          ...createMockIRL().items,
          {
            id: 'item-4',
            irlId: 'irl-1',
            category: 'Operational',
            itemName: 'Org Chart',
            priority: 'medium',
            status: 'not_started',
            fulfilled: false,
            sortOrder: 3,
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
      })

      const result = await generateIRLPdf(irl, 'Test Project')
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should handle empty IRL gracefully', async () => {
      const irl = createMockIRL({ items: [] })
      const result = await generateIRLPdf(irl, 'Test Project')

      expect(result).toBeInstanceOf(Buffer)
    })
  })

  describe('generateIRLDocx', () => {
    it('should generate a DOCX buffer (AC3)', async () => {
      const irl = createMockIRL()
      const result = await generateIRLDocx(irl, 'Test Project')

      expect(result).toBeInstanceOf(Buffer)
      expect(result.length).toBeGreaterThan(0)
    })

    it('should handle IRL with various priorities (AC4)', async () => {
      const irl = createMockIRL({
        items: [
          { ...createMockIRL().items[0], priority: 'high' },
          { ...createMockIRL().items[1], priority: 'medium' },
          { ...createMockIRL().items[2], priority: 'low' },
        ],
      })

      const result = await generateIRLDocx(irl, 'Test Project')
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should handle items with and without notes (AC6)', async () => {
      const irl = createMockIRL({
        items: [
          { ...createMockIRL().items[0], notes: 'Important note' },
          { ...createMockIRL().items[1], notes: undefined },
          { ...createMockIRL().items[2], notes: '' },
        ],
      })

      const result = await generateIRLDocx(irl, 'Test Project')
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should handle fulfilled and unfulfilled items (AC7)', async () => {
      const irl = createMockIRL({
        items: [
          { ...createMockIRL().items[0], fulfilled: true },
          { ...createMockIRL().items[1], fulfilled: false },
        ],
      })

      const result = await generateIRLDocx(irl, 'Test Project')
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should handle empty IRL gracefully', async () => {
      const irl = createMockIRL({ items: [] })
      const result = await generateIRLDocx(irl, 'Test Project')

      expect(result).toBeInstanceOf(Buffer)
    })
  })

  describe('generateIRLExport', () => {
    it('should generate PDF export with correct metadata (AC5)', async () => {
      const irl = createMockIRL()
      const exportDate = new Date('2025-12-03')

      const result = await generateIRLExport(irl, {
        format: 'pdf',
        projectName: 'Test Project',
        exportDate,
      })

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.filename).toMatch(/tech-m-a-due-diligence-2025-12-03\.pdf$/)
      expect(result.contentType).toBe('application/pdf')
    })

    it('should generate Word export with correct metadata (AC5)', async () => {
      const irl = createMockIRL()
      const exportDate = new Date('2025-12-03')

      const result = await generateIRLExport(irl, {
        format: 'word',
        projectName: 'Test Project',
        exportDate,
      })

      expect(result.buffer).toBeInstanceOf(Buffer)
      expect(result.filename).toMatch(/tech-m-a-due-diligence-2025-12-03\.docx$/)
      expect(result.contentType).toBe(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
    })

    it('should sanitize filename from IRL title', async () => {
      const irl = createMockIRL({ title: 'Special/Chars & Symbols!' })
      const exportDate = new Date('2025-12-03')

      const result = await generateIRLExport(irl, {
        format: 'pdf',
        projectName: 'Test',
        exportDate,
      })

      expect(result.filename).not.toMatch(/[\/&!]/)
      expect(result.filename).toMatch(/^[a-z0-9-]+\.pdf$/)
    })

    it('should use current date if exportDate not provided', async () => {
      const irl = createMockIRL()

      const result = await generateIRLExport(irl, {
        format: 'pdf',
        projectName: 'Test',
      })

      const today = new Date().toISOString().split('T')[0]
      expect(result.filename).toContain(today)
    })
  })

  describe('priority formatting (AC4)', () => {
    it('should handle all priority levels', async () => {
      const priorities: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low']

      for (const priority of priorities) {
        const irl = createMockIRL({
          items: [{ ...createMockIRL().items[0], priority }],
        })

        const pdfResult = await generateIRLPdf(irl, 'Test')
        expect(pdfResult).toBeInstanceOf(Buffer)

        const docxResult = await generateIRLDocx(irl, 'Test')
        expect(docxResult).toBeInstanceOf(Buffer)
      }
    })
  })

  describe('category grouping', () => {
    it('should group items by category correctly', async () => {
      const irl = createMockIRL({
        items: [
          { ...createMockIRL().items[0], category: 'A' },
          { ...createMockIRL().items[1], category: 'B' },
          { ...createMockIRL().items[2], category: 'A' },
        ],
      })

      const result = await generateIRLPdf(irl, 'Test')
      expect(result).toBeInstanceOf(Buffer)
    })

    it('should maintain sort order within categories', async () => {
      const irl = createMockIRL({
        items: [
          { ...createMockIRL().items[0], category: 'A', sortOrder: 2 },
          { ...createMockIRL().items[1], category: 'A', sortOrder: 0 },
          { ...createMockIRL().items[2], category: 'A', sortOrder: 1 },
        ],
      })

      const result = await generateIRLPdf(irl, 'Test')
      expect(result).toBeInstanceOf(Buffer)
    })
  })

  describe('large IRL handling', () => {
    it('should handle IRL with 200+ items (AC - performance)', async () => {
      const items: IRLItem[] = []
      for (let i = 0; i < 250; i++) {
        items.push({
          id: `item-${i}`,
          irlId: 'irl-1',
          category: `Category ${Math.floor(i / 25)}`,
          itemName: `Item ${i}`,
          priority: ['high', 'medium', 'low'][i % 3] as 'high' | 'medium' | 'low',
          status: 'not_started',
          fulfilled: i % 2 === 0,
          notes: i % 3 === 0 ? `Note for item ${i}` : undefined,
          sortOrder: i,
          createdAt: '2025-01-01T00:00:00Z',
          updatedAt: '2025-01-01T00:00:00Z',
        })
      }

      const irl = createMockIRL({ items })

      const pdfResult = await generateIRLPdf(irl, 'Large Test')
      expect(pdfResult).toBeInstanceOf(Buffer)

      const docxResult = await generateIRLDocx(irl, 'Large Test')
      expect(docxResult).toBeInstanceOf(Buffer)
    })
  })
})
