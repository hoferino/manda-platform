/**
 * Navigation Coherence Utilities Tests
 * Story: E9.13 - Non-Linear Navigation with Context
 * AC #6: Coherence check on jump ahead
 */

import { describe, it, expect } from 'vitest'
import {
  checkNavigationCoherence,
  getNavigationContextSummary,
  shouldRequireConfirmation,
  formatNavigationWarnings,
  getRecommendedNextSection,
  checkJumpSafety,
} from '@/lib/agent/cim/utils/navigation-coherence'
import type { OutlineSection, Slide, DependencyGraph, NavigationWarning } from '@/lib/types/cim'
import { createEmptyDependencyGraph, addDependency } from '@/lib/agent/cim/utils/dependency-graph'

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestOutline(): OutlineSection[] {
  return [
    {
      id: 'sec-1',
      title: 'Executive Summary',
      description: 'Overview of the opportunity',
      order: 0,
      status: 'complete',
      slide_ids: ['s1', 's2'],
    },
    {
      id: 'sec-2',
      title: 'Company Overview',
      description: 'About the company',
      order: 1,
      status: 'in_progress',
      slide_ids: ['s3', 's4'],
    },
    {
      id: 'sec-3',
      title: 'Financial Performance',
      description: 'Revenue and growth',
      order: 2,
      status: 'pending',
      slide_ids: ['s5', 's6'],
    },
    {
      id: 'sec-4',
      title: 'Market Opportunity',
      description: 'Market analysis',
      order: 3,
      status: 'pending',
      slide_ids: ['s7', 's8'],
    },
  ]
}

function createTestSlides(): Slide[] {
  const now = new Date().toISOString()
  return [
    { id: 's1', section_id: 'sec-1', title: 'Title Slide', components: [], visual_concept: null, status: 'approved', created_at: now, updated_at: now },
    { id: 's2', section_id: 'sec-1', title: 'Key Highlights', components: [], visual_concept: null, status: 'approved', created_at: now, updated_at: now },
    { id: 's3', section_id: 'sec-2', title: 'Company History', components: [], visual_concept: null, status: 'approved', created_at: now, updated_at: now },
    { id: 's4', section_id: 'sec-2', title: 'Products', components: [], visual_concept: null, status: 'draft', created_at: now, updated_at: now },
    { id: 's5', section_id: 'sec-3', title: 'Revenue Overview', components: [], visual_concept: null, status: 'draft', created_at: now, updated_at: now },
    { id: 's6', section_id: 'sec-3', title: 'Growth Metrics', components: [], visual_concept: null, status: 'draft', created_at: now, updated_at: now },
    { id: 's7', section_id: 'sec-4', title: 'Market Size', components: [], visual_concept: null, status: 'draft', created_at: now, updated_at: now },
    { id: 's8', section_id: 'sec-4', title: 'Competition', components: [], visual_concept: null, status: 'draft', created_at: now, updated_at: now },
  ]
}

// ============================================================================
// checkNavigationCoherence Tests (AC #6)
// ============================================================================

describe('checkNavigationCoherence', () => {
  it('returns no warnings when navigating to a section with no dependencies', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const warnings = checkNavigationCoherence('sec-1', outline, slides, graph)
    expect(warnings).toEqual([])
  })

  it('returns warning when target section depends on incomplete section', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // s7 (in sec-4) references s5 (in sec-3 which is pending)
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's5')

    const warnings = checkNavigationCoherence('sec-4', outline, slides, graph)

    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]?.type).toBe('incomplete_dependency')
    expect(warnings[0]?.message).toContain('Financial Performance')
    expect(warnings[0]?.message).toContain('not started')
  })

  it('returns info warning when target depends on in-progress section', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // s7 (in sec-4) references s3 (in sec-2 which is in_progress)
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's3')

    const warnings = checkNavigationCoherence('sec-4', outline, slides, graph)

    expect(warnings.length).toBeGreaterThan(0)
    expect(warnings[0]?.severity).toBe('info')
    expect(warnings[0]?.message).toContain('in progress')
  })

  it('returns warning when referencing draft slide', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // s7 (in sec-4) references s4 (which is draft)
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's4')

    const warnings = checkNavigationCoherence('sec-4', outline, slides, graph)

    expect(warnings.some(w => w.type === 'stale_reference')).toBe(true)
  })

  it('returns empty array for non-existent section', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const warnings = checkNavigationCoherence('non-existent', outline, slides, graph)
    expect(warnings).toEqual([])
  })

  it('consolidates multiple warnings for same incomplete section', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // Both s7 and s8 reference slides in sec-3
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's5')
    graph = addDependency(graph, 's8', 's6')

    const warnings = checkNavigationCoherence('sec-4', outline, slides, graph)

    // Should have one warning about sec-3 being incomplete
    const incompleteDepWarnings = warnings.filter(w => w.type === 'incomplete_dependency')
    expect(incompleteDepWarnings.length).toBe(1)
  })
})

