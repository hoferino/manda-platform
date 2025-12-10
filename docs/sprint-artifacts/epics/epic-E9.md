# Epic 9: CIM Builder

**Epic ID:** E9
**Jira Issue:** SCRUM-9
**Synced:** 2025-12-09

**User Value:** Users can create complete Confidential Information Memorandums through an agent-guided, iterative workflow with a NotebookLM-inspired three-panel interface

**Description:**
Implements the CIM Builder — a comprehensive framework for creating complete CIMs through agent-guided conversation. Unlike the previous fixed 14-phase approach, this is a flexible framework where users define their own CIM structure collaboratively with the agent. Features include:

- **Agent-guided workflow** — no slash commands, everything through natural conversation
- **User-defined sections** — analysts define their CIM agenda/outline with agent guidance
- **Iterative slide-by-slide creation** — context flows forward, changes propagate backward
- **RAG/GraphRAG powered** — pulls from docs, findings, Q&A already in the deal
- **Multiple CIMs per deal** — different versions for different buyer types
- **Three-panel UI** — Sources, Conversation, and Wireframe Preview
- **Click-to-reference editing** — click any slide component to edit via chat

**Key Insight:** This is the core value-add of the product. Analysts get paid to create CIMs and present them to potential buyers. The workflow IS the product.

**Functional Requirements Covered:**
- FR-CIM-001: CIM Builder UI and Workflow Interface
- FR-CIM-002: Structured Interactive Workflow
- FR-CIM-003: Agent Intelligence and Tools
- FR-CIM-004: Workflow State Management
- FR-CIM-005: Special Commands
- FR-CIM-006: Version Control and Iteration

**Stories:**

### Foundation (4 stories)
- E9.1: CIM Database Schema & Deal Integration
- E9.2: CIM List & Entry UI
- E9.3: CIM Builder 3-Panel Layout
- E9.4: Agent Orchestration Core

### Workflow (3 stories)
- E9.5: Buyer Persona & Investment Thesis Phase
- E9.6: Agenda/Outline Collaborative Definition
- E9.7: Slide Content Creation (RAG-powered)

### Preview & Interaction (3 stories)
- E9.8: Wireframe Preview Renderer
- E9.9: Click-to-Reference in Chat
- E9.10: Visual Concept Generation

### Intelligence (2 stories)
- E9.11: Dependency Tracking & Consistency Alerts
- E9.12: Non-Linear Navigation with Context

### Export (2 stories)
- E9.13: Wireframe PowerPoint Export
- E9.14: LLM Prompt Export

### Spike (1)
- E9.S1: Phase 2 Styled Output Research

**Total Stories:** 14 + 1 Spike

**Priority:** P1

---

## Story Details

### E9.1: CIM Database Schema & Deal Integration

**Story ID:** E9.1
**Points:** 3

**Description:**
Create the `cims` table with deal relationship and JSONB storage for workflow state and slides. Support multiple CIMs per deal.

**Acceptance Criteria:**
- [ ] `cims` table created with: id, deal_id, name, workflow_state (JSONB), slides (JSONB), created_at, updated_at
- [ ] Foreign key relationship to deals table
- [ ] RLS policies for deal-based access control
- [ ] TypeScript types generated for CIM entities
- [ ] API endpoints: GET /deals/[id]/cims, POST /deals/[id]/cims, GET/PUT /cims/[id]

