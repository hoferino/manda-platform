# Manda Platform: Data Flow & Document Processing

> Detailed technical documentation describing the complete journey of data through the Manda platform - from document upload to knowledge retrieval. Designed for creating interactive 3D visualizations.

**Version:** 1.2
**Last Updated:** January 26, 2026

---

> **E10 Architecture Update (2025-12-17):** This document has been updated to reflect the E10 migration:
> - **Embeddings:** Now use Voyage voyage-3.5 (1024 dimensions) instead of OpenAI text-embedding-3-large
> - **Vector storage:** Moved from PostgreSQL pgvector to Neo4j via Graphiti
> - **Search:** Hybrid retrieval (vector + BM25 + graph traversal) replaces pure vector similarity
> - See [SCP-003](decisions/sprint-change-proposal-2025-12-15.md) and [ADR-001](architecture-decisions/adr-001-graphiti-migration.md) for details.

---

## Document Processing Data Flow

This section describes the complete journey of a document through the Manda platform, tracking every transformation, storage location, and service interaction.

---

### STAGE 0: USER INITIATES UPLOAD

```
ACTOR: User (Browser)
ACTION: Drag & drop or select file
LOCATION: React Frontend (data-room/upload-zone.tsx)
DATA: Raw file (PDF/Excel/Word)
SIZE: Up to 100MB
```

**State at this point:**
- File exists only in browser memory
- No backend interaction yet
- User sees upload zone UI

---

### STAGE 1: FILE UPLOAD TO CLOUD STORAGE

```
SOURCE: Browser
TARGET: Google Cloud Storage (GCS)
ENDPOINT: POST /api/documents/upload
TRANSPORT: HTTPS (multipart/form-data)
```

**Flow:**
```
Browser
    │
    │ [1] HTTP POST with file bytes
    ▼
Next.js API Route (manda-app/app/api/documents/upload/route.ts)
    │
    │ [2] Authenticate user via Supabase Auth
    │
    │ [3] Generate GCS path: gs://manda-documents-dev/{deal_id}/{document_id}/{filename}
    │
    │ [4] Stream file to GCS
    ▼
Google Cloud Storage
    │
    │ [5] File stored, signed URL generated (1hr expiry)
    │
    ▼
Response to browser: { document_id, gcs_path, gcs_signed_url }
```

**Data stored in GCS:**
```json
{
  "bucket": "manda-documents-dev",
  "path": "projects/{deal_id}/documents/{document_id}/{original_filename}",
  "content_type": "application/pdf | application/vnd.openxmlformats-officedocument.spreadsheetml.sheet | ...",
  "size_bytes": 1234567,
  "metadata": {
    "uploaded_by": "user_id",
    "uploaded_at": "2025-12-16T10:30:00Z"
  }
}
```

---

### STAGE 2: DATABASE RECORD CREATION

```
SOURCE: Next.js API Route
TARGET: PostgreSQL (Supabase)
TABLE: documents
```

**Flow:**
```
Next.js API Route
    │
    │ [1] INSERT into documents table
    ▼
PostgreSQL (Supabase)
    │
    │ [2] Record created with processing_status: 'pending'
    │
    │ [3] Database trigger fires on INSERT
    ▼
Supabase Webhook configured to POST on documents INSERT
```

**Data stored in PostgreSQL (documents table):**
```json
{
  "id": "uuid-document-123",
  "deal_id": "uuid-project-456",
  "user_id": "uuid-user-789",
  "name": "Financial_Model_2024.xlsx",
  "file_path": "/Financial/Q4",
  "file_size": 1234567,
  "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "gcs_path": "gs://manda-documents-dev/projects/uuid-project-456/documents/uuid-document-123/Financial_Model_2024.xlsx",
  "gcs_signed_url": "https://storage.googleapis.com/...",
  "upload_status": "completed",
  "processing_status": "pending",
  "processing_error": null,
  "created_at": "2025-12-16T10:30:00Z",
  "updated_at": "2025-12-16T10:30:00Z"
}
```

