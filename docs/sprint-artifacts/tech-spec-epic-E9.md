# Epic Technical Specification: CIM Builder

Date: 2025-12-09
Author: Max
Epic ID: E9
Status: Draft

---

## Overview

Epic E9 delivers the **CIM Builder** — a comprehensive framework for creating Confidential Information Memorandums (CIMs) through an agent-guided, iterative workflow. This is the core value-add of the Manda platform: M&A analysts are paid to create CIMs and present them to potential buyers, making this workflow the product's primary differentiator.

**Key Capabilities:**
- **Agent-guided workflow** — no slash commands, everything through natural conversation
- **User-defined sections** — analysts define their CIM agenda/outline collaboratively with the agent
- **Iterative slide-by-slide creation** — context flows forward, changes propagate backward with dependency tracking
- **RAG/GraphRAG powered** — pulls from documents, findings, and Q&A already in the deal
- **Multiple CIMs per deal** — different versions for different buyer types (strategic, financial, management)
- **Three-panel NotebookLM-inspired UI** — Sources (left), Conversation (center), Wireframe Preview (right)
- **Click-to-reference editing** — click any slide component to edit via chat

**Business Value:** Enables analysts to create professional CIMs 5-10x faster than traditional methods while ensuring consistency with deal data and source traceability.

**Stories:** 15 implementation stories (E9.1-E9.15)
**Total Story Points:** ~60 points

## Objectives and Scope

### Objectives

1. **O1: Agent-Guided CIM Creation** — Implement conversational workflow where analysts create CIMs through natural dialogue with an AI agent (no slash commands)
2. **O2: Three-Panel Interface** — Build NotebookLM-inspired UI with Sources, Conversation, and Preview panels
3. **O3: RAG-Powered Content Generation** — Enable agent to pull relevant content from deal documents, findings, and Q&A
4. **O4: Workflow State Persistence** — Allow users to pause and resume CIM creation at any point
5. **O5: Wireframe Export** — Generate wireframe PowerPoint and LLM prompt exports for downstream use

### In Scope

| Area | Details |
|------|---------|
| **Database** | `cims` table with JSONB workflow_state and slides columns (E9.1) |
| **UI** | CIM list view, 3-panel builder layout, wireframe preview renderer (E9.2, E9.3, E9.8) |
| **Agent Core** | LangGraph workflow engine with state persistence and resume (E9.4) |
| **Workflow Phases** | Buyer persona, investment thesis, outline definition, slide content creation (E9.5, E9.6, E9.7) |
| **Interaction** | Click-to-reference in chat, non-linear navigation (E9.9, E9.13) |
| **Intelligence** | Dependency tracking, consistency alerts, narrative structure, visual concept generation (E9.10, E9.11, E9.12) |
| **Export** | Wireframe PPT export, LLM prompt export (E9.14, E9.15) |

### Out of Scope (MVP)

| Area | Rationale |
|------|-----------|
| **Styled PowerPoint export** | Deferred to Phase 2 (spike in Phase 2 backlog) |
| **Brand style extraction from PPTX/PDF** | Phase 2 feature |
| **Real-time collaboration** | Single-user workflow for MVP |
| **Version diffing UI** | Version history stored but no visual diff |
| **Mobile-responsive CIM Builder** | Desktop-only for MVP (complex 3-panel layout) |
| **GraphRAG integration** | Will use existing RAG; GraphRAG is enhancement |

## System Architecture Alignment

### Architecture Fit

The CIM Builder aligns with the existing Manda architecture:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js 16)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  CIM Builder UI                                                              │
│  ┌────────────┬──────────────────────────┬────────────────────────────────┐ │
│  │  Sources   │  Conversation Panel      │  Preview Panel                 │ │
│  │  Panel     │  (uses existing chat     │  (new wireframe renderer)      │ │
│  │  (reuses   │   streaming infra)       │                                │ │
│  │  existing  │                          │                                │ │
│  │  components│                          │                                │ │
│  └────────────┴──────────────────────────┴────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API LAYER (Next.js API Routes)                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  /api/cims/[id]              - CRUD for CIM entities                         │
│  /api/cims/[id]/chat         - Streaming agent conversation (extends chat)   │
│  /api/cims/[id]/export/pptx  - PowerPoint wireframe export                   │
│  /api/cims/[id]/export/prompt- LLM prompt export                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AGENT LAYER                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  CIM Agent (LangGraph)                                                       │
│  ├── State: workflow_state, slides[], conversation_history                   │
│  ├── Nodes: persona → thesis → outline → slide_content → visual_concept     │
│  ├── Tools: RAG query, findings search, Q&A lookup, slide update            │
│  └── Checkpoints: Supabase-backed state persistence                          │
│                                                                              │
│  Extends existing: lib/agent/executor.ts, lib/agent/streaming.ts             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL)                                                       │
│  ├── cims table (existing - needs schema extension)                          │
│  ├── deals table (existing - parent relationship)                            │
│  ├── documents, findings, qa_items (existing - RAG sources)                  │
│  └── document_chunks (existing - vector search)                              │
│                                                                              │
│  Neo4j (optional enhancement)                                                │
│  └── GraphRAG for cross-document relationships                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Integration Points

| Existing Component | CIM Builder Integration |
|-------------------|------------------------|
| `lib/agent/executor.ts` | Extend with CIM-specific agent workflow |
| `lib/agent/streaming.ts` | Reuse for conversation streaming |
| `lib/agent/tools/` | Add CIM-specific tools (slide_update, visual_concept) |
| `lib/services/rag.ts` | Query deal documents for content suggestions |
| `components/chat/` | Adapt for CIM conversation panel |
| `lib/supabase/` | Add CIM service methods |

### Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **State Storage** | JSONB in Supabase | Simple, queryable, no extra infrastructure |
| **Agent Framework** | LangGraph | Already used for chat; supports checkpointing |
| **Export Library** | pptxgenjs | Client-side, zero server dependencies |
| **Preview Rendering** | React components | Fast iteration, no canvas complexity |
| **RAG Integration** | Existing vector search | Leverage document_chunks embeddings |

