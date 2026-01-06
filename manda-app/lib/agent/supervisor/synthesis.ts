/**
 * Result Synthesis Logic
 *
 * Story: E13.4 - Supervisor Agent Pattern (AC: #4)
 *
 * Synthesizes responses from multiple specialist agents into a coherent final answer.
 * Handles source deduplication, confidence aggregation, and narrative composition.
 *
 * Synthesis Strategy:
 * - Single specialist: Return directly (no synthesis needed)
 * - Multiple specialists: Generate coherent narrative combining insights
 * - Error handling: Graceful degradation if synthesis fails
 *
 * References:
 * - [Source: docs/sprint-artifacts/stories/e13-4-supervisor-agent-pattern.md]
 */

import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import {
  type SpecialistResult,
  type SynthesizedResponse,
  type SourceReference,
} from './state'
import { createLLMClient } from '@/lib/llm/client'

// =============================================================================
// Cached LLM Client for Synthesis
// =============================================================================

/**
 * Lazy-initialized cached LLM client for synthesis operations
 * Avoids creating new clients on every synthesis call
 */
let cachedSynthesisLLM: BaseChatModel | null = null

function getSynthesisLLM(): BaseChatModel {
  if (!cachedSynthesisLLM) {
    cachedSynthesisLLM = createLLMClient({
      complexity: 'medium', // Use medium tier for synthesis (cost-effective)
    })
  }
  return cachedSynthesisLLM
}

// =============================================================================
// Configuration
// =============================================================================

/**
 * System prompt for synthesis LLM
 */
const SYNTHESIS_SYSTEM_PROMPT = `You are a synthesis agent for an M&A due diligence platform.
Your task is to combine analyses from multiple specialist agents into a single coherent response.

Guidelines:
1. Integrate insights from all specialists without redundancy
2. Resolve any contradictions by noting different perspectives
3. Maintain factual accuracy - do not add information not present in specialist outputs
4. Structure the response logically (financial first, then entities/relationships if present)
5. Include all relevant sources cited by specialists
6. Use professional M&A terminology
7. Be concise but comprehensive

Format: Provide a well-structured response that reads naturally as a single analysis.`

/**
 * Synthesis configuration options
 */
export interface SynthesisConfig {
  /** Maximum tokens for synthesis response */
  maxTokens?: number
  /** Temperature for synthesis (lower = more consistent) */
  temperature?: number
  /** Custom LLM for synthesis (uses default if not provided) */
  llm?: BaseChatModel
}

const DEFAULT_SYNTHESIS_CONFIG: Required<Omit<SynthesisConfig, 'llm'>> = {
  maxTokens: 1024,
  temperature: 0.3,
}

// =============================================================================
// Source Deduplication (AC: #4)
// =============================================================================

/**
 * Deduplicate sources across specialist responses
 * Story: E13.4 (AC: #4) - Deduplicate sources across specialist responses
 *
 * Uses documentId as primary key for deduplication.
 * Falls back to documentName + chunkId if documentId not present.
 *
 * @param sources - Array of sources from all specialists
 * @returns Deduplicated source array
 */
export function deduplicateSources(sources: SourceReference[]): SourceReference[] {
  const seen = new Map<string, SourceReference>()

  for (const source of sources) {
    // Create unique key based on available identifiers
    const key = source.documentId
      ? `doc:${source.documentId}`
      : `name:${source.documentName ?? 'unknown'}:chunk:${source.chunkId ?? 'unknown'}`

    // Keep source with higher relevance score if duplicate
    const existing = seen.get(key)
    if (!existing || (source.relevanceScore ?? 0) > (existing.relevanceScore ?? 0)) {
      seen.set(key, source)
    }
  }

  // Sort by relevance score (highest first)
  return Array.from(seen.values()).sort(
    (a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0)
  )
}

// =============================================================================
// Confidence Aggregation (AC: #4)
// =============================================================================

