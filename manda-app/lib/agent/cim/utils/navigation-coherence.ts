/**
 * Navigation Coherence Utilities
 *
 * Utilities for checking coherence when navigating between CIM sections.
 * Story: E9.13 - Non-Linear Navigation with Context
 *
 * Key concepts:
 * - When jumping to a section, check if its dependencies are complete
 * - Generate warnings for incomplete dependencies
 * - Provide context about what's missing
 */

import type {
  OutlineSection,
  Slide,
  DependencyGraph,
  NavigationWarning,
} from '@/lib/types/cim'
import { getDependents, getReferences } from './dependency-graph'

/**
 * Check if a section has incomplete dependencies
 *
 * A section has incomplete dependencies if:
 * - Any slide it references (via dependency graph) belongs to an incomplete section
 * - Any slide it references has content that hasn't been finalized
 *
 * @param targetSectionId - Section being navigated to
 * @param outline - Current outline sections
 * @param slides - All slides in the CIM
 * @param dependencyGraph - The dependency graph
 * @returns Array of warnings about incomplete dependencies
 */
export function checkNavigationCoherence(
  targetSectionId: string,
  outline: OutlineSection[],
  slides: Slide[],
  dependencyGraph: DependencyGraph
): NavigationWarning[] {
  const warnings: NavigationWarning[] = []

  // Find target section
  const targetSection = outline.find((s) => s.id === targetSectionId)
  if (!targetSection) {
    return warnings
  }

  // Get all slides in the target section
  const targetSlides = slides.filter((s) => s.section_id === targetSectionId)

  // Check each slide in target section for references to incomplete sections
  for (const slide of targetSlides) {
    const references = getReferences(dependencyGraph, slide.id)

    for (const refSlideId of references) {
      const refSlide = slides.find((s) => s.id === refSlideId)
      if (!refSlide) continue

      // Find the section containing the referenced slide
      const refSection = outline.find((s) => s.id === refSlide.section_id)
      if (!refSection) continue

      // Check if referenced section is incomplete
      if (refSection.status === 'pending' || refSection.status === 'in_progress') {
        const existingWarning = warnings.find(
          (w) => w.sourceId === targetSectionId && w.incompleteDependencies.includes(refSection.id)
        )

        if (!existingWarning) {
          warnings.push({
            type: 'incomplete_dependency',
            sourceId: targetSectionId,
            message: `Section "${targetSection.title}" references content from "${refSection.title}" which is ${refSection.status === 'pending' ? 'not started' : 'still in progress'}.`,
            incompleteDependencies: [refSection.id],
            severity: refSection.status === 'pending' ? 'warning' : 'info',
          })
        } else {
          // Add to existing warning's incomplete dependencies
          if (!existingWarning.incompleteDependencies.includes(refSection.id)) {
            existingWarning.incompleteDependencies.push(refSection.id)
          }
        }
      }

      // Check if referenced slide is a draft
      if (refSlide.status === 'draft') {
        const slideSection = outline.find((s) => s.id === refSlide.section_id)
        warnings.push({
          type: 'stale_reference',
          sourceId: slide.id,
          message: `Slide "${slide.title}" references "${refSlide.title}" which is still a draft${slideSection ? ` in "${slideSection.title}"` : ''}.`,
          incompleteDependencies: [refSlideId],
          severity: 'info',
        })
      }
    }
  }

  return warnings
}

/**
 * Get a context summary for a section being navigated to
 *
 * This provides the agent with context about:
 * - What the section is about
 * - What dependencies it has
 * - What's been done vs what's pending
 *
 * @param sectionId - Section being navigated to
 * @param outline - Current outline sections
 * @param slides - All slides in the CIM
 * @param dependencyGraph - The dependency graph
 * @returns Context summary string for the agent
 */
export function getNavigationContextSummary(
  sectionId: string,
  outline: OutlineSection[],
  slides: Slide[],
  dependencyGraph: DependencyGraph
): string {
  const section = outline.find((s) => s.id === sectionId)
  if (!section) {
    return 'Section not found.'
  }

  const sectionSlides = slides.filter((s) => s.section_id === sectionId)
  const completedSlides = sectionSlides.filter((s) => s.status === 'approved' || s.status === 'locked')
  const draftSlides = sectionSlides.filter((s) => s.status === 'draft')

  // Find sections that this section depends on (via slide references)
  const dependsOnSections = new Set<string>()
  for (const slide of sectionSlides) {
    const refs = getReferences(dependencyGraph, slide.id)
    for (const refId of refs) {
      const refSlide = slides.find((s) => s.id === refId)
      if (refSlide && refSlide.section_id !== sectionId) {
        const refSection = outline.find((s) => s.id === refSlide.section_id)
        if (refSection) {
          dependsOnSections.add(refSection.title)
        }
      }
    }
  }

  // Find sections that depend on this section
  const dependentSections = new Set<string>()
  for (const slide of sectionSlides) {
    const dependents = getDependents(dependencyGraph, slide.id)
    for (const depId of dependents) {
      const depSlide = slides.find((s) => s.id === depId)
      if (depSlide && depSlide.section_id !== sectionId) {
        const depSection = outline.find((s) => s.id === depSlide.section_id)
        if (depSection) {
          dependentSections.add(depSection.title)
        }
      }
    }
  }

  // Build summary
  const lines: string[] = []
  lines.push(`**${section.title}**`)
  lines.push(`Status: ${section.status}`)
  lines.push(`Slides: ${completedSlides.length} completed, ${draftSlides.length} draft`)

  if (section.description) {
    lines.push(`Description: ${section.description}`)
  }

  if (dependsOnSections.size > 0) {
    lines.push(`References content from: ${Array.from(dependsOnSections).join(', ')}`)
  }

  if (dependentSections.size > 0) {
    lines.push(`Content referenced by: ${Array.from(dependentSections).join(', ')}`)
  }

  return lines.join('\n')
}

