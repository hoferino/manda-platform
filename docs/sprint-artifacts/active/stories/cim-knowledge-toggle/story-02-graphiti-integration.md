# Story 2: Graphiti Integration

**File:** `manda-app/lib/agent/cim-mvp/graphiti-knowledge.ts`
**Estimate:** Medium
**Dependencies:** Story 1 (Knowledge Service Abstraction)

---

## Overview

Implement the Graphiti backend for the Knowledge Service, allowing CIM to retrieve knowledge from Neo4j instead of the JSON file. This reuses the existing `callGraphitiSearch` infrastructure from Agent v2.

## Problem Statement

The CIM MVP uses a static JSON knowledge file which:
- Only works for the test company
- Doesn't reflect actual uploaded documents
- Has no multi-tenant isolation

We need to connect CIM's `knowledge_search` tool to the same Graphiti infrastructure that Agent v2 chat uses.

## Reference Implementation

The Agent v2 retrieval node (`lib/agent/v2/nodes/retrieval.ts`) shows the pattern:

```typescript
import { callGraphitiSearch, type SearchMethod } from '@/lib/agent/retrieval'

const result = await callGraphitiSearch(query, dealId, searchMethod)
// Returns: { results: HybridSearchResult[], entities: string[], latency_ms: number }
```

## Tasks

- [x] 2.1 Create `graphiti-knowledge.ts` file
- [x] 2.2 Implement `searchGraphiti(query, dealId, options)` function
- [x] 2.3 Transform Graphiti results to `KnowledgeSearchResult[]` format
- [x] 2.4 Implement `getSectionGraphiti(sectionPath, dealId)` using section-aware queries
- [x] 2.5 Implement `getMetadataGraphiti(dealId)` to fetch deal knowledge stats
- [x] 2.6 Add section-to-query mapping for CIM sections (financial, market, etc.)
- [x] 2.7 Wire Graphiti functions into `KnowledgeService` class
- [x] 2.8 Add error handling with graceful degradation
- [x] 2.9 Add latency logging matching v2 patterns
- [x] 2.10 Run `npm run type-check` - must pass

## Completion Notes

**Completed:** 2026-01-15
**Status:** Done

### Implementation Summary
- Created `lib/agent/cim-mvp/graphiti-knowledge.ts` with:
  - `SECTION_QUERIES` mapping for 20+ CIM section paths to optimized search queries
  - `searchGraphiti()` using shared `callGraphitiSearch` from `retrieval.ts`
  - `getSectionGraphiti()` with section-aware query generation
  - `getMetadataGraphiti()` with company name extraction from results
  - `getDataSummaryGraphiti()` for formatted summary output
  - `extractCompanyName()` helper with regex pattern matching
- Wired into `KnowledgeService` via dynamic imports to avoid circular dependencies
- Updated `lib/agent/cim-mvp/index.ts` to export Graphiti functions

### Code Review Fixes Applied
- **CRITICAL FIX:** Now imports shared `callGraphitiSearch` from `@/lib/agent/retrieval` instead of duplicating
- Exported `HybridSearchResult`, `HybridSearchResponse`, `SearchMethod` types from retrieval.ts
- Added `numResults` parameter to shared `callGraphitiSearch` function
- Removed duplicate latency logging (now handled by shared function)
- Added `id` field to `HybridSearchResult.citation` interface

## Implementation