// ============================================================================
// getNavigationContextSummary Tests (AC #5)
// ============================================================================

describe('getNavigationContextSummary', () => {
  it('returns summary with section title and status', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const summary = getNavigationContextSummary('sec-2', outline, slides, graph)

    expect(summary).toContain('Company Overview')
    expect(summary).toContain('in_progress')
  })

  it('includes slide completion counts', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const summary = getNavigationContextSummary('sec-2', outline, slides, graph)

    expect(summary).toContain('1 completed')
    expect(summary).toContain('1 draft')
  })

  it('includes dependency information when dependencies exist', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // s7 references s3
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's3')

    const summary = getNavigationContextSummary('sec-4', outline, slides, graph)

    expect(summary).toContain('References content from')
    expect(summary).toContain('Company Overview')
  })

  it('includes dependents information when other sections depend on this one', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // s7 references s3
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's3')

    const summary = getNavigationContextSummary('sec-2', outline, slides, graph)

    expect(summary).toContain('Content referenced by')
    expect(summary).toContain('Market Opportunity')
  })

  it('returns "Section not found" for invalid section', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const summary = getNavigationContextSummary('invalid', outline, slides, graph)
    expect(summary).toBe('Section not found.')
  })
})

// ============================================================================
// shouldRequireConfirmation Tests
// ============================================================================

describe('shouldRequireConfirmation', () => {
  it('returns false for empty warnings array', () => {
    expect(shouldRequireConfirmation([])).toBe(false)
  })

  it('returns false for only info warnings', () => {
    const warnings: NavigationWarning[] = [
      { type: 'stale_reference', sourceId: 's1', message: 'test', incompleteDependencies: [], severity: 'info' },
    ]
    expect(shouldRequireConfirmation(warnings)).toBe(false)
  })

  it('returns true for warning severity', () => {
    const warnings: NavigationWarning[] = [
      { type: 'incomplete_dependency', sourceId: 's1', message: 'test', incompleteDependencies: ['sec-3'], severity: 'warning' },
    ]
    expect(shouldRequireConfirmation(warnings)).toBe(true)
  })

  it('returns true for error severity', () => {
    const warnings: NavigationWarning[] = [
      { type: 'missing_content', sourceId: 's1', message: 'test', incompleteDependencies: [], severity: 'error' },
    ]
    expect(shouldRequireConfirmation(warnings)).toBe(true)
  })

  it('returns true when mixed severities include warning or error', () => {
    const warnings: NavigationWarning[] = [
      { type: 'stale_reference', sourceId: 's1', message: 'info test', incompleteDependencies: [], severity: 'info' },
      { type: 'incomplete_dependency', sourceId: 's2', message: 'warning test', incompleteDependencies: ['sec-3'], severity: 'warning' },
    ]
    expect(shouldRequireConfirmation(warnings)).toBe(true)
  })
})

// ============================================================================
// formatNavigationWarnings Tests
// ============================================================================

describe('formatNavigationWarnings', () => {
  it('returns empty string for empty warnings array', () => {
    expect(formatNavigationWarnings([])).toBe('')
  })

  it('formats error warnings with correct header', () => {
    const warnings: NavigationWarning[] = [
      { type: 'missing_content', sourceId: 's1', message: 'Missing content', incompleteDependencies: [], severity: 'error' },
    ]
    const formatted = formatNavigationWarnings(warnings)
    expect(formatted).toContain('Critical Issues')
    expect(formatted).toContain('Missing content')
  })

  it('formats warning severity with correct header', () => {
    const warnings: NavigationWarning[] = [
      { type: 'incomplete_dependency', sourceId: 's1', message: 'Incomplete', incompleteDependencies: [], severity: 'warning' },
    ]
    const formatted = formatNavigationWarnings(warnings)
    expect(formatted).toContain('Warnings')
  })

  it('formats info warnings with correct header', () => {
    const warnings: NavigationWarning[] = [
      { type: 'stale_reference', sourceId: 's1', message: 'Draft reference', incompleteDependencies: [], severity: 'info' },
    ]
    const formatted = formatNavigationWarnings(warnings)
    expect(formatted).toContain('Notes')
  })

  it('groups warnings by severity', () => {
    const warnings: NavigationWarning[] = [
      { type: 'missing_content', sourceId: 's1', message: 'Error 1', incompleteDependencies: [], severity: 'error' },
      { type: 'incomplete_dependency', sourceId: 's2', message: 'Warning 1', incompleteDependencies: [], severity: 'warning' },
      { type: 'stale_reference', sourceId: 's3', message: 'Info 1', incompleteDependencies: [], severity: 'info' },
    ]
    const formatted = formatNavigationWarnings(warnings)

    expect(formatted).toContain('Critical Issues')
    expect(formatted).toContain('Warnings')
    expect(formatted).toContain('Notes')
  })
})

// ============================================================================
// getRecommendedNextSection Tests (AC #1)
// ============================================================================

