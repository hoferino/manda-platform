/**
 * Benchmark Validate Command
 *
 * Runs queries for a specific document type to validate extraction.
 * Story: E13 Retrospective - Phased Validation System
 *
 * Usage: npm run benchmark validate <doc-type>
 * Example: npm run benchmark validate cim
 */

import * as path from 'path'
import { BenchmarkRunner, loadQueries, generateRunId } from '../runner'
import { getQueriesForDocType, getPhaseInfo, DOCUMENT_TYPE_INFO } from '../doc-mapping'
import { getAuthHeaders } from '../auth'
import type { BenchmarkConfig, BenchmarkQuery, BenchmarkResult, DocumentType } from '../types'

/**
 * Generate LangSmith filter URL for validation phase
 */
function getLangSmithUrl(dealId: string, phase: string): string {
  const projectName = process.env.LANGSMITH_PROJECT || 'manda-benchmark'
  const filter = encodeURIComponent(
    `and(eq(metadata.deal_id, "${dealId}"), eq(metadata.validation_phase, "${phase}"))`
  )
  return `https://smith.langchain.com/o/anthropic/projects/p/${projectName}?filter=${filter}`
}

/**
 * Generate LangSmith URL for a specific trace
 */
function getTraceUrl(traceId: string): string {
  return `https://smith.langchain.com/traces/${traceId}`
}

/**
 * Run the validate command
 */
