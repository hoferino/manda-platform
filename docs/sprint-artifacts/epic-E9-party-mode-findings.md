# Epic 9: CIM Builder - Party Mode Discussion Findings

**Date:** 2025-12-09
**Participants:** John (PM), Mary (Analyst), Winston (Architect), Sally (UX), Amelia (Dev), Bob (SM), Murat (Test Architect), Paige (Tech Writer)

---

## Executive Summary

Epic 9 was re-scoped from "CIM Company Overview Creation" to **"CIM Builder"** - a comprehensive framework for creating complete Confidential Information Memorandums through an agent-guided, iterative workflow.

**Key Insight:** This is the core value-add of the product. Analysts get paid to create CIMs and present them to potential buyers. The workflow IS the product.

---

## Vision & Core Principles

### What We're Building

- **Agent-guided framework** for creating ANY CIM structure (not fixed sections)
- **Iterative slide-by-slide creation** where context flows forward and changes propagate backward
- **Non-technical users** - no slash commands, everything through natural conversation
- **RAG/GraphRAG powered** - pulls from docs, findings, Q&A already in the deal
- **Multiple CIMs per deal** - users can create different versions for different buyer types

### User Flow

```
Deal Setup (prior epics)
    ↓
CIM Builder Entry → "Let's build your CIM"
    ↓
Phase 1: WHO is the buyer? (Persona)
Phase 2: WHAT's the story? (Investment Thesis)
Phase 3: WHAT's the structure? (Agenda/Outline - user-defined)
    ↓
For each section in outline:
    → Content ideation (RAG-powered options)
    → Content approval
    → Visual concept (slide blueprint)
    → Visual approval
    → Slide locked (but can revisit)
    ↓
Coherence Review → "Does this story hold together?"
    ↓
Export → Wireframe PPT + LLM Prompt
```

---

## UI Design (NotebookLM-Inspired)

### Three-Panel Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  CIM Builder                                                        │
├──────────────┬──────────────────────────────┬───────────────────────┤
│  SOURCES     │  CONVERSATION                │  PREVIEW              │
│              │                              │                       │
│  📄 Docs     │  Agent: "Let's define your   │  ┌─────────────────┐  │
│  📊 Findings │   buyer persona. Who are     │  │                 │  │
│  ❓ Q&A      │   you selling to?"           │  │  [Live Slide    │  │
│              │                              │  │   Preview]      │  │
│  ─────────── │  You: "Strategic buyer,      │  │                 │  │
│              │   probably a competitor      │  │                 │  │
│  STRUCTURE   │   looking to expand..."      │  └─────────────────┘  │
│              │                              │                       │
│  ✅ Persona  │  Agent: "Got it. Based on    │  Navigation:          │
│  ✅ Thesis   │   that, I suggest focusing   │  ◀ Prev  │  Next ▶   │
│  🔄 Outline  │   on synergy potential..."   │                       │
│  ⏳ Exec Sum │                              │  Slide 3 of 24        │
│  ⏳ Company  │  [Suggested options appear]  │                       │
│              │                              │                       │
└──────────────┴──────────────────────────────┴───────────────────────┘
```

### Click-to-Reference Pattern

User clicks a component in the preview → reference appears in chat input:

```
📍 [s3_bullet1] "15% CAGR" - change this to 22% based on Q3 findings
```

Agent parses reference, knows exactly which component, makes update, re-renders preview.

**Key UX Decisions:**
- No slash commands (users are non-technical)
- Agent orchestrates everything through conversation
- Sources panel: clickable docs/findings/Q&A from deal
- Structure panel: always visible, shows progress, click to jump
- Manual editing should be possible

---

## Architecture

### Data Model

```
deals
  └── cims (one-to-many)
        ├── id
        ├── deal_id
        ├── name ("CIM for Strategic Buyers", "CIM v2 - Financial Focus")
        ├── workflow_state (JSONB - current phase, context)
        ├── slides (JSONB array - ordered slide specs)
        ├── created_at
        └── updated_at
```

### Component Reference System

Each slide element gets a stable ID for click-to-edit:

```json
{
  "slide_id": "s3",
  "components": [
    {"id": "s3_title", "type": "title", "content": "Market Opportunity"},
    {"id": "s3_chart1", "type": "chart", "spec": {...}},
    {"id": "s3_bullet1", "type": "text", "content": "15% CAGR"}
  ]
}
```

### State Persistence

Simple approach - save on every interaction:

```typescript
await supabase
  .from('cims')
  .update({
    workflow_state: currentState,
    slides: currentSlides,
    updated_at: new Date()
  })
  .eq('id', cimId);