## Detailed Design

### Services and Modules

#### 1. CIM Service (`lib/services/cim-service.ts`)

**Responsibility:** CRUD operations for CIM entities, state management

```typescript
interface CIMService {
  // CRUD
  createCIM(dealId: string, name: string): Promise<CIM>
  getCIM(cimId: string): Promise<CIM>
  getCIMsForDeal(dealId: string): Promise<CIM[]>
  updateCIM(cimId: string, updates: Partial<CIM>): Promise<CIM>
  deleteCIM(cimId: string): Promise<void>

  // State Management
  updateWorkflowState(cimId: string, state: WorkflowState): Promise<void>
  updateSlides(cimId: string, slides: Slide[]): Promise<void>
  appendConversation(cimId: string, messages: Message[]): Promise<void>
}
```

#### 2. CIM Agent (`lib/agent/cim/`)

**Responsibility:** LangGraph workflow orchestration for CIM creation

```
lib/agent/cim/
├── workflow.ts        # LangGraph graph definition
├── nodes/
│   ├── persona.ts     # Buyer persona elicitation
│   ├── thesis.ts      # Investment thesis co-creation
│   ├── outline.ts     # Agenda/outline definition
│   ├── content.ts     # Slide content creation (RAG)
│   └── visual.ts      # Visual concept generation
├── tools/
│   ├── rag-query.ts   # Query deal documents
│   ├── findings.ts    # Search findings
│   ├── qa-lookup.ts   # Look up Q&A items
│   ├── slide-update.ts # Update slide content
│   └── dependency.ts  # Track slide dependencies
├── state.ts           # State schema and types
└── checkpointer.ts    # Supabase checkpointer adapter
```

#### 3. CIM Export Service (`lib/services/cim-export.ts`)

**Responsibility:** Generate PowerPoint and LLM prompt exports

```typescript
interface CIMExportService {
  exportWireframePPTX(cim: CIM): Promise<Blob>
  exportLLMPrompt(cim: CIM): Promise<string>
}
```

#### 4. UI Components (`components/cim-builder/`)

```
components/cim-builder/
├── CIMBuilderLayout.tsx      # 3-panel layout container
├── SourcesPanel/
│   ├── SourcesPanel.tsx      # Left panel container
│   ├── DocumentsList.tsx     # Deal documents
│   ├── FindingsList.tsx      # Deal findings
│   ├── QAList.tsx            # Deal Q&A items
│   └── StructureTree.tsx     # CIM outline with progress
├── ConversationPanel/
│   ├── ConversationPanel.tsx # Center panel container
│   ├── MessageList.tsx       # Chat messages
│   ├── AgentMessage.tsx      # Agent responses with sources
│   └── ChatInput.tsx         # Input with reference support
├── PreviewPanel/
│   ├── PreviewPanel.tsx      # Right panel container
│   ├── SlidePreview.tsx      # Wireframe slide renderer
│   ├── SlideNavigation.tsx   # Prev/Next + slide counter
│   └── ComponentRenderer.tsx # Render slide components
├── CIMList/
│   ├── CIMListPage.tsx       # List CIMs for deal
│   └── CIMCard.tsx           # CIM summary card
└── hooks/
    ├── useCIMAgent.ts        # Agent communication hook
    ├── useCIMState.ts        # Local state management
    └── useSlideNavigation.ts # Slide navigation state
```

### Data Models and Contracts

#### Database Schema

**cims table** (extend existing)

```sql
-- Existing columns (already in schema):
-- id, deal_id, title, content, workflow_state, version, export_formats, user_id, created_at, updated_at

-- Extended schema for E9:
ALTER TABLE cims ADD COLUMN IF NOT EXISTS slides JSONB DEFAULT '[]';
ALTER TABLE cims ADD COLUMN IF NOT EXISTS buyer_persona JSONB DEFAULT '{}';
ALTER TABLE cims ADD COLUMN IF NOT EXISTS investment_thesis TEXT;
ALTER TABLE cims ADD COLUMN IF NOT EXISTS outline JSONB DEFAULT '[]';
ALTER TABLE cims ADD COLUMN IF NOT EXISTS dependency_graph JSONB DEFAULT '{}';
ALTER TABLE cims ADD COLUMN IF NOT EXISTS conversation_history JSONB DEFAULT '[]';

-- Indexes for query performance
CREATE INDEX IF NOT EXISTS idx_cims_deal_id ON cims(deal_id);
CREATE INDEX IF NOT EXISTS idx_cims_workflow_state ON cims USING GIN(workflow_state);
```

#### TypeScript Types

```typescript
// lib/types/cim.ts

export interface CIM {
  id: string
  deal_id: string
  title: string
  user_id: string
  version: number
  workflow_state: WorkflowState
  buyer_persona: BuyerPersona
  investment_thesis: string | null
  outline: OutlineSection[]
  slides: Slide[]
  dependency_graph: DependencyGraph
  conversation_history: ConversationMessage[]
  export_formats: string[] | null
  created_at: string
  updated_at: string
}

export interface WorkflowState {
  current_phase: CIMPhase
  current_section_index: number | null
  current_slide_index: number | null
  completed_phases: CIMPhase[]
  is_complete: boolean
}

export type CIMPhase =
  | 'persona'
  | 'thesis'
  | 'outline'
  | 'content_creation'
  | 'visual_concepts'
  | 'review'
  | 'complete'

export interface BuyerPersona {
  buyer_type: 'strategic' | 'financial' | 'management' | 'other'
  buyer_description: string
  priorities: string[]
  concerns: string[]
  key_metrics: string[]
}

export interface OutlineSection {
  id: string
  title: string
  description: string
  order: number
  status: 'pending' | 'in_progress' | 'complete'
  slide_ids: string[]
}

export interface Slide {
  id: string                    // e.g., "s1", "s2"
  section_id: string
  title: string
  components: SlideComponent[]
  visual_concept: VisualConcept | null
  status: 'draft' | 'approved' | 'locked'
  created_at: string
  updated_at: string
}

export interface SlideComponent {
  id: string                    // e.g., "s1_title", "s1_bullet1"
  type: 'title' | 'subtitle' | 'text' | 'bullet' | 'chart' | 'image' | 'table'
  content: string
  metadata?: Record<string, unknown>
  source_refs?: SourceReference[]
}

export interface SourceReference {
  type: 'document' | 'finding' | 'qa'
  id: string
  title: string
  excerpt?: string
}

export interface VisualConcept {
  layout_type: 'title_slide' | 'content' | 'two_column' | 'chart_focus' | 'image_focus'
  chart_recommendations?: ChartRecommendation[]
  image_suggestions?: string[]
  notes: string
}

export interface ChartRecommendation {
  type: 'bar' | 'line' | 'pie' | 'area' | 'table'
  data_description: string
  purpose: string
}

export interface DependencyGraph {
  // slide_id -> array of slide_ids that depend on it
  dependencies: Record<string, string[]>
  // slide_id -> array of slide_ids it references
  references: Record<string, string[]>
}

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  metadata?: {
    phase?: CIMPhase
    slide_ref?: string
    component_ref?: string
    sources?: SourceReference[]
  }
}
```