---

### STAGE 3: WEBHOOK TRIGGERS PROCESSING

```
SOURCE: Supabase (database trigger)
TARGET: FastAPI Backend (manda-processing)
ENDPOINT: POST /api/webhooks/documents
TRANSPORT: HTTPS
```

**Flow:**
```
Supabase Webhook
    │
    │ [1] POST with document payload + HMAC signature
    ▼
FastAPI (manda-processing/src/api/routes/webhooks.py)
    │
    │ [2] Validate webhook signature
    │
    │ [3] Extract document_id, gcs_path, file_type
    │
    │ [4] Enqueue job to pg-boss queue
    ▼
pg-boss Queue (PostgreSQL)
    │
    │ [5] Job "document-parse" created with priority 5
    ▼
Job Worker picks up job
```

**Job payload in pg-boss queue:**
```json
{
  "id": "job-uuid-001",
  "name": "document-parse",
  "priority": 5,
  "data": {
    "document_id": "uuid-document-123",
    "deal_id": "uuid-project-456",
    "user_id": "uuid-user-789",
    "gcs_path": "gs://manda-documents-dev/projects/.../Financial_Model_2024.xlsx",
    "file_type": "xlsx",
    "file_name": "Financial_Model_2024.xlsx"
  },
  "state": "created",
  "created_on": "2025-12-16T10:30:05Z"
}
```

---

### STAGE 4: DOCUMENT PARSING (DOCLING)

```
SOURCE: pg-boss Queue
TARGET: Local temp storage → PostgreSQL
HANDLER: manda-processing/src/jobs/handlers/parse_document.py
PARSER: Docling (IBM)
```

**Flow:**
```
Job Worker
    │
    │ [1] Fetch job from pg-boss queue
    │
    │ [2] Update documents.processing_status → 'parsing'
    ▼
PostgreSQL (status update)
    │
    ▼
GCS Download
    │
    │ [3] Download file from GCS to /tmp/{document_id}/
    ▼
Local Temp Storage (/tmp)
    │
    │ [4] File saved locally for processing
    ▼
Docling Parser
    │
    │ [5] Parse document based on type:
    │     - PDF: Text extraction, OCR (optional), table detection
    │     - Excel: Cell values, formulas, sheet structure
    │     - Word: Paragraphs, tables, headings
    │
    │ [6] Split content into chunks:
    │     - Min tokens: 512
    │     - Max tokens: 1024
    │     - Overlap: 50 tokens
    ▼
Chunk Data (in memory)
    │
    │ [7] INSERT chunks into document_chunks table
    ▼
PostgreSQL (document_chunks table)
    │
    │ [8] Delete temp file from /tmp
    │
    │ [9] Enqueue next job: "generate-embeddings"
    ▼
pg-boss Queue (next job)
```

**Data stored in PostgreSQL (document_chunks table):**
```json
[
  {
    "id": "uuid-chunk-001",
    "document_id": "uuid-document-123",
    "chunk_index": 0,
    "content": "Revenue Summary for Q4 2024\n\nTotal Revenue: $42.5M\nGrowth YoY: 28%\n...",
    "chunk_type": "text",
    "page_number": 1,
    "sheet_name": null,
    "cell_reference": null,
    "token_count": 847,
    "embedding": null,
    "metadata": {
      "has_tables": false,
      "extracted_entities": ["Revenue", "Q4 2024"]
    },
    "created_at": "2025-12-16T10:30:15Z"
  },
  {
    "id": "uuid-chunk-002",
    "document_id": "uuid-document-123",
    "chunk_index": 1,
    "content": "| Product | Revenue | Growth |\n| A | $15M | 32% |\n| B | $12M | 24% |...",
    "chunk_type": "table",
    "page_number": 2,
    "sheet_name": "Revenue",
    "cell_reference": "A1:D15",
    "token_count": 623,
    "embedding": null,
    "metadata": {
      "table_headers": ["Product", "Revenue", "Growth"],
      "row_count": 15
    },
    "created_at": "2025-12-16T10:30:15Z"
  }
]
```

