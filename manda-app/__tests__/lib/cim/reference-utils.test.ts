/**
 * Reference Utils Tests
 * Story: E9.9 - Click-to-Reference in Chat
 * Tests: AC #1 (Reference Format), AC #2 (Format Specification), AC #4 (Parsing)
 */

import { describe, it, expect } from 'vitest'
import { formatComponentReference, parseComponentReference } from '@/lib/cim/reference-utils'

describe('reference-utils', () => {
  // ============================================================================
  // formatComponentReference Tests (AC #1, AC #2)
  // ============================================================================

  describe('formatComponentReference', () => {
    describe('content truncation (AC #2)', () => {
      it('truncates content longer than 30 characters with ellipsis', () => {
        const ref = formatComponentReference('s3_bullet1', 'Revenue grew 25% QoQ with strong retention')
        expect(ref).toBe('📍 [s3_bullet1] "Revenue grew 25% QoQ with stro..." -')
      })

      it('includes ellipsis even for short content', () => {
        const ref = formatComponentReference('s1_title', 'Hello')
        expect(ref).toBe('📍 [s1_title] "Hello..." -')
      })

      it('truncates content exactly at 30 characters', () => {
        const exactlyThirty = 'A'.repeat(30)
        const ref = formatComponentReference('s1_text', exactlyThirty)
        expect(ref).toBe(`📍 [s1_text] "${exactlyThirty}..." -`)
      })

      it('truncates content at 30 characters when longer', () => {
        const longContent = 'A'.repeat(50)
        const ref = formatComponentReference('s1_text', longContent)
        expect(ref).toBe(`📍 [s1_text] "${'A'.repeat(30)}..." -`)
      })
    })

    describe('format specification (AC #2)', () => {
      it('produces exact format: 📍 [{componentId}] "{content}..." -', () => {
        const ref = formatComponentReference('s3_bullet1', '15% CAGR')
        // Format: 📍 [componentId] "content..." -
        expect(ref).toMatch(/^📍 \[[^\]]+\] "[^"]*\.\.\." -$/)
        expect(ref).toBe('📍 [s3_bullet1] "15% CAGR..." -')
      })

      it('uses stable component ID format from E9.8', () => {
        const ref = formatComponentReference('s5_chart1', 'Sales trend')
        expect(ref).toContain('[s5_chart1]')
      })
    })

    describe('special character handling', () => {
      it('handles content with quotes', () => {
        const ref = formatComponentReference('s1_text', 'He said "hello" to everyone')
        expect(ref).toContain('"He said ')
      })

      it('handles content with brackets', () => {
        const ref = formatComponentReference('s1_text', 'Array [1, 2, 3] data')
        expect(ref).toBe('📍 [s1_text] "Array [1, 2, 3] data..." -')
      })

      it('handles content with emoji', () => {
        const ref = formatComponentReference('s1_text', '🚀 Launch metrics')
        expect(ref).toBe('📍 [s1_text] "🚀 Launch metrics..." -')
      })

      it('handles content with newlines', () => {
        const ref = formatComponentReference('s1_text', 'Line 1\nLine 2')
        expect(ref).toBe('📍 [s1_text] "Line 1\nLine 2..." -')
      })
    })

    describe('edge cases', () => {
      it('handles empty content', () => {
        const ref = formatComponentReference('s1_title', '')
        expect(ref).toBe('📍 [s1_title] "..." -')
      })

      it('handles null-ish content by treating as empty', () => {
        // TypeScript will complain, but testing runtime safety
        const ref = formatComponentReference('s1_title', undefined as unknown as string)
        expect(ref).toBe('📍 [s1_title] "..." -')
      })

      it('handles whitespace-only content', () => {
        const ref = formatComponentReference('s1_title', '   ')
        expect(ref).toBe('📍 [s1_title] "..." -')
      })

      it('trims trailing whitespace before truncation', () => {
        const ref = formatComponentReference('s1_title', '  Hello World  ')
        expect(ref).toBe('📍 [s1_title] "Hello World..." -')
      })
    })
  })

  // ============================================================================
  // parseComponentReference Tests (AC #4)
  // ============================================================================

  describe('parseComponentReference', () => {
    describe('valid reference parsing (AC #4)', () => {
      it('extracts component id and instruction', () => {
        const message = '📍 [s3_bullet1] "Revenue grew 25%..." - change to 22% based on Q3'
        const result = parseComponentReference(message)
        expect(result.componentId).toBe('s3_bullet1')
        expect(result.instruction).toBe('change to 22% based on Q3')
      })

      it('parses reference with short excerpt', () => {
        const message = '📍 [s1_title] "Title..." - make it bold'
        const result = parseComponentReference(message)
        expect(result.componentId).toBe('s1_title')
        expect(result.instruction).toBe('make it bold')
      })

      it('parses reference with multi-word instruction', () => {
        const message = '📍 [s5_chart1] "Revenue data..." - update the chart to show Q3 2023 figures with comparison to Q2'
        const result = parseComponentReference(message)
        expect(result.componentId).toBe('s5_chart1')
        expect(result.instruction).toBe('update the chart to show Q3 2023 figures with comparison to Q2')
      })
    })

    describe('non-reference messages (graceful degradation)', () => {
      it('returns null componentId for regular messages', () => {
        const result = parseComponentReference('Please update the slide title')
        expect(result.componentId).toBeNull()
        expect(result.instruction).toBe('Please update the slide title')
      })

      it('returns null for messages starting with different emoji', () => {
        const result = parseComponentReference('📄 [doc:123] "Financial report" - review this')
        expect(result.componentId).toBeNull()
        expect(result.instruction).toBe('📄 [doc:123] "Financial report" - review this')
      })

      it('returns null for partial reference format', () => {
        const result = parseComponentReference('📍 [s1_title]')
        expect(result.componentId).toBeNull()
        expect(result.instruction).toBe('📍 [s1_title]')
      })
    })

    describe('edge cases', () => {
      it('handles missing instruction gracefully', () => {
        const result = parseComponentReference('📍 [s1_title] "Title..." -   ')
        expect(result.componentId).toBe('s1_title')
        expect(result.instruction).toBe('')
      })

      it('handles empty message', () => {
        const result = parseComponentReference('')
        expect(result.componentId).toBeNull()
        expect(result.instruction).toBe('')
      })

      it('handles null/undefined by returning safe defaults', () => {
        const result = parseComponentReference(null as unknown as string)
        expect(result.componentId).toBeNull()
        expect(result.instruction).toBe('')
      })

      it('handles multiline instructions', () => {
        const message = '📍 [s2_text] "Content..." - update this to:\n- Point 1\n- Point 2'
        const result = parseComponentReference(message)
        expect(result.componentId).toBe('s2_text')
        expect(result.instruction).toBe('update this to:\n- Point 1\n- Point 2')
      })

      it('handles instruction with special characters', () => {
        const message = '📍 [s1_bullet] "Data..." - change 25% → 30% (Q4 update)'
        const result = parseComponentReference(message)
        expect(result.componentId).toBe('s1_bullet')
        expect(result.instruction).toBe('change 25% → 30% (Q4 update)')
      })
    })

    describe('component ID formats', () => {
      it('parses various valid component IDs', () => {
        const ids = ['s1_title', 's3_bullet1', 's5_chart1', 's10_table2', 's0_text']
        ids.forEach((id) => {
          const message = `📍 [${id}] "content..." - instruction`
          const result = parseComponentReference(message)
          expect(result.componentId).toBe(id)
        })
      })

      it('parses component ID with underscore and numbers', () => {
        const message = '📍 [s123_bullet45] "test..." - instruction'
        const result = parseComponentReference(message)
        expect(result.componentId).toBe('s123_bullet45')
      })
    })
  })

  // ============================================================================
  // Round-trip Tests (formatComponentReference → parseComponentReference)
  // ============================================================================

  describe('round-trip consistency', () => {
    it('parseComponentReference can parse output of formatComponentReference', () => {
      const componentId = 's3_bullet1'
      const content = 'Revenue grew 25% YoY'
      const instruction = 'update to 28%'

      const formatted = formatComponentReference(componentId, content)
      const fullMessage = `${formatted} ${instruction}`

      const parsed = parseComponentReference(fullMessage)
      expect(parsed.componentId).toBe(componentId)
      expect(parsed.instruction).toBe(instruction)
    })

    it('round-trip works with various content lengths', () => {
      const testCases = [
        { id: 's1_title', content: 'Short' },
        { id: 's2_text', content: 'Medium length content here' },
        { id: 's3_bullet1', content: 'This is a very long content string that will definitely be truncated' },
      ]

      testCases.forEach(({ id, content }) => {
        const formatted = formatComponentReference(id, content)
        const fullMessage = `${formatted} test instruction`

        const parsed = parseComponentReference(fullMessage)
        expect(parsed.componentId).toBe(id)
        expect(parsed.instruction).toBe('test instruction')
      })
    })
  })
})
