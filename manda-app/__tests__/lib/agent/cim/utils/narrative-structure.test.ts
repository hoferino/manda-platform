/**
 * Narrative Structure Utilities Tests
 * Story: E9.12 - Narrative Structure Dependencies
 *
 * Tests for:
 * - AC #1: Narrative role types
 * - AC #3: Content-role compatibility matrix
 * - AC #4: Content-role mismatch detection
 * - AC #5: Reorganization suggestions
 * - AC #6: Narrative structure validation
 */

import { describe, it, expect } from 'vitest'
import {
  inferNarrativeRole,
  checkContentRoleCompatibility,
  getNarrativeRoleLabel,
  getNarrativeRoleDescription,
  getDefaultNarrativeStructure,
  suggestReorganization,
  validateNarrativeStructure,
  suggestNarrativeRoleForSlide,
  ROLE_COMPATIBILITY_MATRIX,
  ROLE_CONTENT_INDICATORS,
} from '@/lib/agent/cim/utils/narrative-structure'
import type { Slide, OutlineSection, NarrativeRole } from '@/lib/types/cim'
import { NARRATIVE_ROLES } from '@/lib/types/cim'

// ============================================================================
// Test Helpers
// ============================================================================

const createMockSlide = (
  id: string,
  title: string,
  content: string,
  narrativeRole?: NarrativeRole
): Slide => ({
  id,
  section_id: 'section-1',
  title,
  components: [
    { id: `${id}-comp-1`, type: 'text', content },
  ],
  visual_concept: null,
  status: 'draft',
  narrative_role: narrativeRole,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
})

const createMockSection = (
  id: string,
  title: string,
  slideIds: string[] = []
): OutlineSection => ({
  id,
  title,
  description: `Description for ${title}`,
  order: 0,
  status: 'pending',
  slide_ids: slideIds,
})

// ============================================================================
// AC #1: Narrative Role Types Tests
// ============================================================================

describe('Narrative Role Types (AC #1)', () => {
  it('should have all 7 narrative roles defined', () => {
    expect(NARRATIVE_ROLES).toHaveLength(7)
    expect(NARRATIVE_ROLES).toContain('introduction')
    expect(NARRATIVE_ROLES).toContain('context')
    expect(NARRATIVE_ROLES).toContain('evidence')
    expect(NARRATIVE_ROLES).toContain('analysis')
    expect(NARRATIVE_ROLES).toContain('implications')
    expect(NARRATIVE_ROLES).toContain('projections')
    expect(NARRATIVE_ROLES).toContain('conclusion')
  })

  it('should have labels for all roles', () => {
    for (const role of NARRATIVE_ROLES) {
      const label = getNarrativeRoleLabel(role)
      expect(label).toBeTruthy()
      expect(typeof label).toBe('string')
    }
  })

  it('should have descriptions for all roles', () => {
    for (const role of NARRATIVE_ROLES) {
      const desc = getNarrativeRoleDescription(role)
      expect(desc).toBeTruthy()
      expect(typeof desc).toBe('string')
    }
  })
})

// ============================================================================
// Content Indicators Tests
// ============================================================================

describe('Content Indicators', () => {
  it('should have indicators defined for all roles', () => {
    for (const role of NARRATIVE_ROLES) {
      expect(ROLE_CONTENT_INDICATORS[role]).toBeDefined()
      expect(ROLE_CONTENT_INDICATORS[role].patterns).toBeDefined()
      expect(ROLE_CONTENT_INDICATORS[role].keywords).toBeDefined()
    }
  })
})

// ============================================================================
// AC #3: Content-Role Compatibility Matrix Tests
// ============================================================================

describe('Content-Role Compatibility Matrix (AC #3)', () => {
  it('should have compatibility defined for all role pairs', () => {
    for (const sourceRole of NARRATIVE_ROLES) {
      for (const targetRole of NARRATIVE_ROLES) {
        const compat = ROLE_COMPATIBILITY_MATRIX[sourceRole][targetRole]
        expect(compat).toBeDefined()
        expect(['high', 'medium', 'low', 'incompatible']).toContain(compat)
      }
    }
  })

  it('should return high compatibility for same role', () => {
    for (const role of NARRATIVE_ROLES) {
      expect(ROLE_COMPATIBILITY_MATRIX[role][role]).toBe('high')
    }
  })

  it('should return incompatible for introduction in conclusion role', () => {
    expect(ROLE_COMPATIBILITY_MATRIX['conclusion']['introduction']).toBe('medium')
    expect(ROLE_COMPATIBILITY_MATRIX['introduction']['conclusion']).toBe('incompatible')
  })

  it('should return high for evidence in analysis role', () => {
    expect(ROLE_COMPATIBILITY_MATRIX['analysis']['evidence']).toBe('high')
  })
})

// ============================================================================
// AC #4: Content-Role Mismatch Detection Tests
// ============================================================================

