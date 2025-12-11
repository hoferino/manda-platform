/**
 * Narrative Structure Utilities
 *
 * Utilities for managing narrative roles, content-role compatibility,
 * and narrative structure validation.
 *
 * Story: E9.12 - Narrative Structure Dependencies
 *
 * Features:
 * - Content-role compatibility matrix (AC #3)
 * - Role compatibility checking (AC #4)
 * - Reorganization suggestions (AC #5)
 * - Narrative structure validation helpers
 */

import type {
  NarrativeRole,
  NarrativeStructure,
  Slide,
  OutlineSection,
} from '@/lib/types/cim'
import { NARRATIVE_ROLES } from '@/lib/types/cim'

// ============================================================================
// Content-Role Compatibility Matrix (AC #3)
// ============================================================================

/**
 * Compatibility level between content types and narrative roles
 */
export type CompatibilityLevel = 'high' | 'medium' | 'low' | 'incompatible'

/**
 * Content indicators that suggest certain narrative roles
 * Used to infer a slide's role from its content
 */
interface ContentIndicator {
  patterns: RegExp[]
  keywords: string[]
}

/**
 * Content indicators for each narrative role
 * Used to detect content-role mismatches
 */
export const ROLE_CONTENT_INDICATORS: Record<NarrativeRole, ContentIndicator> = {
  introduction: {
    patterns: [
      /welcome to/i,
      /overview of/i,
      /introducing/i,
      /today we will/i,
      /this presentation/i,
    ],
    keywords: [
      'overview', 'introduction', 'welcome', 'executive summary',
      'purpose', 'agenda', 'highlights', 'at a glance',
    ],
  },
  context: {
    patterns: [
      /industry (background|overview|landscape)/i,
      /market (context|environment|dynamics)/i,
      /founded in/i,
      /history of/i,
      /background/i,
    ],
    keywords: [
      'background', 'context', 'history', 'industry', 'market',
      'landscape', 'environment', 'overview', 'founded', 'established',
    ],
  },
  evidence: {
    patterns: [
      /\$[\d,.]+\s*(million|billion|M|B|K)?/i,
      /\d+(\.\d+)?%/,
      /grew by/i,
      /increased to/i,
      /data shows/i,
      /statistics/i,
    ],
    keywords: [
      'revenue', 'ebitda', 'growth', 'margin', 'profit', 'metrics',
      'data', 'statistics', 'figures', 'numbers', 'performance', 'results',
    ],
  },
  analysis: {
    patterns: [
      /this (means|indicates|suggests|shows)/i,
      /analysis of/i,
      /indicates that/i,
      /demonstrates/i,
      /reveals/i,
    ],
    keywords: [
      'analysis', 'insights', 'findings', 'interpretation', 'assessment',
      'evaluation', 'indicates', 'suggests', 'demonstrates', 'reveals',
    ],
  },
  implications: {
    patterns: [
      /for (buyers|acquirers|investors)/i,
      /this means for/i,
      /opportunities for/i,
      /value creation/i,
      /synergies/i,
    ],
    keywords: [
      'implications', 'impact', 'opportunities', 'synergies', 'value creation',
      'benefits', 'advantages', 'strategic fit', 'potential', 'upside',
    ],
  },
  projections: {
    patterns: [
      /forecast/i,
      /projected/i,
      /expected to/i,
      /will (grow|increase|reach)/i,
      /by 20\d{2}/i,
      /next \d+ years/i,
    ],
    keywords: [
      'forecast', 'projection', 'outlook', 'future', 'expected',
      'anticipated', 'pipeline', 'roadmap', 'targets', 'goals',
    ],
  },
  conclusion: {
    patterns: [
      /in (summary|conclusion)/i,
      /key takeaways/i,
      /next steps/i,
      /call to action/i,
      /thank you/i,
    ],
    keywords: [
      'summary', 'conclusion', 'takeaways', 'next steps', 'action items',
      'closing', 'thank you', 'contact', 'questions', 'call to action',
    ],
  },
}

/**
 * Role-to-role compatibility matrix
 * Defines how compatible content from one role is with another role
 *
 * Used to detect when content might be misplaced (AC #4)
 */
