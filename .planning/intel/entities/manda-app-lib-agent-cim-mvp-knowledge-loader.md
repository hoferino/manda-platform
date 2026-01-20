---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/agent/cim-mvp/knowledge-loader.ts
type: service
updated: 2026-01-20
status: active
---

# knowledge-loader.ts

## Purpose

Loads and queries the JSON knowledge file generated from document analysis for the CIM MVP workflow. Provides in-memory caching, keyword search, section-based finding retrieval, and formatted context generation for LLM prompts. This is the JSON-based alternative to Graphiti for development and testing.

## Exports

- `loadKnowledge(knowledgePath?): Promise<KnowledgeFile>` - Load and cache knowledge file
- `getKnowledgeForSection(section): unknown` - Get raw section data
- `searchKnowledge(query, section?): Array<{content, source, section}>` - Keyword search
- `getFindingsForSection(sectionPath): Finding[]` - Get findings by dot-notation path
- `getCompanyMetadata(): KnowledgeFile['metadata'] | null` - Company name, documents, sufficiency score
- `getDataGaps(): KnowledgeFile['data_gaps'] | null` - Missing sections and recommendations
- `clearKnowledgeCache(): void` - Clear cached knowledge for testing
- `formatSectionContext(section): string` - Format findings with sources for LLM
- `getFullSectionContext(sectionNames): string` - Format ALL findings from multiple sections
- `getDataSummary(): string` - Rich summary with key metrics and preview

## Dependencies

- fs/promises - File system operations
- path - Path resolution
- [[manda-app-lib-agent-cim-mvp-types]] - KnowledgeFile, Finding types

## Used By

TBD

## Notes

Default knowledge path is `data/test-company/knowledge.json`. Uses singleton cache pattern - same path returns cached data. Supports nested section structures (e.g., `company_overview.history`) and extracts findings from both direct arrays and subsections. Priority sections for summary: financial_performance, company_overview, market_opportunity, competitive_landscape.
