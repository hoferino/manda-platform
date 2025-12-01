/**
 * Evaluation Harness for LLM Integration Testing
 *
 * Runs the evaluation dataset against the live agent and checks behaviors.
 * Story: E5.2 - Implement LangChain Agent with 11 Chat Tools
 *
 * Per P7 spec:
 * - Budget: 50,000 tokens per test run
 * - Pass Criteria: ≥ 90% of checks pass
 * - When to run: Before releases, after prompt changes
 */

import {
  EVALUATION_DATASET,
  TOKEN_BUDGET,
  PASS_THRESHOLD,
  validateTokenBudget,
  type EvaluationTestCase,
  type BehaviorCheck,
} from './evaluation-dataset'

/**
 * Result of evaluating a single test case
 */
export interface TestCaseResult {
  id: string
  query: string
  intent: string
  response: string
  checks: Array<{
    check: BehaviorCheck
    passed: boolean
    reason?: string
  }>
  passed: boolean
  tokensUsed: number
  latencyMs: number
}

/**
 * Overall evaluation results
 */
export interface EvaluationResults {
  totalCases: number
  passedCases: number
  failedCases: number
  passRate: number
  meetsThreshold: boolean
  totalTokensUsed: number
  withinBudget: boolean
  avgLatencyMs: number
  results: TestCaseResult[]
  failedChecks: Array<{ caseId: string; check: BehaviorCheck; reason: string }>
}

/**
 * Behavior check implementations
 */
const BEHAVIOR_CHECKERS: Record<
  BehaviorCheck,
  (response: string, context?: EvaluationTestCase) => { passed: boolean; reason?: string }
