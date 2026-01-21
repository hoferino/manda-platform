# Roadmap: v2.0 CIM Preview Wireframe

**Created:** 2026-01-21
**Milestone:** v2.0
**Goal:** Clean wireframe previews for CIM slides

## Phase Overview

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 4 | Wireframe Preview | Strip colors, simplify to grayscale wireframes | STYLE-01-04, PLACE-01-03, TEXT-01-04, KEEP-01-02 | ✓ Complete |

## Phase 4: Wireframe Preview

**Goal:** Transform CIM slide preview from colored components to clean grayscale wireframes

**Plans:** 1 plan

Plans:
- [x] 04-01-PLAN.md - Convert all preview renderers to grayscale styling

**Requirements:**
- STYLE-01, STYLE-02, STYLE-03, STYLE-04
- PLACE-01, PLACE-02, PLACE-03
- TEXT-01, TEXT-02, TEXT-03, TEXT-04
- KEEP-01, KEEP-02

**Success Criteria:**
1. All slide previews render with white/transparent backgrounds only
2. All borders and outlines are gray (no colored emphasis)
3. Chart/image/table placeholders show dashed gray boxes with icons
4. Text renders in black/dark gray with proper hierarchy
5. Click-to-reference still works on all components

**Key Files:**
- `manda-app/components/cim-builder/PreviewPanel/ComponentRenderer.tsx`
- `manda-app/components/cim-builder/PreviewPanel/WireframeComponentRenderer.tsx`
- `manda-app/components/cim-builder/PreviewPanel/SlidePreview.tsx`

**Approach:**
1. Update `emphasisColors` to all use gray/transparent
2. Update `getMetricStyle()` to return grayscale styles
3. Simplify chart/image/table wireframes to consistent dashed gray boxes
4. Ensure text components use black/gray palette only
5. Test click-to-reference still functions

---

## Milestone Summary

**Total phases:** 1
**Total requirements:** 13
**Total plans:** 1

---
*Created: 2026-01-21*
*Updated: 2026-01-21 - Phase 4 complete*