describe('getRecommendedNextSection', () => {
  it('returns first incomplete section without dependency issues', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const recommended = getRecommendedNextSection(outline, slides, graph)

    // sec-1 is complete, sec-2 is in_progress (first incomplete)
    expect(recommended).toBe('sec-2')
  })

  it('returns null when all sections are complete', () => {
    const outline = createTestOutline().map(s => ({ ...s, status: 'complete' as const }))
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const recommended = getRecommendedNextSection(outline, slides, graph)
    expect(recommended).toBeNull()
  })

  it('skips sections with blocking dependencies', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // sec-3 depends on sec-2 (in progress)
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's5', 's4') // s5 in sec-3 references s4 in sec-2

    const recommended = getRecommendedNextSection(outline, slides, graph)

    // sec-2 should be recommended first
    expect(recommended).toBe('sec-2')
  })

  it('recommends section in order preference', () => {
    // Mark sec-1 and sec-2 as complete
    const outline = createTestOutline()
    outline[0]!.status = 'complete'
    outline[1]!.status = 'complete'

    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const recommended = getRecommendedNextSection(outline, slides, graph)
    expect(recommended).toBe('sec-3') // Next in order
  })
})

// ============================================================================
// checkJumpSafety Tests
// ============================================================================

describe('checkJumpSafety', () => {
  it('returns safe for backward navigation', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const result = checkJumpSafety(2, 1, outline, slides, graph)

    expect(result.isSafe).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it('returns safe for first navigation', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const result = checkJumpSafety(null, 0, outline, slides, graph)

    expect(result.isSafe).toBe(true)
  })

  it('warns when skipping incomplete sections', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    // Jump from 0 to 3, skipping sec-2 (in_progress) and sec-3 (pending)
    const result = checkJumpSafety(0, 3, outline, slides, graph)

    expect(result.warnings.length).toBeGreaterThan(0)
    expect(result.warnings.some(w => w.type === 'missing_content')).toBe(true)
  })

  it('includes dependency warnings for target section', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // s7 in sec-4 references s5 in sec-3 (pending)
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's5')

    const result = checkJumpSafety(0, 3, outline, slides, graph)

    expect(result.warnings.some(w => w.type === 'incomplete_dependency')).toBe(true)
  })

  it('returns not safe when target has blocking warnings', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // s7 references s5 (pending section)
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's5')

    const result = checkJumpSafety(0, 3, outline, slides, graph)

    expect(result.isSafe).toBe(false)
  })

  it('returns safe for valid sequential navigation', () => {
    const outline = createTestOutline()
    outline[1]!.status = 'complete' // sec-2 complete

    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    const result = checkJumpSafety(1, 2, outline, slides, graph)

    expect(result.isSafe).toBe(true)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('navigation-coherence integration', () => {
  it('scenario: Navigate through CIM workflow sequentially', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    // Start at sec-1 (complete)
    let recommended = getRecommendedNextSection(outline, slides, graph)
    expect(recommended).toBe('sec-2') // First incomplete

    // Mark sec-2 complete
    outline[1]!.status = 'complete'
    recommended = getRecommendedNextSection(outline, slides, graph)
    expect(recommended).toBe('sec-3')

    // Check coherence for sec-3
    const warnings = checkNavigationCoherence('sec-3', outline, slides, graph)
    expect(warnings).toEqual([]) // No dependencies
  })

  it('scenario: Jump ahead with dependencies check', () => {
    const outline = createTestOutline()
    const slides = createTestSlides()

    // Set up dependencies: sec-4 depends on sec-3
    let graph = createEmptyDependencyGraph()
    graph = addDependency(graph, 's7', 's5')

    // Try to jump from sec-1 to sec-4
    const jumpResult = checkJumpSafety(0, 3, outline, slides, graph)

    // Should warn about skipped sections and dependencies
    expect(jumpResult.isSafe).toBe(false)
    expect(jumpResult.warnings.length).toBeGreaterThan(0)

    // Check what warnings we'd get
    const coherenceWarnings = checkNavigationCoherence('sec-4', outline, slides, graph)
    expect(shouldRequireConfirmation(coherenceWarnings)).toBe(true)

    // Get context for user
    const context = getNavigationContextSummary('sec-4', outline, slides, graph)
    expect(context).toContain('Market Opportunity')
    expect(context).toContain('References content from')
  })

  it('scenario: Complete section removes it from recommendations', () => {
    const outline = createTestOutline()
    outline[0]!.status = 'complete'
    outline[1]!.status = 'complete'
    outline[2]!.status = 'complete'

    const slides = createTestSlides()
    const graph = createEmptyDependencyGraph()

    // Only sec-4 remains
    const recommended = getRecommendedNextSection(outline, slides, graph)
    expect(recommended).toBe('sec-4')

    // Complete sec-4
    outline[3]!.status = 'complete'
    const finalRecommended = getRecommendedNextSection(outline, slides, graph)
    expect(finalRecommended).toBeNull()
  })
})
