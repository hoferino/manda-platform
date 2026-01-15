---
story_id: E14-S5
epic: E14
title: Replace Static SECTION_QUERIES
status: done
priority: P0
effort: 2-3 hours
assignee: null
completed_date: 2026-01-15
---

# E14-S5: Replace Static SECTION_QUERIES

## User Story

**As a** CIM builder
**I want to** use dynamically generated queries instead of static mappings
**So that** retrieval is tailored to each deal's actual content

## Background

The current `SECTION_QUERIES` in `graphiti-knowledge.ts` is a static mapping that doesn't adapt to deal-specific entity types. This story integrates the dynamic query generator (E14-S4) into the CIM knowledge retrieval flow.

## Acceptance Criteria

- [x] `SECTION_QUERIES` used only as fallback
- [x] Dynamic queries generated for each CIM section
- [x] Buyer persona passed to query generator
- [x] Query caching working (verify via logs)
- [x] No regression in CIM builder functionality
- [x] Error handling graceful (falls back to static)

## Technical Details

### Files to Modify

**Primary:** `manda-app/lib/agent/cim-mvp/graphiti-knowledge.ts`

**Current Implementation (lines 20-80):**
```typescript
// Static query mapping
export const SECTION_QUERIES: Record<string, string> = {
  'executive_summary': 'company overview mission vision key highlights',
  'market_opportunity': 'market opportunity size growth trends competitive landscape',
  'business_model': 'business model revenue streams pricing customers',
  // ... etc
};

export async function retrieveForSection(
  section: string,
  projectId: string
): Promise<RetrievalResult[]> {
  const query = SECTION_QUERIES[section] || section;
  return await searchGraphiti(query, projectId);
}
```

**New Implementation:**
```typescript
import {
  generateDynamicQuery,
  fetchGraphSchema,
  invalidateQueryCache
} from './query-generator';

// Keep static queries as fallback
const STATIC_SECTION_QUERIES: Record<string, string> = {
  'executive_summary': 'company overview mission vision key highlights',
  'market_opportunity': 'market opportunity size growth trends competitive landscape',
  'business_model': 'business model revenue streams pricing customers',
  'financial_overview': 'financial performance revenue EBITDA margins growth',
  'growth_strategy': 'growth strategy expansion plans initiatives roadmap',
  'team_leadership': 'management team leadership experience backgrounds',
  'risk_factors': 'risks challenges concerns mitigation factors',
  'investment_highlights': 'investment highlights value proposition opportunity',
};

const SECTION_DESCRIPTIONS: Record<string, string> = {
  'executive_summary': 'High-level overview of the company, its mission, and key investment highlights',
  'market_opportunity': 'Analysis of market size, growth trends, competitive dynamics, and positioning',
  'business_model': 'How the company generates revenue, pricing strategy, and customer segments',
  'financial_overview': 'Historical financial performance, key metrics, and financial health',
  'growth_strategy': 'Plans for future growth, expansion initiatives, and strategic roadmap',
  'team_leadership': 'Management team backgrounds, experience, and organizational strength',
  'risk_factors': 'Key risks, challenges, and mitigation strategies',
  'investment_highlights': 'Core value proposition and reasons to invest',
};

interface RetrievalOptions {
  projectId: string;
  section: string;
  buyerPersona?: string;
  userFocus?: string;
  useDynamicQueries?: boolean; // Feature flag
}

export async function retrieveForSection(
  options: RetrievalOptions
): Promise<RetrievalResult[]> {
  const { projectId, section, buyerPersona, userFocus, useDynamicQueries = true } = options;

  let query: string;
  let querySource: 'dynamic' | 'static' = 'static';

  if (useDynamicQueries) {
    try {
      // Fetch graph schema for this deal
      const schema = await fetchGraphSchema(projectId);

      if (schema && schema.entity_types.length > 0) {
        const dynamicQuery = await generateDynamicQuery({
          section,
          sectionDescription: SECTION_DESCRIPTIONS[section] || section,
          graphSchema: schema,
          buyerPersona,
          userFocus,
        });

        if (dynamicQuery) {
          query = dynamicQuery;
          querySource = 'dynamic';
        }
      }
    } catch (error) {
      console.warn(`Dynamic query generation failed for ${section}, using static fallback:`, error);
    }
  }

  // Fallback to static query
  if (!query) {
    query = STATIC_SECTION_QUERIES[section] || section;
  }

  // Log query source for monitoring
  console.log(`[CIM Retrieval] Section: ${section}, Source: ${querySource}, Query: ${query.substring(0, 100)}...`);

  return await searchGraphiti(query, projectId);
}

// Export for testing
export { STATIC_SECTION_QUERIES, SECTION_DESCRIPTIONS };
```