> = {
  single_answer: (response) => {
    // Check that response is concise and provides one main answer
    const lines = response.split('\n').filter((l) => l.trim())
    const isConcise = lines.length <= 5 || response.length < 500
    return {
      passed: isConcise,
      reason: isConcise ? undefined : 'Response too verbose for fact lookup',
    }
  },

  source_cited: (response) => {
    const hasSource = /\(source[s]?:\s*[^)]+\)/i.test(response)
    return {
      passed: hasSource,
      reason: hasSource ? undefined : 'Missing source citation (source: ...)',
    }
  },

  structured_format: (response) => {
    const hasHeaders = /\*\*[^*]+\*\*/g.test(response)
    const hasBullets = /^[\s]*[-•]\s/m.test(response)
    const hasTable = /\|.*\|.*\|/g.test(response)
    const isStructured = hasHeaders || hasBullets || hasTable
    return {
      passed: isStructured,
      reason: isStructured ? undefined : 'Response lacks structure (headers, bullets, or tables)',
    }
  },

  no_confidence_scores: (response) => {
    // Check for raw confidence scores like 0.85, 0.9, etc.
    const hasConfidenceScores = /\b0\.\d{1,2}\b/.test(response)
    return {
      passed: !hasConfidenceScores,
      reason: hasConfidenceScores ? 'Raw confidence scores exposed to user' : undefined,
    }
  },

  no_excessive_meta: (response) => {
    const excessivePhrases = [
      'let me search',
      "i'll look for",
      'searching the knowledge base',
      'let me analyze',
      'i understand you want',
    ]
    const hasExcessiveMeta = excessivePhrases.some((p) =>
      response.toLowerCase().includes(p)
    )
    return {
      passed: !hasExcessiveMeta,
      reason: hasExcessiveMeta ? 'Excessive meta-commentary before answer' : undefined,
    }
  },

  contradictions_surfaced: (response) => {
    const keywords = ['contradiction', 'conflict', 'discrepancy', 'differ', 'inconsisten']
    const mentionsContradictions = keywords.some((k) =>
      response.toLowerCase().includes(k)
    )
    return {
      passed: mentionsContradictions,
      reason: mentionsContradictions ? undefined : 'Did not surface contradictions',
    }
  },

  gaps_noted: (response) => {
    const keywords = ['gap', 'missing', 'not found', "couldn't find", 'no information']
    const mentionsGaps = keywords.some((k) => response.toLowerCase().includes(k))
    return {
      passed: mentionsGaps,
      reason: mentionsGaps ? undefined : 'Did not note information gaps',
    }
  },

  context_maintained: (response, context) => {
    // For multi-turn, check if response references the context period
    if (!context?.context?.previousQuery) return { passed: true }
    const mentionsQ3 = response.toLowerCase().includes('q3')
    const mentions2024 = response.includes('2024')
    const maintainsContext = mentionsQ3 || mentions2024
    return {
      passed: maintainsContext,
      reason: maintainsContext ? undefined : 'Did not maintain temporal context from previous turn',
    }
  },

  explains_uncertainty: (response) => {
    const explanationPhrases = [
      "couldn't find",
      'not covered',
      "don't have",
      'no documents',
      'not included',
      'uploaded documents',
    ]
    const explainsWhy = explanationPhrases.some((p) =>
      response.toLowerCase().includes(p)
    )
    return {
      passed: explainsWhy,
      reason: explainsWhy ? undefined : 'Did not explain why information is missing',
    }
  },

  offers_next_step: (response) => {
    const actionPhrases = [
      'would you like',
      'add to',
      'q&a',
      'follow up',
      'request',
      'shall i',
    ]
    const offersAction = actionPhrases.some((p) =>
      response.toLowerCase().includes(p)
    )
    return {
      passed: offersAction,
      reason: offersAction ? undefined : 'Did not offer next step or follow-up action',
    }
  },

  shows_both_sources: (response) => {
    // Count number of source citations
    const sourceMatches = response.match(/\(source[s]?:\s*[^)]+\)/gi) || []
    const showsBothSides = sourceMatches.length >= 2
    return {
      passed: showsBothSides,
      reason: showsBothSides ? undefined : 'Did not show both sources for conflict',
    }
  },

  overview_provided: (response) => {
    const overviewPhrases = ['overview', 'summary', 'documents uploaded', 'coverage', 'key']
    const hasOverview = overviewPhrases.some((p) =>
      response.toLowerCase().includes(p)
    )
    return {
      passed: hasOverview,
      reason: hasOverview ? undefined : 'Did not provide high-level overview',
    }
  },

  drilldown_offered: (response) => {
    const drilldownPhrases = [
      'would you like to explore',
      'want to know more',
      'drill down',
      'dive deeper',
      'what would you like',
    ]
    const offersDetail = drilldownPhrases.some((p) =>
      response.toLowerCase().includes(p)
    )
    return {
      passed: offersDetail,
      reason: offersDetail ? undefined : 'Did not offer to drill down into details',
    }
  },
}

/**
 * Evaluate a single response against expected behaviors
 */
export function evaluateResponse(
  testCase: EvaluationTestCase,
  response: string,
  tokensUsed: number,
  latencyMs: number
): TestCaseResult {
  const checks = testCase.expectedBehaviors.map((check) => {
    const checker = BEHAVIOR_CHECKERS[check]
    const result = checker(response, testCase)
    return {
      check,
      passed: result.passed,
      reason: result.reason,
    }
  })

  const passed = checks.every((c) => c.passed)

  return {
    id: testCase.id,
    query: testCase.query,
    intent: testCase.intent,
    response,
    checks,
    passed,
    tokensUsed,
    latencyMs,
  }
}

/**
 * Run full evaluation suite
 *
 * @param agentInvoke - Function to invoke the agent (takes query, returns response + tokens)
 */
