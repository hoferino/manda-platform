# CIM Preview Architecture

> **Status**: Research Complete | Implementation Planned
> **Last Updated**: 2026-01-23
> **Related**: [CIM MVP Hub](README.md)

---

## Overview

This document captures the research, architectural decisions, and implementation guidance for the CIM Builder's slide preview and export system. The goal is to enable dynamic slide generation where users can request any visualization type, see it in a live wireframe preview, and export to editable PowerPoint.

## Problem Statement

The current CIM Builder has:
- **61 predefined component types** with custom renderers
- **Zod validation** that blocks unknown types
- **No export capability** to PowerPoint
- **Gap**: Users cannot request visualizations outside predefined types

### User Requirements
1. Dynamic slide creation via dialogue with AI agent
2. Real-time wireframe preview of slides
3. Support for any chart/diagram type user requests
4. Export to editable PowerPoint (not images)
5. 1:1 mapping between preview and export

---

## APIs & Tools Evaluated

### Presentation Generation APIs

| API | Approach | Real-time Preview | PPTX Export | Best For |
|-----|----------|-------------------|-------------|----------|
| **FlashDocs** | Template + JSON → Slides | ❌ (needs GSlides embed) | ✅ Editable | Template-driven automation |
| **SlideSpeak** | Structured JSON | ❌ | ✅ | Batch generation |
| **Presenton** | Open-source, self-hosted | ❌ | ✅ | Privacy-focused |
| **Google Slides API** | Native manipulation | ✅ via embed | ✅ via conversion | Google Workspace teams |

**Finding**: External APIs don't support real-time preview needed for dialogue workflow. Good for final export polish, not core rendering.

### Chart/Visualization APIs

| Tool | How It Works | Charts Editable? | Latency |
|------|--------------|------------------|---------|
| **QuickChart** | JSON config → Image URL | ❌ (images) | ~200ms API call |
| **Mermaid** | Text syntax → SVG | ❌ (SVG) | ~50ms client-side |
| **PptxGenJS** | JS → Native PPTX charts | ✅ Yes | ~5ms local |

**Finding**: QuickChart/Mermaid render to images, losing editability. PptxGenJS creates native PowerPoint charts.

### Rendering Libraries

| Library | Preview | Export | 1:1 Mapping |
|---------|---------|--------|-------------|
| **python-pptx** | ❌ (server) | ✅ | N/A |
| **PptxGenJS** | ❌ (export only) | ✅ | N/A |
| **react-pptx** | ✅ `<Preview>` | ✅ `render()` | ✅ Same JSX |

**Finding**: react-pptx is the only library providing both React preview AND PowerPoint export from identical components.

---

## Layout Engine Evaluation

### Dagre.js
- **Purpose**: Hierarchical graph layout (Sugiyama algorithm)
- **Verdict**: ❌ **Not suitable for slides**
- **Reason**: Slides are spatial arrangements of independent elements, not graphs with edges. Dagre requires artificial graph structures and lacks support for grid layouts, nested containers, or column splits.

### CSS Grid/Flexbox
- **Verdict**: ✅ **Recommended for layouts**
- **Reason**: Native browser support, percentage positioning, responsive. Works identically in preview CSS and PPTX percentage units.

### Custom Layout DSL
- **Verdict**: ⚠️ **High complexity, limited benefit**
- **Reason**: LLMs struggle with coordinate math. High-level layout hints (split-horizontal, quadrant) are simpler than pixel-perfect positioning.

---

## Architectural Decision: react-pptx + PptxGenJS

### Why This Combination

1. **react-pptx provides 1:1 preview-to-export mapping**
   - Same JSX component tree renders to browser preview AND generates .pptx
   - No divergence between what user sees and what they get

2. **PptxGenJS handles charts natively**
   - Creates real PowerPoint charts with embedded data
   - Charts remain editable in exported file
   - Supports bar, line, pie, radar, doughnut, scatter, waterfall

3. **Percentage-based positioning eliminates coordinate bugs**
   - `x: "10%"` works identically in CSS and PptxGenJS
   - No pixel-to-inch conversion errors
   - Standard 16:9 slides (10" × 5.625")

4. **No external API dependencies for core workflow**
   - All rendering happens client-side
   - No latency from API calls
   - Works offline

### Trade-offs Accepted

| Trade-off | Mitigation |
|-----------|------------|
| react-pptx doesn't support all PPTX features | Use PptxGenJS directly for advanced features |
| Wireframe preview looks different from final | CSS wrapper applies wireframe aesthetic to same components |
| Limited to chart types PptxGenJS supports | Covers all standard M&A chart needs |

---

## Schema Design

### Core Principle: Agent Outputs High-Level Intent

Instead of coordinates, the agent outputs semantic structures:

```typescript
// Agent outputs this:
{
  type: 'chart',
  bounds: { x: "5%", y: "25%", w: "45%", h: "60%" },
  chartConfig: {
    type: 'radar',
    title: 'Competitive Position',
    data: {
      labels: ['Price', 'Quality', 'Speed', 'Support', 'Innovation'],
      datasets: [
        { name: 'Our Company', values: [80, 70, 90, 60, 85] }
      ]
    }
  }
}

// Renderer handles:
// - Preview: Wireframe SVG representation
// - Export: Native PptxGenJS radar chart (editable)
```

