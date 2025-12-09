# Manda Platform - Notion Knowledge Base Plan

## Overview

This document outlines a comprehensive Notion workspace structure for the Manda M&A Intelligence Platform. The goal is to create an interconnected knowledge system that enables quick navigation, cross-referencing, and efficient tracking of all project aspects.

---

## Workspace Architecture

```
Manda Platform Workspace
├── Home (Dashboard)
├── Product
│   ├── Vision & Strategy
│   ├── Features Catalog (Database)
│   ├── User Personas
│   └── Competitive Analysis
├── Engineering
│   ├── Architecture Overview
│   ├── Technical Decisions Log (Database)
│   ├── API Reference
│   ├── Database Schema
│   └── Infrastructure
├── Development Tracking
│   ├── Epics (Database)
│   ├── Stories (Database)
│   ├── Sprint Status
│   ├── Bugs (Database)
│   └── Tech Debt (Database)
├── Improvement Ideas
│   ├── Feature Requests (Database)
│   ├── Enhancement Ideas (Database)
│   └── Research Topics (Database)
├── Documentation
│   ├── User Guides
│   ├── Developer Guides
│   └── Deployment Guides
└── Team & Process
    ├── Retrospectives (Database)
    ├── Decision Log (Database)
    └── Meeting Notes
```

---

## 1. HOME (Dashboard Page)

**Purpose**: Central hub providing at-a-glance status and quick navigation.

### Content Structure

#### Hero Section
- Project name: **Manda - M&A Intelligence Platform**
- Tagline: "A persistent knowledge synthesizer combining conversational AI with data room capabilities"
- Current Phase: Phase 1 Implementation (Epics 1-7 Complete)
- Quick links to key areas

#### Status Summary (Embedded Database Views)
| Section | Content |
|---------|---------|
| Active Sprint | Current epic progress, in-progress stories |
| Recent Changes | Last 5 completed stories with dates |
| Open Bugs | Count + link to Bugs database |
| Tech Debt Items | Count + priority breakdown |
| Recent Decisions | Last 3 architectural decisions |

#### Quick Navigation
- Buttons linking to: Features, API Docs, Database Schema, Current Sprint, Bug Tracker

---

## 2. PRODUCT Section

### 2.1 Vision & Strategy (Page)

#### Project Vision
> A comprehensive M&A intelligence platform combining conversational AI with data room capabilities for investment banking analysts. Manda is a persistent knowledge synthesizer that integrates document organization with intelligent analysis.

#### Key Innovation
Background processing builds a persistent knowledge base that a conversational agent queries - creating a lightweight, responsive chat interface backed by deep, continuous analysis.

#### Strategic Goals
1. **Reduce Due Diligence Time**: Automate document analysis and extraction
2. **Improve Accuracy**: AI-powered contradiction detection and source validation
3. **Enable Collaboration**: Shared knowledge base with audit trails
4. **Accelerate Deliverables**: Auto-generate IRLs, Q&A lists, and CIM sections

#### Target Users
- Investment Banking Analysts
- M&A Associates
- Due Diligence Teams
- Deal Team Leads

---

### 2.2 Features Catalog (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Feature name |
| Epic | Relation → Epics | Parent epic |
| Status | Select | Backlog, In Progress, Shipped, Deprecated |
| Category | Select | Core, Chat, Data Room, Knowledge, Deliverables, Learning |
| Priority | Select | Critical, High, Medium, Low |
| Description | Rich Text | Feature description |
| User Value | Rich Text | Business value for users |
| Technical Notes | Rich Text | Implementation approach |
| Related Features | Relation → Features | Connected features |
| Stories | Relation → Stories | Implementation stories |
| Release Date | Date | When shipped |

#### Feature Entries

---

##### Feature: Conversational Knowledge Base
- **Epic**: E5 - Conversational Assistant
- **Status**: Shipped
- **Category**: Chat
- **Priority**: Critical
- **Description**:
  Chat interface backed by semantic search (RAG) that queries the project's knowledge base. Supports multi-turn conversations with context retention, source citations, and confidence indicators.
- **User Value**:
  Analysts can ask natural language questions about uploaded documents instead of manually searching. Example: "What is the company's EBITDA trend?" returns synthesized answer with source citations.
- **Technical Notes**:
  - LangChain LLM factory with Anthropic/OpenAI/Google providers
  - LangGraph agent with 13 specialized tools
  - SSE streaming for real-time responses
  - 10-message context window with token-aware truncation
  - Hybrid search: pgvector semantic + Neo4j graph expansion

---

##### Feature: Intelligent Document Processing
- **Epic**: E3 - Intelligent Processing
- **Status**: Shipped
- **Category**: Core
- **Priority**: Critical
- **Description**:
  Automated extraction pipeline using Docling parser and tiered Gemini models. Preserves Excel formulas, extracts tables, performs OCR on scanned documents, and identifies M&A-relevant findings.
- **User Value**:
  Documents are automatically analyzed upon upload. Financial metrics, key facts, and entities are extracted without manual intervention, saving hours of reading time.
- **Technical Notes**:
  - Docling for PDF/Word/Excel parsing with OCR
  - Tiered Gemini 2.5: Flash (extraction), Pro (deep analysis), Flash-Lite (batch)
  - OpenAI text-embedding-3-large (3072 dims) for vector search
  - 5-stage pipeline: Upload → Parse → Chunk → Embed → Analyze
  - Stage-aware retry with error classification

---

##### Feature: Information Request List (IRL) Management
- **Epic**: E6 - IRL Management
- **Status**: Shipped
- **Category**: Deliverables
- **Priority**: High
- **Description**:
  Template-based IRL generation with 4 industry templates (Tech M&A, Industrial, Pharma, Financial Services). AI-assisted suggestions, drag-drop editing, and auto-generation of data room folders from IRL categories.
- **User Value**:
  Start with proven industry templates, get AI suggestions for additional items based on available documents, and auto-create folder structure to organize incoming documents.
- **Technical Notes**:
  - 4 YAML template files with pre-defined categories
  - 2 agent tools: generate_irl_suggestions, add_to_irl
  - GCS folder creation from IRL categories
  - Binary checkbox tracking (manual-only)
  - PDF/Word export with pdfmake/docx

---

##### Feature: Knowledge Explorer
- **Epic**: E4 - Knowledge Workflow
- **Status**: Shipped
- **Category**: Knowledge
- **Priority**: High
- **Description**:
  Central workspace for browsing, validating, and managing extracted findings. Includes semantic search, card/table views, contradiction detection, and gap analysis against IRL requirements.
- **User Value**:
  Review all AI-extracted facts in one place, validate or reject findings, identify contradictions between documents, and see which IRL items lack supporting documentation.