---

### STAGE 5: EMBEDDING GENERATION (OPENAI)

```
SOURCE: pg-boss Queue
TARGET: PostgreSQL (update document_chunks.embedding)
HANDLER: manda-processing/src/jobs/handlers/generate_embeddings.py
SERVICE: OpenAI API
MODEL: text-embedding-3-large
```

**Flow:**
```
Job Worker
    │
    │ [1] Fetch job from pg-boss queue
    │
    │ [2] Update documents.processing_status → 'embedding'
    ▼
PostgreSQL (status update)
    │
    │ [3] SELECT all chunks for document_id
    ▼
Chunks loaded (in memory)
    │
    │ [4] Batch chunks (max 100 per API call)
    ▼
OpenAI API
    │
    │ [5] POST /v1/embeddings
    │     model: text-embedding-3-large
    │     dimensions: 3072
    ▼
Embedding Vectors (3072-dimensional)
    │
    │ [6] UPDATE document_chunks SET embedding = vector
    ▼
PostgreSQL (document_chunks.embedding updated)
    │
    │ [7] Vectors indexed via HNSW index (halfvec cast)
    │
    │ [8] Enqueue next job: "analyze-document"
    ▼
pg-boss Queue (next job)
```

**OpenAI API Request:**
```json
{
  "model": "text-embedding-3-large",
  "input": [
    "Revenue Summary for Q4 2024\n\nTotal Revenue: $42.5M...",
    "| Product | Revenue | Growth |..."
  ],
  "dimensions": 3072
}
```

**OpenAI API Response:**
```json
{
  "data": [
    {
      "embedding": [0.0023, -0.0145, 0.0089, ... (3072 values)],
      "index": 0
    },
    {
      "embedding": [0.0156, -0.0234, 0.0012, ... (3072 values)],
      "index": 1
    }
  ],
  "usage": {
    "prompt_tokens": 1470,
    "total_tokens": 1470
  }
}
```

**Data updated in PostgreSQL (document_chunks table):**
```json
{
  "id": "uuid-chunk-001",
  "embedding": "[0.0023, -0.0145, 0.0089, ...]::vector(3072)"
}
```

---

### STAGE 6: LLM ANALYSIS & FINDING EXTRACTION (GEMINI)

```
SOURCE: pg-boss Queue
TARGET: PostgreSQL (findings table) + Neo4j
HANDLER: manda-processing/src/jobs/handlers/analyze_document.py
SERVICE: Google Gemini API
MODEL: gemini-2.5-flash (or gemini-2.5-pro for Excel)
```

**Flow:**
```
Job Worker
    │
    │ [1] Fetch job from pg-boss queue
    │
    │ [2] Update documents.processing_status → 'analyzing'
    ▼
PostgreSQL (status update)
    │
    │ [3] SELECT all chunks with embeddings for document_id
    ▼
Chunks loaded (in memory)
    │
    │ [4] Determine model: Excel → Pro, Others → Flash
    │
    │ [5] Batch chunks (5 per LLM call)
    ▼
Gemini API
    │
    │ [6] POST with extraction prompt:
    │     "Extract key facts, metrics, risks, insights..."
    │
    │ [7] Apply 11 cross-domain patterns
    ▼
Extracted Findings (structured JSON)
    │
    │ [8] Generate embeddings for each finding (OpenAI)
    ▼
OpenAI API
    │
    │ [9] Embedding vectors for findings
    ▼
Finding Vectors (3072-dimensional)
    │
    │ [10] INSERT into findings table
    ▼
PostgreSQL (findings table)
    │
    │ [11] Sync findings to Neo4j (async, non-blocking)
    ▼
Neo4j (knowledge graph)
    │
    │ [12] Conditional: If Excel → Enqueue "extract-financials"
    │                   Always → Enqueue "detect-contradictions"
    ▼
pg-boss Queue (next jobs)
```

