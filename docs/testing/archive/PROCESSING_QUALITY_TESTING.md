# Processing Quality Testing Guide

This guide explains how to test and evaluate the quality of document processing: chunking, embeddings, and LLM analysis.

## Quick Start

### 1. Inspect Processing Quality

Run the inspection script on any processed document:

```bash
cd manda-processing

# Inspect latest document
python3 -m src.scripts.inspect_processing_quality --latest

# Inspect specific document
python3 -m src.scripts.inspect_processing_quality <document-id>
```

This generates a quality report showing:
- Chunking statistics (token counts, chunk types, coverage)
- Embedding coverage
- Finding extraction metrics (types, domains, confidence)
- Overall quality indicators

## Detailed Testing

### A. Chunking Quality

**What to check:**
1. **Token count distribution** - Should be reasonably balanced
   - For PDFs: typically 300-800 tokens per chunk
   - For spreadsheets: varies by cell content

2. **Chunk coverage** - Ensures no content is lost
   - Total tokens should represent full document
   - No large gaps in page/chunk indices

3. **Chunk types** - Appropriate categorization
   - PDFs: mostly `text`, some `table` if tables exist
   - Spreadsheets: mix of `text`, `table`, `formula`

**Manual testing:**

```bash
# Get chunks for a document
python3 -c "
import asyncio
from uuid import UUID
from src.storage.supabase_client import get_supabase_client

async def test():
    db = get_supabase_client()
    chunks = await db.get_chunks_by_document(UUID('<document-id>'))

    for i, chunk in enumerate(chunks[:5]):  # First 5 chunks
        print(f'\nChunk {i}:')
        print(f'  Type: {chunk[\"chunk_type\"]}')
        print(f'  Tokens: {chunk[\"token_count\"]}')
        print(f'  Page: {chunk.get(\"page_number\", \"N/A\")}')
        print(f'  Content: {chunk[\"content\"][:200]}...')

asyncio.run(test())
"
```

**Quality indicators:**
- ✓ Avg 400-600 tokens per chunk (good for LLM context)
- ✓ Minimal token variance (consistent chunk sizes)
- ⚠️ <100 or >1000 tokens (too small/large chunks)
- ⚠️ Missing chunk indices (potential data loss)

### B. Embedding Quality

**What to check:**
1. **Embedding coverage** - All chunks should have embeddings
2. **Dimension correctness** - Embeddings should be 3072 dimensions (text-embedding-3-large)
3. **Semantic similarity** - Similar content should have high cosine similarity

**Manual testing:**

```bash
# Test semantic search
python3 -c "
import asyncio
from src.storage.supabase_client import get_supabase_client

async def test():
    db = get_supabase_client()

    # Search for financial information
    # Note: You'll need to generate embedding for query using OpenAI API
    # This is a placeholder showing the API

    query = 'revenue and financial performance'
    # embedding = openai.embeddings.create(input=query, model='text-embedding-3-large')
    # query_embedding = embedding.data[0].embedding

    # results = await db.search_similar_chunks(
    #     query_embedding=query_embedding,
    #     limit=5
    # )

    print('Semantic search test requires OpenAI API key')

asyncio.run(test())
"
```

**Quality indicators:**
- ✓ 100% embedding coverage
- ✓ Relevant results for semantic queries
- ⚠️ <100% coverage (some chunks missing embeddings)
- ⚠️ Irrelevant search results (poor semantic capture)

### C. Finding Extraction Quality

**What to check:**
1. **Extraction rate** - Findings per chunk
   - Good range: 0.3 - 1.5 findings per chunk
   - Too low: <0.1 (under-extraction)
   - Too high: >2.0 (over-extraction or duplicates)

2. **Finding diversity** - Mix of types and domains
   - Types: fact, opportunity, risk, trend
   - Domains: financial, operational, market, technical, legal

3. **Confidence scores** - Should be reasonably high
   - Good: avg >0.7
   - Concerning: avg <0.5