- **Technical Notes**:
  - @tanstack/react-table for data grid
  - pgvector HNSW index for similarity search
  - Neo4j CONTRADICTS relationships
  - Virtual scrolling for large datasets
  - Real-time updates via Supabase Realtime

---

##### Feature: Learning Loop System
- **Epic**: E7 - Learning Loop
- **Status**: Shipped
- **Category**: Learning
- **Priority**: High
- **Description**:
  Continuous improvement through analyst feedback. Finding corrections with source validation, validation/rejection tracking, response editing with pattern detection, and per-domain confidence threshold adjustment.
- **User Value**:
  The system learns from corrections, improving accuracy over time. Analysts can correct findings with source validation, and the system adjusts confidence based on feedback patterns.
- **Technical Notes**:
  - Append-only audit tables for compliance
  - Source validation: pending → confirmed/override/error
  - Confidence adjustment: +0.05 validate, -0.10 reject, capped [0.1, 0.95]
  - Feature flags for safe rollout (5 flags)
  - Few-shot prompt enhancement from edit patterns

---

##### Feature: Data Room Management
- **Epic**: E2 - Document Ingestion
- **Status**: Shipped
- **Category**: Data Room
- **Priority**: Critical
- **Description**:
  Secure document storage with folder/bucket views. Drag-and-drop upload with progress tracking, real-time processing status, and IRL checklist integration.
- **User Value**:
  Familiar folder-based organization with the added benefit of automatic processing. See real-time status as documents are parsed, embedded, and analyzed.
- **Technical Notes**:
  - Google Cloud Storage with signed URLs
  - Unified folder/bucket model (buckets = top-level folders)
  - XHR for upload progress (Fetch API limitation)
  - Zustand + localStorage for upload persistence
  - Supabase Realtime for status updates

---

##### Feature: Q&A Co-Creation Workflow
- **Epic**: E8 - Q&A Workflow
- **Status**: Backlog
- **Category**: Deliverables
- **Priority**: High
- **Description**:
  Collaborative Q&A workspace with AI-powered draft suggestions. Auto-generates questions from document gaps, drafts answers with source citations, and exports to standard format.
- **User Value**:
  Transform IRL gaps into Q&A questions, get AI-drafted answers backed by extracted knowledge, and export ready-to-send Q&A lists.
- **Technical Notes**:
  - LangGraph workflow for Q&A generation
  - Hard cap at 10 suggestions per request
  - Excel export: Question | Priority | Answer | Date
  - Review queue integration for corrections

---

##### Feature: CIM Company Overview Creation
- **Epic**: E9 - CIM Creation
- **Status**: Backlog
- **Category**: Deliverables
- **Priority**: Medium
- **Description**:
  14-phase interactive workflow for creating Confidential Information Memorandum sections. Buyer persona-driven narrative (Strategic, Financial, Custom), content-first approach with extreme visual precision.
- **User Value**:
  Generate professional CIM sections with consistent narrative, accurate data, and precise visual specifications that can be handed to designers.
- **Technical Notes**:
  - LangGraph 14-phase workflow
  - Investment thesis framework: Asset, Timing, Opportunity
  - Multi-format export: Content MD, Slide Blueprints, Guide, LLM Template
  - Coherence validation and balance checks

---

##### Feature: Contradiction Detection
- **Epic**: E4 - Knowledge Workflow
- **Status**: Shipped
- **Category**: Knowledge
- **Priority**: Medium
- **Description**:
  Automatic detection of conflicting information across documents using Neo4j graph relationships and LLM analysis. Supports resolution workflows with accept/investigate/note actions.
- **User Value**:
  Automatically flag when "Q2 revenue was $5M" in one document but "$4.8M" in another. Investigate whether it's a typo, temporal difference, or true contradiction.
- **Technical Notes**:
  - Gemini 2.5 Pro for contradiction analysis (70% threshold)
  - Neo4j CONTRADICTS relationships
  - Pre-filtering: same chunk, identical text, date alignment
  - Batch processing (5 pairs per request)

---

##### Feature: Audit Trail & Review Queue
- **Epic**: E7 - Learning Loop
- **Status**: Shipped
- **Category**: Learning
- **Priority**: Medium
- **Description**:
  Comprehensive tracking of all corrections, validations, and edits. Append-only audit tables with CSV/JSON export. Review queue for items flagged during correction propagation.
- **User Value**:
  Complete compliance trail for all knowledge base changes. Export audit logs for regulatory requirements or internal review.
- **Technical Notes**:
  - 3 audit tables: finding_corrections, validation_feedback, response_edits
  - Append-only RLS (no UPDATE/DELETE)
  - CSV export with UTF-8 BOM for Excel
  - NeedsReviewBadge for flagged items

---

### 2.3 User Personas (Page)

#### Primary Persona: Investment Banking Analyst

**Role**: Junior analyst (1-3 years experience)

**Goals**:
- Quickly find relevant information across hundreds of documents
- Avoid missing critical details during due diligence
- Reduce time spent on IRL/Q&A preparation
- Build accurate financial models from extracted data

**Pain Points**:
- Information scattered across PDFs, Excel files, emails
- Manual extraction is time-consuming and error-prone
- Difficult to track document versions and contradictions
- Senior bankers expect fast turnaround

**How Manda Helps**:
- Chat interface for instant answers with source citations
- Automatic extraction of financial metrics and key facts
- Contradiction detection prevents errors in deliverables
- Template-based IRL generation with AI suggestions

---

#### Secondary Persona: M&A Associate

**Role**: Mid-level associate (3-5 years experience)

**Goals**:
- Review analyst work efficiently
- Ensure data accuracy in client deliverables
- Manage multiple deals simultaneously
- Mentor junior analysts

**Pain Points**:
- Reviewing analyst work is tedious
- Catching errors before they reach clients
- Context-switching between deals

**How Manda Helps**:
- Knowledge Explorer for quick validation
- Audit trail shows correction history
- Per-project isolation with unified view
- Learning loop improves accuracy over time

---

## 3. ENGINEERING Section

### 3.1 Architecture Overview (Page)

#### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js 15)                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Data    │ │  Chat    │ │ Knowledge│ │Deliverables│           │
│  │  Room    │ │Interface │ │ Explorer │ │  (IRL)   │           │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘           │
└───────┼────────────┼────────────┼────────────┼──────────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (Next.js API Routes)                │
│            ┌─────────────────────────────────────┐              │
│            │    LangGraph Agent (13 Tools)       │              │
│            │    - query_knowledge_base           │              │
│            │    - validate_finding               │              │
│            │    - detect_contradictions          │              │
│            │    - generate_irl_suggestions       │              │
│            │    - correct_finding                │              │
│            │    ... (8 more)                     │              │
│            └─────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────────┘
        │            │            │            │
        ▼            ▼            ▼            ▼
