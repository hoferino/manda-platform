/**
 * Finding to Q&A Mapping Utilities
 *
 * Utilities for mapping finding domains to Q&A categories and generating
 * questions from findings for the Q&A quick-add feature.
 * Story: E8.5 - Finding → Q&A Quick-Add (AC: #2, #3)
 *
 * Features:
 * - Domain to Q&A category mapping (financial→Financials, etc.)
 * - Question generation from finding text
 * - Special phrasing for contradiction-type findings
 * - Text truncation for very long findings
 */

import type { FindingDomain, Finding, FindingType } from '@/lib/types/findings'
import type { QACategory } from '@/lib/types/qa'

/**
 * Map finding domain (lowercase) to Q&A category (PascalCase)
 * AC: #3 - Pre-select category based on finding's domain
 *
 * @param domain - Finding domain (lowercase: financial, operational, etc.)
 * @returns Q&A category (PascalCase: Financials, Operations, etc.)
 */
export function mapDomainToQACategory(domain: FindingDomain | null | undefined): QACategory {
  if (!domain) {
    return 'Operations' // Default for null/unknown domains
  }

  const domainMap: Record<FindingDomain, QACategory> = {
    financial: 'Financials',
    operational: 'Operations',
    market: 'Market',
    legal: 'Legal',
    technical: 'Technology',
  }

  return domainMap[domain] ?? 'Operations' // Default for any unexpected values
}

/**
 * Maximum length for finding text in generated questions
 * Longer text will be truncated with "..."
 */
const MAX_FINDING_TEXT_LENGTH = 500

/**
 * Truncate text to a maximum length with ellipsis
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 500)
 * @returns Truncated text with "..." if needed
 */
export function truncateFindingText(text: string, maxLength: number = MAX_FINDING_TEXT_LENGTH): string {
  if (text.length <= maxLength) {
    return text
  }
  return text.slice(0, maxLength).trimEnd() + '...'
}

/**
 * Check if a finding is a contradiction type
 * @param findingType - The finding's type
 * @returns True if the finding is a contradiction
 */
export function isContradictionFinding(findingType: FindingType | null | undefined): boolean {
  return findingType === 'contradiction'
}

/**
 * Generate a question from a finding for Q&A quick-add
 * AC: #2 - Pre-drafted question based on finding text and context
 *
 * Question templates:
 * - Standard: "Can you provide clarification on the following: {finding.text}?"
 * - Contradiction: "We found a potential inconsistency regarding {topic}. Can you provide additional documentation or clarification?"
 * - Metric gap: "Can you provide documentation supporting {finding.text}?"
 *
 * @param finding - The finding to generate a question from
 * @returns A pre-drafted question string
 */
export function generateQuestionFromFinding(finding: Finding): string {
  const truncatedText = truncateFindingText(finding.text)

  // Contradiction-type findings get special phrasing
  if (isContradictionFinding(finding.findingType)) {
    // Extract a brief topic from the finding text (first sentence or 100 chars)
    const sentences = finding.text.split(/[.!?]/)
    const firstSentence = sentences[0] ?? finding.text.slice(0, 100)
    const topic = firstSentence.length > 100
      ? firstSentence.slice(0, 100).trimEnd() + '...'
      : firstSentence

    return `We found a potential inconsistency regarding "${topic}". Can you provide additional documentation or clarification on this matter?`
  }

  // Metric-type findings might need supporting documentation
  if (finding.findingType === 'metric') {
    return `Can you provide documentation supporting the following: "${truncatedText}"?`
  }

  // Risk-type findings need clarification on impact/mitigation
  if (finding.findingType === 'risk') {
    return `Regarding the following risk identified: "${truncatedText}" - Can you provide additional context or clarification on how this is being addressed?`
  }

  // Default: Standard clarification request
  return `Can you provide clarification on the following: "${truncatedText}"?`
}

/**
 * Generate a question with a custom prefix/suffix
 * Allows for more flexibility in question generation
 *
 * @param finding - The finding to base the question on
 * @param prefix - Custom prefix before the finding text
 * @param suffix - Custom suffix after the finding text
 * @returns A formatted question string
 */
export function generateCustomQuestion(
  finding: Finding,
  prefix: string = 'Regarding: ',
  suffix: string = ' - Can you please clarify?'
): string {
  const truncatedText = truncateFindingText(finding.text)
  return `${prefix}"${truncatedText}"${suffix}`
}

/**
 * Get a suggested priority based on finding type and confidence
 * Contradictions and low-confidence findings get higher priority
 *
 * @param finding - The finding to assess
 * @returns Suggested priority: 'high' | 'medium' | 'low'
 */
export function suggestQAPriority(finding: Finding): 'high' | 'medium' | 'low' {
  // Contradictions are high priority - need resolution
  if (isContradictionFinding(finding.findingType)) {
    return 'high'
  }

  // Risks are also high priority
  if (finding.findingType === 'risk') {
    return 'high'
  }

  // Low confidence findings need clarification
  if (finding.confidence !== null && finding.confidence < 0.6) {
    return 'high'
  }

  // Medium confidence findings
  if (finding.confidence !== null && finding.confidence < 0.8) {
    return 'medium'
  }

  // Default to medium priority
  return 'medium'
}
