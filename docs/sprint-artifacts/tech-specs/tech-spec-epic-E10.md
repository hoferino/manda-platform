# Epic Technical Specification: Knowledge Graph Foundation (Graphiti + Neo4j)

Date: 2025-12-15
Author: Max
Epic ID: E10
Status: Draft

---

## Overview

Epic E10 implements the **Knowledge Architecture Evolution** approved in [Sprint Change Proposal 2025-12-15](../../sprint-change-proposal-2025-12-15.md). This epic consolidates the knowledge layer from a dual-database approach (pgvector + Neo4j) to a unified Graphiti + Neo4j solution with domain-optimized embeddings and reranking.

**Key Capabilities:**
- **Unified Knowledge Store** — Graphiti + Neo4j replaces pgvector for all embeddings and graph data
- **Temporal Knowledge Model** — Bi-temporal facts with valid_at/invalid_at for truth evolution
- **Entity Resolution** — Automatic deduplication ("ABC Corp" = "ABC Corporation")
- **Dynamic Ontology** — Sell-side spine schema + LLM-discovered deal-specific entities
- **Hybrid Retrieval** — Vector + BM25 + graph traversal in single queries
- **Voyage Embeddings** — voyage-finance-2 (1024d) optimized for M&A/finance
- **Reranking Pipeline** — Voyage rerank-2.5 for 20-35% accuracy improvement

**Business Value:** Enables intelligent knowledge synthesis where Q&A answers supersede document facts, entities are automatically resolved, and retrieval accuracy significantly improves—setting the foundation for both sell-side CIM generation and future buy-side due diligence.

**Stories:** 8 implementation stories (E10.1-E10.8)
**Total Story Points:** 42 points

## Objectives and Scope

### Objectives

1. **O1: Knowledge Consolidation** — Consolidate all embeddings and knowledge graph to Graphiti + Neo4j (remove pgvector)
2. **O2: Domain-Optimized Embeddings** — Implement voyage-finance-2 for finance/M&A optimized retrieval
3. **O3: Temporal Knowledge Model** — Enable truth evolution tracking with bi-temporal facts
4. **O4: Entity Resolution** — Automatic deduplication of entities across documents and sources
5. **O5: Hybrid Retrieval** — Implement vector + BM25 + graph retrieval with reranking
6. **O6: Multi-Source Ingestion** — Ingest documents, Q&A responses, and chat as first-class knowledge

### In Scope

| Area | Details |
|------|---------|
| **Infrastructure** | Graphiti client setup, Neo4j 5.26+ configuration, Docker Compose updates (E10.1) |
| **Embeddings** | Voyage voyage-finance-2 integration, 1024d vectors, cost tracking (E10.2) |
| **Schema** | Pydantic entity models, relationship types, dynamic discovery (E10.3) |
| **Document Ingestion** | Docling → Graphiti pipeline, episode creation, entity extraction (E10.4) |
| **Q&A/Chat Ingestion** | Q&A answers, chat facts as episodes, truth supersession (E10.5) |
| **Entity Resolution** | Fuzzy + semantic matching, threshold tuning, alias tracking (E10.6) |
| **Retrieval** | Hybrid search, Voyage reranking, source citations (E10.7) |
| **Cleanup** | Remove pgvector dependencies, update types (E10.8) |

### Out of Scope (MVP)

| Area | Rationale |
|------|-----------|
| **Entity merge/split UI** | Manual resolution deferred to Phase 2; API-only for MVP |
| **GraphRAG for CIM** | E9 uses existing RAG; GraphRAG integration is E11 enhancement |
| **Buy-side temporal queries** | Foundation built now; query interface deferred |
| **Neo4j cluster/sharding** | Single instance sufficient for MVP scale |
| **Custom embedding fine-tuning** | voyage-finance-2 is pre-trained; fine-tuning is Phase 2 |

## System Architecture Alignment

### Architecture Fit

The Knowledge Graph Foundation transforms the data layer from dual-database to unified knowledge store:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CURRENT ARCHITECTURE (MVP)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PostgreSQL (Supabase)           Neo4j (Basic)                              │
│  ├── documents                   ├── :Document                              │
│  ├── document_chunks             ├── :Finding                               │
│  │   └── embedding (pgvector)    └── :EXTRACTED_FROM                        │
│  ├── findings                                                                │
│  │   └── embedding (pgvector)    NOT SYNCED - separate stores               │
│  └── qa_items                                                                │
│                                                                              │
│  Problems:                                                                   │
│  - Two-step retrieval (pgvector → then Neo4j)                               │
│  - No entity resolution                                                      │
│  - Hardcoded schema                                                          │
│  - No temporal model                                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                                    ↓ E10 TRANSFORMS TO ↓