**Gemini API Request:**
```json
{
  "model": "gemini-2.5-flash",
  "contents": [
    {
      "role": "user",
      "parts": [
        {
          "text": "You are an M&A analyst. Extract key findings from this document content...\n\nCONTENT:\nRevenue Summary for Q4 2024\nTotal Revenue: $42.5M\nGrowth YoY: 28%..."
        }
      ]
    }
  ],
  "generation_config": {
    "response_mime_type": "application/json"
  }
}
```

**Gemini API Response:**
```json
{
  "findings": [
    {
      "text": "Total revenue reached $42.5M in Q4 2024",
      "finding_type": "metric",
      "domain": "financial",
      "confidence": 0.95,
      "source_page": 1
    },
    {
      "text": "Year-over-year revenue growth of 28%",
      "finding_type": "metric",
      "domain": "financial",
      "confidence": 0.92,
      "source_page": 1
    },
    {
      "text": "Product A is the primary revenue driver at $15M (35% of total)",
      "finding_type": "insight",
      "domain": "financial",
      "confidence": 0.88,
      "source_page": 2
    }
  ]
}
```

**Data stored in PostgreSQL (findings table):**
```json
{
  "id": "uuid-finding-001",
  "deal_id": "uuid-project-456",
  "document_id": "uuid-document-123",
  "user_id": "uuid-user-789",
  "text": "Total revenue reached $42.5M in Q4 2024",
  "finding_type": "metric",
  "domain": "financial",
  "confidence": 0.95,
  "embedding": "[0.0156, -0.0234, ...]::vector(3072)",
  "status": "extracted",
  "source_document": "Financial_Model_2024.xlsx",
  "page_number": 1,
  "metadata": {
    "extraction_model": "gemini-2.5-flash",
    "chunk_ids": ["uuid-chunk-001"],
    "cross_domain_patterns": ["financial_operational"]
  },
  "created_at": "2025-12-16T10:30:45Z",
  "updated_at": "2025-12-16T10:30:45Z"
}
```

**Data stored in Neo4j (nodes & relationships):**
```cypher
// Document Node
CREATE (d:Document {
  id: "uuid-document-123",
  name: "Financial_Model_2024.xlsx",
  project_id: "uuid-project-456",
  doc_type: "xlsx",
  upload_date: datetime("2025-12-16T10:30:00Z")
})

// Finding Nodes
CREATE (f1:Finding {
  id: "uuid-finding-001",
  content: "Total revenue reached $42.5M in Q4 2024",
  finding_type: "metric",
  domain: "financial",
  confidence: 0.95,
  project_id: "uuid-project-456"
})

CREATE (f2:Finding {
  id: "uuid-finding-002",
  content: "Year-over-year revenue growth of 28%",
  finding_type: "metric",
  domain: "financial",
  confidence: 0.92,
  project_id: "uuid-project-456"
})

// Relationships
CREATE (f1)-[:EXTRACTED_FROM {
  extraction_date: datetime("2025-12-16T10:30:45Z"),
  page_number: 1
}]->(d)

CREATE (f2)-[:EXTRACTED_FROM {
  extraction_date: datetime("2025-12-16T10:30:45Z"),
  page_number: 1
}]->(d)

CREATE (f1)-[:RELATED_TO {
  relationship_type: "quantifies",
  strength: 0.85
}]->(f2)
```

---

### STAGE 7: FINANCIAL EXTRACTION (CONDITIONAL)

```
SOURCE: pg-boss Queue
TARGET: PostgreSQL (findings table)
HANDLER: manda-processing/src/jobs/handlers/extract_financials.py
TRIGGER: Excel files OR PDFs with detected tables
```

**Flow:**
```
Job Worker
    │
    │ [1] Fetch job (only if triggered)
    ▼
Chunks with table type
    │
    │ [2] Identify financial tables
    ▼
Gemini API (gemini-2.5-pro)
    │
    │ [3] Specialized financial extraction prompt
    ▼
Structured Financial Metrics
    │
    │ [4] INSERT findings with finding_type: 'financial_metric'
    ▼
PostgreSQL (findings table)
```

