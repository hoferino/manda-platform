# Knowledge Base Architecture Research

> **Status:** Research Document
> **Date:** 2024-12-14
> **Context:** Refining the knowledge graph architecture for Manda M&A Intelligence Platform
> **Related:** PRD Section 5 (Semantic Intelligence Engine), Epic E1.7 (Neo4j Configuration)

---

## Executive Summary

The current Neo4j implementation uses hardcoded node types (Deal, Document, Finding, Insight). This research explores whether a more flexible, information-centric model would better serve M&A due diligence where every deal is unique and information comes from multiple channels.

**Recommendation:** Adopt a hybrid approach combining Neo4j (flexibility, existing investment) with a lightweight M&A ontology (passed to LLM at extraction time) and hybrid retrieval (pgvector + graph traversal orchestrated by an agent layer).

---

## 1. Current State

### PostgreSQL (Supabase + pgvector)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `deals` | Project containers | id, name, user_id |
| `documents` | Uploaded files | id, deal_id, file_path, doc_type |
| `document_chunks` | Parsed content with embeddings | id, document_id, content, embedding (3072 dim) |
| `findings` | Extracted facts | id, deal_id, text, finding_type, domain, chunk_id, confidence |

**Embeddings:** OpenAI text-embedding-3-large (3072 dimensions) with HNSW index via halfvec cast.

### Neo4j (Current Schema)

**Hardcoded Node Labels:**
- `Deal` — project container
- `Document` — uploaded file
- `Finding` — extracted fact
- `Insight` — derived pattern/trend
- `QAAnswer` — Q&A workflow answers
- `CIMSection` — CIM document sections

**Relationship Types:**
- `EXTRACTED_FROM` — Finding ← Document
- `CONTRADICTS` — Finding ↔ Finding
- `SUPERSEDES` — Finding → Finding (temporal evolution)
- `SUPPORTS` — Finding → Finding
- `BASED_ON` — Insight ← Finding
- `BELONGS_TO` — Node → Deal

**Problem:** This schema assumes we know upfront what types of entities exist. But M&A deals involve:
- Companies (target, acquirer, competitors, customers)
- People (executives, key employees)
- Financial metrics (revenue, EBITDA, margins — with time periods)
- Contracts (customers, suppliers, employment)
- Products/services
- Market conditions
- Partnerships
- Headcount changes
- Analyst observations (from chat)
- Research findings (from web)

The current schema forces everything into `Finding` with a `category` field, losing semantic richness.

---

## 2. The Core Question: Rigid vs Flexible Schema

### Option A: Pre-defined Entity Types (Rigid)

Define specific node labels for M&A:

```cypher
(:Company {name, type: 'target'|'acquirer'|'competitor'|'customer'})
(:Person {name, role, tenure})
(:FinancialMetric {name, value, period, accounting_basis})
(:Contract {parties, value, duration, terms})
(:Product {name, description, revenue_contribution})
```

**Pros:**
- Clear schema, easier to query
- Type-specific validation
- Predictable structure

**Cons:**
- Can't anticipate every entity type
- "Miscellaneous" bucket becomes bloated
- Schema changes require migrations
- Loses nuance (is "headcount change" a metric? an event? an insight?)

### Option B: Information-Centric Model (Flexible)

Everything is an **information unit** — nodes carry flexible properties, relationships carry the intelligence:

```cypher
// Instead of typed nodes, use rich properties
(:Information {
  content: "Revenue was $10M in Q3 2024",
  source_type: 'document'|'research'|'analyst_chat',
  confidence: 0.95,
  time_period: '2024-Q3',
  entities: ['TargetCo', 'Revenue'],
  semantic_type: 'financial_metric',
  extracted_at: datetime()
})

// Relationships are first-class citizens
[:RELATES_TO {relationship_type: 'revenue_of', confidence: 0.9}]
[:CONTRADICTS {reason: 'Different values for same period', detected_at: datetime()}]
[:SUPERSEDES {reason: 'Newer data available'}]
[:DERIVED_FROM {derivation_type: 'aggregation'}]
```

**Pros:**
- Handles any entity type without schema changes
- Relationships capture semantic meaning
- Natural for LLM extraction (no forced categorization)
- Supports multi-channel ingestion (docs, research, chat)

**Cons:**
- Less structured queries
- Requires more sophisticated query logic
- Potential for inconsistent data

### Option C: Hybrid (Recommended)

Combine both: **Core structural nodes** + **Flexible information nodes** + **Ontology-guided extraction**

```cypher
// Structural nodes (hierarchical, known upfront)
(:Deal {id, name, user_id})
(:Document {id, name, doc_type, deal_id})
(:Channel {type: 'document'|'research'|'analyst_chat'})

// Flexible information nodes
(:Information {
  id,
  content,
  semantic_type,  // From ontology: 'financial_metric', 'contract_term', etc.
  entities: [...],  // Extracted entity mentions
  time_period,
  confidence,
  source_channel,
  metadata: {...}
})

// Entity nodes (created dynamically as discovered)
(:Entity {
  id,
  name,
  entity_type,  // 'company', 'person', 'product', etc.
  deal_id
})

// Rich relationships
[:MENTIONS]  // Information mentions Entity
[:ABOUT]  // Information is about Entity
[:CONTRADICTS]
[:SUPPORTS]
[:SUPERSEDES]
[:DERIVED_FROM]
```