┌───────────────────────────────────────────────────┐
│              Backend (FastAPI Python)              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Docling  │ │ Gemini   │ │ OpenAI   │         │
│  │ Parser   │ │ Analysis │ │Embeddings│         │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘         │
│       │            │            │                │
│       └────────────┼────────────┘                │
│                    ▼                             │
│           ┌──────────────┐                       │
│           │   pg-boss    │ (Job Queue)           │
│           └──────────────┘                       │
└───────────────────────────────────────────────────┘
        │            │            │
        ▼            ▼            ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ PostgreSQL  │ │    Neo4j    │ │    GCS      │
│ (Supabase)  │ │   Graph DB  │ │  Storage    │
│ + pgvector  │ │             │ │             │
└─────────────┘ └─────────────┘ └─────────────┘
```

#### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 + React 19 | UI with App Router |
| Styling | Tailwind CSS 4 + shadcn/ui | Component library |
| State | Zustand + React Query | Client state management |
| Backend | FastAPI (Python 3.11+) | Document processing |
| API | Next.js API Routes | REST endpoints |
| AI Agent | LangChain 1.0 + LangGraph 1.0 | Chat orchestration |
| Database | PostgreSQL 18 (Supabase) | Primary data store |
| Vector Search | pgvector 0.8+ | Semantic similarity |
| Graph DB | Neo4j 2025.01 | Relationship mapping |
| Storage | Google Cloud Storage | Document files |
| Job Queue | pg-boss | Background processing |
| Auth | Supabase Auth | OAuth + MFA |
| Realtime | Supabase Realtime | WebSocket updates |

---

### 3.2 Technical Decisions Log (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Decision | Title | Decision title |
| Date | Date | When decided |
| Category | Select | Infrastructure, Database, AI/ML, Frontend, API, Security |
| Status | Select | Proposed, Accepted, Superseded, Deprecated |
| Context | Rich Text | Why this decision was needed |
| Options Considered | Rich Text | Alternatives evaluated |
| Decision | Rich Text | What was chosen and why |
| Consequences | Rich Text | Trade-offs and implications |
| Related Decisions | Relation → Decisions | Connected decisions |

#### Key Decision Entries

---

##### Decision: FastAPI Python Backend
- **Date**: 2025-11-26
- **Category**: Infrastructure
- **Status**: Accepted
- **Context**:
  Need backend for document processing with Docling, LLM integration, and job queue management. Options: Node.js with Python subprocess, pure Python with FastAPI, or serverless functions.
- **Options Considered**:
  1. Node.js + Python subprocess (complexity, IPC overhead)
  2. FastAPI Python (native integration, mature ecosystem)
  3. Serverless functions (cold start latency, state management)
- **Decision**:
  FastAPI with Python 3.11+ for direct integration with Docling, LangChain, and ML libraries. Eliminates Node.js ↔ Python bridge overhead.
- **Consequences**:
  - Positive: Native Docling/LangChain integration, single Python codebase
  - Negative: Team needs Python skills, separate service to deploy

---

##### Decision: pgvector for Vector Search
- **Date**: 2025-11-26
- **Category**: Database
- **Status**: Accepted
- **Context**:
  Need vector similarity search for RAG. Options: Pinecone (managed), Weaviate (self-hosted), pgvector (Postgres extension).
- **Options Considered**:
  1. Pinecone (managed, cost at scale)
  2. Weaviate (powerful, operational overhead)
  3. pgvector with Supabase (single database, simpler)
- **Decision**:
  pgvector 0.8+ with HNSW index for MVP. Keep vectors in same database as structured data for transactional consistency.
- **Consequences**:
  - Positive: Single database, simpler operations, RLS integration
  - Negative: HNSW 2000-dim limit (use halfvec cast for 3072-dim)

---

##### Decision: Google Cloud Storage for Documents
- **Date**: 2025-11-25
- **Category**: Infrastructure
- **Status**: Accepted
- **Context**:
  Need secure, scalable storage for uploaded documents. Options: Supabase Storage, AWS S3, Google Cloud Storage.
- **Options Considered**:
  1. Supabase Storage (integrated, smaller file limits)
  2. AWS S3 (mature, separate credentials)
  3. GCS (native Gemini integration, lifecycle policies)
- **Decision**:
  Google Cloud Storage for native Gemini 2.5 integration (direct file analysis), signed URL support, and lifecycle policies.
- **Consequences**:
  - Positive: Direct Gemini file analysis, cost-effective tiering
  - Negative: Another cloud provider to manage (mitigated by service account)

---

##### Decision: Tiered Gemini Models
- **Date**: 2025-11-27
- **Category**: AI/ML
- **Status**: Accepted
- **Context**:
  Need LLM for document analysis with cost optimization. Single model vs. tiered approach based on task complexity.
- **Decision**:
  Three-tier Gemini strategy:
  - Gemini 2.5 Flash: Default extraction (fast, 1M context)
  - Gemini 2.5 Pro: Complex analysis, contradictions
  - Gemini 2.5 Flash-Lite: Batch operations
- **Consequences**:
  - Positive: Cost optimization (right-size for task), 1M context for large documents
  - Negative: Model routing complexity, potential inconsistency

---

##### Decision: LangGraph for Agent Orchestration
- **Date**: 2025-12-01
- **Category**: AI/ML
- **Status**: Accepted
- **Context**:
  Chat agent needs tool calling, conversation memory, and structured output. Options: custom implementation, LangChain agents, LangGraph.
- **Decision**:
  LangGraph 1.0 with createReactAgent for stateful, interruptible workflows. Built-in tool calling, streaming, and human-in-the-loop support.
- **Consequences**:
  - Positive: Production-ready agent framework, SSE streaming, interrupts
  - Negative: Learning curve, version coupling with LangChain

---

##### Decision: Append-Only Audit Tables
- **Date**: 2025-12-07
- **Category**: Database
- **Status**: Accepted
- **Context**:
  Learning loop needs audit trail for compliance. Mutable vs. immutable design.
- **Decision**:
  Append-only design for finding_corrections, validation_feedback, response_edits. RLS policies prevent UPDATE/DELETE.
- **Consequences**:
  - Positive: Complete audit trail, regulatory compliance
  - Negative: Storage growth, no "soft delete"

---

### 3.3 API Reference (Page)

#### Authentication
```
POST   /api/auth/signup          - User registration
POST   /api/auth/login           - Email/password login
GET    /auth/callback            - OAuth callback
POST   /api/auth/logout          - Sign out
```

#### Projects
```
GET    /api/projects              - List user's projects
POST   /api/projects              - Create project
GET    /api/projects/[id]/access  - Check access
```

#### Documents
```
POST   /api/documents/upload           - Upload document
GET    /api/documents/[id]             - Get document
POST   /api/documents/[id]/retry       - Retry processing
```

#### Chat & Conversations
```
POST   /api/projects/[id]/chat                    - Send message (SSE stream)
POST   /api/projects/[id]/chat/upload             - Upload via chat
POST   /api/projects/[id]/conversations           - Create conversation
GET    /api/projects/[id]/conversations/[cid]     - Get conversation
POST   /api/projects/[id]/conversations/[cid]/messages
POST   /api/projects/[id]/messages/[mid]/edits    - Track edits
```

#### Findings
```
GET    /api/projects/[id]/findings                     - List findings
POST   /api/projects/[id]/findings                     - Create finding
GET    /api/projects/[id]/findings/[fid]               - Get finding
PUT    /api/projects/[id]/findings/[fid]               - Update finding
POST   /api/projects/[id]/findings/[fid]/validate      - Validate
POST   /api/projects/[id]/findings/[fid]/reject        - Reject
POST   /api/projects/[id]/findings/[fid]/correct       - Correct
GET    /api/projects/[id]/findings/[fid]/history       - History
GET    /api/projects/[id]/findings/[fid]/source        - Source info
POST   /api/projects/[id]/findings/search              - Semantic search
POST   /api/projects/[id]/findings/batch               - Bulk actions
POST   /api/projects/[id]/findings/export              - Export
```

#### IRLs
```
GET    /api/projects/[id]/irls                    - List IRLs
POST   /api/projects/[id]/irls                    - Create IRL
GET    /api/projects/[id]/irls/[iid]              - Get IRL
PUT    /api/projects/[id]/irls/[iid]              - Update IRL
POST   /api/projects/[id]/irls/[iid]/items        - Add items
POST   /api/projects/[id]/irls/[iid]/export       - Export
POST   /api/projects/[id]/irls/[iid]/generate-folders
GET    /api/projects/[id]/irls/templates          - Get templates
POST   /api/projects/[id]/irls/suggestions        - AI suggestions
```

#### Audit & Review
```
GET    /api/projects/[id]/audit                   - Query audit trail
POST   /api/projects/[id]/audit/export            - Export audit
GET    /api/projects/[id]/review-queue            - Review queue items
```

#### Learning Loop
```
POST   /api/projects/[id]/feedback-analysis       - Trigger analysis
GET    /api/projects/[id]/thresholds              - Get thresholds
PUT    /api/projects/[id]/thresholds              - Update thresholds
```

---

### 3.4 Database Schema (Page)

#### Core Tables

**deals** - M&A projects/deals
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES auth.users
name            TEXT NOT NULL
description     TEXT
metadata        JSONB
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

**documents** - Uploaded files
```sql
id              UUID PRIMARY KEY
deal_id         UUID REFERENCES deals
folder_id       UUID REFERENCES folders
user_id         UUID REFERENCES auth.users
name            TEXT NOT NULL
file_path       TEXT NOT NULL (GCS path)
file_size       BIGINT
mime_type       TEXT
processing_status TEXT ('pending','parsing','embedding','analyzing','complete','failed')
current_stage   TEXT
error_message   TEXT
created_at      TIMESTAMPTZ
```

**findings** - Extracted facts
```sql
id              UUID PRIMARY KEY
deal_id         UUID REFERENCES deals
document_id     UUID REFERENCES documents
chunk_id        UUID REFERENCES document_chunks
text            TEXT NOT NULL
domain          TEXT ('Financial','Operational','Legal','Market','Technical')
confidence      FLOAT (0.0-1.0)
embedding       vector(3072)
metadata        JSONB
status          TEXT ('pending','validated','rejected','corrected')
validation_history JSONB
needs_review    BOOLEAN DEFAULT false
review_reason   TEXT
last_corrected_at TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