/**
 * Calculate aggregate confidence from specialist results
 * Story: E13.4 (AC: #4) - Calculate aggregate confidence from specialist confidences
 *
 * Uses weighted average based on output length (longer = more comprehensive).
 * Penalizes if any specialist reported an error.
 *
 * @param results - Specialist results to aggregate
 * @returns Aggregate confidence score (0-1)
 */
export function calculateAggregateConfidence(results: SpecialistResult[]): number {
  if (results.length === 0) return 0

  // Filter out errored results for primary calculation
  const validResults = results.filter(r => !r.error)
  if (validResults.length === 0) return 0.2 // Low confidence if all errored

  // Calculate weights based on output length (longer = more comprehensive)
  const weights = validResults.map(r => Math.sqrt(r.output.length))
  const totalWeight = weights.reduce((sum, w) => sum + w, 0)

  // Weighted average of confidence scores
  let aggregateConfidence = 0
  for (let i = 0; i < validResults.length; i++) {
    const weight = weights[i]! / totalWeight
    aggregateConfidence += validResults[i]!.confidence * weight
  }

  // Penalize if any errors occurred
  const errorPenalty = (results.length - validResults.length) * 0.1
  aggregateConfidence = Math.max(0, aggregateConfidence - errorPenalty)

  return Math.round(aggregateConfidence * 100) / 100 // Round to 2 decimals
}

// =============================================================================
// Main Synthesis Function (AC: #4)
// =============================================================================

/**
 * Synthesize results from multiple specialists
 * Story: E13.4 (AC: #4) - Implement result synthesis from multiple specialists
 *
 * Handles three cases:
 * 1. No results: Returns error response
 * 2. Single specialist: Returns directly (no synthesis needed)
 * 3. Multiple specialists: LLM-based synthesis into coherent narrative
 *
 * @param results - Specialist results to synthesize
 * @param config - Optional synthesis configuration
 * @returns SynthesizedResponse with combined content
 *
 * @example
 * ```typescript
 * const response = await synthesizeResults([
 *   { specialistId: 'financial_analyst', output: 'EBITDA is $5M...', confidence: 0.9, sources: [] },
 *   { specialistId: 'knowledge_graph', output: 'Company acquired in 2023...', confidence: 0.85, sources: [] },
 * ])
 * // response.wasSynthesized = true
 * // response.content = combined analysis
 * ```
 */
export async function synthesizeResults(
  results: SpecialistResult[],
  config?: SynthesisConfig
): Promise<SynthesizedResponse> {
  const startTime = Date.now()

  // Case 1: No results
  if (results.length === 0) {
    return {
      content: 'I was unable to find relevant information to answer your question.',
      confidence: 0,
      sources: [],
      specialists: [],
      wasSynthesized: false,
      totalLatencyMs: Date.now() - startTime,
    }
  }

  // Case 2: Single specialist - return directly
  if (results.length === 1) {
    const result = results[0]!
    return {
      content: result.error
        ? `I encountered an issue while analyzing your question: ${result.error}`
        : result.output,
      confidence: result.confidence,
      sources: result.sources,
      specialists: [result.specialistId],
      wasSynthesized: false,
      totalLatencyMs: result.timing ?? (Date.now() - startTime),
    }
  }

  // Case 3: Multiple specialists - synthesize
  try {
    const synthesizedContent = await synthesizeWithLLM(results, config)
    const allSources = deduplicateSources(results.flatMap(r => r.sources))
    const aggregateConfidence = calculateAggregateConfidence(results)
    const totalLatency = results.reduce((sum, r) => sum + (r.timing ?? 0), 0)

    return {
      content: synthesizedContent,
      confidence: aggregateConfidence,
      sources: allSources,
      specialists: results.map(r => r.specialistId),
      wasSynthesized: true,
      totalLatencyMs: totalLatency + (Date.now() - startTime),
    }
  } catch (error) {
    // Fallback: concatenate outputs if synthesis fails
    console.error('[synthesis] LLM synthesis failed, using fallback:', error)
    return createFallbackSynthesis(results, startTime)
  }
}