export const ROLE_COMPATIBILITY_MATRIX: Record<NarrativeRole, Record<NarrativeRole, CompatibilityLevel>> = {
  introduction: {
    introduction: 'high',
    context: 'medium',      // Some context can appear in intro
    evidence: 'low',         // Data should come later
    analysis: 'incompatible',
    implications: 'incompatible',
    projections: 'low',
    conclusion: 'incompatible',
  },
  context: {
    introduction: 'medium',  // Intro can set context
    context: 'high',
    evidence: 'medium',      // Some evidence for context
    analysis: 'low',
    implications: 'incompatible',
    projections: 'low',
    conclusion: 'incompatible',
  },
  evidence: {
    introduction: 'incompatible',
    context: 'low',
    evidence: 'high',
    analysis: 'medium',      // Evidence often includes some analysis
    implications: 'low',
    projections: 'low',
    conclusion: 'incompatible',
  },
  analysis: {
    introduction: 'incompatible',
    context: 'low',
    evidence: 'high',        // Analysis should reference evidence
    analysis: 'high',
    implications: 'medium',  // Analysis can lead to implications
    projections: 'medium',
    conclusion: 'low',
  },
  implications: {
    introduction: 'incompatible',
    context: 'low',
    evidence: 'medium',      // Can cite evidence for implications
    analysis: 'high',        // Implications flow from analysis
    implications: 'high',
    projections: 'high',     // Often tied to forward projections
    conclusion: 'medium',
  },
  projections: {
    introduction: 'incompatible',
    context: 'low',
    evidence: 'medium',      // Can show historical data as basis
    analysis: 'medium',
    implications: 'high',
    projections: 'high',
    conclusion: 'medium',
  },
  conclusion: {
    introduction: 'medium',  // Can echo intro themes
    context: 'low',
    evidence: 'low',
    analysis: 'medium',
    implications: 'high',    // Summarizes implications
    projections: 'medium',
    conclusion: 'high',
  },
}

// ============================================================================
// Role Compatibility Checking (AC #4)
// ============================================================================

/**
 * Result of checking content-role compatibility
 */
export interface CompatibilityCheckResult {
  isCompatible: boolean
  compatibilityLevel: CompatibilityLevel
  detectedRole: NarrativeRole | null
  assignedRole: NarrativeRole
  mismatchDetails?: string
  suggestedRole?: NarrativeRole
}

/**
 * Check if content matches its assigned narrative role
 */
export function checkContentRoleCompatibility(
  content: string,
  assignedRole: NarrativeRole
): CompatibilityCheckResult {
  // Detect what role the content suggests
  const detectedRole = inferNarrativeRole(content)

  // If we couldn't detect a role, assume it's compatible
  if (!detectedRole) {
    return {
      isCompatible: true,
      compatibilityLevel: 'medium',
      detectedRole: null,
      assignedRole,
    }
  }

  // Check compatibility between detected and assigned roles
  const compatibilityLevel = ROLE_COMPATIBILITY_MATRIX[assignedRole][detectedRole]

  const isCompatible = compatibilityLevel === 'high' || compatibilityLevel === 'medium'

  const result: CompatibilityCheckResult = {
    isCompatible,
    compatibilityLevel,
    detectedRole,
    assignedRole,
  }

  if (!isCompatible) {
    result.mismatchDetails = `Content appears to be "${detectedRole}" content but is in a "${assignedRole}" slide`
    result.suggestedRole = detectedRole
  }

  return result
}

/**
 * Infer the narrative role from content text
 * Returns null if no clear role can be inferred
 */
export function inferNarrativeRole(content: string): NarrativeRole | null {
  const normalizedContent = content.toLowerCase()
  const scores: Record<NarrativeRole, number> = {
    introduction: 0,
    context: 0,
    evidence: 0,
    analysis: 0,
    implications: 0,
    projections: 0,
    conclusion: 0,
  }

  // Score each role based on pattern matches and keyword presence
  for (const role of NARRATIVE_ROLES) {
    const indicators = ROLE_CONTENT_INDICATORS[role]

    // Pattern matches are weighted higher (2 points each)
    for (const pattern of indicators.patterns) {
      if (pattern.test(content)) {
        scores[role] += 2
      }
    }

    // Keyword matches (1 point each)
    for (const keyword of indicators.keywords) {
      if (normalizedContent.includes(keyword.toLowerCase())) {
        scores[role] += 1
      }
    }
  }

  // Find the highest scoring role
  let maxScore = 0
  let inferredRole: NarrativeRole | null = null

  for (const role of NARRATIVE_ROLES) {
    if (scores[role] > maxScore) {
      maxScore = scores[role]
      inferredRole = role
    }
  }

  // Only return a role if there's a significant signal (at least 2 points)
  return maxScore >= 2 ? inferredRole : null
}

/**
 * Get a human-readable label for a narrative role
 */
