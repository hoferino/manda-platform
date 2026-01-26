# Story 13.7: Performance Benchmarking Suite

Status: done

## Story

As a **developer maintaining the Manda agent system**,
I want a **comprehensive automated benchmarking suite that measures and validates agent performance improvements**,
so that **I can quantify the impact of E13.1-E13.6 optimizations, detect performance regressions, and ensure TTFT, token usage, and cost targets are met before deployment**.

## Acceptance Criteria

1. **AC1: Create benchmark dataset with 100+ queries across complexity tiers**
   - Minimum 40 simple queries (greetings, single-fact lookups, meta questions)
   - Minimum 35 medium queries (compare, summarize, find all, document references)
   - Minimum 25 complex queries (analyze, contradictions, financial + time ranges, multi-hop)
   - Queries must cover all intent types (greeting, meta, factual, task)
   - Include M&A-specific terminology to test domain understanding

2. **AC2: Implement automated benchmark runner**
   - Execute queries against live agent (dev environment)
   - Support concurrent execution with configurable parallelism (default: 3)
   - Capture per-query metrics: TTFT, total latency, input/output tokens, cost
   - Support dry-run mode (classification only, no LLM calls)
   - Support filtering by complexity tier or query subset

3. **AC3: Measure TTFT, total latency, tokens, cost per query**
   - TTFT: Time from request to first token content (not SSE metadata)
   - Total latency: Full request duration
   - Tokens: Estimate from content length (chars/4) or extract from LangSmith traces
   - Cost: Calculate using `calculateModelCost()` from `lib/llm/config.ts`
   - Record model used, tools loaded, specialist invoked (if any)

4. **AC4: Generate comparison reports (before/after optimization)**
   - JSON output for programmatic consumption
   - Markdown report with summary table and per-tier breakdown
   - Include P50, P95, P99 percentiles for latency metrics
   - Highlight queries that exceed target thresholds
   - Compare against baseline file if provided
   - Track classification accuracy (expected vs actual complexity)

5. **AC5: Integrate with LangSmith for trace collection**
   - Tag traces with `benchmark: true` metadata for filtering
   - Include run ID, complexity tier, query ID in trace metadata
   - Support LangSmith dataset upload for evaluation tracking
   - Link benchmark results to LangSmith trace IDs

6. **AC6: Create CI job for regression detection**
   - GitHub Actions workflow triggered on PR to main
   - Run benchmark suite against staging environment
   - Fail PR if P95 latency exceeds target by >20%
   - Fail PR if cost per query exceeds target by >50%
   - Store results as GitHub Actions artifacts

7. **AC7: Document baseline metrics and targets**
   - Record pre-E13 baseline metrics from LangSmith traces
   - Document target metrics per complexity tier
   - Include measurement methodology and caveats
   - Update after each E13 story completion

## Tasks / Subtasks

