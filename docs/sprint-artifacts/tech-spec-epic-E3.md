# Epic Technical Specification: Intelligent Document Processing

Date: 2025-11-26
Author: Max
Epic ID: E3
Status: Draft

---

## Overview

Epic 3 implements the **Intelligent Document Processing** pipeline—the background processing engine that transforms raw documents stored in Google Cloud Storage into structured knowledge in the Manda platform. This is the first epic to introduce the **FastAPI Python backend** for AI/ML workloads, establishing the processing architecture that powers all subsequent intelligent features.

Building on Epic 2's document storage foundation (GCS integration, upload flows, metadata tracking), this epic creates the automated analysis pipeline that:
1. Parses uploaded documents using **Docling** (Excel formulas, tables, PDFs with OCR)
2. Generates semantic **embeddings** for vector search via pgvector
3. Performs initial **LLM analysis** to extract key findings and insights
4. Provides real-time **processing status** updates via WebSocket
5. Extracts structured **financial metrics** from Excel models

This epic delivers the core value proposition: "Upload documents → Get findings automatically" without manual analyst intervention.

## Objectives and Scope

### In Scope

**Core Processing Pipeline:**
- FastAPI backend service setup with pg-boss job queue integration
- Docling document parser integration (Excel, PDF, Word, images with OCR)
- Document parsing job handlers (queue → parse → store chunks)
- Embedding generation using OpenAI text-embedding-3-large
- LLM analysis with tiered Gemini 2.5 models (Flash for extraction, Pro for deep analysis)
- Processing status tracking with WebSocket real-time updates
- Processing queue visibility UI in Data Room
- Retry logic for failed processing jobs
- Financial model extraction (metrics, formulas, assumptions)

**Functional Requirements Addressed:**
- FR-DOC-004: Document Processing (automatic background processing, OCR, formula extraction)
- FR-KB-001: Structured Knowledge Storage (findings with embeddings)
- FR-KB-002: Source Attribution (document → chunk → finding traceability)
- FR-BG-001: Event-Driven Architecture (upload triggers processing)
- FR-BG-002: Processing Pipeline (parse → extract → analyze → store)

### Out of Scope

- Cross-domain pattern detection (Phase 3 / Epic 4+)
- Proactive insight surfacing (Phase 3)
- Neo4j graph updates for relationships (deferred to Epic 4)
- Knowledge Explorer UI (Epic 4)
- Contradiction detection (Epic 4)
- Chat/conversational agent integration (Epic 5)
- Q&A and CIM workflows (Epics 8-9)

## System Architecture Alignment