**Why this works:**
- Deal/Document/Channel are structural — we know these exist
- Information nodes are flexible — any fact from any source
- Entity nodes are discovered — created as LLM identifies them
- Relationships are the intelligence layer

---

## 3. Ontology Approaches

### Full RDF/OWL (Not Recommended for MVP)

**What it is:** Formal semantic web standards with built-in reasoning.

**Example (Turtle syntax):**
```turtle
:FinancialMetric rdf:type owl:Class .
:Revenue rdfs:subClassOf :FinancialMetric .
:Revenue :hasUnit :Currency .
:Currency owl:disjointWith :Integer .  # Formal constraint
```

**Formal Reasoning Example:**
- If `Jaguar rdf:type :Animal` and `:Animal owl:disjointWith :Vehicle`
- Reasoner **automatically knows** Jaguar (animal) ≠ Jaguar (car)
- No LLM needed — pure logic

**Pros:**
- Guaranteed logical consistency
- Automatic inference of new facts
- Industry standard for knowledge management

**Cons:**
- Steep learning curve (RDF, SPARQL, OWL)
- Brittle — incomplete ontology = missed inferences
- Overkill for MVP
- Would require replacing Neo4j with Ontotext GraphDB or similar

### Lightweight Ontology (Recommended)

**What it is:** A structured document/prompt passed to the LLM during extraction. Not a formal reasoner — the LLM does the "reasoning."

**Format (YAML for readability):**
```yaml
# manda-ontology.yaml
version: "1.0"
domain: "M&A Due Diligence"

concepts:
  Company:
    description: "Business entity involved in the deal"
    subtypes: [Target, Acquirer, Competitor, Customer, Supplier]
    properties: [name, industry, location, founded_date]

  Person:
    description: "Individual mentioned in deal materials"
    subtypes: [Executive, KeyEmployee, BoardMember, Shareholder]
    properties: [name, role, tenure, compensation]

  FinancialMetric:
    description: "Quantitative financial data point"
    subtypes: [Revenue, EBITDA, Margin, GrowthRate, Headcount]
    required_context: [time_period, accounting_basis, currency]
    disambiguation: "Always require time period — '2024 revenue' not just 'revenue'"

  Contract:
    description: "Legal agreement with terms"
    subtypes: [CustomerContract, SupplierContract, EmploymentAgreement, Lease]
    properties: [parties, value, duration, terms, renewal_terms]

  Event:
    description: "Point-in-time occurrence"
    subtypes: [Acquisition, ProductLaunch, LeadershipChange, MarketEntry]
    properties: [date, description, impact]

relationships:
  CONTRADICTS:
    description: "Two pieces of information are inconsistent"
    requires: [reason, confidence]

  SUPERSEDES:
    description: "Newer information replaces older"
    requires: [reason, superseded_at]

  SUPPORTS:
    description: "Corroborating evidence"
    properties: [strength]

disambiguation_rules:
  - "Revenue without time period is ambiguous — flag for clarification"
  - "Jaguar in M&A context — assume company unless 'animal' explicitly mentioned"
  - "If two metrics have same label but different values, check time periods first"
  - "Management projections vs audited financials — different reliability levels"

extraction_instructions:
  - "Extract entities with their canonical names (normalize 'ABC Corp', 'ABC Corporation', 'ABC' to single entity)"
  - "Always capture time period context for financial metrics"
  - "Flag confidence < 0.7 for human review"
  - "When uncertain about entity type, use 'Unknown' and flag for review"
```

**How it's used:**
1. Load ontology at extraction time
2. Include in LLM prompt: "Given this ontology, extract structured information from the following text..."
3. LLM returns entities and relationships following the schema
4. Store in Neo4j using the hybrid node model

---

## 4. Hybrid Retrieval Strategy

### Problem

We have two data stores:
- **pgvector** — semantic similarity search on embeddings
- **Neo4j** — graph traversal for relationships

When should we use which? The answer: **it depends on the query**.

### Query Types

| Query Type | Best Store | Example |
|------------|-----------|---------|
| Semantic similarity | pgvector | "Find content about revenue trends" |
| Entity relationships | Neo4j | "What contracts does TargetCo have?" |
| Traversal | Neo4j | "What findings contradict this one?" |
| Hybrid | Both | "Find revenue metrics that contradict projections" |
| Full-text keyword | Either | "Search for 'EBITDA'" |

### Agentic RAG Orchestration

Rather than hardcoding which store to query, use an **agent layer** that:
1. Analyzes the user query
2. Decides which retrieval strategy to use
3. Executes the strategy
4. Synthesizes results