#### Zod Schemas (for validation)

```typescript
// lib/agent/cim/schemas.ts

import { z } from 'zod'

export const buyerPersonaSchema = z.object({
  buyer_type: z.enum(['strategic', 'financial', 'management', 'other']),
  buyer_description: z.string().min(10),
  priorities: z.array(z.string()).min(1),
  concerns: z.array(z.string()),
  key_metrics: z.array(z.string()),
})

export const slideComponentSchema = z.object({
  id: z.string(),
  type: z.enum(['title', 'subtitle', 'text', 'bullet', 'chart', 'image', 'table']),
  content: z.string(),
  metadata: z.record(z.unknown()).optional(),
  source_refs: z.array(z.object({
    type: z.enum(['document', 'finding', 'qa']),
    id: z.string(),
    title: z.string(),
    excerpt: z.string().optional(),
  })).optional(),
})

export const slideSchema = z.object({
  id: z.string(),
  section_id: z.string(),
  title: z.string(),
  components: z.array(slideComponentSchema),
  visual_concept: z.object({
    layout_type: z.enum(['title_slide', 'content', 'two_column', 'chart_focus', 'image_focus']),
    chart_recommendations: z.array(z.object({
      type: z.enum(['bar', 'line', 'pie', 'area', 'table']),
      data_description: z.string(),
      purpose: z.string(),
    })).optional(),
    image_suggestions: z.array(z.string()).optional(),
    notes: z.string(),
  }).nullable(),
  status: z.enum(['draft', 'approved', 'locked']),
  created_at: z.string(),
  updated_at: z.string(),
})
```

### APIs and Interfaces

#### REST API Endpoints

**CIM CRUD**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/deals/[dealId]/cims` | List all CIMs for a deal |
| POST | `/api/deals/[dealId]/cims` | Create a new CIM |
| GET | `/api/cims/[cimId]` | Get CIM details |
| PUT | `/api/cims/[cimId]` | Update CIM (name, etc.) |
| DELETE | `/api/cims/[cimId]` | Delete a CIM |

**CIM State & Workflow**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cims/[cimId]/chat` | Send message to CIM agent (streaming) |
| PUT | `/api/cims/[cimId]/slides` | Bulk update slides |
| PUT | `/api/cims/[cimId]/slides/[slideId]` | Update single slide |
| PUT | `/api/cims/[cimId]/slides/[slideId]/components/[componentId]` | Update single component |

**CIM Export**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cims/[cimId]/export/pptx` | Download wireframe PowerPoint |
| GET | `/api/cims/[cimId]/export/prompt` | Get LLM prompt export |

#### API Request/Response Schemas

**POST /api/deals/[dealId]/cims**

```typescript
// Request
{
  name: string
}

// Response
{
  id: string
  deal_id: string
  name: string
  workflow_state: {
    current_phase: 'persona'
    completed_phases: []
    is_complete: false
  }
  slides: []
  created_at: string
}
```

**POST /api/cims/[cimId]/chat** (Streaming)

```typescript
// Request
{
  message: string
  component_ref?: string  // e.g., "s3_bullet1" for click-to-reference
}

// Response (Server-Sent Events)
// Event: message_start
{ type: 'message_start', id: string }

// Event: content_delta
{ type: 'content_delta', delta: string }

// Event: tool_use
{ type: 'tool_use', tool: string, input: object }

// Event: slide_update
{ type: 'slide_update', slide: Slide }

// Event: phase_transition
{ type: 'phase_transition', from: CIMPhase, to: CIMPhase }

// Event: message_end
{ type: 'message_end', sources: SourceReference[] }
```

**GET /api/cims/[cimId]/export/pptx**

```typescript
// Response: Binary blob (application/vnd.openxmlformats-officedocument.presentationml.presentation)
// Headers:
// Content-Disposition: attachment; filename="{CIM Name} - Wireframe.pptx"
```

#### WebSocket Events (Optional Enhancement)

For real-time preview updates:

```typescript
// Client -> Server
{ type: 'subscribe', cim_id: string }

