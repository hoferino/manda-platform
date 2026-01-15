---
story_id: E14-S1
epic: E14
title: Dynamic Entity Extraction Instructions
status: completed
priority: P0
effort: 4-6 hours
assignee: null
completed_date: 2026-01-15
---

# E14-S1: Dynamic Entity Extraction Instructions

## User Story

**As a** document processing pipeline
**I want to** pass dynamic extraction instructions to Graphiti
**So that** entities are extracted based on document content, not predefined schemas

## Background

Currently, Graphiti uses its default entity extraction which may miss domain-specific entities. The `add_episode()` function accepts a `source_description` parameter that influences extraction behavior.

## Acceptance Criteria

- [x] `source_description` parameter populated with dynamic extraction context
- [x] Extraction context includes document type and metadata
- [x] Novel entity types (not in predefined list) are extracted and stored
- [x] Existing extraction behavior not degraded for standard documents
- [x] Extraction completeness logged per document

## Technical Details

### Files to Modify

**Primary:**
- `manda-processing/src/graphiti/ingestion.py` (lines 176-293, 327-413, 415-496)
  - Modify `ingest_document_to_graphiti()` to build dynamic source_description
  - Add document metadata to extraction context

**Secondary:**
- `manda-processing/src/graphiti/client.py` (lines 224-347)
  - Ensure `add_episode()` call passes source_description correctly

- `manda-processing/src/jobs/handlers/ingest_graphiti.py` (lines 194-200)
  - Pass document metadata to ingestion function

### Implementation

```python
# In ingestion.py
def build_source_description(doc_metadata: dict, doc_type: str) -> str:
    """Build dynamic extraction context for Graphiti."""
    base = f"Document: {doc_metadata.get('filename', 'unknown')}"

    # Add extraction hints based on document type
    hints = get_extraction_hints(doc_type, doc_metadata)

    return f"{base}\n\nExtraction Instructions:\n{hints}"

async def ingest_document_to_graphiti(
    document_id: str,
    content: str,
    metadata: dict,
    graphiti_client: Graphiti,
    group_id: str
) -> None:
    doc_type = detect_document_type(metadata)
    source_description = build_source_description(metadata, doc_type)

    await graphiti_client.add_episode(
        name=metadata.get('filename'),
        episode_body=content,
        source_description=source_description,  # Dynamic!
        group_id=group_id,
        # ... other params
    )
```

### Verification

1. Upload a document with novel entity types (e.g., patent filing with "Patent Number", "Filing Date", "Claims")
2. Query Neo4j: `MATCH (n) WHERE n.group_id = $group_id RETURN DISTINCT labels(n)`
3. Verify novel entity types appear in results
4. Check extraction logs for completeness metrics

## Dependencies

- None (uses existing Graphiti infrastructure)

## Out of Scope

- Document-type detection (covered in E14-S2)
- Complexity routing (Post-MVP)

---

## Completion Notes (2026-01-15)

### Tasks Completed

1. **Enhanced `_build_source_description()` method** in `ingestion.py`
   - Now accepts optional `doc_metadata` parameter
   - Calls `detect_document_type()` to classify document
   - Calls `get_extraction_hints()` to get type-specific extraction instructions
   - Combines provenance info with extraction instructions in source_description

2. **Added `_get_document_type()` helper method** for logging/metrics

3. **Updated `ingest_document_chunks()` method**
   - Added optional `doc_metadata` parameter
   - Detects document type at start for logging
   - Passes metadata to `_build_source_description()`
   - Enhanced completion logging with extraction metrics:
     - `document_type`: Detected type (financial, legal, operational, market, general)
     - `extraction_hints_applied`: True (always applied)
     - `chunks_processed`: Total chunks
     - `chunks_successful`: Successfully ingested chunks
     - `extraction_completeness_pct`: Success percentage

4. **Updated job handler** `ingest_graphiti.py`
   - Builds `doc_metadata` dict from document record
   - Passes metadata to `ingest_document_chunks()`

### Implementation Details

- **Zero overhead**: Extraction hints are string-based, added to existing `source_description` parameter
- **No Graphiti modifications**: All changes are in Manda code, using Graphiti's existing API
- **Backward compatible**: `doc_metadata` parameter is optional with sensible defaults
- **Logging enhanced**: Document type and extraction completeness now logged for observability

### Source Description Format

```
From: document.xlsx | Page 5 | Sheet: Revenue | Type: table

Extraction Instructions:
Extract all financial entities including:
- Financial metrics (revenue, EBITDA, margins, growth rates)
- Time periods and their associated values
...
Source document: document.xlsx
File format: xlsx
```

### Files Modified

- **Modified:** `manda-processing/src/graphiti/ingestion.py`
  - Enhanced `_build_source_description()` with extraction hints
  - Added `_get_document_type()` helper
  - Updated `ingest_document_chunks()` signature and logging
- **Modified:** `manda-processing/src/jobs/handlers/ingest_graphiti.py`
  - Build and pass `doc_metadata` to ingestion service

### Dependencies

- Uses `DocumentType`, `detect_document_type`, `get_extraction_hints` from E14-S2