```

Resume = load row, hydrate LangGraph state, continue.

### Dependency Tracking

Agent maintains a graph of slide relationships. When user changes slide 3, agent knows to flag slides 7 and 12 for review.

---

## Functional Requirements

### FR-CIM-CORE: Framework Requirements
- FR-C01: Agent-guided workflow (no commands, conversational)
- FR-C02: User defines sections/agenda collaboratively with agent
- FR-C03: Iterative slide-by-slide creation within sections
- FR-C04: Context flows forward (prior slides inform current)
- FR-C05: Agent tracks dependencies (changes propagate awareness)
- FR-C06: Non-linear navigation with consistency checks

### FR-CIM-UI: Interface Requirements
- FR-U01: Three-panel layout (sources, conversation, preview)
- FR-U02: Sources panel shows docs/findings/Q&A from deal
- FR-U03: Structure panel shows CIM outline with progress
- FR-U04: Wireframe preview with clickable components
- FR-U05: Click-to-edit triggers agent conversation (reference in chat)
- FR-U06: Manual text editing capability

### FR-CIM-STATE: Persistence Requirements
- FR-S01: CIM saved as entity within deal
- FR-S02: Workflow state persisted (resume anytime)
- FR-S03: Slide state includes component IDs and specs
- FR-S04: Multiple CIMs per deal supported

### FR-CIM-OUTPUT: Export Requirements
- FR-O01: Wireframe PowerPoint export
- FR-O02: Comprehensive LLM prompt export
- FR-O03: (Phase 2) Styled PowerPoint export

---

## Story Breakdown

### EPIC 9: CIM BUILDER (14 Stories + 1 Spike)

#### FOUNDATION (4 stories)

| ID | Story | Description |
|----|-------|-------------|
| E9.1 | CIM Database Schema & Deal Integration | `cims` table, deal relationship, JSONB for workflow_state and slides |
| E9.2 | CIM List & Entry UI | List CIMs in deal, create new, resume existing |
| E9.3 | CIM Builder 3-Panel Layout | Sources, conversation, preview panels |
| E9.4 | Agent Orchestration Core | LangGraph workflow engine, state persistence, resume capability |

#### WORKFLOW (3 stories)

| ID | Story | Description |
|----|-------|-------------|
| E9.5 | Buyer Persona & Investment Thesis Phase | Conversational flow to define buyer type and thesis |
| E9.6 | Agenda/Outline Collaborative Definition | User + agent define CIM sections together |
| E9.7 | Slide Content Creation (RAG-powered) | Iterative slide building with RAG-sourced options |

#### PREVIEW & INTERACTION (3 stories)

| ID | Story | Description |
|----|-------|-------------|
| E9.8 | Wireframe Preview Renderer | Render slides with component IDs, clickable elements |
| E9.9 | Click-to-Reference in Chat | Click component → `📍 [id] "content"` in chat input |
| E9.10 | Visual Concept Generation | Agent generates detailed visual blueprints for each slide |

#### INTELLIGENCE (2 stories)

| ID | Story | Description |
|----|-------|-------------|
| E9.11 | Dependency Tracking & Consistency Alerts | Track slide relationships, flag affected slides on changes |
| E9.12 | Non-Linear Navigation with Context | Jump to any section, agent maintains coherence |

#### EXPORT (2 stories)

| ID | Story | Description |
|----|-------|-------------|
| E9.13 | Wireframe PowerPoint Export | Export slides as PPT with wireframe styling |
| E9.14 | LLM Prompt Export | Comprehensive prompt capturing entire CIM for LLM generation |

#### SPIKE (1)

| ID | Story | Description |
|----|-------|-------------|
| E9.S1 | Phase 2 Styled Output Research | PPTX/PDF extraction, styled preview, style guide ingestion |

---

## SPIKE E9.S1: Phase 2 Styled Output Research

### Inputs
- **PPTX** (existing presentations)
- **PDF** (brand guidelines, past decks as PDF)

### Core Requirement
All CIM previews MUST follow the extracted/confirmed style guide.

### Research Areas

#### 1. Style Extraction Pipeline

**Options:**
```
Option A: PPTX Direct
├── python-pptx for structure
├── Extract: master slides, theme colors, fonts
└── Challenge: Complex, version-dependent

