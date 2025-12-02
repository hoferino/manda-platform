/**
 * Confidence Extraction Utilities
 *
 * Functions for extracting and aggregating confidence scores from agent tool results.
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 * AC: #1 (Confidence Score Extraction), #6 (Multiple Finding Aggregation)
 *
 * IMPORTANT: These utilities extract INTERNAL confidence scores (0-1).
 * Per P2 compliance, raw scores must NEVER be shown to users - use
 * confidence-reasoning.ts to translate to natural language.
 */

/**
 * Confidence level thresholds (matches lib/types/findings.ts)
 */
export const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,    // >= 80% is high confidence
  MEDIUM: 0.6,  // >= 60% is medium confidence
  DEFAULT: 0.7, // Default when confidence is missing
} as const

/**
 * Confidence level type
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unknown'

/**
 * Confidence data extracted from a single finding/source
 */
export interface ConfidenceData {
  score: number // 0-1 normalized
  sourceDocument?: string
  factors?: ConfidenceFactor[]
}

/**
 * Factor that contributes to confidence score
 * Used for generating natural language explanations (P2 compliance)
 */
export interface ConfidenceFactor {
  type:
    | 'source_quality'     // e.g., "audited financials" vs "internal draft"
    | 'data_recency'       // e.g., "2 months old"
    | 'source_type'        // e.g., "forecast" vs "actual"
    | 'partial_data'       // e.g., "partial Q3 data"
    | 'superseded'         // e.g., "later corrected"
    | 'number_of_sources'  // e.g., "corroborated by 3 sources"
  value: string
  impact: 'positive' | 'negative' | 'neutral'
}

/**
 * Aggregated confidence result for responses with multiple findings
 */
export interface AggregatedConfidence {
  /** Lowest confidence score across all findings (conservative) */
  lowest: number
  /** Highest confidence score */
  highest: number
  /** Average confidence score */
  average: number
  /** Number of findings contributing */
  count: number
  /** All individual confidence data */
  items: ConfidenceData[]
  /** Whether there's significant variance (> 0.2 spread) */
  hasVariance: boolean
  /** The overall level based on lowest score */
  level: ConfidenceLevel
}

/**
 * Tool result structure from agent execution
 */
interface ToolResult {
  tool_call_id?: string
  tool?: string
  result?: unknown
  output?: unknown
  error?: string
}

/**
 * Finding structure from query_knowledge_base results
 */
interface FindingResult {
  confidence?: number | null
  sourceDocument?: string
  source?: {
    documentName?: string
    confidence?: number
  }
  metadata?: {
    factors?: ConfidenceFactor[]
    sourceQuality?: string
    dataRecency?: string
  }
}

/**
 * Extract confidence from a single finding result
 */
function extractFromFinding(finding: FindingResult): ConfidenceData | null {
  // Try multiple paths for confidence value
  const confidence =
    finding.confidence ??
    finding.source?.confidence ??
    null

  if (confidence === null || confidence === undefined) {
    return null
  }

  // Normalize to 0-1 scale
  const normalizedScore = normalizeConfidence(confidence)

  // Extract factors if available
  const factors: ConfidenceFactor[] = []

  if (finding.metadata?.factors) {
    factors.push(...finding.metadata.factors)
  }

  // Infer factors from source quality
  if (finding.metadata?.sourceQuality) {
    factors.push({
      type: 'source_quality',
      value: finding.metadata.sourceQuality,
      impact: finding.metadata.sourceQuality.toLowerCase().includes('audit')
        ? 'positive'
        : 'neutral',
    })
  }

  return {
    score: normalizedScore,
    sourceDocument: finding.sourceDocument || finding.source?.documentName,
    factors: factors.length > 0 ? factors : undefined,
  }
}

/**
 * Normalize confidence value to 0-1 scale
 * Handles values that might be percentages (0-100) or already normalized (0-1)
 */
export function normalizeConfidence(value: number): number {
  if (value > 1) {
    // Assume it's a percentage, convert to 0-1
    return Math.min(1, Math.max(0, value / 100))
  }
  // Already in 0-1 range
  return Math.min(1, Math.max(0, value))
}

/**
 * Get confidence level from score
 */
export function getConfidenceLevelFromScore(score: number | null): ConfidenceLevel {
  if (score === null || score === undefined) {
    return 'unknown'
  }
  if (score >= CONFIDENCE_THRESHOLDS.HIGH) {
    return 'high'
  }
  if (score >= CONFIDENCE_THRESHOLDS.MEDIUM) {
    return 'medium'
  }
  return 'low'
}