**finding_corrections** - Audit trail (append-only)
```sql
id              UUID PRIMARY KEY
finding_id      UUID REFERENCES findings
analyst_id      UUID REFERENCES auth.users
original_value  TEXT
corrected_value TEXT
correction_type TEXT ('value','source','confidence','text')
reason          TEXT
source_validation_status TEXT ('pending','confirmed','override','error')
original_source_document TEXT
original_source_location TEXT
user_source_reference TEXT
created_at      TIMESTAMPTZ
```

**conversations** - Chat sessions
```sql
id              UUID PRIMARY KEY
deal_id         UUID REFERENCES deals
user_id         UUID REFERENCES auth.users
title           TEXT
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

**messages** - Chat messages
```sql
id              UUID PRIMARY KEY
conversation_id UUID REFERENCES conversations
role            TEXT ('human','ai','system','tool')
content         TEXT
tool_calls      JSONB
sources         JSONB
confidence      JSONB
created_at      TIMESTAMPTZ
```

**irls** - Information Request Lists
```sql
id              UUID PRIMARY KEY
deal_id         UUID REFERENCES deals
name            TEXT NOT NULL
sections        JSONB (categories and items)
status          TEXT
created_at      TIMESTAMPTZ
```

**irl_items** - Individual IRL items
```sql
id              UUID PRIMARY KEY
irl_id          UUID REFERENCES irls
category        TEXT
subcategory     TEXT
request         TEXT NOT NULL
priority        TEXT ('critical','high','medium','low')
status          TEXT ('pending','received','reviewed')
fulfilled       BOOLEAN DEFAULT false
notes           TEXT
```

#### Learning Loop Tables

**validation_feedback** - Validation/rejection records
```sql
id              UUID PRIMARY KEY
finding_id      UUID REFERENCES findings
user_id         UUID REFERENCES auth.users
action          TEXT ('validated','rejected')
confidence_adjustment FLOAT
reason          TEXT
created_at      TIMESTAMPTZ
```

**response_edits** - AI response modifications
```sql
id              UUID PRIMARY KEY
message_id      UUID REFERENCES messages
user_id         UUID REFERENCES auth.users
original_content TEXT
edited_content  TEXT
edit_type       TEXT ('word_replacement','phrase_removal','tone_adjustment','structure_change')
context         TEXT
created_at      TIMESTAMPTZ
```

**feedback_analytics** - Weekly analysis summaries
```sql
id              UUID PRIMARY KEY
deal_id         UUID REFERENCES deals
analysis_date   DATE
period_start    DATE
period_end      DATE
summary         JSONB (patterns, recommendations, stats)
trigger_type    TEXT ('scheduled','manual','threshold_exceeded')
```

**confidence_thresholds** - Per-domain thresholds
```sql
id              UUID PRIMARY KEY
deal_id         UUID REFERENCES deals
domain          TEXT UNIQUE per deal
current_threshold FLOAT (0.0-1.0)
previous_threshold FLOAT
statistical_basis JSONB
applied_by      UUID REFERENCES auth.users
```

**feature_flags** - Safe rollout flags
```sql
id              UUID PRIMARY KEY
deal_id         UUID (nullable for global)
name            TEXT
enabled         BOOLEAN
description     TEXT
```

---

### 3.5 Infrastructure (Page)

#### Deployment Architecture

**Development**
- Docker Compose orchestration
- Local Supabase instance
- Neo4j Community Edition
- GCS emulator or test bucket

**CI/CD Pipeline**
```yaml
GitHub Actions:
  lint:
    - ESLint + Prettier
    - TypeScript check

  unit-tests:
    strategy:
      matrix:
        shard: [1, 2, 3]  # 3-way test sharding
    - Vitest parallel execution

  e2e-tests:
    - Playwright (Chromium)
    - Auth setup
    - Data Room flows

  build:
    - Next.js build
    - Bundle analysis