┌─────────────────────────────────────────────────────────────────────────────┐
│                           TARGET ARCHITECTURE (E10)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PostgreSQL (Supabase)           Graphiti + Neo4j 5.26+                     │
│  ├── deals                       ├── :Episode (raw chunks/facts)            │
│  ├── documents (metadata only)   │   └── embedding (1024d Voyage)           │
│  ├── users                       ├── :Entity (resolved)                     │
│  ├── qa_items                    │   └── embedding (1024d Voyage)           │
│  ├── irl_items                   └── :Fact edges (temporal)                 │
│  ├── conversations                   ├── valid_at                           │
│  └── pg-boss (jobs)                  └── invalid_at                         │
│                                                                              │
│  NO EMBEDDINGS                   ALL KNOWLEDGE                               │
│  Transactional data only         Unified store with hybrid queries          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Processing Flow Transformation

**Current Flow (Pre-E10):**
```
Document Upload → Docling Parse → pgvector chunks → Basic Neo4j sync (separate)
                                         ↓
                              Agent queries pgvector → then Neo4j → LLM
```

**Target Flow (Post-E10):**
```
Document Upload → Docling Parse → Graphiti Episodes → Entity Extraction
                                         ↓                    ↓
                              Voyage embeddings (1024d)    Entity Resolution
                                         ↓                    ↓
                              Neo4j storage (unified)    Knowledge Graph
                                         ↓
              Agent queries → Hybrid Search → Voyage Rerank → Top 5-10 → LLM
```

### Key Integration Points

| Existing Component | E10 Integration | Story |
|-------------------|-----------------|-------|
| `manda-processing/src/jobs/handlers/analyze_document.py` | Replace pgvector write with Graphiti ingestion | E10.4 |
| `manda-processing/src/storage/neo4j_client.py` | Extend for Graphiti operations | E10.1 |
| `manda-processing/src/embeddings/openai_client.py` | Replace with Voyage client | E10.2 |
| `manda-app/lib/agent/tools/knowledge.ts` | Update retrieval to use Graphiti | E10.7 |
| `manda-app/lib/services/qa-service.ts` | Trigger Graphiti ingestion on Q&A answer | E10.5 |
| `docker/docker-compose.yml` | Neo4j 5.26+ image update | E10.1 |

### Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Knowledge Framework** | Graphiti (open source) | Built-in temporal model, entity resolution, Neo4j backend |
| **Graph Database** | Neo4j 5.26+ Community | Native HNSW vectors, BM25, graph—single hybrid queries |
| **Embedding Model** | voyage-finance-2 (1024d) | Finance-optimized, 32K context, 50% smaller than OpenAI |
| **Reranking** | voyage-rerank-2.5 | 20-35% accuracy improvement, always applied |
| **Entity Resolution** | Graphiti built-in | Fuzzy + semantic matching, configurable thresholds |
| **PostgreSQL Role** | Transactional only | Auth, metadata, job queue—NO embeddings |

## Detailed Design

### Services and Modules

#### 1. Graphiti Client (`manda-processing/src/graphiti/client.py`)

**Responsibility:** Graphiti client configuration and lifecycle management

```python
# manda-processing/src/graphiti/client.py
from graphiti_core import Graphiti
from graphiti_core.nodes import EntityNode, EpisodeNode
from graphiti_core.edges import FactEdge

class GraphitiClient:
    """
    Singleton Graphiti client for knowledge graph operations.

    Configured for:
    - Neo4j 5.26+ backend
    - Voyage voyage-finance-2 embeddings (1024d)
    - M&A sell-side spine schema
    - Deal-based namespace isolation (group_id)
    """

    def __init__(self, config: GraphitiConfig):
        self.client = Graphiti(
            neo4j_uri=config.neo4j_uri,
            neo4j_user=config.neo4j_user,
            neo4j_password=config.neo4j_password,
            embedding_model=config.embedding_model,  # voyage-finance-2
            llm_model=config.llm_model,              # gemini-2.5-flash for extraction
        )

    async def add_episode(
        self,
        content: str,
        source_channel: str,  # document, qa_response, analyst_chat
        group_id: str,        # deal_id for namespace isolation
        reference_time: datetime,
        source_metadata: dict,
    ) -> EpisodeNode:
        """Add an episode (raw content chunk) to the knowledge graph."""

    async def search(
        self,
        query: str,
        group_id: str,
        num_results: int = 50,
    ) -> list[SearchResult]:
        """Hybrid search: vector + BM25 + graph traversal."""

    async def get_entity(self, entity_id: str) -> EntityNode | None:
        """Get resolved entity by ID."""

    async def merge_entities(self, source_id: str, target_id: str) -> EntityNode:
        """Manually merge two entities (for resolution overrides)."""
```

#### 2. Voyage Embedding Client (`manda-processing/src/embeddings/voyage.py`)

**Responsibility:** Voyage API integration for embeddings and reranking

