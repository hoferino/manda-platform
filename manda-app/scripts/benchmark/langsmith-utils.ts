/**
 * LangSmith Utilities
 *
 * Helper functions for generating LangSmith Studio URLs and filters.
 * Story: E13 Retrospective - Phased Validation System
 */

/**
 * LangSmith filter types
 */
export interface LangSmithFilters {
  dealId?: string
  validationPhase?: string
  edgeCaseResult?: string
  runId?: string
  success?: boolean
  benchmark?: boolean
  retrievalHit?: boolean
}

/**
 * Pre-built filter templates for common queries
 */
export const LANGSMITH_FILTER_TEMPLATES = {
  // All benchmark traces
  allBenchmark: 'eq(metadata.benchmark, true)',

  // Failed queries only
  failedOnly: 'and(eq(metadata.benchmark, true), eq(outputs.success, false))',

  // Hallucinations detected
  hallucinations: 'eq(metadata.edge_case_result, "hallucination")',

  // Retrieval failures (no context found)
  retrievalFailures: 'and(eq(metadata.benchmark, true), eq(metadata.retrieval_hit, false))',

  // Classification mismatches
  classificationErrors:
    'and(eq(metadata.benchmark, true), neq(metadata.expected_complexity, metadata.classified_complexity))',

  // High latency (>5s)
  highLatency: 'and(eq(metadata.benchmark, true), gt(metrics.latency_ms, 5000))',

  // Simple tier queries
  simpleTier: 'and(eq(metadata.benchmark, true), eq(metadata.complexity_tier, "simple"))',

  // Medium tier queries
  mediumTier: 'and(eq(metadata.benchmark, true), eq(metadata.complexity_tier, "medium"))',

  // Complex tier queries
  complexTier: 'and(eq(metadata.benchmark, true), eq(metadata.complexity_tier, "complex"))',

  // Edge case tests
  edgeCases: 'eq(metadata.is_edge_case, true)',
} as const

/**
 * Get LangSmith project name from environment
 */
export function getLangSmithProject(): string {
  return process.env.LANGSMITH_PROJECT || 'manda-benchmark'
}

/**
 * Generate a LangSmith Studio URL with filters
 *
 * @param filters - Filter criteria
 * @returns LangSmith Studio URL
 */
export function generateLangSmithUrl(filters: LangSmithFilters): string {
  const project = getLangSmithProject()
  const filterClauses: string[] = []

  if (filters.dealId) {
    filterClauses.push(`eq(metadata.deal_id, "${filters.dealId}")`)
  }

  if (filters.validationPhase) {
    filterClauses.push(`eq(metadata.validation_phase, "${filters.validationPhase}")`)
  }

  if (filters.edgeCaseResult) {
    filterClauses.push(`eq(metadata.edge_case_result, "${filters.edgeCaseResult}")`)
  }

  if (filters.runId) {
    filterClauses.push(`eq(metadata.run_id, "${filters.runId}")`)
  }

  if (filters.success !== undefined) {
    filterClauses.push(`eq(outputs.success, ${filters.success})`)
  }

  if (filters.benchmark !== undefined) {
    filterClauses.push(`eq(metadata.benchmark, ${filters.benchmark})`)
  }

  if (filters.retrievalHit !== undefined) {
    filterClauses.push(`eq(metadata.retrieval_hit, ${filters.retrievalHit})`)
  }

  // Build filter string
  let filterString: string
  if (filterClauses.length === 0) {
    filterString = ''
  } else if (filterClauses.length === 1) {
    filterString = filterClauses[0]
  } else {
    filterString = `and(${filterClauses.join(', ')})`
  }

  // Build URL
  const baseUrl = `https://smith.langchain.com/o/anthropic/projects/p/${project}`

  if (filterString) {
    return `${baseUrl}?filter=${encodeURIComponent(filterString)}`
  }

  return baseUrl
}

/**
 * Generate a trace detail URL
 *
 * @param traceId - The trace ID
 * @returns LangSmith trace URL
 */
