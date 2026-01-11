/**
 * Agent System v2.0 - Uncertainty Handling Utilities
 *
 * Story: 3-3 Implement Honest Uncertainty Handling (AC: #1, #2, #3, #4, #5)
 *
 * These utilities detect uncertainty in retrieval results and guide
 * the supervisor to respond honestly when information is missing.
 *
 * Key Features:
 * - Uncertainty level detection based on source relevance scores
 * - Actionable next steps generation (context-aware)
 * - Response validation for prohibited phrases
 * - Context injection for system prompts
 *
 * References:
 * - [Source: lib/agent/prompts.ts:96-123] - Existing uncertainty guidance
 * - [Source: _bmad-output/planning-artifacts/agent-system-prd.md] - FR41, FR42, FR43
 */

import type { SourceCitation } from '../types'

// =============================================================================
// Types
// =============================================================================

/**
 * Uncertainty level based on source quality.
 *
 * | Level | Condition | Avg Score | Response Behavior |
 * |-------|-----------|-----------|-------------------|
 * | complete | sources.length === 0 | N/A | Explicit "no data found" + actionable next steps |
 * | high | sources exist but avg < 0.3 | 0.0-0.3 | Strong caveat + suggest verification |
 * | medium | avg score 0.3-0.5 | 0.3-0.5 | Moderate caveat + source quality note |
 * | low | avg score 0.5-0.7 | 0.5-0.7 | Minor caveat: "Based on available data" |
 * | none | avg score > 0.7 | 0.7-1.0 | Normal response, no caveats |
 */
export type UncertaintyLevel = 'none' | 'low' | 'medium' | 'high' | 'complete'

/**
 * Result of uncertainty detection.
 */
export interface UncertaintyResult {
  /** Detected uncertainty level */
  level: UncertaintyLevel
  /** Average relevance score of sources (0-1), null if no sources */
  avgScore: number | null
}

/**
 * Result of response validation.
 */
export interface ValidationResult {
  /** Whether the response passes validation */
  isValid: boolean
  /** List of issues found */
  issues: string[]
  /** Suggested fixes for each issue */
  suggestions: string[]
}

// =============================================================================
// Uncertainty Detection (Task 1)
// =============================================================================

/**
 * Detect uncertainty level from source citations.
 *
 * Story: 3-3 (AC: #1, #3)
 *
 * Thresholds:
 * - complete: sources.length === 0
 * - high: avgScore < 0.3
 * - medium: avgScore 0.3-0.5
 * - low: avgScore 0.5-0.7
 * - none: avgScore > 0.7
 *
 * Performance target: <5ms for typical 3-10 sources
 *
 * @param sources - Source citations from retrieval
 * @param _query - Query string (unused, kept for future semantic analysis)
 * @returns Uncertainty level and average score
 *
 * @example
 * ```typescript
 * const { level, avgScore } = detectUncertainty(state.sources ?? [], query)
 * if (level === 'complete') {
 *   // No sources found - add explicit caveat
 * }
 * ```
 */
export function detectUncertainty(
  sources: SourceCitation[],
  _query: string
): UncertaintyResult {
  const startTime = performance.now()

  // Empty sources = complete uncertainty
  if (sources.length === 0) {
    console.log('[uncertainty] detected level=complete sources=0 avgScore=null')
    return { level: 'complete', avgScore: null }
  }

  // Calculate average relevance score
  const totalScore = sources.reduce((sum, s) => sum + s.relevanceScore, 0)
  const avgScore = totalScore / sources.length

  // Determine level based on thresholds
  let level: UncertaintyLevel
  if (avgScore > 0.7) {
    level = 'none'
  } else if (avgScore > 0.5) {
    level = 'low'
  } else if (avgScore > 0.3) {
    level = 'medium'
  } else {
    level = 'high'
  }

  const elapsed = performance.now() - startTime
  console.log(
    `[uncertainty] detected level=${level} sources=${sources.length} avgScore=${avgScore.toFixed(3)}`
  )

  // Warn if execution time exceeds threshold (indicates unexpectedly large sources array)
  if (elapsed > 10) {
    console.warn(
      `[uncertainty] detectUncertainty took ${elapsed.toFixed(1)}ms (target <5ms)`
    )
  }

  return { level, avgScore }
}