```python
# manda-processing/src/embeddings/voyage.py
import voyageai
from typing import Literal

class VoyageClient:
    """
    Voyage AI client for finance-optimized embeddings and reranking.

    Models:
    - voyage-finance-2: 1024d embeddings, 32K context
    - rerank-2.5: Reranking model for RAG
    """

    def __init__(self, api_key: str):
        self.client = voyageai.Client(api_key=api_key)

    def embed(
        self,
        texts: list[str],
        input_type: Literal["document", "query"] = "document",
    ) -> list[list[float]]:
        """
        Generate voyage-finance-2 embeddings.

        Args:
            texts: List of texts to embed
            input_type: "document" for indexing, "query" for search

        Returns:
            List of 1024-dimensional embedding vectors
        """
        result = self.client.embed(
            texts=texts,
            model="voyage-finance-2",
            input_type=input_type,
        )
        return result.embeddings

    def rerank(
        self,
        query: str,
        documents: list[str],
        top_k: int = 10,
    ) -> list[RerankResult]:
        """
        Rerank documents by relevance to query.

        Args:
            query: Search query
            documents: List of document texts to rerank
            top_k: Number of results to return

        Returns:
            Reranked results with scores
        """
        result = self.client.rerank(
            query=query,
            documents=documents,
            model="rerank-2.5",
            top_k=top_k,
        )
        return result.results
```

#### 3. Sell-Side Spine Schema (`manda-processing/src/graphiti/schema/entities.py`)

**Responsibility:** Core M&A entity definitions for guided extraction

```python
# manda-processing/src/graphiti/schema/entities.py
from pydantic import BaseModel, Field
from typing import Literal
from datetime import datetime

class Company(BaseModel):
    """Company entity for M&A deals."""
    name: str
    role: Literal["target", "acquirer", "competitor", "customer", "supplier", "investor"]
    industry: str | None = None
    aliases: list[str] = Field(default_factory=list)

class Person(BaseModel):
    """Person entity involved in deal."""
    name: str
    title: str | None = None
    role: Literal["executive", "advisor", "board", "investor", "employee"]
    company_id: str | None = None  # Links to Company entity

class FinancialMetric(BaseModel):
    """Financial metric extracted from documents."""
    metric_type: str  # revenue, ebitda, margin, growth_rate, etc.
    value: float
    period: str       # Q3 2024, FY 2023, LTM, etc.
    currency: str = "USD"
    basis: str | None = None  # GAAP, adjusted, pro_forma

class Finding(BaseModel):
    """Knowledge finding extracted from source."""
    content: str
    confidence: float = Field(ge=0, le=1)
    source_channel: Literal["document", "qa_response", "meeting_note", "analyst_chat"]
    finding_type: Literal["fact", "metric", "risk", "opportunity", "insight"]

class Risk(BaseModel):
    """Risk identified in deal."""
    description: str
    severity: Literal["high", "medium", "low"]
    category: str  # customer_concentration, key_person, regulatory, litigation, etc.
    mitigation: str | None = None

# Relationship types
RELATIONSHIP_TYPES = [
    "EXTRACTED_FROM",  # Finding → Document (provenance)
    "MENTIONS",        # Finding → Entity
    "SUPERSEDES",      # Finding → Finding (new truth replaces old)
    "CONTRADICTS",     # Finding → Finding (unresolved conflict)
    "SUPPORTS",        # Finding → Finding (corroboration)
    "WORKS_FOR",       # Person → Company
    "COMPETES_WITH",   # Company → Company
    "SUPPLIES",        # Company → Company
    "INVESTS_IN",      # Company/Person → Company
]
```

#### 4. Graphiti Ingestion Service (`manda-processing/src/graphiti/ingestion.py`)

**Responsibility:** Orchestrate document and Q&A ingestion into Graphiti

```python
# manda-processing/src/graphiti/ingestion.py
from typing import Literal

class GraphitiIngestionService:
    """
    Ingestion service for adding content to the knowledge graph.

    Supports:
    - Document chunks (from Docling parser)
    - Q&A responses (authoritative answers)
    - Chat facts (analyst-provided information)
    """

    def __init__(
        self,
        graphiti_client: GraphitiClient,
        voyage_client: VoyageClient,
    ):
        self.graphiti = graphiti_client
        self.voyage = voyage_client

    async def ingest_document_chunks(
        self,
        document_id: str,
        deal_id: str,
        chunks: list[DocumentChunk],
    ) -> IngestionResult:
        """
        Ingest document chunks as Graphiti episodes.

        Flow:
        1. Generate Voyage embeddings for chunks
        2. Create episodes in Graphiti
        3. Run entity extraction (LLM)
        4. Entity resolution (dedupe)
        5. Store with provenance links

        Args:
            document_id: Source document UUID
            deal_id: Deal UUID (group_id for namespace)
            chunks: Parsed document chunks from Docling

        Returns:
            Ingestion metrics (entities created, facts extracted, etc.)
        """

    async def ingest_qa_response(
        self,
        qa_item_id: str,
        deal_id: str,
        question: str,
        answer: str,
    ) -> IngestionResult:
        """
        Ingest Q&A response as authoritative knowledge.

        Q&A answers have higher confidence (0.95) than document-extracted facts (0.85).
        If answer contradicts existing fact, creates SUPERSEDES relationship.

        Args:
            qa_item_id: Q&A item UUID
            deal_id: Deal UUID
            question: The question asked
            answer: Client/user provided answer

        Returns:
            Ingestion metrics including superseded facts
        """

    async def ingest_chat_fact(
        self,
        message_id: str,
        deal_id: str,
        fact_content: str,
        extracted_from_message: str,
    ) -> IngestionResult:
        """
        Ingest fact extracted from analyst chat.

        Chat facts have moderate confidence (0.90) and create episodes
        with source_channel="analyst_chat".

        Args:
            message_id: Chat message UUID
            deal_id: Deal UUID
            fact_content: The extracted fact
            extracted_from_message: Full message for context
        """
```