// Server -> Client
{ type: 'slide_updated', slide: Slide }
{ type: 'dependency_alert', affected_slides: string[], trigger_slide: string }
{ type: 'coherence_warning', message: string, slides: string[] }
```

### Workflows and Sequencing

#### CIM Creation Workflow (LangGraph)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CIM BUILDER WORKFLOW                                  │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │   START     │
                              └──────┬──────┘
                                     │
                                     ▼
                    ┌────────────────────────────────┐
                    │  PERSONA NODE                  │
                    │  - Ask about target buyer      │
                    │  - Capture buyer type          │
                    │  - Identify priorities/concerns│
                    │  → Store buyer_persona         │
                    └────────────────┬───────────────┘
                                     │ user approves
                                     ▼
                    ┌────────────────────────────────┐
                    │  THESIS NODE                   │
                    │  - Co-create investment thesis │
                    │  - RAG: pull relevant findings │
                    │  - Suggest thesis angles       │
                    │  → Store investment_thesis     │
                    └────────────────┬───────────────┘
                                     │ user approves
                                     ▼
                    ┌────────────────────────────────┐
                    │  OUTLINE NODE                  │
                    │  - Suggest initial outline     │
                    │  - User adds/removes/reorders  │
                    │  - Explain section purposes    │
                    │  → Store outline[]             │
                    └────────────────┬───────────────┘
                                     │ user approves
                                     ▼
              ┌─────────────────────────────────────────────┐
              │              FOR EACH SECTION               │
              │  ┌─────────────────────────────────────┐   │
              │  │  CONTENT NODE                       │   │
              │  │  - RAG: query relevant content      │   │
              │  │  - Present content options          │   │
              │  │  - User selects/modifies            │   │
              │  │  → Create slide with components     │   │
              │  └─────────────────┬───────────────────┘   │
              │                    │ user approves         │
              │                    ▼                       │
              │  ┌─────────────────────────────────────┐   │
              │  │  VISUAL NODE                        │   │
              │  │  - Generate visual concept          │   │
              │  │  - Suggest layout, charts           │   │
              │  │  - User approves/modifies           │   │
              │  │  → Store visual_concept on slide    │   │
              │  └─────────────────┬───────────────────┘   │
              │                    │                       │
              └────────────────────┼───────────────────────┘
                                   │ all sections complete
                                   ▼
                    ┌────────────────────────────────┐
                    │  REVIEW NODE                   │
                    │  - Coherence check             │
                    │  - Flag inconsistencies        │
                    │  - Final approval              │
                    └────────────────┬───────────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │   COMPLETE  │
                              └─────────────┘
```

#### State Persistence Flow

```
User sends message
        │
        ▼
┌───────────────────┐
│ Load CIM from DB  │
│ (workflow_state,  │
│  slides, etc.)    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Hydrate LangGraph │
│ state from CIM    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Execute workflow  │
│ step (streaming)  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Save updated      │
│ state to DB       │
│ (on every turn)   │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Return streaming  │
│ response to UI    │
└───────────────────┘
```

#### Click-to-Reference Flow

```
User clicks component "s3_bullet1" in preview
        │
        ▼
┌───────────────────────────────────────┐
│ Chat input populated:                 │
│ 📍 [s3_bullet1] "15% CAGR" -          │
└─────────────────┬─────────────────────┘
                  │
                  ▼
User completes message:
"📍 [s3_bullet1] '15% CAGR' - change to 22% based on Q3"
                  │
                  ▼
┌───────────────────────────────────────┐
│ Agent parses reference:               │
│ - component_id: s3_bullet1            │
│ - current_content: "15% CAGR"         │
│ - instruction: "change to 22%..."     │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Agent updates component:              │
│ - Validate change against sources     │
│ - Update slide.components             │
│ - Check dependency graph              │
│ - Flag affected slides                │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Response to user:                     │
│ "Updated s3_bullet1 to '22% CAGR'.    │
│  Note: Slides 7 and 12 may need       │
│  review as they reference this data." │
└───────────────────────────────────────┘
```

#### Non-Linear Navigation Flow

```
User clicks "Market Analysis" in Structure panel
        │
        ▼
┌───────────────────────────────────────┐
│ Check current workflow state:         │
│ - Current section: "Company Overview" │
│ - Target section: "Market Analysis"   │
│ - Skipping: "Financial Performance"   │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Agent acknowledges jump:              │
│ "Jumping to Market Analysis.          │
│  Skipping Financial Performance       │
│  (you can return to it later).        │
│  Current state: Market has 0/3        │
│  slides complete."                    │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Update workflow_state:                │
│ - current_section_index = 3           │
│ - Mark navigation in history          │
└───────────────────────────────────────┘
```

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| **CIM load time** | < 2s | Users expect instant resume |
| **Agent response start** | < 1s TTFB | Streaming should feel responsive |
| **Slide preview render** | < 100ms | Interactive feel for click-to-reference |
| **State save** | < 500ms | Must not block conversation |
| **PPTX export** | < 5s for 30 slides | Acceptable wait for export |
| **RAG query** | < 2s | Content suggestions must be fast |

**Optimization Strategies:**
- Lazy load slides not in viewport
- Debounce state saves (save after 500ms idle)
- Use React.memo for slide components
- Pre-fetch adjacent slides during navigation
- Client-side PPTX generation (no server round-trip)

### Security

| Requirement | Implementation |
|-------------|----------------|
| **Authentication** | Existing Supabase Auth (JWT) |
| **Authorization** | RLS: Users can only access CIMs for their deals |
| **Data isolation** | CIMs are deal-scoped; deal access implies CIM access |
| **Input validation** | Zod schemas for all API inputs |
| **XSS prevention** | React's built-in escaping; sanitize markdown in agent responses |
| **Rate limiting** | Existing API rate limits apply |

**RLS Policy:**
```sql
-- CIM access follows deal access
CREATE POLICY "Users can access CIMs for their deals" ON cims
FOR ALL USING (
  deal_id IN (
    SELECT id FROM deals WHERE user_id = auth.uid()
  )
);
```

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| **State durability** | Save on every interaction; JSONB in PostgreSQL |
| **Resume capability** | Load full state from DB; rehydrate LangGraph |
| **Error recovery** | Graceful degradation; retry failed LLM calls |
| **Data backup** | Supabase automatic backups |
| **Offline tolerance** | Queue messages if disconnected; sync on reconnect |

**Error Handling:**
- LLM failure: Retry 3x with exponential backoff; show user-friendly error
- Save failure: Show warning; retry in background; allow manual retry
- RAG failure: Continue without sources; note "sources unavailable"

### Observability