export function getTraceUrl(traceId: string): string {
  return `https://smith.langchain.com/traces/${traceId}`
}

/**
 * Generate URL with a pre-built filter template
 *
 * @param template - Filter template name
 * @param dealId - Optional deal ID to combine
 * @returns LangSmith Studio URL
 */
export function generateUrlFromTemplate(
  template: keyof typeof LANGSMITH_FILTER_TEMPLATES,
  dealId?: string
): string {
  const project = getLangSmithProject()
  const templateFilter = LANGSMITH_FILTER_TEMPLATES[template]

  let filterString: string
  if (dealId) {
    filterString = `and(eq(metadata.deal_id, "${dealId}"), ${templateFilter})`
  } else {
    filterString = templateFilter
  }

  return `https://smith.langchain.com/o/anthropic/projects/p/${project}?filter=${encodeURIComponent(filterString)}`
}

/**
 * Output formatted LangSmith links section
 *
 * @param dealId - Deal ID for filters
 * @param context - Additional context (validation phase, run ID, etc.)
 */
export function printLangSmithLinks(
  dealId: string,
  context?: {
    validationPhase?: string
    runId?: string
    showEdgeCases?: boolean
    showFailures?: boolean
  }
): void {
  console.log('=== LangSmith Traces ===')
  console.log('')

  // Main filter based on context
  if (context?.validationPhase) {
    console.log(`Validation Phase: ${context.validationPhase}`)
    console.log(
      `  ${generateLangSmithUrl({ dealId, validationPhase: context.validationPhase })}`
    )
    console.log('')
  }

  if (context?.runId) {
    console.log('This Run:')
    console.log(`  ${generateLangSmithUrl({ dealId, runId: context.runId })}`)
    console.log('')
  }

  // Common filters
  console.log('Quick Filters:')
  console.log(`  All traces: ${generateLangSmithUrl({ dealId, benchmark: true })}`)

  if (context?.showFailures) {
    console.log(`  Failed only: ${generateUrlFromTemplate('failedOnly', dealId)}`)
  }

  if (context?.showEdgeCases) {
    console.log(`  Edge cases: ${generateUrlFromTemplate('edgeCases', dealId)}`)
    console.log(`  Hallucinations: ${generateUrlFromTemplate('hallucinations', dealId)}`)
  }

  console.log('')
}

/**
 * Metadata to include in benchmark traces
 */
export interface BenchmarkTraceMetadata {
  benchmark: true
  deal_id: string
  run_id: string
  query_id: string
  expected_complexity: string
  expected_intent: string
  validation_phase?: string
  is_edge_case?: boolean
  edge_case_type?: string
  doc_types_available?: string[]
}

/**
 * Create metadata object for benchmark traces
 */
export function createBenchmarkMetadata(params: {
  dealId: string
  runId: string
  queryId: string
  expectedComplexity: string
  expectedIntent: string
  validationPhase?: string
  isEdgeCase?: boolean
  edgeCaseType?: string
  docTypesAvailable?: string[]
}): BenchmarkTraceMetadata {
  const metadata: BenchmarkTraceMetadata = {
    benchmark: true,
    deal_id: params.dealId,
    run_id: params.runId,
    query_id: params.queryId,
    expected_complexity: params.expectedComplexity,
    expected_intent: params.expectedIntent,
  }

  if (params.validationPhase) {
    metadata.validation_phase = params.validationPhase
  }

  if (params.isEdgeCase) {
    metadata.is_edge_case = true
    metadata.edge_case_type = params.edgeCaseType
  }

  if (params.docTypesAvailable) {
    metadata.doc_types_available = params.docTypesAvailable
  }

  return metadata
}

/**
 * Format a summary line with LangSmith link
 */
export function formatWithTraceLink(
  message: string,
  traceId?: string
): string {
  if (traceId) {
    return `${message}\n   Trace: ${getTraceUrl(traceId)}`
  }
  return message
}
