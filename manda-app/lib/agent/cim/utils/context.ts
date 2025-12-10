/**
 * Context Flow Utilities for CIM Builder
 *
 * Provides utilities for building contextual references
 * to buyer persona, investment thesis, and prior slides
 * for the content creation phase.
 *
 * Story: E9.7 - Slide Content Creation (RAG-powered)
 * AC #7: Forward Context Flow
 */

import { BuyerPersona, Slide, OutlineSection, SlideComponent } from '@/lib/types/cim'

// ============================================================================
// Types
// ============================================================================

export interface PriorSlideContext {
  sectionTitle: string
  slideTitle: string
  keyPoints: string[]
  slideIndex: number
}

export interface ContentCreationContext {
  buyerPersonaContext: string | null
  thesisContext: string | null
  priorSlidesContext: PriorSlideContext[]
  currentSectionIndex: number
  totalSections: number
}

// ============================================================================
// Buyer Persona Context
// ============================================================================

/**
 * Format buyer persona for prompt injection
 * Creates a concise summary of the target buyer for content guidance
 */
export function formatBuyerPersonaContext(persona: BuyerPersona | null): string | null {
  if (!persona) {
    return null
  }

  const buyerTypeLabels: Record<string, string> = {
    strategic: 'strategic acquirer',
    financial: 'financial sponsor (PE/family office)',
    management: 'management team (MBO/MBI)',
    other: 'buyer',
  }

  const buyerTypeLabel = buyerTypeLabels[persona.buyer_type] || persona.buyer_type

  let context = `**Target Buyer:** ${buyerTypeLabel}`

  if (persona.buyer_description) {
    context += `\n**Description:** ${persona.buyer_description}`
  }

  if (persona.priorities && persona.priorities.length > 0) {
    context += `\n**Key Priorities:** ${persona.priorities.join(', ')}`
  }

  if (persona.concerns && persona.concerns.length > 0) {
    context += `\n**Concerns to Address:** ${persona.concerns.join(', ')}`
  }

  if (persona.key_metrics && persona.key_metrics.length > 0) {
    context += `\n**Focus Metrics:** ${persona.key_metrics.join(', ')}`
  }

  return context
}

/**
 * Get a brief buyer persona reference for inline use
 */
export function getBuyerPersonaBrief(persona: BuyerPersona | null): string {
  if (!persona) {
    return 'your target buyer'
  }

  const buyerTypeLabels: Record<string, string> = {
    strategic: 'strategic acquirer',
    financial: 'financial sponsor',
    management: 'management team',
    other: 'buyer',
  }

  const typeLabel = buyerTypeLabels[persona.buyer_type] || persona.buyer_type

  if (persona.priorities && persona.priorities.length > 0) {
    return `${typeLabel} focused on ${persona.priorities.slice(0, 2).join(' and ')}`
  }

  return typeLabel
}

// ============================================================================
// Investment Thesis Context
// ============================================================================

/**
 * Format investment thesis for prompt injection
 */
export function formatThesisContext(thesis: string | null): string | null {
  if (!thesis || thesis.trim().length === 0) {
    return null
  }

  return `**Investment Thesis:** "${thesis}"`
}

/**
 * Get a brief thesis reference for inline use
 */
export function getThesisBrief(thesis: string | null): string {
  if (!thesis || thesis.trim().length === 0) {
    return 'the investment opportunity'
  }

  // Return first sentence or first 100 chars
  const firstSentence = thesis.split(/[.!?]/)[0]
  if (firstSentence && firstSentence.length < 100) {
    return firstSentence.trim()
  }

  return thesis.slice(0, 100).trim() + '...'
}

// ============================================================================
// Prior Slides Context
// ============================================================================

/**
 * Extract key points from slide components
 */
function extractKeyPointsFromSlide(slide: Slide): string[] {
  const keyPoints: string[] = []

  for (const component of slide.components) {
    switch (component.type) {
      case 'title':
        // Title is captured separately
        break

      case 'bullet':
        // Extract bullet points (typically one per line)
        const bullets = component.content.split('\n').filter(line => line.trim())
        keyPoints.push(...bullets.slice(0, 3).map(b => b.replace(/^[-•*]\s*/, '').trim()))
        break

      case 'text':
        // Extract first sentence of text content
        const firstSentence = component.content.split(/[.!?]/)[0]
        if (firstSentence && firstSentence.trim().length > 10) {
          keyPoints.push(firstSentence.trim())
        }
        break

      default:
        // For other types, just note the content exists
        if (component.content && component.content.length > 20) {
          keyPoints.push(component.content.slice(0, 50) + '...')
        }
    }
  }

  return keyPoints.slice(0, 5) // Max 5 key points per slide
}