| Metric | Tool | Purpose |
|--------|------|---------|
| **CIM creation rate** | Supabase logs | Track feature adoption |
| **Agent latency** | Custom logging | Identify slow workflows |
| **Export success rate** | Error tracking | Monitor export reliability |
| **Phase completion** | Analytics | Understand where users drop off |
| **Error rate by phase** | Error tracking | Identify problematic phases |

**Key Events to Log:**
```typescript
// Example logging
trackEvent('cim_created', { deal_id, cim_id })
trackEvent('cim_phase_completed', { cim_id, phase, duration_ms })
trackEvent('cim_exported', { cim_id, format: 'pptx', slide_count })
trackEvent('cim_error', { cim_id, phase, error_type })
```

## Dependencies and Integrations

### External Dependencies

| Dependency | Version | Purpose | Notes |
|------------|---------|---------|-------|
| `@langchain/anthropic` | ^1.1.3 | Claude API for agent | Already installed |
| `@langchain/core` | ^1.1.0 | LangGraph runtime | Already installed |
| `langchain` | ^1.1.1 | Agent tools & chains | Already installed |
| `pptxgenjs` | ^3.12.0 | PowerPoint generation | **NEW - needs install** |
| `@supabase/supabase-js` | ^2.84.0 | Database & auth | Already installed |
| `zod` | ^4.1.13 | Schema validation | Already installed |
| `zustand` | ^5.0.8 | UI state management | Already installed |

### Internal Dependencies (Existing Modules)

| Module | Path | Integration |
|--------|------|-------------|
| Agent Executor | `lib/agent/executor.ts` | Base for CIM agent |
| Agent Streaming | `lib/agent/streaming.ts` | Conversation streaming |
| Agent Tools | `lib/agent/tools/` | RAG tools, findings tools |
| Supabase Client | `lib/supabase/` | Database operations |
| Deal Service | `lib/services/deal-service.ts` | Deal context |
| Document Service | `lib/services/document-service.ts` | Document access |
| Findings Service | `lib/services/findings-service.ts` | Findings access |
| Q&A Service | `lib/services/qa-service.ts` | Q&A access |
| Chat Components | `components/chat/` | Message rendering |

### Database Dependencies

| Table | Relationship | Usage |
|-------|--------------|-------|
| `deals` | Parent | CIM belongs to deal |
| `documents` | Reference | Sources panel, RAG |
| `findings` | Reference | Sources panel, content |
| `qa_items` | Reference | Sources panel, content |
| `document_chunks` | Reference | Vector search for RAG |

### API Dependencies

| API | Purpose | Stories |
|-----|---------|---------|
| Anthropic Claude | Agent responses | E9.4, E9.5, E9.6, E9.7, E9.10 |
| Supabase | Data persistence | All stories |
| Existing RAG API | Content suggestions | E9.7 |

### Story Dependencies (Implementation Order)

```
E9.1 (Database Schema)
  │
  ├──► E9.2 (CIM List UI)
  │      │
  │      └──► E9.3 (3-Panel Layout)
  │             │
  │             ├──► E9.8 (Wireframe Preview)
  │             │      │
  │             │      └──► E9.9 (Click-to-Reference)
  │             │
  │             └──► E9.4 (Agent Core) ◄──── CRITICAL PATH
  │                    │
  │                    ├──► E9.5 (Persona Phase)
  │                    │      │
  │                    │      └──► E9.6 (Outline Phase)
  │                    │             │
  │                    │             └──► E9.7 (Content Creation)
  │                    │                    │
  │                    │                    └──► E9.10 (Visual Concepts)
  │                    │
  │                    ├──► E9.11 (Dependency Tracking)
  │                    │      │
  │                    │      └──► E9.12 (Narrative Structure)
  │                    │
  │                    └──► E9.13 (Non-Linear Nav)
  │
  └──► E9.14 (PPTX Export)
         │
         └──► E9.15 (LLM Prompt Export)
```

### Prior Epics Required

| Epic | Status | Required For |
|------|--------|--------------|
| E1: Project Setup | Complete | Foundation |
| E2: Document Management | Complete | Documents in Sources panel |
| E3: Finding Extraction | Complete | Findings in Sources panel |
| E5: Chat Infrastructure | Complete | Streaming, agent patterns |
| E8: Q&A Workflow | Complete | Q&A in Sources panel |

## Acceptance Criteria (Authoritative)

### E9.1: CIM Database Schema & Deal Integration

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.1.1 | `cims` table exists with columns: id, deal_id, name, workflow_state (JSONB), slides (JSONB), buyer_persona (JSONB), investment_thesis (TEXT), outline (JSONB), dependency_graph (JSONB), conversation_history (JSONB), created_at, updated_at | Query table schema |
| AC-9.1.2 | Foreign key relationship to deals table enforced | Insert CIM with invalid deal_id fails |
| AC-9.1.3 | RLS policies enforce deal-based access control | User A cannot read User B's CIMs |
| AC-9.1.4 | TypeScript types generated and match schema | Type-check passes |
| AC-9.1.5 | API endpoints functional: GET /deals/[id]/cims, POST /deals/[id]/cims, GET/PUT/DELETE /cims/[id] | API tests pass |

### E9.2: CIM List & Entry UI

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.2.1 | CIM list view accessible at `/projects/[id]/cim-builder` | Navigate to URL |
| AC-9.2.2 | CIM cards display: name, last updated, progress indicator | Visual inspection |
| AC-9.2.3 | "Create New CIM" button opens name input dialog | Click button, see dialog |
| AC-9.2.4 | Click CIM card navigates to builder with CIM loaded | Click card, see builder |
| AC-9.2.5 | Delete CIM shows confirmation, removes from list | Delete, confirm gone |
| AC-9.2.6 | Empty state shows when no CIMs exist | View empty deal |

### E9.3: CIM Builder 3-Panel Layout

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.3.1 | Three-panel responsive layout renders (Sources, Conversation, Preview) | Visual inspection |
| AC-9.3.2 | Sources panel shows expandable sections: Documents, Findings, Q&A | Expand each section |
| AC-9.3.3 | Sources panel shows items from current deal | Compare with deal data |
| AC-9.3.4 | Conversation panel shows chat interface with message history | Send message, see history |
| AC-9.3.5 | Preview panel shows slide preview with navigation | Navigate slides |
| AC-9.3.6 | Structure sidebar shows CIM outline with progress icons | Visual inspection |

