/**
 * CIM Navigation Types Tests
 * Story: E9.13 - Non-Linear Navigation with Context
 * AC #2, #3: Navigation state tracking with history
 */

import { describe, it, expect } from 'vitest'
import {
  NAVIGATION_TYPES,
  createDefaultNavigationState,
  determineNavigationType,
  canNavigateBack,
  canNavigateForward,
  NavigationStateSchema,
  NavigationEventSchema,
  NavigationResultSchema,
  NavigationWarningSchema,
  NavigationOptionsSchema,
} from '@/lib/types/cim'
import type { NavigationState, NavigationEvent, NavigationWarning } from '@/lib/types/cim'

// ============================================================================
// Constants Tests
// ============================================================================

describe('NAVIGATION_TYPES', () => {
  it('has all expected navigation types', () => {
    expect(NAVIGATION_TYPES).toContain('sequential')
    expect(NAVIGATION_TYPES).toContain('jump')
    expect(NAVIGATION_TYPES).toContain('backward')
    expect(NAVIGATION_TYPES).toContain('forward')
  })

  it('has exactly 4 navigation types', () => {
    expect(NAVIGATION_TYPES.length).toBe(4)
  })
})

// ============================================================================
// createDefaultNavigationState Tests
// ============================================================================

describe('createDefaultNavigationState', () => {
  it('creates state with null currentSectionId', () => {
    const state = createDefaultNavigationState()
    expect(state.currentSectionId).toBeNull()
  })

  it('creates state with null currentSlideId', () => {
    const state = createDefaultNavigationState()
    expect(state.currentSlideId).toBeNull()
  })

  it('creates state with empty history array', () => {
    const state = createDefaultNavigationState()
    expect(state.history).toEqual([])
  })

  it('creates state with historyIndex of -1', () => {
    const state = createDefaultNavigationState()
    expect(state.historyIndex).toBe(-1)
  })

  it('creates state with empty flaggedSections', () => {
    const state = createDefaultNavigationState()
    expect(state.flaggedSections).toEqual({})
  })

  it('returns new object each call', () => {
    const state1 = createDefaultNavigationState()
    const state2 = createDefaultNavigationState()
    expect(state1).not.toBe(state2)
  })
})

// ============================================================================
// determineNavigationType Tests
// ============================================================================

describe('determineNavigationType', () => {
  it('returns sequential for first navigation', () => {
    const type = determineNavigationType(null, 0, -1, 0)
    expect(type).toBe('sequential')
  })

  it('returns sequential for moving to next section', () => {
    const type = determineNavigationType(0, 1, 0, 1)
    expect(type).toBe('sequential')
  })

  it('returns backward for moving to previous section', () => {
    const type = determineNavigationType(1, 0, 0, 1)
    expect(type).toBe('backward')
  })

  it('returns jump for moving more than one section forward', () => {
    const type = determineNavigationType(0, 2, 0, 1)
    expect(type).toBe('jump')
  })

  it('returns jump for moving more than one section backward', () => {
    // Large backward jumps are classified as 'jump' not 'backward' since
    // they're non-sequential (may skip content)
    const type = determineNavigationType(3, 1, 0, 1)
    expect(type).toBe('jump')
  })

  it('returns forward when moving through history', () => {
    // historyIndex < historyLength - 1 means we're in the middle of history
    const type = determineNavigationType(0, 1, 0, 3)
    expect(type).toBe('forward')
  })
})

// ============================================================================
// canNavigateBack Tests
// ============================================================================

describe('canNavigateBack', () => {
  it('returns false for empty history', () => {
    const state: NavigationState = {
      currentSectionId: null,
      currentSlideId: null,
      history: [],
      historyIndex: -1,
      flaggedSections: {},
    }
    expect(canNavigateBack(state)).toBe(false)
  })

  it('returns false at beginning of history', () => {
    const state: NavigationState = {
      currentSectionId: 'sec-1',
      currentSlideId: null,
      history: [createMockEvent('sec-1')],
      historyIndex: 0,
      flaggedSections: {},
    }
    expect(canNavigateBack(state)).toBe(false)
  })

  it('returns true when not at beginning of history', () => {
    const state: NavigationState = {
      currentSectionId: 'sec-2',
      currentSlideId: null,
      history: [createMockEvent('sec-1'), createMockEvent('sec-2')],
      historyIndex: 1,
      flaggedSections: {},
    }
    expect(canNavigateBack(state)).toBe(true)
  })
})

// ============================================================================
// canNavigateForward Tests
// ============================================================================

describe('canNavigateForward', () => {
  it('returns false for empty history', () => {
    const state: NavigationState = {
      currentSectionId: null,
      currentSlideId: null,
      history: [],
      historyIndex: -1,
      flaggedSections: {},
    }
    expect(canNavigateForward(state)).toBe(false)
  })

  it('returns false at end of history', () => {
    const state: NavigationState = {
      currentSectionId: 'sec-2',
      currentSlideId: null,
      history: [createMockEvent('sec-1'), createMockEvent('sec-2')],
      historyIndex: 1,
      flaggedSections: {},
    }
    expect(canNavigateForward(state)).toBe(false)
  })

  it('returns true when not at end of history', () => {
    const state: NavigationState = {
      currentSectionId: 'sec-1',
      currentSlideId: null,
      history: [createMockEvent('sec-1'), createMockEvent('sec-2')],
      historyIndex: 0,
      flaggedSections: {},
    }
    expect(canNavigateForward(state)).toBe(true)
  })
})