**Data stored in PostgreSQL (specialized financial finding):**
```json
{
  "id": "uuid-finding-fin-001",
  "text": "EBITDA: $8.5M (20% margin)",
  "finding_type": "financial_metric",
  "domain": "financial",
  "confidence": 0.97,
  "metadata": {
    "metric_name": "EBITDA",
    "value": 8500000,
    "unit": "USD",
    "period": "Q4 2024",
    "margin_percentage": 20,
    "formula_source": "=Revenue*0.20"
  }
}
```

---

### STAGE 8: CONTRADICTION DETECTION

```
SOURCE: pg-boss Queue
TARGET: PostgreSQL (contradictions table) + Neo4j
HANDLER: manda-processing/src/jobs/handlers/detect_contradictions.py
```

**Flow:**
```
Job Worker
    │
    │ [1] SELECT all findings for deal_id
    ▼
All Findings (in memory)
    │
    │ [2] For each pair of findings:
    │     - Compute cosine similarity (embeddings)
    │     - If similarity > 0.7 AND potentially conflicting:
    ▼
Gemini API
    │
    │ [3] Verify contradiction via LLM
    │     "Are these two statements contradictory?"
    ▼
Contradiction Decision
    │
    │ [4] If contradiction confirmed:
    │     INSERT into contradictions table
    ▼
PostgreSQL (contradictions table)
    │
    │ [5] CREATE CONTRADICTS relationship in Neo4j
    ▼
Neo4j (CONTRADICTS relationship)
    │
    │ [6] Update documents.processing_status → 'complete'
    ▼
PostgreSQL (final status update)
```

**Data stored in PostgreSQL (contradictions table):**
```json
{
  "id": "uuid-contradiction-001",
  "deal_id": "uuid-project-456",
  "finding_a_id": "uuid-finding-001",
  "finding_b_id": "uuid-finding-other-doc",
  "confidence": 0.82,
  "status": "unresolved",
  "resolution": null,
  "resolution_note": null,
  "metadata": {
    "contradiction_reason": "Revenue figures differ: $42.5M vs $45M",
    "severity": "medium",
    "detection_method": "semantic_similarity_llm_verification"
  },
  "detected_at": "2025-12-16T10:31:00Z",
  "resolved_at": null,
  "resolved_by": null
}
```

**Data stored in Neo4j (CONTRADICTS relationship):**
```cypher
MATCH (f1:Finding {id: "uuid-finding-001"})
MATCH (f2:Finding {id: "uuid-finding-other-doc"})
CREATE (f1)-[:CONTRADICTS {
  contradiction_id: "uuid-contradiction-001",
  confidence: 0.82,
  severity: "medium",
  reason: "Revenue figures differ: $42.5M vs $45M",
  detected_at: datetime("2025-12-16T10:31:00Z")
}]->(f2)
```

---

### STAGE 9: KNOWLEDGE BASE READY

```
FINAL STATE: Document fully processed
STATUS: processing_status = 'complete'
```

**Summary of all stored data:**

| Storage | Data Type | Count (example) |
|---------|-----------|-----------------|
| GCS | Raw file | 1 file |
| PostgreSQL (documents) | Document metadata | 1 record |
| PostgreSQL (document_chunks) | Parsed chunks | 23 chunks |
| PostgreSQL (document_chunks.embedding) | Vectors | 23 × 3072-dim |
| PostgreSQL (findings) | Extracted facts | 12 findings |
| PostgreSQL (findings.embedding) | Vectors | 12 × 3072-dim |
| PostgreSQL (contradictions) | Conflicts | 1 contradiction |
| Neo4j (Document nodes) | Graph node | 1 node |
| Neo4j (Finding nodes) | Graph nodes | 12 nodes |
| Neo4j (EXTRACTED_FROM) | Relationships | 12 edges |
| Neo4j (RELATED_TO) | Relationships | 8 edges |
| Neo4j (CONTRADICTS) | Relationships | 1 edge |

---

## Knowledge Retrieval Data Flow