#### 5. Hybrid Retrieval Service (`manda-processing/src/graphiti/retrieval.py`)

**Responsibility:** Hybrid search with reranking pipeline

```python
# manda-processing/src/graphiti/retrieval.py

class HybridRetrievalService:
    """
    Hybrid retrieval pipeline: Graphiti search → Voyage rerank → LLM context.

    Pipeline:
    1. Graphiti hybrid search (vector + BM25 + graph) → 50 candidates
    2. Voyage reranker scores and reorders → Top 5-10
    3. Format with source citations for LLM

    Target latency: < 3 seconds end-to-end
    """

    def __init__(
        self,
        graphiti_client: GraphitiClient,
        voyage_client: VoyageClient,
    ):
        self.graphiti = graphiti_client
        self.voyage = voyage_client

    async def retrieve(
        self,
        query: str,
        deal_id: str,
        num_candidates: int = 50,
        num_results: int = 10,
    ) -> RetrievalResult:
        """
        Retrieve relevant knowledge for a query.

        Args:
            query: User query
            deal_id: Deal UUID for namespace isolation
            num_candidates: Candidates from Graphiti search (default 50)
            num_results: Final results after reranking (default 10)

        Returns:
            RetrievalResult with:
            - results: Reranked knowledge items with scores
            - sources: Citation information (document, page, etc.)
            - entities: Related entities mentioned
            - latency_ms: Pipeline timing
        """
        # 1. Graphiti hybrid search (~300ms)
        candidates = await self.graphiti.search(
            query=query,
            group_id=deal_id,
            num_results=num_candidates,
        )

        # 2. Voyage reranking (~200-300ms)
        texts = [c.content for c in candidates]
        reranked = self.voyage.rerank(
            query=query,
            documents=texts,
            top_k=num_results,
        )

        # 3. Format results with citations
        results = self._format_results(candidates, reranked)

        return RetrievalResult(
            results=results,
            sources=self._extract_sources(results),
            entities=self._extract_entities(results),
            latency_ms=elapsed_ms,
        )

    def _format_results(
        self,
        candidates: list[SearchResult],
        reranked: list[RerankResult],
    ) -> list[KnowledgeItem]:
        """Format reranked results with citation information."""

    def _extract_sources(self, results: list[KnowledgeItem]) -> list[SourceCitation]:
        """Extract source citations for LLM context."""
```

#### 6. UI Components (Future - E11 scope)

The retrieval service will be consumed by the existing agent tools:
- `manda-app/lib/agent/tools/knowledge.ts` — Update to call retrieval service
- `manda-app/lib/agent/tools/findings.ts` — Adapt for Graphiti queries

### Data Models and Contracts

#### Graphiti Configuration

```python
# manda-processing/src/graphiti/config.py
from pydantic import BaseModel, Field

class GraphitiConfig(BaseModel):
    """Graphiti client configuration."""

    # Neo4j connection
    neo4j_uri: str = Field(..., description="Neo4j bolt:// URI")
    neo4j_user: str = Field(default="neo4j")
    neo4j_password: str = Field(..., description="Neo4j password")

    # Embedding configuration
    embedding_model: str = Field(
        default="voyage-finance-2",
        description="Voyage embedding model"
    )
    embedding_dimensions: int = Field(
        default=1024,
        description="Embedding vector dimensions"
    )

    # LLM for extraction
    llm_model: str = Field(
        default="gemini-2.5-flash",
        description="LLM for entity extraction"
    )

    # Entity resolution
    resolution_threshold: float = Field(
        default=0.85,
        ge=0,
        le=1,
        description="Minimum similarity for auto-merge"
    )

    # Retrieval
    default_candidates: int = Field(
        default=50,
        description="Candidates from hybrid search"
    )
    default_results: int = Field(
        default=10,
        description="Results after reranking"
    )
```

#### Episode Types

```python
# manda-processing/src/graphiti/models.py
from pydantic import BaseModel
from datetime import datetime
from typing import Literal

class EpisodeMetadata(BaseModel):
    """Metadata for a Graphiti episode."""
    source_type: Literal["document", "qa_response", "analyst_chat", "meeting_note"]
    source_id: str           # document_id, qa_item_id, message_id
    source_name: str         # filename, question, etc.
    page_number: int | None  # For documents
    chunk_index: int | None  # For documents
    confidence: float        # Base confidence for this source type
    user_id: str | None      # Who provided this information

class IngestionResult(BaseModel):
    """Result of content ingestion."""
    episode_count: int
    entity_count: int
    fact_count: int
    superseded_count: int    # Facts that were replaced by new info
    resolution_merges: int   # Entity pairs that were merged
    embedding_tokens: int
    llm_tokens: int
    elapsed_ms: int
```