/**
 * Extract confidence scores from tool execution results
 *
 * Parses tool results (especially query_knowledge_base) to find confidence scores
 * and associated metadata.
 *
 * @param toolResults - Array of tool results from agent execution
 * @returns Array of confidence data extracted from findings
 */
export function extractConfidenceFromToolResults(
  toolResults: ToolResult[] | unknown
): ConfidenceData[] {
  const confidences: ConfidenceData[] = []

  if (!toolResults || !Array.isArray(toolResults)) {
    return confidences
  }

  for (const result of toolResults) {
    // Skip if no result data
    const output = result.result || result.output
    if (!output) continue

    // Try to parse if it's a string
    let parsed: unknown = output
    if (typeof output === 'string') {
      try {
        parsed = JSON.parse(output)
      } catch {
        continue // Skip unparseable results
      }
    }

    // Handle different result structures
    if (typeof parsed === 'object' && parsed !== null) {
      const data = parsed as Record<string, unknown>

      // Check for findings array (query_knowledge_base result)
      if (data.data && typeof data.data === 'object') {
        const innerData = data.data as Record<string, unknown>
        if (Array.isArray(innerData.findings)) {
          for (const finding of innerData.findings) {
            const extracted = extractFromFinding(finding as FindingResult)
            if (extracted) {
              confidences.push(extracted)
            }
          }
        }
      }

      // Check for direct findings array
      if (Array.isArray(data.findings)) {
        for (const finding of data.findings) {
          const extracted = extractFromFinding(finding as FindingResult)
          if (extracted) {
            confidences.push(extracted)
          }
        }
      }

      // Check for single finding with confidence
      if ('confidence' in data) {
        const extracted = extractFromFinding(data as FindingResult)
        if (extracted) {
          confidences.push(extracted)
        }
      }
    }
  }

  return confidences
}

/**
 * Aggregate multiple confidence scores
 *
 * Returns the LOWEST confidence as the primary score (conservative approach),
 * along with range information for explaining variance to users.
 *
 * Per AC6: "When multiple findings contribute to an answer with varying
 * confidence levels, the agent shows the lowest confidence and explains the range"
 *
 * @param confidences - Array of confidence data from different findings
 * @returns Aggregated confidence with lowest, highest, average, and variance info
 */
export function aggregateConfidence(
  confidences: ConfidenceData[]
): AggregatedConfidence {
  // Handle empty array - return default medium confidence
  if (!confidences || confidences.length === 0) {
    return {
      lowest: CONFIDENCE_THRESHOLDS.DEFAULT,
      highest: CONFIDENCE_THRESHOLDS.DEFAULT,
      average: CONFIDENCE_THRESHOLDS.DEFAULT,
      count: 0,
      items: [],
      hasVariance: false,
      level: 'medium',
    }
  }

  const scores = confidences.map((c) => c.score)
  const lowest = Math.min(...scores)
  const highest = Math.max(...scores)
  const average = scores.reduce((a, b) => a + b, 0) / scores.length

  // Variance is significant if spread > 0.2 (20 percentage points)
  const hasVariance = highest - lowest > 0.2

  return {
    lowest,
    highest,
    average,
    count: confidences.length,
    items: confidences,
    hasVariance,
    level: getConfidenceLevelFromScore(lowest),
  }
}

/**
 * Extract overall confidence from a response
 *
 * Convenience function that extracts from tool results and aggregates.
 * Returns null if no confidence data found.
 *
 * @param toolResults - Tool results from agent execution
 * @returns Aggregated confidence or null
 */
export function extractAndAggregateConfidence(
  toolResults: ToolResult[] | unknown
): AggregatedConfidence | null {
  const confidences = extractConfidenceFromToolResults(toolResults)

  if (confidences.length === 0) {
    return null
  }

  return aggregateConfidence(confidences)
}

/**
 * Get default confidence when none is available
 * Returns medium confidence (0.7) to avoid being too pessimistic or optimistic
 */
export function getDefaultConfidence(): AggregatedConfidence {
  return {
    lowest: CONFIDENCE_THRESHOLDS.DEFAULT,
    highest: CONFIDENCE_THRESHOLDS.DEFAULT,
    average: CONFIDENCE_THRESHOLDS.DEFAULT,
    count: 0,
    items: [],
    hasVariance: false,
    level: 'medium',
  }
}
