#!/usr/bin/env npx tsx
/**
 * Benchmark CLI
 *
 * Command-line interface for the performance benchmarking suite.
 * Story: E13.7 - Performance Benchmarking Suite (AC: #2, #4)
 * Extended: E13 Retrospective - Phased Validation System
 *
 * Usage:
 *   npm run benchmark setup                    # Create test deal
 *   npm run benchmark inspect                  # View knowledge graph entities
 *   npm run benchmark validate <doc-type>      # Validate specific document type
 *   npm run benchmark edge-cases               # Test missing content handling
 *   npm run benchmark run [options]            # Full benchmark suite
 *   npm run benchmark report --input results.json --output report.md
 *   npm run benchmark compare --baseline baseline.json --current results.json
 *   npm run benchmark upload --results results.json --dataset my-dataset
 */

import { Command } from 'commander'
import * as fs from 'fs/promises'
import * as path from 'path'
import { BenchmarkRunner, loadQueries, generateRunId } from './runner'
import { generateReport, generateMarkdownReport, compareReports, generateComparisonMarkdown } from './report-generator'
import { uploadToDataset, isLangSmithConfigured } from './langsmith'
import { validateAuthConfig } from './auth'
import { runSetup, listDeals } from './commands/setup'
import { runInspect } from './commands/inspect'
import { runValidate, showValidationStatus } from './commands/validate'
import { runEdgeCases } from './commands/edge-cases'
import type { BenchmarkConfig, BenchmarkReport, BenchmarkResult } from './types'
import type { ComplexityLevel } from '@/lib/agent/intent'

const program = new Command()

program
  .name('benchmark')
  .description('Manda Performance Benchmarking Suite')
  .version('1.0.0')

/**
 * Run benchmark command
 */
program
  .command('run')
  .description('Execute benchmark queries and collect metrics')
  .option('-t, --tier <tier>', 'Filter by complexity tier (simple|medium|complex)', '')
  .option('-c, --concurrency <n>', 'Number of concurrent queries', '3')
  .option('-d, --dry-run', 'Classification only, no LLM calls', false)
  .option('-o, --output <file>', 'Output file for results JSON', 'benchmark-results.json')
  .option('-w, --warm-up', 'Run warm-up queries before benchmark', false)
  .option('--deal-id <id>', 'Deal ID for queries (or set BENCHMARK_DEAL_ID)')
  .option('--api-url <url>', 'API base URL (or set MANDA_API_URL)')
  .action(async (options) => {
    console.log('🚀 Starting Manda Benchmark Suite')
    console.log('')

    // Validate configuration
    const apiUrl = options.apiUrl || process.env.MANDA_API_URL || 'http://localhost:3000'
    const dealId = options.dealId || process.env.BENCHMARK_DEAL_ID

    if (!dealId) {
      console.error('❌ Error: Deal ID required. Set --deal-id or BENCHMARK_DEAL_ID')
      process.exit(1)
    }

    if (!options.dryRun) {
      const authValidation = validateAuthConfig()
      if (!authValidation.valid) {
        console.error('❌ Authentication configuration errors:')
        authValidation.errors.forEach((e) => console.error(`   - ${e}`))
        process.exit(1)
      }
    }

    // Parse tiers
    const tiers: ComplexityLevel[] = options.tier
      ? options.tier.split(',').map((t: string) => t.trim() as ComplexityLevel)
      : []

    // Build config
    const config: BenchmarkConfig = {
      apiUrl,
      dealId,
      conversationId: process.env.BENCHMARK_CONVERSATION_ID,
      concurrency: parseInt(options.concurrency, 10),
      batchDelayMs: 100,
      dryRun: options.dryRun,
      tiers,
      warmUpQueries: options.warmUp ? 3 : 0,
      environment: process.env.NODE_ENV || 'dev',
    }

    console.log('📋 Configuration:')
    console.log(`   API URL: ${config.apiUrl}`)
    console.log(`   Deal ID: ${config.dealId}`)
    console.log(`   Concurrency: ${config.concurrency}`)
    console.log(`   Dry Run: ${config.dryRun}`)
    console.log(`   Tiers: ${config.tiers.length > 0 ? config.tiers.join(', ') : 'all'}`)
    console.log(`   Warm-up: ${config.warmUpQueries > 0 ? 'yes' : 'no'}`)
    console.log('')

    // Load queries
    const queriesDir = path.join(__dirname, 'queries')
    const queries = await loadQueries(queriesDir)
    console.log(`📊 Loaded ${queries.length} queries`)

    // Run benchmark
    const runId = generateRunId()
    const startTime = performance.now()

    const runner = new BenchmarkRunner(config)
    const results = await runner.runAll(queries, (completed, total, result) => {
      const status = result.success ? '✅' : '❌'
      const ttft = result.ttftMs > 0 ? `${result.ttftMs.toFixed(0)}ms` : 'N/A'
      process.stdout.write(`\r   Progress: ${completed}/${total} ${status} ${result.queryId} (TTFT: ${ttft})`)
    })

    const totalDurationMs = performance.now() - startTime
    console.log('')
    console.log('')

    // Generate report
    const report = generateReport(results, runId, config.environment, totalDurationMs)

    // Save results
    await fs.writeFile(options.output, JSON.stringify(report, null, 2))
    console.log(`💾 Results saved to ${options.output}`)

    // Print summary
    console.log('')
    console.log('📈 Summary:')
    console.log(`   Total Queries: ${report.totalQueries}`)
    console.log(`   Successful: ${report.successCount}`)
    console.log(`   Failed: ${report.failureCount}`)
    console.log(`   Classification Accuracy: ${(report.overallClassificationAccuracy * 100).toFixed(1)}%`)
    console.log(`   Total Cost: $${report.totalCostUsd.toFixed(6)}`)
    console.log(`   Duration: ${(totalDurationMs / 1000).toFixed(1)}s`)

    // Target comparison
    const passedTargets = report.targetComparisons.filter((t) => t.passed).length
    const totalTargets = report.targetComparisons.length
    console.log('')
    console.log(`🎯 Targets: ${passedTargets}/${totalTargets} met`)

    if (report.failureCount > 0) {
      console.log('')
      console.log('⚠️  Some queries failed. Check the results file for details.')
    }
  })