#### Retrieval Types

```python
# manda-processing/src/graphiti/retrieval_models.py
from pydantic import BaseModel
from typing import Literal

class KnowledgeItem(BaseModel):
    """A retrieved knowledge item."""
    id: str
    content: str
    score: float                 # Reranker score
    source_type: Literal["episode", "entity", "fact"]
    source_channel: str          # document, qa_response, etc.
    confidence: float            # Extraction confidence
    valid_at: datetime | None    # When this became true
    invalid_at: datetime | None  # When this was superseded

class SourceCitation(BaseModel):
    """Citation for LLM context."""
    type: Literal["document", "qa", "chat"]
    id: str
    title: str
    excerpt: str | None
    page: int | None

class RetrievalResult(BaseModel):
    """Complete retrieval result."""
    results: list[KnowledgeItem]
    sources: list[SourceCitation]
    entities: list[str]          # Related entity IDs
    latency_ms: int
```

### APIs and Interfaces

#### Internal Python APIs (manda-processing)

| Module | Function | Description |
|--------|----------|-------------|
| `graphiti.client` | `GraphitiClient.add_episode()` | Add content episode |
| `graphiti.client` | `GraphitiClient.search()` | Hybrid search |
| `graphiti.ingestion` | `ingest_document_chunks()` | Document → Graphiti |
| `graphiti.ingestion` | `ingest_qa_response()` | Q&A → Graphiti |
| `graphiti.retrieval` | `HybridRetrievalService.retrieve()` | Search + rerank |
| `embeddings.voyage` | `VoyageClient.embed()` | Generate embeddings |
| `embeddings.voyage` | `VoyageClient.rerank()` | Rerank results |

#### REST API Updates (manda-processing)

| Method | Endpoint | Change | Story |
|--------|----------|--------|-------|
| POST | `/api/search` | Update to use Graphiti retrieval | E10.7 |
| POST | `/api/webhooks/document-uploaded` | Trigger Graphiti ingestion | E10.4 |
| POST | `/api/webhooks/qa-answered` | New: Trigger Q&A ingestion | E10.5 |

#### TypeScript Agent Tool Updates (manda-app)

| Tool | File | Change | Story |
|------|------|--------|-------|
| `queryKnowledge` | `lib/agent/tools/knowledge.ts` | Call Graphiti retrieval API | E10.7 |
| `searchFindings` | `lib/agent/tools/findings.ts` | Adapt for Graphiti queries | E10.7 |

### Workflows and Sequencing

#### Document Ingestion Flow (E10.4)

```
Document Upload (existing)
        │
        ▼
┌───────────────────────────────────────┐
│ Webhook: document-uploaded            │
│ (FastAPI manda-processing)            │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ pg-boss: parse-document               │
│ (Existing Docling pipeline)           │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ pg-boss: ingest-graphiti              │   NEW (E10.4)
│                                       │
│ 1. Load parsed chunks from temp       │
│ 2. For each chunk:                    │
│    a. Generate Voyage embedding       │
│    b. Create Graphiti episode         │
│    c. LLM entity extraction           │
│    d. Entity resolution               │
│ 3. Store in Neo4j                     │
│ 4. Update document status             │
│ 5. WebSocket notification             │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ pg-boss: analyze-document             │
│ (Finding extraction - modified)       │
│                                       │
│ Uses Graphiti entities as context     │
│ Stores findings as episodes           │
│ Skips pgvector write (removed)        │
└───────────────────────────────────────┘
```

#### Q&A Ingestion Flow (E10.5)

```
Client answers Q&A (manda-app)
        │
        ▼
┌───────────────────────────────────────┐
│ API: PUT /api/qa/[id]                 │
│ (Update qa_item with answer)          │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Webhook: qa-answered (new)            │   NEW (E10.5)
│ POST /api/webhooks/qa-answered        │
│ { qa_item_id, deal_id, answer }       │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ pg-boss: ingest-qa-response           │   NEW (E10.5)
│                                       │
│ 1. Create episode (source: qa)        │
│ 2. Extract entities/facts from answer │
│ 3. Check for contradictions           │
│    - If found: create SUPERSEDES edge │
│    - Mark old fact invalid_at = now() │
│ 4. Set confidence = 0.95 (high)       │
│ 5. Store in Neo4j                     │
└───────────────────────────────────────┘

Example:
  Document says: "Revenue = $4.8M" (confidence: 0.85)
      ↓
  Client Q&A: "Revenue was actually $5.2M"
      ↓
  System creates:
    - New Episode (source: qa_response)
    - New Fact with confidence: 0.95
    - Old fact marked invalid_at = now()
    - SUPERSEDES relationship created
      ↓
  Query "What is revenue?" → Returns $5.2M (latest truth)
```

#### Retrieval Flow (E10.7)

