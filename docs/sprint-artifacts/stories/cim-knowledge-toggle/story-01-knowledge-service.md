# Story 1: Knowledge Service Abstraction

**File:** `manda-app/lib/agent/cim-mvp/knowledge-service.ts`
**Estimate:** Small
**Dependencies:** None

---

## Overview

Create an abstraction layer that routes knowledge queries to either the JSON file or Graphiti based on a mode flag. This allows the existing CIM tools to work unchanged while the underlying data source switches.

## Problem Statement

Currently, `knowledge-loader.ts` is tightly coupled to JSON file loading:

```typescript
// Current: Direct JSON file access
const knowledge = await loadKnowledge(knowledgePath)
const results = searchKnowledge(query, section)
```

We need an abstraction that preserves this interface but routes to different backends.

## Tasks

- [x] 1.1 Create `KnowledgeMode` type: `'json' | 'graphiti'`
- [x] 1.2 Create `KnowledgeServiceConfig` interface with mode, dealId, groupId
- [x] 1.3 Create `KnowledgeService` class with unified interface
- [x] 1.4 Implement `search(query, options?)` method that routes based on mode
- [x] 1.5 Implement `getSection(sectionPath)` method that routes based on mode
- [x] 1.6 Implement `getMetadata()` method for company name, data sufficiency, etc.
- [x] 1.7 Add factory function `createKnowledgeService(config)`
- [x] 1.8 Export types and service from barrel file
- [x] 1.9 Run `npm run type-check` - must pass

## Completion Notes

**Completed:** 2026-01-15
**Status:** Done

### Implementation Summary
- Created `lib/agent/cim-mvp/knowledge-service.ts` with:
  - `KnowledgeMode` type union
  - `KnowledgeServiceConfig`, `KnowledgeSearchOptions`, `KnowledgeSearchResult`, `KnowledgeMetadata`, `KnowledgeReadiness` interfaces
  - `IKnowledgeService` interface and `KnowledgeService` class implementation
  - Mode-based routing to JSON loader or Graphiti (via dynamic import)
  - `checkReadiness()` method for data coverage assessment
  - Factory function `createKnowledgeService()`
- Updated `lib/agent/cim-mvp/index.ts` barrel to export all new types

### Code Review Fixes Applied
- Added comprehensive JSDoc documentation
- Implemented `getSummary()` and `getConfig()` methods beyond original spec

## Interface Design

```typescript
// knowledge-service.ts

export type KnowledgeMode = 'json' | 'graphiti'

export interface KnowledgeServiceConfig {
  mode: KnowledgeMode
  // JSON mode
  knowledgePath?: string
  // Graphiti mode
  dealId?: string
  groupId?: string
}

export interface KnowledgeSearchOptions {
  section?: string
  limit?: number
}

export interface KnowledgeSearchResult {
  content: string
  source: string
  relevance?: number
  metadata?: Record<string, unknown>
}

export interface KnowledgeMetadata {
  companyName: string
  documentCount: number
  dataSufficiencyScore: number
  lastUpdated?: string
}

export interface IKnowledgeService {
  search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>
  getSection(sectionPath: string): Promise<KnowledgeSearchResult[]>
  getMetadata(): Promise<KnowledgeMetadata>
  getMode(): KnowledgeMode
}

export class KnowledgeService implements IKnowledgeService {
  private config: KnowledgeServiceConfig

  constructor(config: KnowledgeServiceConfig) {
    this.config = config
  }

  async search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    if (this.config.mode === 'graphiti') {
      // Delegate to graphiti-knowledge.ts (Story 2)
      throw new Error('Graphiti mode not implemented yet')
    }
    // Delegate to existing knowledge-loader.ts
    return this.searchJson(query, options)
  }

  async getSection(sectionPath: string): Promise<KnowledgeSearchResult[]> {
    if (this.config.mode === 'graphiti') {
      throw new Error('Graphiti mode not implemented yet')
    }
    return this.getSectionJson(sectionPath)
  }

  async getMetadata(): Promise<KnowledgeMetadata> {
    if (this.config.mode === 'graphiti') {
      throw new Error('Graphiti mode not implemented yet')
    }
    return this.getMetadataJson()
  }

  getMode(): KnowledgeMode {
    return this.config.mode
  }

  // Private JSON implementations (wrap existing knowledge-loader.ts)
  private async searchJson(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    // Use existing searchKnowledge() from knowledge-loader.ts
  }

  private async getSectionJson(sectionPath: string): Promise<KnowledgeSearchResult[]> {
    // Use existing getKnowledgeForSection() from knowledge-loader.ts
  }

  private async getMetadataJson(): Promise<KnowledgeMetadata> {
    // Use existing loadKnowledge() metadata from knowledge-loader.ts
  }
}

export function createKnowledgeService(config: KnowledgeServiceConfig): IKnowledgeService {
  return new KnowledgeService(config)
}
```

## Acceptance Criteria

1. `KnowledgeService` class created with mode-based routing
2. JSON mode works identically to current `knowledge-loader.ts` behavior
3. Graphiti mode throws clear "not implemented" error (for Story 2)
4. All types exported from `lib/agent/cim-mvp/index.ts` barrel
5. `npm run type-check` passes
6. Existing CIM functionality unchanged (JSON mode is default)

## Testing Notes

Unit tests should verify:
- JSON mode delegates to knowledge-loader functions
- Graphiti mode throws appropriate error
- Factory function creates service with correct config
- Interface matches expected shape

## Files to Create/Modify

| File | Action |
|------|--------|
| `lib/agent/cim-mvp/knowledge-service.ts` | CREATE - New abstraction layer |
| `lib/agent/cim-mvp/index.ts` | MODIFY - Export new types and service |

## Next Steps

After this story, Story 2 will implement the Graphiti backend that fills in the `throw new Error('Graphiti mode not implemented yet')` placeholders.