/**
 * Report command
 */
program
  .command('report')
  .description('Generate Markdown report from results JSON')
  .requiredOption('-i, --input <file>', 'Input results JSON file')
  .option('-o, --output <file>', 'Output Markdown file', 'benchmark-report.md')
  .action(async (options) => {
    console.log(`📄 Generating report from ${options.input}`)

    const content = await fs.readFile(options.input, 'utf-8')
    const report: BenchmarkReport = JSON.parse(content)

    const markdown = generateMarkdownReport(report)
    await fs.writeFile(options.output, markdown)

    console.log(`✅ Report saved to ${options.output}`)
  })

/**
 * Compare command
 */
program
  .command('compare')
  .description('Compare baseline and current benchmark results')
  .requiredOption('-b, --baseline <file>', 'Baseline results JSON file')
  .requiredOption('-c, --current <file>', 'Current results JSON file')
  .option('-o, --output <file>', 'Output comparison Markdown file')
  .option('--fail-on-regression', 'Exit with error code if regression detected', false)
  .action(async (options) => {
    console.log('🔍 Comparing benchmark results')
    console.log(`   Baseline: ${options.baseline}`)
    console.log(`   Current: ${options.current}`)

    const baselineContent = await fs.readFile(options.baseline, 'utf-8')
    const currentContent = await fs.readFile(options.current, 'utf-8')

    const baseline: BenchmarkReport = JSON.parse(baselineContent)
    const current: BenchmarkReport = JSON.parse(currentContent)

    const comparison = compareReports(baseline, current)

    console.log('')
    console.log(comparison.summary)
    console.log('')

    if (comparison.improved.length > 0) {
      console.log('✅ Improvements:')
      comparison.improved.forEach((i) => console.log(`   - ${i}`))
    }

    if (comparison.regressed.length > 0) {
      console.log('❌ Regressions:')
      comparison.regressed.forEach((r) => console.log(`   - ${r}`))
    }

    if (options.output) {
      const markdown = generateComparisonMarkdown(comparison, baseline, current)
      await fs.writeFile(options.output, markdown)
      console.log('')
      console.log(`💾 Comparison saved to ${options.output}`)
    }

    if (options.failOnRegression && comparison.regressed.length > 0) {
      console.log('')
      console.log('❌ Exiting with error due to regressions')
      process.exit(1)
    }
  })

/**
 * Upload command
 */
