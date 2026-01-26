# Document Processing

---
status: Current
last-updated: 2026-01-26
implements: E2, E3, E4
---

Document upload, parsing, and knowledge extraction pipeline.

## Overview

The document processing system handles the complete journey from file upload to searchable knowledge:

```
Upload → GCS Storage → Webhook → pg-boss Queue → Workers
                                      ↓
              document-parse (Docling) → ingest-graphiti (Voyage embeddings)
                                      ↓
              analyze-document (Gemini) → extract-financials
```

## Components

| Component | Location | Description |
|-----------|----------|-------------|
| Upload API | `manda-app/app/api/documents/upload/` | File upload endpoint |
| Storage | Google Cloud Storage | Raw file storage |
| Job Queue | pg-boss (PostgreSQL) | Background job orchestration |
| Parser | `manda-processing/src/parsers/` | Document parsing (Docling) |
| Ingestion | `manda-processing/src/jobs/` | Knowledge graph ingestion |

## Supported Formats

| Format | Parser | Extraction |
|--------|--------|------------|
| PDF | Docling | Text, tables, images |
| Excel (.xlsx) | openpyxl | Structured data |
| Word (.docx) | python-docx | Text, tables |
| PowerPoint | python-pptx | Text, slides |

## Pipeline Stages

### 1. Upload (Frontend)

```typescript
// manda-app/app/api/documents/upload/route.ts
POST /api/documents/upload
- Authenticate user
- Upload to GCS
- Create document record
- Trigger webhook
```

### 2. Parse (manda-processing)

```python
# Job: document-parse
- Download from GCS
- Extract content via Docling
- Store parsed content
- Queue next stage
```

### 3. Ingest (manda-processing)

```python
# Job: ingest-graphiti
- Generate Voyage embeddings (1024d)
- Create entities and relationships
- Store in Neo4j via Graphiti
```

### 4. Analyze (manda-processing)

```python
# Job: analyze-document
- Extract financials
- Identify key entities
- Generate summaries
```

## Configuration

See `manda-processing/docs/parsers.md` for parser configuration and customization.

## Related Documentation

- **[Architecture](../../manda-architecture.md)** - System architecture overview
- **[Data Flow](../../data-flow-and-processing.md)** - Detailed data flow documentation
- **[Knowledge Graph](../knowledge-graph/)** - Graphiti integration
