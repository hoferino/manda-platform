# Information Vault - RAG Implementation Guide

## Overview

The Information Vault uses a **Hybrid RAG (Retrieval-Augmented Generation)** architecture to provide fast, accurate, source-cited responses from the M&A knowledge base.

## Architecture Components

### 1. Document Ingestion Pipeline

```
Document Upload → Parser → Chunking → Embedding → Vector Store
                     ↓
                  Metadata Extraction → Metadata Store
                     ↓
                  Structured Data → Structured Store
```

**Key Steps:**

1. **Document Parsing**
   - PDF: Extract text, tables, images (OCR if needed)
   - Excel: Parse sheets, preserve formulas, extract structured data
   - Word: Extract text, tables, preserve formatting metadata
   - PowerPoint: Extract text from slides, speaker notes

2. **Intelligent Chunking**
   - Strategy: Semantic chunking (preserve meaning boundaries)
   - Chunk size: 500-1000 tokens with 100-token overlap
   - Preserve context: Include document metadata in each chunk
   - Special handling:
     - Financial tables: Keep entire table in single chunk
     - Contracts: Chunk by section/clause
     - Meeting notes: Chunk by topic/speaker

3. **Embedding Generation**
   - Model: Domain-aware embeddings (e.g., fine-tuned on financial documents)
   - Separate embeddings for:
     - Document chunks (semantic search)
     - Entities (people, companies, products)
     - Metrics (revenue, EBITDA, customer count)
   - Store metadata alongside embeddings:
     - Document name, type, date
     - Data quality (audited/unaudited, formal/informal)
     - Source location (page, section, line)

### 2. Three-Stage Retrieval Pipeline

#### Stage 1: Hybrid Retrieval

**Objective:** Cast wide net to capture all potentially relevant information

**Methods:**
- **Vector Search** (70% weight): Semantic similarity using embeddings
- **Keyword Search** (30% weight): Exact matching for names, numbers, dates

**Parameters:**
- `top_k = 20`: Retrieve 20 candidate chunks
- `similarity_threshold = 0.7`: Minimum cosine similarity
- Filters: Document type, date range, data quality level

**Implementation:**
```python
def hybrid_retrieval(query, filters=None):
    # Generate query embedding
    query_embedding = embed(query)

    # Vector search
    vector_results = vector_db.similarity_search(
        embedding=query_embedding,
        top_k=20,
        threshold=0.7,
        filters=filters
    )

    # Keyword search
    keyword_results = text_index.search(
        query=query,
        top_k=10,
        filters=filters
    )

    # Merge and deduplicate
    combined = merge_results(vector_results, keyword_results, weights=[0.7, 0.3])
    return combined[:20]
```

#### Stage 2: Cross-Encoder Reranking

**Objective:** Refine results using query-document relevance model

**Method:**
- Cross-encoder model scores each (query, chunk) pair
- More accurate than bi-encoder (used in Stage 1) but slower
- Rerank top 20 candidates, select top 10

**Implementation:**
```python
def rerank_results(query, candidates):
    # Score each candidate with cross-encoder
    scores = cross_encoder.predict([
        (query, candidate.text) for candidate in candidates
    ])

    # Sort by score and take top 10
    ranked = sorted(zip(candidates, scores), key=lambda x: x[1], reverse=True)
    return [doc for doc, score in ranked[:10]]
```

#### Stage 3: Context Assembly

**Objective:** Create coherent, well-cited context for response generation

**Strategies:**

1. **Deduplication**
   - If multiple chunks from same section, use most complete
   - Track which chunks cover same information

2. **Prioritization**
   - Structured data (financials, contracts) > Unstructured (presentations)
   - Audited documents > Unaudited
   - Recent data > Historical (when both exist)

3. **Context Enrichment**
   - Include surrounding context from same document
   - Add document metadata (type, date, source)
   - Attach data quality indicators

4. **Citation Tracking**
   - Every fact → specific document + page/section
   - Maintain provenance chain (if info appears in multiple docs, track all)

