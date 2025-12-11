/**
 * CIM Export Service Tests
 *
 * Story: E9.14 - Wireframe PowerPoint Export
 * ACs: #1 (Export visibility), #2 (Valid PPTX), #3 (One slide per section),
 *      #4 (Placeholders with specs), #5 (Text content), #6 (Browser download),
 *      #7 (File naming)
 *
 * Target: 40+ tests covering export service, filename handling, component rendering
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  sanitizeFilename,
  generateExportFilename,
  triggerPPTXDownload,
  WIREFRAME_COLORS,
  WIREFRAME_FONTS,
  SLIDE_DIMENSIONS,
  LAYOUT,
} from '@/lib/services/cim-export'

// ============================================================================
// Filename Sanitization Tests (AC #7)
// ============================================================================

describe('cim-export service', () => {
  describe('sanitizeFilename', () => {
    it('should remove forward slashes from filename', () => {
      expect(sanitizeFilename('Test/File')).toBe('TestFile')
    })

    it('should remove backslashes from filename', () => {
      expect(sanitizeFilename('Test\\File')).toBe('TestFile')
    })

    it('should remove colons from filename', () => {
      expect(sanitizeFilename('Test:File')).toBe('TestFile')
    })

    it('should remove asterisks from filename', () => {
      expect(sanitizeFilename('Test*File')).toBe('TestFile')
    })

    it('should remove question marks from filename', () => {
      expect(sanitizeFilename('Test?File')).toBe('TestFile')
    })

    it('should remove double quotes from filename', () => {
      expect(sanitizeFilename('Test"File')).toBe('TestFile')
    })

    it('should remove angle brackets from filename', () => {
      expect(sanitizeFilename('Test<File>')).toBe('TestFile')
    })

    it('should remove pipe characters from filename', () => {
      expect(sanitizeFilename('Test|File')).toBe('TestFile')
    })

    it('should normalize multiple spaces to single space', () => {
      expect(sanitizeFilename('Test   File   Name')).toBe('Test File Name')
    })

    it('should trim leading and trailing whitespace', () => {
      expect(sanitizeFilename('  Test File  ')).toBe('Test File')
    })

    it('should limit filename length to 100 characters', () => {
      const longName = 'A'.repeat(150)
      expect(sanitizeFilename(longName).length).toBeLessThanOrEqual(100)
    })

    it('should handle unicode characters correctly', () => {
      expect(sanitizeFilename('Test Résumé 日本語')).toBe('Test Résumé 日本語')
    })

    it('should handle empty string', () => {
      expect(sanitizeFilename('')).toBe('')
    })

    it('should handle string with only special characters', () => {
      expect(sanitizeFilename('/:*?"<>|')).toBe('')
    })

    it('should handle mixed content correctly', () => {
      expect(sanitizeFilename('Tech M&A: Q1/2025 Report')).toBe('Tech M&A Q12025 Report')
    })

    it('should preserve ampersand character', () => {
      expect(sanitizeFilename('M&A Report')).toBe('M&A Report')
    })

    it('should preserve parentheses', () => {
      expect(sanitizeFilename('Report (Final)')).toBe('Report (Final)')
    })

    it('should handle numbers correctly', () => {
      expect(sanitizeFilename('Report 2025 Q1')).toBe('Report 2025 Q1')
    })

    it('should handle hyphens correctly', () => {
      expect(sanitizeFilename('Tech-Company-CIM')).toBe('Tech-Company-CIM')
    })

    it('should handle underscores correctly', () => {
      expect(sanitizeFilename('Tech_Company_CIM')).toBe('Tech_Company_CIM')
    })
  })

  describe('generateExportFilename', () => {
    it('should generate filename with format "{CIM Name} - Wireframe.pptx"', () => {
      expect(generateExportFilename('My CIM')).toBe('My CIM - Wireframe.pptx')
    })

    it('should sanitize CIM title in filename', () => {
      expect(generateExportFilename('Test/Project:2025')).toBe('TestProject2025 - Wireframe.pptx')
    })

    it('should use "CIM" as default when title is empty', () => {
      expect(generateExportFilename('')).toBe('CIM - Wireframe.pptx')
    })

    it('should use "CIM" when title is only special characters', () => {
      expect(generateExportFilename('/:*?"<>|')).toBe('CIM - Wireframe.pptx')
    })

    it('should handle long CIM titles', () => {
      const longTitle = 'A'.repeat(150)
      const filename = generateExportFilename(longTitle)
      expect(filename.endsWith(' - Wireframe.pptx')).toBe(true)
      expect(filename.length).toBeLessThan(200)
    })

    it('should handle titles with numbers', () => {
      expect(generateExportFilename('Company 2025 CIM')).toBe('Company 2025 CIM - Wireframe.pptx')
    })

    it('should handle titles with parentheses', () => {
      expect(generateExportFilename('Company (Final) CIM')).toBe('Company (Final) CIM - Wireframe.pptx')
    })

    it('should handle titles with hyphens', () => {
      expect(generateExportFilename('Tech-Company-CIM')).toBe('Tech-Company-CIM - Wireframe.pptx')
    })

    it('should handle unicode in titles', () => {
      expect(generateExportFilename('Société Générale')).toBe('Société Générale - Wireframe.pptx')
    })
  })

  // ==========================================================================
  // Wireframe Style Constants Tests (AC #2)
  // ==========================================================================
  describe('wireframe style constants', () => {
    describe('WIREFRAME_COLORS', () => {
      it('should have white background color', () => {
        expect(WIREFRAME_COLORS.background).toBe('FFFFFF')
      })

      it('should have dark gray text color', () => {
        expect(WIREFRAME_COLORS.text).toBe('333333')
      })

      it('should have muted text color', () => {
        expect(WIREFRAME_COLORS.textMuted).toBe('6B7280')
      })

      it('should have light gray placeholder color', () => {
        expect(WIREFRAME_COLORS.placeholder).toBe('E5E7EB')
      })

      it('should have placeholder border color', () => {
        expect(WIREFRAME_COLORS.placeholderBorder).toBe('9CA3AF')
      })

      it('should have muted accent color', () => {
        expect(WIREFRAME_COLORS.accent).toBe('6B7280')
      })

      it('should have header background color', () => {
        expect(WIREFRAME_COLORS.headerBg).toBe('F3F4F6')
      })
    })

    describe('WIREFRAME_FONTS', () => {
      it('should use Arial font for title', () => {
        expect(WIREFRAME_FONTS.title.fontFace).toBe('Arial')
      })

      it('should use Arial font for body', () => {
        expect(WIREFRAME_FONTS.body.fontFace).toBe('Arial')
      })

      it('should use Arial font for bullets', () => {
        expect(WIREFRAME_FONTS.bullet.fontFace).toBe('Arial')
      })

      it('should use Arial font for placeholders', () => {
        expect(WIREFRAME_FONTS.placeholder.fontFace).toBe('Arial')
      })

      it('should have larger title font size', () => {
        expect(WIREFRAME_FONTS.title.fontSize).toBeGreaterThan(WIREFRAME_FONTS.body.fontSize)
      })

      it('should have bold title', () => {
        expect(WIREFRAME_FONTS.title.bold).toBe(true)
      })

      it('should have non-bold body text', () => {
        expect(WIREFRAME_FONTS.body.bold).toBe(false)
      })

      it('should have italic placeholder text', () => {
        expect(WIREFRAME_FONTS.placeholder.italic).toBe(true)
      })
    })

    describe('SLIDE_DIMENSIONS', () => {
      it('should have 16:9 slide dimensions', () => {
        const aspectRatio = SLIDE_DIMENSIONS.width / SLIDE_DIMENSIONS.height
        expect(aspectRatio).toBeCloseTo(16 / 9, 1)
      })

      it('should have 10 inch width', () => {
        expect(SLIDE_DIMENSIONS.width).toBe(10)
      })

      it('should have appropriate height for 16:9', () => {
        expect(SLIDE_DIMENSIONS.height).toBeCloseTo(5.625, 3)
      })

      it('should have 0.5 inch margin', () => {
        expect(SLIDE_DIMENSIONS.margin).toBe(0.5)
      })
    })

    describe('LAYOUT', () => {
      it('should have title position near top', () => {
        expect(LAYOUT.title.y).toBeLessThan(0.5)
      })

      it('should have subtitle position below title', () => {
        expect(LAYOUT.subtitle.y).toBeGreaterThan(LAYOUT.title.y)
      })

      it('should have content position below subtitle', () => {
        expect(LAYOUT.content.y).toBeGreaterThan(LAYOUT.subtitle.y)
      })

      it('should have consistent width for title and content', () => {
        expect(LAYOUT.title.w).toBe(LAYOUT.content.w)
      })

      it('should have min height for placeholders', () => {
        expect(LAYOUT.placeholder.minHeight).toBeGreaterThan(0)
      })

      it('should have max height for placeholders', () => {
        expect(LAYOUT.placeholder.maxHeight).toBeGreaterThan(LAYOUT.placeholder.minHeight)
      })
    })
  })

  // ==========================================================================
  // Browser Download Tests (AC #6)
  // ==========================================================================
  describe('triggerPPTXDownload', () => {
    let createObjectURLMock: ReturnType<typeof vi.fn>
    let revokeObjectURLMock: ReturnType<typeof vi.fn>
    let appendChildMock: ReturnType<typeof vi.fn>
    let removeChildMock: ReturnType<typeof vi.fn>
    let clickMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      createObjectURLMock = vi.fn(() => 'blob:mock-url')
      revokeObjectURLMock = vi.fn()
      appendChildMock = vi.fn((node: Node) => node)
      removeChildMock = vi.fn((child: Node) => child)
      clickMock = vi.fn()

      // Mock URL object
      global.URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL
      global.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL

      // Mock document methods
      vi.spyOn(document.body, 'appendChild').mockImplementation(appendChildMock as unknown as <T extends Node>(node: T) => T)
      vi.spyOn(document.body, 'removeChild').mockImplementation(removeChildMock as unknown as <T extends Node>(child: T) => T)
      vi.spyOn(document, 'createElement').mockImplementation((tag) => {
        if (tag === 'a') {
          return {
            href: '',
            download: '',
            style: { display: '' },
            click: clickMock,
          } as unknown as HTMLAnchorElement
        }
        return document.createElement(tag)
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should create object URL from blob', () => {
      const blob = new Blob(['test'], { type: 'application/octet-stream' })
      triggerPPTXDownload(blob, 'test.pptx')

      expect(createObjectURLMock).toHaveBeenCalledWith(blob)
    })

    it('should trigger download via anchor click', () => {
      const blob = new Blob(['test'])
      triggerPPTXDownload(blob, 'test.pptx')

      expect(clickMock).toHaveBeenCalled()
    })

    it('should cleanup object URL after download', () => {
      const blob = new Blob(['test'])
      triggerPPTXDownload(blob, 'test.pptx')

      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')
    })

    it('should append anchor element to body', () => {
      const blob = new Blob(['test'])
      triggerPPTXDownload(blob, 'test.pptx')

      expect(appendChildMock).toHaveBeenCalled()
    })

    it('should remove anchor element after click', () => {
      const blob = new Blob(['test'])
      triggerPPTXDownload(blob, 'test.pptx')

      expect(removeChildMock).toHaveBeenCalled()
    })

    it('should handle large blobs', () => {
      const largeData = 'X'.repeat(1000000) // 1MB
      const blob = new Blob([largeData])

      // Should not throw
      expect(() => triggerPPTXDownload(blob, 'large-test.pptx')).not.toThrow()
    })

    it('should handle empty blob', () => {
      const blob = new Blob([])

      // Should not throw
      expect(() => triggerPPTXDownload(blob, 'empty-test.pptx')).not.toThrow()
    })
  })

  // ==========================================================================
  // Edge Case Tests
  // ==========================================================================
  describe('edge cases', () => {
    describe('filename edge cases', () => {
      it('should handle CIM with only whitespace in title', () => {
        const result = generateExportFilename('   ')
        expect(result).toBe('CIM - Wireframe.pptx')
      })

      it('should handle consecutive special characters', () => {
        const result = sanitizeFilename('///test///file///')
        expect(result).toBe('testfile')
      })

      it('should handle mixed special characters', () => {
        const result = sanitizeFilename('a<b>c:d*e?f"g|h')
        expect(result).toBe('abcdefgh')
      })

      it('should preserve case', () => {
        const result = sanitizeFilename('TeSt FiLe NaMe')
        expect(result).toBe('TeSt FiLe NaMe')
      })

      it('should handle newlines in input', () => {
        const result = sanitizeFilename('Test\nFile\nName')
        expect(result).toBe('Test File Name')
      })

      it('should handle tabs in input', () => {
        const result = sanitizeFilename('Test\tFile\tName')
        expect(result).toBe('Test File Name')
      })
    })
  })
})
