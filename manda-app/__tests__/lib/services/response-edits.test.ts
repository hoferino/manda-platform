/**
 * Response Edits Service Tests
 *
 * Unit tests for pattern detection logic.
 * Story: E7.3 - Enable Response Editing and Learning
 */

import { describe, it, expect } from 'vitest'
import { detectPatterns, formatPatternsAsPromptInstructions } from '@/lib/services/response-edits'
import type { FewShotExample } from '@/lib/types/feedback'

describe('detectPatterns', () => {
  describe('word replacement detection', () => {
    it('should detect word replacements', () => {
      const original = 'The company has significant revenue growth.'
      const edited = 'The company has substantial revenue growth.'

      const patterns = detectPatterns(original, edited)

      expect(patterns.length).toBeGreaterThanOrEqual(1)
      const replacementPattern = patterns.find(p => p.patternType === 'word_replacement')
      expect(replacementPattern).toBeDefined()
      expect(replacementPattern?.originalPattern).toBe('significant')
      expect(replacementPattern?.replacementPattern).toBe('substantial')
    })

    it('should detect multiple word replacements', () => {
      const original = 'The quick brown fox jumps.'
      const edited = 'The fast red fox leaps.'

      const patterns = detectPatterns(original, edited)

      expect(patterns.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('phrase removal detection', () => {
    it('should detect phrase removals', () => {
      const original = 'This is very important for the analysis.'
      const edited = 'This is important for the analysis.'

      const patterns = detectPatterns(original, edited)

      const removalPattern = patterns.find(p => p.patternType === 'phrase_removal' || p.patternType === 'tone_adjustment')
      expect(removalPattern).toBeDefined()
    })
  })

  describe('tone adjustment detection', () => {
    it('should detect tone adjustments with "very"', () => {
      const original = 'This is very important.'
      const edited = 'This is important.'

      const patterns = detectPatterns(original, edited)

      // The removal of "very" should be detected
      expect(patterns.length).toBeGreaterThanOrEqual(1)
    })

    it('should detect tone adjustments with "extremely"', () => {
      const original = 'The deal is extremely risky.'
      const edited = 'The deal is risky.'

      const patterns = detectPatterns(original, edited)

      expect(patterns.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('structure change detection', () => {
    it('should detect paragraph count changes', () => {
      // Note: structure_change detection requires >= 2 paragraph difference
      const original = 'First.\n\nSecond.\n\nThird.\n\nFourth.'
      const edited = 'Combined.'

      const patterns = detectPatterns(original, edited)

      // This now has 4 paragraphs vs 1 = 3 difference, should trigger structure change
      const structurePattern = patterns.find(p => p.patternType === 'structure_change')
      expect(structurePattern).toBeDefined()
    })

    it('should detect content reordering', () => {
      const original = 'Alpha line.\nBeta line.\nGamma line.'
      const edited = 'Gamma line.\nAlpha line.\nBeta line.'

      const patterns = detectPatterns(original, edited)

      const structurePattern = patterns.find(p => p.patternType === 'structure_change')
      expect(structurePattern).toBeDefined()
      expect(structurePattern?.replacementPattern).toBe('reordered')
    })
  })

  describe('edge cases', () => {
    it('should handle identical text', () => {
      const text = 'No changes here.'
      const patterns = detectPatterns(text, text)

      expect(patterns).toEqual([])
    })

    it('should ignore very short patterns', () => {
      // Single character changes are filtered out (<3 chars)
      const original = 'I said it'
      const edited = 'I wrote it'

      const patterns = detectPatterns(original, edited)

      // Should detect "said" -> "wrote" replacement (both are >= 3 chars)
      expect(patterns.length).toBeGreaterThanOrEqual(1)
      // Single letters like "a" -> "x" should NOT be detected
      const singleLetterPatterns = patterns.filter(p =>
        p.originalPattern.length < 3 || p.replacementPattern?.length < 3
      )
      expect(singleLetterPatterns.length).toBe(0)
    })

    it('should handle empty strings', () => {
      expect(detectPatterns('', '')).toEqual([])
      expect(detectPatterns('text', '')).toEqual([])
      expect(detectPatterns('', 'text')).toEqual([])
    })
  })
})

describe('formatPatternsAsPromptInstructions', () => {
  it('should format word replacement patterns', () => {
    const patterns: FewShotExample[] = [
      {
        original: 'significant',
        preferred: 'substantial',
        patternType: 'word_replacement',
      },
    ]

    const result = formatPatternsAsPromptInstructions(patterns)

    expect(result).toContain('Use "substantial" instead of "significant"')
  })

  it('should format phrase removal patterns', () => {
    const patterns: FewShotExample[] = [
      {
        original: 'in my opinion',
        preferred: '',
        patternType: 'phrase_removal',
      },
    ]

    const result = formatPatternsAsPromptInstructions(patterns)

    expect(result).toContain('Avoid phrases like: "in my opinion"')
  })

  it('should format tone adjustment patterns', () => {
    const patterns: FewShotExample[] = [
      {
        original: 'very important',
        preferred: 'important',
        patternType: 'tone_adjustment',
      },
    ]

    const result = formatPatternsAsPromptInstructions(patterns)

    expect(result).toContain('Adjust tone: "very important" → "important"')
  })

  it('should return empty string for empty patterns', () => {
    expect(formatPatternsAsPromptInstructions([])).toBe('')
  })

  it('should include header text', () => {
    const patterns: FewShotExample[] = [
      {
        original: 'test',
        preferred: 'trial',
        patternType: 'word_replacement',
      },
    ]

    const result = formatPatternsAsPromptInstructions(patterns)

    expect(result).toContain('When generating responses, apply these learned preferences:')
  })
})