/**
 * Summarize prior slides for context
 * Returns the last N slides' content in summarized form
 */
export function summarizePriorSlides(
  slides: Slide[],
  outline: OutlineSection[],
  currentSectionId: string,
  maxSlides: number = 3
): PriorSlideContext[] {
  // Find the index of the current section
  const currentSectionIndex = outline.findIndex(s => s.id === currentSectionId)
  if (currentSectionIndex <= 0) {
    return [] // First section or not found, no prior context
  }

  // Get slides from prior sections
  const priorSections = outline.slice(0, currentSectionIndex)
  const priorSlides: PriorSlideContext[] = []

  for (const section of priorSections) {
    const sectionSlides = slides.filter(s => s.section_id === section.id)
    for (const slide of sectionSlides) {
      if (slide.status === 'approved' || slide.status === 'draft') {
        priorSlides.push({
          sectionTitle: section.title,
          slideTitle: slide.title,
          keyPoints: extractKeyPointsFromSlide(slide),
          slideIndex: priorSlides.length,
        })
      }
    }
  }

  // Return the most recent N slides
  return priorSlides.slice(-maxSlides)
}

/**
 * Format prior slides context for prompt injection
 */
export function formatPriorSlidesContext(priorSlides: PriorSlideContext[]): string | null {
  if (priorSlides.length === 0) {
    return null
  }

  let context = '**Prior Slides Context:**\n'

  for (const slide of priorSlides) {
    context += `\n- **${slide.sectionTitle}: ${slide.slideTitle}**`
    if (slide.keyPoints.length > 0) {
      context += '\n  Key points: ' + slide.keyPoints.slice(0, 3).join('; ')
    }
  }

  return context
}

// ============================================================================
// Full Context Building
// ============================================================================

/**
 * Build complete content creation context
 * Combines buyer persona, thesis, and prior slides
 */
export function buildContentCreationContext(
  buyerPersona: BuyerPersona | null,
  investmentThesis: string | null,
  slides: Slide[],
  outline: OutlineSection[],
  currentSectionId: string
): ContentCreationContext {
  const currentSectionIndex = outline.findIndex(s => s.id === currentSectionId)
  const priorSlides = summarizePriorSlides(slides, outline, currentSectionId)

  return {
    buyerPersonaContext: formatBuyerPersonaContext(buyerPersona),
    thesisContext: formatThesisContext(investmentThesis),
    priorSlidesContext: priorSlides,
    currentSectionIndex: currentSectionIndex >= 0 ? currentSectionIndex + 1 : 1,
    totalSections: outline.length,
  }
}

/**
 * Generate an opening message for content creation based on context
 */
export function generateContentOpeningMessage(
  sectionTitle: string,
  sectionDescription: string,
  buyerPersona: BuyerPersona | null,
  investmentThesis: string | null,
  isFirstSection: boolean
): string {
  let opening = `Let's create content for the **${sectionTitle}** section.`

  if (sectionDescription) {
    opening += ` This section ${sectionDescription.toLowerCase()}.`
  }

  if (!isFirstSection) {
    // Reference prior context for non-first sections
    const buyerBrief = getBuyerPersonaBrief(buyerPersona)
    const thesisBrief = getThesisBrief(investmentThesis)

    opening += `\n\nGiven your target ${buyerBrief}`

    if (investmentThesis) {
      opening += `, and building on our thesis about ${thesisBrief}`
    }

    opening += `, I'll search for content that aligns with these priorities.`
  }

  return opening
}

/**
 * Check if content aligns with buyer persona priorities
 * Returns alignment score and suggestions
 */
export function checkContentAlignment(
  content: string,
  buyerPersona: BuyerPersona | null
): { score: number; suggestions: string[] } {
  if (!buyerPersona || !buyerPersona.priorities || buyerPersona.priorities.length === 0) {
    return { score: 1.0, suggestions: [] }
  }

  const contentLower = content.toLowerCase()
  const priorities = buyerPersona.priorities

  let matchedPriorities = 0
  const suggestions: string[] = []

  for (const priority of priorities) {
    const priorityWords = priority.toLowerCase().split(/\s+/)
    const hasMatch = priorityWords.some(word =>
      word.length > 3 && contentLower.includes(word)
    )

    if (hasMatch) {
      matchedPriorities++
    } else {
      suggestions.push(`Consider addressing: ${priority}`)
    }
  }

  const score = matchedPriorities / priorities.length

  return { score, suggestions: suggestions.slice(0, 2) }
}
