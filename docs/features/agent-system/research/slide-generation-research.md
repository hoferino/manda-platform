# Slide Generation Research Reports

> **Date**: 2026-01-23
> **Purpose**: Raw research reports for CIM preview architecture decision

---

## Report 1: Interactive Slide Deck Generation - Approaches and Solutions

### Introduction

Creating a pitch deck through an AI-driven dialogue workflow requires balancing dynamic user input with real-time visual feedback. In this approach, a user and an AI agent collaboratively build each slide, refining content and layout interactively. The AI suggests slide structures (e.g. "split this slide into two parts – a bar chart on the left, text boxes on the right"), and the user can adjust instructions ("move this element to the top," etc.). The challenge lies in providing a live preview of the slide as it's being constructed, and then exporting the finished slides into an editable PowerPoint format.

### Requirements & Challenges

Building such an interactive slide creator entails several requirements:
1. **Flexible slide layouts** for any content the user envisions
2. **Live wireframe preview** that updates in real-time with each user edit
3. **PowerPoint export** with content and layout carrying over to editable PPTX

Key challenges include choosing how to generate the layout (manually vs. automatically), how to render the preview efficiently, and whether to leverage existing APIs or libraries.

### Option 1: Custom DSL and Auto-Layout Engine

Design a domain-specific language (DSL) or structured format to represent slide content and layout, combined with an algorithmic layout engine to position elements.