Once documents are processed, the knowledge base supports multiple retrieval patterns.

---

### RETRIEVAL: SEMANTIC SEARCH

```
User Query: "What is the revenue growth?"
    │
    ▼
Next.js API (POST /api/projects/{id}/findings/search)
    │
    │ [1] Generate query embedding (OpenAI)
    ▼
Voyage API
    │
    │ [2] Query vector (1024-dim, voyage-3.5)
    ▼
Graphiti + Neo4j (hybrid search)
    │
    │ [3] Hybrid retrieval:
    │     - Vector similarity (Voyage embeddings)
    │     - BM25 keyword search
    │     - Graph traversal for related entities
    ▼
Top-k Findings (with reranking)
    │
    │ [4] Return findings with similarity scores
    ▼
Response to Frontend
```

---

### RETRIEVAL: CHAT (RAG)

```
User Message: "What is the revenue growth?"
    │
    ▼
Next.js API (POST /api/projects/{id}/chat)
    │
    │ [1] Initialize LangGraph Agent
    ▼
LangGraph Agent
    │
    │ [2] Select tool: search_findings
    ▼
Voyage API (embedding)
    │
    │ [3] Query vector (voyage-3.5)
    ▼
Graphiti + Neo4j (hybrid search)
    │
    │ [4] Top-k findings as context (vector + BM25 + graph)
    ▼
Claude/Gemini (LLM)
    │
    │ [5] Generate response with citations
    ▼
SSE Stream
    │
    │ [6] Stream response to browser
    ▼
Browser (incremental render)
    │
    │ [7] Save conversation to PostgreSQL
    ▼
PostgreSQL (conversations, messages tables)
```

---

## Complete System Topology

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              USER (BROWSER)                                  │
└──────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTPS
                                      ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS 15 (manda-app)                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │ React UI   │  │ API Routes │  │ LangGraph  │  │ Supabase Client        │  │
│  │ Components │  │ (100+)     │  │ Agent      │  │ (Auth + DB)            │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
          │                │                │                    │
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  GOOGLE CLOUD   │ │   POSTGRESQL    │ │    OPENAI       │ │ CLAUDE/GEMINI   │
│    STORAGE      │ │   (SUPABASE)    │ │ (Embeddings)    │ │   (Chat LLM)    │
│                 │ │                 │ │                 │ │                 │
│ • Raw documents │ │ • documents     │ │ • voyage-3.5    │ │ • Streaming     │
│ • Signed URLs   │ │ • chunks        │ │ • 1024 dims     │ │   responses     │
│                 │ │ • findings      │ │                 │ │                 │
│                 │ │ • contradictions│ │                 │ │                 │
│                 │ │ • pg-boss queue │ │                 │ │                 │
│                 │ │                 │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
                           │
                           │ Webhook
                           ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                       FASTAPI (manda-processing)                             │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │ Webhooks   │  │ Job Worker │  │ Docling    │  │ LLM Client             │  │
│  │ Handler    │  │ (pg-boss)  │  │ Parser     │  │ (Gemini)               │  │
│  └────────────┘  └────────────┘  └────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
          │                │                │                    │
          │                │                │                    │
          ▼                ▼                ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│     NEO4J       │ │  GOOGLE CLOUD   │ │     OPENAI      │ │     GEMINI      │
│ (Knowledge      │ │    STORAGE      │ │  (Embeddings)   │ │   (Analysis)    │
│     Graph)      │ │  (Download)     │ │                 │ │                 │
│                 │ │                 │ │                 │ │ • 2.5 Pro       │
│ • Document      │ │ • Download for  │ │ • Chunk embed   │ │ • 2.5 Flash     │
│   nodes         │ │   parsing       │ │ • Finding embed │ │ • 2.5 Flash-Lite│
│ • Finding nodes │ │                 │ │                 │ │                 │
│ • EXTRACTED_FROM│ │                 │ │                 │ │                 │
│ • RELATED_TO    │ │                 │ │                 │ │                 │
│ • CONTRADICTS   │ │                 │ │                 │ │                 │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## Data Flow Summary Table

