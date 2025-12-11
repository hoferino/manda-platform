/**
 * Dependency Graph Utilities
 *
 * Utilities for managing slide dependency relationships in CIM documents.
 * Story: E9.11 - Dependency Tracking & Consistency Alerts
 *
 * The dependency graph tracks:
 * - `dependencies`: slide_id → array of slide_ids that DEPEND ON this slide
 *   (if I change slide 3, these slides are affected)
 * - `references`: slide_id → array of slide_ids this slide REFERENCES
 *   (slide 7 references data from slides 3 and 5)
 *
 * Example:
 * Slide 3 contains "Revenue: $10M"
 * Slide 7 says "Building on our $10M revenue (slide 3)..."
 * Slide 12 shows "Revenue growth trend" chart using slide 3 data
 *
 * dependency_graph = {
 *   dependencies: { "s3": ["s7", "s12"] },
 *   references: { "s7": ["s3"], "s12": ["s3"] }
 * }
 */

import type { DependencyGraph } from '@/lib/types/cim'

/**
 * Create an empty dependency graph
 */
export function createEmptyDependencyGraph(): DependencyGraph {
  return {
    dependencies: {},
    references: {},
  }
}

/**
 * Add a dependency edge from one slide to another
 *
 * When slide A references slide B:
 * - B's dependencies list includes A (A depends on B)
 * - A's references list includes B (A references B)
 *
 * @param graph - The dependency graph to modify (returns new copy)
 * @param fromSlideId - The slide that references another slide
 * @param toSlideId - The slide being referenced
 * @returns New dependency graph with the edge added
 */
export function addDependency(
  graph: DependencyGraph,
  fromSlideId: string,
  toSlideId: string
): DependencyGraph {
  // Validate inputs
  if (!fromSlideId || !toSlideId) {
    return graph
  }

  // Prevent self-references
  if (fromSlideId === toSlideId) {
    return graph
  }

  // Clone the graph
  const newGraph: DependencyGraph = {
    dependencies: { ...graph.dependencies },
    references: { ...graph.references },
  }

  // Add to dependencies: toSlideId's dependents includes fromSlideId
  const currentDependents = newGraph.dependencies[toSlideId] || []
  if (!currentDependents.includes(fromSlideId)) {
    newGraph.dependencies[toSlideId] = [...currentDependents, fromSlideId]
  }

  // Add to references: fromSlideId's references includes toSlideId
  const currentReferences = newGraph.references[fromSlideId] || []
  if (!currentReferences.includes(toSlideId)) {
    newGraph.references[fromSlideId] = [...currentReferences, toSlideId]
  }

  return newGraph
}

/**
 * Remove a dependency edge between two slides
 *
 * @param graph - The dependency graph to modify (returns new copy)
 * @param fromSlideId - The slide that referenced another slide
 * @param toSlideId - The slide that was referenced
 * @returns New dependency graph with the edge removed
 */
export function removeDependency(
  graph: DependencyGraph,
  fromSlideId: string,
  toSlideId: string
): DependencyGraph {
  // Validate inputs
  if (!fromSlideId || !toSlideId) {
    return graph
  }

  // Clone the graph
  const newGraph: DependencyGraph = {
    dependencies: { ...graph.dependencies },
    references: { ...graph.references },
  }

  // Remove from dependencies: toSlideId's dependents no longer includes fromSlideId
  const currentDependents = newGraph.dependencies[toSlideId]
  if (currentDependents) {
    const filtered = currentDependents.filter((id) => id !== fromSlideId)
    if (filtered.length === 0) {
      delete newGraph.dependencies[toSlideId]
    } else {
      newGraph.dependencies[toSlideId] = filtered
    }
  }

  // Remove from references: fromSlideId's references no longer includes toSlideId
  const currentReferences = newGraph.references[fromSlideId]
  if (currentReferences) {
    const filtered = currentReferences.filter((id) => id !== toSlideId)
    if (filtered.length === 0) {
      delete newGraph.references[fromSlideId]
    } else {
      newGraph.references[fromSlideId] = filtered
    }
  }

  return newGraph
}

/**
 * Get all slides that depend on a given slide
 *
 * Returns the list of slides that would be affected if the given slide changes.
 * These are the slides that reference content from the given slide.
 *
 * @param graph - The dependency graph
 * @param slideId - The slide ID to get dependents for
 * @returns Array of slide IDs that depend on this slide
 */