// ============================================================================
// Zod Schema Tests
// ============================================================================

describe('NavigationWarningSchema', () => {
  it('validates correct warning object', () => {
    const warning = {
      type: 'incomplete_dependency',
      sourceId: 'sec-1',
      message: 'Section depends on incomplete section',
      incompleteDependencies: ['sec-2'],
      severity: 'warning',
    }
    const result = NavigationWarningSchema.safeParse(warning)
    expect(result.success).toBe(true)
  })

  it('rejects invalid type', () => {
    const warning = {
      type: 'invalid_type',
      sourceId: 'sec-1',
      message: 'Test',
      incompleteDependencies: [],
      severity: 'warning',
    }
    const result = NavigationWarningSchema.safeParse(warning)
    expect(result.success).toBe(false)
  })

  it('rejects invalid severity', () => {
    const warning = {
      type: 'incomplete_dependency',
      sourceId: 'sec-1',
      message: 'Test',
      incompleteDependencies: [],
      severity: 'critical', // invalid
    }
    const result = NavigationWarningSchema.safeParse(warning)
    expect(result.success).toBe(false)
  })
})

describe('NavigationEventSchema', () => {
  it('validates correct event object', () => {
    const event = {
      id: 'test-id',
      type: 'sequential',
      fromSectionId: null,
      toSectionId: 'sec-1',
      timestamp: new Date().toISOString(),
      warnings: [],
      warningsAcknowledged: false,
    }
    const result = NavigationEventSchema.safeParse(event)
    expect(result.success).toBe(true)
  })

  it('validates event with warnings', () => {
    const event = {
      id: 'test-id',
      type: 'jump',
      fromSectionId: 'sec-1',
      toSectionId: 'sec-3',
      timestamp: new Date().toISOString(),
      warnings: [
        {
          type: 'incomplete_dependency',
          sourceId: 'sec-3',
          message: 'Depends on incomplete section',
          incompleteDependencies: ['sec-2'],
          severity: 'warning',
        },
      ],
      warningsAcknowledged: true,
    }
    const result = NavigationEventSchema.safeParse(event)
    expect(result.success).toBe(true)
  })
})

describe('NavigationStateSchema', () => {
  it('validates default navigation state', () => {
    const state = createDefaultNavigationState()
    const result = NavigationStateSchema.safeParse(state)
    expect(result.success).toBe(true)
  })

  it('validates state with history', () => {
    const state = {
      currentSectionId: 'sec-2',
      currentSlideId: 's3',
      history: [createMockEvent('sec-1'), createMockEvent('sec-2')],
      historyIndex: 1,
      flaggedSections: {
        'sec-2': [
          {
            type: 'stale_reference',
            sourceId: 'sec-2',
            message: 'Has draft reference',
            incompleteDependencies: [],
            severity: 'info',
          },
        ],
      },
    }
    const result = NavigationStateSchema.safeParse(state)
    expect(result.success).toBe(true)
  })
})

describe('NavigationResultSchema', () => {
  it('validates successful result', () => {
    const result = {
      success: true,
      event: createMockEvent('sec-1'),
      state: createDefaultNavigationState(),
      warnings: [],
      requiresConfirmation: false,
      message: 'Navigation successful',
    }
    const parsed = NavigationResultSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })

  it('validates failed result', () => {
    const result = {
      success: false,
      event: null,
      state: createDefaultNavigationState(),
      warnings: [],
      requiresConfirmation: false,
      message: 'Section not found',
    }
    const parsed = NavigationResultSchema.safeParse(result)
    expect(parsed.success).toBe(true)
  })
})

describe('NavigationOptionsSchema', () => {
  it('validates empty options', () => {
    const result = NavigationOptionsSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('validates all options', () => {
    const options = {
      skipCoherenceCheck: true,
      acknowledgeWarnings: true,
      includeContextSummary: true,
    }
    const result = NavigationOptionsSchema.safeParse(options)
    expect(result.success).toBe(true)
  })

  it('validates partial options', () => {
    const options = {
      skipCoherenceCheck: false,
    }
    const result = NavigationOptionsSchema.safeParse(options)
    expect(result.success).toBe(true)
  })
})

// ============================================================================
// Helper Functions
// ============================================================================

function createMockEvent(toSectionId: string, fromSectionId: string | null = null): NavigationEvent {
  return {
    id: `event-${Math.random().toString(36).substr(2, 9)}`,
    type: fromSectionId ? 'sequential' : 'sequential',
    fromSectionId,
    toSectionId,
    timestamp: new Date().toISOString(),
    warnings: [],
    warningsAcknowledged: false,
  }
}
