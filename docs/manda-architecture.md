# Architecture Document
# Manda - M&A Intelligence Platform

**Document Status:** Final
**Created:** 2025-11-19
**Last Updated:** 2025-12-12
**Owner:** Max
**Architects:** Max, Claude (Architecture Workflow)
**Version:** 3.2 (Added Intelligent Excel Parser for IRL Import - v2.7)

---

## Executive Summary

Manda is a **conversational knowledge synthesizer** for M&A intelligence—a platform that combines the organizational capabilities of a data room with the analytical power of a specialized AI agent. This architecture document defines the technical foundation for building a system that transforms how M&A analysts work with complex deal information.

**Core Innovation:** Background processing builds a persistent knowledge base that the conversational agent queries—creating a lightweight, responsive chat interface backed by deep, continuous analysis.

**Key Architectural Principles:**
- **Tightly Integrated Platform-Agent:** Comprehensive platform with conversational agent as primary interface
- **Tool-Based Integration:** Agent accesses platform services through well-defined tools (12 core tools)
- **Event-Driven Processing:** Heavy analysis happens asynchronously in background
- **Human-in-the-Loop:** LangGraph workflows enable collaborative document creation
- **Multi-Model Strategy:** Route tasks to optimal LLM (Gemini 2.5 Flash/Pro for extraction, Claude for conversation)
- **Containerized Development:** Docker Compose for consistent dev environment and production parity

---

## Decision Summary

| Decision Area | Choice | Rationale |
|--------------|--------|-----------|
| **Backend Framework** | FastAPI 0.121+ (Python 3.11+) | Native integration with Docling, LangGraph, LLM libraries; eliminates Node.js ↔ Python bridge |
| **Primary Database** | PostgreSQL 18 (Supabase) | Latest stable, pgvector 0.8+ support, auth built-in, storage included, RLS for data isolation |
| **Vector Search** | pgvector 0.8+ | Latest semantic search with improved filtering; single database simplifies operations. **Note:** HNSW index limited to 2000 dims - use `halfvec` cast for 3072-dim embeddings |
| **Graph Database** | Neo4j 2025.01 | Latest stable with Java 21; cross-domain pattern relationships, contradiction tracking |
| **Document Parser** | Docling | RAG-optimized, preserves Excel formulas, table extraction, OCR built-in |
| **Job Queue** | pg-boss | Postgres-based for MVP simplicity; can migrate to Redis+Bull if needed |
| **AI Agent Framework** | LangChain 1.0 + LangGraph 1.0 | Stable v1.0 releases; workflow orchestration with human-in-the-loop interrupts, state management |
| **Type Safety & Validation** | Pydantic v2.12+ | Latest stable; structured outputs, data validation, type-safe tool definitions |
| **LLM Integration** | LangChain LLM Adapters | Model-agnostic interface for multiple providers (Anthropic, Google, OpenAI, etc.) with retry, fallback |
| **LLM Provider (Default)** | Configurable | Provider-agnostic configuration (Anthropic Claude, Google Gemini, OpenAI GPT, etc.) |
| **Conversation Model** | Configurable | Default: Claude Sonnet 4.5 or Gemini 2.5 Pro; easily swappable via config |
| **Extraction Model** | Configurable | Default: Gemini 2.5 Flash (1M context, $0.30/1M input); high-volume extraction |
| **Deep Analysis Model** | Configurable | Default: Gemini 2.5 Pro ($1.25/1M input); complex financial analysis |
| **Speed Tasks Model** | Configurable | Default: Claude Haiku 4 or Gemini 2.5 Flash-Lite ($0.10/1M input); fast, cost-effective |
| **Embeddings** | Configurable | Default: OpenAI text-embedding-3-large; industry-leading semantic search quality |
| **Authentication** | Supabase Auth | OAuth, magic links, MFA out of the box; RLS for multi-tenant security |
| **File Storage** | Google Cloud Storage | Scalable document storage, signed URLs, lifecycle policies for M&A documents |
| **Frontend** | Next.js 15 (React 19.2) | Latest stable with Turbopack beta; proven production-ready, mature ecosystem, shadcn/ui |
| **Development Environment** | Docker Compose | Local Supabase + Neo4j + Next.js orchestration, production parity |
| **Starter Template** | Nextbase Lite | Next.js 16 + Supabase + TypeScript + Tailwind + Testing suite pre-configured |

---

## Technology Stack - Complete

```yaml
Backend:
  framework: FastAPI 0.121+
  language: Python 3.11+ (3.13 compatible)
  validation: Pydantic v2.12+
  async: asyncio + httpx

Frontend:
  framework: Next.js 15 (App Router)
  bundler: Turbopack (beta in Next.js 15)
  ui_library: React 19.2
  styling: Tailwind CSS 4
  components: shadcn/ui
  state_management: Zustand
  data_fetching: TanStack Query (React Query)
  websockets: Supabase Realtime
  starter_template: Nextbase Lite (Next.js 15 + Supabase)

Data Layer:
  primary_database: PostgreSQL 18 (Supabase managed)
  vector_extension: pgvector 0.8+
  # IMPORTANT: pgvector HNSW index has 2000-dimension limit
  # For 3072-dim embeddings (text-embedding-3-large), use halfvec cast:
  # CREATE INDEX ... USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
  # See: https://github.com/pgvector/pgvector/issues/461
  graph_database: Neo4j 2025.01 (Community Edition)
  auth_database: Supabase Auth (built-in)
  file_storage: Google Cloud Storage

Document Processing:
  parser: Docling (IBM open source)
  irl_parser: ExcelJS with intelligent column detection (v2.7, 2025-12-12)
  supported_formats:
    - Excel (.xlsx, .xls) with formula preservation
    - PDF (native + scanned with OCR)
    - Word (.docx, .doc)
    - Images (PNG, JPG) with OCR
  irl_features:
    - Smart header analysis for dynamic column mapping
    - Hierarchical category support (Level 1 → Level 2)
    - Real-time preview before import
    - Automatic category name cleaning

Background Processing:
  job_queue: pg-boss (Postgres-based)
  task_runner: Python worker processes

Intelligence Layer:
  ai_framework: LangChain 1.0 + LangGraph 1.0
  type_safety: Pydantic v2.12+
  llm_integration: LangChain LLM adapters (model-agnostic)

  model_configuration:
    provider_agnostic: true  # Easily swap between providers via environment config

    default_providers:
      conversational: anthropic  # or google, openai
      extraction: google  # or anthropic, openai
      speed_tasks: anthropic  # or google
      embeddings: openai

    example_models:
      anthropic:
        conversation: claude-sonnet-4-5-20250929
        speed: claude-haiku-4-20250514
        deep_analysis: claude-3-opus-20240229
      google:
        conversation: gemini-2.5-pro
        extraction: gemini-2.5-flash     # 1M context, $0.30/1M input - high volume
        deep_analysis: gemini-2.5-pro    # $1.25/1M input - complex reasoning
        speed: gemini-2.5-flash-lite     # $0.10/1M input - batch processing
      openai:
        conversation: gpt-4-turbo
        embeddings: text-embedding-3-large
        speed: gpt-4-mini

Authentication & Authorization:
  provider: Supabase Auth
  methods:
    - Email/Password
    - Magic Links
    - OAuth (Google, Microsoft)
    - MFA (optional)
  security: Row-Level Security (RLS)

Development & Deployment:
  container_orchestration: Docker Compose
  local_development:
    - Supabase (PostgreSQL + Auth + Storage + Realtime)
    - Neo4j 5+ (Community Edition)
    - Next.js 16 dev server with Turbopack
  testing:
    unit_testing:
      framework: Vitest
      features:
        - Thread pool parallelization (pool: 'threads')
        - Test isolation per file
        - CI-optimized reporters (dot + JSON)
        - 3-way test sharding in CI (~3s per shard vs 41s full run)
      utilities:
        - Shared Supabase mock utilities (__tests__/utils/supabase-mock.ts)
        - Data factories (createMockDocument, createMockUser, createMockFolder)
        - Mock query builder with chainable methods
    e2e_testing:
      framework: Playwright
      features:
        - Chromium browser testing
        - Authentication setup (e2e/auth.setup.ts)
        - Data Room E2E tests (15 test cases)
        - CI integration with artifact storage
    component_testing:
      framework: React Testing Library
      utilities:
        - Shared test utilities for Supabase mocking
        - Data factories for consistent mock data
  code_quality:
    - ESLint
    - Prettier
    - Husky (pre-commit hooks)
    - Commitizen (conventional commits)
  ci_pipeline:
    provider: GitHub Actions
    stages:
      - lint: ESLint checks
      - test: Unit tests with 3-way sharding
      - e2e: Playwright E2E tests
      - build: Next.js production build
```

---

## System Architecture

### High-Level Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND LAYER                          │
│  Next.js 16 (Turbopack) + React 19 + Tailwind 4 + shadcn/ui  │
│  - Chat Interface (LangGraph interrupt UI)                     │
│  - Document Upload & Data Room (IRL-driven workflow)          │
│  - Knowledge Base Browser                                      │
│  - CIM Editor                                                  │
│  - Collaborative Analysis Interface                            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ HTTPS + WebSocket
┌─────────────────────▼───────────────────────────────────────────┐
│                        API GATEWAY                              │
│  FastAPI + Pydantic Validation                                 │
│  - REST API endpoints                                          │
│  - WebSocket for real-time updates                            │
│  - Authentication middleware (Supabase)                        │
│  - Rate limiting & request validation                          │
└─────────────┬───────────────────┬───────────────────────────────┘
              │                   │
    ┌─────────▼─────────┐  ┌─────▼─────────┐
    │  PLATFORM LAYER   │  │  AGENT LAYER  │
    │  (Services)       │  │  (Intelligence)│
    └─────────┬─────────┘  └─────┬─────────┘
              │                   │
┌─────────────▼───────────────────▼───────────────────────────────┐
│                       DATA LAYER                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │   Supabase   │  │    Neo4j     │  │   Google     │         │
│  │   Postgres   │  │  (Graph DB)  │  │   Cloud      │         │
│  │  + pgvector  │  │              │  │   Storage    │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└─────────────────────────────────────────────────────────────────┘
              │
┌─────────────▼───────────────────────────────────────────────────┐
│                   PROCESSING LAYER                              │
│  Background Workers (Python)                                    │
│  - Document parsing (Docling)                                  │
│  - Embedding generation (OpenAI)                               │
│  - LLM analysis (Gemini 3.0 Pro)                              │
│  - Pattern detection (Phase 3)                                 │
│  - Graph updates (Neo4j)                                       │
└─────────────────────────────────────────────────────────────────┘
```

### Document Processing Flow

```
User uploads document
  ↓
API Gateway → Google Cloud Storage (file saved)
  ↓
Create document record in Postgres
  ↓
Emit event: document_uploaded
  ↓
pg-boss enqueues job: parse_document
  ↓
Background Worker picks up job
  ↓
Docling parses document
  - Extracts text, tables, formulas
  - Generates semantic chunks
  ↓
pg-boss enqueues job: generate_embeddings
  ↓
Worker generates embeddings (OpenAI)
  ↓
Store chunks in Postgres with embeddings (pgvector)
  ↓
pg-boss enqueues job: analyze_document
  ↓
Worker analyzes with Gemini 3.0 Pro (thinking: high)
  - Extracts key findings
  - Identifies insights
  - Detects potential contradictions
  ↓