**Dagre Evaluation**: A library like Dagre (which implements Graphviz's DOT layering algorithms) can auto-arrange nodes in a directed graph. However, slide layouts often have specific alignment needs that generic graph layouts may not satisfy out-of-the-box.

**Pros**: Maximum flexibility, no dependency on external services, real-time updates.
**Cons**: High implementation complexity, layout engine may not produce aesthetically acceptable results.

### Option 2: Pre-Defined Template Components

Rely on pre-designed slide templates or components. The AI agent picks the closest matching template and populates it with content.

**Pros**: Reduces complexity, ensures consistent structure and branding.
**Cons**: Lack of flexibility for custom slide designs, requires large template library.

### Option 3: AI-Driven Automatic Slide Design

Entrust the layout and visual styling to an AI. Tools like Gamma and SlidesGPT work this way but have limited variety or sometimes suboptimal formatting.

**Pros**: Polished slides automatically, reduced manual effort.
**Cons**: Difficult to control, inconsistent style, slow for interactive use.

### Option 4: Third-Party Presentation Generation APIs

#### FlashDocs API
Modern slides API that generates PowerPoint or Google Slides from markdown or JSON inputs. Supports dynamic insertion of text, images, charts, and tables. Custom templates supported.

#### SlideSpeak API
Accepts structured JSON and can merge into presentations. Offers slide-by-slide control.

#### Indico Labs API
Converts HTML, Markdown, or JSON into PowerPoint files. Provides template designer UI with 100+ pre-built components.

#### Presenton (Open Source)
Self-hosted AI presentation generator with API-first architecture. Supports custom PPTX templates.

### Option 5: Programmatic Generation via Libraries

#### python-pptx
Open-source library for creating and manipulating PPTX files in Python. Granular control over positions and properties.

#### PptxGenJS
JavaScript library that runs in-browser to generate PPTX files. Simple JS API for slides, text, images, shapes, charts, tables.

#### Office APIs
Microsoft Graph API and Google Slides API allow programmatic manipulation through REST calls.

### Recommended Solution: Hybrid Approach

1. **Maintain a Structured Slide Model**: JSON schema as single source of truth
2. **Real-Time Preview via Local Rendering**: HTML/CSS or SVG for wireframe preview
3. **Leverage APIs/Libraries for Final Output**: FlashDocs or PptxGenJS for PPTX generation
4. **Percentage-based positioning**: Works identically in CSS and PPTX

---

## Report 2: Live Slide Preview and Generation System for M&A Pitch Decks

### Key Finding

**react-pptx combined with PptxGenJS and a JSON-based schema architecture provides the optimal solution** for building a dialogue-style AI agent with real-time preview and 1:1 PowerPoint export mapping.

The key insight is using a single React component tree that renders both to a web preview AND generates native PowerPoint files, ensuring visual fidelity without maintaining parallel rendering systems.

### Schema-Driven Rendering

The most effective pattern uses a **JSON intermediate schema** as the single source of truth. The AI agent generates structured JSON describing slide layouts, which both the React preview components and PowerPoint export engine consume.

```typescript
interface SlideSchema {
  id: string;
  layout: 'executive_summary' | 'financials' | 'two_column' | 'chart_focus';
  elements: Array<{
    id: string;
    type: 'text' | 'chart' | 'shape' | 'table' | 'image';
    bounds: { x: string; y: string; w: string; h: string }; // Percentages
    content: TextContent | ChartContent | TableContent;
    style: ElementStyle;
  }>;
}
```

### Dagre.js is Unsuitable for Slide Layouts

Dagre.js implements Sugiyama-style hierarchical graph layouts, optimized for directed acyclic graphs with edges connecting nodes. **Slides are fundamentally spatial arrangements of independent elements without connecting edges**, making Dagre a poor fit.

For layout requirements, **CSS Grid/Flexbox-based rendering** or a custom constraint-based layout engine provides far better results.

### react-pptx Delivers 1:1 Preview-to-Export Mapping

**react-pptx** (github.com/wyozi/react-pptx) is the only library providing both React JSX syntax AND native PowerPoint export from identical components.

```tsx
import { Presentation, Slide, Text, Shape, render } from "react-pptx";
import { Preview } from "react-pptx/preview";

// Same component for preview AND export
const DealSummarySlide = ({ data }) => (
  <Slide style={{ backgroundColor: "#FFFFFF" }}>
    <Text style={{ x: "5%", y: "5%", w: "90%", h: "12%", fontSize: 32, bold: true }}>
      {data.companyName} Acquisition
    </Text>
  </Slide>
);

// Live preview in browser
<Preview slideStyle={{ border: '1px solid #ccc' }}>
  <Presentation layout="16x9">
    <DealSummarySlide data={slideData} />
  </Presentation>
</Preview>

// Export to PowerPoint
render(
  <Presentation layout="16x9">
    <DealSummarySlide data={slideData} />
  </Presentation>
).then(buffer => saveAs(new Blob([buffer]), 'pitch_deck.pptx'));
```

**Limitation**: react-pptx lacks native chart support. For M&A financial charts, use **PptxGenJS directly** for those specific elements.

### FlashDoc and Presentation APIs

**FlashDoc API** excels at template-based generation but **lacks real-time preview** capability. Best for final polished output, not interactive workflow.

### PowerPoint Generation Coordinate Mapping

PptxGenJS uses **inches** by default. Critical insight: **use percentage strings** in both React CSS and PptxGenJS calls to avoid conversion bugs:

```javascript
// GOOD: Percentages work identically in CSS and PptxGenJS
slide.addText("Title", { x: "10%", y: "5%", w: "80%", h: "15%" });

// AVOID: Pixel-to-inch conversion introduces rounding errors
const inches = pixels / 96; // Accumulates small errors
```

### Recommended Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     AI Conversation Layer                            │
│  (Natural language → structured JSON slide operations)              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    JSON Slide Schema (Zod validated)                │
│  Single source of truth with percentage-based positioning           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                │                               │
                ▼                               ▼
┌───────────────────────────────┐   ┌─────────────────────────────────┐
│   react-pptx <Preview>        │   │   Export Pipeline               │
│   Real-time browser view      │   │   react-pptx render() for slides│
│   with selection/hover        │   │   PptxGenJS for charts/tables   │
│   state for referencing       │   │   Generates editable .pptx      │
└───────────────────────────────┘   └─────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────┐
│   Zustand + Immer State Management                                   │
│   - Undo/redo history                                               │
│   - Optimistic updates                                              │
│   - Bidirectional sync (agent ↔ user edits)                        │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Libraries

- `react-pptx` (JSX slides with preview + export)
- `pptxgenjs` (direct PPTX generation for charts/tables)
- `zustand` + `immer` (state management)
- `zod` (schema validation)

---

## Sources

### Report 1 Sources
- Plus AI Blog – "Best Presentation APIs of 2025"
- Kevin Goedecke, Medium – "The Best APIs to Create PowerPoint Presentations"
- FlashDocs API – Official site and docs
- MagicSlides App – AI slide maker
- Presenton – Open-source AI presentation generator
- Intertech Blog – "Dynamically Generate PowerPoint Presentations Using PptxGenJS"
- Microsoft & Google Slides API documentation
- Python-pptx Documentation
- Aspose.Slides Product Overview

### Report 2 Sources
- react-pptx GitHub repository
- PptxGenJS documentation
- Beautiful.AI architecture patterns
- Canva/Figma collaboration patterns
