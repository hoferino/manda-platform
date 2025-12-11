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
  triggerTextDownload,
  copyToClipboard,
  generateLLMPrompt,
  generateLLMPromptFilename,
  exportCIMAsLLMPrompt,
  WIREFRAME_COLORS,
  WIREFRAME_FONTS,
  SLIDE_DIMENSIONS,
  LAYOUT,
} from '@/lib/services/cim-export'
import type { CIM } from '@/lib/types/cim'

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

  // ==========================================================================
  // LLM Prompt Export Tests (E9.15)
  // ==========================================================================

  describe('LLM Prompt Export', () => {
    // Test CIM fixtures
    const createTestCIM = (overrides: Partial<CIM> = {}): CIM => {
      const baseCIM: CIM = {
        id: 'test-cim-id',
        dealId: 'test-deal-id',
        title: 'Test Company CIM',
        userId: 'test-user-id',
        version: 1,
        workflowState: {
          current_phase: 'content_creation',
          current_section_index: 0,
          current_slide_index: 0,
          completed_phases: ['persona', 'thesis', 'outline'],
          is_complete: false,
        },
        buyerPersona: {
          buyer_type: 'strategic',
          buyer_description: 'Large technology company seeking market expansion',
          priorities: ['Market share growth', 'Technology acquisition'],
          concerns: ['Integration complexity', 'Cultural fit'],
          key_metrics: ['Revenue growth', 'EBITDA margin'],
        },
        investmentThesis: 'Strong market position with 20% annual growth potential',
        outline: [
          {
            id: 'section-1',
            title: 'Executive Summary',
            description: 'Overview of the company and opportunity',
            order: 1,
            status: 'complete',
            slide_ids: ['s1', 's2'],
          },
          {
            id: 'section-2',
            title: 'Financial Overview',
            description: 'Key financial metrics and projections',
            order: 2,
            status: 'in_progress',
            slide_ids: ['s3'],
          },
        ],
        slides: [
          {
            id: 's1',
            section_id: 'section-1',
            title: 'Welcome Slide',
            components: [
              { id: 's1_title', type: 'title', content: 'Test Company CIM' },
              { id: 's1_subtitle', type: 'subtitle', content: 'Confidential Information Memorandum' },
            ],
            visual_concept: {
              layout_type: 'title_slide',
              chart_recommendations: [],
              image_suggestions: ['Company logo'],
              notes: 'Professional title slide layout',
            },
            status: 'approved',
            created_at: '2025-12-10T10:00:00Z',
            updated_at: '2025-12-10T10:00:00Z',
          },
          {
            id: 's2',
            section_id: 'section-1',
            title: 'Executive Summary',
            components: [
              { id: 's2_title', type: 'title', content: 'Executive Summary' },
              { id: 's2_bullet1', type: 'bullet', content: 'Strong market position' },
              { id: 's2_bullet2', type: 'bullet', content: '20% YoY revenue growth' },
              { id: 's2_chart', type: 'chart', content: 'Revenue growth chart', metadata: { chartType: 'bar', dataDescription: 'Annual revenue from 2020-2025' } },
            ],
            visual_concept: {
              layout_type: 'content',
              chart_recommendations: [{ type: 'bar', data_description: 'Revenue growth', purpose: 'Show growth trajectory' }],
              image_suggestions: [],
              notes: 'Key metrics focus',
            },
            status: 'draft',
            created_at: '2025-12-10T11:00:00Z',
            updated_at: '2025-12-10T11:00:00Z',
          },
          {
            id: 's3',
            section_id: 'section-2',
            title: 'Financial Metrics',
            components: [
              { id: 's3_title', type: 'title', content: 'Financial Overview' },
              { id: 's3_text', type: 'text', content: 'Our financial performance demonstrates consistent growth.' },
              { id: 's3_table', type: 'table', content: 'Key metrics table', metadata: { rows: 4, columns: 3 } },
            ],
            visual_concept: {
              layout_type: 'chart_focus',
              chart_recommendations: [{ type: 'table', data_description: 'Financial metrics', purpose: 'Display KPIs' }],
              image_suggestions: ['Financial icon'],
              notes: 'Data-focused layout',
            },
            status: 'draft',
            created_at: '2025-12-10T12:00:00Z',
            updated_at: '2025-12-10T12:00:00Z',
          },
        ],
        dependencyGraph: { dependencies: {}, references: {} },
        conversationHistory: [],
        exportFormats: null,
        createdAt: '2025-12-10T09:00:00Z',
        updatedAt: '2025-12-10T12:00:00Z',
      }
      return { ...baseCIM, ...overrides }
    }

    describe('generateLLMPromptFilename', () => {
      it('should generate filename with format "{CIM Name} - LLM Prompt.txt"', () => {
        expect(generateLLMPromptFilename('My CIM')).toBe('My CIM - LLM Prompt.txt')
      })

      it('should sanitize CIM title in filename', () => {
        expect(generateLLMPromptFilename('Test/Project:2025')).toBe('TestProject2025 - LLM Prompt.txt')
      })

      it('should use "CIM" as default when title is empty', () => {
        expect(generateLLMPromptFilename('')).toBe('CIM - LLM Prompt.txt')
      })

      it('should use "CIM" when title is only special characters', () => {
        expect(generateLLMPromptFilename('/:*?"<>|')).toBe('CIM - LLM Prompt.txt')
      })

      it('should handle long CIM titles', () => {
        const longTitle = 'A'.repeat(150)
        const filename = generateLLMPromptFilename(longTitle)
        expect(filename.endsWith(' - LLM Prompt.txt')).toBe(true)
        expect(filename.length).toBeLessThan(200)
      })

      it('should handle unicode in titles', () => {
        expect(generateLLMPromptFilename('Société Générale')).toBe('Société Générale - LLM Prompt.txt')
      })
    })

    describe('generateLLMPrompt', () => {
      it('should generate valid XML structure with root element', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<cim_export version="1.0">')
        expect(prompt).toContain('</cim_export>')
      })

      it('should include instructions section', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<instructions>')
        expect(prompt).toContain('</instructions>')
        expect(prompt).toContain('CIM (Confidential Information Memorandum)')
      })

      it('should include metadata section with title', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<metadata>')
        expect(prompt).toContain('<title>Test Company CIM</title>')
        expect(prompt).toContain('<exported_at>')
        expect(prompt).toContain('<slide_count>3</slide_count>')
        expect(prompt).toContain('<section_count>2</section_count>')
        expect(prompt).toContain('<version>1</version>')
      })

      it('should include buyer persona with all fields', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<buyer_persona>')
        expect(prompt).toContain('<type>strategic</type>')
        expect(prompt).toContain('<description>Large technology company seeking market expansion</description>')
        expect(prompt).toContain('<priorities>')
        expect(prompt).toContain('<item>Market share growth</item>')
        expect(prompt).toContain('<concerns>')
        expect(prompt).toContain('<item>Integration complexity</item>')
        expect(prompt).toContain('<key_metrics>')
        expect(prompt).toContain('<item>Revenue growth</item>')
      })

      it('should handle null buyer persona gracefully', () => {
        const cim = createTestCIM({ buyerPersona: null })
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<buyer_persona>Not specified</buyer_persona>')
      })

      it('should include investment thesis', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<investment_thesis>Strong market position with 20% annual growth potential</investment_thesis>')
      })

      it('should handle null investment thesis gracefully', () => {
        const cim = createTestCIM({ investmentThesis: null })
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<investment_thesis>Not specified</investment_thesis>')
      })

      it('should include outline with sections', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<outline>')
        expect(prompt).toContain('<section order="1" status="complete">')
        expect(prompt).toContain('<title>Executive Summary</title>')
        expect(prompt).toContain('<description>Overview of the company and opportunity</description>')
        expect(prompt).toContain('<slide_count>2</slide_count>')
        expect(prompt).toContain('<section order="2" status="in_progress">')
      })

      it('should handle empty outline gracefully', () => {
        const cim = createTestCIM({ outline: [] })
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<outline>No sections defined</outline>')
      })

      it('should include slides with components', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<slides>')
        expect(prompt).toContain('<slide id="s1" section="Executive Summary" status="approved">')
        expect(prompt).toContain('<title>Welcome Slide</title>')
        expect(prompt).toContain('<components>')
        expect(prompt).toContain('<component type="title">Test Company CIM</component>')
        expect(prompt).toContain('<component type="subtitle">Confidential Information Memorandum</component>')
      })

      it('should include chart metadata in components', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('chart_type="bar"')
        expect(prompt).toContain('data_description="Annual revenue from 2020-2025"')
      })

      it('should include visual concept for slides', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<visual_concept>')
        expect(prompt).toContain('<layout>title_slide</layout>')
        expect(prompt).toContain('<chart_recommendations>')
        expect(prompt).toContain('<chart type="bar" purpose="Show growth trajectory">')
        expect(prompt).toContain('<image_suggestions>')
        expect(prompt).toContain('<suggestion>Company logo</suggestion>')
        expect(prompt).toContain('<notes>Professional title slide layout</notes>')
      })

      it('should handle empty slides gracefully', () => {
        const cim = createTestCIM({ slides: [] })
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<slides>No slides defined</slides>')
      })

      it('should escape XML special characters', () => {
        const cim = createTestCIM({
          title: 'Test & Company <CIM>',
          investmentThesis: 'Growth > 20% with "strong" outlook',
        })
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('Test &amp; Company &lt;CIM&gt;')
        expect(prompt).toContain('Growth &gt; 20% with &quot;strong&quot; outlook')
      })

      it('should handle slides with empty components', () => {
        const cim = createTestCIM({
          slides: [{
            id: 's1',
            section_id: 'section-1',
            title: 'Empty Slide',
            components: [],
            visual_concept: null,
            status: 'draft' as const,
            created_at: '2025-12-10T10:00:00Z',
            updated_at: '2025-12-10T10:00:00Z',
          }],
        })
        const prompt = generateLLMPrompt(cim)

        expect(prompt).toContain('<component type="text">No content</component>')
      })
    })

    describe('exportCIMAsLLMPrompt', () => {
      it('should return LLMPromptExportResult with all fields', () => {
        const cim = createTestCIM()
        const result = exportCIMAsLLMPrompt(cim)

        expect(result).toHaveProperty('prompt')
        expect(result).toHaveProperty('characterCount')
        expect(result).toHaveProperty('sectionCount')
        expect(result).toHaveProperty('slideCount')
        expect(result).toHaveProperty('filename')
      })

      it('should calculate correct character count', () => {
        const cim = createTestCIM()
        const result = exportCIMAsLLMPrompt(cim)

        expect(result.characterCount).toBe(result.prompt.length)
        expect(result.characterCount).toBeGreaterThan(0)
      })

      it('should calculate correct section count', () => {
        const cim = createTestCIM()
        const result = exportCIMAsLLMPrompt(cim)

        expect(result.sectionCount).toBe(2)
      })

      it('should calculate correct slide count', () => {
        const cim = createTestCIM()
        const result = exportCIMAsLLMPrompt(cim)

        expect(result.slideCount).toBe(3)
      })

      it('should generate correct filename', () => {
        const cim = createTestCIM()
        const result = exportCIMAsLLMPrompt(cim)

        expect(result.filename).toBe('Test Company CIM - LLM Prompt.txt')
      })

      it('should handle CIM with empty data', () => {
        const cim = createTestCIM({
          buyerPersona: null,
          investmentThesis: null,
          outline: [],
          slides: [],
        })
        const result = exportCIMAsLLMPrompt(cim)

        expect(result.sectionCount).toBe(0)
        expect(result.slideCount).toBe(0)
        expect(result.prompt).toContain('Not specified')
      })
    })

    describe('triggerTextDownload', () => {
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

        global.URL.createObjectURL = createObjectURLMock as unknown as typeof URL.createObjectURL
        global.URL.revokeObjectURL = revokeObjectURLMock as unknown as typeof URL.revokeObjectURL

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

      it('should create blob with text/plain content type', () => {
        const content = '<cim_export>test content</cim_export>'
        triggerTextDownload(content, 'test.txt')

        expect(createObjectURLMock).toHaveBeenCalled()
        const blobArg = createObjectURLMock.mock.calls[0]?.[0] as Blob | undefined
        expect(blobArg).toBeInstanceOf(Blob)
        expect(blobArg?.type).toBe('text/plain;charset=utf-8')
      })

      it('should trigger download via anchor click', () => {
        triggerTextDownload('test content', 'test.txt')

        expect(clickMock).toHaveBeenCalled()
      })

      it('should cleanup object URL after download', () => {
        triggerTextDownload('test content', 'test.txt')

        expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url')
      })

      it('should handle large text content', () => {
        const largeContent = 'X'.repeat(1000000) // 1MB
        expect(() => triggerTextDownload(largeContent, 'large-test.txt')).not.toThrow()
      })

      it('should handle empty content', () => {
        expect(() => triggerTextDownload('', 'empty-test.txt')).not.toThrow()
      })
    })

    describe('copyToClipboard', () => {
      afterEach(() => {
        vi.restoreAllMocks()
      })

      it('should use navigator.clipboard.writeText when available', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: writeTextMock },
          writable: true,
          configurable: true,
        })

        await copyToClipboard('test content')

        expect(writeTextMock).toHaveBeenCalledWith('test content')
      })

      // Note: execCommand fallback tests skipped - deprecated API not available in test environment
      it.skip('should fall back to execCommand when clipboard API unavailable', async () => {
        // This test requires document.execCommand which is not available in JSDOM
      })

      it.skip('should throw error when copy fails', async () => {
        // This test requires document.execCommand which is not available in JSDOM
      })

      it('should handle large text content', async () => {
        const writeTextMock = vi.fn().mockResolvedValue(undefined)
        Object.defineProperty(navigator, 'clipboard', {
          value: { writeText: writeTextMock },
          writable: true,
          configurable: true,
        })

        const largeContent = 'X'.repeat(100000)
        await copyToClipboard(largeContent)

        expect(writeTextMock).toHaveBeenCalledWith(largeContent)
      })
    })

    describe('XML structure validation', () => {
      it('should have matching opening and closing tags for cim_export', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        const openCount = (prompt.match(/<cim_export/g) || []).length
        const closeCount = (prompt.match(/<\/cim_export>/g) || []).length
        expect(openCount).toBe(closeCount)
      })

      it('should have matching opening and closing tags for buyer_persona', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        const openCount = (prompt.match(/<buyer_persona>/g) || []).length
        const closeCount = (prompt.match(/<\/buyer_persona>/g) || []).length
        expect(openCount).toBe(closeCount)
      })

      it('should have matching opening and closing tags for slides', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        const openCount = (prompt.match(/<slides>/g) || []).length
        const closeCount = (prompt.match(/<\/slides>/g) || []).length
        expect(openCount).toBe(closeCount)
      })

      it('should have matching slide tags for each slide', () => {
        const cim = createTestCIM()
        const prompt = generateLLMPrompt(cim)

        const openCount = (prompt.match(/<slide /g) || []).length
        const closeCount = (prompt.match(/<\/slide>/g) || []).length
        expect(openCount).toBe(closeCount)
        expect(openCount).toBe(3) // 3 slides in test data
      })
    })
  })
})
