/**
 * Dependency Graph Utilities Tests
 * Story: E9.11 - Dependency Tracking & Consistency Alerts
 * AC #1: Dependency Graph Maintenance
 */

import { describe, it, expect } from 'vitest'
import {
  createEmptyDependencyGraph,
  addDependency,
  removeDependency,
  getDependents,
  getReferences,
  hasDependents,
  hasReferences,
  updateGraphOnSlideChange,
  removeSlideFromGraph,
  getTransitiveDependents,
  validateGraph,
  getGraphStats,
} from '@/lib/agent/cim/utils/dependency-graph'
import type { DependencyGraph } from '@/lib/types/cim'

describe('dependency-graph', () => {
  // ============================================================================
  // createEmptyDependencyGraph Tests
  // ============================================================================

  describe('createEmptyDependencyGraph', () => {
    it('creates a graph with empty dependencies and references', () => {
      const graph = createEmptyDependencyGraph()
      expect(graph.dependencies).toEqual({})
      expect(graph.references).toEqual({})
    })
  })

  // ============================================================================
  // addDependency Tests (AC #1)
  // ============================================================================

  describe('addDependency', () => {
    it('adds a dependency edge between two slides', () => {
      const graph = createEmptyDependencyGraph()
      const result = addDependency(graph, 's7', 's3')

      // s7 references s3, so s3 has s7 as a dependent
      expect(result.dependencies['s3']).toContain('s7')
      expect(result.references['s7']).toContain('s3')
    })

    it('creates correct bidirectional relationship', () => {
      // Slide 7 says "Building on our $10M revenue from slide 3"
      // So s7 references s3
      const graph = createEmptyDependencyGraph()
      const result = addDependency(graph, 's7', 's3')

      // s3's dependents include s7 (s7 depends on s3)
      expect(getDependents(result, 's3')).toContain('s7')
      // s7's references include s3 (s7 references s3)
      expect(getReferences(result, 's7')).toContain('s3')
    })

    it('handles multiple dependents on one slide', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's3')

      expect(getDependents(graph, 's3')).toEqual(['s7', 's12'])
    })

    it('handles multiple references from one slide', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's7', 's5')

      expect(getReferences(graph, 's7')).toEqual(['s3', 's5'])
    })

    it('does not duplicate existing edges', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's7', 's3') // Duplicate

      expect(getDependents(graph, 's3')).toEqual(['s7'])
      expect(getReferences(graph, 's7')).toEqual(['s3'])
    })

    it('prevents self-references', () => {
      const graph = createEmptyDependencyGraph()
      const result = addDependency(graph, 's3', 's3')

      expect(getDependents(result, 's3')).toEqual([])
      expect(getReferences(result, 's3')).toEqual([])
    })

    it('returns original graph for empty slide IDs', () => {
      const graph = createEmptyDependencyGraph()
      expect(addDependency(graph, '', 's3')).toBe(graph)
      expect(addDependency(graph, 's7', '')).toBe(graph)
      expect(addDependency(graph, '', '')).toBe(graph)
    })

    it('does not mutate the original graph', () => {
      const original = createEmptyDependencyGraph()
      const result = addDependency(original, 's7', 's3')

      expect(original.dependencies).toEqual({})
      expect(original.references).toEqual({})
      expect(result).not.toBe(original)
    })
  })

  // ============================================================================
  // removeDependency Tests
  // ============================================================================

  describe('removeDependency', () => {
    it('removes a dependency edge between two slides', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      const result = removeDependency(graph, 's7', 's3')

      expect(result.dependencies['s3']).toBeUndefined()
      expect(result.references['s7']).toBeUndefined()
    })

    it('cleans up empty arrays from the graph', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = removeDependency(graph, 's7', 's3')

      expect(graph.dependencies).toEqual({})
      expect(graph.references).toEqual({})
    })

    it('only removes specified edge, keeps others', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's3')
      graph = removeDependency(graph, 's7', 's3')

      expect(getDependents(graph, 's3')).toEqual(['s12'])
      expect(getReferences(graph, 's7')).toEqual([])
      expect(getReferences(graph, 's12')).toEqual(['s3'])
    })

    it('handles removing non-existent edge gracefully', () => {
      const graph = createEmptyDependencyGraph()
      const result = removeDependency(graph, 's7', 's3')

      expect(result.dependencies).toEqual({})
      expect(result.references).toEqual({})
    })

    it('returns original graph for empty slide IDs', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')

      expect(removeDependency(graph, '', 's3').dependencies).toEqual(graph.dependencies)
      expect(removeDependency(graph, 's7', '').dependencies).toEqual(graph.dependencies)
    })

    it('does not mutate the original graph', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      const original = graph
      const result = removeDependency(graph, 's7', 's3')

      expect(original.dependencies['s3']).toContain('s7')
      expect(result).not.toBe(original)
    })
  })

  // ============================================================================
  // getDependents Tests (AC #1)
  // ============================================================================

  describe('getDependents', () => {
    it('returns all slides dependent on a given slide', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's3')

      const dependents = getDependents(graph, 's3')
      expect(dependents).toContain('s7')
      expect(dependents).toContain('s12')
      expect(dependents).toHaveLength(2)
    })

    it('returns empty array for slide with no dependents', () => {
      const graph = createEmptyDependencyGraph()
      expect(getDependents(graph, 's99')).toEqual([])
    })

    it('returns empty array for empty slide ID', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      expect(getDependents(graph, '')).toEqual([])
    })

    it('handles null/undefined graph gracefully', () => {
      const badGraph = { dependencies: undefined, references: {} } as unknown as DependencyGraph
      expect(getDependents(badGraph, 's3')).toEqual([])
    })
  })

  // ============================================================================
  // getReferences Tests (AC #1)
  // ============================================================================

  describe('getReferences', () => {
    it('returns all slides referenced by a given slide', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's7', 's5')

      const refs = getReferences(graph, 's7')
      expect(refs).toContain('s3')
      expect(refs).toContain('s5')
      expect(refs).toHaveLength(2)
    })

    it('returns empty array for slide with no references', () => {
      const graph = createEmptyDependencyGraph()
      expect(getReferences(graph, 's99')).toEqual([])
    })

    it('returns empty array for empty slide ID', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      expect(getReferences(graph, '')).toEqual([])
    })
  })

  // ============================================================================
  // hasDependents and hasReferences Tests
  // ============================================================================

  describe('hasDependents', () => {
    it('returns true when slide has dependents', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      expect(hasDependents(graph, 's3')).toBe(true)
    })

    it('returns false when slide has no dependents', () => {
      const graph = createEmptyDependencyGraph()
      expect(hasDependents(graph, 's3')).toBe(false)
    })
  })

  describe('hasReferences', () => {
    it('returns true when slide has references', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      expect(hasReferences(graph, 's7')).toBe(true)
    })

    it('returns false when slide has no references', () => {
      const graph = createEmptyDependencyGraph()
      expect(hasReferences(graph, 's7')).toBe(false)
    })
  })

  // ============================================================================
  // updateGraphOnSlideChange Tests (AC #1)
  // ============================================================================

  describe('updateGraphOnSlideChange', () => {
    it('updates references when a slide changes', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's7', 's5')

      // s7 now only references s4 and s6 (no longer s3 and s5)
      const result = updateGraphOnSlideChange(graph, 's7', ['s4', 's6'])

      expect(getReferences(result, 's7')).toEqual(['s4', 's6'])
      expect(getDependents(result, 's3')).toEqual([]) // s3 no longer has s7 as dependent
      expect(getDependents(result, 's5')).toEqual([]) // s5 no longer has s7 as dependent
      expect(getDependents(result, 's4')).toContain('s7')
      expect(getDependents(result, 's6')).toContain('s7')
    })

    it('handles adding new references', () => {
      const graph = createEmptyDependencyGraph()
      const result = updateGraphOnSlideChange(graph, 's7', ['s3', 's5'])

      expect(getReferences(result, 's7')).toEqual(['s3', 's5'])
      expect(getDependents(result, 's3')).toContain('s7')
      expect(getDependents(result, 's5')).toContain('s7')
    })

    it('handles removing all references', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      const result = updateGraphOnSlideChange(graph, 's7', [])

      expect(getReferences(result, 's7')).toEqual([])
      expect(getDependents(result, 's3')).toEqual([])
    })

    it('filters out self-references from new references', () => {
      const graph = createEmptyDependencyGraph()
      const result = updateGraphOnSlideChange(graph, 's7', ['s3', 's7', 's5'])

      expect(getReferences(result, 's7')).toEqual(['s3', 's5'])
      expect(getReferences(result, 's7')).not.toContain('s7')
    })

    it('filters out empty strings from new references', () => {
      const graph = createEmptyDependencyGraph()
      const result = updateGraphOnSlideChange(graph, 's7', ['s3', '', 's5'])

      expect(getReferences(result, 's7')).toEqual(['s3', 's5'])
    })

    it('returns original graph for empty slide ID', () => {
      const graph = createEmptyDependencyGraph()
      const result = updateGraphOnSlideChange(graph, '', ['s3', 's5'])
      expect(result).toBe(graph)
    })

    it('does not add duplicates when reference already exists', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')

      // Update with the same reference
      const result = updateGraphOnSlideChange(graph, 's7', ['s3', 's5'])

      expect(getReferences(result, 's7')).toEqual(['s3', 's5'])
      expect(getDependents(result, 's3')).toEqual(['s7']) // Only one entry
    })
  })

  // ============================================================================
  // removeSlideFromGraph Tests
  // ============================================================================

  describe('removeSlideFromGraph', () => {
    it('removes slide from all dependencies and references', () => {
      let graph = createEmptyDependencyGraph()
      // s7 and s12 depend on s3
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's3')
      // s7 also references s5
      graph = addDependency(graph, 's7', 's5')

      // Remove s7 from the graph
      const result = removeSlideFromGraph(graph, 's7')

      expect(getDependents(result, 's3')).toEqual(['s12']) // s7 removed
      expect(getDependents(result, 's5')).toEqual([]) // s7 was only dependent
      expect(getReferences(result, 's7')).toEqual([]) // s7 entry removed
    })

    it('removes slide that others depend on', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's3')

      // Remove s3 (the slide others depend on)
      const result = removeSlideFromGraph(graph, 's3')

      expect(result.dependencies['s3']).toBeUndefined()
      expect(getReferences(result, 's7')).toEqual([]) // s3 removed from references
      expect(getReferences(result, 's12')).toEqual([]) // s3 removed from references
    })

    it('handles removing non-existent slide gracefully', () => {
      const graph = createEmptyDependencyGraph()
      const result = removeSlideFromGraph(graph, 's99')
      expect(result.dependencies).toEqual({})
      expect(result.references).toEqual({})
    })

    it('returns original graph for empty slide ID', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      const result = removeSlideFromGraph(graph, '')
      expect(getDependents(result, 's3')).toEqual(['s7'])
    })
  })

  // ============================================================================
  // getTransitiveDependents Tests
  // ============================================================================

  describe('getTransitiveDependents', () => {
    it('finds all slides in dependency chain', () => {
      let graph = createEmptyDependencyGraph()
      // Chain: s3 <- s7 <- s12 (s7 depends on s3, s12 depends on s7)
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's7')

      const affected = getTransitiveDependents(graph, 's3')
      expect(affected).toContain('s7')
      expect(affected).toContain('s12')
    })

    it('handles diamond dependencies', () => {
      let graph = createEmptyDependencyGraph()
      // Diamond: s1 <- s2, s1 <- s3, s2 <- s4, s3 <- s4
      graph = addDependency(graph, 's2', 's1')
      graph = addDependency(graph, 's3', 's1')
      graph = addDependency(graph, 's4', 's2')
      graph = addDependency(graph, 's4', 's3')

      const affected = getTransitiveDependents(graph, 's1')
      expect(affected).toContain('s2')
      expect(affected).toContain('s3')
      expect(affected).toContain('s4')
      // Each slide should only appear once
      expect(affected.filter((s) => s === 's4')).toHaveLength(1)
    })

    it('respects maxDepth parameter', () => {
      let graph = createEmptyDependencyGraph()
      // Long chain: s1 <- s2 <- s3 <- s4 <- s5
      graph = addDependency(graph, 's2', 's1')
      graph = addDependency(graph, 's3', 's2')
      graph = addDependency(graph, 's4', 's3')
      graph = addDependency(graph, 's5', 's4')

      // maxDepth=1 means only direct dependents (1 hop)
      const affected = getTransitiveDependents(graph, 's1', 1)
      expect(affected).toContain('s2')
      expect(affected).not.toContain('s3') // Exceeds maxDepth
      expect(affected).not.toContain('s4')
      expect(affected).not.toContain('s5')
    })

    it('returns empty array for slide with no dependents', () => {
      const graph = createEmptyDependencyGraph()
      expect(getTransitiveDependents(graph, 's99')).toEqual([])
    })

    it('handles circular dependencies without infinite loop', () => {
      let graph: DependencyGraph = {
        dependencies: {
          's1': ['s2'],
          's2': ['s1'], // Circular
        },
        references: {
          's2': ['s1'],
          's1': ['s2'],
        },
      }

      // Should not throw or hang
      const affected = getTransitiveDependents(graph, 's1')
      expect(affected).toContain('s2')
      expect(affected).toHaveLength(1) // s2 only, s1 is the start
    })
  })

  // ============================================================================
  // validateGraph Tests
  // ============================================================================

  describe('validateGraph', () => {
    it('returns valid for consistent graph', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's3')

      const result = validateGraph(graph)
      expect(result.isValid).toBe(true)
      expect(result.issues).toEqual([])
    })

    it('detects missing reference entry', () => {
      const graph: DependencyGraph = {
        dependencies: { 's3': ['s7'] },
        references: {}, // Missing s7's reference to s3
      }

      const result = validateGraph(graph)
      expect(result.isValid).toBe(false)
      expect(result.issues[0]).toContain('s3 not in s7')
    })

    it('detects missing dependency entry', () => {
      const graph: DependencyGraph = {
        dependencies: {}, // Missing s3's dependent s7
        references: { 's7': ['s3'] },
      }

      const result = validateGraph(graph)
      expect(result.isValid).toBe(false)
      expect(result.issues[0]).toContain('s7 not in s3')
    })

    it('detects self-references in dependencies', () => {
      const graph: DependencyGraph = {
        dependencies: { 's3': ['s3'] },
        references: { 's3': ['s3'] },
      }

      const result = validateGraph(graph)
      expect(result.isValid).toBe(false)
      expect(result.issues.some((i) => i.includes('Self-reference'))).toBe(true)
    })

    it('returns valid for empty graph', () => {
      const graph = createEmptyDependencyGraph()
      const result = validateGraph(graph)
      expect(result.isValid).toBe(true)
    })
  })

  // ============================================================================
  // getGraphStats Tests
  // ============================================================================

  describe('getGraphStats', () => {
    it('returns correct stats for populated graph', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's3')
      graph = addDependency(graph, 's7', 's5')

      const stats = getGraphStats(graph)
      expect(stats.totalSlides).toBe(4) // s3, s5, s7, s12
      expect(stats.totalEdges).toBe(3)
      expect(stats.slidesWithDependents).toBe(2) // s3, s5
      expect(stats.slidesWithReferences).toBe(2) // s7, s12
      expect(stats.maxDependents).toBe(2) // s3 has 2 dependents
      expect(stats.maxReferences).toBe(2) // s7 has 2 references
    })

    it('returns zeros for empty graph', () => {
      const graph = createEmptyDependencyGraph()
      const stats = getGraphStats(graph)

      expect(stats.totalSlides).toBe(0)
      expect(stats.totalEdges).toBe(0)
      expect(stats.slidesWithDependents).toBe(0)
      expect(stats.slidesWithReferences).toBe(0)
      expect(stats.maxDependents).toBe(0)
      expect(stats.maxReferences).toBe(0)
    })
  })

  // ============================================================================
  // Integration / Scenario Tests
  // ============================================================================

  describe('integration scenarios', () => {
    it('scenario: Build CIM with dependencies', () => {
      let graph = createEmptyDependencyGraph()

      // Slide 3 contains base revenue data
      // Slide 7 references slide 3 for revenue comparison
      graph = addDependency(graph, 's7', 's3')

      // Slide 12 shows revenue growth chart based on slide 3
      graph = addDependency(graph, 's12', 's3')

      // Slide 15 references both slide 7 and slide 12
      graph = addDependency(graph, 's15', 's7')
      graph = addDependency(graph, 's15', 's12')

      // Check graph consistency
      const validation = validateGraph(graph)
      expect(validation.isValid).toBe(true)

      // If we change slide 3, what's affected?
      const affected = getTransitiveDependents(graph, 's3')
      expect(affected).toContain('s7')
      expect(affected).toContain('s12')
      expect(affected).toContain('s15')
    })

    it('scenario: Edit slide and update references', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's7', 's5')

      // User edits s7, now references s4 instead of s5
      graph = updateGraphOnSlideChange(graph, 's7', ['s3', 's4'])

      expect(getReferences(graph, 's7')).toEqual(['s3', 's4'])
      expect(getDependents(graph, 's3')).toContain('s7')
      expect(getDependents(graph, 's4')).toContain('s7')
      expect(getDependents(graph, 's5')).toEqual([])
    })

    it('scenario: Delete slide with dependents', () => {
      let graph = createEmptyDependencyGraph()
      graph = addDependency(graph, 's7', 's3')
      graph = addDependency(graph, 's12', 's3')

      // Delete slide 3 (the referenced slide)
      graph = removeSlideFromGraph(graph, 's3')

      // s7 and s12 no longer have s3 in their references
      expect(getReferences(graph, 's7')).toEqual([])
      expect(getReferences(graph, 's12')).toEqual([])

      // Graph should be valid (no dangling references)
      expect(validateGraph(graph).isValid).toBe(true)
    })
  })
})