// =============================================================================
// Next Steps Generator (Task 2)
// =============================================================================

/**
 * Generate actionable next steps based on uncertainty level.
 *
 * Story: 3-3 (AC: #2)
 *
 * CRITICAL: Never returns "search for additional sources" when hasDocuments=false.
 * This prevents offering impossible actions.
 *
 * Performance target: <1ms (simple switch/lookup)
 *
 * @param uncertaintyLevel - Detected uncertainty level
 * @param hasDocuments - Whether dealContext.documentCount > 0 (treats undefined as false)
 * @returns Array of actionable next step suggestions
 *
 * @example
 * ```typescript
 * const hasDocuments = state.dealContext?.documentCount > 0 ?? false
 * const nextSteps = generateNextSteps(uncertaintyLevel, hasDocuments)
 * ```
 */
export function generateNextSteps(
  uncertaintyLevel: UncertaintyLevel,
  hasDocuments?: boolean
): string[] {
  // Defensive: treat undefined as false
  const hasDocs = hasDocuments ?? false

  switch (uncertaintyLevel) {
    case 'complete':
      if (hasDocs) {
        // Has documents but nothing relevant found
        return ['Add this question to the Q&A list for client follow-up']
      } else {
        // No documents at all
        return ['Upload documents to the Data Room to get started']
      }

    case 'high':
    case 'medium':
      // Limited relevant information
      return [
        'Request additional information from the target company',
        'Add to Q&A list',
      ]

    case 'low':
    case 'none':
      // Good or sufficient information - no next steps needed
      return []
  }
}

// =============================================================================
// Response Validator (Task 3)
// =============================================================================

/**
 * Prohibited phrase patterns with detection rules.
 *
 * | Phrase | Detection Rule | Example Flagged | Example Allowed |
 * |--------|---------------|-----------------|-----------------|
 * | "I think" | Any occurrence | "I think the revenue is..." | N/A - always flagged |
 * | "I don't know" | Standalone | "I don't know." | "I don't know if this applies" |
 * | "Maybe" | Sentence start | "Maybe the company..." | "...or maybe consider..." |
 */