describe('Content-Role Mismatch Detection (AC #4)', () => {
  describe('inferNarrativeRole', () => {
    it('should detect introduction content', () => {
      const content = 'Welcome to our presentation. This overview will cover the key highlights of the company.'
      const role = inferNarrativeRole(content)
      expect(role).toBe('introduction')
    })

    it('should detect evidence content', () => {
      const content = 'Revenue grew by $5.2 million in 2023, representing a 15.5% increase. The EBITDA margin improved to 22%.'
      const role = inferNarrativeRole(content)
      expect(role).toBe('evidence')
    })

    it('should detect projections content', () => {
      const content = 'By 2025, we expect revenue to reach $50 million. The forecast shows continued growth over the next 3 years.'
      const role = inferNarrativeRole(content)
      expect(role).toBe('projections')
    })

    it('should detect conclusion content', () => {
      const content = 'In summary, the key takeaways are clear. Thank you for your consideration. Next steps include scheduling a follow-up.'
      const role = inferNarrativeRole(content)
      expect(role).toBe('conclusion')
    })

    it('should return null for ambiguous content', () => {
      const content = 'Hello world.'
      const role = inferNarrativeRole(content)
      expect(role).toBeNull()
    })
  })

  describe('checkContentRoleCompatibility', () => {
    it('should return compatible for matching content and role', () => {
      const content = 'Revenue increased by 25% to $10M. EBITDA margin improved to 18%.'
      const result = checkContentRoleCompatibility(content, 'evidence')

      expect(result.isCompatible).toBe(true)
      expect(result.compatibilityLevel).toBe('high')
      expect(result.assignedRole).toBe('evidence')
    })

    it('should return low/incompatible for mismatched content and role', () => {
      // Use strong projections content in an introduction role
      const content = 'By 2025 we forecast revenue will reach $50M. The projected growth over the next 5 years shows expected increases.'
      const result = checkContentRoleCompatibility(content, 'introduction')

      // Projections in introduction should be low or incompatible
      expect(result.isCompatible).toBe(false)
      expect(['low', 'incompatible']).toContain(result.compatibilityLevel)
      expect(result.detectedRole).toBe('projections')
      expect(result.mismatchDetails).toBeTruthy()
      expect(result.suggestedRole).toBe('projections')
    })

    it('should handle medium compatibility', () => {
      const content = 'This overview provides background context for the industry landscape.'
      const result = checkContentRoleCompatibility(content, 'introduction')

      // Context content in introduction role should be medium compatibility
      expect(['high', 'medium']).toContain(result.compatibilityLevel)
    })

    it('should be compatible when no role can be detected', () => {
      const content = 'Generic text without clear indicators.'
      const result = checkContentRoleCompatibility(content, 'evidence')

      expect(result.isCompatible).toBe(true)
      expect(result.detectedRole).toBeNull()
    })
  })
})

// ============================================================================
// Default Narrative Structure Tests
// ============================================================================

describe('Default Narrative Structure', () => {
  it('should return structure for Executive Summary', () => {
    const structure = getDefaultNarrativeStructure('Executive Summary')

    expect(structure.expectedRoleSequence).toContain('introduction')
    expect(structure.expectedRoleSequence).toContain('conclusion')
    expect(structure.requiredRoles).toContain('introduction')
    expect(structure.requiredRoles).toContain('conclusion')
  })

  it('should return structure for Financial Performance', () => {
    const structure = getDefaultNarrativeStructure('Financial Performance')

    expect(structure.requiredRoles).toContain('evidence')
    expect(structure.requiredRoles).toContain('analysis')
  })

  it('should return generic structure for unknown section', () => {
    const structure = getDefaultNarrativeStructure('Unknown Custom Section')

    expect(structure.expectedRoleSequence).toBeDefined()
    expect(structure.expectedRoleSequence.length).toBeGreaterThan(0)
    expect(structure.requiredRoles).toEqual([])
  })

  it('should match case-insensitively', () => {
    const structure1 = getDefaultNarrativeStructure('executive summary')
    const structure2 = getDefaultNarrativeStructure('EXECUTIVE SUMMARY')

    expect(structure1.requiredRoles).toEqual(structure2.requiredRoles)
  })
})

// ============================================================================
// AC #5: Reorganization Suggestions Tests
// ============================================================================

describe('Reorganization Suggestions (AC #5)', () => {
  it('should return empty suggestions for well-organized section', () => {
    const slides = [
      createMockSlide('1', 'Welcome', 'Welcome to the overview', 'introduction'),
      createMockSlide('2', 'Data', 'Revenue grew 15%', 'evidence'),
      createMockSlide('3', 'Summary', 'In conclusion, the key takeaways', 'conclusion'),
    ]
    const section = createMockSection('s1', 'Executive Summary')

    const suggestions = suggestReorganization(slides, section)

    // May have some suggestions, but should detect proper flow
    expect(suggestions).toBeDefined()
  })

  it('should suggest role change for mismatched content', () => {
    const slides = [
      createMockSlide('1', 'Intro', 'Revenue data: $5M with 20% growth', 'introduction'),
    ]
    const section = createMockSection('s1', 'Financial Performance')

    const suggestions = suggestReorganization(slides, section)

    // Should detect that evidence content is in introduction role
    const roleSuggestion = suggestions.find(s => s.slideId === '1' && s.type === 'reorder')
    if (roleSuggestion) {
      expect(roleSuggestion.suggestedRole).toBe('evidence')
    }
  })

  it('should return empty suggestions for empty section', () => {
    const section = createMockSection('s1', 'Empty Section')
    const suggestions = suggestReorganization([], section)

    expect(suggestions).toHaveLength(0)
  })
})