Store findings and insights in Postgres
  ↓
pg-boss enqueues job: update_graph
  ↓
Worker updates Neo4j relationships
  - Finding → Document links
  - Cross-domain pattern edges
  - Contradiction relationships
  ↓
Emit event: document_processed
  ↓
WebSocket notification to frontend
  ↓
User sees: "Financial statements analyzed. 12 findings extracted."
```

### Financial Model Integration (MVP Feature)

**Purpose:** Extract, parse, and query financial data from Excel models with formula preservation and cross-validation.

**Architecture Components:**

```python
# packages/financial-extraction/extractor.py
class FinancialModelExtractor:
    """Extracts financial metrics from Excel models"""

    def extract_financial_data(self, excel_file):
        """
        Extract key financial metrics:
        - Revenue (by period, by segment)
        - EBITDA and margins
        - Cash flow statements
        - Balance sheet items (working capital, debt, assets)
        - Projections and assumptions
        - Formula dependencies
        """
        return {
            'time_series': [...],      # Revenue, EBITDA, etc. over time
            'formulas': [...],         # Formula logic and dependencies
            'assumptions': [...],      # Growth rates, drivers
            'cross_refs': [...]        # Sheet/cell references
        }

    def store_financial_data(self, metrics, deal_id, doc_id):
        """Store in financial_metrics table with source attribution"""
        # Creates entries in financial_metrics table
        # Links to knowledge graph via Neo4j
        # Enables queries: "What was Q3 2023 EBITDA?"
```

**Database Schema Addition:**
```sql
CREATE TABLE financial_metrics (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id),
    document_id uuid REFERENCES documents(id),
    metric_type text NOT NULL,  -- 'revenue', 'ebitda', 'cash_flow', etc.
    period date NOT NULL,        -- Quarter or year
    value numeric,
    unit text,                   -- 'USD', 'millions', etc.
    formula text,                -- Excel formula if extracted
    assumptions jsonb,           -- Related assumptions
    source_reference text,       -- Sheet name, cell reference
    created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_financial_metrics_deal ON financial_metrics(deal_id);
CREATE INDEX idx_financial_metrics_type ON financial_metrics(metric_type, period);
```

**Integration with Knowledge Base:**
- Financial metrics stored as specialized findings
- Cross-validated against other document sources
- Queryable via agent tools: `query_financial_metric(metric, period)`
- Contradiction detection for inconsistent financial data across documents

**Processing Flow:**
```
Excel upload → Docling parse → Financial extractor identifies sheets →
Extract metrics + formulas → Store in financial_metrics table →
Create Neo4j nodes for metrics → Link to source document →
Enable queries: "What was Q3 EBITDA growth?" → Agent retrieves with source
```

---

## Project Structure

```
manda/
├── apps/
│   ├── api/                      # FastAPI backend
│   │   ├── main.py
│   │   ├── routers/             # API endpoints
│   │   ├── services/            # Business logic
│   │   ├── middleware/
│   │   └── config.py
│   │
│   ├── workers/                  # Background processing
│   │   ├── main.py
│   │   ├── handlers/            # Job handlers
│   │   └── config.py
│   │
│   └── web/                      # Next.js frontend
│       ├── app/                  # App router
│       ├── components/
│       ├── lib/
│       └── hooks/
│
├── packages/                     # Shared libraries
│   ├── database/                # DB clients
│   ├── docling/                 # Document processing
│   ├── llm/                     # LLM abstraction
│   ├── workflows/               # LangGraph workflows
│   ├── knowledge/               # Knowledge base service
│   └── shared/                  # Common utilities
│
├── docs/
├── docker/
├── scripts/
├── tests/
└── .github/workflows/
```

---

## Data Architecture

### PostgreSQL Schema

Complete schema with all tables, indexes, and RLS policies documented in full architecture document.

**Key Tables:**
- `deals` - Deal metadata
- `documents` - Document tracking with folder_id reference
- `folders` - Hierarchical folder structure for Data Room (see below)
- `findings` - Extracted facts with embeddings (pgvector)
- `insights` - Analyzed patterns
- `conversations` - Chat history with LangGraph state
- `messages` - Chat messages
- `irls` - Information Request Lists
- `irl_items` - IRL line items with manual status tracking
- `qa_lists` - Q&A lists
- `cims` - CIM versions

### Data Room Folder Architecture

**Overview:** IRL upload at project creation generates a hierarchical folder structure in both PostgreSQL (for metadata) and GCS (for file storage). Users manually track IRL item completion via a checklist - no automatic linking between folders and IRL items.

**PostgreSQL Schema - Folders:**
```sql
CREATE TABLE folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES folders(id) ON DELETE CASCADE,  -- NULL for root folders
  name TEXT NOT NULL,
  gcs_path TEXT NOT NULL,  -- e.g., "data-room/1-financial/audited-statements"
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_folder_path UNIQUE (deal_id, gcs_path)
);

CREATE INDEX idx_folders_deal ON folders(deal_id);
CREATE INDEX idx_folders_parent ON folders(parent_id);

-- Documents table update
ALTER TABLE documents ADD COLUMN folder_id UUID REFERENCES folders(id);
CREATE INDEX idx_documents_folder ON documents(folder_id);
```

**PostgreSQL Schema - IRL Items:**
```sql
CREATE TABLE irls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  template_type TEXT,  -- 'tech_ma', 'industrial', 'pharma', 'financial', 'custom'
  source_file_name TEXT,  -- Original uploaded Excel filename
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE irl_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  irl_id UUID REFERENCES irls(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  priority TEXT DEFAULT 'medium',  -- 'high', 'medium', 'low'
  status TEXT DEFAULT 'not_started',  -- 'not_started', 'pending', 'received', 'complete'
  notes TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_irl_items_irl ON irl_items(irl_id);
CREATE INDEX idx_irl_items_status ON irl_items(status);
```

**PostgreSQL Schema - Q&A Items:**
```sql
-- Q&A items are questions sent to the CLIENT to answer (not AI-generated answers)
-- Used during document analysis when gaps/inconsistencies cannot be resolved from knowledge base
CREATE TABLE qa_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'Financials', 'Legal', 'Operations', 'Market', 'Technology', 'HR'
  priority TEXT DEFAULT 'medium',  -- 'high', 'medium', 'low'
  answer TEXT,  -- Client's response (NULL until answered)
  comment TEXT,  -- Optional notes from client or team
  source_finding_id UUID REFERENCES findings(id),  -- Link to finding that triggered Q&A
  created_by UUID REFERENCES auth.users(id),
  date_added TIMESTAMPTZ DEFAULT NOW(),
  date_answered TIMESTAMPTZ,  -- NULL = pending, NOT NULL = answered (replaces status field)
  updated_at TIMESTAMPTZ DEFAULT NOW(),  -- Used for optimistic locking on concurrent edits

  CONSTRAINT valid_category CHECK (category IN ('Financials', 'Legal', 'Operations', 'Market', 'Technology', 'HR')),
  CONSTRAINT valid_priority CHECK (priority IN ('high', 'medium', 'low'))
);

CREATE INDEX idx_qa_items_deal ON qa_items(deal_id);
CREATE INDEX idx_qa_items_category ON qa_items(category);
CREATE INDEX idx_qa_items_pending ON qa_items(deal_id) WHERE date_answered IS NULL;
CREATE INDEX idx_qa_items_source_finding ON qa_items(source_finding_id);

-- Optimistic locking: UPDATE fails if updated_at changed since read
-- Client must include updated_at in UPDATE WHERE clause
-- On conflict: UI shows "Keep Mine | Keep Theirs | Merge" options
```

**GCS Folder Structure:**
```
gs://manda-documents-{env}/
  └── {deal_id}/
      └── data-room/
          ├── 1-financial/
          │   ├── audited-statements/
          │   ├── projections/
          │   └── tax-returns/
          ├── 2-legal/
          │   ├── corporate-documents/
          │   ├── contracts/
          │   └── ip-assets/
          ├── 3-operational/
          │   └── ...
          └── ...
```

**Key Design Decisions:**
1. **Real GCS folders** - Documents stored at `{deal_id}/data-room/{folder.gcs_path}/{filename}`
2. **Manual IRL tracking** - IRL checklist is independent of folder structure; users check items manually
3. **No auto-linking** - Documents uploaded to folders don't auto-update IRL status (user may restructure)
4. **Expandable checklist** - IRL items displayed as expandable checklist in Data Room sidebar
5. **User-modifiable structure** - Folders can be added/renamed/deleted after IRL generation

**Security:**
- Row-Level Security (RLS) on all tables
- Users can only access their own deals
- Database enforces isolation
- GCS signed URLs for document access

### Neo4j Graph Schema

**Nodes:**
```cypher
// Deal node
(:Deal {
    id: UUID,
    name: String,
    user_id: UUID
})

// Document node
(:Document {
    id: UUID,
    name: String,
    upload_date: DateTime,
    doc_type: String
})

// Finding node (with temporal metadata)
(:Finding {
    id: UUID,
    text: String,
    confidence: Float,
    date_referenced: DateTime,  // Date of the data (e.g., "Q3 2024" → 2024-09-30)
    date_extracted: DateTime,   // When finding was extracted
    source_document_id: UUID,
    source_location: String     // "Page 5", "Cell B15", etc.
})

// Insight node
(:Insight {
    id: UUID,
    text: String,
    insight_type: String        // "pattern", "contradiction", "gap"
})
```

**Relationships:**
```cypher
// Source attribution
(:Finding)-[:EXTRACTED_FROM {page: Int, cell: String}]->(:Document)

// Temporal contradiction (critical for date-aware validation)
(:Finding {date_referenced: "2024-Q3"})-[:CONTRADICTS {detected_at: DateTime}]->(:Finding {date_referenced: "2024-Q2"})

// Supersession (newer data replaces older)
(:Finding {date_referenced: "2024-Q3"})-[:SUPERSEDES]->(:Finding {date_referenced: "2024-Q2"})

// Supporting evidence
(:Finding)-[:SUPPORTS {strength: Float}]->(:Finding)

// Cross-domain patterns (e.g., financial × operational)
(:Finding)-[:PATTERN_DETECTED {pattern_type: String}]->(:Finding)

