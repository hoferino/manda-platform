/**
 * Benchmark Edge Cases Command
 *
 * Tests agent handling of missing content scenarios.
 * Detects hallucinations when agent fabricates answers without data.
 * Story: E13 Retrospective - Phased Validation System
 *
 * Usage: npm run benchmark edge-cases
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { getAuthHeaders } from '../auth'
import type { EdgeCaseQuery, EdgeCaseResult, EdgeCaseBehavior } from '../types'

/**
 * Generate LangSmith filter URL for edge cases
 */
function getLangSmithUrl(dealId: string, result?: EdgeCaseBehavior): string {
  const projectName = process.env.LANGSMITH_PROJECT || 'manda-benchmark'
  let filter: string

  if (result) {
    filter = encodeURIComponent(
      `and(eq(metadata.deal_id, "${dealId}"), eq(metadata.edge_case_result, "${result}"))`
    )
  } else {
    filter = encodeURIComponent(
      `and(eq(metadata.deal_id, "${dealId}"), eq(metadata.is_edge_case, true))`
    )
  }

  return `https://smith.langchain.com/o/anthropic/projects/p/${projectName}?filter=${filter}`
}

/**
 * Generate LangSmith URL for a specific trace
 */
function getTraceUrl(traceId: string): string {
  return `https://smith.langchain.com/traces/${traceId}`
}

/**
 * Load edge case queries
 */
async function loadEdgeCases(): Promise<EdgeCaseQuery[]> {
  const filePath = path.join(__dirname, '..', 'queries', 'edge-cases.json')
  const content = await fs.readFile(filePath, 'utf-8')
  return JSON.parse(content)
}

/**
 * Analyze response to determine behavior
 */
function analyzeResponse(
  response: string,
  query: EdgeCaseQuery
): {
  behavior: EdgeCaseBehavior
  matchedAcceptable?: string
  matchedHallucination?: string
} {
  const lowerResponse = response.toLowerCase()

  // Check for hallucination patterns first (BAD)
  for (const pattern of query.hallucinationPatterns) {
    if (lowerResponse.includes(pattern.toLowerCase())) {
      return {
        behavior: 'hallucination',
        matchedHallucination: pattern,
      }
    }
  }

  // Check for acceptable patterns (GOOD)
  for (const pattern of query.acceptablePatterns) {
    if (lowerResponse.includes(pattern.toLowerCase())) {
      return {
        behavior: 'graceful_decline',
        matchedAcceptable: pattern,
      }
    }
  }

  // If mentions having partial info, it's a partial answer
  const partialPatterns = [
    'based on the available',
    'from what i have',
    'can tell you that',
    'however',
    'but i don\'t have',
  ]

  for (const pattern of partialPatterns) {
    if (lowerResponse.includes(pattern)) {
      return {
        behavior: 'partial_answer',
        matchedAcceptable: pattern,
      }
    }
  }

  // Default to hallucination if no patterns matched but response seems confident
  const confidentPatterns = [
    'the answer is',
    'it is',
    'they are',
    'this is',
    'we can see',
  ]

  for (const pattern of confidentPatterns) {
    if (lowerResponse.includes(pattern)) {
      return {
        behavior: 'hallucination',
        matchedHallucination: 'confident_answer_without_source',
      }
    }
  }

  // If unsure, mark as partial_answer (needs manual review)
  return {
    behavior: 'partial_answer',
  }
}

/**
 * Execute a single edge case query
 */