```

**Production** (Planned)
- Google Cloud Run (scale-to-zero)
- Supabase managed Postgres
- Neo4j Aura (managed)
- GCS with lifecycle policies
- OpenTelemetry for observability

#### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Neo4j
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=

# Google Cloud Storage
GCS_BUCKET_NAME=
GOOGLE_APPLICATION_CREDENTIALS=

# AI Models
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=

# Feature Flags
ENABLE_SOURCE_ERROR_CASCADE=false
ENABLE_AUTO_FLAG_DOCUMENT_FINDINGS=false
ENABLE_WEEKLY_FEEDBACK_ANALYSIS=false
```

---

## 4. DEVELOPMENT TRACKING Section

### 4.1 Epics (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Epic name |
| ID | Text | Epic identifier (E1, E2, etc.) |
| Status | Select | Backlog, Contexted, In Progress, Done |
| Started | Date | Start date |
| Completed | Date | Completion date |
| Stories | Relation → Stories | Child stories |
| Description | Rich Text | Epic description |
| Key Deliverables | Rich Text | Major outputs |
| Duration | Formula | Completed - Started |
| Story Count | Rollup | Count of stories |
| Completed Stories | Rollup | Count where status=Done |
| Progress | Formula | Completed/Total % |
| Tech Spec | URL | Link to tech spec |
| Retrospective | Relation → Retrospectives | Epic retrospective |

#### Epic Entries

---

##### Epic 1: Project Foundation
- **ID**: E1
- **Status**: Done
- **Started**: 2025-11-24
- **Completed**: 2025-11-25
- **Stories**: 9/9 done
- **Description**: Core infrastructure setup including Next.js, Supabase Auth, PostgreSQL schema, Neo4j, pg-boss, and project management UI.
- **Key Deliverables**:
  - Next.js 15 with shadcn/ui, Tailwind CSS, TypeScript
  - Supabase Auth with SSR middleware, protected routes
  - PostgreSQL schema with RLS policies
  - Project overview with search/filter/pagination
  - 2-step project creation wizard
  - Neo4j graph database integration
  - pg-boss job queue with health monitoring
  - 19 initial tests

---

##### Epic 2: Document Ingestion & Storage
- **ID**: E2
- **Status**: Done
- **Started**: 2025-11-25
- **Completed**: 2025-11-26
- **Stories**: 8/8 done
- **Description**: Document upload and storage with GCS, Data Room UI with folder/bucket views, drag-and-drop management.
- **Key Deliverables**:
  - GCS integration with signed URLs
  - Data Room with Folder and Bucket views
  - Unified folder/bucket model (buckets = top-level folders)
  - Drag-and-drop document management
  - Upload progress with parallel uploads
  - IRL Checklist panel
  - 135 tests (7x growth from Epic 1)

---

##### Epic 3: Intelligent Document Processing
- **ID**: E3
- **Status**: Done
- **Started**: 2025-11-26
- **Completed**: 2025-11-28
- **Stories**: 9/9 done
- **Description**: FastAPI backend with Docling parsing, Gemini analysis, embeddings, and stage-aware processing pipeline.
- **Key Deliverables**:
  - FastAPI Python backend (manda-processing)
  - Docling parsing (PDF, Word, Excel with OCR)
  - OpenAI text-embedding-3-large (3072 dims)
  - Tiered Gemini 2.5 (Flash/Pro/Lite)
  - Financial metric extraction (EN+DE patterns)
  - Real-time processing status via Supabase Realtime
  - Stage-aware retry logic
  - 550+ tests with 85-93% coverage

---

##### Epic 4: Collaborative Knowledge Workflow
- **ID**: E4
- **Status**: Done
- **Started**: 2025-11-28
- **Completed**: 2025-11-30
- **Stories**: 13/13 done
- **Description**: Knowledge Explorer with findings browser, semantic search, contradiction detection, gap analysis, and export.
- **Key Deliverables**:
  - Knowledge Explorer with Findings/Contradictions/Gaps tabs
  - Semantic search with pgvector
  - Card/table views with virtual scrolling
  - Contradiction detection with Neo4j
  - Gap analysis against IRL requirements
  - CSV/Excel/HTML export
  - Bulk validation actions
  - Real-time updates
  - 1000+ tests

---

##### Epic 5: Conversational Assistant
- **ID**: E5
- **Status**: Done
- **Started**: 2025-12-01
- **Completed**: 2025-12-02
- **Stories**: 8/9 done (E5.8 deferred)
- **Description**: LangChain/LangGraph agent with chat UI, SSE streaming, source citations, and multi-turn context.
- **Key Deliverables**:
  - LangChain LLM factory (Anthropic/OpenAI/Google)
  - LangGraph agent with 13 tools
  - Full chat UI with SSE streaming
  - Conversation history with context
  - Source citations with document preview
  - Quick actions and suggested follow-ups
  - Confidence indicators
  - Document upload via chat
  - 400+ tests added

---

##### Epic 6: IRL Management
- **ID**: E6
- **Status**: Done
- **Started**: 2025-12-02
- **Completed**: 2025-12-03
- **Stories**: 7/7 done
- **Description**: IRL Builder with templates, AI suggestions, folder generation, and export.
- **Key Deliverables**:
  - 4 industry templates (Tech M&A, Industrial, Pharma, Financial Services)
  - Drag-and-drop editing with dnd-kit
  - 2 new agent tools (13 total)
  - GCS folder auto-generation
  - Binary checkbox tracking
  - PDF/Word export
  - Progress visualization
  - 250+ new tests

---

##### Epic 7: Learning Loop
- **ID**: E7
- **Status**: Done
- **Started**: 2025-12-07
- **Completed**: 2025-12-08
- **Stories**: 6/6 done
- **Description**: Continuous improvement through analyst feedback, corrections, and confidence adjustment.
- **Key Deliverables**:
  - Finding correction via chat with source validation
  - Validation/rejection feedback with confidence adjustment
  - Response editing with pattern detection
  - Feedback analysis with per-domain thresholds
  - Append-only audit trail with export
  - Correction propagation with review queue
  - 7 migrations, 5 feature flags
  - 77+ tests added

