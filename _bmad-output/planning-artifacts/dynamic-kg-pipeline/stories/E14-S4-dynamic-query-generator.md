---
story_id: E14-S4
epic: E14
title: Dynamic CIM Query Generator
status: done
priority: P0
effort: 4-6 hours
assignee: null
completed_date: 2026-01-15
---

# E14-S4: Dynamic CIM Query Generator

## User Story

**As a** CIM builder
**I want to** generate retrieval queries dynamically based on graph schema
**So that** I retrieve deal-specific context instead of generic results

## Background

Currently, `SECTION_QUERIES` in `graphiti-knowledge.ts` uses static query strings that miss deal-specific entity types. For example, a valve manufacturer deal has "API_Certification" entities that static queries don't know to search for.

## Acceptance Criteria

- [x] New `query-generator.ts` module created
- [x] Queries generated based on: section, graph schema, buyer persona
- [x] Uses Claude Haiku for fast, cheap generation
- [x] Queries cached with 1h TTL
- [x] Falls back to static queries on generation failure
- [x] Latency < 500ms for cached, < 2s for generation

## Technical Details

### New File

**Create:** `manda-app/lib/agent/cim-mvp/query-generator.ts`

```typescript
import { ChatAnthropic } from '@langchain/anthropic';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { PromptTemplate } from '@langchain/core/prompts';

interface GraphSchema {
  entity_types: string[];
  relationship_types: string[];
  entity_counts: Record<string, number>;
}

interface QueryGeneratorInput {
  section: string;
  sectionDescription: string;
  graphSchema: GraphSchema;
  buyerPersona?: string;
  userFocus?: string;
}

// In-memory cache (consider Redis for production)
const queryCache = new Map<string, { query: string; timestamp: number }>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const QUERY_GENERATION_PROMPT = PromptTemplate.fromTemplate(`
You are generating a search query for a CIM (Confidential Information Memorandum) section.

**Section:** {section}
**Section Description:** {sectionDescription}

**Available Entity Types in this Deal's Knowledge Graph:**
{entityTypes}

**Entity Counts:**
{entityCounts}

**Buyer Persona:** {buyerPersona}
**User Focus:** {userFocus}

Generate a natural language search query that will retrieve the most relevant information for this CIM section.

The query should:
1. Reference entity types that exist in this deal's graph
2. Be specific to what a {buyerPersona} buyer would want to know
3. Cover the key aspects of {section}
4. Be a single, comprehensive query string

Output ONLY the query string, nothing else.
`);

export async function generateDynamicQuery(
  input: QueryGeneratorInput
): Promise<string> {
  const cacheKey = buildCacheKey(input);

  // Check cache
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.query;
  }

  try {
    const model = new ChatAnthropic({
      model: 'claude-3-haiku-20240307',
      temperature: 0,
      maxTokens: 200,
    });

    const chain = QUERY_GENERATION_PROMPT.pipe(model).pipe(new StringOutputParser());

    const query = await chain.invoke({
      section: input.section,
      sectionDescription: input.sectionDescription,
      entityTypes: input.graphSchema.entity_types.join(', '),
      entityCounts: formatEntityCounts(input.graphSchema.entity_counts),
      buyerPersona: input.buyerPersona || 'strategic acquirer',
      userFocus: input.userFocus || 'general due diligence',
    });

    // Cache the result
    queryCache.set(cacheKey, { query: query.trim(), timestamp: Date.now() });

    return query.trim();
  } catch (error) {
    console.error('Query generation failed, using fallback:', error);
    return null; // Caller should fall back to static query
  }
}

function buildCacheKey(input: QueryGeneratorInput): string {
  const parts = [
    input.section,
    input.buyerPersona || 'default',
    input.userFocus || 'default',
    // Include top 5 entity types to vary cache by schema
    ...input.graphSchema.entity_types.slice(0, 5),
  ];
  return parts.join(':');
}

function formatEntityCounts(counts: Record<string, number>): string {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([type, count]) => `${type}: ${count}`)
    .join('\n');
}

export function invalidateQueryCache(projectId?: string): void {
  if (projectId) {
    // Invalidate all queries for this project
    for (const key of queryCache.keys()) {
      if (key.includes(projectId)) {
        queryCache.delete(key);
      }
    }
  } else {
    queryCache.clear();
  }
}
```

### Fetch Schema Helper

```typescript
// Add to query-generator.ts or separate file

export async function fetchGraphSchema(projectId: string): Promise<GraphSchema | null> {
  try {
    const response = await fetch(
      `${process.env.PROCESSING_API_URL}/api/search/schema/${projectId}`
    );

    if (!response.ok) {
      throw new Error(`Schema fetch failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch graph schema:', error);
    return null;
  }
}
```

### Usage Example

```typescript
import { generateDynamicQuery, fetchGraphSchema } from './query-generator';
import { SECTION_QUERIES } from './graphiti-knowledge'; // Static fallback

async function getQueryForSection(
  projectId: string,
  section: string,
  sectionDescription: string,
  buyerPersona?: string
): Promise<string> {
  // Try dynamic generation
  const schema = await fetchGraphSchema(projectId);

  if (schema && schema.entity_types.length > 0) {
    const dynamicQuery = await generateDynamicQuery({
      section,
      sectionDescription,
      graphSchema: schema,
      buyerPersona,
    });

    if (dynamicQuery) {
      return dynamicQuery;
    }
  }

  // Fall back to static query
  return SECTION_QUERIES[section] || `Information about ${section}`;
}
```

### Example Generated Queries

**Input:**
- Section: "Market Opportunity"
- Entity Types: ["Company", "Market_Segment", "Competitor", "API_Certification", "Refinery_Customer"]
- Buyer Persona: "strategic industrial acquirer"

**Generated Query:**
```
"Market opportunity analysis including market segments, competitive landscape,
API certification requirements, and refinery customer relationships for
industrial valve manufacturing sector"
```

Compare to static:
```
"market opportunity size growth trends competitive landscape"
```

## Dependencies

- E14-S3 (Schema Introspection Endpoint)
- Anthropic API key configured

## Out of Scope

- Multi-query generation (one query per section for MVP)
- Query quality evaluation/feedback loop

---

## Completion Notes (2026-01-15)

### Implementation Summary

Created `manda-app/lib/agent/cim-mvp/query-generator.ts` with:

1. **GraphSchema Interface**: Types for schema endpoint response
2. **QueryGeneratorInput Interface**: Input types for query generation
3. **In-Memory Cache**: 1-hour TTL cache with key based on section + persona + schema
4. **fetchGraphSchema()**: Fetches schema from `/api/search/schema/{project_id}` with 5s timeout
5. **generateDynamicQuery()**: Uses Claude Haiku with LangChain to generate queries
6. **getQueryForSection()**: High-level function with fallback handling
7. **SECTION_DESCRIPTIONS**: Comprehensive descriptions for all CIM sections

### Key Features

- **Prompt Engineering**: Uses buyer persona and graph entity types to generate contextual queries
- **Fallback Handling**: Falls back to static queries if schema fetch or LLM generation fails
- **Logging**: Detailed logging of query source, cache hits, and latency for monitoring
- **Exports**: All functions and types exported via `cim-mvp/index.ts` barrel

### Files Created/Modified

- `manda-app/lib/agent/cim-mvp/query-generator.ts` (NEW)
- `manda-app/lib/agent/cim-mvp/index.ts` (exports added)