// Insight derivation
(:Insight)-[:BASED_ON {relevance: Float}]->(:Finding)
```

**Temporal Intelligence (Critical Feature):**
- **date_referenced:** The date the data refers to (e.g., "Q3 2024 revenue" → 2024-09-30)
- **date_extracted:** When the finding was extracted from documents
- **Why This Matters:** Prevents false contradictions (Q2 vs Q3 data are different time periods, not contradictions)
- **Validation Logic:** When user says "Q3 revenue is $5.5M", agent checks:
  1. Is there existing Q3 revenue finding? (SUPERSEDES if newer source)
  2. Is there Q2 revenue finding? (NOT a contradiction - different time period)
  3. Is there conflicting Q3 revenue? (TRUE contradiction - same time period, different values)

**Phase 2 Enhancement (Research):**
- **Graphiti by Zep:** Temporal knowledge graph library for advanced time-aware entity resolution and deduplication

---

## Intelligence Layer

### Pydantic + LangGraph Integration Strategy

**Architecture Decision:** We use **Pydantic v2 for type safety and validation** combined with **LangChain/LangGraph for agent orchestration**. This is a complementary hybrid approach, not competing frameworks.

#### How They Work Together

```
┌─────────────────────────────────────────────────────────────┐
│                    MANDA AGENT LAYER                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         LangGraph Workflows (Orchestration)          │  │
│  │  - CIM Builder Workflow (user-defined stages)       │  │
│  │  - Q&A Co-Creation Workflow                         │  │
│  │  - Document Analysis Workflow                       │  │
│  │  - Human-in-the-loop interrupts                     │  │
│  │  - State management & checkpoints                   │  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                              │
│  ┌─��──────────▼─────────────────────────────────────────┐  │
│  │      Agent Tools (Type-Safe with Pydantic)          │  │
│  │  - query_knowledge_base() → KnowledgeQueryInput     │  │
│  │  - suggest_narrative_outline() → NarrativeRequest   │  │
│  │  - generate_slide_blueprint() → SlideRequest        │  │
│  │  - All inputs/outputs validated with Pydantic models│  │
│  └────────────┬─────────────────────────────────────────┘  │
│               │                                              │
│  ┌────────────▼─────────────────────────────────────────┐  │
│  │    LangChain LLM Integration (Multi-Provider)       │  │
│  │  - ChatAnthropic (Claude models)                    │  │
│  │  - ChatGoogleGenerativeAI (Gemini models)           │  │
│  │  - ChatOpenAI (GPT models for embeddings)           │  │
│  │  - Retry logic, fallback, cost tracking             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

#### Role Separation

**LangGraph (Workflow Orchestration):**
- Manages complex multi-step workflows with state
- Provides human-in-the-loop interrupts (crucial for CIM v3, Q&A workflows)
- Handles routing between nodes (phases)
- Persists workflow state to PostgreSQL for resume capability
- Enables conditional branching and iteration

**Pydantic v2 (Type Safety & Validation):**
- Defines structured schemas for all tool inputs/outputs
- Validates LLM-generated content against schemas
- Ensures data integrity at API boundaries
- Provides runtime type checking and validation errors
- Serialization/deserialization for database storage

**LangChain (LLM Integration):**
- Unified interface for multiple LLM providers (Anthropic, Google, OpenAI)
- Built-in retry logic and error handling
- Fallback mechanisms if primary LLM fails
- Cost tracking and observability hooks
- Tool/function calling abstractions

#### Code Example: Pydantic + LangGraph Integration

```python
from pydantic import BaseModel, Field, validator
from langchain_anthropic import ChatAnthropic
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.graph import StateGraph, END
from langgraph.checkpoint.postgres import PostgresSaver
from typing import Annotated, TypedDict

# ============================================================
# PYDANTIC MODELS (Type Safety & Validation)
# ============================================================

class KnowledgeQueryInput(BaseModel):
    """Input schema for query_knowledge_base tool"""
    query: str = Field(..., min_length=3, description="Search query")
    filters: dict[str, str] = Field(default_factory=dict)
    limit: int = Field(default=10, ge=1, le=50)

    @validator('query')
    def validate_query(cls, v):
        if len(v.split()) < 2:
            raise ValueError("Query must contain at least 2 words")
        return v

class Finding(BaseModel):
    """Structured finding from RAG"""
    text: str
    source_document: str
    page_number: int | None = None
    confidence: float = Field(ge=0.0, le=1.0)
    embedding: list[float] | None = None

class KnowledgeQueryOutput(BaseModel):
    """Output schema for query_knowledge_base tool"""
    findings: list[Finding]
    total_count: int
    query_time_ms: float

class NarrativeOutlineRequest(BaseModel):
    """Input for suggest_narrative_outline tool"""
    buyer_persona: str = Field(..., regex="^(strategic|financial|custom)$")
    investment_thesis: dict[str, str]
    context: str

class NarrativeSection(BaseModel):
    """Single section in narrative outline"""
    name: str
    purpose: str
    order: int
    estimated_slides: int = Field(ge=1, le=10)

class NarrativeOutlineOutput(BaseModel):
    """Output from suggest_narrative_outline"""
    sections: list[NarrativeSection]
    flow_reasoning: str
    buyer_alignment: str

class SlideContentElement(BaseModel):
    """Single content element in a slide"""
    id: str
    text: str
    source_finding_id: str
    element_type: str = Field(regex="^(headline|body|callout|metric)$")

class VisualPositioning(BaseModel):
    """Visual specs for a content element (extreme precision)"""
    position: str  # "top left", "center", "bottom right", etc.
    format: str    # "callout box", "bullet", "chart", etc.
    styling: str   # "bold, 18pt, #333", etc.
    icon: str | None = None

class SlideBlueprint(BaseModel):
    """Complete slide visual concept"""
    slide_topic: str
    layout_type: str
    positioned_elements: dict[str, VisualPositioning]  # element_id -> specs
    background_color: str = "#FFFFFF"

    @validator('positioned_elements')
    def validate_all_elements_positioned(cls, v, values):
        # This validator ensures extreme visual precision
        # In practice, you'd pass content_elements to compare
        if not v:
            raise ValueError("All content elements must be positioned")
        return v

# ============================================================
# AGENT TOOLS (Pydantic-Validated Functions)
# ============================================================

async def query_knowledge_base(
    input: KnowledgeQueryInput
) -> KnowledgeQueryOutput:
    """
    Semantic search across findings using pgvector.
    Input/output validated by Pydantic models.
    """
    # Pydantic validates input automatically
    # Generate embedding
    from openai import OpenAI
    client = OpenAI()

    embedding = client.embeddings.create(
        model="text-embedding-3-large",
        input=input.query
    ).data[0].embedding

    # Vector search in PostgreSQL
    from db import get_db
    async with get_db() as db:
        results = await db.execute(
            """
            SELECT text, source_document, page_number, confidence,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM findings
            WHERE deal_id = $2
              AND ($3::jsonb IS NULL OR metadata @> $3)
            ORDER BY embedding <=> $1::vector
            LIMIT $4
            """,
            embedding,
            input.filters.get('deal_id'),
            input.filters,
            input.limit
        )

    findings = [
        Finding(
            text=r['text'],
            source_document=r['source_document'],
            page_number=r['page_number'],
            confidence=r['confidence']
        )
        for r in results
    ]

    # Pydantic validates output automatically
    return KnowledgeQueryOutput(
        findings=findings,
        total_count=len(findings),
        query_time_ms=42.5  # Placeholder
    )

async def suggest_narrative_outline(
    input: NarrativeOutlineRequest
) -> NarrativeOutlineOutput:
    """
    Generate CIM narrative outline using LLM + RAG.
    Input/output validated by Pydantic models.
    """
    # Query knowledge base for context
    knowledge = await query_knowledge_base(
        KnowledgeQueryInput(
            query="company overview, value drivers, competitive advantages",
            filters={"deal_id": input.context},
            limit=20
        )
    )

    # Use LangChain LLM with structured output
    from langchain_anthropic import ChatAnthropic

    llm = ChatAnthropic(
        model="claude-sonnet-4-5-20250929",
        temperature=0.7
    )

    # Use Pydantic model as structured output schema
    structured_llm = llm.with_structured_output(NarrativeOutlineOutput)

    prompt = f"""
    Create a Company Overview narrative outline for a {input.buyer_persona} buyer.

    Investment Thesis:
    {input.investment_thesis}

    Key Findings from Knowledge Base:
    {[f.text for f in knowledge.findings[:10]]}

    Generate 5-8 sections with clear flow and buyer alignment.
    """

    # LLM output is automatically validated against Pydantic schema
    outline = await structured_llm.ainvoke(prompt)

    return outline  # Already a NarrativeOutlineOutput instance

# ============================================================
# LANGGRAPH WORKFLOW (Orchestration with State Management)
# ============================================================

class CIMWorkflowState(TypedDict):
    """State for CIM Builder workflow (user-defined stages)"""
    deal_id: str
    cim_id: str
    buyer_persona: str | None
    investment_thesis: dict | None
    narrative_outline: NarrativeOutlineOutput | None
    sections: list[dict]
    conversation_history: list[dict]
    human_input: str | None

# Define workflow nodes
async def phase1_understand_buyer(state: CIMWorkflowState):
    """Phase 1: Conversational buyer discovery"""
    llm = ChatAnthropic(model="claude-sonnet-4-5-20250929")

    response = await llm.ainvoke(
        "Ask about buyer type and motivations"
    )

    return {
        **state,
        "conversation_history": [
            *state["conversation_history"],
            {"role": "assistant", "content": response.content}
        ],
        "current_phase": 1
    }

async def phase2_investment_thesis(state: CIMWorkflowState):
    """Phase 2: Develop investment thesis with RAG"""
    # Use Pydantic-validated tool
    outline = await suggest_narrative_outline(
        NarrativeOutlineRequest(
            buyer_persona=state["buyer_persona"],
            investment_thesis=state["investment_thesis"],
            context=state["deal_id"]
        )
    )

    return {
        **state,
        "narrative_outline": outline.dict(),  # Serialize Pydantic model
        "current_phase": 2
    }

async def phase3_discover_structure(state: CIMWorkflowState):
    """Phase 3: AI suggests section structure"""
    # Access validated narrative outline
    outline = NarrativeOutlineOutput(**state["narrative_outline"])

    # Present to user with human-in-the-loop interrupt
    return {
        **state,
        "sections": [s.dict() for s in outline.sections],
        "current_phase": 3,
        # LangGraph will interrupt here for human approval
    }

# Build workflow graph
workflow = StateGraph(CIMWorkflowState)

# Add nodes (phases)
workflow.add_node("phase1", phase1_understand_buyer)
workflow.add_node("phase2", phase2_investment_thesis)
workflow.add_node("phase3", phase3_discover_structure)
# ... add phases 4-14

# Define edges with conditional routing
workflow.add_edge("phase1", "phase2")
workflow.add_edge("phase2", "phase3")

# Set entry point
workflow.set_entry_point("phase1")

# Configure PostgreSQL checkpointer for state persistence
from langgraph.checkpoint.postgres import PostgresSaver
checkpointer = PostgresSaver.from_conn_string("postgresql://...")

# Compile workflow with checkpointer
app = workflow.compile(
    checkpointer=checkpointer,
    interrupt_before=["phase3", "phase4", ...]  # Human-in-the-loop
)

# ============================================================
# USAGE: Running the Workflow
# ============================================================

async def run_cim_workflow(deal_id: str, user_id: str):
    """Execute CIM v3 workflow with state persistence"""

    # Initial state
    initial_state = CIMWorkflowState(
        deal_id=deal_id,
        current_phase=0,
        buyer_persona=None,
        investment_thesis=None,
        narrative_outline=None,
        sections=[],
        conversation_history=[],
        human_input=None
    )

    # Run with thread_id for checkpoint persistence
    config = {"configurable": {"thread_id": f"{user_id}_{deal_id}"}}

    # Execute until first interrupt (phase3)
    result = await app.ainvoke(initial_state, config)

    # Workflow paused at phase3, waiting for human approval
    return result

async def resume_workflow(deal_id: str, user_id: str, human_input: str):
    """Resume workflow after human input"""
    config = {"configurable": {"thread_id": f"{user_id}_{deal_id}"}}

    # Update state with human input
    current_state = await app.aget_state(config)
    current_state.values["human_input"] = human_input

    # Resume execution
    result = await app.ainvoke(current_state.values, config)

    return result
```

