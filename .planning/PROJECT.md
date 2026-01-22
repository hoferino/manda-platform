# Manda Platform

## What This Is

M&A intelligence platform with document processing, knowledge graph, and CIM (Confidential Information Memorandum) builder. The CIM builder guides users through creating professional M&A pitch documents with an AI-assisted workflow and clean wireframe previews.

## Core Value

Help M&A advisors create compelling CIMs faster by combining AI guidance with structured document creation.

## Current State

**Version:** v2.0 (shipped 2026-01-22)

**CIM Preview:** Clean grayscale wireframes with white backgrounds, gray borders, and black/gray text. Click-to-reference functionality preserved.

**Tech stack:** Next.js 16, React 19, Tailwind CSS 4, Supabase, Graphiti + Neo4j

## Requirements

### Validated

- [x] CIM MVP workflow (6 fix stories completed 2026-01-14)
- [x] Slide persistence in Supabase
- [x] Element selection for chat references
- [x] Divider slides render correctly
- [x] Wireframe-style preview rendering — v2.0
- [x] Remove colored emphasis states from components — v2.0
- [x] Consistent grayscale styling across all component types — v2.0

### Active

(No active requirements — awaiting next milestone)

### Out of Scope

- PPTX export improvements — preview-first approach validated
- New component types — current components cover needs
- Chat/workflow changes — CIM MVP workflow stable

## Constraints

- **Preserve functionality**: Keep click-to-reference working
- **No data model changes**: Use existing Slide/Component types
- **Minimal scope**: Preview rendering only, not export

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Consolidate to docs/features/ | Standard location, already has core docs | ✓ Validated |
| Keep _bmad-output/ | Valuable historical reference for past decisions | ✓ Validated |
| Wireframe-first preview | Simpler, faster, easier to debug before adding polish | ✓ Validated |
| Grayscale-only styling | Colored emphasis states caused visual confusion | ✓ Validated |
| Preserve hover states | Interactive feedback needed for click-to-reference UX | ✓ Validated |

---
*Last updated: 2026-01-22 after v2.0 milestone complete*