**Implementation:**
```python
def assemble_context(ranked_chunks):
    context = []
    seen_content = set()

    for chunk in ranked_chunks:
        # Deduplicate
        if chunk.content_hash in seen_content:
            continue
        seen_content.add(chunk.content_hash)

        # Enrich with metadata and surrounding context
        enriched = {
            'text': chunk.text,
            'source': f"{chunk.doc_name}, {chunk.section}, p.{chunk.page}",
            'data_quality': chunk.quality_label,  # "audited", "management", "informal"
            'date': chunk.doc_date,
            'context_before': get_surrounding_text(chunk, direction='before'),
            'context_after': get_surrounding_text(chunk, direction='after')
        }

        context.append(enriched)

    return context
```

### 3. Response Generation with Citations

**Prompt Structure:**

```
You are the Information Vault. Answer the following query using ONLY the provided context.

QUERY: {user_query}

CONTEXT:
{assembled_context_with_citations}

INSTRUCTIONS:
- Answer must be grounded in provided context
- Cite sources: [Source: Document Name, page X]
- Include confidence level based on data quality
- If answer not in context, state: "This information is not in the data room"
- Distinguish facts from reasonable inferences

RESPONSE FORMAT:
**Answer:** [Direct answer]
**Source:** [Citation]
**Confidence:** [High/Medium/Low]
**Additional Context:** [Related info if relevant]
**Gaps:** [What's missing]
```

### 4. Knowledge Base Structure

#### Vector Store (Semantic Search)
- **Technology**: Pinecone, Weaviate, or ChromaDB
- **Contents**:
  - Document chunk embeddings (768-1536 dimensions)
  - Entity embeddings (companies, people, products)
  - Metric embeddings (financial KPIs)
- **Indexes**:
  - Main index: All document chunks
  - Entity index: Extracted entities
  - Metric index: Quantitative data points

#### Structured Store (Fast Queries)
- **Technology**: PostgreSQL or DuckDB
- **Contents**:
  - Financial time-series (revenue, expenses, margins by period)
  - Customer/supplier lists (names, revenue, contracts)
  - Contract metadata (parties, dates, terms, renewal status)
  - Org charts (employees, roles, reporting structure)
- **Schema Design**:
  - Normalized tables for fast joins
  - Time-series optimized for trend queries
  - Foreign keys to source documents

#### Metadata Store (Catalog & Provenance)
- **Technology**: MongoDB or PostgreSQL
- **Contents**:
  - Document catalog (name, type, date, size, quality)
  - Entity graph (relationships: works_for, supplies_to, competes_with)
  - Source tracking (provenance chain for every data point)
  - Version history (document updates, data corrections)

### 5. Inconsistency Detection

**Approach:** Compare same metrics across different sources

```python
def detect_inconsistencies(metric_name):
    # Retrieve all mentions of metric from knowledge base
    mentions = cross_reference_search(metric_name)

    # Group by source type
    audited_financials = [m for m in mentions if m.quality == 'audited']
    management_presentations = [m for m in mentions if m.quality == 'management']
    informal_notes = [m for m in mentions if m.quality == 'informal']

    # Compare values
    inconsistencies = []
    for source_a, source_b in combinations(mentions, 2):
        if source_a.value != source_b.value:
            inconsistencies.append({
                'metric': metric_name,
                'source_1': f"{source_a.doc_name} ({source_a.value})",
                'source_2': f"{source_b.doc_name} ({source_b.value})",
                'severity': calculate_severity(source_a, source_b),
                'explanation': generate_explanation(source_a, source_b)
            })

    return inconsistencies
```

## Performance Optimization