/**
 * Determine if navigation should require confirmation
 *
 * @param warnings - Array of navigation warnings
 * @returns True if any warning has severity 'warning' or 'error'
 */
export function shouldRequireConfirmation(warnings: NavigationWarning[]): boolean {
  return warnings.some((w) => w.severity === 'warning' || w.severity === 'error')
}

/**
 * Format navigation warnings for display
 *
 * @param warnings - Array of navigation warnings
 * @returns Formatted string for UI display
 */
export function formatNavigationWarnings(warnings: NavigationWarning[]): string {
  if (warnings.length === 0) {
    return ''
  }

  const lines: string[] = []

  const errors = warnings.filter((w) => w.severity === 'error')
  const warns = warnings.filter((w) => w.severity === 'warning')
  const infos = warnings.filter((w) => w.severity === 'info')

  if (errors.length > 0) {
    lines.push('**Critical Issues:**')
    errors.forEach((w) => lines.push(`- ${w.message}`))
  }

  if (warns.length > 0) {
    lines.push('**Warnings:**')
    warns.forEach((w) => lines.push(`- ${w.message}`))
  }

  if (infos.length > 0) {
    lines.push('**Notes:**')
    infos.forEach((w) => lines.push(`- ${w.message}`))
  }

  return lines.join('\n')
}

/**
 * Get recommended next section based on dependencies
 *
 * Suggests which section to work on next by finding sections with:
 * - All dependencies complete
 * - Status is 'pending' or 'in_progress'
 *
 * @param outline - Current outline sections
 * @param slides - All slides in the CIM
 * @param dependencyGraph - The dependency graph
 * @returns Recommended section ID or null if all complete
 */
export function getRecommendedNextSection(
  outline: OutlineSection[],
  slides: Slide[],
  dependencyGraph: DependencyGraph
): string | null {
  // Sort by order to prefer earlier sections
  const sortedOutline = [...outline].sort((a, b) => a.order - b.order)

  for (const section of sortedOutline) {
    // Skip complete sections
    if (section.status === 'complete') continue

    // Check if all dependencies are complete
    const warnings = checkNavigationCoherence(section.id, outline, slides, dependencyGraph)
    const hasBlockingWarnings = warnings.some(
      (w) => w.severity === 'warning' || w.severity === 'error'
    )

    if (!hasBlockingWarnings) {
      return section.id
    }
  }

  // All sections either complete or have dependencies
  // Return first incomplete section
  const firstIncomplete = sortedOutline.find((s) => s.status !== 'complete')
  return firstIncomplete?.id ?? null
}

/**
 * Check if jumping ahead is safe
 *
 * @param fromIndex - Current section index in outline
 * @param toIndex - Target section index
 * @param outline - Current outline sections
 * @param slides - All slides in the CIM
 * @param dependencyGraph - The dependency graph
 * @returns Object with isSafe boolean and warnings
 */
export function checkJumpSafety(
  fromIndex: number | null,
  toIndex: number,
  outline: OutlineSection[],
  slides: Slide[],
  dependencyGraph: DependencyGraph
): { isSafe: boolean; warnings: NavigationWarning[] } {
  if (fromIndex === null) {
    return { isSafe: true, warnings: [] }
  }

  // Jumping backwards is always safe
  if (toIndex <= fromIndex) {
    return { isSafe: true, warnings: [] }
  }

  // Check target section
  const targetSection = outline[toIndex]
  if (!targetSection) {
    return { isSafe: false, warnings: [] }
  }

  const warnings = checkNavigationCoherence(targetSection.id, outline, slides, dependencyGraph)

  // Also check if we're skipping incomplete sections
  for (let i = fromIndex + 1; i < toIndex; i++) {
    const skippedSection = outline[i]
    if (skippedSection && skippedSection.status !== 'complete') {
      warnings.push({
        type: 'missing_content',
        sourceId: skippedSection.id,
        message: `Skipping over "${skippedSection.title}" which is ${skippedSection.status === 'pending' ? 'not started' : 'still in progress'}.`,
        incompleteDependencies: [skippedSection.id],
        severity: 'info',
      })
    }
  }

  const isSafe = !shouldRequireConfirmation(warnings)
  return { isSafe, warnings }
}
