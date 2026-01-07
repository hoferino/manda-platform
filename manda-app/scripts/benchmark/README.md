# Manda Benchmark Suite

Performance benchmarking and validation suite for the Manda agent system.

## Overview

This suite provides two modes of operation:

1. **Phased Validation** - Incrementally validate agent behavior as documents are uploaded
2. **Full Benchmark** - Run 106 queries to measure performance metrics

### Key Features

- **Document-type filtering** - Validate queries per document type (CIM, financials, legal, operational)
- **Hallucination detection** - Test agent behavior when required documents are missing
- **LangSmith integration** - Trace every query with filterable metadata
- **Performance metrics** - TTFT, classification accuracy, cost, token usage

---

## Phased Validation (Recommended)

Use this workflow when setting up benchmark testing with real documents.

### Quick Start

```bash
# 1. Create a test deal
npm run benchmark setup

# 2. Load configuration
source .env.benchmark

# 3. Upload CIM document via UI, then inspect
npm run benchmark inspect

# 4. Validate CIM queries
npm run benchmark validate cim

# 5. Test edge cases (hallucination detection)
npm run benchmark edge-cases

# 6. Repeat for each document type
npm run benchmark validate financials
npm run benchmark validate legal
npm run benchmark validate operational

# 7. Run full benchmark
npm run benchmark run
```

### Document Upload Order

| Order | Document Type | Examples | Expected Entities |
|-------|--------------|----------|-------------------|
| 1 | CIM | Company Overview.pdf, Management Presentation.pptx | Company, Person, Finding |
| 2 | Financials | Financial Model.xlsx, Audited Financials.pdf | FinancialMetric, Company |
| 3 | Legal | Cap Table.xlsx, Shareholder Agreement.pdf | Company, Person, Risk |
| 4 | Operational | Org Chart.pdf, Tech Stack.docx | Person, Company, Finding |

### After Each Upload

1. Wait for document processing (check status in UI)
2. `npm run benchmark inspect` - Verify entity extraction
3. `npm run benchmark validate <type>` - Test queries for that doc type
4. `npm run benchmark edge-cases` - Check for hallucinations
5. Proceed to next document

---

## Commands Reference

### `npm run benchmark setup`

Creates a test deal and generates configuration.

```bash
npm run benchmark setup          # Create new deal
npm run benchmark setup --list   # List existing deals
```

**Output:** `.env.benchmark` with `BENCHMARK_DEAL_ID`

---

### `npm run benchmark inspect`

Shows knowledge graph entities for the deal.

```bash
npm run benchmark inspect
npm run benchmark inspect --deal-id <uuid>
```

**Output:**
```
Entity Counts:
   Companies:         3
   People:            12
   Financial Metrics: 8

Validation Status:
[x] CIM - Ready
    Run: npm run benchmark validate cim
[ ] Financials - Not detected
    Upload: Financial Model.xlsx
```

---

### `npm run benchmark validate <doc-type>`

Runs queries that require a specific document type.

```bash
npm run benchmark validate cim
npm run benchmark validate financials
npm run benchmark validate legal
npm run benchmark validate operational
npm run benchmark validate any        # Greetings, meta queries
npm run benchmark validate            # Show status for all types
```

**Output:**
```
=== CIM Validation ===
Testing 23 queries requiring cim content

Results: 21/23 passed (91.3%)

Failures:
  [FAIL] simple-011 "What is the company name?"
     Trace: https://smith.langchain.com/traces/xyz-789

View all traces:
  https://smith.langchain.com/...?filter=eq(metadata.validation_phase,"cim")
```

---

### `npm run benchmark edge-cases`

Tests agent handling of missing content. **Critical for detecting hallucinations.**

```bash
npm run benchmark edge-cases
```

**Edge case types:**
| Type | Description | Expected |
|------|-------------|----------|
| `missing_doc_type` | Query requires doc not uploaded | Graceful decline |
| `future_data` | Query asks about period not in docs | Graceful decline |
| `wrong_entity` | Query mentions entity not in docs | Graceful decline |
| `cross_doc_dependency` | Query requires multiple doc types | Partial answer |

**Output:**
```
===========================================
!!!  HALLUCINATIONS DETECTED  !!!
===========================================

[HALLUCINATION] edge-001
   Query: "What were the Q4 2024 financial results?"
   Matched Pattern: "revenue was"
   Trace: https://smith.langchain.com/traces/abc-123
```

---

### `npm run benchmark run`

Executes the full 106-query benchmark.