#### Key Benefits of This Approach

**1. Type Safety Throughout:**
- Pydantic validates all tool inputs/outputs
- Compile-time type checking with Python type hints
- Runtime validation catches errors early
- Structured LLM outputs prevent hallucination drift

**2. Workflow Orchestration:**
- LangGraph manages CIM Builder workflow with user-defined stages
- State persistence enables resume from any checkpoint
- Human-in-the-loop interrupts for collaborative creation
- Conditional branching based on user decisions

**3. Multi-LLM Flexibility:**
- LangChain adapters support Anthropic, Google, OpenAI
- Easy to switch models for different tasks
- Fallback mechanisms if primary LLM fails
- Cost optimization through model routing

**4. Production Readiness:**
- Both Pydantic and LangChain are battle-tested
- Active communities and extensive documentation
- Enterprise adoption validates approach
- Clear separation of concerns (validation vs orchestration)

#### Alternative Considered: Pydantic AI Framework

We evaluated using Pydantic AI (the full agent framework) instead of LangChain, but decided against it because:

- **Pydantic AI** is newer (released late 2024) with smaller ecosystem
- **LangGraph's human-in-the-loop** pattern is critical for our CIM/Q&A workflows
- **LangChain's maturity** provides more integrations and community support
- **Pydantic library** gives us type safety without locking into the Pydantic AI framework

However, we keep Pydantic AI on our radar for future evaluation as it matures.

### Multi-Model Strategy (Provider-Agnostic)

**Architecture Principle:** The system is **model-agnostic** and uses LangChain adapters to easily swap between providers (Anthropic, Google, OpenAI, etc.) via environment configuration.

| Task | Requirements | Default Provider | Alternative Options |
|------|--------------|------------------|---------------------|
| **Document Extraction** | Long context (100K+ tokens), structured output | Gemini 2.0 Pro (2M context) | Claude Opus 3, GPT-4 Turbo |
| **Pattern Detection** | Cross-domain reasoning, transparency | Gemini 2.0 Pro (thinking mode) | Claude Sonnet 4.5, GPT-4 |
| **Chat (User-Facing)** | Conversational, domain knowledge | Claude Sonnet 4.5 | Gemini 2.0 Pro, GPT-4 Turbo |
| **CIM Narrative** | Long-form generation, coherence | Claude Sonnet 4.5 | Gemini 2.0 Pro, GPT-4 Turbo |
| **Speed Tasks** | Fast, cost-effective, simple queries | Claude Haiku 4 | Gemini 2.0 Flash, GPT-4 Mini |
| **Deep Analysis** | Complex reasoning (use sparingly) | Claude Opus 3 | GPT-4, Gemini 2.0 Pro |
| **Embeddings** | Semantic search quality | OpenAI text-embedding-3-large | Cohere embed-v3, Voyage AI |

**Configuration Example:**

```python
# config/llm_config.py
from pydantic import BaseModel
from enum import Enum

class LLMProvider(str, Enum):
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    OPENAI = "openai"

class LLMConfig(BaseModel):
    # Task-specific provider configuration
    conversational_provider: LLMProvider = LLMProvider.ANTHROPIC
    conversational_model: str = "claude-sonnet-4-5-20250929"

    extraction_provider: LLMProvider = LLMProvider.GOOGLE
    extraction_model: str = "gemini-2.0-pro"

    speed_provider: LLMProvider = LLMProvider.ANTHROPIC
    speed_model: str = "claude-haiku-4-20250514"

    embeddings_provider: str = "openai"
    embeddings_model: str = "text-embedding-3-large"

# Easily swap providers via environment variables
llm_config = LLMConfig(
    conversational_provider=os.getenv("CONV_PROVIDER", "anthropic"),
    conversational_model=os.getenv("CONV_MODEL", "claude-sonnet-4-5-20250929"),
    # ... etc
)
```

**Benefits:**
- ✅ **Easy Testing**: Compare providers for your specific use case
- ✅ **Cost Optimization**: Mix and match based on price/performance
- ✅ **Vendor Independence**: No lock-in to single provider
- ✅ **Fallback Support**: LangChain provides automatic fallback if primary fails

### Agent Tools (19 Total: 16 Chat + 3 CIM Workflow)

**Knowledge Management:**
1. `query_knowledge_base(query, filters)` - Semantic search across findings
2. `update_knowledge_base(finding, source, confidence, date_referenced)` - Store analyst-provided findings with temporal metadata
3. `update_knowledge_graph(finding_id, relationships)` - Create relationships between findings
4. `validate_finding(finding, context, date_referenced)` - Check finding against existing knowledge with temporal validation

**Document Operations:**
5. `get_document_info(doc_id)` - Retrieve document details
6. `trigger_analysis(doc_id, analysis_type)` - Request processing

**Workflow Management:**
7. `create_irl(deal_type)` - Generate IRL from template

**Q&A Management (Questions for CLIENT to answer - not AI-generated answers):**
8. `add_qa_item(question, category, priority, source_finding_id?)` - Add single Q&A item, optionally linked to finding
9. `add_qa_items_batch(items[])` - Add multiple Q&A items at once
10. `suggest_qa_from_finding(finding_id)` - Suggest Q&A item from an inconsistency/gap finding
11. `get_qa_summary()` - Return counts by category/priority (lightweight for context)
12. `get_qa_items(filters?)` - Retrieve Q&A items with optional filters
13. `update_qa_item(id, updates)` - Modify existing Q&A item
14. `remove_qa_item(id)` - Delete Q&A item

**Intelligence:**
15. `detect_contradictions(topic)` - Find inconsistencies
16. `find_gaps(category)` - Identify missing information

**CIM v3 Workflow Tools (Separate CIM Agent - Not in Chat):**
17. `suggest_narrative_outline(buyer_persona, context)` - Propose story arc for CIM Company Overview
18. `validate_idea_coherence(narrative, proposed_idea)` - Check narrative alignment against established story
19. `generate_slide_blueprint(slide_topic, narrative_context, content_elements)` - Create slide guidance with extreme visual precision

**Note:** Legacy `generate_cim_section()` tool removed - CIM creation now exclusively handled by dedicated CIM v3 workflow agent (Epic 9)

---

## Conversational Agent Implementation (Real-Time Chat)

### Overview

**Purpose:** Enable real-time conversational interaction where the analyst asks questions and the agent selects and invokes appropriate tools to answer.

**Pattern:** LangChain Tool-Calling Agent with Native Function Calling

**Key Distinction:**
- **LangGraph:** For multi-step WORKFLOWS with state persistence and human-in-the-loop (CIM v3, Q&A Co-Creation)
- **LangChain Agent:** For real-time CONVERSATION with dynamic tool selection and invocation

### Why LangChain Tool-Calling Agent?

**Rationale:**
1. **Native Function Calling:** Claude Sonnet 4.5 and Gemini 2.0 Pro support native function calling (more reliable than ReAct prompting)
2. **Automatic Tool Selection:** LLM decides which tools to call based on user query
3. **Streaming Support:** LangChain's `astream_events()` enables token-by-token streaming while executing tool calls
4. **Proven Pattern:** Battle-tested approach used in production by many LangChain applications
5. **Multi-Turn Context:** Agent executor maintains conversation history automatically

**Alternative Considered:** LangChain ReAct Agent
- **Rejected because:** ReAct uses prompting for tool selection (less reliable than native function calling)
- **Native function calling** leverages Claude/Gemini's built-in tool-use capabilities

### Architecture Components

**Tool Definition Pattern:**

```python
from langchain_core.tools import tool
from pydantic import BaseModel, Field

# Define Pydantic schema for tool input (type safety)
class KnowledgeQueryInput(BaseModel):
    """Input schema for query_knowledge_base tool"""
    query: str = Field(..., min_length=3, description="Search query")
    filters: dict[str, str] = Field(default_factory=dict, description="Optional filters (e.g., deal_id)")
    limit: int = Field(default=10, ge=1, le=50, description="Max results to return")

# Define tool with Pydantic schema for LangChain
@tool("query_knowledge_base", args_schema=KnowledgeQueryInput)
async def query_knowledge_base_tool(query: str, filters: dict, limit: int) -> str:
    """
    Semantic search across findings using pgvector.
    Returns findings with source attribution.
    """
    # Call the actual Pydantic-validated function
    result = await query_knowledge_base(
        KnowledgeQueryInput(query=query, filters=filters, limit=limit)
    )

    # Format for LLM consumption
    findings_text = "\n".join([
        f"- {f.text} (source: {f.source_document}, confidence: {f.confidence:.2f})"
        for f in result.findings
    ])

    return f"Found {result.total_count} findings:\n{findings_text}"

# Define all 11 chat tools similarly (CIM v3 tools are in separate agent)...
```

**Agent Setup:**

```python
from langchain_anthropic import ChatAnthropic
from langchain.agents import create_tool_calling_agent, AgentExecutor
from langchain_core.prompts import ChatPromptTemplate

# Initialize LLM with tool-calling support
llm = ChatAnthropic(
    model="claude-sonnet-4-5-20250929",
    temperature=0.7,
    streaming=True  # Enable token-by-token streaming
)

# Define system prompt for agent
system_prompt = """You are an M&A intelligence assistant with access to a comprehensive knowledge base.

Your capabilities:
- Query findings from documents (query_knowledge_base)
- Update knowledge with new findings (update_knowledge_base)
- Detect contradictions and gaps (detect_contradictions, find_gaps)
- Manage Q&A list for client questions (add_qa_item, get_qa_items, suggest_qa_from_finding)
- When you cannot resolve an issue from the knowledge base, suggest adding it to the Q&A list
- And more specialized tools...

Always cite sources when providing information. Use tool calls to access the knowledge base.
When you can't find an answer in documents, suggest adding to Q&A list for client clarification.
When you don't know something, say so - don't hallucinate."""

prompt = ChatPromptTemplate.from_messages([
    ("system", system_prompt),
    ("placeholder", "{chat_history}"),  # Conversation history
    ("human", "{input}"),
    ("placeholder", "{agent_scratchpad}"),  # Tool invocation history
])

# Register 16 chat agent tools (CIM v3 tools are in separate CIM agent)
tools = [
    # Knowledge Management
    query_knowledge_base_tool,
    update_knowledge_base_tool,
    update_knowledge_graph_tool,
    validate_finding_tool,
    # Document Operations
    get_document_info_tool,
    trigger_analysis_tool,
    # Workflow Management
    create_irl_tool,
    # Q&A Management (questions for CLIENT to answer)
    add_qa_item_tool,
    add_qa_items_batch_tool,
    suggest_qa_from_finding_tool,
    get_qa_summary_tool,
    get_qa_items_tool,
    update_qa_item_tool,
    remove_qa_item_tool,
    # Intelligence
    detect_contradictions_tool,
    find_gaps_tool,
]

# Note: CIM v3 tools (suggest_narrative_outline, validate_idea_coherence, generate_slide_blueprint)
# are only available in the dedicated CIM Builder workflow agent, not in chat

# Create tool-calling agent
agent = create_tool_calling_agent(llm, tools, prompt)

# Create executor for running agent
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    verbose=True,  # Log tool calls (useful for debugging)
    max_iterations=5,  # Prevent infinite loops
    return_intermediate_steps=True  # Return tool call details
)
```

**Streaming Conversation with Tool Calls:**