| Stage | Source | Target | Data Transformation | Service |
|-------|--------|--------|---------------------|---------|
| 0 | User | Browser | File selection | - |
| 1 | Browser | GCS | Raw file → Cloud storage | GCS SDK |
| 2 | API | PostgreSQL | Metadata record creation | Supabase |
| 3 | Supabase | FastAPI | Webhook trigger | HTTP |
| 4 | GCS | PostgreSQL | File → Parsed chunks | Docling |
| 5 | PostgreSQL | PostgreSQL | Chunks → Embeddings | OpenAI |
| 6 | PostgreSQL | PostgreSQL + Neo4j | Chunks → Findings + Graph | Gemini |
| 7 | PostgreSQL | PostgreSQL | Tables → Financial metrics | Gemini Pro |
| 8 | PostgreSQL | PostgreSQL + Neo4j | Findings → Contradictions | Gemini |
| 9 | - | - | Processing complete | - |

---

## 3D Visualization Node Definitions

For creating an interactive 3D visualization, here are the key nodes and connections:

### Nodes (Spheres/Objects)

```json
{
  "nodes": [
    {
      "id": "user",
      "type": "actor",
      "label": "User Browser",
      "color": "#4CAF50",
      "size": "medium"
    },
    {
      "id": "nextjs",
      "type": "service",
      "label": "Next.js API",
      "color": "#000000",
      "size": "large"
    },
    {
      "id": "gcs",
      "type": "storage",
      "label": "Google Cloud Storage",
      "color": "#4285F4",
      "size": "large"
    },
    {
      "id": "postgresql",
      "type": "database",
      "label": "PostgreSQL (Supabase)",
      "color": "#336791",
      "size": "large"
    },
    {
      "id": "graphiti",
      "type": "index",
      "label": "Graphiti (Hybrid Search)",
      "color": "#9C27B0",
      "size": "medium",
      "parent": "neo4j"
    },
    {
      "id": "pgboss",
      "type": "queue",
      "label": "pg-boss Queue",
      "color": "#FF9800",
      "size": "small",
      "parent": "postgresql"
    },
    {
      "id": "fastapi",
      "type": "service",
      "label": "FastAPI Worker",
      "color": "#009688",
      "size": "large"
    },
    {
      "id": "docling",
      "type": "processor",
      "label": "Docling Parser",
      "color": "#795548",
      "size": "medium",
      "parent": "fastapi"
    },
    {
      "id": "neo4j",
      "type": "database",
      "label": "Neo4j Graph",
      "color": "#018BFF",
      "size": "large"
    },
    {
      "id": "openai",
      "type": "ai_service",
      "label": "OpenAI Embeddings",
      "color": "#412991",
      "size": "medium"
    },
    {
      "id": "gemini",
      "type": "ai_service",
      "label": "Gemini LLM",
      "color": "#EA4335",
      "size": "medium"
    },
    {
      "id": "claude",
      "type": "ai_service",
      "label": "Claude (Chat)",
      "color": "#D97706",
      "size": "medium"
    }
  ]
}
```

### Edges (Connections/Flows)