export function getDependents(graph: DependencyGraph, slideId: string): string[] {
  if (!slideId || !graph.dependencies) {
    return []
  }
  return graph.dependencies[slideId] || []
}

/**
 * Get all slides that a given slide references
 *
 * Returns the list of slides whose content is referenced by the given slide.
 * If any of these upstream slides change, this slide may need updating.
 *
 * @param graph - The dependency graph
 * @param slideId - The slide ID to get references for
 * @returns Array of slide IDs that this slide references
 */
export function getReferences(graph: DependencyGraph, slideId: string): string[] {
  if (!slideId || !graph.references) {
    return []
  }
  return graph.references[slideId] || []
}

/**
 * Check if a slide has any dependents
 *
 * @param graph - The dependency graph
 * @param slideId - The slide ID to check
 * @returns True if other slides depend on this slide
 */
export function hasDependents(graph: DependencyGraph, slideId: string): boolean {
  return getDependents(graph, slideId).length > 0
}

/**
 * Check if a slide has any references
 *
 * @param graph - The dependency graph
 * @param slideId - The slide ID to check
 * @returns True if this slide references other slides
 */
export function hasReferences(graph: DependencyGraph, slideId: string): boolean {
  return getReferences(graph, slideId).length > 0
}

/**
 * Update the graph when a slide's references change
 *
 * This is the main function used when a slide's content is edited and
 * the set of slides it references may have changed.
 *
 * @param graph - The current dependency graph
 * @param slideId - The slide that was edited
 * @param newReferences - The new set of slide IDs this slide now references
 * @returns New dependency graph with updated edges
 */
export function updateGraphOnSlideChange(
  graph: DependencyGraph,
  slideId: string,
  newReferences: string[]
): DependencyGraph {
  // Validate inputs
  if (!slideId) {
    return graph
  }

  // Filter out self-references and invalid values
  const validNewRefs = newReferences.filter(
    (ref) => ref && ref !== slideId
  )

  // Get current references for this slide
  const currentRefs = getReferences(graph, slideId)

  // Find references to remove (in current but not in new)
  const refsToRemove = currentRefs.filter((ref) => !validNewRefs.includes(ref))

  // Find references to add (in new but not in current)
  const refsToAdd = validNewRefs.filter((ref) => !currentRefs.includes(ref))

  // Apply changes
  let newGraph = graph

  // Remove old references
  for (const ref of refsToRemove) {
    newGraph = removeDependency(newGraph, slideId, ref)
  }

  // Add new references
  for (const ref of refsToAdd) {
    newGraph = addDependency(newGraph, slideId, ref)
  }

  return newGraph
}

/**
 * Remove all dependencies for a slide (when slide is deleted)
 *
 * Removes the slide from both:
 * - Any slide's dependencies list (if other slides depend on it)
 * - Any slide's references list (if it references other slides)
 *
 * @param graph - The dependency graph
 * @param slideId - The slide ID to remove
 * @returns New dependency graph with slide removed
 */
export function removeSlideFromGraph(
  graph: DependencyGraph,
  slideId: string
): DependencyGraph {
  if (!slideId) {
    return graph
  }

  // Clone the graph
  const newGraph: DependencyGraph = {
    dependencies: { ...graph.dependencies },
    references: { ...graph.references },
  }

  // Remove from dependencies: remove slideId from all dependents lists
  for (const [key, dependents] of Object.entries(newGraph.dependencies)) {
    if (dependents.includes(slideId)) {
      const filtered = dependents.filter((id) => id !== slideId)
      if (filtered.length === 0) {
        delete newGraph.dependencies[key]
      } else {
        newGraph.dependencies[key] = filtered
      }
    }
  }

  // Remove from references: remove slideId from all references lists
  for (const [key, refs] of Object.entries(newGraph.references)) {
    if (refs.includes(slideId)) {
      const filtered = refs.filter((id) => id !== slideId)
      if (filtered.length === 0) {
        delete newGraph.references[key]
      } else {
        newGraph.references[key] = filtered
      }
    }
  }

  // Remove the slide's own entries
  delete newGraph.dependencies[slideId]
  delete newGraph.references[slideId]

  return newGraph
}