```
User asks question (Chat UI)
        │
        ▼
┌───────────────────────────────────────┐
│ Agent Tool: queryKnowledge            │
│ (manda-app/lib/agent/tools)           │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ API: POST /api/search                 │
│ (manda-processing FastAPI)            │
│                                       │
│ { query, deal_id, num_results: 10 }   │
└─────────────────┬─────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────────────────────────┐
│ HybridRetrievalService.retrieve()                         │
│                                                           │
│ 1. Graphiti Hybrid Search (~300ms)                       │
│    - Vector similarity (Voyage 1024d)                    │
│    - BM25 full-text match                                │
│    - Graph traversal (related entities)                  │
│    → 50 candidates                                        │
│                                                           │
│ 2. Voyage Reranker (~200-300ms)                          │
│    - rerank-2.5 model                                    │
│    - Score by query relevance                            │
│    → Top 10 results                                       │
│                                                           │
│ 3. Format for LLM (~10ms)                                │
│    - Include source citations                            │
│    - Include entity context                              │
│    - Filter invalid (superseded) facts                   │
│    → Context for agent                                    │
└─────────────────┬─────────────────────────────────────────┘
                  │
                  ▼
┌───────────────────────────────────────┐
│ Agent generates response with         │
│ citations to sources                  │
│                                       │
│ Total latency: ~2-3 seconds           │
└───────────────────────────────────────┘
```

## Non-Functional Requirements

### Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Hybrid search latency** | < 500ms | Graphiti + Neo4j single query |
| **Reranking latency** | < 300ms | Voyage API batch call |
| **End-to-end retrieval** | < 3s | Chat queries must feel responsive |
| **Document ingestion** | < 30s per doc | Includes entity extraction |
| **Embedding generation** | < 100ms per chunk | Voyage API call |
| **Entity resolution** | < 50ms per entity | Built-in Graphiti |

**Optimization Strategies:**
- Connection pooling for Neo4j (10 connections for 5 workers)
- Batch embedding calls (up to 128 texts per call)
- Async ingestion pipeline
- Entity resolution caching within session

### Security

| Requirement | Implementation |
|-------------|----------------|
| **Deal isolation** | Graphiti group_id = deal_id; queries filtered |
| **API authentication** | Existing Supabase JWT validation |
| **Voyage API key** | Environment variable, not committed |
| **Neo4j credentials** | Environment variable, Docker secrets |
| **RLS equivalent** | Application-level filtering in Graphiti queries |

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| **Neo4j availability** | Single instance (MVP); health checks |
| **Ingestion idempotency** | Episode IDs based on source + content hash |
| **Error recovery** | Retry manager for failed ingestion |
| **Data backup** | Neo4j export scripts; PostgreSQL is source of record |
| **Graceful degradation** | Fallback to PostgreSQL if Neo4j unavailable |

### Observability

| Metric | Purpose |
|--------|---------|
| **Ingestion throughput** | Documents/hour, episodes/hour |
| **Entity resolution rate** | Merges per ingestion, false positive rate |
| **Retrieval accuracy** | Reranker score distribution |
| **Latency percentiles** | P50, P95, P99 for search pipeline |
| **API costs** | Voyage embedding/rerank token usage |

## Dependencies and Integrations

### External Dependencies

| Dependency | Version | Purpose | Notes |
|------------|---------|---------|-------|
| `graphiti-core` | ^0.5.x | Knowledge graph framework | **NEW** |
| `neo4j` | ^5.26+ | Graph database driver | Upgrade from current |
| `voyageai` | ^0.3.x | Embeddings and reranking | **NEW** |
| `pydantic` | ^2.12+ | Schema validation | Existing |
| `langchain` | ^1.1+ | LLM integration | Existing |

### Docker Compose Updates

```yaml
# docker/docker-compose.yml additions

services:
  neo4j:
    image: neo4j:5.26-community  # Upgrade from current version
    environment:
      - NEO4J_AUTH=neo4j/${NEO4J_PASSWORD}
      - NEO4J_PLUGINS=["apoc"]
      - NEO4J_dbms_security_procedures_unrestricted=apoc.*
    ports:
      - "7474:7474"  # HTTP
      - "7687:7687"  # Bolt
    volumes:
      - neo4j_data:/data
      - neo4j_logs:/logs
```

### Environment Variables

```bash
# .env additions for E10

# Voyage AI
VOYAGE_API_KEY=voyage-xxx

# Neo4j (existing, ensure version compatible)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=xxx

# Graphiti configuration
GRAPHITI_EMBEDDING_MODEL=voyage-finance-2
GRAPHITI_LLM_MODEL=gemini-2.5-flash
GRAPHITI_RESOLUTION_THRESHOLD=0.85
```

### Story Dependencies

```
E10.1 (Infrastructure)
  │
  ├──► E10.2 (Voyage Integration)
  │      │
  │      └──► E10.3 (Spine Schema)
  │             │
  │             ├──► E10.4 (Document Ingestion) ◄── CRITICAL PATH
  │             │      │
  │             │      └──► E10.5 (Q&A Ingestion)
  │             │
  │             └──► E10.6 (Entity Resolution)
  │                    │
  │                    └──► E10.7 (Hybrid Retrieval)
  │
  └──► E10.8 (PostgreSQL Cleanup)
       └── Can run in parallel after E10.4 validates new pipeline
```

