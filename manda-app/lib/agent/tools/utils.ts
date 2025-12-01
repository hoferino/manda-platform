/**
 * Agent Tool Utilities
 *
 * Helper functions for formatting tool responses and handling errors.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Features:
 * - Consistent response formatting
 * - User-friendly error messages
 * - Source attribution formatting per P2 spec
 */

import type { SourceCitation, FindingWithSource } from '../schemas'

/**
 * Format a tool response for the agent
 * Ensures consistent structure across all tools
 */
export function formatToolResponse<T extends object>(
  success: true,
  data: T
): string
export function formatToolResponse(
  success: false,
  error: string
): string
export function formatToolResponse<T extends object>(
  success: boolean,
  dataOrError: T | string
): string {
  if (success) {
    return JSON.stringify({ success: true, data: dataOrError }, null, 2)
  }
  return JSON.stringify({ success: false, error: dataOrError }, null, 2)
}

/**
 * Handle tool errors gracefully
 * Returns user-friendly error messages per AC #11
 */
export function handleToolError(error: unknown, toolName: string): string {
  // Log detailed error for debugging
  console.error(`[Tool:${toolName}] Error:`, error)

  // Extract error message
  let message = 'An unexpected error occurred'
  if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  }

  // Map common errors to user-friendly messages
  const userFriendlyMessages: Record<string, string> = {
    'Authentication required': 'Please sign in to access this feature.',
    'Project not found': 'The specified project could not be found.',
    'Document not found': 'The specified document could not be found.',
    'Finding not found': 'The specified finding could not be found.',
    'rate limit': 'The service is currently busy. Please try again in a moment.',
    'timeout': 'The request took too long. Please try a simpler query.',
    'network': 'Network error. Please check your connection.',
    'OPENAI_API_KEY': 'Search service is not configured. Please contact support.',
    'NEO4J': 'Graph database is currently unavailable.',
  }

  // Check for known error patterns
  for (const [pattern, friendlyMessage] of Object.entries(userFriendlyMessages)) {
    if (message.toLowerCase().includes(pattern.toLowerCase())) {
      return formatToolResponse(false, friendlyMessage)
    }
  }

  // Generic error response
  return formatToolResponse(
    false,
    `I encountered an issue while using the ${toolName} tool. ${message}`
  )
}

/**
 * Format source citation for display
 * Per P2 spec: Format: (source: filename.ext, location)
 */
export function formatSourceCitation(source: SourceCitation): string {
  return `(source: ${source.documentName}, ${source.location})`
}

/**
 * Format multiple source citations
 * Per P2 spec: Multiple sources allowed: (sources: doc1.pdf p.5, doc2.xlsx B15)
 */
export function formatSourceCitations(sources: SourceCitation[]): string {
  if (sources.length === 0) return ''
  if (sources.length === 1) return formatSourceCitation(sources[0]!)

  const formatted = sources
    .map((s) => `${s.documentName} ${s.location}`)
    .join(', ')
  return `(sources: ${formatted})`
}

/**
 * Format findings with sources for natural language response
 * Implements P2 response formatting rules
 */
export function formatFindingsForResponse(findings: FindingWithSource[]): string {
  if (findings.length === 0) {
    return 'No relevant findings found in the knowledge base.'
  }

  return findings
    .map((f) => {
      const source = formatSourceCitation(f.source)
      return `• ${f.text} ${source}`
    })
    .join('\n')
}

/**
 * Translate confidence to natural language per P2 spec
 * Never show raw confidence scores to users
 */
export function translateConfidence(confidence: number | null): string {
  if (confidence === null) return ''

  if (confidence >= 0.9) return 'high confidence'
  if (confidence >= 0.7) return 'good confidence'
  if (confidence >= 0.5) return 'moderate confidence'
  return 'lower confidence - may need verification'
}

/**
 * Format temporal context for findings
 * Per P1 spec: Show temporal evolution (Q1 → Q2 → Q3)
 */
export function formatTemporalContext(dateReferenced: string | null): string {
  if (!dateReferenced) return ''

  try {
    const date = new Date(dateReferenced)
    const quarter = Math.ceil((date.getMonth() + 1) / 3)
    const year = date.getFullYear()
    return `Q${quarter} ${year}`
  } catch {
    // If date parsing fails, return as-is
    return dateReferenced
  }
}

/**
 * Group findings by temporal period
 * For research mode queries per P1 spec
 */
export function groupFindingsByPeriod(
  findings: FindingWithSource[]
): Map<string, FindingWithSource[]> {
  const grouped = new Map<string, FindingWithSource[]>()

  for (const finding of findings) {
    const period = formatTemporalContext(finding.dateReferenced) || 'Unknown period'
    const existing = grouped.get(period) || []
    existing.push(finding)
    grouped.set(period, existing)
  }

  return grouped
}

/**
 * Detect if query is a fact lookup vs research mode
 * Per P1 spec: Two query modes
 */
export function inferQueryMode(query: string): 'fact' | 'research' {
  const factPatterns = [
    /^what('s| is| was) the/i,
    /^how (many|much)/i,
    /^when (did|was|is)/i,
    /^who (is|was|are)/i,
    /^what('s| is) .*\?$/i,
    /\b(ebitda|revenue|margin|employees|headcount)\b/i,
  ]

  const researchPatterns = [
    /^(tell me about|summarize|walk me through|explain|describe)/i,
    /^(any|are there) (concerns|red flags|issues|problems)/i,
    /^(what do we know|what's missing|gaps)/i,
    /^(compare|how does.*compare)/i,
  ]

  // Check for research patterns first (more specific)
  for (const pattern of researchPatterns) {
    if (pattern.test(query)) return 'research'
  }

  // Check for fact patterns
  for (const pattern of factPatterns) {
    if (pattern.test(query)) return 'fact'
  }

  // Default to research for open-ended queries
  return 'research'
}

/**
 * Create a standard tool context object
 * Contains common context needed by all tools
 */
export interface ToolContext {
  dealId: string
  userId: string
  supabase: unknown // Type will be SupabaseClient but keeping loose for now
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(id)
}

/**
 * Truncate text to max length with ellipsis
 */
export function truncateText(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}