/**
 * Get all slides that would be affected by a change to the given slide
 * (transitive closure - follows the dependency chain)
 *
 * For example, if S3 → S7 → S12 (S7 depends on S3, S12 depends on S7),
 * changing S3 affects both S7 and S12.
 *
 * @param graph - The dependency graph
 * @param slideId - The slide ID that changed
 * @param maxDepth - Maximum depth to traverse (default 10, prevents infinite loops)
 * @returns Array of all affected slide IDs (transitive dependents)
 */
export function getTransitiveDependents(
  graph: DependencyGraph,
  slideId: string,
  maxDepth: number = 10
): string[] {
  if (!slideId || maxDepth <= 0) {
    return []
  }

  const visited = new Set<string>()
  const result: string[] = []

  function traverse(currentId: string, depth: number): void {
    if (visited.has(currentId)) {
      return
    }
    visited.add(currentId)

    // Only explore if we haven't exceeded depth limit
    if (depth >= maxDepth) {
      return
    }

    const dependents = getDependents(graph, currentId)
    for (const dependent of dependents) {
      if (!visited.has(dependent)) {
        result.push(dependent)
        traverse(dependent, depth + 1)
      }
    }
  }

  traverse(slideId, 0)
  return result
}

/**
 * Validate the consistency of a dependency graph
 *
 * Checks that:
 * - Every entry in dependencies has a corresponding entry in references
 * - No self-references exist
 *
 * @param graph - The dependency graph to validate
 * @returns Object with isValid boolean and array of issues
 */
export function validateGraph(graph: DependencyGraph): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check dependencies → references consistency
  for (const [slideId, dependents] of Object.entries(graph.dependencies || {})) {
    for (const dependent of dependents) {
      const refs = graph.references?.[dependent] || []
      if (!refs.includes(slideId)) {
        issues.push(
          `Inconsistency: ${dependent} listed as dependent of ${slideId}, but ${slideId} not in ${dependent}'s references`
        )
      }
    }
  }

  // Check references → dependencies consistency
  for (const [slideId, refs] of Object.entries(graph.references || {})) {
    for (const ref of refs) {
      const dependents = graph.dependencies?.[ref] || []
      if (!dependents.includes(slideId)) {
        issues.push(
          `Inconsistency: ${slideId} references ${ref}, but ${slideId} not in ${ref}'s dependents`
        )
      }
    }
  }

  // Check for self-references
  for (const [slideId, dependents] of Object.entries(graph.dependencies || {})) {
    if (dependents.includes(slideId)) {
      issues.push(`Self-reference: ${slideId} depends on itself`)
    }
  }

  for (const [slideId, refs] of Object.entries(graph.references || {})) {
    if (refs.includes(slideId)) {
      issues.push(`Self-reference: ${slideId} references itself`)
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
  }
}

/**
 * Get graph statistics for debugging/monitoring
 */
export function getGraphStats(graph: DependencyGraph): {
  totalSlides: number
  totalEdges: number
  slidesWithDependents: number
  slidesWithReferences: number
  maxDependents: number
  maxReferences: number
} {
  const slidesInDependencies = new Set(Object.keys(graph.dependencies || {}))
  const slidesInReferences = new Set(Object.keys(graph.references || {}))

  // All slides mentioned (both as keys and values)
  const allSlides = new Set<string>()
  for (const [key, values] of Object.entries(graph.dependencies || {})) {
    allSlides.add(key)
    values.forEach((v) => allSlides.add(v))
  }
  for (const [key, values] of Object.entries(graph.references || {})) {
    allSlides.add(key)
    values.forEach((v) => allSlides.add(v))
  }

  // Count total edges (each dependency = one edge)
  let totalEdges = 0
  for (const dependents of Object.values(graph.dependencies || {})) {
    totalEdges += dependents.length
  }

  // Calculate max dependents and references
  const dependentCounts = Object.values(graph.dependencies || {}).map((d) => d.length)
  const referenceCounts = Object.values(graph.references || {}).map((r) => r.length)

  return {
    totalSlides: allSlides.size,
    totalEdges,
    slidesWithDependents: slidesInDependencies.size,
    slidesWithReferences: slidesInReferences.size,
    maxDependents: Math.max(0, ...dependentCounts),
    maxReferences: Math.max(0, ...referenceCounts),
  }
}