```python
async def stream_agent_response(user_query: str, conversation_history: list, deal_id: str):
    """
    Stream agent response with tool calls to frontend.
    Yields tokens + tool invocation indicators.
    """

    # Prepare input with conversation history
    agent_input = {
        "input": user_query,
        "chat_history": conversation_history,  # List of HumanMessage/AIMessage
    }

    # Stream events from agent executor
    async for event in agent_executor.astream_events(agent_input, version="v1"):

        # Stream LLM tokens to frontend
        if event["event"] == "on_chat_model_stream":
            chunk = event["data"]["chunk"]
            if chunk.content:
                yield {"type": "token", "content": chunk.content}

        # Tool call started - show indicator to user
        elif event["event"] == "on_tool_start":
            tool_name = event["name"]
            tool_input = event["data"].get("input")
            yield {
                "type": "tool_start",
                "tool": tool_name,
                "status": f"Using {tool_name}..."
            }

        # Tool call completed - tool output will be passed back to LLM
        elif event["event"] == "on_tool_end":
            tool_name = event["name"]
            tool_output = event["data"].get("output")
            yield {
                "type": "tool_end",
                "tool": tool_name,
                "status": f"Completed {tool_name}"
            }
```

**Frontend Integration (WebSocket):**

```typescript
// Frontend receives streaming events via WebSocket
socket.on('agent_stream', (event) => {
  switch (event.type) {
    case 'token':
      // Append token to message display
      appendToken(event.content);
      break;

    case 'tool_start':
      // Show loading indicator: "Searching knowledge base..."
      showToolIndicator(event.tool, event.status);
      break;

    case 'tool_end':
      // Hide loading indicator
      hideToolIndicator(event.tool);
      break;
  }
});
```

### How Tool Selection Works

**Example Conversation Flow:**

```
User: "What were the Q3 revenues?"

1. Agent receives query
2. LLM (Claude) decides to call query_knowledge_base tool
   - Function calling: {"name": "query_knowledge_base", "arguments": {"query": "Q3 revenues", "limit": 5}}
3. Tool executes: Searches pgvector for relevant findings
4. Tool returns: "Found 3 findings: - Q3 revenues were $5.2M (source: financials.xlsx, confidence: 0.92)..."
5. LLM receives tool output and generates response
6. Agent streams response: "According to the financials (financials.xlsx), Q3 revenues were $5.2M."
```

**Multi-Tool Conversations:**

```
User: "Summarize the company's financial performance and check for any contradictions."

1. Agent calls query_knowledge_base(query="financial performance")
2. Agent receives findings
3. Agent calls detect_contradictions(topic="financial metrics")
4. Agent receives contradiction report
5. Agent synthesizes both tool outputs into coherent response
```

### Conversation Persistence

**Database Schema:**

```sql
-- Store conversations
CREATE TABLE conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id),
    user_id uuid REFERENCES auth.users(id),
    title text,  -- Auto-generated from first message
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Store messages (human + AI)
CREATE TABLE messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id uuid REFERENCES conversations(id),
    role text NOT NULL,  -- 'human', 'ai', 'tool'
    content text NOT NULL,
    tool_calls jsonb,  -- Store tool invocations for debugging
    created_at timestamptz DEFAULT now()
);
```

**Loading Conversation History:**

```python
async def load_conversation_history(conversation_id: str) -> list:
    """Load previous messages for context."""
    from langchain_core.messages import HumanMessage, AIMessage

    messages = await db.execute(
        """
        SELECT role, content FROM messages
        WHERE conversation_id = $1
        ORDER BY created_at ASC
        """,
        conversation_id
    )

    history = []
    for msg in messages:
        if msg['role'] == 'human':
            history.append(HumanMessage(content=msg['content']))
        elif msg['role'] == 'ai':
            history.append(AIMessage(content=msg['content']))

    return history
```

### Error Handling

**Tool Call Failures:**

```python
# Agent executor handles tool errors gracefully
agent_executor = AgentExecutor(
    agent=agent,
    tools=tools,
    handle_parsing_errors=True,  # Catch LLM output parsing errors
    max_iterations=5,  # Prevent infinite loops if tool keeps failing
)

# Custom error handler for tool exceptions
@tool("query_knowledge_base", args_schema=KnowledgeQueryInput)
async def query_knowledge_base_tool(query: str, filters: dict, limit: int) -> str:
    try:
        result = await query_knowledge_base(...)
        return format_findings(result)
    except Exception as e:
        # Return error message to LLM so it can inform user
        return f"Error searching knowledge base: {str(e)}. Please try rephrasing your query."
```

**LLM Fallback:**

```python
# If Claude fails, fallback to Gemini
from langchain_google_genai import ChatGoogleGenerativeAI

llm_primary = ChatAnthropic(model="claude-sonnet-4-5-20250929")
llm_fallback = ChatGoogleGenerativeAI(model="gemini-2.0-pro")

# LangChain supports fallback chains
from langchain.llms import FallbackLLM
llm = FallbackLLM(llms=[llm_primary, llm_fallback])
```

### Key Benefits of This Approach

1. **Type Safety:** Pydantic schemas validate all tool inputs/outputs
2. **Reliability:** Native function calling > ReAct prompting
3. **Streaming:** Token-by-token responses with tool call indicators
4. **Debugging:** All tool calls logged and stored in messages table
5. **Flexibility:** Easy to add new tools (just define @tool decorator)
6. **Multi-Turn:** Conversation history maintained automatically
7. **Error Resilience:** Graceful handling of tool failures and LLM errors

### Comparison: Agent Executor vs LangGraph

| Feature | Agent Executor (Chat) | LangGraph (Workflows) |
|---------|----------------------|------------------------|
| **Use Case** | Real-time conversation | Multi-step workflow with human approval |
| **State Persistence** | Conversation history only | Full workflow state with checkpoints |
| **Tool Calling** | Dynamic (LLM decides) | Explicit (developer defines) |
| **Human-in-the-Loop** | No interrupts | Interrupts at specified nodes |
| **Complexity** | Simple agent loop | Complex state graphs |
| **Example** | Chat Assistant (Epic 5) | CIM v3 Workflow (Epic 9) |

**When to Use Each:**
- **Agent Executor:** Real-time chat where LLM dynamically selects tools
- **LangGraph:** Multi-phase workflows requiring human approval between steps

---

## CIM v3 Workflow Implementation

### Overview

**What:** Flexible framework for creating complete CIMs through agent-guided, iterative workflow with NotebookLM-inspired three-panel interface
**Where:** Dedicated CIM Builder UI at `/projects/[id]/cim-builder`
**How:** LangGraph workflow with human-in-the-loop + RAG/GraphRAG knowledge integration + wireframe preview
**Scope:** Complete CIM creation framework. Users define their own CIM structure collaboratively with the agent — not limited to Company Overview. Supports multiple CIMs per deal for different buyer types.

**Design Philosophy:** Users define their own CIM structure collaboratively with the agent. No fixed phase count — the workflow adapts to user needs while providing comprehensive guidance through buyer persona discovery, outline definition, content creation, and visual design.

### Architecture Components

**Frontend (CIM Builder UI — NotebookLM-inspired):**
```
/projects/[id]/cim-builder
├── Left Panel: Sources
│   ├── Documents (from deal data room)
│   ├── Findings (validated knowledge)
│   ├── Q&A items
│   └── CIM Structure sidebar (outline with progress)
├── Center Panel: Conversation
│   ├── Agent-guided workflow messages
│   ├── User input and decisions
│   └── Click-to-reference integration
└── Right Panel: Preview
    ├── Wireframe slide preview
    ├── Click any element to discuss/edit
    ├── Navigation: Prev/Next + slide counter
    └── Slide status indicators
```

**Click-to-Reference Feature:**
- Click any source in left panel → adds reference to conversation
- Click any element in preview → opens editing context in chat
- Agent understands clicked context automatically
- No slash commands needed — natural conversation flow

**Backend (LangGraph Workflow):**
```python
# Workflow structure
class CIMBuilderWorkflow:
    checkpoints: Human-in-the-loop at key decisions
    state: Persisted in cims table (JSONB)
    tools: CIM-specific + platform tools
    features: Dependency tracking, non-linear navigation
```

### Workflow Stages (User-Defined)

**Stage: Buyer Persona & Investment Thesis**
- **Type:** Conversational discovery
- **Checkpoint:** Persona and thesis confirmation
- **State Stored:** buyer_persona{}, investment_thesis{}
- **Tools Used:** `query_knowledge_base()` for thesis grounding

**Stage: Agenda/Outline Definition**
- **Type:** Collaborative outline building
- **Checkpoint:** Outline confirmation
- **State Stored:** outline[] (sections with order)
- **Tools Used:** `suggest_narrative_outline(buyer_persona, context)`

**Stage: Slide Content Creation (Iterative)**
- **Type:** Non-linear slide-by-slide content with hybrid RAG
- **Checkpoints:** Content approval per slide (status: draft → approved, reversible)
- **State Stored:**
  - slides[] with content_elements, section_id, source_refs, status
  - source_citations[] with type attribution (qa/finding/document)
  - dependency_refs[]
- **Tools Used:**
  - `searchQAItems()` - Text search on answered Q&A (HIGHEST PRIORITY - most recent data)
  - `searchFindings()` - pgvector semantic search on findings (confidence > 0.3)
  - `searchDocumentChunks()` - pgvector semantic search on raw document content
  - `enrichWithRelationships()` - Neo4j queries for SUPPORTS/CONTRADICTS/SUPERSEDES
  - `mergeAndRankResults()` - Priority merge: Q&A > Findings > Chunks
  - `validate_idea_coherence()` - Check content fits narrative
  - `generate_slide_blueprint()` - Create visual concept

**Content Phase Logic:**
```python
def build_slide_content(section, slide_topic):
    # 1. Hybrid RAG search with Q&A priority
    qa_results = search_qa_items(deal_id, slide_topic)  # Most recent
    findings = search_findings(deal_id, slide_topic, threshold=0.3)
    chunks = search_document_chunks(deal_id, slide_topic, threshold=0.3)

    # 2. Enrich findings with Neo4j relationships
    relationships = enrich_with_relationships(finding_ids)
    # Flag any CONTRADICTS for user attention

    # 3. Merge and rank (Q&A > Findings > Chunks)
    ranked_content = merge_and_rank_results(qa_results, findings, chunks, relationships)

    # 4. Present 2-3 content options with source citations
    # Format: (qa: question), (finding: excerpt), (source: file, page)
    options = generate_content_options(ranked_content, buyer_persona, narrative)

    # 5. Human checkpoint
    selected = await human_input("Select option or suggest alternative")

    # 6. Generate slide content with sources
    content = create_slide_content(selected, ranked_content)

    return content
```

**Visual Phase Logic:**
```python
def build_visual_concept(content_elements):
    # 1. Generate visual concept with extreme precision
    visual = generate_slide_blueprint(
        slide_topic=current_slide.topic,
        narrative_context={buyer_persona, section, investment_thesis},
        content_elements=content_elements
    )

    # Validates: ALL content elements positioned
    assert len(visual.positioned_elements) == len(content_elements)

    # 2. Human checkpoint with modification capability
    approved = await human_input(
        "Approve visual or request changes",
        allow_modifications=True
    )

    if approved.modifications:
        visual = regenerate_visual(visual, approved.modifications)
        approved = await human_input("Approve updated visual")

    return visual
```