export function getNarrativeRoleLabel(role: NarrativeRole): string {
  const labels: Record<NarrativeRole, string> = {
    introduction: 'Introduction',
    context: 'Context & Background',
    evidence: 'Evidence & Data',
    analysis: 'Analysis & Insights',
    implications: 'Implications',
    projections: 'Projections & Outlook',
    conclusion: 'Conclusion',
  }
  return labels[role]
}

/**
 * Get a short description for a narrative role
 */
export function getNarrativeRoleDescription(role: NarrativeRole): string {
  const descriptions: Record<NarrativeRole, string> = {
    introduction: 'Sets context and hooks the reader',
    context: 'Provides background information',
    evidence: 'Presents data points and facts',
    analysis: 'Interprets evidence and provides insights',
    implications: 'Explains what it means for the buyer',
    projections: 'Forward-looking statements and forecasts',
    conclusion: 'Summarizes and calls to action',
  }
  return descriptions[role]
}

// ============================================================================
// Narrative Structure Templates
// ============================================================================

/**
 * Default narrative structures for common CIM section types
 * Used when creating new sections to suggest the expected flow
 */
export const DEFAULT_SECTION_NARRATIVES: Record<string, NarrativeStructure> = {
  'Executive Summary': {
    expectedRoleSequence: ['introduction', 'evidence', 'implications', 'conclusion'],
    requiredRoles: ['introduction', 'conclusion'],
    optionalRoles: ['evidence', 'implications'],
  },
  'Business Overview': {
    expectedRoleSequence: ['introduction', 'context', 'evidence', 'analysis'],
    requiredRoles: ['introduction', 'context'],
    optionalRoles: ['evidence', 'analysis'],
  },
  'Market Analysis': {
    expectedRoleSequence: ['context', 'evidence', 'analysis', 'implications'],
    requiredRoles: ['context', 'evidence', 'analysis'],
    optionalRoles: ['implications'],
  },
  'Financial Performance': {
    expectedRoleSequence: ['introduction', 'evidence', 'analysis', 'projections'],
    requiredRoles: ['evidence', 'analysis'],
    optionalRoles: ['introduction', 'projections'],
  },
  'Growth Strategy': {
    expectedRoleSequence: ['context', 'analysis', 'projections', 'implications'],
    requiredRoles: ['projections'],
    optionalRoles: ['context', 'analysis', 'implications'],
  },
  'Management Team': {
    expectedRoleSequence: ['introduction', 'context', 'evidence'],
    requiredRoles: ['context'],
    optionalRoles: ['introduction', 'evidence'],
  },
  'Investment Highlights': {
    expectedRoleSequence: ['introduction', 'evidence', 'implications', 'conclusion'],
    requiredRoles: ['evidence', 'implications'],
    optionalRoles: ['introduction', 'conclusion'],
  },
}

/**
 * Get a default narrative structure for a section title
 * Falls back to a generic structure if no match is found
 */
export function getDefaultNarrativeStructure(sectionTitle: string): NarrativeStructure {
  // Normalize the title for comparison
  const normalizedTitle = sectionTitle.toLowerCase()

  // Check for matches
  for (const [key, structure] of Object.entries(DEFAULT_SECTION_NARRATIVES)) {
    if (normalizedTitle.includes(key.toLowerCase())) {
      return structure
    }
  }

  // Generic fallback structure
  return {
    expectedRoleSequence: ['introduction', 'evidence', 'analysis', 'conclusion'],
    requiredRoles: [],
    optionalRoles: ['introduction', 'context', 'evidence', 'analysis', 'implications', 'projections', 'conclusion'],
  }
}

// ============================================================================
// Reorganization Suggestions (AC #5)
// ============================================================================

/**
 * Suggestion for reorganizing slides
 */
export interface ReorganizationSuggestion {
  type: 'move' | 'reorder' | 'merge' | 'split'
  slideId: string
  slideTitle: string
  currentRole: NarrativeRole | undefined
  suggestedRole: NarrativeRole
  reason: string
  targetPosition?: number  // For 'move' and 'reorder' types
  targetSectionId?: string // For 'move' type
}

/**
 * Analyze slides within a section and suggest reorganization
 */