- [x] **Task 1: Install required dependencies** (AC: #2, #4, #5)
  - [x] Verify/install `commander` for CLI (`npm install -D commander`)
  - [x] Verify/install `simple-statistics` for percentiles (`npm install -D simple-statistics`)
  - [x] Verify/install `p-limit` for concurrency (`npm install -D p-limit`)
  - [x] Verify/install `langsmith` for trace SDK (`npm install -D langsmith`)
  - [x] Add `@types/simple-statistics` if needed (not needed - has built-in types)

- [x] **Task 2: Create benchmark query dataset** (AC: #1)
  - [x] Create `manda-app/scripts/benchmark/queries/simple.json` (42 queries)
  - [x] Create `manda-app/scripts/benchmark/queries/medium.json` (37 queries)
  - [x] Create `manda-app/scripts/benchmark/queries/complex.json` (27 queries)
  - [x] Include expected complexity classification for each query
  - [x] Include expected intent classification for each query
  - [x] Add query categories: greeting, meta, financial, operational, legal, technical

- [x] **Task 3: Create test data setup script** (AC: #2)
  - [x] Create `manda-app/scripts/benchmark/setup-test-data.ts`
  - [x] Create or identify test deal with seeded documents
  - [x] Create test conversation for benchmark runs
  - [x] Document test data requirements in README
  - [x] Add cleanup script for test artifacts

- [x] **Task 4: Implement benchmark runner core** (AC: #2, #3)
  - [x] Create `manda-app/scripts/benchmark/runner.ts`
  - [x] Implement `BenchmarkRunner` class with query execution
  - [x] Implement authentication handling (service token or test user)
  - [x] Support SSE streaming to capture TTFT (first token content, not metadata)
  - [x] Implement concurrent execution with p-limit (default: 3, 100ms batch delay)
  - [x] Add progress reporting to stdout
  - [x] Support `--dry-run` flag using direct `classifyIntentAsync()` call
  - [x] Implement retry logic (1 retry on failure, then skip and log)
  - [x] Add optional warm-up phase (3 queries before measurement)

- [x] **Task 5: Implement metrics collection** (AC: #3)
  - [x] Create `manda-app/scripts/benchmark/metrics.ts`
  - [x] Implement TTFT measurement (time to first `event: token` SSE event)
  - [x] Implement total latency measurement
  - [x] Estimate token counts from content length (chars / 4)
  - [x] Calculate cost using `calculateModelCost()` from `lib/llm/config.ts`
  - [x] Record model used and tools loaded from agent response
  - [x] Track classification accuracy (expected vs classified complexity)

- [x] **Task 6: Implement report generator** (AC: #4)
  - [x] Create `manda-app/scripts/benchmark/report-generator.ts`
  - [x] Generate JSON output with all metrics
  - [x] Generate Markdown report with summary tables
  - [x] Calculate P50, P95, P99 percentiles using `simple-statistics`
  - [x] Include classification accuracy percentage per tier
  - [x] Highlight failures (queries exceeding targets)
  - [x] Support baseline comparison mode
  - [x] Add ASCII histogram for TTFT distribution (optional)

- [x] **Task 7: Integrate with LangSmith** (AC: #5)
  - [x] Add benchmark metadata to agent invocations
  - [x] Create `manda-app/scripts/benchmark/langsmith.ts` for trace tagging
  - [x] Implement trace ID extraction from responses (if available)
  - [x] Support dataset upload for long-term evaluation tracking
  - [x] Document LangSmith filtering for benchmark traces

- [x] **Task 8: Create CLI interface** (AC: #2, #4)
  - [x] Create `manda-app/scripts/benchmark/cli.ts` with Commander.js
  - [x] Support commands: `run`, `report`, `compare`, `upload`, `validate`
  - [x] Support flags: `--tier`, `--concurrency`, `--dry-run`, `--output`, `--warm-up`
  - [x] Add `npm run benchmark` script to package.json
  - [x] Document usage in script header comments

- [x] **Task 9: Create CI workflow** (AC: #6)
  - [x] Create `.github/workflows/benchmark.yml`
  - [x] Run on PR to main (optional, manual trigger for cost control)
  - [x] Execute against staging environment
  - [x] Compare against baseline and fail on regression
  - [x] Upload results as GitHub Actions artifacts
  - [x] Post summary comment on PR

- [x] **Task 10: Document baseline and targets** (AC: #7)
  - [x] Create `docs/benchmarks/baseline.md` with pre-E13 metrics
  - [x] Document target metrics per complexity tier
  - [x] Include measurement methodology
  - [x] Add instructions for running benchmarks locally
  - [x] Create `docs/benchmarks/baseline.json` for programmatic comparison

- [x] **Task 11: Write unit tests** (AC: #2, #3, #4)
  - [x] Create `manda-app/__tests__/scripts/benchmark/metrics.test.ts`
  - [x] Create `manda-app/__tests__/scripts/benchmark/report-generator.test.ts`
  - [x] Test metrics calculation (TTFT, cost, percentiles)
  - [x] Test report generation (JSON, Markdown)
  - [x] Test baseline comparison logic
  - [x] Test classification accuracy calculation
  - [x] 40 unit tests (exceeds minimum of 30)

## Dev Notes

### Target Metrics (from E13 Epic)

| Metric | Simple | Medium | Complex |
|--------|--------|--------|---------|
| TTFT (P95) | <500ms | <3,000ms | <15,000ms |
| Cost (USD) | <$0.0001 | <$0.001 | <$0.01 |
| Input Tokens | <2,000 | <4,000 | <10,000 |

### Baseline Metrics (Pre-E13, from LangSmith 2026-01-06)

| Metric | All Queries |
|--------|-------------|
| TTFT (P95) | 19,400ms |
| Input Tokens | 8,577 |
| Cost (USD) | ~$0.001 |

### Required Environment Variables

```bash
# API Configuration
MANDA_API_URL=http://localhost:3000          # Base URL for chat API
BENCHMARK_DEAL_ID=uuid-of-test-deal          # Test deal with seeded docs
BENCHMARK_CONVERSATION_ID=uuid-or-new        # Reuse or create per run

# Authentication (choose one)
BENCHMARK_AUTH_TOKEN=supabase-access-token   # Service account token
# OR use SUPABASE_* vars for test user login

# LangSmith (optional but recommended)
LANGSMITH_API_KEY=lsv2_pt_xxx
LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com
LANGSMITH_PROJECT=manda-benchmark

# Tracing
LANGCHAIN_TRACING_V2=true
```

### Project Structure

```
manda-app/scripts/benchmark/
├── cli.ts                    # CLI entry point
├── runner.ts                 # BenchmarkRunner class
├── metrics.ts                # Metrics collection utilities
├── report-generator.ts       # Report generation (JSON, Markdown)
├── langsmith.ts              # LangSmith integration
├── auth.ts                   # Authentication helpers
├── types.ts                  # TypeScript interfaces
├── setup-test-data.ts        # Test data creation
├── queries/
│   ├── simple.json           # 40+ simple queries
│   ├── medium.json           # 35+ medium queries
│   └── complex.json          # 25+ complex queries
└── README.md                 # Usage documentation

docs/benchmarks/
├── baseline.md               # Pre-E13 baseline metrics
├── methodology.md            # Measurement methodology
└── results/                  # Historical results for trends
```

### Query Dataset Schema

```typescript
// scripts/benchmark/types.ts
import type { ComplexityLevel, IntentType } from '@/lib/agent/intent'

interface BenchmarkQuery {
  id: string                              // e.g., "simple-001"
  query: string                           // The actual query text
  expectedComplexity: ComplexityLevel     // Reuse existing type
  expectedIntent: IntentType              // Reuse existing type
  category: 'greeting' | 'meta' | 'financial' | 'operational' | 'legal' | 'technical'
  expectedToolCount?: number              // Based on complexity tier
  notes?: string
}

interface BenchmarkResult {
  queryId: string
  query: string
  expectedComplexity: ComplexityLevel
  classifiedComplexity: ComplexityLevel   // What the system classified
  classificationCorrect: boolean          // expectedComplexity === classifiedComplexity
  expectedIntent: IntentType
  classifiedIntent: IntentType
  intentCorrect: boolean
  model: string
  toolsLoaded: number
  specialistUsed?: string
  ttftMs: number
  totalLatencyMs: number
  inputTokens: number                     // Estimated: chars / 4
  outputTokens: number                    // Estimated: chars / 4
  costUsd: number
  traceId?: string
  success: boolean
  error?: string
}

interface TierMetrics {
  queryCount: number
  successCount: number
  classificationAccuracy: number          // 0-1
  ttft: { p50: number; p95: number; p99: number }
  latency: { p50: number; p95: number; p99: number }
  cost: { total: number; average: number }
  tokens: { avgInput: number; avgOutput: number }
}

interface BenchmarkReport {
  runId: string
  timestamp: string
  environment: string
  totalQueries: number
  successCount: number
  failureCount: number
  overallClassificationAccuracy: number
  byTier: Record<ComplexityLevel, TierMetrics>
  targetComparison: {
    tier: ComplexityLevel
    metric: string
    target: number
    actual: number
    passed: boolean
  }[]
  failures: BenchmarkResult[]
}
```

### CLI Usage Examples

```bash
# Install dependencies first
cd manda-app
npm install -D commander simple-statistics p-limit langsmith

# Run full benchmark suite
npm run benchmark run

# Run only simple tier queries
npm run benchmark run --tier simple

# Run with warm-up phase (3 queries before measurement)
npm run benchmark run --warm-up

# Dry run (classification only, no LLM calls)
npm run benchmark run --dry-run

# Custom concurrency (default: 3)
npm run benchmark run --concurrency 5

# Generate report from existing results
npm run benchmark report --input results.json --output report.md

# Compare against baseline
npm run benchmark compare --baseline docs/benchmarks/baseline.json --current results.json

# Upload results to LangSmith dataset
npm run benchmark upload --results results.json --dataset manda-benchmarks

# Setup test data
npm run benchmark setup
```

### Authentication Handling

```typescript
// scripts/benchmark/auth.ts
import { createClient } from '@supabase/supabase-js'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  // Option 1: Pre-configured service token
  const token = process.env.BENCHMARK_AUTH_TOKEN
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  }

  // Option 2: Login as test user
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.BENCHMARK_USER_EMAIL!,
    password: process.env.BENCHMARK_USER_PASSWORD!,
  })

  if (error) throw new Error(`Auth failed: ${error.message}`)

  return {
    'Authorization': `Bearer ${data.session.access_token}`,
    'Content-Type': 'application/json',
  }
}
```

### SSE TTFT Measurement

TTFT is measured as time to first **token content**, not metadata:

```typescript
// runner.ts
async function measureQuery(query: BenchmarkQuery): Promise<BenchmarkResult> {
  const startTime = performance.now()
  let ttftMs = 0
  let fullOutput = ''
  let model = ''
  let toolsLoaded = 0

  const headers = await getAuthHeaders()
  const response = await fetch(
    `${process.env.MANDA_API_URL}/api/projects/${dealId}/chat`,
    {
      method: 'POST',
      headers: { ...headers, 'Accept': 'text/event-stream' },
      body: JSON.stringify({
        message: query.query,
        conversationId: process.env.BENCHMARK_CONVERSATION_ID,
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${await response.text()}`)
  }

  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let firstToken = true

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value)
    const lines = chunk.split('\n')

    for (const line of lines) {
      if (line.startsWith('event: token')) {
        // Next data line contains the token
        continue
      }
      if (line.startsWith('data: ') && firstToken) {
        const data = line.slice(6)
        // Skip metadata events, only measure actual tokens
        if (!data.startsWith('{')) {
          ttftMs = performance.now() - startTime
          firstToken = false
        }
      }
      // Accumulate output and extract metadata...
    }
  }

  const totalLatencyMs = performance.now() - startTime

  // Token estimation (actual counts not in response)
  const inputTokens = Math.ceil(query.query.length / 4)
  const outputTokens = Math.ceil(fullOutput.length / 4)

  return {
    queryId: query.id,
    query: query.query,
    expectedComplexity: query.expectedComplexity,
    classifiedComplexity: /* from response metadata */ 'medium',
    classificationCorrect: query.expectedComplexity === 'medium',
    ttftMs,
    totalLatencyMs,
    inputTokens,
    outputTokens,
    costUsd: calculateModelCost(model, inputTokens, outputTokens),
    model,
    toolsLoaded,
    success: true,
  }
}
```

### Dry-Run Mode (Classification Only)

```typescript
// runner.ts
import { classifyIntentAsync } from '@/lib/agent/intent'

async function dryRunQuery(query: BenchmarkQuery): Promise<BenchmarkResult> {
  const startTime = performance.now()

  // Direct classification without LLM call
  const result = await classifyIntentAsync(query.query)

  return {
    queryId: query.id,
    query: query.query,
    expectedComplexity: query.expectedComplexity,
    classifiedComplexity: result.complexity!,
    classificationCorrect: query.expectedComplexity === result.complexity,
    expectedIntent: query.expectedIntent,
    classifiedIntent: result.intent,
    intentCorrect: query.expectedIntent === result.intent,
    ttftMs: 0,
    totalLatencyMs: performance.now() - startTime,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    model: 'dry-run',
    toolsLoaded: result.suggestedTools?.length ?? 0,
    success: true,
  }
}
```

### Rate Limiting Configuration

```typescript
// runner.ts
import pLimit from 'p-limit'

const DEFAULT_CONCURRENCY = 3
const BATCH_DELAY_MS = 100  // Delay between batches to avoid 429s

export class BenchmarkRunner {
  private limit: pLimit.Limit

  constructor(concurrency = DEFAULT_CONCURRENCY) {
    this.limit = pLimit(concurrency)
  }

  async runAll(queries: BenchmarkQuery[]): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = []

    // Process in batches with delay
    for (let i = 0; i < queries.length; i += this.limit.concurrency) {
      const batch = queries.slice(i, i + this.limit.concurrency)
      const batchResults = await Promise.all(
        batch.map(q => this.limit(() => this.runWithRetry(q)))
      )
      results.push(...batchResults)

      // Delay between batches
      if (i + this.limit.concurrency < queries.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS))
      }
    }

    return results
  }

  private async runWithRetry(query: BenchmarkQuery): Promise<BenchmarkResult> {
    try {
      return await measureQuery(query)
    } catch (error) {
      // One retry
      try {
        await new Promise(r => setTimeout(r, 1000))
        return await measureQuery(query)
      } catch (retryError) {
        // Log and return failure result
        console.error(`Query ${query.id} failed after retry:`, retryError)
        return {
          queryId: query.id,
          query: query.query,
          expectedComplexity: query.expectedComplexity,
          classifiedComplexity: 'medium',
          classificationCorrect: false,
          ttftMs: 0,
          totalLatencyMs: 0,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          model: 'unknown',
          toolsLoaded: 0,
          success: false,
          error: String(retryError),
        }
      }
    }
  }
}
```

### CI Workflow

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmark

on:
  workflow_dispatch:
    inputs:
      tier:
        description: 'Complexity tier to benchmark (simple|medium|complex|all)'
        required: false
        default: 'all'
      dry_run:
        description: 'Dry run (classification only)'
        required: false
        default: 'false'

jobs:
  benchmark:
    runs-on: ubuntu-latest
    environment: staging
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: manda-app/package-lock.json

      - name: Install dependencies
        working-directory: manda-app
        run: npm ci

      - name: Run benchmarks
        working-directory: manda-app
        env:
          MANDA_API_URL: ${{ secrets.STAGING_API_URL }}
          BENCHMARK_DEAL_ID: ${{ secrets.BENCHMARK_DEAL_ID }}
          BENCHMARK_AUTH_TOKEN: ${{ secrets.BENCHMARK_AUTH_TOKEN }}
          LANGSMITH_API_KEY: ${{ secrets.LANGSMITH_API_KEY }}
          LANGSMITH_ENDPOINT: https://eu.api.smith.langchain.com
          LANGSMITH_PROJECT: manda-benchmark
          LANGCHAIN_TRACING_V2: 'true'
        run: |
          npm run benchmark run \
            --tier ${{ inputs.tier }} \
            --output results.json \
            ${{ inputs.dry_run == 'true' && '--dry-run' || '' }}

      - name: Generate report
        working-directory: manda-app
        run: npm run benchmark report --input results.json --output report.md

      - name: Check against targets
        working-directory: manda-app
        run: |
          npm run benchmark compare \
            --baseline docs/benchmarks/baseline.json \
            --current results.json \
            --fail-on-regression

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: benchmark-results-${{ github.run_id }}
          path: |
            manda-app/results.json
            manda-app/report.md
          retention-days: 30

      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs')
            const report = fs.readFileSync('manda-app/report.md', 'utf8')
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Benchmark Results\n\n${report}`
            })
```

### Anti-Patterns to Avoid

1. **DO NOT** run benchmarks against production - use staging or dev environment
2. **DO NOT** run in CI on every commit - manual trigger only due to API costs
3. **DO NOT** hardcode API URLs or credentials - use environment variables
4. **DO NOT** skip LangSmith tracing - traces are essential for debugging
5. **DO NOT** ignore classification accuracy - misclassification defeats the optimization
6. **DO NOT** compare results from different environments without noting the difference
7. **DO NOT** assume token counts are exact - they're estimates (chars/4)
8. **DO NOT** run concurrent queries without rate limiting (100ms delay, max 3 concurrent)
9. **DO NOT** measure TTFT on SSE metadata events - wait for actual token content
10. **DO NOT** skip authentication - API requires valid Supabase session

### References

- [Source: manda-app/lib/agent/intent.ts] - `classifyIntentAsync()`, `ComplexityLevel`, `IntentType`
- [Source: manda-app/lib/agent/executor.ts] - Agent execution with complexity routing
- [Source: manda-app/lib/llm/config.ts] - `calculateModelCost()`, `getTokenCosts()`
- [Source: manda-app/lib/llm/routing.ts] - Model routing based on complexity
- [Source: manda-app/app/api/projects/[id]/chat/route.ts] - Chat API endpoint
- [Source: docs/sprint-artifacts/epics/epic-E13.md#E13.7] - Epic requirements
- [Source: docs/sprint-artifacts/stories/e13-6-knowledge-graph-specialist.md] - Previous story pattern
- [External: https://docs.smith.langchain.com/] - LangSmith documentation
- [External: https://github.com/sindresorhus/p-limit] - p-limit concurrency

### Previous Story Learnings

**From E13.6 (Knowledge Graph Specialist):**
- Pattern: Comprehensive unit tests (49+) ensure quality
- Lesson: Test data should cover edge cases specific to the feature
- Lesson: TypeScript strict mode catches many issues early

**From E13.1-E13.4 (Optimization Foundation):**
- Baseline: 19.4s TTFT, 8,577 input tokens before optimization
- Baseline: All 18 tools loaded regardless of query complexity
- Pattern: Complexity classification uses patterns + word count fallback
- Pattern: Tool tier selection logged for LangSmith traces
- Key types: `ComplexityLevel`, `IntentType` from `lib/agent/intent.ts`

**From E12.11 (LangSmith Observability):**
- Pattern: Set `LANGSMITH_TRACING=true` for automatic trace collection
- Pattern: Use `LANGCHAIN_CALLBACKS_BACKGROUND=true` for non-blocking traces
- Pattern: EU endpoint: `https://eu.api.smith.langchain.com`
- Lesson: Trace metadata is key for filtering benchmark runs

## Dev Agent Record

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

- Fixed `TARGET_METRICS` import in report-generator.ts (was imported as type, needed as value)
- Fixed test assertion for `formatCost(0.001)` - implementation uses `.toFixed(6)` for values < 0.01

### Code Review Fixes (2026-01-07)

**Critical issues fixed:**
1. `runner.ts:17` - Fixed `DEFAULT_CONFIG` import (was imported as type, used as value causing ReferenceError)
2. `runner.ts:9` - Removed unused/invalid `import { v4 as uuidv4 } from 'crypto'`
3. Created missing `setup-test-data.ts` file
4. `langsmith.ts:168` - Fixed `uploadReport()` to actually call `uploadToDataset()`
5. `cli.ts:217` - Fixed upload command to handle both results arrays and reports
6. Created `runner.test.ts` with 12 tests for BenchmarkRunner class
7. Created `auth.test.ts` with 9 tests for authentication module
8. Created `langsmith.test.ts` with 7 tests for LangSmith integration
9. Created `cli.test.ts` with 18 tests for CLI configuration

### Completion Notes List

1. All 11 tasks completed successfully
2. 106 benchmark queries created (42 simple, 37 medium, 27 complex)
3. 86 unit tests written and passing (exceeds 30 minimum)
4. Pre-existing test failures (36) are unrelated to benchmark suite - IRL templates, agent-tools, etc.
5. `simple-statistics` has built-in TypeScript types, no separate `@types/` package needed

### File List

**New Files Created:**
- `manda-app/scripts/benchmark/types.ts` - TypeScript interfaces and target metrics
- `manda-app/scripts/benchmark/auth.ts` - Authentication helpers
- `manda-app/scripts/benchmark/metrics.ts` - Metrics collection utilities
- `manda-app/scripts/benchmark/runner.ts` - BenchmarkRunner class
- `manda-app/scripts/benchmark/report-generator.ts` - Report generation
- `manda-app/scripts/benchmark/langsmith.ts` - LangSmith integration
- `manda-app/scripts/benchmark/cli.ts` - CLI interface with Commander.js
- `manda-app/scripts/benchmark/setup-test-data.ts` - Test data setup and cleanup
- `manda-app/scripts/benchmark/queries/simple.json` - 42 simple queries
- `manda-app/scripts/benchmark/queries/medium.json` - 37 medium queries
- `manda-app/scripts/benchmark/queries/complex.json` - 27 complex queries
- `manda-app/scripts/benchmark/README.md` - Usage documentation
- `.github/workflows/benchmark.yml` - CI workflow
- `docs/benchmarks/baseline.md` - Baseline metrics documentation
- `docs/benchmarks/baseline.json` - Baseline JSON for comparison
- `manda-app/__tests__/scripts/benchmark/metrics.test.ts` - 22 tests
- `manda-app/__tests__/scripts/benchmark/report-generator.test.ts` - 18 tests
- `manda-app/__tests__/scripts/benchmark/runner.test.ts` - 12 tests
- `manda-app/__tests__/scripts/benchmark/auth.test.ts` - 9 tests
- `manda-app/__tests__/scripts/benchmark/langsmith.test.ts` - 7 tests
- `manda-app/__tests__/scripts/benchmark/cli.test.ts` - 18 tests

**Modified Files:**
- `manda-app/package.json` - Added benchmark npm script and dev dependencies
- `manda-app/package-lock.json` - Updated lockfile with new dependencies

