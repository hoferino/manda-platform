/**
 * useCIMNavigation Hook Tests
 * Story: E9.13 - Non-Linear Navigation with Context
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCIMNavigation } from '@/lib/hooks/useCIMNavigation'
import type { OutlineSection, Slide, DependencyGraph } from '@/lib/types/cim'
import { addDependency, createEmptyDependencyGraph } from '@/lib/agent/cim/utils/dependency-graph'

// Mock uuid
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
}))

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestOutline(): OutlineSection[] {
  return [
    {
      id: 'sec-1',
      title: 'Executive Summary',
      description: 'Overview',
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
      title: 'Financials',
      description: 'Financial performance',
      order: 2,
      status: 'pending',
      slide_ids: ['s5', 's6'],
    },
  ]
}

function createTestSlides(): Slide[] {
  const now = new Date().toISOString()
  return [
    { id: 's1', section_id: 'sec-1', title: 'Title', components: [], visual_concept: null, status: 'approved', created_at: now, updated_at: now },
    { id: 's2', section_id: 'sec-1', title: 'Highlights', components: [], visual_concept: null, status: 'approved', created_at: now, updated_at: now },
    { id: 's3', section_id: 'sec-2', title: 'History', components: [], visual_concept: null, status: 'approved', created_at: now, updated_at: now },
    { id: 's4', section_id: 'sec-2', title: 'Products', components: [], visual_concept: null, status: 'draft', created_at: now, updated_at: now },
    { id: 's5', section_id: 'sec-3', title: 'Revenue', components: [], visual_concept: null, status: 'draft', created_at: now, updated_at: now },
    { id: 's6', section_id: 'sec-3', title: 'Growth', components: [], visual_concept: null, status: 'draft', created_at: now, updated_at: now },
  ]
}

// ============================================================================
// Initialization Tests
// ============================================================================

describe('useCIMNavigation', () => {
  describe('initialization', () => {
    it('initializes with default navigation state', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      expect(result.current.navigationState.currentSectionId).toBeNull()
      expect(result.current.navigationState.currentSlideId).toBeNull()
      expect(result.current.navigationState.history).toEqual([])
      expect(result.current.navigationState.historyIndex).toBe(-1)
      expect(result.current.currentSection).toBeNull()
    })

    it('initializes with provided initial section', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
          initialSectionId: 'sec-1',
        })
      )

      expect(result.current.navigationState.currentSectionId).toBe('sec-1')
      expect(result.current.currentSection?.title).toBe('Executive Summary')
    })
  })

  // ============================================================================
  // navigateToSection Tests (AC #1)
  // ============================================================================

  describe('navigateToSection', () => {
    it('navigates to valid section', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      act(() => {
        result.current.navigateToSection('sec-2')
      })

      expect(result.current.navigationState.currentSectionId).toBe('sec-2')
      expect(result.current.currentSection?.title).toBe('Company Overview')
    })

    it('returns success result on valid navigation', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('sec-2')
      })

      expect(navResult!.success).toBe(true)
      expect(navResult!.event).not.toBeNull()
      expect(navResult!.event?.toSectionId).toBe('sec-2')
    })

    it('returns failure result for non-existent section', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('non-existent')
      })

      expect(navResult!.success).toBe(false)
      expect(navResult!.message).toBe('Section not found')
    })

    it('detects sequential navigation type', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
          initialSectionId: 'sec-1',
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('sec-2')
      })

      expect(navResult!.event?.type).toBe('sequential')
    })

    it('detects jump navigation type', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
          initialSectionId: 'sec-1',
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('sec-3')
      })

      expect(navResult!.event?.type).toBe('jump')
    })

    it('detects backward navigation type', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
          initialSectionId: 'sec-2',
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('sec-1')
      })

      expect(navResult!.event?.type).toBe('backward')
    })

    it('calls onNavigate callback', () => {
      const onNavigate = vi.fn()
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
          onNavigate,
        })
      )

      act(() => {
        result.current.navigateToSection('sec-2')
      })

      expect(onNavigate).toHaveBeenCalledTimes(1)
      expect(onNavigate).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        event: expect.objectContaining({ toSectionId: 'sec-2' }),
      }))
    })
  })

  // ============================================================================
  // Coherence Check Tests (AC #6)
  // ============================================================================

  describe('coherence checks', () => {
    it('returns warnings for incomplete dependencies', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's5', 's4') // sec-3 depends on sec-2

      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: graph,
          initialSectionId: 'sec-1',
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('sec-3')
      })

      expect(navResult!.warnings.length).toBeGreaterThan(0)
    })

    it('requires confirmation for warning-level issues', () => {
      const outline = createTestOutline()
      const slides = createTestSlides()

      // sec-3 references sec-2 which is pending
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's5', 's4')

      // Mark sec-2 as pending to trigger warning
      outline[1]!.status = 'pending'

      const { result } = renderHook(() =>
        useCIMNavigation({
          outline,
          slides,
          dependencyGraph: graph,
          initialSectionId: 'sec-1',
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('sec-3')
      })

      expect(navResult!.requiresConfirmation).toBe(true)
    })

    it('skips coherence check when option set', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's5', 's4')

      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: graph,
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('sec-3', { skipCoherenceCheck: true })
      })

      expect(navResult!.warnings).toEqual([])
      expect(navResult!.requiresConfirmation).toBe(false)
    })

    it('acknowledges warnings when option set', () => {
      const outline = createTestOutline()
      outline[1]!.status = 'pending'

      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's5', 's4')

      const { result } = renderHook(() =>
        useCIMNavigation({
          outline,
          slides: createTestSlides(),
          dependencyGraph: graph,
        })
      )

      let navResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        navResult = result.current.navigateToSection('sec-3', { acknowledgeWarnings: true })
      })

      expect(navResult!.requiresConfirmation).toBe(false)
      expect(navResult!.event?.warningsAcknowledged).toBe(true)
    })
  })

  // ============================================================================
  // History Navigation Tests (AC #2)
  // ============================================================================

  describe('history navigation', () => {
    it('tracks navigation history', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      act(() => {
        result.current.navigateToSection('sec-1')
      })
      act(() => {
        result.current.navigateToSection('sec-2')
      })
      act(() => {
        result.current.navigateToSection('sec-3')
      })

      expect(result.current.navigationState.history.length).toBe(3)
      expect(result.current.navigationState.historyIndex).toBe(2)
    })

    it('can go back in history', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      act(() => {
        result.current.navigateToSection('sec-1')
      })
      act(() => {
        result.current.navigateToSection('sec-2')
      })

      expect(result.current.canGoBack).toBe(true)

      act(() => {
        result.current.goBack()
      })

      expect(result.current.navigationState.currentSectionId).toBe('sec-1')
      expect(result.current.navigationState.historyIndex).toBe(0)
    })

    it('can go forward in history after going back', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      act(() => {
        result.current.navigateToSection('sec-1')
      })
      act(() => {
        result.current.navigateToSection('sec-2')
      })
      act(() => {
        result.current.goBack()
      })

      expect(result.current.canGoForward).toBe(true)

      act(() => {
        result.current.goForward()
      })

      expect(result.current.navigationState.currentSectionId).toBe('sec-2')
    })

    it('cannot go back at start of history', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      act(() => {
        result.current.navigateToSection('sec-1')
      })

      expect(result.current.canGoBack).toBe(false)

      let backResult: ReturnType<typeof result.current.goBack> = null
      act(() => {
        backResult = result.current.goBack()
      })

      expect(backResult).toBeNull()
    })

    it('cannot go forward at end of history', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      act(() => {
        result.current.navigateToSection('sec-1')
      })

      expect(result.current.canGoForward).toBe(false)
    })

    it('truncates forward history on new navigation', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      act(() => {
        result.current.navigateToSection('sec-1')
      })
      act(() => {
        result.current.navigateToSection('sec-2')
      })
      act(() => {
        result.current.navigateToSection('sec-3')
      })
      act(() => {
        result.current.goBack()
      })
      act(() => {
        result.current.goBack()
      })
      // Now at sec-1, with sec-2 and sec-3 in forward history
      act(() => {
        result.current.navigateToSection('sec-3') // New navigation
      })

      // History should now be: sec-1, sec-3 (sec-2 was truncated)
      expect(result.current.navigationState.history.length).toBe(2)
      expect(result.current.canGoForward).toBe(false)
    })
  })

  // ============================================================================
  // Helper Methods Tests
  // ============================================================================

  describe('helper methods', () => {
    it('getWarningsForSection returns warnings for specific section', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's5', 's4')

      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: graph,
        })
      )

      const warnings = result.current.getWarningsForSection('sec-3')
      expect(warnings.length).toBeGreaterThan(0)
    })

    it('getSectionsWithWarnings returns all sections with issues', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's5', 's4')

      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: graph,
        })
      )

      const sectionsWithWarnings = result.current.getSectionsWithWarnings()
      expect(Object.keys(sectionsWithWarnings).length).toBeGreaterThan(0)
    })

    it('getRecommendedNext returns appropriate section', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      const recommended = result.current.getRecommendedNext()
      expect(recommended).toBe('sec-2') // First incomplete section
    })

    it('getContextSummary returns section information', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      const context = result.current.getContextSummary('sec-2')
      expect(context).toContain('Company Overview')
      expect(context).toContain('in_progress')
    })

    it('acknowledgeWarnings updates current event', () => {
      const outline = createTestOutline()
      outline[1]!.status = 'pending'

      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's5', 's4')

      const { result } = renderHook(() =>
        useCIMNavigation({
          outline,
          slides: createTestSlides(),
          dependencyGraph: graph,
        })
      )

      act(() => {
        result.current.navigateToSection('sec-3')
      })

      expect(result.current.navigationState.history[0]?.warningsAcknowledged).toBe(false)

      act(() => {
        result.current.acknowledgeWarnings()
      })

      expect(result.current.navigationState.history[0]?.warningsAcknowledged).toBe(true)
    })

    it('resetNavigation clears state', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
          initialSectionId: 'sec-1',
        })
      )

      act(() => {
        result.current.navigateToSection('sec-2')
        result.current.navigateToSection('sec-3')
        result.current.resetNavigation()
      })

      expect(result.current.navigationState.currentSectionId).toBeNull()
      expect(result.current.navigationState.history).toEqual([])
      expect(result.current.navigationState.historyIndex).toBe(-1)
    })
  })

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe('integration scenarios', () => {
    it('scenario: Complete workflow navigation', () => {
      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: createEmptyDependencyGraph(),
        })
      )

      // Navigate through sections sequentially
      act(() => {
        const r1 = result.current.navigateToSection('sec-1')
        expect(r1.success).toBe(true)
        expect(r1.event?.type).toBe('sequential')
      })

      act(() => {
        const r2 = result.current.navigateToSection('sec-2')
        expect(r2.success).toBe(true)
        expect(r2.event?.type).toBe('sequential')
      })

      // Go back and check history
      act(() => {
        const backResult = result.current.goBack()
        expect(backResult?.success).toBe(true)
      })

      expect(result.current.navigationState.currentSectionId).toBe('sec-1')
      expect(result.current.canGoForward).toBe(true)
    })

    it('scenario: Jump with dependencies', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's5', 's4')

      const { result } = renderHook(() =>
        useCIMNavigation({
          outline: createTestOutline(),
          slides: createTestSlides(),
          dependencyGraph: graph,
          initialSectionId: 'sec-1',
        })
      )

      // Jump to sec-3 which has dependencies on sec-2
      let jumpResult: ReturnType<typeof result.current.navigateToSection>
      act(() => {
        jumpResult = result.current.navigateToSection('sec-3')
      })

      expect(jumpResult!.event?.type).toBe('jump')
      expect(jumpResult!.warnings.length).toBeGreaterThan(0)

      // Warnings should be stored in state
      expect(result.current.navigationState.flaggedSections['sec-3']).toBeDefined()
    })
  })
})