---

##### Epic 8: Q&A Co-Creation Workflow
- **ID**: E8
- **Status**: Backlog
- **Stories**: 0/8 done
- **Description**: Collaborative Q&A workspace with AI-powered draft suggestions.

---

##### Epic 9: CIM Company Overview Creation
- **ID**: E9
- **Status**: Backlog
- **Stories**: 0/9 done
- **Description**: 14-phase interactive workflow for CIM section creation.

---

### 4.2 Stories (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Story title |
| ID | Text | Story identifier (E1.1, E2.3, etc.) |
| Epic | Relation → Epics | Parent epic |
| Status | Select | Backlog, Drafted, Ready, In Progress, Review, Done, Deferred |
| Priority | Select | Critical, High, Medium, Low |
| Estimate | Number | Story points or hours |
| Started | Date | When development started |
| Completed | Date | When marked done |
| Reviewed | Date | Code review date |
| Deliverables | Rich Text | What was built |
| Notes | Rich Text | Implementation notes |
| Bugs | Relation → Bugs | Related bugs |
| Tech Debt | Relation → Tech Debt | Related debt items |
| Jira ID | Text | External tracking ID |

---

### 4.3 Bugs (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Bug description |
| ID | Text | Bug identifier (BUG-001) |
| Status | Select | Open, In Progress, Fixed, Won't Fix, Duplicate |
| Severity | Select | Critical, High, Medium, Low |
| Priority | Select | P0, P1, P2, P3 |
| Feature | Relation → Features | Affected feature |
| Epic | Relation → Epics | Related epic |
| Story | Relation → Stories | Related story |
| Reported Date | Date | When discovered |
| Fixed Date | Date | When resolved |
| Reporter | Person | Who found it |
| Assignee | Person | Who's fixing it |
| Description | Rich Text | Bug details |
| Steps to Reproduce | Rich Text | How to trigger |
| Expected Behavior | Rich Text | What should happen |
| Actual Behavior | Rich Text | What happens |
| Root Cause | Rich Text | Why it happened |
| Fix Description | Rich Text | How it was fixed |
| Related Bugs | Relation → Bugs | Connected bugs |

#### Bug Entry Template
```
**Environment**: Development / Staging / Production
**Browser**: Chrome 120 / Safari 17 / Firefox 120
**Steps to Reproduce**:
1. Navigate to...
2. Click on...
3. Enter...

**Expected**: The form should save successfully
**Actual**: Error message "Failed to save" appears
**Console Errors**: TypeError: Cannot read property...
**Screenshots**: [attach]
```

---

### 4.4 Tech Debt (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Debt item description |
| ID | Text | Debt identifier (TD-001) |
| Status | Select | Open, In Progress, Resolved, Deferred, Won't Fix |
| Priority | Select | Critical, High, Medium, Low |
| Category | Select | Code Quality, Testing, Documentation, Performance, Security |
| Source | Text | Where identified (retrospective, code review, etc.) |
| Epic | Relation → Epics | Related epic |
| Story | Relation → Stories | Related story |
| Created Date | Date | When identified |
| Resolved Date | Date | When addressed |
| Effort Estimate | Select | XS, S, M, L, XL |
| Description | Rich Text | What needs to be done |
| Impact | Rich Text | Consequences of not addressing |
| Resolution | Rich Text | How it was fixed |

#### Current Tech Debt Items

---

##### TD-001: Add E2E tests for Data Room
- **Status**: Resolved
- **Priority**: Medium
- **Category**: Testing
- **Source**: Epic 2 Retrospective
- **Resolution**: Created Playwright test suite with 15 Data Room tests

---

##### TD-002: Add rate limiting on document endpoints
- **Status**: Deferred
- **Priority**: Medium
- **Category**: Security
- **Source**: Epic 2 Retrospective
- **Defer Reason**: Could block power users during heavy due diligence. Revisit before production.

---

##### TD-003: Monitor GCS costs
- **Status**: Deferred
- **Priority**: Low
- **Category**: Infrastructure
- **Source**: Epic 2 Retrospective
- **Defer Reason**: No production traffic yet, address before launch.

---

##### TD-004: Test sharding / parallel execution
- **Status**: Resolved
- **Priority**: Medium
- **Category**: Testing
- **Source**: Epic 3 Retrospective
- **Resolution**: Implemented 3-way CI sharding (41s → ~3s/shard)

---

##### TD-005: Shared Supabase test utilities
- **Status**: Resolved
- **Priority**: Medium
- **Category**: Testing
- **Source**: Epic 3 Retrospective
- **Resolution**: Created __tests__/utils/supabase-mock.ts

---

##### TD-006: Error message consistency catalog
- **Status**: Deferred
- **Priority**: Low
- **Category**: Code Quality
- **Source**: Epic 3 Retrospective
- **Defer Reason**: Nice-to-have, address incrementally.

---

##### TD-007: E7.6 Unit Tests
- **Status**: Open
- **Priority**: Medium
- **Category**: Testing
- **Source**: Epic 7 Retrospective
- **Description**: E7.6 (Correction Propagation) tests were deferred. Add unit tests for correction propagation and review queue components.

---

## 5. IMPROVEMENT IDEAS Section

### 5.1 Feature Requests (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Request title |
| ID | Text | Request identifier (FR-001) |
| Status | Select | New, Under Review, Planned, Backlog, Won't Do |
| Priority | Select | Critical, High, Medium, Low |
| Category | Select | Chat, Data Room, Knowledge, Deliverables, UX, Performance |
| Requester | Text | Who requested |
| Created Date | Date | When submitted |
| Description | Rich Text | What the user wants |
| User Value | Rich Text | Why this matters |
| Potential Solution | Rich Text | Ideas for implementation |
| Related Features | Relation → Features | Existing features |
| Epic | Relation → Epics | If planned, which epic |
| Votes | Number | Interest count |

#### Feature Request Entries

---

##### FR-001: Chat Export (Markdown/PDF/Word)
- **Status**: Planned
- **Priority**: Medium
- **Category**: Chat
- **Description**: Export chat conversations to Markdown, PDF, or Word format for sharing with team members or archiving.
- **User Value**: Analysts often need to share insights discovered in chat with senior bankers who don't use the platform.
- **Epic**: E5 (deferred as E5.8)

---

##### FR-002: Multi-Deal Dashboard
- **Status**: New
- **Priority**: High
- **Category**: UX
- **Description**: Dashboard showing status across multiple deals - processing queues, finding counts, IRL progress.
- **User Value**: Associates managing 3-5 deals need unified view without switching between projects.

---