### E9.4: Agent Orchestration Core

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.4.1 | LangGraph workflow executes phases in sequence | Log phase transitions |
| AC-9.4.2 | State persisted to `cims.workflow_state` on every interaction | Query DB after message |
| AC-9.4.3 | Resume: close browser, reopen, continue from last state | Integration test |
| AC-9.4.4 | Context accumulation: prior decisions inform current | Observe suggestions |
| AC-9.4.5 | Human-in-the-loop: agent proposes, user approves | Workflow pauses for approval |
| AC-9.4.6 | Error recovery: failed LLM calls retry gracefully | Simulate failure |

### E9.5: Buyer Persona & Investment Thesis Phase

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.5.1 | Agent initiates with "Who is your target buyer?" | First message check |
| AC-9.5.2 | Agent captures buyer type (Strategic, Financial, Management, Other) | Workflow state check |
| AC-9.5.3 | Agent probes for buyer priorities and concerns | Conversation flow |
| AC-9.5.4 | Investment thesis co-created with agent suggestions | Agent provides options |
| AC-9.5.5 | Agent suggests thesis angles based on deal findings | RAG integration |
| AC-9.5.6 | Persona and thesis stored in workflow_state | DB check |

### E9.6: Agenda/Outline Collaborative Definition

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.6.1 | Agent suggests initial outline based on buyer persona | Outline proposed |
| AC-9.6.2 | User can add sections via conversation | "Add a section for..." works |
| AC-9.6.3 | User can remove sections via conversation | "Remove the..." works |
| AC-9.6.4 | User can reorder sections via conversation | "Move X before Y" works |
| AC-9.6.5 | Agent explains purpose of suggested sections | Explanations present |
| AC-9.6.6 | Outline stored in workflow_state | DB check |
| AC-9.6.7 | Structure panel updates to show defined outline | UI updates |

### E9.7: Slide Content Creation (RAG-powered)

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.7.1 | For each section, agent initiates content ideation with clear opening | Phase transition observable |
| AC-9.7.2 | Hybrid content retrieval uses pgvector semantic search AND Neo4j relationship queries | Source citations with relationship indicators |
| AC-9.7.3 | Q&A answers (most recent) prioritized over findings and document chunks | Q&A sources shown first when available |
| AC-9.7.4 | Agent presents 2-3 content options with source citations: `(qa: question)`, `(finding: excerpt)`, `(source: file, page)` | Multiple options shown |
| AC-9.7.5 | User can select, modify, or request alternative content approaches | All actions work |
| AC-9.7.6 | Content approval changes slide status to 'approved' (reversible via non-linear nav) | Status changes to 'approved' |
| AC-9.7.7 | Prior slides inform suggestions: agent references buyer persona, thesis, earlier content | Observe references to prior context |
| AC-9.7.8 | Agent alerts user when findings have CONTRADICTS relationships in Neo4j | Contradiction warnings shown |
| AC-9.7.9 | Slide content stored in cims.slides JSONB with section_id, components, source_refs, status | DB check verifies persistence |

### E9.8: Wireframe Preview Renderer

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.8.1 | Slide components render with type-appropriate visuals: title (large bold), subtitle (medium semibold), text (paragraph), bullet (list item), chart (visual wireframe of chart type - bar shows bars, pie shows segments, line shows line graph), image (placeholder with icon), table (wireframe grid with rows/columns) | Visual inspection |
| AC-9.8.2 | Each component has stable ID (e.g., s3_title, s3_bullet1) attached as `data-component-id` | Inspect DOM |
| AC-9.8.3 | Wireframe styling: muted colors, dashed borders for placeholders, 16:9 aspect ratio, professional schematic appearance | Visual inspection |
| AC-9.8.4 | Components are clickable with `onComponentClick(componentId, content)` callback | Click fires event |
| AC-9.8.5 | Preview updates when slide content changes | Modify, see update |
| AC-9.8.6 | Navigation between slides works (Prev/Next) | Click buttons |

### E9.9: Click-to-Reference in Chat

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.9.1 | Click component → reference appears in chat input | Click, see reference |
| AC-9.9.2 | Reference format: `📍 [s3_bullet1] "content" -` | String match |
| AC-9.9.3 | User can type edit instruction after reference | Type after reference |
| AC-9.9.4 | Agent parses reference and identifies component | Agent responds correctly |
| AC-9.9.5 | Agent makes update and re-renders preview | Component updates |

### E9.10: Visual Concept Generation

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.10.1 | After content approval, agent proposes visual concept | Phase transition |
| AC-9.10.2 | Visual blueprint includes layout type recommendations | Blueprint present |
| AC-9.10.3 | Agent explains WHY specific visuals support narrative | Explanations present |
| AC-9.10.4 | User can request alternatives or modifications | Request works |
| AC-9.10.5 | Visual spec stored with slide data | DB check |
| AC-9.10.6 | Preview renders based on visual spec | Preview matches spec |

### E9.11: Dependency Tracking & Consistency Alerts

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.11.1 | Agent maintains dependency graph between slides | Graph populated |
| AC-9.11.2 | Edit slide → agent identifies dependent slides | Dependency shown |
| AC-9.11.3 | Affected slides flagged in Structure panel | Flag icon visible |
| AC-9.11.4 | Agent proactively suggests review of affected slides | Agent message |
| AC-9.11.5 | User can review flagged slides | Navigation works |
| AC-9.11.6 | Coherence check validates narrative flow | Check runs |

