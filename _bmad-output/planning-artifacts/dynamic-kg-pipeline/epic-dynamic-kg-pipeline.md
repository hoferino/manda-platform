---
epic_id: E14
title: Dynamic Knowledge Graph Pipeline
status: ready
priority: P0
effort: 20-30 hours total
prd: dynamic-kg-pipeline-prd.md
adr: dynamic-kg-pipeline-adr.md
created: 2026-01-15
---

# Epic E14: Dynamic Knowledge Graph Pipeline

## Overview

Transform Manda's document processing from rigid, schema-constrained extraction to an adaptive, LLM-driven architecture that works for any deal type.

**Core Promise:** "Upload anything. We capture everything. Query it however you need."

## Business Value

- **Deal-agnostic intelligence** — works for niche dog toy company same as enterprise SaaS
- **Zero information loss** — users trust completeness
- **Better CIM quality** — retrieval matches deal-specific context

## Stories

### MVP (Phase 1 + Phase 3)

| Story | Title | Effort | Priority |
|-------|-------|--------|----------|
| E14-S1 | Dynamic Entity Extraction Instructions | 4-6h | P0 |
| E14-S2 | Document-Type Extraction Hints | 2h | P0 |
| E14-S3 | Graph Schema Introspection Endpoint | 2-3h | P0 |
| E14-S4 | Dynamic CIM Query Generator | 4-6h | P0 |
| E14-S5 | Replace Static SECTION_QUERIES | 2-3h | P0 |

**MVP Total:** ~14-20 hours

### Post-MVP (Phase 2)

| Story | Title | Effort | Priority |
|-------|-------|--------|----------|
| E14-S6 | Document Complexity Detection | 4h | P1 |
| E14-S7 | Direct LLM Extraction Handler | 6-8h | P1 |
| E14-S8 | Complexity-Based Routing | 2-3h | P1 |

**Post-MVP Total:** ~12-15 hours

## Dependencies

- ✅ E10 Knowledge Graph Foundation (Graphiti + Neo4j)
- ✅ E11 Agent Context Engineering
- ✅ CIM MVP knowledge service

## Acceptance Criteria

1. Upload document with novel entity types → entities appear in Neo4j
2. CIM builder retrieves deal-specific context without static mappings
3. No information dropped during extraction
4. Both semantic search and graph traversal work

## Technical Notes

- All changes leverage existing Graphiti infrastructure
- No Graphiti library modifications required
- Cost increase <10% of current processing costs