##### FR-003: Email Integration for IRL Responses
- **Status**: New
- **Priority**: Medium
- **Category**: Deliverables
- **Description**: Auto-capture IRL responses from email attachments and file them to correct IRL items.
- **User Value**: Reduce manual work of downloading, uploading, and linking documents to IRL items.

---

##### FR-004: Document Comparison View
- **Status**: New
- **Priority**: High
- **Category**: Knowledge
- **Description**: Side-by-side comparison of two document versions with highlighted differences.
- **User Value**: When company sends updated financials, quickly see what changed from previous version.

---

##### FR-005: Collaboration / Multi-User
- **Status**: New
- **Priority**: High
- **Category**: UX
- **Description**: Real-time collaboration where multiple team members can work on same deal, see each other's activity.
- **User Value**: Deal teams of 3-5 people need to work together without stepping on each other.

---

### 5.2 Enhancement Ideas (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Enhancement title |
| ID | Text | Enhancement identifier (EN-001) |
| Status | Select | Idea, Researching, Validated, Planned, Implemented |
| Category | Select | Performance, UX, AI Quality, Developer Experience |
| Impact | Select | High, Medium, Low |
| Effort | Select | XS, S, M, L, XL |
| Description | Rich Text | What to improve |
| Current State | Rich Text | How it works now |
| Proposed State | Rich Text | How it should work |
| Success Metrics | Rich Text | How to measure improvement |

#### Enhancement Entries

---

##### EN-001: Streaming Token Display Optimization
- **Status**: Idea
- **Category**: Performance
- **Impact**: Medium
- **Effort**: S
- **Description**: Current SSE streaming shows tokens one at a time. Batch tokens every 50ms for smoother rendering.
- **Current State**: Each token triggers React re-render
- **Proposed State**: Buffer tokens and update DOM in batches
- **Success Metrics**: Reduce paint events by 80%, smoother perceived performance

---

##### EN-002: Finding Deduplication
- **Status**: Idea
- **Category**: AI Quality
- **Impact**: High
- **Effort**: M
- **Description**: Same fact extracted from multiple documents creates duplicates. Detect and merge.
- **Current State**: Each document extraction is independent
- **Proposed State**: Check semantic similarity before creating new finding
- **Success Metrics**: Reduce duplicate findings by 50%

---

##### EN-003: Keyboard Navigation
- **Status**: Idea
- **Category**: UX
- **Impact**: Medium
- **Effort**: M
- **Description**: Power users want vim-style or Excel-style keyboard navigation through findings.
- **Current State**: Mouse-only navigation for table/card selection
- **Proposed State**: Arrow keys, j/k navigation, Enter to open
- **Success Metrics**: 30% of users use keyboard after 1 week

---

##### EN-004: Offline Mode for Data Room
- **Status**: Idea
- **Category**: UX
- **Impact**: Low
- **Effort**: XL
- **Description**: Download documents for offline viewing when traveling.
- **Current State**: Requires internet connection
- **Proposed State**: Service worker caching of recently viewed documents
- **Success Metrics**: App usable offline for document viewing

---

### 5.3 Research Topics (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Topic title |
| Status | Select | Proposed, In Progress, Completed, Abandoned |
| Category | Select | AI/ML, Infrastructure, UX, Integration, Security |
| Owner | Person | Who's researching |
| Started | Date | Research start |
| Completed | Date | Research end |
| Question | Rich Text | What we're trying to learn |
| Findings | Rich Text | What we learned |
| Recommendations | Rich Text | Suggested actions |
| Related | Relation → Features / Enhancements | What this affects |

#### Research Topics

---

##### Research: Fine-Tuning vs. Few-Shot for M&A Domain
- **Status**: Completed
- **Category**: AI/ML
- **Question**: Should we fine-tune Gemini/Claude for M&A extraction, or is few-shot prompting sufficient?
- **Findings**:
  - Few-shot with 5-10 examples achieves 85%+ accuracy
  - Fine-tuning requires 1000+ labeled examples we don't have
  - Correction feedback can enhance few-shot prompts over time
- **Recommendations**: Use few-shot for MVP, collect corrections as training data for future fine-tuning

---

##### Research: Vector DB Scaling Strategy
- **Status**: Proposed
- **Category**: Infrastructure
- **Question**: At what scale does pgvector become a bottleneck, and what's the migration path?
- **Findings**: (In progress)
- **Recommendations**: (TBD)

---

##### Research: Document Versioning Detection
- **Status**: Proposed
- **Category**: AI/ML
- **Question**: Can we automatically detect when a document is an updated version of an existing one?
- **Findings**: (In progress)
- **Recommendations**: (TBD)

---

## 6. DOCUMENTATION Section

### 6.1 User Guides (Page)

#### Getting Started

1. **Create Account**: Sign up with email or Google OAuth
2. **Create Project**: Click "New Project", enter deal name
3. **Upload Documents**: Drag files to Data Room or use upload button
4. **Wait for Processing**: Documents are automatically parsed and analyzed
5. **Ask Questions**: Use Chat to query the knowledge base
6. **Review Findings**: Knowledge Explorer shows all extracted facts

#### Data Room Guide

- **Folder View**: Traditional folder hierarchy for organizing documents
- **Bucket View**: Category-based grouping derived from top-level folders
- **Upload**: Drag-and-drop or click upload zone
- **Processing Status**: Watch real-time progress as documents are analyzed

#### Chat Guide

- **Natural Language**: Ask questions like you would ask a colleague
- **Source Citations**: Every answer includes source references - click to preview
- **Quick Actions**: Use buttons for common tasks (Find Contradictions, Identify Gaps)
- **Follow-Ups**: Click suggested questions for deeper exploration
- **Upload via Chat**: Drag files directly into chat to upload and discuss

#### IRL Guide

- **Templates**: Start with industry template (Tech M&A, Industrial, etc.)
- **AI Suggestions**: Get suggestions based on uploaded documents
- **Categories**: Organize requests by domain (Financial, Legal, etc.)
- **Progress Tracking**: Check off items as documents are received
- **Export**: Generate PDF/Word for external sharing

---

### 6.2 Developer Guides (Page)

#### Local Development Setup

```bash
# Clone repository
git clone https://github.com/yourorg/manda-platform.git
cd manda-platform

# Frontend (manda-app)
cd manda-app
npm install
cp .env.example .env.local
# Fill in environment variables
npm run dev

# Backend (manda-processing)
cd ../manda-processing
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in environment variables
uvicorn src.main:app --reload

# Start Supabase (optional local)
supabase start

# Start Neo4j (Docker)
docker run -d --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:latest
```

#### Testing

```bash
# Frontend unit tests
cd manda-app
npm run test           # Watch mode
npm run test:run       # Single run
npm run test:coverage  # Coverage report

# Frontend E2E tests
npm run test:e2e       # Headless
npm run test:e2e:ui    # Interactive UI

# Backend tests
cd manda-processing
pytest                 # All tests
pytest -v -k "test_parser"  # Filtered
pytest --cov=src       # With coverage
```

