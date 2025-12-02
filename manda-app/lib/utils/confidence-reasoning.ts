/**
 * Confidence Reasoning Utilities
 *
 * Generates natural language explanations for confidence scores.
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 * AC: #3 (Badge Tooltip with Reasoning), #6 (Multiple Finding Aggregation), #7 (P2 Compliance)
 *
 * CRITICAL: Per P2 specification, confidence scores must NEVER be shown as raw numbers.
 * This module translates internal scores to user-friendly explanations.
 *
 * Reference: docs/agent-behavior-spec.md P2 - Confidence Factor Mapping Table
 */

import type {
  ConfidenceLevel,
  ConfidenceFactor,
  AggregatedConfidence,
  ConfidenceData,
} from './confidence'
import { getConfidenceLevelFromScore } from './confidence'

/**
 * Natural language labels for confidence levels (P2 compliant - no numbers)
 */
export const CONFIDENCE_LEVEL_LABELS: Record<ConfidenceLevel, string> = {
  high: 'High confidence',
  medium: 'Moderate confidence',
  low: 'Limited confidence',
  unknown: 'Confidence not determined',
}

/**
 * Brief descriptions for each confidence level
 */
export const CONFIDENCE_LEVEL_DESCRIPTIONS: Record<ConfidenceLevel, string> = {
  high: 'Based on authoritative sources with strong supporting evidence',
  medium: 'Based on available data, though some verification may be helpful',
  low: 'Based on limited or dated information - review recommended',
  unknown: 'Unable to determine confidence level',
}

/**
 * Factor type to natural language mapping
 * From agent-behavior-spec.md P2 Confidence Factor table
 */
const FACTOR_TEMPLATES: Record<ConfidenceFactor['type'], (value: string) => string> = {
  source_quality: (value) => {
    const lower = value.toLowerCase()
    if (lower.includes('audit')) return 'from the audited financials'
    if (lower.includes('draft') || lower.includes('internal')) return 'from an internal draft'
    if (lower.includes('management')) return 'from a management presentation'
    if (lower.includes('official') || lower.includes('report')) return 'from official reports'
    return `from ${value}`
  },
  data_recency: (value) => {
    const lower = value.toLowerCase()
    if (lower.includes('month')) return `from a document dating ${value}`
    if (lower.includes('week')) return `from recent data (${value})`
    if (lower.includes('year')) return `from older data (${value})`
    return `dated ${value}`
  },
  source_type: (value) => {
    const lower = value.toLowerCase()
    if (lower.includes('forecast')) return 'this was a forecast'
    if (lower.includes('actual')) return 'from confirmed actuals'
    if (lower.includes('estimate')) return 'based on estimates'
    if (lower.includes('projection')) return 'based on projections'
    return value
  },
  partial_data: (value) => `based on ${value}`,
  superseded: (value) => `this was later corrected in ${value}`,
  number_of_sources: (value) => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      if (num === 1) return 'from a single source'
      if (num >= 3) return `corroborated by ${num} sources`
      return `from ${num} sources`
    }
    return value
  },
}

/**
 * Generate reasoning text for a single confidence data item
 */
function generateItemReasoning(item: ConfidenceData): string[] {
  const reasons: string[] = []

  // Add source document context
  if (item.sourceDocument) {
    const docName = item.sourceDocument
    // Simplify long paths
    const shortName = docName.includes('/')
      ? docName.split('/').pop() || docName
      : docName
    reasons.push(`Source: ${shortName}`)
  }

  // Process factors
  if (item.factors && item.factors.length > 0) {
    for (const factor of item.factors) {
      const template = FACTOR_TEMPLATES[factor.type]
      if (template) {
        reasons.push(template(factor.value))
      }
    }
  }

  return reasons
}

/**
 * Confidence reasoning result
 */
export interface ConfidenceReasoning {
  /** Main confidence label (e.g., "High confidence") */
  label: string
  /** Brief description of what the level means */
  description: string
  /** Detailed contributing factors */
  factors: string[]
  /** Range explanation if multiple sources with variance */
  rangeExplanation?: string
  /** The underlying level */
  level: ConfidenceLevel
}

/**
 * Generate confidence reasoning for display in tooltips
 *
 * Translates internal confidence scores and factors into P2-compliant
 * natural language explanations.
 *
 * @param score - Confidence score (0-1) or null
 * @param factors - Optional array of confidence factors
 * @returns Reasoning object with label, description, and factors
 */