Option B: PPTX → PDF → Extract
├── Convert PPTX to PDF (LibreOffice headless, or cloud API)
├── Parse PDF for visual elements
├── Extract: colors, fonts, layout regions
└── Benefit: Consistent format, works for both inputs

Option C: Image-based extraction (AI)
├── Convert slides to images
├── Vision model extracts: "primary blue #2E5BFF, sans-serif headings"
├── Logo detection and extraction
└── Benefit: Works on ANY format, handles edge cases
```

**Recommendation:** Hybrid Option B + C (PDF for consistency, vision for validation/fallback)

#### 2. Conversion Pipeline
- LibreOffice headless (free, reliable)
- CloudConvert API (paid, zero maintenance)

#### 3. Style Guide Schema

```yaml
style_guide:
  logo_url: "..."
  colors:
    primary: "#2E5BFF"
    secondary: "#1A1A2E"
    accent: "#00D9A5"
    text: "#333333"
    background: "#FFFFFF"
  fonts:
    heading: "Montserrat"
    heading_weight: 700
    body: "Open Sans"
    body_weight: 400
  spacing:
    slide_padding: 40
    element_gap: 20
```

#### 4. User Flow for Style Setup

```
┌─────────────────────────────────────────────────────┐
│  STYLE GUIDE SETUP                                  │
│                                                     │
│  Upload your brand materials:                       │
│  ┌─────────────────────────────────────────────┐   │
│  │  📎 Drop PPTX or PDF here                   │   │
│  │     (existing presentations, brand guides)   │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ─────────── or ───────────                        │
│                                                     │
│  [ Set up manually ]                               │
│                                                     │
└─────────────────────────────────────────────────────┘
```

After upload:
- System extracts colors, fonts, logo
- User reviews and adjusts
- Style applied to ALL previews

#### 5. Libraries to Evaluate

```
PDF Parsing:
- pdfplumber (Python) - text, colors, positions
- pdf2image + PIL - color palette extraction
- PyMuPDF - fonts, images, structure

PPTX Parsing:
- python-pptx - native, but limited theme extraction
- Aspose.Slides - commercial, more complete

Vision-based:
- Claude vision - "extract brand colors from this slide"

Conversion:
- LibreOffice headless (free, reliable)
- CloudConvert API (paid, zero maintenance)
```

### Deliverables
- [ ] Extraction pipeline prototype (PDF + PPTX)
- [ ] Style guide schema definition
- [ ] Styled preview of 3 sample slides
- [ ] Accuracy report: What extracts reliably vs needs user input
- [ ] Recommended architecture
- [ ] Effort estimate for full implementation

### Timebox
1 sprint (research + prototype)

### Test Cases for Spike
- Corporate PPTX (complex themes)
- Simple PPTX (basic styling)
- PDF brand guide (text + images)
- PDF of slides (exported deck)
- Edge cases: No clear brand colors, unusual fonts

**Success Criteria:** 80%+ accurate extraction on colors/logo, with graceful fallback for fonts.

---

## Testing Strategy

### High Risk (test first)
- **E9.4** (Orchestration) - the brain. Integration tests for state persistence/resume
- **E9.11** (Dependencies) - unit tests for consistency detection
- **E9.13** (PPT Export) - output validation

### Medium Risk
- E9.6 (Slide Creation) - RAG integration complexity
- E9.9 (Click-to-Reference) - component reference reliability

### End-to-End Test
Create CIM → build 3 slides → close browser → resume → export. If that works, we're solid.

---

## Open Questions (Resolved)

| Question | Resolution |
|----------|------------|
| What CIM sections are in scope? | Framework supports ANY sections - user defines with agent |
| Preview fidelity for MVP? | Wireframe (styled is Phase 2 spike) |
| Output format? | Wireframe PPT + LLM prompt (styled PPT is Phase 2) |
| Multiple CIMs per deal? | Yes, supported |
| Slash commands? | No - agent-guided conversation only |
| State persistence complexity? | Keep simple - save on every interaction, resume loads state |

---

## Next Steps

1. **Write detailed acceptance criteria** for each of the 14 stories
2. **Create tech spec** for Epic 9
3. **Begin implementation** with Foundation stories (E9.1-E9.4)

---

*Document generated from Party Mode discussion on 2025-12-09*