// =============================================================================
// LLM-Based Synthesis
// =============================================================================

/**
 * Use LLM to synthesize specialist outputs into coherent narrative
 */
async function synthesizeWithLLM(
  results: SpecialistResult[],
  config?: SynthesisConfig
): Promise<string> {
  // Use provided LLM or cached synthesis LLM
  const llm = config?.llm ?? getSynthesisLLM()

  // Build synthesis prompt with specialist outputs
  const specialistOutputs = results
    .filter(r => !r.error)
    .map(r => {
      const stubNote = r.stub ? ' (preliminary analysis)' : ''
      return `## ${formatSpecialistName(r.specialistId)}${stubNote}\n\n${r.output}`
    })
    .join('\n\n---\n\n')

  // Include error notes if any
  const errorNotes = results
    .filter(r => r.error)
    .map(r => `Note: ${formatSpecialistName(r.specialistId)} encountered an issue: ${r.error}`)
    .join('\n')

  const userPrompt = `Please synthesize the following specialist analyses into a single coherent response:

${specialistOutputs}

${errorNotes ? `\n${errorNotes}\n` : ''}
Create a unified response that integrates all insights without redundancy.`

  const messages = [
    new SystemMessage(SYNTHESIS_SYSTEM_PROMPT),
    new HumanMessage(userPrompt),
  ]

  const response = await llm.invoke(messages)
  return typeof response.content === 'string'
    ? response.content
    : 'Unable to synthesize specialist responses.'
}

/**
 * Create fallback synthesis by concatenating outputs
 * Used when LLM synthesis fails
 */
function createFallbackSynthesis(
  results: SpecialistResult[],
  startTime: number
): SynthesizedResponse {
  const validResults = results.filter(r => !r.error)

  if (validResults.length === 0) {
    // All specialists errored
    return {
      content: 'I encountered issues while analyzing your question. Please try rephrasing or ask a more specific question.',
      confidence: 0.2,
      sources: [],
      specialists: results.map(r => r.specialistId),
      wasSynthesized: false,
      totalLatencyMs: Date.now() - startTime,
    }
  }

  // Concatenate outputs with headers
  const combinedContent = validResults
    .map(r => {
      const header = `**${formatSpecialistName(r.specialistId)} Analysis:**`
      return `${header}\n\n${r.output}`
    })
    .join('\n\n---\n\n')

  return {
    content: combinedContent,
    confidence: calculateAggregateConfidence(results),
    sources: deduplicateSources(results.flatMap(r => r.sources)),
    specialists: results.map(r => r.specialistId),
    wasSynthesized: true, // Technically synthesized, just not LLM-enhanced
    totalLatencyMs: Date.now() - startTime,
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Format specialist ID to human-readable name
 */
function formatSpecialistName(specialistId: string): string {
  switch (specialistId) {
    case 'financial_analyst':
      return 'Financial Analysis'
    case 'knowledge_graph':
      return 'Knowledge Graph Analysis'
    case 'general':
      return 'General Analysis'
    default:
      return specialistId.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }
}

/**
 * Check if synthesis is needed for results
 *
 * @param results - Specialist results
 * @returns true if multiple valid results require synthesis
 */
export function needsSynthesis(results: SpecialistResult[]): boolean {
  const validResults = results.filter(r => !r.error && r.output.trim().length > 0)
  return validResults.length > 1
}

/**
 * Get synthesis statistics for observability
 *
 * @param response - Synthesized response
 * @returns Statistics object for logging
 */
export function getSynthesisStats(response: SynthesizedResponse): Record<string, unknown> {
  return {
    specialistCount: response.specialists.length,
    wasSynthesized: response.wasSynthesized,
    confidence: response.confidence,
    sourceCount: response.sources.length,
    contentLength: response.content.length,
    latencyMs: response.totalLatencyMs,
  }
}