const PROHIBITED_PATTERNS = [
  { pattern: /\bI\s+think\b/i, name: 'I think' },
  { pattern: /\bI\s+don't\s+know\b/i, name: "I don't know" },
  { pattern: /(?:^|[.!?]\s*)maybe\b/i, name: 'Maybe (sentence start)' },
]

/**
 * Maximum character distance to look for source attribution after currency amount.
 * E.g., "$5.2M (source: Report.pdf)" - source must appear within this many chars.
 */
const SOURCE_ATTRIBUTION_DISTANCE = 50

/**
 * Pattern to detect currency amounts without nearby source attribution.
 *
 * Matches: €5.2M, $10K, £1.5B, ¥500M
 * Only flags if "(source" doesn't appear within SOURCE_ATTRIBUTION_DISTANCE chars after.
 */
const CURRENCY_WITHOUT_SOURCE = new RegExp(
  `[€$£¥]\\d+[\\d.,]*[MBK]?(?!.{0,${SOURCE_ATTRIBUTION_DISTANCE}}\\(source)`,
  'gi'
)

/**
 * Validate response honesty by checking for prohibited phrases.
 *
 * Story: 3-3 (AC: #4)
 *
 * Detects:
 * - "I think" (case insensitive, any occurrence)
 * - "I don't know" (standalone or sentence boundary only)
 * - "Maybe" at sentence start
 * - Currency amounts without source attribution nearby
 *
 * Performance target: <10ms (regex matching on response text)
 *
 * @param response - Response text to validate
 * @returns Validation result with issues and suggestions
 *
 * @example
 * ```typescript
 * const validation = validateResponseHonesty(response.content)
 * if (!validation.isValid) {
 *   console.warn('[uncertainty] response validation issues:', validation.issues)
 * }
 * ```
 */
export function validateResponseHonesty(response: string): ValidationResult {
  const issues: string[] = []
  const suggestions: string[] = []

  // Check prohibited patterns
  for (const { pattern, name } of PROHIBITED_PATTERNS) {
    if (pattern.test(response)) {
      // Special case: "I don't know if..." is allowed (not standalone)
      if (name === "I don't know") {
        // Check if it's followed by "if", "whether", "what", etc.
        const matches = response.match(/\bI\s+don't\s+know\s+(\w+)/gi)
        const hasNonStandalone = matches?.some((m) => {
          const followingWord = m.split(/\s+/).pop()?.toLowerCase()
          return ['if', 'whether', 'what', 'how', 'why', 'when', 'where'].includes(
            followingWord ?? ''
          )
        })
        if (hasNonStandalone) {
          continue // Not standalone, skip this match
        }
      }
      issues.push(`Prohibited phrase detected: "${name}"`)
      suggestions.push(`Replace "${name}" with confident, direct language`)
    }
  }

  // Check for currency without source attribution
  const currencyMatches = response.match(CURRENCY_WITHOUT_SOURCE)
  if (currencyMatches && currencyMatches.length > 0) {
    // Dedupe matches using Array.from for ES5 compatibility
    const unique = Array.from(new Set(currencyMatches))
    for (const match of unique) {
      issues.push(`Currency amount without source attribution: "${match}"`)
      suggestions.push(`Add "(source: filename, location)" after "${match}"`)
    }
  }

  if (issues.length > 0) {
    console.log(`[uncertainty] validation issues=${issues.length}`)
  }

  return {
    isValid: issues.length === 0,
    issues,
    suggestions,
  }
}

// =============================================================================
// Uncertainty Context Injection (Task 4)
// =============================================================================

/**
 * Build uncertainty context to inject into system prompt.
 *
 * Story: 3-3 (AC: #1, #3, #4)
 *
 * Returns concise context (1-2 sentences), NOT full DO/DON'T list.
 * The full guidance is already in prompts.ts - this adds situation-specific context.
 *
 * Injection point: between base prompt and SPECIALIST_GUIDANCE in supervisor.
 *
 * @param uncertaintyLevel - Detected uncertainty level
 * @param hasDocuments - Whether dealContext.documentCount > 0
 * @returns Context string to inject, or empty string for low/none
 *
 * @example
 * ```typescript
 * const uncertaintyContext = buildUncertaintyContext(level, hasDocuments)
 * const systemPrompt = basePrompt + uncertaintyContext + SPECIALIST_GUIDANCE
 * ```
 */
export function buildUncertaintyContext(
  uncertaintyLevel: UncertaintyLevel,
  hasDocuments?: boolean
): string {
  // Defensive: treat undefined as false
  const hasDocs = hasDocuments ?? false

  switch (uncertaintyLevel) {
    case 'complete':
      if (hasDocs) {
        return '\n\n**CONTEXT:** No relevant information found. Suggest adding to Q&A list.\n'
      } else {
        return '\n\n**CONTEXT:** No documents in the Data Room. Do not offer to search - suggest uploading documents.\n'
      }

    case 'high':
      return '\n\n**CONTEXT:** Limited relevant information. Prefix response with "Based on limited information" caveat.\n'

    case 'medium':
      return '\n\n**CONTEXT:** Partial information available. Note what\'s missing.\n'

    case 'low':
    case 'none':
      // Good confidence - system prompt covers this, no extra context needed
      return ''
  }
}
