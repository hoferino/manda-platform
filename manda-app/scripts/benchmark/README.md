# Manda Benchmark Suite

Performance benchmarking suite for the Manda agent system.

## Overview

This suite measures and validates agent performance improvements from the E13 optimization initiative. It tracks:

- **TTFT (Time to First Token):** Latency to first response token
- **Classification Accuracy:** Correct complexity/intent classification
- **Cost:** Per-query API costs
- **Token Usage:** Input/output token counts

## Quick Start

```bash
# Validate configuration
npm run benchmark validate

# Run dry-run (classification only, no API costs)
npm run benchmark run --dry-run

# Run full benchmark suite
npm run benchmark run --output results.json

# Generate Markdown report
npm run benchmark report --input results.json --output report.md

# Compare against baseline
npm run benchmark compare --baseline docs/benchmarks/baseline.json --current results.json
```

## Configuration

### Required Environment Variables

```bash
# API Configuration
MANDA_API_URL=http://localhost:3000    # Base URL for chat API
BENCHMARK_DEAL_ID=uuid                  # Test deal with seeded documents

# Authentication (choose one)
BENCHMARK_AUTH_TOKEN=token              # Pre-configured service token
# OR
BENCHMARK_USER_EMAIL=test@example.com   # Test user email
BENCHMARK_USER_PASSWORD=password        # Test user password

# Supabase (required if using user auth)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

### Optional Environment Variables

```bash
# LangSmith Integration
LANGSMITH_API_KEY=lsv2_pt_xxx
LANGSMITH_ENDPOINT=https://eu.api.smith.langchain.com
LANGSMITH_PROJECT=manda-benchmark
LANGCHAIN_TRACING_V2=true

# Benchmark Options
BENCHMARK_CONVERSATION_ID=uuid          # Reuse specific conversation
NODE_ENV=dev                            # Environment for reporting
```

## CLI Commands

### Run Benchmarks

```bash
npm run benchmark run [options]

Options:
  -t, --tier <tier>       Filter by tier (simple|medium|complex)
  -c, --concurrency <n>   Concurrent queries (default: 3)
  -d, --dry-run           Classification only, no LLM calls
  -o, --output <file>     Output JSON file (default: benchmark-results.json)
  -w, --warm-up           Run warm-up queries before measurement
  --deal-id <id>          Override BENCHMARK_DEAL_ID
  --api-url <url>         Override MANDA_API_URL
```

### Generate Reports

```bash
npm run benchmark report --input results.json --output report.md
```

### Compare Results

```bash
npm run benchmark compare \
  --baseline baseline.json \
  --current results.json \
  --output comparison.md \
  --fail-on-regression
```

### Upload to LangSmith

```bash
npm run benchmark upload --results results.json --dataset my-benchmarks
```

## Query Dataset

The benchmark suite includes 100+ queries across three complexity tiers:

| Tier | Count | Description |
|------|-------|-------------|
| Simple | 42 | Greetings, single-fact lookups, meta questions |
| Medium | 37 | Comparisons, summaries, document references |
| Complex | 27 | Multi-hop analysis, contradictions, financial trends |

Queries are stored in `scripts/benchmark/queries/`:
- `simple.json` - Simple tier queries
- `medium.json` - Medium tier queries
- `complex.json` - Complex tier queries

## Target Metrics

| Tier | TTFT (P95) | Cost (avg) | Input Tokens |
|------|------------|------------|--------------|
| Simple | <500ms | <$0.0001 | <2,000 |
| Medium | <3,000ms | <$0.001 | <4,000 |
| Complex | <15,000ms | <$0.01 | <10,000 |

## CI Integration

The benchmark workflow runs manually via GitHub Actions:

1. Go to Actions → "Performance Benchmark"
2. Click "Run workflow"
3. Select options (tier, dry-run, fail-on-regression)
4. Results are uploaded as artifacts

Required secrets:
- `STAGING_API_URL` - Staging API endpoint
- `BENCHMARK_DEAL_ID` - Test deal UUID
- `BENCHMARK_AUTH_TOKEN` - Service account token
- `LANGSMITH_API_KEY` - LangSmith API key (optional)

## Development

### Adding Queries

1. Edit the appropriate `queries/*.json` file
2. Follow the schema:

```json
{
  "id": "tier-001",
  "query": "Query text here",
  "expectedComplexity": "simple|medium|complex",
  "expectedIntent": "greeting|meta|factual|task",
  "category": "greeting|meta|financial|operational|legal|technical",
  "notes": "Optional notes"
}
```

### Running Tests

```bash
npm run test:run -- __tests__/scripts/benchmark
```

## Troubleshooting

### Authentication Errors

```
Error: Authentication required
```

Check that `BENCHMARK_AUTH_TOKEN` or user credentials are set correctly.

### No Queries Found

```
[runner] Could not load simple.json
```

Ensure you're running from the `manda-app` directory.

### Rate Limiting

```
HTTP 429: Too Many Requests
```

Reduce concurrency with `--concurrency 1` and check API rate limits.