**Technical Notes:**
```sql
CREATE TABLE cims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  workflow_state JSONB DEFAULT '{}',
  slides JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### E9.2: CIM List & Entry UI

**Story ID:** E9.2
**Points:** 2

**Description:**
Build UI to list existing CIMs within a deal, create new CIMs, and resume existing ones.

**Acceptance Criteria:**
- [ ] CIM list view at `/projects/[id]/cim-builder`
- [ ] Display CIM cards showing: name, last updated, progress indicator
- [ ] "Create New CIM" button with name input
- [ ] Click to resume existing CIM
- [ ] Delete CIM with confirmation
- [ ] Empty state when no CIMs exist

---

### E9.3: CIM Builder 3-Panel Layout

**Story ID:** E9.3
**Points:** 5

**Description:**
Implement the NotebookLM-inspired three-panel layout: Sources (left), Conversation (center), Preview (right).

**Acceptance Criteria:**
- [ ] Three-panel responsive layout
- [ ] **Sources Panel (left):**
  - Expandable sections for Documents, Findings, Q&A
  - Shows items from current deal
  - Click to reference in conversation
- [ ] **Conversation Panel (center):**
  - Chat interface with agent
  - Message history with scroll
  - Input area at bottom
- [ ] **Preview Panel (right):**
  - Slide preview area
  - Navigation: Prev/Next buttons
  - Slide counter (e.g., "Slide 3 of 24")
- [ ] **Structure sidebar** within Sources panel:
  - Shows CIM outline with progress icons (checkmark, spinner, pending)
  - Click to jump to section

**UI Reference:**
```
┌──────────────┬──────────────────────────────┬───────────────────────┐
│  SOURCES     │  CONVERSATION                │  PREVIEW              │
│              │                              │                       │
│  [Docs]      │  Agent + User messages       │  [Slide Wireframe]    │
│  [Findings]  │                              │                       │
│  [Q&A]       │                              │  ◀ Prev │ Next ▶      │
│              │                              │                       │
│  ─────────── │                              │  Slide 3 of 24        │
│  STRUCTURE   │  [Input]                     │                       │
│  [Outline]   │                              │                       │
└──────────────┴──────────────────────────────┴───────────────────────┘
```

---

### E9.4: Agent Orchestration Core

**Story ID:** E9.4
**Points:** 8

**Description:**
Implement the LangGraph workflow engine that powers the agent-guided CIM creation process. This is the brain of the CIM Builder.

**Acceptance Criteria:**
- [ ] LangGraph workflow with nodes for each phase (Persona → Thesis → Outline → Slide Creation)
- [ ] State persistence: save to `cims.workflow_state` on every interaction
- [ ] Resume capability: load state and continue from any point
- [ ] Context accumulation: prior decisions inform current suggestions
- [ ] Human-in-the-loop: agent proposes, user approves
- [ ] Phase transitions: agent guides user through workflow naturally
- [ ] Error recovery: graceful handling of failed LLM calls

**Technical Notes:**
- Use LangGraph with checkpointing
- Workflow state includes: current_phase, buyer_persona, investment_thesis, outline, slides, conversation_history
- Agent has access to RAG tools for deal context

---

### E9.5: Buyer Persona & Investment Thesis Phase

**Story ID:** E9.5
**Points:** 3

**Description:**
Implement the conversational flow to define the target buyer and investment thesis at the start of CIM creation.

**Acceptance Criteria:**
- [ ] Agent initiates with "Who is your target buyer?"
- [ ] Capture buyer type: Strategic, Financial, Management, etc.
- [ ] Agent probes for buyer priorities and concerns
- [ ] Investment thesis co-creation: What's the compelling story?
- [ ] Agent suggests thesis angles based on deal findings
- [ ] User approves or refines thesis before proceeding
- [ ] Persona and thesis stored in workflow_state

---

### E9.6: Agenda/Outline Collaborative Definition

**Story ID:** E9.6
**Points:** 5

**Description:**
Enable users to define their CIM section structure collaboratively with the agent. No fixed template — users decide what sections their CIM needs.

**Acceptance Criteria:**
- [ ] Agent suggests initial outline based on buyer persona and thesis
- [ ] User can add, remove, reorder sections
- [ ] Agent explains purpose of suggested sections
- [ ] Support for common patterns: Exec Summary, Company Overview, Market, Financials, etc.
- [ ] Outline stored in workflow_state
- [ ] Structure panel updates to show defined outline
- [ ] User approves outline before proceeding to content creation

---

### E9.7: Slide Content Creation (RAG-powered)

**Story ID:** E9.7
**Points:** 8

**Description:**
Implement iterative slide-by-slide content creation where the agent pulls from deal context via hybrid RAG (pgvector + Neo4j) to suggest content with Q&A priority and contradiction awareness.

**Acceptance Criteria:**
- [ ] For each section, agent initiates content ideation with clear opening message
- [ ] Hybrid content retrieval uses pgvector semantic search AND Neo4j relationship queries
- [ ] Q&A answers (most recent client data) prioritized over findings and document chunks
- [ ] Agent presents 2-3 content options with source citations: `(qa: question)`, `(finding: excerpt)`, `(source: file, page)`
- [ ] User selects, modifies, or requests alternative content approaches
- [ ] Content approval changes slide status to 'approved' (reversible via non-linear navigation)
- [ ] Context flows forward: agent references buyer persona, thesis, prior slides
- [ ] Agent alerts user when findings have CONTRADICTS relationships in Neo4j
- [ ] Slide content stored in cims.slides JSONB with section_id, components, source_refs, status

---

### E9.8: Wireframe Preview Renderer

**Story ID:** E9.8
**Points:** 5

**Description:**
Render slides as wireframes with clickable component IDs for editing.

**Acceptance Criteria:**
- [ ] Render slide components: title, bullets, charts (placeholder), images (placeholder)
- [ ] Each component has stable ID (e.g., `s3_title`, `s3_bullet1`)
- [ ] Wireframe styling: boxes, placeholder graphics, clean layout
- [ ] Components are clickable (for click-to-reference feature)
- [ ] Preview updates when slide content changes
- [ ] Navigation between slides

**Component Structure:**
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

---

### E9.9: Click-to-Reference in Chat

**Story ID:** E9.9
**Points:** 3

**Description:**
When user clicks a component in the preview, insert a reference into the chat input for easy editing.

**Acceptance Criteria:**
- [ ] Click component in preview → reference appears in chat input
- [ ] Reference format: `[s3_bullet1] "15% CAGR"`
- [ ] User can type edit instruction after reference
- [ ] Agent parses reference and knows exactly which component
- [ ] Agent makes update and re-renders preview
- [ ] Works for all component types: titles, bullets, chart specs

**Example Flow:**
```
User clicks bullet showing "15% CAGR"
Chat input populates: 📍 [s3_bullet1] "15% CAGR" -
User completes: 📍 [s3_bullet1] "15% CAGR" - change to 22% based on Q3 findings
Agent updates component and confirms
```

---

### E9.10: Visual Concept Generation

**Story ID:** E9.10
**Points:** 5

**Description:**
Agent generates detailed visual blueprints for each slide, describing layout, chart types, and visual elements.

**Acceptance Criteria:**
- [ ] After content approval, agent proposes visual concept
- [ ] Visual blueprint includes: layout type, chart recommendations, image suggestions
- [ ] Agent explains WHY specific visuals support the narrative
- [ ] User can request alternatives or modifications
- [ ] Visual spec stored with slide data
- [ ] Preview renders based on visual spec

---

### E9.11: Dependency Tracking & Consistency Alerts

**Story ID:** E9.11
**Points:** 5

**Description:**
Track relationships between slides so that when one changes, the system flags dependent slides for review.

**Acceptance Criteria:**
- [ ] Agent maintains dependency graph between slides
- [ ] When user edits slide 3, agent identifies slides referencing slide 3 content
- [ ] Affected slides flagged in Structure panel
- [ ] Agent proactively suggests: "This change may affect slides 7 and 12"
- [ ] User can review flagged slides
- [ ] Coherence check: agent validates narrative flow across slides

---

### E9.12: Non-Linear Navigation with Context

**Story ID:** E9.12
**Points:** 3

**Description:**
Allow users to jump to any section while the agent maintains context and coherence.

**Acceptance Criteria:**
- [ ] Click any section in Structure panel to jump
- [ ] Agent acknowledges jump and summarizes current state
- [ ] Agent tracks which sections are complete, in-progress, pending
- [ ] Forward jumps: agent notes what will be skipped
- [ ] Backward jumps: agent notes what may need updating
- [ ] Coherence warnings when navigation creates inconsistencies

---

### E9.13: Wireframe PowerPoint Export

**Story ID:** E9.13
**Points:** 5

**Description:**
Export the CIM as a wireframe PowerPoint presentation.

**Acceptance Criteria:**
- [ ] "Export" button in CIM Builder
- [ ] Generate PPTX with wireframe styling
- [ ] One slide per CIM section
- [ ] Placeholders for charts/images with specs noted
- [ ] Text content included
- [ ] Download triggered in browser
- [ ] File named: `{CIM Name} - Wireframe.pptx`

**Technical Notes:**
- Use pptxgenjs or similar library
- Wireframe style: gray boxes, placeholder graphics

---

### E9.14: LLM Prompt Export

**Story ID:** E9.14
**Points:** 3

**Description:**
Export a comprehensive prompt that captures the entire CIM context for external LLM generation.

**Acceptance Criteria:**
- [ ] "Export LLM Prompt" option
- [ ] Prompt includes: buyer persona, thesis, outline, all slide content, visual specs
- [ ] Structured format for easy LLM consumption
- [ ] Copy to clipboard or download as .txt
- [ ] Useful for generating styled presentations externally

---

### E9.S1: Phase 2 Styled Output Research (SPIKE)

**Story ID:** E9.S1
**Points:** 5
**Type:** Spike

**Description:**
Research how to extract brand styles from uploaded PPTX/PDF files and apply them to CIM previews and exports.

**Research Areas:**
1. **Style Extraction:** PPTX parsing (python-pptx), PDF parsing (PyMuPDF), Vision-based extraction
2. **Conversion Pipeline:** LibreOffice headless vs CloudConvert API
3. **Style Guide Schema:** Colors, fonts, spacing, logo handling
4. **User Flow:** Upload → Extract → Review → Apply

**Deliverables:**
- [ ] Extraction pipeline prototype (PDF + PPTX)
- [ ] Style guide schema definition
- [ ] Styled preview of 3 sample slides
- [ ] Accuracy report: What extracts reliably vs needs user input
- [ ] Recommended architecture
- [ ] Effort estimate for full implementation

**Timebox:** 1 sprint

**Success Criteria:** 80%+ accurate extraction on colors/logo, with graceful fallback for fonts.

---

## Testing Strategy

### High Risk (test first)
- **E9.4** (Orchestration) — the brain. Integration tests for state persistence/resume
- **E9.11** (Dependencies) — unit tests for consistency detection
- **E9.13** (PPT Export) — output validation

### Medium Risk
- **E9.7** (Slide Creation) — RAG integration complexity
- **E9.9** (Click-to-Reference) — component reference reliability

### End-to-End Test
Create CIM → build 3 slides → close browser → resume → export. If that works, we're solid.

---

**Full Details:** See [docs/sprint-artifacts/epic-E9-party-mode-findings.md](../epic-E9-party-mode-findings.md)