program
  .command('upload')
  .description('Upload benchmark results to LangSmith dataset')
  .requiredOption('-r, --results <file>', 'Results JSON file to upload')
  .option('-d, --dataset <name>', 'Dataset name', 'manda-benchmarks')
  .action(async (options) => {
    if (!isLangSmithConfigured()) {
      console.error('❌ LangSmith is not configured. Set LANGSMITH_API_KEY.')
      process.exit(1)
    }

    console.log(`📤 Uploading results to LangSmith dataset: ${options.dataset}`)

    const content = await fs.readFile(options.results, 'utf-8')
    const data = JSON.parse(content)

    // Check if this is a report (has byTier) or raw results (array)
    if (Array.isArray(data)) {
      // Raw results array
      const results: BenchmarkResult[] = data
      const { datasetId, exampleCount } = await uploadToDataset(results, options.dataset)
      console.log('')
      console.log(`✅ Uploaded ${exampleCount} examples to dataset ${options.dataset}`)
      console.log(`   Dataset ID: ${datasetId}`)
    } else if (data.byTier) {
      // This is a report - we can still upload the failures
      const report: BenchmarkReport = data
      if (report.failures.length > 0) {
        const { datasetId, exampleCount } = await uploadToDataset(
          report.failures,
          `${options.dataset}-failures`
        )
        console.log('')
        console.log(`✅ Uploaded ${exampleCount} failed queries to dataset ${options.dataset}-failures`)
        console.log(`   Dataset ID: ${datasetId}`)
      } else {
        console.log('ℹ️  Report has no failures to upload.')
        console.log('   For full results, save raw results with: npm run benchmark run --output raw-results.json')
      }
    } else {
      console.error('❌ Unrecognized file format. Expected results array or benchmark report.')
      process.exit(1)
    }
  })

/**
 * Check config command (validates environment and configuration)
 */
program
  .command('check-config')
  .description('Validate benchmark configuration and environment')
  .action(async () => {
    console.log('Validating benchmark configuration')
    console.log('')

    // Check API URL
    const apiUrl = process.env.MANDA_API_URL || 'http://localhost:3000'
    console.log(`API URL: ${apiUrl}`)

    // Check Deal ID
    const dealId = process.env.BENCHMARK_DEAL_ID
    if (dealId) {
      console.log(`Deal ID: ${dealId} [OK]`)
    } else {
      console.log('Deal ID: Not set [WARN]')
    }

    // Check authentication
    const authValidation = validateAuthConfig()
    if (authValidation.valid) {
      console.log('Authentication: Configured [OK]')
    } else {
      console.log('Authentication: Issues found [WARN]')
      authValidation.errors.forEach((e) => console.log(`   - ${e}`))
    }

    // Check LangSmith
    if (isLangSmithConfigured()) {
      console.log('LangSmith: Configured [OK]')
    } else {
      console.log('LangSmith: Not configured (optional)')
    }

    // Load and validate queries
    const queriesDir = path.join(__dirname, 'queries')
    try {
      const queries = await loadQueries(queriesDir)
      console.log(`Queries: ${queries.length} loaded [OK]`)

      const simple = queries.filter((q) => q.expectedComplexity === 'simple').length
      const medium = queries.filter((q) => q.expectedComplexity === 'medium').length
      const complex = queries.filter((q) => q.expectedComplexity === 'complex').length

      console.log(`   Simple: ${simple}`)
      console.log(`   Medium: ${medium}`)
      console.log(`   Complex: ${complex}`)
    } catch (error) {
      console.log(`Queries: Failed to load [ERROR]`)
      console.log(`   ${error}`)
    }
  })

/**
 * Setup command - create test deal for benchmark
 */
program
  .command('setup')
  .description('Create test deal for benchmark validation')
  .option('--list', 'List existing deals instead of creating new one')
  .action(async (options) => {
    if (options.list) {
      await listDeals()
    } else {
      await runSetup()
    }
  })

/**
 * Inspect command - view knowledge graph entities
 */
program
  .command('inspect')
  .description('Inspect knowledge graph entities for a deal')
  .option('--deal-id <id>', 'Deal ID (or set BENCHMARK_DEAL_ID)')
  .action(async (options) => {
    await runInspect(options.dealId)
  })

/**
 * Validate command - run queries for specific document type
 */
program
  .command('validate [docType]')
  .description('Run validation queries for a document type (cim|financials|legal|operational|any)')
  .action(async (docType) => {
    if (!docType) {
      await showValidationStatus()
    } else {
      await runValidate(docType)
    }
  })

/**
 * Edge cases command - test missing content handling
 */
program
  .command('edge-cases')
  .description('Test agent handling of missing content (hallucination detection)')
  .action(async () => {
    await runEdgeCases()
  })

program.parse()
