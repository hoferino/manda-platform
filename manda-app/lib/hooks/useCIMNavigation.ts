'use client'

/**
 * useCIMNavigation Hook
 *
 * Manages navigation between CIM sections with context awareness.
 * Extends basic navigation with:
 * - Navigation history tracking
 * - Dependency-aware coherence checking
 * - Warning management for incomplete dependencies
 * - Forward/backward navigation through history
 *
 * Story: E9.13 - Non-Linear Navigation with Context
 * AC: #1 - Click to jump to any section
 * AC: #2 - Navigation state tracking with history
 * AC: #3 - Agent maintains workflow state awareness
 * AC: #4 - Context message on non-sequential navigation
 * AC: #5 - Agent can retrieve context for any section
 * AC: #6 - Coherence check on jump ahead
 */

import { useCallback, useMemo, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import type {
  OutlineSection,
  Slide,
  DependencyGraph,
  NavigationState,
  NavigationEvent,
  NavigationResult,
  NavigationWarning,
  NavigationOptions,
  NavigationType,
} from '@/lib/types/cim'
import {
  createDefaultNavigationState,
  determineNavigationType,
  canNavigateBack,
  canNavigateForward,
} from '@/lib/types/cim'
import {
  checkNavigationCoherence,
  getNavigationContextSummary,
  shouldRequireConfirmation,
  getRecommendedNextSection,
} from '@/lib/agent/cim/utils/navigation-coherence'

interface UseCIMNavigationOptions {
  outline: OutlineSection[]
  slides: Slide[]
  dependencyGraph: DependencyGraph
  initialSectionId?: string | null
  onNavigate?: (result: NavigationResult) => void
}

interface UseCIMNavigationReturn {
  /** Current navigation state */
  navigationState: NavigationState
  /** Current section (if any) */
  currentSection: OutlineSection | null
  /** Navigate to a specific section */
  navigateToSection: (sectionId: string, options?: NavigationOptions) => NavigationResult
  /** Go back in navigation history */
  goBack: () => NavigationResult | null
  /** Go forward in navigation history */
  goForward: () => NavigationResult | null
  /** Can navigate backward in history */
  canGoBack: boolean
  /** Can navigate forward in history */
  canGoForward: boolean
  /** Get warnings for a section */
  getWarningsForSection: (sectionId: string) => NavigationWarning[]
  /** Get all sections with warnings */
  getSectionsWithWarnings: () => Record<string, NavigationWarning[]>
  /** Get recommended next section */
  getRecommendedNext: () => string | null
  /** Get context summary for a section */
  getContextSummary: (sectionId: string) => string
  /** Acknowledge warnings for current navigation */
  acknowledgeWarnings: () => void
  /** Reset navigation state */
  resetNavigation: () => void
}

export function useCIMNavigation({
  outline,
  slides,
  dependencyGraph,
  initialSectionId = null,
  onNavigate,
}: UseCIMNavigationOptions): UseCIMNavigationReturn {
  // Navigation state
  const [navigationState, setNavigationState] = useState<NavigationState>(() => {
    const defaultState = createDefaultNavigationState()
    if (initialSectionId) {
      defaultState.currentSectionId = initialSectionId
    }
    return defaultState
  })

  // Current section
  const currentSection = useMemo(() => {
    if (!navigationState.currentSectionId) return null
    return outline.find((s) => s.id === navigationState.currentSectionId) ?? null
  }, [outline, navigationState.currentSectionId])

  // Sort outline by order for index calculations
  const sortedOutline = useMemo(
    () => [...outline].sort((a, b) => a.order - b.order),
    [outline]
  )

  // Get index of a section
  const getSectionIndex = useCallback(
    (sectionId: string | null): number | null => {
      if (!sectionId) return null
      const index = sortedOutline.findIndex((s) => s.id === sectionId)
      return index >= 0 ? index : null
    },
    [sortedOutline]
  )

  // Navigate to a specific section
  const navigateToSection = useCallback(
    (sectionId: string, options: NavigationOptions = {}): NavigationResult => {
      const targetSection = outline.find((s) => s.id === sectionId)

      if (!targetSection) {
        return {
          success: false,
          event: null,
          state: navigationState,
          warnings: [],
          requiresConfirmation: false,
          message: 'Section not found',
        }
      }

      // Get current and target indices
      const fromIndex = getSectionIndex(navigationState.currentSectionId)
      const toIndex = getSectionIndex(sectionId)

      if (toIndex === null) {
        return {
          success: false,
          event: null,
          state: navigationState,
          warnings: [],
          requiresConfirmation: false,
          message: 'Invalid section',
        }
      }

      // Determine navigation type
      const navigationType: NavigationType = determineNavigationType(
        fromIndex,
        toIndex,
        navigationState.historyIndex,
        navigationState.history.length
      )

      // Check coherence unless skipped
      let warnings: NavigationWarning[] = []
      if (!options.skipCoherenceCheck) {
        warnings = checkNavigationCoherence(sectionId, outline, slides, dependencyGraph)
      }

      const requiresConfirmation = shouldRequireConfirmation(warnings) && !options.acknowledgeWarnings

      // Create navigation event
      const event: NavigationEvent = {
        id: uuidv4(),
        type: navigationType,
        fromSectionId: navigationState.currentSectionId,
        toSectionId: sectionId,
        timestamp: new Date().toISOString(),
        warnings,
        warningsAcknowledged: options.acknowledgeWarnings ?? false,
      }

      // Update flagged sections based on warnings
      const flaggedSections = { ...navigationState.flaggedSections }
      if (warnings.length > 0) {
        flaggedSections[sectionId] = warnings
      } else {
        delete flaggedSections[sectionId]
      }

      // Update navigation state
      // Truncate history if we're navigating from middle of history
      const newHistory =
        navigationState.historyIndex < navigationState.history.length - 1
          ? navigationState.history.slice(0, navigationState.historyIndex + 1)
          : [...navigationState.history]

      newHistory.push(event)

      const newState: NavigationState = {
        currentSectionId: sectionId,
        currentSlideId: null, // Reset to first slide in section
        history: newHistory,
        historyIndex: newHistory.length - 1,
        flaggedSections,
      }

      setNavigationState(newState)

      // Build message
      let message = `Navigated to "${targetSection.title}"`
      if (navigationType === 'jump' && warnings.length > 0) {
        message += ` (${warnings.length} warning${warnings.length > 1 ? 's' : ''})`
      }

      const result: NavigationResult = {
        success: true,
        event,
        state: newState,
        warnings,
        requiresConfirmation,
        message,
      }

      // Call callback
      onNavigate?.(result)

      return result
    },
    [
      outline,
      slides,
      dependencyGraph,
      navigationState,
      getSectionIndex,
      onNavigate,
    ]
  )

  // Go back in history
  const goBack = useCallback((): NavigationResult | null => {
    if (!canNavigateBack(navigationState)) {
      return null
    }

    const newIndex = navigationState.historyIndex - 1
    const previousEvent = navigationState.history[newIndex]

    if (!previousEvent) {
      return null
    }

    // Navigate to the previous section
    const newState: NavigationState = {
      ...navigationState,
      currentSectionId: previousEvent.toSectionId,
      currentSlideId: null,
      historyIndex: newIndex,
    }

    setNavigationState(newState)

    const result: NavigationResult = {
      success: true,
      event: previousEvent,
      state: newState,
      warnings: previousEvent.warnings,
      requiresConfirmation: false,
      message: `Navigated back to previous section`,
    }

    onNavigate?.(result)
    return result
  }, [navigationState, onNavigate])

  // Go forward in history
  const goForward = useCallback((): NavigationResult | null => {
    if (!canNavigateForward(navigationState)) {
      return null
    }

    const newIndex = navigationState.historyIndex + 1
    const nextEvent = navigationState.history[newIndex]

    if (!nextEvent) {
      return null
    }

    const newState: NavigationState = {
      ...navigationState,
      currentSectionId: nextEvent.toSectionId,
      currentSlideId: null,
      historyIndex: newIndex,
    }

    setNavigationState(newState)

    const result: NavigationResult = {
      success: true,
      event: nextEvent,
      state: newState,
      warnings: nextEvent.warnings,
      requiresConfirmation: false,
      message: `Navigated forward to next section`,
    }

    onNavigate?.(result)
    return result
  }, [navigationState, onNavigate])

  // Can navigate back/forward
  const canGoBack = useMemo(
    () => canNavigateBack(navigationState),
    [navigationState]
  )

  const canGoForward = useMemo(
    () => canNavigateForward(navigationState),
    [navigationState]
  )

  // Get warnings for a specific section
  const getWarningsForSection = useCallback(
    (sectionId: string): NavigationWarning[] => {
      return checkNavigationCoherence(sectionId, outline, slides, dependencyGraph)
    },
    [outline, slides, dependencyGraph]
  )

  // Get all sections with warnings
  const getSectionsWithWarnings = useCallback((): Record<string, NavigationWarning[]> => {
    const warnings: Record<string, NavigationWarning[]> = {}

    for (const section of outline) {
      const sectionWarnings = checkNavigationCoherence(
        section.id,
        outline,
        slides,
        dependencyGraph
      )
      if (sectionWarnings.length > 0) {
        warnings[section.id] = sectionWarnings
      }
    }

    return warnings
  }, [outline, slides, dependencyGraph])

  // Get recommended next section
  const getRecommendedNext = useCallback((): string | null => {
    return getRecommendedNextSection(outline, slides, dependencyGraph)
  }, [outline, slides, dependencyGraph])

  // Get context summary for a section
  const getContextSummary = useCallback(
    (sectionId: string): string => {
      return getNavigationContextSummary(sectionId, outline, slides, dependencyGraph)
    },
    [outline, slides, dependencyGraph]
  )

  // Acknowledge warnings for current navigation
  const acknowledgeWarnings = useCallback(() => {
    if (navigationState.history.length === 0) return

    const currentEvent = navigationState.history[navigationState.historyIndex]
    if (!currentEvent) return

    const updatedHistory = [...navigationState.history]
    updatedHistory[navigationState.historyIndex] = {
      ...currentEvent,
      warningsAcknowledged: true,
    }

    setNavigationState({
      ...navigationState,
      history: updatedHistory,
    })
  }, [navigationState])

  // Reset navigation state
  const resetNavigation = useCallback(() => {
    setNavigationState(createDefaultNavigationState())
  }, [])

  return {
    navigationState,
    currentSection,
    navigateToSection,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    getWarningsForSection,
    getSectionsWithWarnings,
    getRecommendedNext,
    getContextSummary,
    acknowledgeWarnings,
    resetNavigation,
  }
}