### Component Types (Simplified to 5)

| Type | Description | Preview Rendering | Export Rendering |
|------|-------------|-------------------|------------------|
| `text` | Titles, bullets, paragraphs | react-pptx `<Text>` | PptxGenJS `addText()` |
| `shape` | Rectangles, containers | react-pptx `<Shape>` | PptxGenJS `addShape()` |
| `chart` | All data visualizations | Wireframe SVG | PptxGenJS `addChart()` |
| `table` | Data tables | react-pptx `<Table>` | PptxGenJS `addTable()` |
| `image` | Images, placeholders | `<img>` or placeholder | PptxGenJS `addImage()` |

### Why 5 Types Instead of 61

The current 61 types (bar_chart, line_chart, pie_chart, horizontal_bar_chart, stacked_bar_chart, etc.) are **rendering variations**, not semantic types.

With the new schema:
- `type: 'chart'` + `chartConfig.type: 'bar'` replaces `bar_chart`
- `type: 'chart'` + `chartConfig.type: 'radar'` replaces `radar_chart`
- Agent flexibility: Can request ANY chart type supported by PptxGenJS

---

## Wireframe Styling

### Design System (Current)

```css
/* From globals.css */
--muted: oklch(0.97 0.005 250);           /* #f5f5f7 */
--muted-foreground: oklch(0.556 0.02 250); /* #71717a */

/* Component styling */
.wireframe-component {
  border: 2px dashed rgba(113, 113, 122, 0.3);
  background: rgba(245, 245, 247, 0.5);
  border-radius: 4px;
}
```

### Applying to react-pptx Preview

```tsx
<div className="wireframe-preview">
  <style jsx>{`
    .wireframe-preview :global(.pptx-text) {
      color: #71717a !important;
    }
    .wireframe-preview :global(.pptx-shape) {
      border: 2px dashed rgba(113, 113, 122, 0.3) !important;
      background: rgba(245, 245, 247, 0.5) !important;
    }
  `}</style>
  <Preview>...</Preview>
</div>
```

The same components render with wireframe styling in preview, full styling in export.

---

## FlashDocs Integration (Future)

For professional polish after wireframe approval:

1. User approves wireframe slides
2. Optionally: Upload brand template to FlashDocs
3. Export slide content as markdown/JSON
4. FlashDocs applies template styling
5. Download polished .pptx

**Not required for MVP** - PptxGenJS export provides editable .pptx that users can style manually in PowerPoint.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│  User: "Add a radar chart showing competitive position"             │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  CIM MVP Agent (lib/agent/cim-mvp/graph.ts)                         │
│  - Interprets user intent                                           │
│  - Calls update_slide tool with chartConfig                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Zod Validation (tools.ts)                                          │
│  - Validates chart type is supported                                │
│  - Validates data structure                                         │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│  State Update → SSE Stream → CIMBuilderPage                         │
│  - slideUpdates Map updated                                         │
│  - UI re-renders                                                    │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
┌───────────────────────────────┐   ┌─────────────────────────────────┐
│  WireframePreview             │   │  exportToPptx()                 │
│  - react-pptx <Preview>       │   │  - PptxGenJS addChart()         │
│  - CSS wireframe styling      │   │  - Native PPTX output           │
│  - ChartWireframeSVG          │   │  - Editable charts              │
└───────────────────────────────┘   └─────────────────────────────────┘
```

---

## Migration Strategy

### Phase 1: Parallel Systems
- Keep existing WireframeRenderer
- Add new react-pptx renderer behind feature flag
- `USE_REACT_PPTX=true` enables new system

### Phase 2: Schema Migration
- Add percentage bounds to existing schema
- Map 61 types → 5 types with config
- Backward compatibility: convert old types at render time

### Phase 3: Cutover
- Validate all slide types work
- Remove feature flag
- Deprecate old renderer

### Phase 4: Cleanup
- Remove WireframeComponentRenderer.tsx (800+ lines)
- Remove ComponentRenderer.tsx (800+ lines)
- Single source of truth: SlideComponents.tsx

---

## Implementation Files

| File | Action | Description |
|------|--------|-------------|
| `package.json` | Modify | Add react-pptx, pptxgenjs |
| `lib/agent/cim-mvp/state.ts` | Modify | Simplified component types + percentage bounds |
| `lib/agent/cim-mvp/tools.ts` | Modify | New schema with chartConfig, tableData |
| `lib/agent/cim-mvp/prompts.ts` | Modify | Add slide guidance for new schema |
| `components/cim-builder/PreviewPanel/SlideComponents.tsx` | **NEW** | Unified react-pptx components |
| `components/cim-builder/PreviewPanel/WireframePreview.tsx` | **NEW** | Preview wrapper with CSS styling |
| `components/cim-builder/PreviewPanel/ChartRenderer.tsx` | **NEW** | Dual-mode chart rendering |
| `lib/utils/pptx-export.ts` | **NEW** | Export function using PptxGenJS |

---

## References

- [react-pptx GitHub](https://github.com/wyozi/react-pptx)
- [PptxGenJS Documentation](https://gitbrent.github.io/PptxGenJS/)
- [FlashDocs API](https://docs.flashdocs.com/)
- [QuickChart API](https://quickchart.io/documentation/)
- [Mermaid.js](https://mermaid.js.org/)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-01-23 | Initial research and architecture decision |