```typescript
// graphiti-knowledge.ts

import { callGraphitiSearch, type SearchMethod } from '@/lib/agent/retrieval'
import type { KnowledgeSearchResult, KnowledgeSearchOptions, KnowledgeMetadata } from './knowledge-service'

// =============================================================================
// Section Query Mapping
// =============================================================================

/**
 * Maps CIM section paths to Graphiti search queries.
 * These queries are optimized for retrieving section-specific information.
 */
const SECTION_QUERIES: Record<string, string> = {
  'financial_performance': 'revenue profit EBITDA margins growth financial metrics',
  'financial_performance.revenue': 'revenue sales ARR MRR recurring revenue',
  'financial_performance.profitability': 'profit margin EBITDA net income gross margin',
  'company_overview': 'company history founding team headquarters employees',
  'company_overview.business_model': 'business model revenue streams pricing customers',
  'market_analysis': 'market size TAM SAM competition industry trends',
  'market_analysis.competitive_landscape': 'competitors competitive advantage differentiation',
  'growth_strategy': 'growth expansion strategy roadmap plans',
  'risk_factors': 'risks challenges concerns threats weaknesses',
}

/**
 * Get search query for a CIM section path.
 * Falls back to the section path itself if no mapping exists.
 */
function getSectionQuery(sectionPath: string): string {
  return SECTION_QUERIES[sectionPath] || sectionPath.replace(/_/g, ' ')
}

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Search Graphiti knowledge graph for CIM content.
 * Uses hybrid search (vector + BM25 + graph) for comprehensive results.
 */
export async function searchGraphiti(
  query: string,
  dealId: string,
  options?: KnowledgeSearchOptions
): Promise<KnowledgeSearchResult[]> {
  const startTime = performance.now()

  try {
    // Use hybrid search for best results
    const searchMethod: SearchMethod = 'hybrid'
    const result = await callGraphitiSearch(query, dealId, searchMethod)

    const latencyMs = Math.round(performance.now() - startTime)
    console.log(`[graphiti-knowledge] search query="${query.slice(0, 50)}" dealId=${dealId} latency=${latencyMs}ms results=${result?.results?.length ?? 0}`)

    if (!result?.results?.length) {
      return []
    }

    // Transform to KnowledgeSearchResult format
    const limit = options?.limit ?? 10
    return result.results.slice(0, limit).map((r) => ({
      content: r.content,
      source: r.citation?.title || 'Unknown source',
      relevance: r.score,
      metadata: {
        documentId: r.citation?.id,
        page: r.citation?.page,
        type: r.citation?.type,
      },
    }))
  } catch (error) {
    console.error('[graphiti-knowledge] Search failed:', error)
    return []
  }
}

/**
 * Get findings for a specific CIM section from Graphiti.
 * Constructs a section-aware query to retrieve relevant content.
 */
export async function getSectionGraphiti(
  sectionPath: string,
  dealId: string
): Promise<KnowledgeSearchResult[]> {
  const query = getSectionQuery(sectionPath)
  return searchGraphiti(query, dealId, { limit: 15 })
}

/**
 * Get metadata about deal knowledge in Graphiti.
 * Used to populate company name, document count, data sufficiency.
 */
export async function getMetadataGraphiti(
  dealId: string
): Promise<KnowledgeMetadata> {
  try {
    // Query for basic company info
    const companyResults = await searchGraphiti('company name', dealId, { limit: 1 })

    // Query to get a sense of data coverage
    const financialResults = await searchGraphiti('revenue EBITDA financial', dealId, { limit: 5 })
    const marketResults = await searchGraphiti('market competition industry', dealId, { limit: 5 })
    const overviewResults = await searchGraphiti('company history team', dealId, { limit: 5 })

    // Calculate data sufficiency score based on coverage
    const totalFindings = financialResults.length + marketResults.length + overviewResults.length
    const dataSufficiencyScore = Math.min(100, Math.round((totalFindings / 15) * 100))

    // Extract company name from results if possible
    const companyName = extractCompanyName(companyResults) || 'Unknown Company'

    return {
      companyName,
      documentCount: totalFindings, // Approximation
      dataSufficiencyScore,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error('[graphiti-knowledge] getMetadata failed:', error)
    return {
      companyName: 'Unknown Company',
      documentCount: 0,
      dataSufficiencyScore: 0,
    }
  }
}

/**
 * Try to extract company name from search results.
 */
function extractCompanyName(results: KnowledgeSearchResult[]): string | null {
  if (!results.length) return null

  // Look for company name patterns in content
  const content = results[0].content
  const patterns = [
    /(?:company|firm|organization|business)\s+(?:called|named|known as)\s+["']?([A-Z][A-Za-z0-9\s&]+?)["']?[,.\s]/i,
    /^([A-Z][A-Za-z0-9\s&]+?)\s+(?:is|was|has been)/i,
  ]

  for (const pattern of patterns) {
    const match = content.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return null
}
```

## Wire into KnowledgeService

Update `knowledge-service.ts` to use Graphiti functions:

```typescript
// In KnowledgeService class

private async searchGraphiti(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
  const { dealId } = this.config
  if (!dealId) {
    throw new Error('dealId required for Graphiti mode')
  }
  return searchGraphiti(query, dealId, options)
}

private async getSectionGraphiti(sectionPath: string): Promise<KnowledgeSearchResult[]> {
  const { dealId } = this.config
  if (!dealId) {
    throw new Error('dealId required for Graphiti mode')
  }
  return getSectionGraphiti(sectionPath, dealId)
}

private async getMetadataGraphiti(): Promise<KnowledgeMetadata> {
  const { dealId } = this.config
  if (!dealId) {
    throw new Error('dealId required for Graphiti mode')
  }
  return getMetadataGraphiti(dealId)
}
```

## Acceptance Criteria

1. `searchGraphiti()` returns results in `KnowledgeSearchResult[]` format
2. `getSectionGraphiti()` uses section-aware queries for relevant content
3. `getMetadataGraphiti()` returns company name and data sufficiency score
4. Error handling returns empty results (graceful degradation)
5. Latency logged with ms timing
6. `KnowledgeService` routes to Graphiti when `mode === 'graphiti'`
7. `npm run type-check` passes

## Testing Notes

Integration tests should verify:
- Graphiti search returns expected format
- Section queries retrieve relevant content
- Metadata calculation produces reasonable scores
- Graceful degradation when Graphiti unavailable

**Note:** Full testing requires a deal with indexed documents in Graphiti.

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/agent/cim-mvp/graphiti-knowledge.ts` | CREATE - Graphiti backend |
| `lib/agent/cim-mvp/knowledge-service.ts` | MODIFY - Wire Graphiti methods |
| `lib/agent/cim-mvp/index.ts` | MODIFY - Export Graphiti functions |

## Reference

- `lib/agent/retrieval.ts:319-347` - `callGraphitiSearch` function
- `lib/agent/v2/nodes/retrieval.ts` - v2 retrieval patterns
- `lib/agent/cim-mvp/knowledge-loader.ts` - JSON loader interface to match
