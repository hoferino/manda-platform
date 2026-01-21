# Manda Platform

## What This Is

M&A intelligence platform with document processing, knowledge graph, and CIM (Confidential Information Memorandum) builder. The CIM builder guides users through creating professional M&A pitch documents with an AI-assisted workflow.

## Core Value

Help M&A advisors create compelling CIMs faster by combining AI guidance with structured document creation.

## Current Milestone: v2.0 CIM Preview Wireframe

**Goal:** Simplify CIM slide preview to clean wireframes — white background, grayscale styling, no colored emphasis states.

**Target features:**
- Strip colored backgrounds from component renderers
- White background with black/gray outlines only
- Simple box placeholders for charts/images/tables
- Clean text rendering for discussed content

## Requirements

### Validated

- [x] CIM MVP workflow (6 fix stories completed 2026-01-14)
- [x] Slide persistence in Supabase
- [x] Element selection for chat references
- [x] Divider slides render correctly

### Active

- [ ] Wireframe-style preview rendering
- [ ] Remove colored emphasis states from components
- [ ] Consistent grayscale styling across all component types

### Out of Scope

- PPTX export improvements — focus on preview first
- New component types — simplify existing ones
- Chat/workflow changes — preview only

## Context

**Current state:**
- `ComponentRenderer.tsx` has colored backgrounds for emphasis (green/yellow/blue/red)
- `WireframeComponentRenderer.tsx` also has colored styling
- Preview works for divider slides but content slides show "weird visuals and colors"
- Slides persist to Supabase via CIM entity

**Target state:**
- All slide previews render as clean wireframes
- White background, black/gray lines and text
- Box placeholders with icons for charts/images
- Discussed content (titles, bullets, etc.) renders clearly

## Constraints

- **Preserve functionality**: Keep click-to-reference working
- **No data model changes**: Use existing Slide/Component types
- **Minimal scope**: Preview rendering only, not export

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Consolidate to docs/features/ | Standard location, already has core docs | ✓ Validated |
| Keep _bmad-output/ | Valuable historical reference for past decisions | ✓ Validated |
| Wireframe-first preview | Simpler, faster, easier to debug before adding polish | — Pending |

---
*Last updated: 2026-01-21 after milestone v2.0 start*