**Balance Check Logic (After Each Section):**
```python
def balance_check(completed_sections):
    analysis = {
        "completed": [s.name for s in completed_sections],
        "slide_counts": {s.name: len(s.slides) for s in completed_sections},
        "emphasis_eval": evaluate_emphasis(completed_sections, buyer_persona),
        "pending": [s for s in all_sections if s not in completed_sections]
    }

    await human_input(
        f"We've emphasized {analysis['emphasis_eval']} - does that feel right?",
        allow_adjustments=True
    )
```

**Stage: Visual Concept Generation**
- **Type:** Layout and positioning specs per slide
- **Checkpoint:** Visual concept approval
- **State Stored:** visual_concept{} per slide
- **Tools Used:** `generate_slide_blueprint()`
- **Preview:** Wireframe renders in right panel (click-to-edit)

**Stage: Export**
- **Type:** Multi-format generation
- **Checkpoint:** Format selection
- **Output Formats:**
  - PowerPoint (.pptx) with wireframe slides
  - LLM prompt template for styled content generation
- **Output Location:** `/projects/[id]/cim-outputs/`

### RAG Integration

**Knowledge Base Queries Throughout Workflow:**

```python
# Investment Thesis Development
findings = query_knowledge_base(
    query="key value drivers, competitive advantages, growth potential",
    filters={deal_id: current_deal},
    limit=20
)

# Slide Content Building (iterative)
findings = query_knowledge_base(
    query=slide_topic,  # e.g., "founding story", "management team"
    filters={
        deal_id: current_deal,
        section: current_section,
        confidence: ">70%"
    },
    limit=10
)

# Source attribution
for element in slide.content_elements:
    element.source = findings[element.source_id].citation
    # Returns: "company-background.pdf, page 2" (from PostgreSQL findings table)
```

**pgvector Semantic Search:**
- Embeddings generated during document processing (OpenAI text-embedding-3-large)
- Stored in findings table (pgvector column)
- Semantic search finds relevant findings even without exact keyword match

**Neo4j Source Attribution:**
- `EXTRACTED_FROM` relationships track Finding → Document
- `SUPPORTS` relationships track Finding → Finding for corroboration
- Citation chains preserved for transparency

### State Management

**Database Schema:**

```sql
-- Single table approach with JSONB for flexibility
CREATE TABLE cims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    workflow_state JSONB DEFAULT '{}',  -- buyer_persona, investment_thesis, outline
    slides JSONB DEFAULT '[]',  -- array of slide objects with content + visual
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- workflow_state structure:
-- {
--   buyer_persona: {type, motivations, concerns},
--   investment_thesis: {asset, timing, opportunity},
--   outline: [{section_name, order}],
--   conversation_context: {},
--   current_slide_index: 0
-- }

-- slides array structure:
-- [{
--   id: uuid,
--   section: "Company History",
--   content_elements: [{text, source_id}],
--   visual_concept: {type, layout, elements[]},
--   dependencies: [slide_ids],
--   status: "draft" | "approved"
-- }]
```

**Resume Capability:**
```python
def resume_workflow(cim_id):
    cim = load_cim(cim_id)

    if cim:
        workflow.restore_state(cim.workflow_state, cim.slides)
        return f"Resuming CIM: {cim.name}"
    else:
        return "CIM not found"
```

### Click-to-Reference Implementation

**Frontend Click Handler:**
```typescript
// No slash commands - natural conversation flow
function handleSourceClick(source: Source) {
    // Add reference to conversation context
    addToConversation({
        type: 'reference',
        source: source,
        message: `I want to use this: ${source.title}`
    })
}

function handlePreviewElementClick(element: SlideElement) {
    // Open editing context in chat
    addToConversation({
        type: 'edit_request',
        element: element,
        slide_id: currentSlide.id,
        message: `Let's edit: ${element.content}`
    })
}
```

**Backend Reference Handler:**
```python
def handle_reference(reference_type: str, reference_data: dict, cim_state: CIMState):
    """Handles click-to-reference from frontend"""
    if reference_type == 'source':
        # Add source to conversation context
        cim_state.add_context(reference_data)
        return agent.respond_with_context(reference_data)

    elif reference_type == 'edit_request':
        # Handle slide element editing
        slide = cim_state.get_slide(reference_data['slide_id'])
        element = slide.get_element(reference_data['element_id'])
        return agent.start_edit_conversation(element)
```

### Dependency Tracking

**Maintains consistency across slides:**

```python
def track_dependencies(slide: Slide, cim_state: CIMState):
    """Track which slides depend on this one"""
    # Investment thesis affects all content slides
    if slide.is_thesis_slide:
        for content_slide in cim_state.content_slides:
            content_slide.add_dependency(slide.id)

    # Content slides may reference earlier slides
    for reference in slide.content_references:
        if reference.slide_id:
            slide.add_dependency(reference.slide_id)

def check_consistency_on_change(slide_id: str, cim_state: CIMState):
    """Alert when changes may affect dependent slides"""
    dependents = cim_state.get_dependents(slide_id)
    if dependents:
        return {
            'alert': True,
            'message': f'This change may affect {len(dependents)} other slides',
            'affected_slides': dependents
        }
```

### Cross-Domain Patterns (Phase 3)

**Configurable Pattern Library** - The system includes an extensible library of M&A-specific cross-domain intelligence patterns. The initial set includes common patterns, but the library is designed to be configurable and expandable:

**Example Patterns:**
1. Financial × Operational Efficiency
2. Growth × Quality
3. Contracts × Financial Projections
4. M&A History × Synergy Claims
5. Key Person × Technical Risks
6. Market × Valuation
7. Compliance × Financial Reserves
8. Technical Debt × Growth Capacity
9. Customer Concentration × Contract Flexibility
10. Supply Chain × Geopolitical
11. Valuation Multiple × Growth Maturity

**Pattern Configuration:**
- Patterns can be enabled/disabled per deal type
- Custom patterns can be added via configuration
- Confidence thresholds adjustable per pattern
- Learning loop improves pattern detection over time

---

## Docker Architecture & Development Environment

### Local Development with Docker Compose

**Philosophy:** Single command setup (`docker-compose up`) provides consistent development environment with production parity.

### Docker Compose Configuration

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # Supabase Local Stack
  postgres:
    image: supabase/postgres:15.8.1.085
    container_name: manda-postgres
    environment:
      POSTGRES_DB: manda_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST_AUTH_METHOD: trust
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Neo4j Knowledge Graph
  neo4j:
    image: neo4j:5.15-community
    container_name: manda-neo4j
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD}
      NEO4J_PLUGINS: '["apoc", "graph-data-science"]'
      NEO4J_dbms_security_procedures_unrestricted: apoc.*,gds.*
    volumes:
      - neo4j-data:/data
      - neo4j-logs:/logs
    ports:
      - "7474:7474"  # HTTP Browser
      - "7687:7687"  # Bolt Protocol
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -u neo4j -p ${NEO4J_PASSWORD} 'RETURN 1'"]
      interval: 10s
      timeout: 5s
      retries: 5

  # FastAPI Backend
  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile.dev
    container_name: manda-api
    volumes:
      - ./apps/api:/app
      - /app/__pycache__
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/manda_dev
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_KEY=${SUPABASE_KEY}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      neo4j:
        condition: service_healthy
    command: uvicorn main:app --host 0.0.0.0 --port 8000 --reload

  # Background Workers
  worker:
    build:
      context: ./apps/workers
      dockerfile: Dockerfile.dev
    container_name: manda-worker
    volumes:
      - ./apps/workers:/app
      - /app/__pycache__
    environment:
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD}@postgres:5432/manda_dev
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=${NEO4J_PASSWORD}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
    depends_on:
      postgres:
        condition: service_healthy
      neo4j:
        condition: service_healthy
    command: python main.py

  # Next.js 16 Frontend (Turbopack)
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile.dev
    container_name: manda-web
    volumes:
      - ./apps/web:/app
      - /app/node_modules
      - /app/.next
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
      - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
      - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    depends_on:
      - api
    command: npm run dev  # Uses Turbopack by default in Next.js 16

volumes:
  postgres-data:
  neo4j-data:
  neo4j-logs:
```

### Dockerfile Examples

**Frontend (Next.js 16 with Turbopack):**
```dockerfile
# apps/web/Dockerfile.dev
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Turbopack enabled by default in Next.js 16
EXPOSE 3000

CMD ["npm", "run", "dev"]
```

**Production Frontend:**
```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000
CMD ["node", "server.js"]
```

### Environment Variables

```bash
# .env.example
# Databases
POSTGRES_PASSWORD=your_postgres_password
NEO4J_PASSWORD=your_neo4j_password

# Supabase
SUPABASE_URL=http://localhost:54321
SUPABASE_KEY=your_supabase_anon_key
SUPABASE_ANON_KEY=your_supabase_anon_key

# LLM API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key
```

### Development Workflow

**Setup:**
```bash
# Clone the Nextbase Lite starter
git clone https://github.com/imbhargav5/nextbase-nextjs-supabase-starter manda-platform
cd manda-platform

# Copy environment variables
cp .env.example .env

# Start all services
docker-compose -f docker-compose.dev.yml up
```

**Services Available:**
- Frontend: http://localhost:3000 (Next.js 16 with Turbopack)
- API: http://localhost:8000 (FastAPI with auto-reload)
- Neo4j Browser: http://localhost:7474
- PostgreSQL: localhost:5432

**Key Benefits:**
1. **One Command Setup:** `docker-compose up` starts entire stack
2. **Production Parity:** Same containers in dev and production
3. **Consistent Environment:** Every developer has identical setup
4. **Isolated Services:** Database, graph, API, frontend all containerized
5. **Easy CI/CD:** Docker images deploy directly to production
6. **Turbopack Performance:** 10x faster dev builds with Next.js 16

### Production Deployment

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  web:
    build:
      context: ./apps/web
      dockerfile: Dockerfile
      args:
        - NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
        - NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    restart: unless-stopped

  api:
    build:
      context: ./apps/api
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEO4J_URI=${NEO4J_URI}
      - NODE_ENV=production
    restart: unless-stopped

  worker:
    build:
      context: ./apps/workers
      dockerfile: Dockerfile
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEO4J_URI=${NEO4J_URI}
    restart: unless-stopped