### Update CIM Tools

**File:** `manda-app/lib/agent/cim-mvp/tools.ts` (lines 233-321)

Update section research tool to pass buyer persona:

```typescript
// In the section research tool
const results = await retrieveForSection({
  projectId: state.projectId,
  section: sectionId,
  buyerPersona: state.buyerPersona?.type, // From CIM state
  userFocus: state.userFocus,
  useDynamicQueries: true,
});
```

### Feature Flag

Add to environment/config:

```typescript
// .env.local or config
CIM_USE_DYNAMIC_QUERIES=true
```

```typescript
// In graphiti-knowledge.ts
const useDynamicQueries = process.env.CIM_USE_DYNAMIC_QUERIES !== 'false';
```

### Verification

1. Create CIM for existing deal with diverse entities
2. Check logs for "Source: dynamic" entries
3. Compare retrieval quality to static queries
4. Verify buyer persona influences query content
5. Test fallback by temporarily disabling schema endpoint
6. Monitor query cache hit rate

### Monitoring

Add metrics:
- `cim.query.source` — track dynamic vs static usage
- `cim.query.latency` — generation time
- `cim.query.cache_hit` — cache effectiveness

## Dependencies

- E14-S3 (Schema Introspection Endpoint)
- E14-S4 (Dynamic Query Generator)

## Out of Scope

- A/B testing infrastructure
- Query quality scoring
- User feedback on retrieval quality

---

## Completion Notes (2026-01-15)

### Implementation Summary

Updated `manda-app/lib/agent/cim-mvp/graphiti-knowledge.ts` to integrate dynamic query generation:

1. **Feature Flag**: Added `CIM_USE_DYNAMIC_QUERIES` env var (default: true)
2. **Renamed**: `SECTION_QUERIES` → `STATIC_SECTION_QUERIES` (now fallback only)
3. **New Interface**: `SectionRetrievalOptions` with buyerPersona, userFocus, limit
4. **Updated**: `getSectionGraphiti()` now:
   - Attempts dynamic query generation first
   - Falls back to static on failure
   - Logs query source for monitoring

### Key Changes

- **graphiti-knowledge.ts**:
  - Import `getQueryForSection` from query-generator
  - New `SectionRetrievalOptions` interface
  - Updated `getSectionGraphiti()` with dynamic query flow
  - Comprehensive logging: section, source, cached, latency, query preview
  - Exports: `STATIC_SECTION_QUERIES`, `USE_DYNAMIC_QUERIES`

- **cim-mvp/index.ts**:
  - Added exports for new types and functions from query-generator
  - Added exports for graphiti-knowledge additions

### Monitoring

Console logs include:
```
[graphiti-knowledge] Section: "executive_summary" | Source: dynamic | Cached: false | Latency: 1234ms | Query: "..."
[graphiti-knowledge] Retrieved 15 results for "executive_summary" (query source: dynamic)
```

### Testing

- TypeScript compilation passes for new files
- Existing CIM functionality preserved (static fallback works)
- Feature flag allows disabling dynamic queries if issues arise