### Epic Dependencies

| Epic | Relationship | Notes |
|------|--------------|-------|
| E9 (CIM Builder) | Consumes E10.7 | CIM uses hybrid retrieval for content |
| E11 (Agent Context) | Builds on E10 | Knowledge write-back targets Graphiti |
| E1-E8 | Foundation | All complete; E10 transforms their data layer |

## Acceptance Criteria (Authoritative)

### E10.1: Graphiti Infrastructure Setup

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-10.1.1 | Graphiti client initializes successfully with Neo4j 5.26+ backend | Unit test |
| AC-10.1.2 | group_id namespacing isolates deal data (query deal A returns nothing from deal B) | Integration test |
| AC-10.1.3 | Connection pooling configured (10 connections max) | Config verification |
| AC-10.1.4 | Docker Compose includes Neo4j 5.26+ with correct plugins | Docker test |
| AC-10.1.5 | Smoke test: ingest text → query → returns results | E2E test |
| AC-10.1.6 | Local setup documentation exists and works | Manual verification |

### E10.2: Voyage Embedding Integration

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-10.2.1 | Voyage API client configured with voyage-finance-2 model | Unit test |
| AC-10.2.2 | Embeddings are 1024 dimensions (verify shape) | Unit test |
| AC-10.2.3 | Embedding generation integrated with Graphiti (add_episode uses Voyage) | Integration test |
| AC-10.2.4 | Fallback to OpenAI if Voyage unavailable (503/429) | Unit test with mock |
| AC-10.2.5 | Cost tracking logs token usage per call | Log verification |
| AC-10.2.6 | VOYAGE_API_KEY documented in .env.example | File check |

### E10.3: Sell-Side Spine Schema

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-10.3.1 | Pydantic models exist for: Company, Person, FinancialMetric, Finding, Risk | Import test |
| AC-10.3.2 | Entity types registered with Graphiti (extraction uses schema) | Integration test |
| AC-10.3.3 | Dynamic discovery enabled (novel entities created without schema change) | Integration test |
| AC-10.3.4 | Relationship types defined (SUPERSEDES, CONTRADICTS, SUPPORTS, etc.) | Schema verification |
| AC-10.3.5 | Schema extension documentation exists | Doc check |
| AC-10.3.6 | Test with sample M&A document extracts expected entities | Integration test |

### E10.4: Document Ingestion Pipeline

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-10.4.1 | Document upload triggers Graphiti episode creation | Integration test |
| AC-10.4.2 | Docling chunks become episode content with source metadata | Episode verification |
| AC-10.4.3 | Entity extraction runs on each chunk | Entity count > 0 |
| AC-10.4.4 | Entities linked to source document (EXTRACTED_FROM relationship) | Graph query |
| AC-10.4.5 | Embeddings generated (Voyage 1024d) and stored in Neo4j | Vector verification |
| AC-10.4.6 | Processing status tracked in PostgreSQL (documents table) | Status check |
| AC-10.4.7 | Error handling with retry logic (uses existing retry_manager) | Error simulation |
| AC-10.4.8 | Test with PDF, Excel, Word documents | Multi-format test |

### E10.5: Q&A and Chat Ingestion

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-10.5.1 | Q&A answer update triggers Graphiti episode creation | Integration test |
| AC-10.5.2 | Chat facts create episodes with source_channel="analyst_chat" | Episode verification |
| AC-10.5.3 | New facts can create SUPERSEDES relationships | Graph query |
| AC-10.5.4 | Confidence: analyst (0.95) > document (0.85) | Confidence verification |
| AC-10.5.5 | Provenance chain maintained (Episode → QAItem or Message) | Graph traversal |
| AC-10.5.6 | Test: Q&A answer supersedes document fact | Supersession test |

### E10.6: Entity Resolution

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-10.6.1 | Fuzzy matching: "ABC Corp" = "ABC Corporation" (auto-merged) | Resolution test |
| AC-10.6.2 | Semantic matching for context-based resolution | Integration test |
| AC-10.6.3 | Threshold configurable (default 0.85) | Config verification |
| AC-10.6.4 | Manual merge API endpoint exists | API test |
| AC-10.6.5 | Resolution decisions tracked (for audit) | Audit log check |
| AC-10.6.6 | Test with real M&A entity variations | Accuracy test |
| AC-10.6.7 | Different metrics NOT merged ("Revenue" vs "Net Revenue") | Negative test |

### E10.7: Hybrid Retrieval with Reranking

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-10.7.1 | Graphiti hybrid search combines vector + BM25 + graph | Query plan verification |
| AC-10.7.2 | Retrieves 50 candidates from Graphiti | Candidate count |
| AC-10.7.3 | Voyage reranker (rerank-2.5) reorders results | Rerank verification |
| AC-10.7.4 | Returns top 5-10 results to LLM | Result count |
| AC-10.7.5 | End-to-end latency < 3 seconds | Performance test |
| AC-10.7.6 | Source citations included in response | Citation presence |
| AC-10.7.7 | Test query types: factual, comparative, exploratory, entity-focused | Query diversity test |
| AC-10.7.8 | Superseded facts filtered from results | Temporal filter test |