export function generateConfidenceReasoning(
  score: number | null,
  factors?: ConfidenceFactor[]
): ConfidenceReasoning {
  const level = getConfidenceLevelFromScore(score)

  const reasoning: ConfidenceReasoning = {
    label: CONFIDENCE_LEVEL_LABELS[level],
    description: CONFIDENCE_LEVEL_DESCRIPTIONS[level],
    factors: [],
    level,
  }

  // Generate factor explanations
  if (factors && factors.length > 0) {
    for (const factor of factors) {
      const template = FACTOR_TEMPLATES[factor.type]
      if (template) {
        reasoning.factors.push(template(factor.value))
      }
    }
  }

  // Add level-specific context if no factors provided
  if (reasoning.factors.length === 0) {
    switch (level) {
      case 'high':
        reasoning.factors.push('Extracted with strong certainty from source documents')
        break
      case 'medium':
        reasoning.factors.push('Based on available data in uploaded documents')
        break
      case 'low':
        reasoning.factors.push('Limited supporting evidence found')
        break
      case 'unknown':
        reasoning.factors.push('Confidence level could not be determined')
        break
    }
  }

  return reasoning
}

/**
 * Generate reasoning for aggregated confidence from multiple findings
 *
 * Per AC6: When multiple findings contribute with varying confidence,
 * show the lowest confidence and explain the range.
 *
 * @param aggregated - Aggregated confidence from multiple sources
 * @returns Reasoning with range explanation if applicable
 */
export function generateAggregatedReasoning(
  aggregated: AggregatedConfidence
): ConfidenceReasoning {
  // Base reasoning on lowest confidence (conservative)
  const baseReasoning = generateConfidenceReasoning(aggregated.lowest)

  // Collect factors from all items
  const allFactors: string[] = []
  for (const item of aggregated.items) {
    const itemReasons = generateItemReasoning(item)
    allFactors.push(...itemReasons)
  }

  // Deduplicate factors
  const uniqueFactors = [...new Set(allFactors)]
  if (uniqueFactors.length > 0) {
    baseReasoning.factors = uniqueFactors
  }

  // Add range explanation if variance exists
  if (aggregated.hasVariance && aggregated.count > 1) {
    const lowestLevel = getConfidenceLevelFromScore(aggregated.lowest)
    const highestLevel = getConfidenceLevelFromScore(aggregated.highest)

    if (lowestLevel !== highestLevel) {
      baseReasoning.rangeExplanation =
        `Based on ${aggregated.count} sources with varying reliability. ` +
        `Some sources have ${CONFIDENCE_LEVEL_LABELS[highestLevel].toLowerCase()}, ` +
        `while others have ${CONFIDENCE_LEVEL_LABELS[lowestLevel].toLowerCase()}. ` +
        `Showing the most conservative assessment.`
    } else {
      baseReasoning.rangeExplanation =
        `Based on ${aggregated.count} sources with similar reliability.`
    }
  } else if (aggregated.count > 1) {
    baseReasoning.rangeExplanation =
      `Based on ${aggregated.count} sources with consistent reliability.`
  }

  return baseReasoning
}

/**
 * Get a short inline phrase for confidence level
 * Used in message text when caveats are needed (per AC4)
 *
 * @param level - Confidence level
 * @returns Short phrase suitable for inline use
 */
export function getInlineConfidencePhrase(level: ConfidenceLevel): string {
  switch (level) {
    case 'high':
      return '' // No caveat needed for high confidence
    case 'medium':
      return 'Based on available data, '
    case 'low':
      return "Based on limited information, I'm not fully certain, but "
    case 'unknown':
      return 'Unable to verify, but '
  }
}

/**
 * Get suggested next steps for low confidence scenarios
 * Used when explaining WHY information might be uncertain (per AC5)
 *
 * @param level - Confidence level
 * @param context - Optional context about what was queried
 * @returns Array of suggested next steps
 */
export function getSuggestedNextSteps(
  level: ConfidenceLevel,
  context?: string
): string[] {
  if (level === 'high') {
    return []
  }

  const steps: string[] = []

  if (level === 'low' || level === 'unknown') {
    steps.push('Would you like me to add this to the Q&A list for the target company?')
    steps.push('Should I flag this as an information gap?')
  }

  if (level === 'medium') {
    steps.push('Would you like me to search for additional sources?')
    if (context) {
      steps.push(`Should I look for more recent data about ${context}?`)
    }
  }

  return steps
}

/**
 * Format confidence for display (P2 compliant)
 *
 * NEVER returns raw numbers - always natural language.
 *
 * @param score - Internal confidence score (0-1)
 * @returns User-friendly confidence label
 */
export function formatConfidenceForDisplay(score: number | null): string {
  const level = getConfidenceLevelFromScore(score)
  return CONFIDENCE_LEVEL_LABELS[level]
}