**Decision Flow:**
```
User Query
    ↓
┌─────────────────────────────────┐
│   Query Router (LLM-based)      │
│   "What type of query is this?" │
└─────────────────────────────────┘
    ↓
┌─────────────┬─────────────┬─────────────┐
│ Vector      │ Graph       │ Hybrid      │
│ Search      │ Traversal   │ Search      │
│ (pgvector)  │ (Neo4j)     │ (Both)      │
└─────────────┴─────────────┴─────────────┘
    ↓
Results Synthesis
    ↓
Response
```

### Neo4j Hybrid Retrieval (Built-in)

Neo4j's graphrag-python library provides:

- **`HybridRetriever`** — Combines vector and full-text search
- **`HybridCypherRetriever`** — Adds Cypher query for graph context
- **`VectorCypherRetriever`** — Vector search + graph expansion

**Example:**
```python
from neo4j_graphrag.retrievers import HybridCypherRetriever

retriever = HybridCypherRetriever(
    driver=driver,
    vector_index_name="information_embeddings",
    fulltext_index_name="information_text",
    retrieval_query="""
        MATCH (node)-[r:CONTRADICTS|SUPPORTS]-(related)
        RETURN node, collect(related) as context
    """
)

# Query returns vector-matched nodes WITH their graph relationships
results = retriever.search(query_text="revenue projections")
```

---

## 5. LeanRAG Concepts (Future Reference)

**Paper:** "LeanRAG: Knowledge-Graph-Based Generation with Semantic Aggregation and Hierarchical Retrieval" (Zhang et al., 2024)

**Key Ideas:**
1. **Semantic Aggregation** — Group related facts before retrieval (reduces noise)
2. **Hierarchical Retrieval** — Coarse-to-fine search (topic → subtopic → specific fact)
3. **46% retrieval reduction** — Fewer, more relevant chunks

**Relevance to Manda:**
- Could reduce LLM context usage
- Better for complex multi-hop queries
- Worth revisiting post-MVP

**Not implementing now** — complexity vs. value trade-off for MVP.

---

## 6. Implementation Recommendations

### Phase 1: MVP Refinement (Current)

1. **Keep current Neo4j schema** — it works, focus on stability
2. **Create lightweight ontology** — YAML file defining M&A concepts
3. **Enhance extraction prompts** — Include ontology in Gemini analysis
4. **Store richer metadata** — Use existing `metadata` JSONB fields

### Phase 2: Knowledge Base 2.0 (New Epic)

1. **Migrate to hybrid node model:**
   - Structural: Deal, Document, Channel
   - Flexible: Information nodes with semantic_type
   - Dynamic: Entity nodes created as discovered

2. **Implement entity resolution:**
   - Normalize entity names ("ABC Corp" = "ABC Corporation")
   - Link mentions across documents
   - Handle disambiguation

3. **Add hybrid retrieval:**
   - Query router agent
   - pgvector for semantic search
   - Neo4j for relationship traversal
   - Combined for complex queries

4. **Ontology-guided extraction:**
   - Load ontology at analysis time
   - LLM extracts structured entities/relationships
   - Validate against ontology rules

### Phase 3: Advanced Intelligence

1. **Cross-deal patterns** (with permission boundaries)
2. **Temporal reasoning** (metric evolution over time)
3. **Confidence propagation** (if source is wrong, derived insights flagged)
4. **LeanRAG integration** (semantic aggregation)

---

## 7. Open Questions

1. **Entity resolution strategy** — How aggressively to merge entities? False positives (merging different entities) vs false negatives (duplicate entities)?

2. **Embedding strategy for graph nodes** — Should Information nodes have embeddings? Or only use pgvector on document_chunks?

3. **Query routing accuracy** — How well can an LLM decide vector vs graph vs hybrid? May need fine-tuning.

4. **Ontology maintenance** — Who updates the ontology as new entity types emerge? Automated detection of schema gaps?

5. **Performance at scale** — Graph traversal with millions of nodes. When to precompute common paths?

---

## 8. References

### Neo4j Documentation
- [GraphRAG Python Package](https://neo4j.com/docs/neo4j-graphrag-python/current/)
- [SimpleKGPipeline](https://neo4j.com/docs/neo4j-graphrag-python/current/user_guide_kg_builder.html)
- [Hybrid Retrieval](https://neo4j.com/docs/neo4j-graphrag-python/current/retrievers.html)

### Research Papers
- LeanRAG (Zhang et al., 2024) — Semantic aggregation + hierarchical retrieval
- GraphRAG (Microsoft) — Graph-based retrieval augmentation

### RDF/Ontology Resources
- [Ontotext GraphDB](https://www.ontotext.com/products/graphdb/)
- [OWL Web Ontology Language](https://www.w3.org/OWL/)

### Current Implementation
- [Neo4j Types](/manda-app/lib/neo4j/types.ts) — Current node/relationship definitions
- [Neo4j Schema](/manda-app/lib/neo4j/schema.ts) — Constraint/index initialization
- [Findings Migration](/manda-app/supabase/migrations/00017_update_findings_for_llm_analysis.sql) — PostgreSQL schema

---

*This document captures research and architectural decisions. Implementation should be tracked in a dedicated epic (Knowledge Base 2.0) rather than modifying completed epics.*