### E9.12: Narrative Structure Dependencies

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.12.1 | Section narrative structure stored when agent creates multi-slide sections | DB check for narrativeStructure field |
| AC-9.12.2 | Each slide has defined narrative role (introduction, context, evidence, analysis, implications, projections, conclusion) | Slide role visible in data |
| AC-9.12.3 | Content-role mismatch detected when content moves between slides with incompatible roles | Alert triggered on mismatch |
| AC-9.12.4 | Agent alerts "You moved evidence content to a projections slide" when structure violated | Warning message present |
| AC-9.12.5 | Agent suggests reorganization to maintain narrative flow | Suggestion present |
| AC-9.12.6 | validateCoherenceTool extended to check narrative structure integrity within sections | Coherence includes structure check |

### E9.13: Non-Linear Navigation with Context

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.13.1 | Click any section in Structure panel to jump | Click works |
| AC-9.13.2 | Agent acknowledges jump and summarizes state | Agent message |
| AC-9.13.3 | Agent tracks section status (complete, in-progress, pending) | Status visible |
| AC-9.13.4 | Forward jumps: agent notes skipped sections | Note present |
| AC-9.13.5 | Backward jumps: agent notes potential updates | Note present |
| AC-9.13.6 | Coherence warnings when navigation creates inconsistencies | Warning shown |

### E9.14: Wireframe PowerPoint Export

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.14.1 | "Export" button visible in CIM Builder | Button present |
| AC-9.14.2 | Generate PPTX with wireframe styling | Download file |
| AC-9.14.3 | One slide per CIM section | Slide count matches |
| AC-9.14.4 | Placeholders for charts/images with specs noted | Content inspection |
| AC-9.14.5 | Text content included | Content inspection |
| AC-9.14.6 | Download triggered in browser | File downloads |
| AC-9.14.7 | File named: `{CIM Name} - Wireframe.pptx` | Filename check |

### E9.15: LLM Prompt Export

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-9.15.1 | "Export LLM Prompt" option available | Option visible |
| AC-9.15.2 | Prompt includes: buyer persona, thesis, outline, all slide content, visual specs | Content check |
| AC-9.15.3 | Structured format for LLM consumption | Format validation |
| AC-9.15.4 | Copy to clipboard works | Clipboard check |
| AC-9.15.5 | Download as .txt works | File downloads |

## Traceability Mapping

### PRD → Epic → Story → AC Mapping

| PRD Requirement | Epic Story | Acceptance Criteria | Component |
|-----------------|------------|---------------------|-----------|
| FR-CIM-001 (UI) | E9.2, E9.3 | AC-9.2.*, AC-9.3.* | CIMListPage, CIMBuilderLayout |
| FR-CIM-002 (Workflow) | E9.4, E9.5, E9.6, E9.7 | AC-9.4.*, AC-9.5.*, AC-9.6.*, AC-9.7.* | CIM Agent, workflow nodes |
| FR-CIM-003 (Agent) | E9.4 | AC-9.4.* | lib/agent/cim/workflow.ts |
| FR-CIM-004 (State) | E9.1, E9.4 | AC-9.1.*, AC-9.4.2, AC-9.4.3 | cims table, checkpointer |
| FR-CIM-005 (Commands) | E9.9 | AC-9.9.* | Click-to-reference |
| FR-CIM-006 (Version) | E9.1 | AC-9.1.1 | version column |

### Story → Test Coverage Mapping

| Story | Unit Tests | Integration Tests | E2E Tests |
|-------|------------|-------------------|-----------|
| E9.1 | Schema validation, RLS policies | API CRUD operations | - |
| E9.2 | Component rendering | Page navigation | Create/delete CIM |
| E9.3 | Panel components | Data fetching | Layout interactions |
| E9.4 | Workflow nodes | State persistence, resume | Full workflow |
| E9.5 | Persona parsing | Agent conversation | Persona completion |
| E9.6 | Outline operations | Agent outline flow | Outline creation |
| E9.7 | Content generation | RAG queries | Content approval |
| E9.8 | Component rendering | Slide updates | Preview interaction |
| E9.9 | Reference parsing | Component updates | Click-to-edit |
| E9.10 | Visual spec generation | Agent flow | Visual approval |
| E9.11 | Dependency graph | Alert generation | Dependency warning |
| E9.12 | Content-role matching | Structure violation detection | Narrative alerts |
| E9.13 | Navigation state | Jump handling | Non-linear nav |
| E9.14 | PPTX generation | - | Export download |
| E9.15 | Prompt formatting | - | Export copy/download |

### Component → File Mapping

| Component | Files | Stories |
|-----------|-------|---------|
| **Database** | `supabase/migrations/cim-schema.sql` | E9.1 |
| **Types** | `lib/types/cim.ts` | E9.1 |
| **Service** | `lib/services/cim-service.ts` | E9.1, E9.2 |
| **API Routes** | `app/api/cims/[id]/route.ts`, `app/api/deals/[id]/cims/route.ts` | E9.1 |
| **Agent Workflow** | `lib/agent/cim/workflow.ts` | E9.4 |
| **Agent Nodes** | `lib/agent/cim/nodes/*.ts` | E9.5, E9.6, E9.7, E9.10 |
| **Agent Tools** | `lib/agent/cim/tools/*.ts` | E9.7, E9.11, E9.12 |
| **CIM List UI** | `components/cim-builder/CIMList/*.tsx` | E9.2 |
| **Builder Layout** | `components/cim-builder/CIMBuilderLayout.tsx` | E9.3 |
| **Sources Panel** | `components/cim-builder/SourcesPanel/*.tsx` | E9.3 |
| **Conversation Panel** | `components/cim-builder/ConversationPanel/*.tsx` | E9.3, E9.5, E9.6, E9.7 |
| **Preview Panel** | `components/cim-builder/PreviewPanel/*.tsx` | E9.8, E9.9 |
| **Export Service** | `lib/services/cim-export.ts` | E9.14, E9.15 |
| **Page Route** | `app/projects/[id]/cim-builder/page.tsx` | E9.2 |
| **Builder Route** | `app/projects/[id]/cim-builder/[cimId]/page.tsx` | E9.3 |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **R1: LangGraph complexity** | Medium | High | Start with E9.4 early; prototype state persistence; fall back to simpler state machine if needed |
| **R2: Agent response latency** | Medium | Medium | Streaming reduces perceived latency; optimize prompts; consider caching |
| **R3: RAG quality for CIM content** | Medium | High | Leverage existing RAG infra; add CIM-specific prompts; allow manual content entry |
| **R4: PPTX library limitations** | Low | Medium | pptxgenjs is mature; wireframe styling is simple; have fallback to HTML export |
| **R5: UI complexity (3-panel)** | Medium | Medium | Build incrementally; test responsiveness; accept desktop-only for MVP |
| **R6: State persistence edge cases** | Medium | Medium | Comprehensive integration tests for resume scenarios |
| **R7: Dependency tracking accuracy** | High | Low | Start simple (explicit links); enhance with NLP in later iteration |