```bash
npm run benchmark run                        # Full benchmark
npm run benchmark run --tier simple          # Only simple queries
npm run benchmark run --dry-run              # Classification only
npm run benchmark run -o results.json        # Custom output file
npm run benchmark run --concurrency 1        # Sequential execution
```

---

### `npm run benchmark check-config`

Validates environment configuration.

---

### `npm run benchmark report`

Generates Markdown report from results.

```bash
npm run benchmark report -i results.json -o report.md
```

---

### `npm run benchmark compare`

Compares two benchmark runs.

```bash
npm run benchmark compare \
  --baseline baseline.json \
  --current results.json \
  --fail-on-regression
```

---

### `npm run benchmark upload`

Uploads results to LangSmith dataset.

```bash
npm run benchmark upload -r results.json -d manda-benchmarks
```

---

## Configuration

### Required Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Benchmark user (for authentication)
BENCHMARK_USER_EMAIL=test@example.com
BENCHMARK_USER_PASSWORD=...

# Generated by `npm run benchmark setup`
BENCHMARK_DEAL_ID=uuid-of-test-deal
```

### Optional Environment Variables

```bash
MANDA_API_URL=http://localhost:3000     # Default API URL
BENCHMARK_CONVERSATION_ID=uuid          # Reuse conversation
LANGSMITH_API_KEY=ls_...                # For trace upload
LANGSMITH_PROJECT=manda-benchmark       # Project name
```

---

## Query Dataset

| Tier | Count | Description |
|------|-------|-------------|
| Simple | 42 | Greetings, single-fact lookups, meta questions |
| Medium | 37 | Comparisons, summaries, document references |
| Complex | 27 | Multi-hop analysis, contradictions, financial trends |
| Edge Cases | 10 | Missing content, hallucination detection |

---

## Target Metrics

| Tier | TTFT (P95) | Cost (avg) | Input Tokens |
|------|------------|------------|--------------|
| Simple | <500ms | <$0.0001 | <2,000 |
| Medium | <3,000ms | <$0.001 | <4,000 |
| Complex | <15,000ms | <$0.01 | <10,000 |

---

## LangSmith Integration

Every query is traced with metadata for filtering:

| Metadata | Description |
|----------|-------------|
| `benchmark` | Always `true` for benchmark queries |
| `deal_id` | The benchmark deal UUID |
| `validation_phase` | Document type being validated |
| `is_edge_case` | Whether it's an edge case test |
| `edge_case_result` | graceful_decline / partial_answer / hallucination |

### Useful Filters

```
# All benchmark traces
eq(metadata.benchmark, true)

# Failed queries
and(eq(metadata.benchmark, true), eq(outputs.success, false))

# Hallucinations (CRITICAL)
eq(metadata.edge_case_result, "hallucination")

# Specific validation phase
eq(metadata.validation_phase, "cim")

# Retrieval failures
and(eq(metadata.benchmark, true), eq(metadata.retrieval_hit, false))
```

---

## File Structure

```
scripts/benchmark/
├── cli.ts                 # Command-line interface
├── README.md              # This file
├── types.ts               # TypeScript interfaces
├── runner.ts              # Query execution engine
├── auth.ts                # Authentication helpers
├── doc-mapping.ts         # Query-to-document mapping
├── neo4j-inspect.ts       # Knowledge graph inspection
├── langsmith.ts           # LangSmith integration
├── langsmith-utils.ts     # URL/filter helpers
├── report-generator.ts    # Markdown reports
├── metrics.ts             # Cost calculations
├── commands/
│   ├── setup.ts           # setup command
│   ├── inspect.ts         # inspect command
│   ├── validate.ts        # validate command
│   └── edge-cases.ts      # edge-cases command
└── queries/
    ├── simple.json        # 42 simple queries
    ├── medium.json        # 37 medium queries
    ├── complex.json       # 27 complex queries
    └── edge-cases.json    # 10 edge case queries
```

---

## Troubleshooting

### "No deal ID specified"
Run `npm run benchmark setup` or set `BENCHMARK_DEAL_ID`.

### "No knowledge graph data found"
Documents haven't been processed. Check document status in the UI.

### "Authentication failed"
Verify `BENCHMARK_USER_EMAIL` and `BENCHMARK_USER_PASSWORD`.

### Hallucinations detected
1. Review traces in LangSmith
2. Check retrieval hook - is context being returned?
3. Verify prompts instruct agent to decline when unsure

### High failure rate
1. Verify documents were fully processed
2. Check `npm run benchmark inspect` for entities
3. Review LangSmith traces for retrieval issues

### Rate limiting (HTTP 429)
Reduce concurrency: `npm run benchmark run --concurrency 1`