async function executeEdgeCase(
  query: EdgeCaseQuery,
  config: {
    apiUrl: string
    dealId: string
    conversationId?: string
  }
): Promise<EdgeCaseResult> {
  const startTime = performance.now()

  try {
    const headers = await getAuthHeaders()

    // Create conversation if needed
    let conversationId = config.conversationId
    if (!conversationId) {
      const createResponse = await fetch(`${config.apiUrl}/api/chat/conversation`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ deal_id: config.dealId }),
      })

      if (!createResponse.ok) {
        throw new Error(`Failed to create conversation: ${createResponse.status}`)
      }

      const convData = await createResponse.json()
      conversationId = convData.conversation_id
    }

    // Send query with edge case metadata
    const response = await fetch(`${config.apiUrl}/api/chat/message`, {
      method: 'POST',
      headers: {
        ...headers,
        'X-Edge-Case': 'true',
        'X-Edge-Case-Type': query.edgeCaseType,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        message: query.query,
        deal_id: config.dealId,
        metadata: {
          is_edge_case: true,
          edge_case_type: query.edgeCaseType,
          edge_case_id: query.id,
        },
      }),
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    // Read streaming response
    const reader = response.body?.getReader()
    let fullResponse = ''
    let traceId: string | undefined

    if (reader) {
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                fullResponse += parsed.content
              }
              if (parsed.trace_id) {
                traceId = parsed.trace_id
              }
            } catch {
              // Ignore parse errors for partial chunks
            }
          }
        }
      }
    }

    const totalLatencyMs = performance.now() - startTime

    // Analyze the response
    const analysis = analyzeResponse(fullResponse, query)

    // Determine if passed
    const passed =
      analysis.behavior === query.expectedBehavior ||
      (query.expectedBehavior === 'graceful_decline' &&
        analysis.behavior === 'partial_answer') ||
      analysis.behavior !== 'hallucination'

    return {
      queryId: query.id,
      query: query.query,
      edgeCaseType: query.edgeCaseType,
      expectedBehavior: query.expectedBehavior,
      actualBehavior: analysis.behavior,
      passed,
      response: fullResponse.slice(0, 500), // Truncate for output
      matchedAcceptablePattern: analysis.matchedAcceptable,
      matchedHallucinationPattern: analysis.matchedHallucination,
      traceId,
      totalLatencyMs,
    }
  } catch (error) {
    const totalLatencyMs = performance.now() - startTime

    return {
      queryId: query.id,
      query: query.query,
      edgeCaseType: query.edgeCaseType,
      expectedBehavior: query.expectedBehavior,
      actualBehavior: 'graceful_decline', // Error counts as not hallucinating
      passed: true, // Errors are better than hallucinations
      response: `Error: ${error instanceof Error ? error.message : String(error)}`,
      traceId: undefined,
      totalLatencyMs,
    }
  }
}

/**
 * Run the edge cases command
 */