#### Adding a New Agent Tool

1. Create tool in `manda-app/lib/langchain/tools/`
2. Define Zod schema for parameters
3. Implement tool function with return type
4. Add to tools array in agent executor
5. Update system prompt if needed
6. Add unit tests

Example:
```typescript
// lib/langchain/tools/my-new-tool.ts
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export const myNewTool = tool(
  async ({ param1, param2 }) => {
    // Implementation
    return { success: true, data: result };
  },
  {
    name: 'my_new_tool',
    description: 'What this tool does',
    schema: z.object({
      param1: z.string().describe('First parameter'),
      param2: z.number().optional().describe('Optional second param'),
    }),
  }
);
```

#### Database Migrations

```bash
# Create new migration
cd manda-app
# Create file: supabase/migrations/00XXX_description.sql

# Apply migrations (local)
supabase db reset

# Regenerate types
npm run db:types
```

---

## 7. TEAM & PROCESS Section

### 7.1 Retrospectives (Database)

**Database Schema:**

| Property | Type | Description |
|----------|------|-------------|
| Title | Title | Retrospective title |
| Epic | Relation → Epics | Related epic |
| Date | Date | When conducted |
| What Went Well | Rich Text | Positives |
| What Could Be Better | Rich Text | Areas for improvement |
| Action Items | Rich Text | Concrete next steps |
| Backlog Items | Relation → Tech Debt | Created debt items |
| Key Metrics | Rich Text | Duration, test count, etc. |

#### Retrospective Entries

See: `docs/sprint-artifacts/retrospectives/` for full retrospective documents.

---

### 7.2 Decision Log (Database)

Mirrors Technical Decisions but includes non-technical decisions:
- Process changes
- Tool selections
- Team agreements

---

## Workflow Examples

### Workflow 1: "Find all bugs related to document upload"

1. Open **Bugs** database
2. Filter: Feature = "Data Room Management" OR "Document Processing"
3. View shows all upload-related bugs with status
4. Click bug to see details, related story, fix description

### Workflow 2: "What features are we shipping in Epic 8?"

1. Open **Features Catalog** database
2. Filter: Epic = "Epic 8: Q&A Co-Creation"
3. See all planned features with descriptions and status
4. Click feature → see related stories via relation

### Workflow 3: "Track a new bug from discovery to fix"

1. Open **Bugs** database → New bug
2. Fill in: Title, Severity, Steps to Reproduce
3. Link to affected Feature and Epic
4. Update Status as work progresses
5. Add Root Cause and Fix Description when resolved
6. Link to Story if fix was part of sprint work

### Workflow 4: "Plan next sprint from backlog"

1. Open **Stories** database
2. Filter: Status = "Backlog" OR "Drafted"
3. Sort by Priority
4. Review **Tech Debt** database for items to include
5. Move selected stories to "Ready"
6. Link to current sprint in **Sprint Status**

### Workflow 5: "Capture idea from user feedback"

1. Open **Feature Requests** database → New
2. Fill in: Title, Description, User Value
3. Category and initial Priority
4. If validated → link to planned Epic
5. Track Votes as others express interest

### Workflow 6: "Research before implementing complex feature"

1. Open **Research Topics** database → New
2. Define Question clearly
3. Owner conducts research
4. Document Findings and Recommendations
5. Link to Features/Enhancements affected
6. Inform Epic planning with research results

---

## Database Relationships Map

```
Features ────────┬──────── Epics
    │            │           │
    │            ▼           │
    │        Stories ◄───────┤
    │            │           │
    ▼            ▼           ▼
   Bugs ◄─── Tech Debt   Retrospectives
    │
    ▼
Feature Requests ←── Enhancement Ideas ←── Research Topics
                           │
                           └── Technical Decisions
```

**Key Relationships:**

| From | To | Relationship |
|------|-----|--------------|
| Features | Epics | Feature belongs to Epic |
| Features | Stories | Feature implemented by Stories |
| Stories | Epics | Story belongs to Epic |
| Stories | Bugs | Story discovered/fixed Bug |
| Stories | Tech Debt | Story created/resolved Debt |
| Bugs | Features | Bug affects Feature |
| Tech Debt | Epics | Debt came from Epic |
| Epics | Retrospectives | Epic has Retrospective |
| Feature Requests | Epics | Request planned in Epic |
| Enhancement Ideas | Features | Enhancement improves Feature |
| Research Topics | Features | Research informs Feature |
| Technical Decisions | Decisions | Decision supersedes Decision |

---

## Notion Setup Instructions

### Step 1: Create Workspace
1. Create new Notion workspace: "Manda Platform"
2. Set up team access if collaborating

### Step 2: Create Database Templates
1. Create each database with schema above
2. Set up Select options for all status/category fields
3. Configure Relation properties between databases

### Step 3: Create Section Pages
1. Create top-level pages for each section
2. Add database views with appropriate filters
3. Create linked database views where needed

### Step 4: Set Up Home Dashboard
1. Create Home page with synced blocks
2. Embed filtered database views
3. Add quick navigation buttons

### Step 5: Import Initial Data
1. Populate Epics from sprint-status.yaml
2. Populate Stories from story files
3. Populate Features from feature analysis above
4. Add Tech Debt from retrospectives

### Step 6: Configure Views
Each database should have multiple views:
- **All Items**: Default unfiltered view
- **By Status**: Kanban board grouped by status
- **Active**: Filtered to In Progress items
- **Recent**: Sorted by last modified date
- **My Items**: Filtered to current user (if multi-user)

---

## Maintenance Guidelines

### Daily
- Update Story status as work progresses
- Add new Bugs as discovered
- Mark Tech Debt items as resolved

### Weekly
- Review Feature Requests for triage
- Update Sprint Status
- Check Enhancement Ideas for patterns

### Per Epic
- Create Retrospective entry
- Update Feature status to Shipped
- Create Tech Debt items from retro action items
- Link all Stories to completed Epic

### Monthly
- Review Research Topics for staleness
- Archive completed Feature Requests
- Update Technical Decisions if approaches changed
- Review deferred Tech Debt priorities

---

This knowledge base structure provides:
- **Quick Navigation**: Dashboard links to any section
- **Cross-Referencing**: Relations connect all databases
- **Traceability**: From idea → research → feature → epic → story → bug
- **Living Documentation**: Updates as project evolves
- **Team Visibility**: Everyone sees current status

The connected databases allow answering questions like:
- "What bugs are blocking Epic 8?"
- "Which features need research before implementation?"
- "What Tech Debt came from the last 3 Epics?"
- "Which Feature Requests have the most votes?"