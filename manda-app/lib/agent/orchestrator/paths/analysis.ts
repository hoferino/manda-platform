/**
 * Analysis Path
 *
 * Routes complex analysis requests to specialized subagents.
 * Used for trend analysis, comparisons, risk detection, gap analysis, etc.
 *
 * Subagents:
 * - Financial Analyst: EBITDA, revenue, margins, valuations
 * - Knowledge Graph: Entity relationships, contradictions, history
 */

import { invokeSupervisor, type SupervisorInvokeResult } from '@/lib/agent/supervisor'
import { classifyIntentAsync, type EnhancedIntentResult } from '@/lib/agent/intent'
import type { BaseMessage } from '@langchain/core/messages'

// =============================================================================
// Types
// =============================================================================

export interface AnalysisPathInput {
  message: string
  dealId: string
  userId: string
  organizationId?: string
  chatHistory?: BaseMessage[]
}

export interface AnalysisPathResult {
  content: string
  latencyMs: number
  specialists: string[]
  confidence: number
  sources: Array<{
    documentId?: string
    documentName?: string
    chunkId?: string
    relevanceScore?: number
    snippet?: string
  }>
  wasSynthesized: boolean
  routing: {
    selectedSpecialists: string[]
    rationale: string
    isParallel: boolean
  }
  metrics: {
    classifyLatencyMs?: number
    routeLatencyMs?: number
    synthesizeLatencyMs?: number
  }
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Execute the analysis path
 *
 * Delegates to the supervisor agent which handles:
 * - Specialist selection (financial analyst, knowledge graph, general)
 * - Parallel execution when multiple specialists match
 * - Result synthesis from multiple specialists
 *
 * @param input - User message, deal ID, user ID, and optional context
 * @returns Analysis result with specialist outputs and metrics
 */
export async function executeAnalysisPath(input: AnalysisPathInput): Promise<AnalysisPathResult> {
  const startTime = Date.now()

  // Pre-classify intent for supervisor (saves classification step)
  const intent = await classifyIntentAsync(input.message)

  // Force complexity to 'complex' since we're in the analysis path
  const enhancedIntent: EnhancedIntentResult = {
    ...intent,
    complexity: 'complex',
    complexityConfidence: 0.9,
  }

  console.log(`[AnalysisPath] Invoking supervisor for: "${input.message.slice(0, 100)}..."`)

  // Invoke supervisor agent
  const result = await invokeSupervisor({
    query: input.message,
    dealId: input.dealId,
    userId: input.userId,
    organizationId: input.organizationId,
    intent: enhancedIntent,
  })

  console.log(
    `[AnalysisPath] Completed in ${result.metrics.totalLatencyMs}ms, ` +
    `specialists: [${result.specialists.join(', ')}], ` +
    `synthesized: ${result.wasSynthesized}`
  )

  return {
    content: result.content,
    latencyMs: Date.now() - startTime,
    specialists: result.specialists,
    confidence: result.confidence,
    sources: result.sources,
    wasSynthesized: result.wasSynthesized,
    routing: result.routing,
    metrics: {
      classifyLatencyMs: result.metrics.classifyLatencyMs,
      routeLatencyMs: result.metrics.routeLatencyMs,
      synthesizeLatencyMs: result.metrics.synthesizeLatencyMs,
    },
  }
}

/**
 * Analysis path doesn't support streaming (supervisor returns full response)
 * This wrapper provides consistency with other paths
 */
export async function streamAnalysisPath(
  input: AnalysisPathInput,
  onToken: (token: string) => void
): Promise<AnalysisPathResult> {
  const result = await executeAnalysisPath(input)

  // Emit tokens all at once (supervisor doesn't support streaming yet)
  // This maintains the callback interface for consistency
  onToken(result.content)

  return result
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Determine which specialists would be invoked for a query
 * (for preview/debugging purposes)
 */
export function previewSpecialists(message: string): string[] {
  const lower = message.toLowerCase()
  const specialists: string[] = []

  // Financial keywords
  const financialKeywords = [
    'revenue', 'ebitda', 'margin', 'profit', 'valuation',
    'cost', 'expense', 'cash', 'debt', 'equity',
    'forecast', 'projection', 'budget', 'roi', 'irr',
  ]
  if (financialKeywords.some(kw => lower.includes(kw))) {
    specialists.push('financial_analyst')
  }

  // Knowledge graph keywords
  const kgKeywords = [
    'entity', 'relationship', 'contradiction', 'inconsistent',
    'person', 'people', 'employee', 'ceo', 'cfo',
    'subsidiary', 'parent', 'acquisition', 'timeline',
  ]
  if (kgKeywords.some(kw => lower.includes(kw))) {
    specialists.push('knowledge_graph')
  }

  // Default to general if no specific specialist matches
  if (specialists.length === 0) {
    specialists.push('general')
  }

  return specialists
}