### Assumptions

| Assumption | Impact if Wrong | Validation |
|------------|-----------------|------------|
| **A1: LangGraph supports Supabase checkpointing** | Would need custom checkpointer | Spike E9.4 early |
| **A2: pptxgenjs works client-side in Next.js** | Would need server-side generation | Quick prototype |
| **A3: Users prefer conversational over forms** | May need hybrid approach | User testing |
| **A4: Existing RAG is sufficient for CIM content** | May need enhanced retrieval | Test with real deals |
| **A5: Single-user CIM creation is acceptable** | Would need collaboration features | MVP feedback |

### Open Questions

| Question | Owner | Due | Status |
|----------|-------|-----|--------|
| **Q1: LangGraph version compatibility?** | Dev | Sprint start | Pending |
| **Q2: Should visual concepts use image generation?** | PM | Design phase | Deferred to Phase 2 |
| **Q3: How to handle very long CIMs (50+ slides)?** | Architect | E9.7 implementation | Open |
| **Q4: Export format preferences beyond PPTX?** | PM | User research | Open |
| **Q5: Offline capability required?** | PM | Requirements clarification | Open |

### Decisions Made

| Decision | Rationale | Date |
|----------|-----------|------|
| **D1: No slash commands** | Target users are non-technical M&A analysts | 2025-12-09 |
| **D2: Wireframe-only export for MVP** | Styled export spike moved to Phase 2 backlog | 2025-12-09 |
| **D3: JSONB for state storage** | Simple, queryable, sufficient for MVP scale | 2025-12-09 |
| **D4: Client-side PPTX generation** | No server dependencies, faster iteration | 2025-12-09 |
| **D5: Agent-guided flexible outline** | Users define their own CIM structure, not fixed template | 2025-12-09 |

## Test Strategy Summary

### Testing Priorities

| Priority | Story | Risk Level | Test Focus |
|----------|-------|------------|------------|
| **P0 (Critical)** | E9.4 (Agent Core) | High | State persistence, resume, error recovery |
| **P0 (Critical)** | E9.11 (Dependencies) | High | Dependency detection accuracy |
| **P0 (Critical)** | E9.12 (Narrative Structure) | High | Content-role matching accuracy |
| **P0 (Critical)** | E9.14 (PPTX Export) | Medium | Output validation, file integrity |
| **P1 (High)** | E9.7 (Slide Creation) | Medium | RAG integration, content quality |
| **P1 (High)** | E9.9 (Click-to-Reference) | Medium | Component reference reliability |
| **P2 (Medium)** | E9.3 (Layout) | Low | Responsive behavior, panel interactions |
| **P2 (Medium)** | E9.8 (Preview) | Low | Rendering accuracy |

### Test Types per Layer

**Unit Tests (Vitest)**
- Zod schema validation
- Workflow node logic
- Dependency graph operations
- Component rendering
- Reference parsing

**Integration Tests (Vitest + Supabase)**
- API CRUD operations
- RLS policy enforcement
- State persistence/resume
- RAG query integration
- Agent conversation flow

**E2E Tests (Playwright)**
- Critical path: Create CIM → Build 3 slides → Close → Resume → Export
- CIM list CRUD operations
- Click-to-reference editing
- Non-linear navigation
- Export download verification

### Critical E2E Test Case

```typescript
// e2e/cim-builder.spec.ts
test('complete CIM workflow: create, build, resume, export', async ({ page }) => {
  // 1. Navigate to deal
  await page.goto('/projects/[dealId]/cim-builder')

  // 2. Create new CIM
  await page.click('[data-testid="create-cim-button"]')
  await page.fill('[data-testid="cim-name-input"]', 'Test CIM')
  await page.click('[data-testid="create-cim-submit"]')

  // 3. Complete persona phase
  await expect(page.locator('[data-testid="agent-message"]')).toContainText('target buyer')
  await page.fill('[data-testid="chat-input"]', 'Strategic buyer, competitor')
  await page.click('[data-testid="send-message"]')
  // ... continue through phases

  // 4. Create 3 slides
  // ... slide creation flow

  // 5. Close browser (simulate)
  const cimId = page.url().split('/').pop()
  await page.close()

  // 6. Resume
  await page.goto(`/projects/[dealId]/cim-builder/${cimId}`)
  await expect(page.locator('[data-testid="slide-counter"]')).toContainText('3')

  // 7. Export
  await page.click('[data-testid="export-pptx-button"]')
  const download = await page.waitForEvent('download')
  expect(download.suggestedFilename()).toContain('Wireframe.pptx')
})
```

### Test Coverage Targets

| Area | Target | Rationale |
|------|--------|-----------|
| **Unit tests** | 80% | Core logic coverage |
| **Integration tests** | Key flows | API and state persistence |
| **E2E tests** | Critical paths | User journey validation |

### Test Data Requirements

- **Mock deal** with documents, findings, Q&A
- **Test CIM** at various workflow stages
- **Sample slides** with all component types
- **Dependency graph** fixtures

### Regression Test Suite

After each story completion:
1. Run unit tests for modified files
2. Run integration tests for affected APIs
3. Run E2E critical path test
4. Manual smoke test of CIM Builder

---

**Document Version:** 1.0
**Created:** 2025-12-09
**Last Updated:** 2025-12-09
**Status:** Draft - Ready for Review