```json
{
  "edges": [
    {
      "id": "e1",
      "source": "user",
      "target": "nextjs",
      "label": "1. Upload file",
      "type": "http",
      "animated": true,
      "color": "#4CAF50"
    },
    {
      "id": "e2",
      "source": "nextjs",
      "target": "gcs",
      "label": "2. Store raw file",
      "type": "sdk",
      "animated": true,
      "color": "#4285F4"
    },
    {
      "id": "e3",
      "source": "nextjs",
      "target": "postgresql",
      "label": "3. Create record",
      "type": "sql",
      "animated": true,
      "color": "#336791"
    },
    {
      "id": "e4",
      "source": "postgresql",
      "target": "fastapi",
      "label": "4. Webhook trigger",
      "type": "http",
      "animated": true,
      "color": "#FF9800"
    },
    {
      "id": "e5",
      "source": "fastapi",
      "target": "gcs",
      "label": "5. Download file",
      "type": "sdk",
      "animated": true,
      "color": "#4285F4"
    },
    {
      "id": "e6",
      "source": "docling",
      "target": "postgresql",
      "label": "6. Store chunks",
      "type": "sql",
      "animated": true,
      "color": "#795548"
    },
    {
      "id": "e7",
      "source": "fastapi",
      "target": "openai",
      "label": "7. Generate embeddings",
      "type": "api",
      "animated": true,
      "color": "#412991"
    },
    {
      "id": "e8",
      "source": "voyage",
      "target": "graphiti",
      "label": "8. Store vectors in Neo4j",
      "type": "api",
      "animated": true,
      "color": "#9C27B0"
    },
    {
      "id": "e9",
      "source": "fastapi",
      "target": "gemini",
      "label": "9. Extract findings",
      "type": "api",
      "animated": true,
      "color": "#EA4335"
    },
    {
      "id": "e10",
      "source": "gemini",
      "target": "postgresql",
      "label": "10. Store findings",
      "type": "sql",
      "animated": true,
      "color": "#EA4335"
    },
    {
      "id": "e11",
      "source": "fastapi",
      "target": "neo4j",
      "label": "11. Sync graph",
      "type": "bolt",
      "animated": true,
      "color": "#018BFF"
    },
    {
      "id": "e12",
      "source": "user",
      "target": "nextjs",
      "label": "12. Chat query",
      "type": "http",
      "animated": true,
      "color": "#D97706"
    },
    {
      "id": "e13",
      "source": "nextjs",
      "target": "graphiti",
      "label": "13. Hybrid search (Graphiti)",
      "type": "api",
      "animated": true,
      "color": "#9C27B0"
    },
    {
      "id": "e14",
      "source": "nextjs",
      "target": "claude",
      "label": "14. Generate response",
      "type": "api",
      "animated": true,
      "color": "#D97706"
    },
    {
      "id": "e15",
      "source": "claude",
      "target": "user",
      "label": "15. Stream response",
      "type": "sse",
      "animated": true,
      "color": "#D97706"
    }
  ]
}
```

### Animation Sequence (for 3D timeline)

```json
{
  "animation_sequence": [
    {"step": 1, "edges": ["e1"], "duration_ms": 500, "description": "User uploads document"},
    {"step": 2, "edges": ["e2"], "duration_ms": 800, "description": "File stored in GCS"},
    {"step": 3, "edges": ["e3"], "duration_ms": 300, "description": "Record created in PostgreSQL"},
    {"step": 4, "edges": ["e4"], "duration_ms": 400, "description": "Webhook triggers processing"},
    {"step": 5, "edges": ["e5"], "duration_ms": 600, "description": "Worker downloads from GCS"},
    {"step": 6, "edges": ["e6"], "duration_ms": 1000, "description": "Docling parses → chunks stored"},
    {"step": 7, "edges": ["e7"], "duration_ms": 800, "description": "Chunks sent to OpenAI"},
    {"step": 8, "edges": ["e8"], "duration_ms": 400, "description": "Embeddings stored in Neo4j via Graphiti"},
    {"step": 9, "edges": ["e9"], "duration_ms": 1200, "description": "Gemini extracts findings"},
    {"step": 10, "edges": ["e10"], "duration_ms": 500, "description": "Findings stored in PostgreSQL"},
    {"step": 11, "edges": ["e11"], "duration_ms": 600, "description": "Knowledge graph synced to Neo4j"},
    {"step": 12, "edges": ["e12"], "duration_ms": 300, "description": "User asks question"},
    {"step": 13, "edges": ["e13"], "duration_ms": 500, "description": "Vector similarity search"},
    {"step": 14, "edges": ["e14"], "duration_ms": 800, "description": "Claude generates response"},
    {"step": 15, "edges": ["e15"], "duration_ms": 1000, "description": "Response streams to user"}
  ]
}
```

---

*Document generated for 3D visualization creation - December 16, 2025*