This epic introduces the **FastAPI Python backend** as defined in the architecture document, establishing the dual-service pattern:

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXISTING (Epic 1-2)                          │
│  Next.js 15 Frontend + API Routes + Supabase + GCS              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/WebSocket
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEW (Epic 3)                                  │
│  FastAPI Backend (Python 3.11+)                                 │
│  ├── /api/processing/* endpoints                                │
│  ├── pg-boss job queue handlers                                 │
│  ├── Docling document parser                                    │
│  ├── OpenAI embeddings client                                   │
│  └── LLM analysis (Gemini 2.5 Flash/Pro via LangChain)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                    │
│  PostgreSQL (Supabase) + pgvector + Google Cloud Storage        │
└─────────────────────────────────────────────────────────────────┘
```

**Architecture Alignment:**
- **Backend Framework:** FastAPI 0.121+ (Python 3.11+) as specified in architecture
- **Job Queue:** pg-boss (Postgres-based, MVP simplicity)
- **Document Parser:** Docling (RAG-optimized, Excel formulas, OCR)
- **Embeddings:** OpenAI text-embedding-3-large via LangChain adapters
- **LLM Provider:** Tiered Gemini 2.5 approach:
  - **Gemini 2.5 Flash** (`gemini-2.5-flash`): Default for extraction tasks ($0.30/1M input, $2.50/1M output)
  - **Gemini 2.5 Pro** (`gemini-2.5-pro`): Complex financial analysis ($1.25/1M input, $10/1M output)
  - **Gemini 2.5 Flash-Lite** (`gemini-2.5-flash-lite`): Batch processing ($0.10/1M input, $0.40/1M output)
- **Type Safety:** Pydantic v2.12+ for all schemas
- **File Storage:** GCS (established in Epic 2)

## Detailed Design

### Services and Modules

**New Python Service: `manda-processing`**

```
manda-processing/
├── src/
│   ├── __init__.py
│   ├── main.py                    # FastAPI application entry
│   ├── config.py                  # Environment and settings (Pydantic Settings)
│   ├── api/
│   │   ├── __init__.py
│   │   ├── routes/
│   │   │   ├── health.py          # /health, /ready endpoints
│   │   │   ├── processing.py      # /api/processing/* endpoints
│   │   │   └── webhooks.py        # Supabase webhook receivers
│   │   └── dependencies.py        # FastAPI dependencies (auth, db)
│   ├── jobs/
│   │   ├── __init__.py
│   │   ├── queue.py               # pg-boss queue wrapper
│   │   ├── worker.py              # Job worker process
│   │   └── handlers/
│   │       ├── parse_document.py  # Docling parsing handler
│   │       ├── generate_embeddings.py
│   │       ├── analyze_document.py  # LLM analysis handler
│   │       └── extract_financials.py  # Financial model extraction
│   ├── parsers/
│   │   ├── __init__.py
│   │   ├── docling_parser.py      # Docling integration
│   │   ├── excel_parser.py        # Enhanced Excel with formulas
│   │   └── pdf_parser.py          # PDF with OCR
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── client.py              # LangChain LLM client wrapper
│   │   ├── prompts.py             # Extraction and analysis prompts
│   │   └── models.py              # Model selection logic (tiered)
│   ├── embeddings/
│   │   ├── __init__.py
│   │   └── openai_embeddings.py   # OpenAI embedding client
│   ├── storage/
│   │   ├── __init__.py
│   │   ├── gcs_client.py          # GCS download operations
│   │   └── supabase_client.py     # Database operations
│   └── models/
│       ├── __init__.py
│       ├── documents.py           # Document schemas
│       ├── chunks.py              # Chunk schemas
│       ├── findings.py            # Finding schemas
│       └── jobs.py                # Job schemas
├── tests/
│   ├── conftest.py
│   ├── test_parsers/
│   ├── test_jobs/
│   └── test_api/
├── pyproject.toml                 # Poetry/uv dependencies
├── Dockerfile
└── docker-compose.yaml            # Local development
```

**Module Responsibilities:**

| Module | Responsibility | Key Dependencies |
|--------|---------------|------------------|
| `api/` | HTTP endpoints, webhooks from Supabase | FastAPI, Pydantic |
| `jobs/` | Background job processing with pg-boss | pg-boss, asyncpg |
| `parsers/` | Document parsing via Docling | docling, openpyxl |
| `llm/` | LLM analysis with tiered model selection | langchain, google-generativeai |
| `embeddings/` | Vector embedding generation | openai, numpy |
| `storage/` | GCS and Supabase data access | google-cloud-storage, supabase-py |

### Data Models and Contracts

**New Tables (Supabase Migrations):**

```sql
-- 00015_create_document_chunks_table.sql
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    chunk_type TEXT NOT NULL DEFAULT 'text', -- 'text', 'table', 'formula', 'image'
    metadata JSONB DEFAULT '{}',
    -- Source attribution
    page_number INTEGER,
    sheet_name TEXT,
    cell_reference TEXT,
    -- Embedding
    embedding vector(3072), -- text-embedding-3-large dimension
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_chunk_per_document UNIQUE (document_id, chunk_index)
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- 00016_create_findings_table.sql
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE SET NULL,

    -- Finding content
    content TEXT NOT NULL,
    finding_type TEXT NOT NULL, -- 'metric', 'fact', 'risk', 'opportunity', 'contradiction'
    domain TEXT NOT NULL, -- 'financial', 'operational', 'market', 'legal', 'technical'

    -- Confidence and validation
    confidence_score DECIMAL(5,2) NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
    validation_status TEXT DEFAULT 'pending', -- 'pending', 'validated', 'rejected'
    validated_by UUID REFERENCES auth.users(id),
    validated_at TIMESTAMPTZ,

    -- Source attribution
    source_reference JSONB NOT NULL, -- {page, sheet, cell, line_number}

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_findings_project ON findings(project_id);
CREATE INDEX idx_findings_document ON findings(document_id);
CREATE INDEX idx_findings_type ON findings(finding_type);
CREATE INDEX idx_findings_domain ON findings(domain);

-- 00017_create_financial_metrics_table.sql
CREATE TABLE financial_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    finding_id UUID REFERENCES findings(id) ON DELETE SET NULL,

    -- Metric identification
    metric_name TEXT NOT NULL, -- 'revenue', 'ebitda', 'gross_margin', etc.
    metric_category TEXT NOT NULL, -- 'income_statement', 'balance_sheet', 'cash_flow', 'ratio'

    -- Value and period
    value DECIMAL(20,4),
    unit TEXT, -- 'USD', 'EUR', '%', 'ratio'
    period_type TEXT, -- 'annual', 'quarterly', 'monthly', 'ytd'
    period_start DATE,
    period_end DATE,
    fiscal_year INTEGER,
    fiscal_quarter INTEGER,

    -- Source
    source_cell TEXT, -- Excel cell reference (e.g., "Sheet1!B15")
    source_formula TEXT, -- Original formula if applicable

    -- Metadata
    is_actual BOOLEAN DEFAULT true, -- false for projections
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_metrics_document ON financial_metrics(document_id);
CREATE INDEX idx_metrics_name ON financial_metrics(metric_name);
CREATE INDEX idx_metrics_period ON financial_metrics(fiscal_year, fiscal_quarter);
```

**Pydantic Schemas:**

```python
# models/documents.py
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime
from uuid import UUID

class DocumentChunk(BaseModel):
    id: UUID
    document_id: UUID
    chunk_index: int
    content: str
    chunk_type: Literal["text", "table", "formula", "image"]
    metadata: dict = Field(default_factory=dict)
    page_number: Optional[int] = None
    sheet_name: Optional[str] = None
    cell_reference: Optional[str] = None
    embedding: Optional[list[float]] = None

class Finding(BaseModel):
    id: UUID
    project_id: UUID
    document_id: UUID
    chunk_id: Optional[UUID]
    content: str
    finding_type: Literal["metric", "fact", "risk", "opportunity", "contradiction"]
    domain: Literal["financial", "operational", "market", "legal", "technical"]
    confidence_score: float = Field(ge=0, le=100)
    validation_status: Literal["pending", "validated", "rejected"] = "pending"
    source_reference: dict

class FinancialMetric(BaseModel):
    id: UUID
    document_id: UUID
    finding_id: Optional[UUID]
    metric_name: str
    metric_category: Literal["income_statement", "balance_sheet", "cash_flow", "ratio"]
    value: Optional[float]
    unit: Optional[str]
    period_type: Literal["annual", "quarterly", "monthly", "ytd"]
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    fiscal_year: Optional[int]
    fiscal_quarter: Optional[int]
    source_cell: Optional[str]
    source_formula: Optional[str]
    is_actual: bool = True
```

### APIs and Interfaces

**FastAPI Endpoints:**

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/health` | GET | Health check | None |
| `/ready` | GET | Readiness (DB + queue connected) | None |
| `/api/processing/trigger` | POST | Manually trigger document processing | API Key |
| `/api/processing/status/{document_id}` | GET | Get processing status | API Key |
| `/api/processing/retry/{document_id}` | POST | Retry failed processing | API Key |
| `/api/processing/queue` | GET | List processing queue | API Key |
| `/webhooks/document-uploaded` | POST | Supabase webhook on document insert | Webhook Secret |

**Webhook Payload (from Supabase):**

```json
{
  "type": "INSERT",
  "table": "documents",
  "record": {
    "id": "uuid",
    "project_id": "uuid",
    "file_name": "financial_statements.xlsx",
    "file_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "gcs_path": "gs://manda-documents-dev/project-123/Financial/financial_statements.xlsx",
    "processing_status": "pending"
  }
}
```

**Internal Service Interfaces:**

```python
# Document Parser Interface
class DocumentParser(Protocol):
    async def parse(self, file_path: Path, file_type: str) -> ParseResult:
        """Parse document and return structured chunks."""
        ...

@dataclass
class ParseResult:
    chunks: list[ChunkData]
    metadata: dict
    tables: list[TableData]
    formulas: list[FormulaData]

# LLM Analysis Interface
class DocumentAnalyzer(Protocol):
    async def analyze(
        self,
        chunks: list[ChunkData],
        model: Literal["flash", "pro", "flash-lite"] = "flash"
    ) -> list[Finding]:
        """Analyze chunks and extract findings."""
        ...

# Embedding Interface
class EmbeddingGenerator(Protocol):
    async def generate(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for text chunks."""
        ...
```

### Workflows and Sequencing

**Document Processing Pipeline:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT PROCESSING PIPELINE                         │
└─────────────────────────────────────────────────────────────────────────────┘

1. TRIGGER
   ┌──────────────┐
   │ Document     │──webhook──▶ POST /webhooks/document-uploaded
   │ Uploaded     │             │
   │ (Supabase)   │             ▼
   └──────────────┘      ┌─────────────────┐
                         │ Enqueue Job:    │
                         │ parse_document  │
                         └────────┬────────┘
                                  │
2. PARSE                          ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Job: parse_document                                         │
   │ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
   │ │ Download    │───▶│ Parse with  │───▶│ Store       │      │
   │ │ from GCS    │    │ Docling     │    │ Chunks      │      │
   │ └─────────────┘    └─────────────┘    └─────────────┘      │
   │                                              │              │
   │ Status: pending → parsing → parsed           │              │
   └──────────────────────────────────────────────┼──────────────┘
                                                  │
3. EMBED                                          ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Job: generate_embeddings                                    │
   │ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
   │ │ Load        │───▶│ Call OpenAI │───▶│ Update      │      │
   │ │ Chunks      │    │ Embeddings  │    │ pgvector    │      │
   │ └─────────────┘    └─────────────┘    └─────────────┘      │
   │                                              │              │
   │ Status: parsed → embedding                   │              │
   └──────────────────────────────────────────────┼──────────────┘
                                                  │
4. ANALYZE                                        ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Job: analyze_document                                       │
   │ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
   │ │ Select      │───▶│ LLM Extract │───▶│ Store       │      │
   │ │ Model Tier  │    │ Findings    │    │ Findings    │      │
   │ └─────────────┘    └─────────────┘    └─────────────┘      │
   │                                              │              │
   │ Model Selection:                             │              │
   │ - Standard docs → Gemini 2.5 Flash          │              │
   │ - Financial → Gemini 2.5 Pro                │              │
   │ - Batch mode → Gemini 2.5 Flash-Lite        │              │
   │                                              │              │
   │ Status: embedding → analyzing → analyzed     │              │
   └──────────────────────────────────────────────┼──────────────┘
                                                  │
5. FINANCIAL EXTRACTION (conditional)             ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Job: extract_financials (if file_type == xlsx)              │
   │ ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
   │ │ Detect      │───▶│ Extract     │───▶│ Store       │      │
   │ │ Financial   │    │ Metrics +   │    │ financial_  │      │
   │ │ Model       │    │ Formulas    │    │ metrics     │      │
   │ └─────────────┘    └─────────────┘    └─────────────┘      │
   │                                              │              │
   │ Status: analyzing → complete                 │              │
   └──────────────────────────────────────────────┼──────────────┘
                                                  │
6. NOTIFY                                         ▼
   ┌─────────────────────────────────────────────────────────────┐
   │ Update document.processing_status = 'complete'              │
   │ Supabase Realtime broadcasts to subscribed clients          │
   │ Frontend receives WebSocket update                          │
   └─────────────────────────────────────────────────────────────┘
```

**Job Queue Schema (pg-boss):**

```sql
-- Jobs table (managed by pg-boss)
-- Job names: 'parse_document', 'generate_embeddings', 'analyze_document', 'extract_financials'
-- Each job contains:
{
  "name": "parse_document",
  "data": {
    "document_id": "uuid",
    "project_id": "uuid",
    "gcs_path": "gs://...",
    "file_type": "xlsx"
  },
  "options": {
    "retryLimit": 3,
    "retryDelay": 30,
    "expireInSeconds": 600
  }
}
```

**Error Handling and Retry Flow:**

```
Job Execution:
├── Success → Mark complete, enqueue next job
├── Transient Error → Retry (up to 3x with exponential backoff)
│   ├── Attempt 1: immediate
│   ├── Attempt 2: 30s delay
│   └── Attempt 3: 90s delay
└── Permanent Error → Mark failed, log error, notify
    └── User can manually retry via /api/processing/retry/{id}
```

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Document Parse Time** | <30s for 50-page PDF | End-to-end parse job duration |
| **Embedding Generation** | <5s for 100 chunks | OpenAI API call + DB write |
| **LLM Analysis** | <60s per document | Gemini API call + finding storage |
| **End-to-End Processing** | <3 minutes per document | Upload complete → findings available |
| **Queue Throughput** | 10 concurrent jobs | pg-boss worker concurrency |
| **Similarity Search** | <100ms for top-10 results | pgvector query latency |

**Scaling Considerations:**
- Worker processes can scale horizontally (multiple pods)
- Batch API for overnight bulk processing (50% cost reduction)
- Connection pooling for database (asyncpg pool)
- Rate limiting on external APIs (OpenAI, Gemini)

### Security

| Requirement | Implementation |
|-------------|----------------|
| **API Authentication** | API key validation for processing endpoints |
| **Webhook Verification** | Supabase webhook secret validation |
| **GCS Access** | Service account with minimal IAM (storage.objectViewer) |
| **Database Access** | Supabase service role key (server-side only) |
| **Secrets Management** | Environment variables, never in code |
| **Data Isolation** | Project-scoped queries, RLS on all tables |
| **PII Handling** | No PII logged; findings stored per-project |

**Security Controls:**
- All endpoints require authentication (except `/health`)
- Webhook endpoint validates `x-supabase-signature` header
- GCS credentials rotated via service account key management
- Database connection uses SSL/TLS
- No document content logged (only metadata)

### Reliability/Availability

| Aspect | Target | Strategy |
|--------|--------|----------|
| **Job Retry** | 3 attempts with backoff | pg-boss built-in retry |
| **Graceful Degradation** | Continue on partial failures | Per-chunk error handling |
| **Data Durability** | No data loss on crash | Transactional job completion |
| **Recovery Time** | <5 minutes | Container restart + queue resume |
| **Uptime Target** | 99.5% | Health checks, auto-restart |

**Error Recovery:**
- Failed parsing → Document marked `failed`, user can retry
- LLM timeout → Retry with exponential backoff
- Embedding failure → Retry individual chunks
- Database error → Transaction rollback, job requeued

**Circuit Breaker Pattern:**
```python
# If Gemini API fails 5x in 60s, pause analysis jobs for 5 minutes
circuit_breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=300,
    expected_exception=GeminiAPIError
)
```

### Observability

**Logging:**
```python
# Structured JSON logging
{
    "timestamp": "2025-11-26T10:30:00Z",
    "level": "INFO",
    "service": "manda-processing",
    "job_id": "uuid",
    "document_id": "uuid",
    "stage": "parsing",
    "duration_ms": 2500,
    "chunks_created": 45
}
```

**Metrics (Prometheus-compatible):**
- `processing_jobs_total{status, job_type}` - Counter
- `processing_duration_seconds{job_type}` - Histogram
- `queue_depth{job_type}` - Gauge
- `llm_tokens_used{model, operation}` - Counter
- `embedding_api_calls_total` - Counter
- `error_count{error_type}` - Counter

**Health Endpoints:**
- `GET /health` - Basic liveness (always returns 200 if service running)
- `GET /ready` - Readiness (checks DB connection, queue connection, GCS access)

**Alerting Thresholds:**
- Queue depth > 100 jobs → Warning
- Job failure rate > 10% in 5 minutes → Alert
- Processing time > 5 minutes → Warning
- LLM API errors > 5 in 1 minute → Alert

## Dependencies and Integrations

### External Services

| Service | Purpose | Credentials | Rate Limits |
|---------|---------|-------------|-------------|
| **Google Cloud Storage** | Document file storage | Service account JSON | 1000 req/s (default) |
| **OpenAI API** | Embedding generation | API key | 3000 RPM (tier 1) |
| **Google Gemini API** | LLM analysis | API key | 60 RPM (free), 1000 RPM (paid) |
| **Supabase** | PostgreSQL + Auth | Service role key | Connection pool limit |

### Internal Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| **Next.js App** | Epic 1-2 | Triggers webhooks on document upload |
| **Supabase Realtime** | Existing | WebSocket status broadcasts |
| **documents table** | Epic 2 | Source of processing jobs |
| **GCS bucket** | Epic 2 | Document file storage |

### Python Dependencies (pyproject.toml)

```toml
[project]
name = "manda-processing"
version = "0.1.0"
requires-python = ">=3.11"

dependencies = [
    # Web framework
    "fastapi>=0.121.0",
    "uvicorn[standard]>=0.34.0",
    "pydantic>=2.12.0",
    "pydantic-settings>=2.7.0",

    # Database
    "asyncpg>=0.30.0",
    "supabase>=2.15.0",

    # Job queue
    "pg-boss>=0.2.0",  # or direct pg implementation

    # Document parsing
    "docling>=2.15.0",
    "openpyxl>=3.1.5",
    "python-docx>=1.1.2",

    # AI/ML
    "langchain>=0.3.0",
    "langchain-google-genai>=2.1.0",
    "openai>=1.82.0",
    "numpy>=2.2.0",

    # Google Cloud
    "google-cloud-storage>=2.19.0",

    # Utilities
    "httpx>=0.28.0",
    "structlog>=25.1.0",
    "tenacity>=9.0.0",  # Retry logic
]

[project.optional-dependencies]
dev = [
    "pytest>=8.3.0",
    "pytest-asyncio>=0.25.0",
    "pytest-cov>=6.0.0",
    "ruff>=0.11.0",
    "mypy>=1.14.0",
]
```

### Integration Points

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION ARCHITECTURE                          │
└─────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────┐
                    │   Next.js App   │
                    │   (Epic 1-2)    │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │   Supabase    │ │     GCS       │ │   Realtime    │
    │   Webhook     │ │   Storage     │ │   Broadcast   │
    └───────┬───────┘ └───────┬───────┘ └───────▲───────┘
            │                 │                 │
            │                 │                 │
            ▼                 ▼                 │
    ┌─────────────────────────────────────────────────────┐
    │              manda-processing (FastAPI)              │
    │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐│
    │  │ Webhook │  │  Jobs   │  │ Parsers │  │   LLM   ││
    │  │ Handler │──▶│ Queue  │──▶│ Service │──▶│ Service ││
    │  └─────────┘  └─────────┘  └─────────┘  └────┬────┘│
    └──────────────────────────────────────────────┼──────┘
                                                   │
            ┌──────────────────────────────────────┼──────┐
            │                                      │      │
            ▼                                      ▼      │
    ┌───────────────┐                      ┌───────────────┐
    │   OpenAI      │                      │    Gemini     │
    │  Embeddings   │                      │   2.5 API     │
    └───────────────┘                      └───────────────┘
```

## Acceptance Criteria (Authoritative)

### Epic-Level Acceptance Criteria

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC-E3-01 | Documents automatically enter processing queue on upload | Integration test: upload → webhook → job created |
| AC-E3-02 | Text, tables, and formulas extracted from Excel files | Unit test: parse xlsx → verify chunk types |
| AC-E3-03 | PDFs parsed with OCR support for scanned documents | Integration test: scanned PDF → text chunks |
| AC-E3-04 | Findings stored with source attribution (document, page, cell) | Unit test: finding.source_reference contains location |
| AC-E3-05 | Embeddings generated and stored in pgvector | Integration test: similarity search returns results |
| AC-E3-06 | Processing status visible in Data Room UI | E2E test: upload → status updates in real-time |
| AC-E3-07 | Failed processing can be retried | API test: retry endpoint requeues job |
| AC-E3-08 | Financial metrics extracted from Excel models | Unit test: xlsx with formulas → metrics table populated |

### Story-Level Acceptance Criteria

**E3.1: FastAPI Backend with pg-boss**
```gherkin
Given the FastAPI backend is running
When I call GET /health
Then I receive 200 OK with {"status": "healthy"}

Given pg-boss is configured
When a job is enqueued
Then it appears in the job queue table
And a worker picks it up within 5 seconds
```

**E3.2: Docling Integration**
```gherkin
Given an Excel file with multiple sheets
When parsed by Docling
Then each sheet becomes separate chunks
And formulas are preserved as text (e.g., "=SUM(A1:A10)")
And tables are extracted as structured data

Given a PDF with embedded images
When parsed with OCR enabled
Then text is extracted from images
And page numbers are recorded in chunk metadata
```

**E3.3: Document Parsing Job Handler**
```gherkin
Given a document_uploaded webhook is received
When the parse_document job runs
Then the file is downloaded from GCS
And chunks are created in document_chunks table
And document.processing_status = 'parsed'
```

**E3.4: Embedding Generation**
```gherkin
Given chunks exist for a document
When generate_embeddings job runs
Then OpenAI API is called with chunk content
And embedding vectors (3072 dimensions) are stored
And similarity search returns relevant chunks
```

**E3.5: LLM Analysis with Gemini 2.5**
```gherkin
Given a document is parsed and embedded
When analyze_document job runs
Then Gemini 2.5 Flash extracts key findings
And findings have confidence scores (0-100)
And findings are linked to source chunks
And financial documents use Gemini 2.5 Pro for deeper analysis
```

**E3.6: Processing Status and WebSocket**
```gherkin
Given I am viewing a document in the Data Room
When processing progresses through stages
Then I see real-time status updates (pending → parsing → analyzing → complete)
And a notification appears when processing completes
```

**E3.7: Processing Queue Visibility**
```gherkin
Given multiple documents are queued
When I view the processing queue
Then I see each document's position and status
And estimated completion time is displayed
```

**E3.8: Retry Logic**
```gherkin
Given a document processing failed
When I click "Retry" in the UI
Then a new processing job is enqueued
And the document status changes to "pending"
And processing resumes from the failed stage
```

**E3.9: Financial Model Extraction**
```gherkin
Given an Excel file is a financial model
When extract_financials job runs
Then revenue, EBITDA, margins are identified
And time periods are associated with values
And formula dependencies are mapped
And metrics appear in financial_metrics table
```

## Traceability Mapping

### Functional Requirements → Stories

| FR ID | Requirement | Stories | Verification |
|-------|-------------|---------|--------------|
| FR-DOC-004 | Document Processing | E3.1, E3.2, E3.3 | Documents parsed automatically |
| FR-KB-001 | Structured Knowledge Storage | E3.4, E3.5 | Findings with embeddings stored |
| FR-KB-002 | Source Attribution | E3.3, E3.5 | Every finding links to source |
| FR-BG-001 | Event-Driven Architecture | E3.1, E3.6 | Webhook → job queue flow |
| FR-BG-002 | Processing Pipeline | E3.1-E3.9 | Full pipeline implemented |

### Stories → Components

| Story | Components Created | Tests Required |
|-------|-------------------|----------------|
| E3.1 | FastAPI app, pg-boss queue, worker | API tests, job queue tests |
| E3.2 | Docling parser, Excel/PDF handlers | Parser unit tests |
| E3.3 | parse_document job handler | Integration tests |
| E3.4 | OpenAI embeddings client, pgvector | Embedding tests |
| E3.5 | Gemini LLM client, prompts, findings | LLM output tests |
| E3.6 | Status tracking, WebSocket updates | E2E tests |
| E3.7 | Queue visibility API, UI components | API + UI tests |
| E3.8 | Retry logic, error handling | Failure scenario tests |
| E3.9 | Financial extractor, metrics table | Financial parsing tests |

### Architecture Decisions → Implementation

| Decision | Implementation in E3 |
|----------|---------------------|
| FastAPI 0.121+ | `manda-processing/src/main.py` |
| pg-boss job queue | `jobs/queue.py`, `jobs/worker.py` |
| Docling parser | `parsers/docling_parser.py` |
| Gemini 2.5 tiered | `llm/models.py` (Flash/Pro/Flash-Lite) |
| OpenAI embeddings | `embeddings/openai_embeddings.py` |
| pgvector | `document_chunks.embedding` column |
| Pydantic v2.12+ | All models in `models/` directory |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Docling parsing fails on complex Excel** | Medium | High | Fallback to openpyxl direct parsing; manual chunk creation |
| **Gemini API rate limits hit** | Medium | Medium | Implement queue throttling; use Flash-Lite for batch |
| **OCR quality poor for scanned docs** | Medium | Medium | Offer manual text input fallback; flag low-confidence |
| **pg-boss scalability limits** | Low | Medium | Design for Redis migration path if needed |
| **Embedding costs exceed budget** | Low | Medium | Batch embeddings; cache repeated content |
| **LLM hallucinations in findings** | Medium | High | Confidence thresholds; require validation for low-confidence |
| **WebSocket connection instability** | Low | Low | Polling fallback for status updates |

### Assumptions

| Assumption | Validation |
|------------|------------|
| Documents are <100MB each | Epic 2 upload limits enforced |
| Most documents are English | Add language detection in E4 if needed |
| Supabase webhooks are reliable | Monitor webhook delivery; implement retry |
| GCS access is always available | GCS has 99.99% SLA |
| Users have stable internet for WebSocket | Polling fallback available |
| Financial models follow common patterns | Build pattern library; allow custom templates |

### Open Questions

| Question | Decision Needed By | Options |
|----------|-------------------|---------|
| **How to handle password-protected files?** | E3.3 implementation | a) Reject with error, b) Request password, c) Skip |
| **Chunk size for embeddings?** | E3.4 implementation | 512 tokens, 1024 tokens, or dynamic |
| **Gemini API key per-project or shared?** | E3.5 implementation | Shared for MVP, per-project for multi-tenant |
| **How long to retain processing logs?** | E3.6 implementation | 7 days, 30 days, or indefinite |
| **Should financial extraction be opt-in?** | E3.9 implementation | Auto-detect vs. user toggle |

### Dependencies on External Factors

| Factor | Impact if Unavailable | Workaround |
|--------|----------------------|------------|
| Gemini API availability | Analysis jobs fail | Retry queue; fallback to Claude |
| OpenAI API availability | Embedding jobs fail | Retry queue; cache embeddings |
| GCS availability | Document download fails | Retry with backoff |
| Supabase availability | All operations fail | No workaround (core dependency) |

## Test Strategy Summary

### Test Categories

| Category | Coverage Target | Tools |
|----------|-----------------|-------|
| **Unit Tests** | 80% line coverage | pytest, pytest-cov |
| **Integration Tests** | All API endpoints | pytest-asyncio, httpx |
| **E2E Tests** | Critical paths | Playwright (frontend), pytest (backend) |
| **Performance Tests** | Key operations | locust or pytest-benchmark |

### Test Structure

```
manda-processing/tests/
├── conftest.py                 # Shared fixtures
├── unit/
│   ├── test_parsers/
│   │   ├── test_docling_parser.py
│   │   ├── test_excel_parser.py
│   │   └── test_pdf_parser.py
│   ├── test_llm/
│   │   ├── test_prompts.py
│   │   └── test_model_selection.py
│   └── test_models/
│       └── test_schemas.py
├── integration/
│   ├── test_api/
│   │   ├── test_health.py
│   │   ├── test_processing.py
│   │   └── test_webhooks.py
│   ├── test_jobs/
│   │   ├── test_parse_document.py
│   │   ├── test_generate_embeddings.py
│   │   └── test_analyze_document.py
│   └── test_storage/
│       ├── test_gcs_client.py
│       └── test_supabase_client.py
└── e2e/
    └── test_full_pipeline.py
```

### Key Test Scenarios

**Unit Tests:**
- Parser correctly extracts text from PDF
- Parser preserves Excel formulas
- LLM prompt templates render correctly
- Pydantic models validate input/output
- Model selection logic chooses correct tier

**Integration Tests:**
- Webhook creates job in queue
- Job worker processes job to completion
- Embedding vectors stored in pgvector
- Findings created with source attribution
- Retry endpoint requeues failed job

**E2E Tests:**
- Upload document → receive "processing complete" notification
- Upload Excel → financial metrics visible in UI
- Upload PDF → similarity search finds relevant chunks

### Test Data

| Document Type | Test File | Expected Output |
|---------------|-----------|-----------------|
| Simple PDF | `test_simple.pdf` | 5 text chunks |
| Excel with formulas | `test_financial.xlsx` | 20 chunks + 15 metrics |
| Scanned PDF | `test_scanned.pdf` | OCR text extracted |
| Large document | `test_large.pdf` (50 pages) | <30s parse time |
| Corrupt file | `test_corrupt.xlsx` | Graceful error handling |

### Mocking Strategy

| External Service | Mock Implementation |
|-----------------|---------------------|
| Gemini API | `unittest.mock` with fixture responses |
| OpenAI API | `unittest.mock` with pre-computed embeddings |
| GCS | Local file system with same interface |
| pg-boss | In-memory queue for unit tests |

### CI/CD Integration

```yaml
# .github/workflows/processing-tests.yml
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: pip install -e ".[dev]"
      - run: pytest --cov=src --cov-report=xml
      - uses: codecov/codecov-action@v4
```

---

**Document Status:** Draft
**Last Updated:** 2025-11-26
**Next Review:** Before E3.1 implementation begins
