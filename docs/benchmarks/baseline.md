# Performance Baseline Metrics

## Overview

This document records the baseline performance metrics captured before the E13 agent optimization initiative. These metrics serve as the reference point for measuring improvements.

**Baseline Date:** 2026-01-06
**Source:** LangSmith traces from production usage
**Agent Version:** Pre-E13 (all queries use 18 tools, single model tier)

## Pre-E13 Baseline Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| TTFT (P95) | 19,400ms | Time to first token, all queries |
| Input Tokens (avg) | 8,577 | Includes system prompt + all 18 tools |
| Output Tokens (avg) | ~500 | Varies by query type |
| Cost per Query (avg) | ~$0.001 | Using Claude Sonnet 4 |
| Tool Count | 18 | All tools loaded regardless of query |

## Architecture Before E13

- **Single Model:** All queries routed to Claude Sonnet 4
- **All Tools Always:** 18 tools loaded for every query
- **No Complexity Classification:** No intent-based routing
- **No Tier Optimization:** Same prompt structure for all queries

## E13 Target Metrics

After completing E13.1-E13.9, we target the following performance improvements:

| Tier | TTFT Target | Cost Target | Input Token Target |
|------|-------------|-------------|-------------------|
| Simple | <500ms | <$0.0001 | <2,000 |
| Medium | <3,000ms | <$0.001 | <4,000 |
| Complex | <15,000ms | <$0.01 | <10,000 |

## Expected Improvements

### Simple Queries (40% of traffic)
- **TTFT:** 19.4s → <0.5s (97% reduction)
- **Cost:** $0.001 → $0.0001 (90% reduction)
- **Model:** Claude Sonnet → Gemini 2.0 Flash Lite
- **Tools:** 18 → 0 (direct LLM response)

### Medium Queries (35% of traffic)
- **TTFT:** 19.4s → <3s (85% reduction)
- **Cost:** $0.001 → $0.001 (similar)
- **Model:** Claude Sonnet → Gemini 2.5 Pro
- **Tools:** 18 → 5 (essential tools only)

### Complex Queries (25% of traffic)
- **TTFT:** 19.4s → <15s (23% reduction)
- **Cost:** Similar or higher (acceptable for complex analysis)
- **Model:** Claude Sonnet (maintained)
- **Tools:** 18 → all or specialist routing

## Measurement Methodology

### TTFT (Time to First Token)
- Measured from HTTP request initiation to first SSE token event
- Excludes SSE metadata events (only measures actual content tokens)
- P95 used as primary metric (95th percentile)

### Token Estimation
- Input tokens: `query.length / 4` (characters / 4 approximation)
- Output tokens: `response.length / 4`
- Note: Estimates may vary ±20% from actual usage

### Cost Calculation
- Uses model-specific pricing from `lib/llm/config.ts`
- Formula: `(inputTokens / 1M × inputPrice) + (outputTokens / 1M × outputPrice)`

## Data Collection

To generate updated baseline metrics:

```bash
cd manda-app

# Run full benchmark suite (requires API access)
npm run benchmark run --output baseline-results.json

# Or dry-run for classification accuracy only
npm run benchmark run --dry-run --output classification-results.json
```

## Version History

| Date | Event | Notes |
|------|-------|-------|
| 2026-01-06 | Initial baseline | Pre-E13 metrics from LangSmith |
| (future) | E13.1 complete | After complexity classification |
| (future) | E13.6 complete | After all specialists |
| (future) | E13.7 complete | Automated benchmark validation |