### Caching Strategy
- Cache frequent queries (e.g., "What was 2023 revenue?")
- Cache embeddings (don't recompute for same documents)
- Cache reranking scores for common queries

### Indexing Strategy
- Create indexes on:
  - Document type, date, quality
  - Entity names
  - Metric names and values
  - Source documents

### Batch Processing
- Embed documents in batches
- Bulk insert into vector store
- Parallel processing for large data rooms

## Data Quality Tracking

**Quality Levels:**
1. **High** - Audited financials, signed contracts, formal legal docs
2. **Medium** - Management presentations, unaudited financials, board materials
3. **Low** - Meeting notes, informal communications, analyst observations

**Confidence Scoring:**
- High quality source → High confidence
- Multiple sources agree → High confidence
- Single informal source → Low confidence
- Sources conflict → Flag for review

## Example Queries & Expected Flow

### Query: "What was 2023 revenue?"

1. **Stage 1 - Hybrid Retrieval**
   - Vector search: Finds chunks mentioning "2023", "revenue", "annual revenue"
   - Keyword search: Finds exact matches for "2023 revenue"
   - Returns: 20 candidate chunks from financials, presentations, memos

2. **Stage 2 - Reranking**
   - Cross-encoder scores each chunk for relevance
   - Top result: Income statement from audited financials
   - Returns: Top 10 chunks

3. **Stage 3 - Context Assembly**
   - Primary: "Revenue: $47.2M" from 2023 Audited Financials, Income Statement, p.3
   - Secondary: "FY2023 revenue of $47.2M..." from Management Board Presentation, slide 5
   - Additional: "23% YoY growth vs 2022 ($38.4M)" from Financial Summary

4. **Response Generation**
   ```
   **Answer:** $47.2M
   **Source:** 2023 Audited Financial Statements, Income Statement, p.3
   **Confidence:** High (audited financials)
   **Additional Context:** This represents 23% YoY growth from 2022 ($38.4M).
                           Confirmed in Management Board Presentation (Oct 2023), slide 5.
   **Gaps:** None - complete audited data available
   ```

### Query: "Are there concerns about Acme Corp renewal?"

1. **Stage 1 - Hybrid Retrieval**
   - Finds: Customer contracts, revenue analysis, meeting notes mentioning "Acme"
   - Returns: Contract doc, customer list, 3 meeting note chunks

2. **Stage 2 - Reranking**
   - Prioritizes: Meeting notes discussing Acme renewal
   - Returns: Contract terms + 2 meeting note chunks about renewal discussions

3. **Stage 3 - Context Assembly**
   - Structured: "Acme Corp contract expires 3/31/2024" from contracts folder
   - Unstructured: "Management seemed evasive when asked about Acme renewal" from 10/20 meeting notes
   - Combined: Multiple data points from different quality levels

4. **Response Generation**
   ```
   **Answer:** Yes - Acme Corp (17% of revenue, #1 customer) contract expires in 4 months (3/31/2024).
               Renewal status unclear.
   **Source:** Customer Contract #AC-2021-05, p.12 (expiration date)
               Customer Revenue Analysis 2023.xlsx (revenue concentration)
   **Confidence:** Medium (factual data high confidence, renewal status unknown)
   **Additional Context:** Analyst note from 10/20 meeting: "Management seemed evasive when
                           asked about Acme renewal status." Suggests potential concern.
   **Gaps:** No formal renewal negotiation status. Recommend adding to DD question list:
             "What is the status of Acme Corp contract renewal? Are there alternative
             buyers if renewal fails?"
   ```

## Implementation Checklist

- [ ] Set up vector database (Pinecone, Weaviate, ChromaDB)
- [ ] Deploy document parser (PDF, Excel, Word, PPT)
- [ ] Implement intelligent chunking engine
- [ ] Select and deploy embedding model
- [ ] Build hybrid search (vector + keyword)
- [ ] Implement cross-encoder reranking
- [ ] Create context assembly logic
- [ ] Set up structured database (PostgreSQL/DuckDB)
- [ ] Build metadata catalog
- [ ] Implement source tracking and provenance
- [ ] Create inconsistency detection logic
- [ ] Build response generation with citations
- [ ] Add caching layer for performance
- [ ] Implement monitoring and logging

## Technology Stack Recommendations

**Vector Store:** Pinecone (managed), Weaviate (self-hosted), or ChromaDB (lightweight)
**Text Search:** Elasticsearch or Typesense
**Structured DB:** PostgreSQL with time-series extensions
**Embedding Model:** OpenAI text-embedding-3-large or domain-specific fine-tuned model
**Reranking:** Cohere Rerank API or cross-encoder from Sentence Transformers
**Document Parsing:** PyMuPDF (PDF), openpyxl (Excel), python-docx (Word), python-pptx (PowerPoint)
**Orchestration:** LangChain or LlamaIndex for RAG pipeline

## Monitoring & Observability

**Key Metrics:**
- Query latency (target: <2s for most queries)
- Retrieval accuracy (are relevant docs being found?)
- Citation accuracy (are sources correct?)
- Cache hit rate
- Embedding generation time
- Vector search latency

**Logging:**
- All queries and responses
- Retrieved chunks with scores
- Source citations used
- Inconsistencies detected
- User feedback on answer quality