export async function runEvaluation(
  agentInvoke: (
    query: string,
    context?: { previousQuery?: string; previousResponse?: string }
  ) => Promise<{ response: string; tokensUsed: number }>
): Promise<EvaluationResults> {
  // Validate budget first
  const budgetCheck = validateTokenBudget()
  if (!budgetCheck.valid) {
    console.warn(
      `Warning: Estimated tokens (${budgetCheck.estimated}) exceed budget (${budgetCheck.budget})`
    )
  }

  const results: TestCaseResult[] = []
  let totalTokensUsed = 0

  for (const testCase of EVALUATION_DATASET) {
    // Check if we're over budget
    if (totalTokensUsed >= TOKEN_BUDGET) {
      console.warn(`Token budget exceeded. Stopping at test case ${testCase.id}`)
      break
    }

    const startTime = Date.now()

    try {
      const { response, tokensUsed } = await agentInvoke(
        testCase.query,
        testCase.context
      )

      const latencyMs = Date.now() - startTime
      totalTokensUsed += tokensUsed

      const result = evaluateResponse(testCase, response, tokensUsed, latencyMs)
      results.push(result)

      console.log(
        `[${testCase.id}] ${result.passed ? '✓' : '✗'} ${testCase.query.slice(0, 30)}...`
      )
    } catch (error) {
      console.error(`[${testCase.id}] Error:`, error)
      results.push({
        id: testCase.id,
        query: testCase.query,
        intent: testCase.intent,
        response: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        checks: testCase.expectedBehaviors.map((check) => ({
          check,
          passed: false,
          reason: 'Test case failed to execute',
        })),
        passed: false,
        tokensUsed: 0,
        latencyMs: Date.now() - startTime,
      })
    }
  }

  // Calculate summary
  const passedCases = results.filter((r) => r.passed).length
  const failedCases = results.length - passedCases
  const passRate = results.length > 0 ? passedCases / results.length : 0
  const avgLatencyMs =
    results.length > 0
      ? results.reduce((sum, r) => sum + r.latencyMs, 0) / results.length
      : 0

  // Collect failed checks
  const failedChecks: EvaluationResults['failedChecks'] = []
  for (const result of results) {
    for (const check of result.checks) {
      if (!check.passed) {
        failedChecks.push({
          caseId: result.id,
          check: check.check,
          reason: check.reason || 'Check failed',
        })
      }
    }
  }

  return {
    totalCases: results.length,
    passedCases,
    failedCases,
    passRate,
    meetsThreshold: passRate >= PASS_THRESHOLD,
    totalTokensUsed,
    withinBudget: totalTokensUsed <= TOKEN_BUDGET,
    avgLatencyMs,
    results,
    failedChecks,
  }
}

/**
 * Format evaluation results for display
 */
export function formatEvaluationReport(results: EvaluationResults): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════',
    '           LLM EVALUATION RESULTS',
    '═══════════════════════════════════════════════════════',
    '',
    `Status: ${results.meetsThreshold ? '✓ PASSED' : '✗ FAILED'}`,
    `Pass Rate: ${(results.passRate * 100).toFixed(1)}% (threshold: ${PASS_THRESHOLD * 100}%)`,
    `Cases: ${results.passedCases}/${results.totalCases} passed`,
    `Tokens: ${results.totalTokensUsed}/${TOKEN_BUDGET} (${results.withinBudget ? 'within budget' : 'OVER BUDGET'})`,
    `Avg Latency: ${results.avgLatencyMs.toFixed(0)}ms`,
    '',
    '───────────────────────────────────────────────────────',
    '           TEST CASE RESULTS',
    '───────────────────────────────────────────────────────',
  ]

  for (const result of results.results) {
    lines.push(`${result.passed ? '✓' : '✗'} [${result.id}] ${result.query}`)
    if (!result.passed) {
      for (const check of result.checks.filter((c) => !c.passed)) {
        lines.push(`    └─ ✗ ${check.check}: ${check.reason}`)
      }
    }
  }

  if (results.failedChecks.length > 0) {
    lines.push('')
    lines.push('───────────────────────────────────────────────────────')
    lines.push('           FAILED CHECKS SUMMARY')
    lines.push('───────────────────────────────────────────────────────')

    // Group by check type
    const byCheck = new Map<BehaviorCheck, string[]>()
    for (const fc of results.failedChecks) {
      const existing = byCheck.get(fc.check) || []
      existing.push(fc.caseId)
      byCheck.set(fc.check, existing)
    }

    for (const [check, caseIds] of byCheck) {
      lines.push(`${check}: ${caseIds.join(', ')}`)
    }
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════')

  return lines.join('\n')
}