```

**Production Infrastructure:**
- **Managed Supabase:** Cloud-hosted PostgreSQL + Auth + Storage
- **Neo4j AuraDB:** Cloud-hosted graph database (or self-hosted)
- **Container Platform:** Docker Compose, AWS ECS, Google Cloud Run, or Kubernetes
- **CDN:** Vercel Edge Network or Cloudflare for Next.js assets

---

## Deployment Architecture

### Development Environment (Docker Compose)

**Stack:**
- Supabase local (PostgreSQL 15 + pgvector + Auth + Storage)
- Neo4j 5 Community Edition
- FastAPI (hot reload)
- Next.js 16 dev server (Turbopack enabled)
- Background workers (Python)

**Advantages:**
- Single `docker-compose up` command
- Live code updates (volume mounts)
- Consistent across team
- No cloud dependencies for development

### Staging/Production Environment

**Option 1: Managed Services (Recommended for MVP)**
- **Frontend:** Vercel (Next.js optimized, Edge CDN, automatic deploys)
- **Backend API:** Railway, Render, or AWS ECS (containerized FastAPI)
- **Database:** Supabase Cloud (managed PostgreSQL + Auth + Storage)
- **Graph:** Neo4j AuraDB Professional (managed graph database)
- **Workers:** Same platform as API (background container)

**Option 2: Fully Containerized**
- **Orchestration:** Docker Compose or Kubernetes
- **Infrastructure:** AWS, Google Cloud, or Azure
- **Database:** Self-hosted Supabase (docker-compose)
- **Graph:** Self-hosted Neo4j
- **CDN:** Cloudflare for Next.js static assets

### Initialization Command

**Clone Nextbase Lite Starter:**
```bash
git clone https://github.com/imbhargav5/nextbase-nextjs-supabase-starter manda-platform
cd manda-platform
npm install
```

**What Nextbase Lite Provides:**
- Next.js 16 with App Router
- Turbopack (stable) for development
- Supabase integration (auth, database, storage)
- TypeScript configuration
- Tailwind CSS 4
- Testing suite (Jest + Playwright)
- Code quality tools (ESLint, Prettier, Husky, Commitizen)
- VSCode settings
- React Query for data fetching

**What We Add:**
- FastAPI backend (replace/augment Supabase functions)
- Neo4j integration
- Document processing pipeline (Docling)
- LLM integration (Gemini, Claude, OpenAI)
- Agent tools (12 core tools)
- LangGraph workflows
- Background workers
- IRL-driven workflow logic
- Collaborative analysis features
- Learning loop implementation

---

## Implementation Roadmap

### Phase 0: Foundation (Week 1-2)
- Set up infrastructure
- Configure databases
- Initialize monorepo

### Phase 1: Core Platform (Week 3-6)
- Document processing pipeline
- Knowledge base services
- Semantic search

### Phase 2: Intelligence Layer (Week 7-10)
- LLM integration
- Conversational agent
- Tool calling

### Phase 3: Workflows (Week 11-14)
- Q&A workflow (LangGraph)
- CIM generation workflow
- IRL creation workflow

### Phase 4: Frontend (Week 15-18)
- User interface
- Chat with interrupts
- Knowledge browser

### Phase 5: Cross-Domain Intelligence (Week 19-22)
- Pattern detection
- Proactive insights
- Your competitive moat!

### Phase 6: Polish & Launch (Week 23-24)
- Security audit
- Performance optimization
- Beta launch

---

## Decision Rationale

### Why Next.js 16 over Next.js 15/14?
**Turbopack Stable:** 10x faster dev builds, 2-5x faster production builds. Document-heavy platform benefits from speed. React 19.2 support brings latest features.

### Why Nextbase Lite Starter?
**Comprehensive Tooling:** Next.js 16 + Supabase + TypeScript + Tailwind 4 + Testing (Jest, Playwright) + Code quality (ESLint, Prettier, Husky) pre-configured. Saves weeks of setup.

### Why Docker Compose?
**Consistency + Parity:** Single command setup (`docker-compose up`). Every developer has identical environment. Production parity ensures fewer deployment surprises. Easy CI/CD.

### Why FastAPI over Node.js?
**Native Python Stack:** Docling, LangGraph, Pydantic AI Gateway all Python. No bridge complexity. Type safety with Pydantic v2.

### Why Supabase?
**Auth + Database + Storage:** Integrated platform, RLS for security, managed service. pgvector for semantic search. OAuth providers out of the box.

### Why Pydantic v2 with LangChain?
**Type Safety + Flexibility:** Pydantic v2 provides strict validation for structured outputs and tool definitions, while LangChain offers mature ecosystem with multiple LLM providers, retry logic, and fallback mechanisms. This combination is production-tested and widely adopted.

### Why LangGraph over Genkit?
**Human-in-the-Loop:** LangGraph's interrupt pattern is perfect for Q&A/CIM workflows. Genkit too new for production.

### Why Postgres + Neo4j Hybrid?
**Complementary:** Postgres for structured data + vector search (pgvector), Neo4j for cross-domain relationships and contradiction tracking (your competitive moat).

### Why pg-boss over Redis+Bull?
**MVP Simplicity:** One less infrastructure component. Postgres-based queue. Can upgrade to Redis+Bull later if needed.

### Why Multi-Model Strategy?
**Cost + Quality:** Gemini 3.0 Pro for volume (2M context, thinking mode, cost-effective), Claude Sonnet 4.5 for conversation (quality, M&A domain), OpenAI for embeddings (best quality).

### Why 12 Agent Tools (expanded from 8)?
**Collaborative Workflow Support:** New PRD requirements (v1.1) added collaborative analysis, finding capture/validation, learning loop. Tools enable: `update_knowledge_base`, `update_knowledge_graph`, `validate_finding`, `add_to_qa`.

---

## Open Questions

1. **Job Queue Migration Trigger:** At what point migrate from pg-boss to Redis+Bull? (Monitor queue performance in MVP)
2. **Neo4j vs Graphiti:** Add Graphiti for temporal facts in Phase 3? (Evaluate after MVP launch)
3. **Gemini Quality:** Test Gemini 3.0 Pro against Claude on M&A documents (Week 8 of implementation)
4. **Phase 1 Patterns:** Include basic contradictions in MVP? (Yes - PRD v1.1 includes contradiction detection in MVP)
5. **CIM Export:** Word only or add Google Docs support? (Start with Word, add Google Docs in Phase 2)
6. **Docker in Production:** Managed services (Vercel, Railway) or fully containerized (Kubernetes)? (Start with managed, migrate if needed)
7. **Supabase Local vs Cloud:** Use local Supabase in development, when to switch to cloud for staging? (Switch at end of Phase 1)

---

## Future Considerations (Phase 2+)

- Multi-tenant / team features
- Deal precedent database
- External data integration (Bloomberg, SharePoint)
- Advanced analytics (football field, sensitivity tables)
- Real-time collaboration
- Mobile app

---

## References

- [Manda PRD](./manda-prd.md)
- [Brainstorming Session](./brainstorming-session-results-2025-11-19.md)
- [Docling](https://docling-project.github.io/docling/)
- [LangChain](https://python.langchain.com/docs/)
- [LangGraph](https://langchain-ai.github.io/langgraph/)
- [Pydantic v2](https://docs.pydantic.dev/latest/)
- [LangChain LLM Adapters](https://python.langchain.com/docs/integrations/chat/)
- [Supabase](https://supabase.com/docs)
- [pgvector](https://github.com/pgvector/pgvector)
- [Neo4j](https://neo4j.com/docs/)

---

**This architecture document is a living document and will be updated as decisions are made and the system evolves.**

---

## Changelog

### Version 3.0 (2025-12-09)
**Q&A Co-Creation Redesign - Epic 8:**
- **Fundamental Q&A Model Change:**
  - Q&A items are now questions for the CLIENT to answer (not AI-generated answers)
  - AI's role: identify gaps/inconsistencies → discuss with user → suggest Q&A item if unresolved
  - Removed `status` field - derive state from `date_answered` (NULL = pending, NOT NULL = answered)
- **New `qa_items` Table Schema:**
  - Added complete schema with optimistic locking via `updated_at`
  - Category enum: Financials, Legal, Operations, Market, Technology, HR
  - Priority: high/medium/low
  - `source_finding_id` links Q&A to findings that triggered them
  - Conflict resolution: Keep Mine / Keep Theirs / Merge UI pattern
- **Agent Tools Expanded (14 → 19 total):**
  - Replaced old Q&A tools with 7 new Q&A management tools:
    - `add_qa_item()` - Add single Q&A item
    - `add_qa_items_batch()` - Bulk add
    - `suggest_qa_from_finding()` - Generate Q&A from inconsistency finding
    - `get_qa_summary()` - Lightweight counts for context efficiency
    - `get_qa_items()` - Retrieve with filters
    - `update_qa_item()` - Modify existing
    - `remove_qa_item()` - Delete
  - Updated system prompt to emphasize Q&A workflow pattern
- **Excel Export/Import Design:**
  - Export columns: Question | Priority | Answer | Date Answered (Category for grouping)
  - Import matching: exact text match → fuzzy match (>90% Levenshtein) → handle new items
  - Client can edit entire Excel (mostly adding answers and comments)
- **Related Documentation Updates:**
  - PRD section 5.6 updated with new requirements (FR-QA-001 through FR-QA-004)
  - epics.md Epic 8 completely rewritten with 7 stories (E8.1-E8.7)

### Version 2.9 (2025-11-28)
**pgvector Index Documentation - HNSW Dimension Limit:**
- **Critical Documentation Update:**
  - pgvector HNSW index has 2000-dimension limit (not unlimited as previously documented)
  - For 3072-dim embeddings (OpenAI text-embedding-3-large), must use `halfvec` cast
  - Correct index syntax: `USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)`
  - Reference: https://github.com/pgvector/pgvector/issues/461
- **Updated Documentation:**
  - Decision Summary table: Added note about HNSW limit and halfvec workaround
  - Data Layer config: Added YAML comment with correct index syntax
  - tech-spec-epic-E3.md: Fixed index creation example
  - tech-spec-epic-E4.md: Fixed schema, risks, and optimizations sections
  - epics.md: Updated E3.4 acceptance criteria with correct dimensions
- **Why This Matters:**
  - IVFFlat also limited to 2000 dims (contrary to previous assumption)
  - `halfvec` cast allows HNSW with any dimension while maintaining good performance
  - This was discovered during E4.2 migration when index creation failed

### Version 2.8 (2025-11-28)
**Test Infrastructure Enhancement - Tech Debt Sprint:**
- **Test Framework Upgrade:**
  - Migrated from Jest to Vitest with thread pool parallelization
  - Added 3-way test sharding for CI (reduces 41s → ~3s per shard)
  - Test isolation ensures reliable parallel execution
  - CI-optimized reporters (dot for progress, JSON for results)
- **E2E Testing Infrastructure:**
  - Added Playwright for E2E testing with Chromium browser
  - Created authentication setup for authenticated E2E tests
  - Implemented 15 Data Room E2E test cases:
    * Folder operations (create, rename, delete, navigation)
    * Document upload (single file, folder upload, progress)
    * View toggle (Folders/Buckets, preference persistence)
    * Drag and drop, processing status
  - Added data-testid attributes to key components
- **Shared Test Utilities:**
  - Created `__tests__/utils/supabase-mock.ts` with comprehensive mocking:
    * MockQueryBuilder with chainable methods
    * MockSupabaseAuth interface
    * Data factories (createMockDocument, createMockUser, createMockFolder)
    * Helper functions (mockAuthenticatedUser, mockQuerySuccess)
  - Reduces test boilerplate across components
- **CI Pipeline:**
  - GitHub Actions workflow with 4 stages: lint, test (sharded), E2E, build
  - Parallel test execution across 3 runners
  - Artifact storage for Playwright reports
- **Business Principle Established:**
  - BP-001: Zero Technical Debt Policy - resolve debt before new feature epics

### Version 2.7 (2025-11-28)
**Persistent Folder Storage - Full Folder/Bucket Parity:**
- **New `folders` Table:**
  - Folders are now persisted in their own table (migration `00020_create_folders_table.sql`)
  - Previously folders were virtual (derived from `document.folder_path` values)
  - Empty folders now persist even without documents
  - Schema: `id`, `deal_id`, `name`, `path`, `parent_path`, timestamps
  - RLS policies ensure users can only access folders for their own deals
- **API Routes:**
  - `GET /api/projects/[id]/folders` - List all folders for a project
  - `POST /api/projects/[id]/folders` - Create a new folder
  - `PUT /api/projects/[id]/folders/[folderId]` - Rename a folder (cascades to child folders and documents)
  - `DELETE /api/projects/[id]/folders/[folderId]` - Delete a folder
- **Folder = Bucket Parity Enforced:**
  - Creating a folder in Folder View creates a bucket in Bucket View (and vice versa)
  - Subfolders are visible in both views
  - Both views now load from the same data source (documents table + folders table)
  - All CRUD operations work identically in both views
- **Data Model:**
  - Folders are persisted in `folders` table
  - Documents reference folders via `folder_path` column
  - Folder tree = merge of folders from `folders` table + paths from `documents.folder_path`

### Version 2.7.1 (2025-11-28)
**Bug Fixes - View Toggle and Bucket Creation:**
- **Buckets Tab Click Fix:**
  - Removed `Tooltip` wrappers from `TabsTrigger` elements in `view-toggle.tsx`
  - Tooltip components were intercepting click events, preventing view switching
- **New Bucket Button:**
  - Added `onCreateFolder` prop to `BucketsView` in `data-room-wrapper.tsx`
  - Integrated `CreateFolderDialog` for creating new buckets directly from Buckets view
  - Previously, bucket/folder creation only worked from Folders view

### Version 2.6 (2025-11-26)
**Data Room Architecture Unification - Course Correction:**
- **Removed `deal_type` from Project Wizard:**
  - Deal type field was unnecessary - did not drive any downstream behavior
  - Project creation simplified from 3 steps to 2 steps (Basic Info → IRL Template)
  - Reduces user friction during project setup
- **Unified Bucket/Folder Data Model:**
  - `folder_path` is now the single source of truth for document organization
  - **Buckets = top-level folders** - same data, different view
  - Removed separate `category` column from documents table
  - Creating a top-level folder creates a bucket; creating a bucket creates a folder
  - Subfolders appear in both views with consistent hierarchy
- **Empty Project Behavior Fixed:**
  - Selecting "Empty Project" in wizard now creates truly empty data room
  - No default buckets pre-created (was incorrectly creating 15 default categories)
  - Users build their own folder/bucket structure from scratch
- **Architecture Benefits:**
  - Single source of truth eliminates data inconsistency
  - Simpler mental model for users (folders = buckets)
  - Reduced code complexity (one data model, two views)
  - Better alignment with user expectations

### Version 2.5 (2025-11-25)
**Infrastructure Strategy Decisions:**
- **Supabase Retained for MVP:**
  - PostgreSQL, Auth, and Realtime remain on Supabase - stable, working, no migration risk
  - Future migration path to Cloud SQL for PostgreSQL documented for when scale requires
  - Rationale: "Don't fix what isn't broken" - premature migration adds risk without benefit
- **Document Processing Hybrid Approach (Epic 3):**
  - **Docling** for document parsing: Excel formula extraction, table structure, OCR - superior for M&A document complexity
  - **Vertex AI RAG Engine** for retrieval/indexing layer: Managed chunking, embeddings, vector search
  - Native GCS integration eliminates custom RAG pipeline infrastructure
  - Rationale: Best of both worlds - Docling's parsing quality + Vertex AI's managed RAG service
- **Deployment Target: Google Cloud Run:**
  - Scale-to-zero for cost efficiency during MVP/variable traffic
  - Native GCS integration (documents already there)
  - 2M free requests/month
  - Container-based: supports both Next.js and FastAPI
  - Future migration path: Cloud Run → GKE if Kubernetes control needed

### Version 2.4 (2025-11-25)
**Document Storage Architecture Decision:**
- **Google Cloud Storage Replaces Supabase Storage:**
  - Raw M&A documents (PDFs, Word, Excel) stored in Google Cloud Storage
  - Supabase remains for PostgreSQL, Auth, and pgvector (embeddings)
  - Neo4j remains for graph relationships
  - Clear separation: GCS for raw files, pgvector for embeddings, Neo4j for relationships
- **Rationale:**
  - Supabase Storage not designed for large-scale document storage
  - pgvector and Neo4j are for embeddings/relationships, not raw files
  - GCS offers: scalable storage, signed URLs, lifecycle policies, SOC 2/ISO 27001/GDPR compliance
  - Simpler service account auth model vs Azure's more complex options
  - Better TypeScript SDK (`@google-cloud/storage`)
- **Bucket Structure:**
  ```
  manda-documents/
  ├── {deal_id}/
  │   ├── dataroom/
  │   │   ├── financial/
  │   │   ├── legal/
  │   │   └── operational/
  │   ├── deliverables/
  │   └── chat-attachments/
  ```
- **Integration Flow:**
  - User uploads → Next.js API → GCS bucket (raw file)
  - pg-boss job triggered → Docling parses → pgvector (embeddings)
  - Neo4j updated with relationships
  - Supabase documents table stores metadata + GCS URI

### Version 2.3 (2025-11-24)
**Strategic Refinements - MVP Scope Adjustments:**
- **Flexible Cross-Domain Pattern Library:**
  - Updated from fixed "11 patterns" to configurable pattern library approach
  - Added pattern configuration section (enable/disable, custom patterns, adjustable thresholds)
  - Emphasized extensibility and deal-type specific customization
  - Learning loop improves pattern detection over time
- **Financial Model Integration Elevated to MVP:**
  - Added comprehensive Financial Model Integration section with architecture components
  - New `financial_metrics` table schema for storing extracted financial data
  - FinancialModelExtractor service for parsing Excel models with formula preservation
  - Integration with knowledge base and Neo4j for cross-validation
  - Agent tool support for financial metric queries
- **CIM Builder Redesigned (Party Mode 2025-12-09):**
  - Complete redesign based on multi-agent Party Mode session
  - NotebookLM-inspired 3-panel UI (Sources, Conversation, Preview)
  - User-defined CIM structure (no fixed phases)
  - Full CIM framework scope (not Company Overview only)
  - Click-to-reference editing pattern
  - Dependency tracking for slide coherence
  - Multiple CIMs per deal support
- **Preview Panel:**
  - Wireframe slide preview in right panel
  - Click any element to discuss/edit in conversation
  - Navigation controls (Prev/Next, slide counter)

**Why This Matters:**
- Aligns architecture with user feedback and strategic priorities
- Elevates financial data extraction to core MVP value proposition
- Provides flexibility while maintaining established workflow quality
- Adds critical visual feedback capability for CIM creation

### Version 2.2 (2025-11-23)
**Latest Stable Versions + Model-Agnostic Configuration:**
- **Updated All Tech Stack to Latest Stable Versions:**
  - PostgreSQL 18.1 (latest stable, Nov 2025)
  - Neo4j 2025.01 (new calendar versioning)
  - pgvector 0.8+ (improved filtering)
  - FastAPI 0.121+ (latest stable)
  - LangChain 1.0 + LangGraph 1.0 (stable releases, Nov 2025)
  - Pydantic v2.12+ (latest stable, Oct 2025)
  - Next.js 15 with React 19.2 (Next.js 16 still in beta)
  - Python 3.11+ with 3.13 compatibility
- **Model-Agnostic LLM Configuration:**
  - Replaced provider-specific model selections with configurable defaults
  - Added provider comparison table (Anthropic, Google, OpenAI)
  - Included configuration example with environment variable support
  - Emphasized easy provider swapping for testing and cost optimization
  - Documented fallback support via LangChain
- **Clarified Nextbase Lite Template:** Updated to Next.js 15 + Supabase

**Why This Matters:**
- Ensures production-ready versions across the entire stack
- Provides flexibility to test different LLM providers without code changes
- Avoids vendor lock-in with model-agnostic architecture
- Aligns with Nov 2025 stable releases for long-term support

### Version 2.1 (2025-11-23)
**Pydantic + LangGraph Integration Clarification:**
- **Clarified AI Framework Stack:** Replaced ambiguous "Pydantic AI Gateway" with clear separation:
  - **LangChain/LangGraph** for workflow orchestration and human-in-the-loop patterns
  - **Pydantic v2** for type safety, validation, and structured outputs
  - **LangChain LLM Adapters** for multi-provider LLM integration
- **Added Comprehensive Integration Section:** New "Pydantic + LangGraph Integration Strategy" section with:
  - Architecture diagram showing role separation
  - Detailed explanation of how Pydantic and LangGraph complement each other
  - Complete code example demonstrating integration patterns
  - Rationale for choosing this hybrid approach over Pydantic AI framework
- **Updated Decision Summary Table:** Clarified technology choices with accurate terminology
- **Updated References:** Added proper links to LangChain, LangGraph, and Pydantic documentation

**Why This Matters:**
- Eliminates confusion between Pydantic library vs Pydantic AI framework
- Provides clear implementation guidance for developers
- Validates architecture decision with production-tested patterns
- Establishes type safety as first-class concern throughout the system

### Version 2.0 (2025-11-21)
**Major Updates:**
- **Next.js 16 Upgrade:** Migrated from Next.js 14 to Next.js 16 with Turbopack stable (10x faster dev, 2-5x faster prod builds)
- **Docker Integration:** Added comprehensive Docker Compose configuration for development and production
- **Starter Template:** Selected Nextbase Lite (Next.js 16 + Supabase + comprehensive tooling)
- **Agent Tools Expansion:** Increased from 8 to 12 core tools to support collaborative workflow (PRD v1.1)
- **PRD Alignment:** Updated to align with PRD v1.1 requirements:
  - Collaborative document analysis workflow
  - Finding capture & validation (3 methods: chat, notes upload, collaborative)
  - Learning loop implementation (MVP, not Phase 3)
  - IRL-driven folder auto-generation
  - Smart classification (Phase 2, with user approval workflow)
- **React 19.2 Support:** Updated to latest React with View Transitions, useEffectEvent
- **Tailwind CSS 4:** Updated styling framework to latest version
- **Architecture Clarification:** Changed "Platform-Agent Separation" to "Tightly Integrated Platform-Agent"

**Technology Updates:**
- Frontend: Next.js 16, React 19.2, Tailwind CSS 4, Turbopack stable
- Development: Docker Compose orchestration (Postgres, Neo4j, FastAPI, Next.js, Workers)
- Testing: Jest, Playwright, React Testing Library (from Nextbase Lite)
- Code Quality: ESLint, Prettier, Husky, Commitizen (from Nextbase Lite)

### Version 1.0 (2025-11-19)
**Initial Architecture:**
- Platform-agent architecture defined
- Technology stack selection (FastAPI, Supabase, Neo4j, Next.js 14)
- Multi-model LLM strategy (Gemini, Claude, OpenAI)
- 8 core agent tools
- Cross-domain intelligence patterns (Phase 3)
- Implementation roadmap (6 phases, 24 weeks)

---

*Generated using BMAD Method architecture workflow*
*Version 1.0: 2025-11-19 | Version 2.0: 2025-11-21 | Version 2.1: 2025-11-23 | Version 2.2: 2025-11-23 | Version 2.5: 2025-11-25 | Version 2.6: 2025-11-26 | Version 2.7: 2025-11-28 | Version 2.8: 2025-11-28 | Version 2.9: 2025-11-28 | Version 3.0: 2025-12-09*