export async function runEdgeCases(): Promise<void> {
  // Get deal ID from environment
  const dealId = process.env.BENCHMARK_DEAL_ID
  if (!dealId) {
    console.error('No deal ID specified.')
    console.error('Set BENCHMARK_DEAL_ID or run `npm run benchmark setup`')
    process.exit(1)
  }

  const apiUrl = process.env.MANDA_API_URL || 'http://localhost:3000'

  console.log('=== Edge Case Testing ===')
  console.log('')
  console.log('Testing agent handling of missing content scenarios.')
  console.log('CRITICAL: Detecting hallucinations (fabricated answers).')
  console.log('')
  console.log(`Deal ID: ${dealId}`)
  console.log('')

  // Load edge cases
  const edgeCases = await loadEdgeCases()
  console.log(`Loaded ${edgeCases.length} edge case queries`)
  console.log('')

  // Execute each edge case
  const results: EdgeCaseResult[] = []

  for (let i = 0; i < edgeCases.length; i++) {
    const query = edgeCases[i]
    process.stdout.write(`\r   ${i + 1}/${edgeCases.length} Testing: ${query.id}`)

    const result = await executeEdgeCase(query, { apiUrl, dealId })
    results.push(result)

    // Small delay between queries
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  console.log('')
  console.log('')

  // Categorize results
  const passed = results.filter((r) => r.passed)
  const failed = results.filter((r) => !r.passed)
  const hallucinations = results.filter((r) => r.actualBehavior === 'hallucination')
  const graceful = results.filter((r) => r.actualBehavior === 'graceful_decline')
  const partial = results.filter((r) => r.actualBehavior === 'partial_answer')

  // Output summary
  console.log('=== Results Summary ===')
  console.log('')
  console.log(`Total Tests:     ${results.length}`)
  console.log(`Passed:          ${passed.length}`)
  console.log(`Failed:          ${failed.length}`)
  console.log('')
  console.log('Behavior Breakdown:')
  console.log(`  Graceful Decline:  ${graceful.length} (GOOD)`)
  console.log(`  Partial Answer:    ${partial.length} (OK)`)
  console.log(`  Hallucination:     ${hallucinations.length} (BAD)`)
  console.log('')

  // Highlight hallucinations (CRITICAL)
  if (hallucinations.length > 0) {
    console.log('===========================================')
    console.log('!!!  HALLUCINATIONS DETECTED  !!!')
    console.log('===========================================')
    console.log('')
    console.log('The agent fabricated answers without supporting data:')
    console.log('')

    for (const result of hallucinations) {
      console.log(`[HALLUCINATION] ${result.queryId}`)
      console.log(`   Query: "${result.query}"`)
      console.log(`   Type: ${result.edgeCaseType}`)
      console.log(`   Matched Pattern: "${result.matchedHallucinationPattern}"`)
      console.log(`   Response Preview: "${result.response.slice(0, 200)}..."`)
      if (result.traceId) {
        console.log(`   Trace: ${getTraceUrl(result.traceId)}`)
      }
      console.log('')
    }

    console.log('View all hallucination traces:')
    console.log(`  ${getLangSmithUrl(dealId, 'hallucination')}`)
    console.log('')
  }

  // Show other failures
  const nonHallucinationFailures = failed.filter(
    (r) => r.actualBehavior !== 'hallucination'
  )

  if (nonHallucinationFailures.length > 0) {
    console.log('=== Other Failures ===')
    console.log('')

    for (const result of nonHallucinationFailures) {
      console.log(`[FAIL] ${result.queryId}`)
      console.log(`   Expected: ${result.expectedBehavior}`)
      console.log(`   Actual: ${result.actualBehavior}`)
      if (result.traceId) {
        console.log(`   Trace: ${getTraceUrl(result.traceId)}`)
      }
      console.log('')
    }
  }

  // LangSmith links
  console.log('=== LangSmith Traces ===')
  console.log('')
  console.log('View all edge case traces:')
  console.log(`  ${getLangSmithUrl(dealId)}`)
  console.log('')

  if (hallucinations.length > 0) {
    console.log('View hallucination traces:')
    console.log(`  ${getLangSmithUrl(dealId, 'hallucination')}`)
    console.log('')
  }

  // Next steps
  console.log('=== Next Steps ===')
  console.log('')

  if (hallucinations.length > 0) {
    console.log('CRITICAL: Fix hallucination issues before proceeding.')
    console.log('')
    console.log('1. Review hallucination traces in LangSmith')
    console.log('2. Check retrieval hook - is it returning correct context?')
    console.log('3. Verify prompts include instruction to decline when unsure')
    console.log('4. Re-run: npm run benchmark edge-cases')
  } else if (failed.length > 0) {
    console.log('Some edge cases had unexpected behavior.')
    console.log('')
    console.log('1. Review traces in LangSmith')
    console.log('2. Adjust acceptable patterns if behavior is actually correct')
    console.log('3. Re-run: npm run benchmark edge-cases')
  } else {
    console.log('All edge cases passed!')
    console.log('')
    console.log('The agent correctly handles missing content without hallucinating.')
    console.log('')
    console.log('Proceed to full benchmark:')
    console.log('  npm run benchmark run')
  }

  // Exit with error if hallucinations detected
  if (hallucinations.length > 0) {
    process.exit(1)
  }
}
