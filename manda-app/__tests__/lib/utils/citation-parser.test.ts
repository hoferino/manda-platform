/**
 * Citation Parser Tests
 *
 * Unit tests for the citation parser utility.
 * Story: E5.4 - Implement Source Citation Display in Messages
 * AC: #1, #4, #9
 */

import { describe, it, expect } from 'vitest'
import {
  parseCitations,
  hasCitations,
  getUniqueDocumentNames,
  splitTextWithCitations,
  type ParsedCitation,
} from '@/lib/utils/citation-parser'

describe('citation-parser', () => {
  describe('parseCitations', () => {
    it('should parse a single source citation', () => {
      const text = 'Revenue was €5.2M (source: Q3_Report.pdf, p.12)'
      const result = parseCitations(text)

      expect(result.hasCitations).toBe(true)
      expect(result.citations).toHaveLength(1)
      expect(result.citations[0]).toMatchObject({
        documentName: 'Q3_Report.pdf',
        location: 'p.12',
        pageNumber: 12,
      })
    })

    it('should parse Excel citation with sheet and cell', () => {
      const text = "EBITDA was €1.2M (source: financials.xlsx, Sheet 'P&L', Cell B15)"
      const result = parseCitations(text)

      expect(result.hasCitations).toBe(true)
      expect(result.citations).toHaveLength(1)
      expect(result.citations[0]).toMatchObject({
        documentName: 'financials.xlsx',
        location: "Sheet 'P&L', Cell B15",
        sheetName: 'P&L',
        cellReference: 'B15',
      })
    })

    it('should parse multiple citations in the same text', () => {
      const text =
        'Revenue grew 10% (source: Q3_Report.pdf, p.12) while costs decreased (source: costs.xlsx, Sheet "Analysis", Cell C10)'
      const result = parseCitations(text)

      expect(result.hasCitations).toBe(true)
      expect(result.citations).toHaveLength(2)
      expect(result.citations[0]?.documentName).toBe('Q3_Report.pdf')
      expect(result.citations[1]?.documentName).toBe('costs.xlsx')
    })

    it('should handle page number formats', () => {
      const testCases = [
        { text: '(source: doc.pdf, p.5)', expected: 5 },
        { text: '(source: doc.pdf, p5)', expected: 5 },
        { text: '(source: doc.pdf, p. 15)', expected: 15 },
        { text: '(source: doc.pdf, page 20)', expected: 20 },
      ]

      for (const { text, expected } of testCases) {
        const result = parseCitations(text)
        expect(result.citations[0]?.pageNumber).toBe(expected)
      }
    })

    it('should return empty array for text without citations', () => {
      const text = 'This is plain text without any citations.'
      const result = parseCitations(text)

      expect(result.hasCitations).toBe(false)
      expect(result.citations).toHaveLength(0)
    })

    it('should handle empty or null input', () => {
      expect(parseCitations('')).toEqual({ citations: [], hasCitations: false })
      expect(parseCitations(null as unknown as string)).toEqual({
        citations: [],
        hasCitations: false,
      })
    })

    it('should capture original match text and indices', () => {
      const text = 'Data from (source: report.pdf, p.1) shows growth'
      const result = parseCitations(text)

      expect(result.citations[0]).toMatchObject({
        originalMatch: '(source: report.pdf, p.1)',
        startIndex: 10,
        endIndex: 35,
      })
    })

    it('should be case insensitive for source keyword', () => {
      const testCases = [
        '(source: doc.pdf, p.1)',
        '(Source: doc.pdf, p.1)',
        '(SOURCE: doc.pdf, p.1)',
      ]

      for (const text of testCases) {
        const result = parseCitations(text)
        expect(result.hasCitations).toBe(true)
        expect(result.citations[0]?.documentName).toBe('doc.pdf')
      }
    })

    it('should handle citations with special characters in filenames', () => {
      const text = '(source: Q3-2024_Financial-Report.pdf, p.15)'
      const result = parseCitations(text)

      expect(result.citations[0]?.documentName).toBe('Q3-2024_Financial-Report.pdf')
    })
  })

  describe('hasCitations', () => {
    it('should return true for text with citations', () => {
      expect(hasCitations('(source: doc.pdf, p.1)')).toBe(true)
      expect(hasCitations('(sources: doc1.pdf p.1, doc2.xlsx B2)')).toBe(true)
    })

    it('should return false for text without citations', () => {
      expect(hasCitations('Plain text')).toBe(false)
      expect(hasCitations('')).toBe(false)
    })

    it('should be faster than full parsing for quick checks', () => {
      // This is a sanity check - hasCitations should just do regex test
      const text = 'Plain text without citations ' + 'x'.repeat(10000)
      const start = performance.now()
      hasCitations(text)
      const hasCitationsTime = performance.now() - start

      // Should complete quickly (under 10ms for simple regex)
      expect(hasCitationsTime).toBeLessThan(10)
    })
  })

  describe('getUniqueDocumentNames', () => {
    it('should extract unique document names', () => {
      const citations: ParsedCitation[] = [
        {
          documentName: 'doc1.pdf',
          location: 'p.1',
          originalMatch: '',
          startIndex: 0,
          endIndex: 0,
        },
        {
          documentName: 'doc2.xlsx',
          location: 'B2',
          originalMatch: '',
          startIndex: 0,
          endIndex: 0,
        },
        {
          documentName: 'doc1.pdf',
          location: 'p.5',
          originalMatch: '',
          startIndex: 0,
          endIndex: 0,
        },
      ]

      const names = getUniqueDocumentNames(citations)
      expect(names).toHaveLength(2)
      expect(names).toContain('doc1.pdf')
      expect(names).toContain('doc2.xlsx')
    })

    it('should return empty array for empty citations', () => {
      expect(getUniqueDocumentNames([])).toEqual([])
    })
  })

  describe('splitTextWithCitations', () => {
    it('should split text into segments with citations', () => {
      const text = 'Revenue was €5.2M (source: Q3_Report.pdf, p.12) showing growth'
      const segments = splitTextWithCitations(text)

      expect(segments).toHaveLength(3)
      expect(segments[0]).toMatchObject({ type: 'text', content: 'Revenue was €5.2M ' })
      expect(segments[1]).toMatchObject({ type: 'citation' })
      expect(segments[1]?.citation?.documentName).toBe('Q3_Report.pdf')
      expect(segments[2]).toMatchObject({
        type: 'text',
        content: ' showing growth',
      })
    })

    it('should handle text without citations', () => {
      const text = 'Plain text'
      const segments = splitTextWithCitations(text)

      expect(segments).toHaveLength(1)
      expect(segments[0]).toMatchObject({ type: 'text', content: 'Plain text' })
    })

    it('should handle text starting with citation', () => {
      const text = '(source: doc.pdf, p.1) at the beginning'
      const segments = splitTextWithCitations(text)

      expect(segments[0]?.type).toBe('citation')
    })

    it('should handle text ending with citation', () => {
      const text = 'ending with (source: doc.pdf, p.1)'
      const segments = splitTextWithCitations(text)

      expect(segments[segments.length - 1]?.type).toBe('citation')
    })

    it('should handle multiple adjacent citations', () => {
      const text = '(source: doc1.pdf, p.1)(source: doc2.pdf, p.2)'
      const segments = splitTextWithCitations(text)

      const citationSegments = segments.filter((s) => s.type === 'citation')
      expect(citationSegments).toHaveLength(2)
    })

    it('should return empty array for empty text', () => {
      expect(splitTextWithCitations('')).toEqual([])
    })
  })

  describe('P2 compliance', () => {
    // AC: #9 - P2 Compliance
    it('should handle P2-compliant citation formats', () => {
      const p2Examples = [
        {
          text: '(source: Q3_Report.pdf, p.12)',
          doc: 'Q3_Report.pdf',
          page: 12,
        },
        {
          text: "(source: financials.xlsx, Sheet 'P&L', Cell B15)",
          doc: 'financials.xlsx',
          sheet: 'P&L',
          cell: 'B15',
        },
      ]

      for (const example of p2Examples) {
        const result = parseCitations(example.text)
        expect(result.hasCitations).toBe(true)
        expect(result.citations[0]?.documentName).toBe(example.doc)
        if (example.page) {
          expect(result.citations[0]?.pageNumber).toBe(example.page)
        }
        if (example.sheet) {
          expect(result.citations[0]?.sheetName).toBe(example.sheet)
        }
        if (example.cell) {
          expect(result.citations[0]?.cellReference).toBe(example.cell)
        }
      }
    })
  })
})