4. **Content quality** - Findings should be:
   - Specific and actionable
   - Not duplicative
   - Properly attributed (page numbers)

**Manual inspection:**

```bash
# Review findings
python3 -c "
import asyncio
from uuid import UUID
from src.storage.supabase_client import get_supabase_client

async def test():
    db = get_supabase_client()
    findings = await db.get_findings_by_document(UUID('<document-id>'))

    print(f'Total findings: {len(findings)}\n')

    # Group by type
    by_type = {}
    for f in findings:
        ftype = f.get('finding_type', 'unknown')
        by_type[ftype] = by_type.get(ftype, 0) + 1

    print('By type:')
    for ftype, count in by_type.items():
        print(f'  {ftype}: {count}')

    print('\nTop 3 findings:')
    sorted_findings = sorted(findings, key=lambda f: f.get('confidence', 0), reverse=True)
    for i, f in enumerate(sorted_findings[:3]):
        print(f'\n{i+1}. [{f[\"finding_type\"]}] Confidence: {f[\"confidence\"]:.2f}')
        print(f'   {f[\"text\"][:150]}...')

asyncio.run(test())
"
```

**Quality indicators:**
- ✓ Diverse finding types (not all one type)
- ✓ Avg confidence >0.7
- ✓ Specific, actionable findings
- ⚠️ All findings same type (LLM bias)
- ⚠️ Vague findings ("the company has revenue")
- ⚠️ Duplicate findings with similar text

## End-to-End Testing

### Test Document Upload to Neo4j

1. **Upload a test document** through the frontend
2. **Monitor processing** in the database:

```sql
-- Check document status
SELECT id, name, processing_status, last_completed_stage
FROM documents
WHERE id = '<document-id>';

-- Check chunk count
SELECT COUNT(*) FROM document_chunks WHERE document_id = '<document-id>';

-- Check embedding count
SELECT COUNT(*) FROM document_chunks
WHERE document_id = '<document-id>' AND embedding IS NOT NULL;

-- Check findings count
SELECT COUNT(*) FROM findings WHERE document_id = '<document-id>';
```

3. **Verify Neo4j sync** in Neo4j Browser:

```cypher
// Find the document
MATCH (d:Document {id: '<document-id>'})
RETURN d

// Count findings for document
MATCH (f:Finding)-[:EXTRACTED_FROM]->(d:Document {id: '<document-id>'})
RETURN count(f)

// View full graph
MATCH (f:Finding)-[r:EXTRACTED_FROM]->(d:Document {id: '<document-id>'})
RETURN f, r, d
```

4. **Run quality inspection**:

```bash
python3 -m src.scripts.inspect_processing_quality <document-id>
```

## Performance Benchmarks

### Expected Processing Times

| Document Type | Size | Chunking | Embedding | Analysis | Total |
|--------------|------|----------|-----------|----------|-------|
| Small PDF (1-5 pages) | <1MB | <1s | <2s | 3-5s | <10s |
| Medium PDF (10-50 pages) | 1-5MB | 1-3s | 5-10s | 10-20s | 20-35s |
| Large PDF (100+ pages) | 5-20MB | 3-10s | 15-30s | 30-60s | 1-2min |
| Spreadsheet (basic) | <1MB | <1s | <2s | 5-10s | <15s |
| Spreadsheet (complex) | 1-10MB | 2-5s | 5-15s | 15-30s | 25-50s |

### Expected Quality Metrics

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| Embedding Coverage | 100% | 95-100% | <95% |
| Avg Chunk Tokens | 400-600 | 200-800 | <200 or >1000 |
| Findings/Chunk | 0.5-1.5 | 0.3-2.0 | <0.1 or >2.0 |
| Avg Confidence | >0.8 | 0.6-0.8 | <0.6 |
| Finding Diversity | 3+ types | 2-3 types | 1 type |