export async function runValidate(docType: string): Promise<void> {
  // Validate doc type
  const validDocTypes: DocumentType[] = ['cim', 'financials', 'legal', 'operational', 'any']
  if (!validDocTypes.includes(docType as DocumentType)) {
    console.error(`Invalid document type: ${docType}`)
    console.error(`Valid types: ${validDocTypes.join(', ')}`)
    process.exit(1)
  }

  const targetDocType = docType as DocumentType

  // Get deal ID from environment
  const dealId = process.env.BENCHMARK_DEAL_ID
  if (!dealId) {
    console.error('No deal ID specified.')
    console.error('Set BENCHMARK_DEAL_ID or run `npm run benchmark setup`')
    process.exit(1)
  }

  // Load all queries
  const queriesDir = path.join(__dirname, '..', 'queries')
  const allQueries = await loadQueries(queriesDir)

  // Filter queries for this doc type
  const queries = getQueriesForDocType(allQueries, targetDocType)

  if (queries.length === 0) {
    console.error(`No queries found for document type: ${targetDocType}`)
    console.error('Queries may not have requiredDocTypes tags yet.')
    process.exit(1)
  }

  // Get phase info for output
  const phaseInfo = getPhaseInfo(targetDocType, queries.length)

  console.log(`=== ${phaseInfo.title} ===`)
  console.log('')
  console.log(phaseInfo.description)
  console.log(`Deal ID: ${dealId}`)
  console.log('')

  // Build config
  const apiUrl = process.env.MANDA_API_URL || 'http://localhost:3000'
  const config: BenchmarkConfig = {
    apiUrl,
    dealId,
    conversationId: process.env.BENCHMARK_CONVERSATION_ID,
    concurrency: 2, // Lower concurrency for validation
    batchDelayMs: 200,
    dryRun: false,
    tiers: [],
    warmUpQueries: 0,
    environment: process.env.NODE_ENV || 'dev',
  }

  console.log('Running validation queries...')
  console.log('')

  // Run benchmark
  const runId = generateRunId()
  const startTime = performance.now()

  const runner = new BenchmarkRunner(config)

  // Add validation_phase to metadata for each query
  const taggedQueries = queries.map((q) => ({
    ...q,
    metadata: {
      validation_phase: targetDocType,
      run_id: runId,
    },
  }))

  const results = await runner.runAll(taggedQueries as BenchmarkQuery[], (completed, total, result) => {
    const status = result.success ? 'PASS' : 'FAIL'
    const icon = result.success ? '[PASS]' : '[FAIL]'
    process.stdout.write(`\r   ${completed}/${total} ${icon} ${result.queryId}`)
  })

  const totalDurationMs = performance.now() - startTime
  console.log('')
  console.log('')

  // Calculate results
  const passed = results.filter((r) => r.success)
  const failed = results.filter((r) => !r.success)
  const accuracy = results.length > 0 ? (passed.length / results.length) * 100 : 0

  // Output summary
  console.log('=== Results ===')
  console.log('')
  console.log(`Passed: ${passed.length}/${results.length} (${accuracy.toFixed(1)}%)`)
  console.log(`Duration: ${(totalDurationMs / 1000).toFixed(1)}s`)
  console.log('')

  // Show failures
  if (failed.length > 0) {
    console.log('=== Failures ===')
    console.log('')

    for (const result of failed) {
      console.log(`[FAIL] ${result.queryId}`)
      console.log(`   Query: "${result.query}"`)
      if (result.error) {
        console.log(`   Error: ${result.error}`)
      }
      if (result.traceId) {
        console.log(`   Trace: ${getTraceUrl(result.traceId)}`)
      }
      console.log('')
    }
  }

  // Classification accuracy
  const classificationCorrect = results.filter((r) => r.classificationCorrect).length
  const intentCorrect = results.filter((r) => r.intentCorrect).length

  console.log('=== Classification Accuracy ===')
  console.log('')
  console.log(`Complexity: ${classificationCorrect}/${results.length} (${((classificationCorrect / results.length) * 100).toFixed(1)}%)`)
  console.log(`Intent: ${intentCorrect}/${results.length} (${((intentCorrect / results.length) * 100).toFixed(1)}%)`)
  console.log('')

  // LangSmith link
  console.log('=== LangSmith Traces ===')
  console.log('')
  console.log('View all traces for this validation:')
  console.log(`  ${getLangSmithUrl(dealId, targetDocType)}`)
  console.log('')

  // Next steps
  console.log('=== Next Steps ===')
  console.log('')

  if (failed.length > 0) {
    console.log('1. Review failed traces in LangSmith')
    console.log('2. Check if documents were processed correctly')
    console.log('3. Re-run validation: npm run benchmark validate ' + targetDocType)
  } else {
    // Suggest next doc type
    const allDocTypes: Array<Exclude<DocumentType, 'any'>> = [
      'cim',
      'financials',
      'legal',
      'operational',
    ]
    const currentIndex = allDocTypes.indexOf(targetDocType as Exclude<DocumentType, 'any'>)
    const nextDocType = currentIndex < allDocTypes.length - 1 ? allDocTypes[currentIndex + 1] : null

    console.log(`Validation complete for ${targetDocType}!`)
    console.log('')

    if (nextDocType) {
      console.log('Continue with next document type:')
      console.log(`  1. Upload: ${DOCUMENT_TYPE_INFO[nextDocType].examples[0]}`)
      console.log(`  2. Verify: npm run benchmark inspect`)
      console.log(`  3. Validate: npm run benchmark validate ${nextDocType}`)
    } else {
      console.log('All document types validated!')
      console.log('')
      console.log('1. Test edge cases: npm run benchmark edge-cases')
      console.log('2. Run full benchmark: npm run benchmark run')
    }
  }

  // Exit with error if failures
  if (failed.length > 0) {
    process.exit(1)
  }
}

/**
 * Show validation status for all doc types
 */
export async function showValidationStatus(): Promise<void> {
  const queriesDir = path.join(__dirname, '..', 'queries')
  const allQueries = await loadQueries(queriesDir)

  console.log('=== Validation Status ===')
  console.log('')

  const docTypes: Array<Exclude<DocumentType, 'any'>> = [
    'cim',
    'financials',
    'legal',
    'operational',
  ]

  for (const docType of docTypes) {
    const queries = getQueriesForDocType(allQueries, docType)
    const info = DOCUMENT_TYPE_INFO[docType]

    console.log(`${info.name} (${docType})`)
    console.log(`  Queries: ${queries.length}`)
    console.log(`  Run: npm run benchmark validate ${docType}`)
    console.log('')
  }

  // Also show 'any' queries (greetings, meta)
  const anyQueries = getQueriesForDocType(allQueries, 'any')
  console.log(`Base Queries (any)`)
  console.log(`  Queries: ${anyQueries.length}`)
  console.log(`  Run: npm run benchmark validate any`)
  console.log('')

  console.log(`Total: ${allQueries.length} queries`)
}