### E10.8: PostgreSQL Cleanup

| ID | Criterion | Testable |
|----|-----------|----------|
| AC-10.8.1 | Embedding columns removed from findings table | Schema check |
| AC-10.8.2 | pgvector extension usage removed from queries | Query audit |
| AC-10.8.3 | document_chunks embedding column removed | Schema check |
| AC-10.8.4 | Migration script exists and runs cleanly | Migration test |
| AC-10.8.5 | No broken queries (type-check passes) | Type check |
| AC-10.8.6 | TypeScript types updated (Database types regenerated) | Type verification |

## Test Strategy Summary

### Testing Priorities

| Priority | Story | Risk Level | Test Focus |
|----------|-------|------------|------------|
| **P0** | E10.4 (Document Ingestion) | High | Full pipeline integration |
| **P0** | E10.7 (Retrieval) | High | Accuracy, latency, citations |
| **P1** | E10.5 (Q&A Ingestion) | Medium | Supersession logic |
| **P1** | E10.6 (Entity Resolution) | Medium | Accuracy, false positives |
| **P2** | E10.1 (Infrastructure) | Low | Connection handling |
| **P2** | E10.2 (Voyage) | Low | API integration |

### Test Types

**Unit Tests (pytest):**
- Pydantic schema validation
- Voyage client mocking
- Graphiti client mocking
- Config loading

**Integration Tests (pytest + Neo4j test container):**
- Full ingestion pipeline
- Entity resolution accuracy
- Hybrid search correctness
- Supersession logic

**E2E Tests (Playwright):**
- Upload document → verify in chat retrieval
- Answer Q&A → verify supersession in chat
- Search accuracy verification

### Critical E2E Test Case

```python
# tests/e2e/test_knowledge_graph.py

async def test_document_ingestion_to_retrieval():
    """
    E2E: Upload document → entity extraction → retrieval → chat response
    """
    # 1. Upload test document with known content
    doc_id = await upload_document("test_financials.pdf")

    # 2. Wait for processing complete
    await wait_for_status(doc_id, "complete")

    # 3. Query for known content
    results = await query_knowledge(
        deal_id=test_deal_id,
        query="What is the revenue?"
    )

    # 4. Verify results include document content
    assert len(results) > 0
    assert "revenue" in results[0].content.lower()
    assert results[0].sources[0].document_id == doc_id

async def test_qa_supersedes_document():
    """
    E2E: Document fact superseded by Q&A answer
    """
    # 1. Upload document with revenue = $4.8M
    doc_id = await upload_document("revenue_48m.pdf")
    await wait_for_status(doc_id, "complete")

    # 2. Query - should return $4.8M
    results = await query_knowledge(query="What is revenue?")
    assert "$4.8M" in results[0].content

    # 3. Answer Q&A with revenue = $5.2M
    await answer_qa(qa_item_id, answer="Revenue is actually $5.2M")

    # 4. Query again - should return $5.2M (superseded)
    results = await query_knowledge(query="What is revenue?")
    assert "$5.2M" in results[0].content
    assert "$4.8M" not in results[0].content  # Old fact filtered
```

## Risks, Assumptions, Open Questions

### Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **R1: Graphiti learning curve** | Medium | High | Start with E10.1 spike; iterate |
| **R2: Voyage API availability** | Low | Medium | Fallback to OpenAI embeddings |
| **R3: Entity resolution false positives** | Medium | Medium | Conservative threshold; manual override |
| **R4: Migration complexity** | Low | Low | No production data; clean slate |
| **R5: Neo4j 5.26+ compatibility** | Low | Medium | Test container in CI |
| **R6: Latency exceeds 3s** | Medium | High | Async pipeline; caching |

### Assumptions

| Assumption | Impact if Wrong | Validation |
|------------|-----------------|------------|
| **A1: Graphiti supports Neo4j 5.26+** | Would need fork | Verify in E10.1 |
| **A2: Voyage finance-2 improves accuracy** | Could revert to OpenAI | A/B test in E10.7 |
| **A3: 50 candidates sufficient for reranking** | May need more | Tune in E10.7 |
| **A4: Entity resolution handles M&A variations** | May need custom rules | Test in E10.6 |

### Open Questions

| Question | Owner | Due | Status |
|----------|-------|-----|--------|
| **Q1: Graphiti FalkorDB vs Neo4j backend?** | Dev | E10.1 | Decision: Neo4j (native vectors) |
| **Q2: Voyage free tier limits (50M tokens)?** | DevOps | E10.2 | Open - monitor usage |
| **Q3: Entity resolution threshold optimal?** | Dev | E10.6 | Start 0.85, tune based on testing |

---

**Document Version:** 1.0
**Created:** 2025-12-15
**Last Updated:** 2025-12-15
**Status:** Draft - Ready for Review