## Troubleshooting

### Low Embedding Coverage

**Problem**: Not all chunks have embeddings

**Possible causes**:
- Embedding job failed (check job queue)
- OpenAI API rate limit hit
- Network issues

**Fix**:
```bash
# Retry embedding for specific document
python3 -c "
import asyncio
from uuid import UUID
from src.jobs.queue import get_job_queue

async def retry():
    queue = await get_job_queue()
    await queue.send('generate-embeddings', {
        'document_id': '<document-id>'
    })

asyncio.run(retry())
"
```

### Poor Finding Quality

**Problem**: Findings are vague, duplicative, or low confidence

**Possible causes**:
- Chunking too aggressive (loses context)
- LLM prompt needs tuning
- Wrong model tier selected
- Document quality issues

**Investigation**:
1. Check chunk quality (token counts, content)
2. Review LLM prompt in `src/llm/prompts/analyze_chunks.py`
3. Verify model tier selection in logs
4. Try with a cleaner test document

### Neo4j Sync Failures

**Problem**: Findings not appearing in Neo4j

**Possible causes**:
- Neo4j connection issues
- Worker not running with Neo4j integration
- Best-effort sync logged errors but continued

**Fix**:
1. Check worker logs for Neo4j errors
2. Verify Neo4j is running: `http://localhost:7474`
3. Re-run backfill script to sync existing data:

```bash
python3 -m src.scripts.backfill_neo4j
```

## Test Data Sets

### Recommended Test Documents

1. **Simple text PDF** (5-10 pages)
   - Tests basic chunking and extraction
   - Should have clear facts and simple structure

2. **Financial report PDF** (20-50 pages)
   - Tests table extraction
   - Should extract financial metrics and trends

3. **Complex spreadsheet** (multiple sheets, formulas)
   - Tests Excel parsing
   - Should handle formulas and cell references

4. **Mixed content PDF** (text + tables + images)
   - Tests multi-modal parsing
   - Should extract both text and tabular data

## Automated Testing

For CI/CD integration, create test assertions:

```python
# tests/integration/test_processing_quality.py

import pytest
from uuid import UUID
from src.storage.supabase_client import get_supabase_client

@pytest.mark.asyncio
async def test_processing_quality(test_document_id: UUID):
    """Test that document processing meets quality standards."""
    db = get_supabase_client()

    # Check chunks
    chunks = await db.get_chunks_by_document(test_document_id)
    assert len(chunks) > 0, "Document should have chunks"

    # Check embeddings
    embedded = sum(1 for c in chunks if c.get('has_embedding'))
    coverage = embedded / len(chunks)
    assert coverage >= 0.95, f"Embedding coverage too low: {coverage:.2%}"

    # Check findings
    findings = await db.get_findings_by_document(test_document_id)
    findings_per_chunk = len(findings) / len(chunks)
    assert 0.1 <= findings_per_chunk <= 2.0, \
        f"Finding extraction rate out of range: {findings_per_chunk:.2f}"

    # Check confidence
    if findings:
        avg_confidence = sum(f['confidence'] for f in findings) / len(findings)
        assert avg_confidence >= 0.6, \
            f"Average confidence too low: {avg_confidence:.2f}"
```

## Monitoring in Production

### Key Metrics to Track

1. **Processing success rate** - % of documents that complete successfully
2. **Average processing time** - By document type and size
3. **Embedding coverage** - Should stay near 100%
4. **Finding extraction rate** - Findings per chunk (track trends)
5. **Average confidence** - Track over time for quality regression
6. **Neo4j sync success rate** - % of findings synced to graph

### Alerts to Configure

- Embedding coverage drops below 95%
- Average processing time exceeds 2x baseline
- Finding extraction rate drops below 0.1 per chunk
- Average confidence drops below 0.6
- Neo4j sync failure rate exceeds 5%

---

For questions or issues, check the main documentation or create an issue in the repository.