export function suggestReorganization(
  slides: Slide[],
  section: OutlineSection
): ReorganizationSuggestion[] {
  const suggestions: ReorganizationSuggestion[] = []

  // Get the expected narrative structure
  const narrativeStructure = section.narrativeStructure ||
    getDefaultNarrativeStructure(section.title)

  // Track detected roles for each slide
  interface SlideRoleInfo {
    slide: Slide
    detectedRole: NarrativeRole | null
    assignedRole: NarrativeRole | undefined
    compatibilityLevel: CompatibilityLevel
  }

  const slideRoles: SlideRoleInfo[] = slides.map(slide => {
    const content = slide.components.map(c => c.content).join(' ')
    const detectedRole = inferNarrativeRole(content)
    const assignedRole = slide.narrative_role

    let compatibilityLevel: CompatibilityLevel = 'high'
    if (assignedRole && detectedRole) {
      compatibilityLevel = ROLE_COMPATIBILITY_MATRIX[assignedRole][detectedRole]
    }

    return {
      slide,
      detectedRole,
      assignedRole,
      compatibilityLevel,
    }
  })

  // Check for role mismatches
  for (const info of slideRoles) {
    if (info.detectedRole && info.assignedRole &&
        (info.compatibilityLevel === 'low' || info.compatibilityLevel === 'incompatible')) {
      suggestions.push({
        type: 'reorder',
        slideId: info.slide.id,
        slideTitle: info.slide.title,
        currentRole: info.assignedRole,
        suggestedRole: info.detectedRole,
        reason: `Content suggests "${getNarrativeRoleLabel(info.detectedRole)}" role instead of "${getNarrativeRoleLabel(info.assignedRole)}"`,
      })
    }
  }

  // Check narrative flow against expected sequence
  const expectedSequence = narrativeStructure.expectedRoleSequence
  const actualRoles = slideRoles
    .map(sr => sr.assignedRole || sr.detectedRole)
    .filter((r): r is NarrativeRole => r !== null && r !== undefined)

  // Find slides out of order
  for (let i = 0; i < actualRoles.length; i++) {
    const currentRole = actualRoles[i]
    if (!currentRole) continue

    const expectedIndex = expectedSequence.indexOf(currentRole)
    if (expectedIndex === -1) continue // Role not in expected sequence

    // Check if there's a later role that should come before this one
    for (let j = i + 1; j < actualRoles.length; j++) {
      const laterRole = actualRoles[j]
      if (!laterRole) continue

      const laterExpectedIndex = expectedSequence.indexOf(laterRole)
      if (laterExpectedIndex !== -1 && laterExpectedIndex < expectedIndex) {
        // This role should come before the current one
        const info = slideRoles[i]
        if (info) {
          suggestions.push({
            type: 'reorder',
            slideId: info.slide.id,
            slideTitle: info.slide.title,
            currentRole: info.assignedRole,
            suggestedRole: currentRole,
            targetPosition: j,
            reason: `"${getNarrativeRoleLabel(currentRole)}" typically comes after "${getNarrativeRoleLabel(laterRole)}" in this section type`,
          })
        }
        break
      }
    }
  }

  // Check for missing required roles
  for (const requiredRole of narrativeStructure.requiredRoles) {
    const hasRole = actualRoles.includes(requiredRole)
    if (!hasRole && slides.length > 0) {
      // Find the best slide to suggest assigning this role to
      const bestCandidate = slideRoles.find(sr =>
        sr.detectedRole === requiredRole && !sr.assignedRole
      )

      if (bestCandidate) {
        suggestions.push({
          type: 'reorder',
          slideId: bestCandidate.slide.id,
          slideTitle: bestCandidate.slide.title,
          currentRole: undefined,
          suggestedRole: requiredRole,
          reason: `Section is missing required "${getNarrativeRoleLabel(requiredRole)}" role - this slide's content matches`,
        })
      }
    }
  }

  // Deduplicate suggestions
  const seen = new Set<string>()
  return suggestions.filter(s => {
    const key = `${s.slideId}-${s.type}-${s.suggestedRole}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ============================================================================
// Narrative Validation
// ============================================================================

/**
 * Result of validating a section's narrative structure
 */
export interface NarrativeValidationResult {
  isValid: boolean
  issues: Array<{
    type: 'missing_role' | 'wrong_order' | 'role_mismatch' | 'duplicate_role'
    severity: 'warning' | 'error'
    slideId?: string
    slideTitle?: string
    description: string
  }>
  suggestions: ReorganizationSuggestion[]
  completeness: number // 0-100 percentage
}

/**
 * Validate the narrative structure of a section
 */
export function validateNarrativeStructure(
  slides: Slide[],
  section: OutlineSection
): NarrativeValidationResult {
  const issues: NarrativeValidationResult['issues'] = []
  const narrativeStructure = section.narrativeStructure ||
    getDefaultNarrativeStructure(section.title)

  // Track assigned roles
  const assignedRoles: NarrativeRole[] = []
  const roleSlideMap = new Map<NarrativeRole, Slide[]>()

  for (const slide of slides) {
    if (slide.narrative_role) {
      assignedRoles.push(slide.narrative_role)
      const existing = roleSlideMap.get(slide.narrative_role) || []
      existing.push(slide)
      roleSlideMap.set(slide.narrative_role, existing)
    }
  }

  // Check for missing required roles
  for (const requiredRole of narrativeStructure.requiredRoles) {
    if (!assignedRoles.includes(requiredRole)) {
      issues.push({
        type: 'missing_role',
        severity: 'warning',
        description: `Missing required "${getNarrativeRoleLabel(requiredRole)}" slide`,
      })
    }
  }

  // Check for duplicate roles where it doesn't make sense
  for (const [role, slidesWithRole] of roleSlideMap.entries()) {
    if (slidesWithRole.length > 1 && (role === 'introduction' || role === 'conclusion')) {
      issues.push({
        type: 'duplicate_role',
        severity: 'warning',
        slideId: slidesWithRole[1]?.id,
        slideTitle: slidesWithRole[1]?.title,
        description: `Multiple slides with "${getNarrativeRoleLabel(role)}" role - typically only one is needed`,
      })
    }
  }

  // Check narrative order
  const expectedSequence = narrativeStructure.expectedRoleSequence
  let lastExpectedIndex = -1

  for (const slide of slides) {
    if (!slide.narrative_role) continue

    const expectedIndex = expectedSequence.indexOf(slide.narrative_role)
    if (expectedIndex !== -1 && expectedIndex < lastExpectedIndex) {
      issues.push({
        type: 'wrong_order',
        severity: 'warning',
        slideId: slide.id,
        slideTitle: slide.title,
        description: `"${slide.title}" with role "${getNarrativeRoleLabel(slide.narrative_role)}" appears out of expected order`,
      })
    }

    if (expectedIndex !== -1) {
      lastExpectedIndex = expectedIndex
    }
  }

  // Check for content-role mismatches
  for (const slide of slides) {
    if (!slide.narrative_role) continue

    const content = slide.components.map(c => c.content).join(' ')
    const check = checkContentRoleCompatibility(content, slide.narrative_role)

    if (!check.isCompatible) {
      issues.push({
        type: 'role_mismatch',
        severity: check.compatibilityLevel === 'incompatible' ? 'error' : 'warning',
        slideId: slide.id,
        slideTitle: slide.title,
        description: check.mismatchDetails || 'Content does not match assigned role',
      })
    }
  }

  // Get reorganization suggestions
  const suggestions = suggestReorganization(slides, section)

  // Calculate completeness
  const requiredRolesCount = narrativeStructure.requiredRoles.length
  const presentRequiredRoles = narrativeStructure.requiredRoles.filter(r =>
    assignedRoles.includes(r)
  ).length
  const completeness = requiredRolesCount > 0
    ? Math.round((presentRequiredRoles / requiredRolesCount) * 100)
    : 100

  return {
    isValid: issues.filter(i => i.severity === 'error').length === 0,
    issues,
    suggestions,
    completeness,
  }
}

// ============================================================================
// Slide Role Assignment Helpers
// ============================================================================

/**
 * Suggest a narrative role for a new slide based on:
 * - Slide position in section
 * - Slide content
 * - Existing roles in section
 */
export function suggestNarrativeRoleForSlide(
  slideContent: string,
  slidePosition: number,
  totalSlidesInSection: number,
  existingRoles: NarrativeRole[],
  sectionTitle: string
): NarrativeRole {
  // First try to infer from content
  const inferredRole = inferNarrativeRole(slideContent)

  // Get the section's expected structure
  const structure = getDefaultNarrativeStructure(sectionTitle)

  // If content strongly suggests a role, use that
  if (inferredRole) {
    return inferredRole
  }

  // Otherwise, use position-based heuristics
  const positionRatio = slidePosition / Math.max(totalSlidesInSection, 1)

  // Find the first role in the expected sequence that isn't already used
  for (const role of structure.expectedRoleSequence) {
    if (!existingRoles.includes(role)) {
      // Check if the position makes sense for this role
      const roleIndex = structure.expectedRoleSequence.indexOf(role)
      const expectedPositionRatio = roleIndex / structure.expectedRoleSequence.length

      // Allow some flexibility in position matching
      if (Math.abs(positionRatio - expectedPositionRatio) < 0.4) {
        return role
      }
    }
  }

  // Fallback: use position-based defaults
  if (positionRatio < 0.15) return 'introduction'
  if (positionRatio > 0.85) return 'conclusion'
  if (positionRatio < 0.35) return 'context'
  if (positionRatio > 0.65) return 'implications'

  return 'evidence' // Default middle role
}