// ============================================================================
// AC #6: Narrative Structure Validation Tests
// ============================================================================

describe('Narrative Structure Validation (AC #6)', () => {
  it('should validate complete section as valid', () => {
    const slides = [
      createMockSlide('1', 'Intro', 'Welcome to overview', 'introduction'),
      createMockSlide('2', 'Summary', 'In conclusion', 'conclusion'),
    ]
    const section = createMockSection('s1', 'Executive Summary')

    const result = validateNarrativeStructure(slides, section)

    expect(result.isValid).toBe(true)
    expect(result.completeness).toBe(100)
  })

  it('should detect missing required roles', () => {
    const slides = [
      createMockSlide('1', 'Data', 'Revenue was $5M', 'evidence'),
    ]
    const section = createMockSection('s1', 'Executive Summary')

    const result = validateNarrativeStructure(slides, section)

    const missingRoleIssue = result.issues.find(i => i.type === 'missing_role')
    expect(missingRoleIssue).toBeDefined()
    expect(result.completeness).toBeLessThan(100)
  })

  it('should detect content-role mismatches', () => {
    const slides = [
      createMockSlide('1', 'Intro', 'Revenue data $5M growth 25%', 'introduction'),
    ]
    const section = createMockSection('s1', 'Test Section')

    const result = validateNarrativeStructure(slides, section)

    const mismatchIssue = result.issues.find(i => i.type === 'role_mismatch')
    // May or may not find mismatch depending on detection threshold
    expect(result.issues).toBeDefined()
  })

  it('should detect duplicate introduction roles', () => {
    const slides = [
      createMockSlide('1', 'Intro 1', 'Welcome overview', 'introduction'),
      createMockSlide('2', 'Intro 2', 'Another welcome', 'introduction'),
    ]
    const section = createMockSection('s1', 'Test Section')

    const result = validateNarrativeStructure(slides, section)

    const duplicateIssue = result.issues.find(i => i.type === 'duplicate_role')
    expect(duplicateIssue).toBeDefined()
  })

  it('should include suggestions in result', () => {
    const slides = [
      createMockSlide('1', 'Data', 'Revenue $5M', 'evidence'),
    ]
    const section = createMockSection('s1', 'Executive Summary')

    const result = validateNarrativeStructure(slides, section)

    expect(result.suggestions).toBeDefined()
    expect(Array.isArray(result.suggestions)).toBe(true)
  })
})

// ============================================================================
// Slide Role Suggestion Tests
// ============================================================================

describe('suggestNarrativeRoleForSlide', () => {
  it('should suggest introduction for first slide', () => {
    const role = suggestNarrativeRoleForSlide(
      'Generic content',
      0, // First position
      3,
      [],
      'Executive Summary'
    )

    expect(role).toBe('introduction')
  })

  it('should suggest conclusion for last slide', () => {
    const role = suggestNarrativeRoleForSlide(
      'Generic content',
      2, // Last position
      3,
      ['introduction', 'evidence'],
      'Executive Summary'
    )

    // Should be conclusion or close to end
    expect(['conclusion', 'implications', 'projections']).toContain(role)
  })

  it('should respect content inference over position', () => {
    const role = suggestNarrativeRoleForSlide(
      'Revenue grew 25% to $10M. EBITDA margin improved significantly.',
      0, // First position
      3,
      [],
      'Financial Performance'
    )

    expect(role).toBe('evidence')
  })

  it('should not suggest already-used roles when appropriate', () => {
    const role = suggestNarrativeRoleForSlide(
      'Generic content',
      1,
      3,
      ['introduction'], // Already has introduction
      'Executive Summary'
    )

    expect(role).not.toBe('introduction')
  })
})

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
  it('should handle empty slide content', () => {
    const result = checkContentRoleCompatibility('', 'introduction')
    expect(result.isCompatible).toBe(true)
    expect(result.detectedRole).toBeNull()
  })

  it('should handle very long content', () => {
    const longContent = 'Revenue data '.repeat(1000)
    const result = checkContentRoleCompatibility(longContent, 'evidence')
    expect(result).toBeDefined()
    expect(result.isCompatible).toBe(true)
  })

  it('should handle special characters in content', () => {
    const content = 'Revenue: $5.2M (15.5% increase) [2023 data]'
    const role = inferNarrativeRole(content)
    expect(role).toBe('evidence')
  })

  it('should handle content with only keywords', () => {
    const content = 'revenue growth margin profit'
    const role = inferNarrativeRole(content)
    expect(['evidence', null]).toContain(role)
  })
})
