---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
status: complete
inputDocuments:
  - docs/dynamic-knowledge-graph-pipeline-plan.md
  - docs/research/knowledge-base-architecture-research.md
  - docs/manda-prd.md
  - docs/manda-platform-overview.md
  - docs/manda-index.md
  - _bmad-output/planning-artifacts/agent-system-prd.md
workflowType: 'prd'
lastStep: 1
documentCounts:
  briefs: 0
  research: 1
  projectDocs: 5
  userProvided: 1
---

# Product Requirements Document - manda-platform

**Author:** Max
**Date:** 2026-01-15

---

## Executive Summary

The Dynamic Knowledge Graph Pipeline transforms Manda's document processing from a rigid, schema-constrained system to an adaptive, LLM-driven architecture that works for any deal type — from niche dog toy manufacturers to enterprise SaaS companies.

**Core Problem:** The current system uses predefined entity types and static extraction patterns. When users upload documents from unfamiliar industries, domain-specific entities and relationships either get forced into wrong categories or dropped entirely. Users cannot trust completeness.

**Core Solution:** An adaptive extraction and retrieval pipeline where:
- The knowledge graph discovers entity types and relationships from documents themselves
- Zero information loss — everything uploaded gets captured and indexed
- Dual retrieval via Neo4j: semantic search for speed, graph traversal for connected context
- Downstream flexibility: works for simple chat, complex LangGraph workflows, and unknown future use cases

**The Manda Promise:** "Upload anything. We capture everything. Query it however you need."

### What Makes This Special

**Deal-Agnostic Intelligence:** Unlike systems that require industry-specific configuration, Manda's knowledge graph adapts autonomously. A pet products company and an enterprise software company get equally comprehensive extraction without manual setup.

**Zero-Loss Guarantee:** Completeness is non-negotiable. Every fact, metric, relationship, and entity in uploaded documents gets captured in Neo4j. Users can trust that if it's in the documents, it's in the system.

**Dual Retrieval Architecture:** Neo4j serves both:
- **Vector search** — fast semantic similarity for simple queries
- **Graph traversal** — relationship-aware retrieval for complex analysis

This enables everything from quick ChatGPT-style questions to sophisticated financial modeling workflows.

**Foundation-First Philosophy:** The ingestion/processing/indexing pipeline must be perfect. All downstream features (chat, CIM builder, agent workflows) depend on this backbone being complete and well-structured.

## Project Classification

**Technical Type:** saas_b2b (B2B SaaS Platform Enhancement)
**Domain:** fintech (M&A / Investment Banking)
**Complexity:** high (LLM-driven extraction, knowledge graph, multi-service architecture)
**Project Context:** Brownfield - extending existing Manda platform

**Builds On:**
- E10 Knowledge Graph Foundation (Graphiti + Neo4j, Voyage embeddings, hybrid retrieval)
- E11 Agent Context Engineering (context strategies, retrieval integration)
- Agent System v2.0 (supervisor pattern, specialist agents)
- CIM MVP (workflow-guided document creation)

**Key Technical Constraints:**
- Must integrate with existing Graphiti + Neo4j infrastructure
- Must support both manda-app (Next.js) and manda-processing (FastAPI) services
- Must maintain multi-tenant isolation (project_id / group_id scoping)

## Success Criteria

### User Success

| Metric | Target | Measurement |
|--------|--------|-------------|
| Information Completeness | 100% of document content indexed | No entity/fact dropped during extraction |
| Retrieval Accuracy | >90% relevant results | User finds what they're looking for on first query |
| Deal-Agnostic Coverage | Works for any industry | No manual configuration required per deal type |

**The "aha!" moment:** User asks about a niche entity (product line, retail partner, industry-specific metric) and the system has it — without anyone configuring it.

### Business Success

| Timeframe | Target |
|-----------|--------|
| 3 months | Pipeline processes any document type without dropping information |
| 6 months | CIM builder and chat retrieval quality measurably improved |
| 12 months | Platform handles diverse deal types with consistent quality |

### Technical Success

| Metric | Target |
|--------|--------|
| Extraction Coverage | No predefined schema limitations |
| Dual Retrieval | Both vector search and graph traversal functional |
| Processing Reliability | All uploaded documents fully indexed |

## Product Scope

### MVP - Minimum Viable Product

**Phase 1: Dynamic Entity Extraction (Backend)**
- Remove schema constraints from Graphiti extraction
- Add dynamic extraction instructions to source_description
- Expose `excluded_entity_types` parameter
- Document-type-aware extraction hints

**Phase 3: Dynamic CIM Retrieval (Frontend)**
- Replace static `SECTION_QUERIES` with LLM-generated queries
- Add graph schema introspection endpoint
- Pass buyer persona and user focus to retrieval

### Growth Features (Post-MVP)

**Phase 2: Complexity-Based Document Routing**
- Complexity detection for documents
- Direct LLM extraction for complex financial models
- Route based on complexity score

**Phase 5: User Focus Adaptation**
- `set_analysis_focus` tool for dynamic priority changes
- Cache invalidation for affected queries

### Vision (Future)

- Cross-deal pattern recognition
- Self-improving extraction based on user corrections
- Industry-specific ontology learning

## User Journeys

### Journey 1: Analyst Uploads Niche Industry Documents

**Persona:** Sarah, M&A analyst working on a pet products manufacturer acquisition

**Scenario:** Sarah uploads financial statements, customer contracts, and market research for "PawPals Inc" — a niche dog toy company.

**Current Experience (Problem):**
1. Uploads documents → processing completes
2. Asks chat: "What are the main product lines?"
3. System returns generic results or misses domain-specific entities like "SKU velocity" or "retail partner margins"
4. Sarah manually reviews documents to find what system missed

**Future Experience (Solution):**
1. Uploads documents → dynamic extraction captures ALL entities including "Product Line: Squeaky Bones," "Retail Partner: PetSmart," "Metric: SKU velocity 2.3x"
2. Asks chat: "What are the main product lines?"
3. System returns complete list with revenue attribution, sourced from knowledge graph
4. Sarah trusts the system captured everything

**Success Indicator:** Zero manual document review needed to verify completeness.

---

### Journey 2: CIM Builder Retrieves Context for Unfamiliar Deal

**Persona:** Marcus, associate building CIM for a specialized manufacturing company

**Scenario:** Building "Market Opportunity" section for a company in industrial valve manufacturing.

**Current Experience (Problem):**
1. Enters CIM builder, selects section
2. Static query `SECTION_QUERIES['market_opportunity']` searches for generic terms
3. Misses industry-specific context: "API certifications," "refinery maintenance cycles," "valve replacement intervals"
4. Marcus manually searches and copies relevant content

**Future Experience (Solution):**
1. Enters CIM builder, selects section
2. System introspects graph schema: "This deal has entities: API_Certification, Refinery_Customer, Maintenance_Cycle"
3. LLM generates query: "Find market opportunity data including API certifications, refinery customer relationships, and maintenance cycle drivers"
4. Retrieves highly relevant, deal-specific context automatically

**Success Indicator:** CIM sections populated with domain-specific context without manual search.

---

### Journey 3: Complex Financial Model Processing

**Persona:** Jordan, analyst uploading detailed Excel financial model

**Scenario:** Uploads 50-tab Excel model with formulas, scenarios, and sensitivity tables.

**Current Experience (Problem):**
1. Uploads Excel → Docling parses structure
2. Complex formula relationships and scenario logic get flattened or lost
3. Asking "What's the revenue sensitivity to price changes?" returns incomplete data
4. Jordan exports and manually analyzes the model

**Future Experience (Solution):**
1. Uploads Excel → complexity detection scores it as "very_high"
2. Routes to direct LLM extraction (Claude) which understands formula logic
3. Extracts: "Revenue sensitivity: +10% price = +$2.3M revenue (from Scenario tab, formula =B15*1.1)"
4. Jordan queries and gets formula-aware responses

**Success Indicator:** Complex models queryable without manual analysis.

## Functional Requirements

### FR1: Dynamic Entity Extraction

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1.1 | System SHALL extract entities dynamically without predefined type constraints | P0 |
| FR1.2 | System SHALL include extraction context in Graphiti `source_description` parameter | P0 |
| FR1.3 | System SHALL support document-type-aware extraction hints (financial, legal, operational, market) | P0 |
| FR1.4 | System SHALL expose `excluded_entity_types` parameter to Graphiti `add_episode()` | P1 |
| FR1.5 | System SHALL create entities for domain-specific concepts not in predefined types | P0 |

### FR2: Document Processing Pipeline

| ID | Requirement | Priority |
|----|-------------|----------|
| FR2.1 | System SHALL process all uploaded documents without dropping content | P0 |
| FR2.2 | System SHALL detect document complexity (table density, formula count, file size) | P1 |
| FR2.3 | System SHALL route high-complexity documents to direct LLM extraction | P1 |
| FR2.4 | System SHALL support parallel processing paths (standard Graphiti vs direct LLM) | P1 |
| FR2.5 | System SHALL log extraction completeness metrics per document | P0 |

### FR3: Knowledge Graph Storage

| ID | Requirement | Priority |
|----|-------------|----------|
| FR3.1 | System SHALL store all extracted entities in Neo4j with full metadata | P0 |
| FR3.2 | System SHALL maintain vector embeddings for semantic search | P0 |
| FR3.3 | System SHALL create relationships between entities (MENTIONS, RELATES_TO, CONTRADICTS) | P0 |
| FR3.4 | System SHALL support both vector search and graph traversal queries | P0 |
| FR3.5 | System SHALL maintain multi-tenant isolation via `group_id` | P0 |

### FR4: Dynamic Query Generation

| ID | Requirement | Priority |
|----|-------------|----------|
| FR4.1 | System SHALL generate retrieval queries dynamically based on graph schema | P0 |
| FR4.2 | System SHALL introspect deal-specific entity types before query generation | P0 |
| FR4.3 | System SHALL incorporate buyer persona context into query generation | P0 |
| FR4.4 | System SHALL cache generated queries with 24h TTL | P1 |
| FR4.5 | System SHALL fall back to static queries if dynamic generation fails | P0 |

### FR5: CIM Builder Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR5.1 | System SHALL replace static `SECTION_QUERIES` with dynamic query generator | P0 |
| FR5.2 | System SHALL pass buyer persona to retrieval layer | P0 |
| FR5.3 | System SHALL pass user focus context to retrieval layer | P1 |
| FR5.4 | System SHALL provide graph schema introspection endpoint | P0 |

### FR6: Chat/Agent Integration

| ID | Requirement | Priority |
|----|-------------|----------|
| FR6.1 | System SHALL support semantic search for simple queries | P0 |
| FR6.2 | System SHALL support graph traversal for relationship queries | P0 |
| FR6.3 | System SHALL auto-select retrieval method based on query characteristics | P1 |
| FR6.4 | System SHALL return source attribution for all retrieved content | P0 |

## Non-Functional Requirements

### NFR1: Performance

| ID | Requirement | Target |
|----|-------------|--------|
| NFR1.1 | Document processing time | <5 min for standard docs, <15 min for complex |
| NFR1.2 | Query generation latency | <500ms (Haiku) |
| NFR1.3 | Retrieval latency | <2s for semantic, <5s for graph traversal |
| NFR1.4 | Concurrent document processing | 10+ simultaneous |

### NFR2: Reliability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR2.1 | Extraction completeness | 100% — no information dropped |
| NFR2.2 | Processing success rate | >99% of documents complete without error |
| NFR2.3 | Query fallback availability | Static queries always available as backup |

### NFR3: Scalability

| ID | Requirement | Target |
|----|-------------|--------|
| NFR3.1 | Documents per deal | 500+ without degradation |
| NFR3.2 | Entities per deal | 10,000+ in Neo4j |
| NFR3.3 | Concurrent deals | 100+ active |

### NFR4: Cost

| ID | Requirement | Target |
|----|-------------|--------|
| NFR4.1 | Dynamic extraction overhead | ~$0 (uses existing source_description) |
| NFR4.2 | Direct LLM extraction | +$0.20-0.40 per complex doc (~10% of docs) |
| NFR4.3 | Query generation | +$0.001 per section (Haiku, cached) |
| NFR4.4 | Total processing cost increase | <10% vs current |

## Technical Constraints

### TC1: Infrastructure Constraints

| ID | Constraint | Rationale |
|----|------------|-----------|
| TC1.1 | Must use existing Graphiti + Neo4j infrastructure | Investment already made in E10 |
| TC1.2 | Must use Voyage embeddings (voyage-3.5, 1024d) | Standardized in E10.8 |
| TC1.3 | Must integrate with pg-boss job queue | Existing processing pipeline |
| TC1.4 | Must work with GCS document storage | Current architecture |

### TC2: API Constraints

| ID | Constraint | Rationale |
|----|------------|-----------|
| TC2.1 | Graphiti `add_episode()` signature must be respected | Library dependency |
| TC2.2 | Neo4j queries must use `group_id` for tenant isolation | Multi-tenant requirement |
| TC2.3 | New endpoints must follow existing FastAPI patterns | Consistency |

### TC3: Model Constraints

| ID | Constraint | Rationale |
|----|------------|-----------|
| TC3.1 | Query generation should use Claude Haiku for cost | High volume, simple task |
| TC3.2 | Direct LLM extraction should use Claude Sonnet | Quality critical for complex docs |
| TC3.3 | Must support Vertex AI for enterprise deployments | EU data residency |

## Dependencies

### Internal Dependencies

| ID | Dependency | Type | Status |
|----|------------|------|--------|
| DEP1 | Graphiti + Neo4j (E10) | Infrastructure | ✅ Complete |
| DEP2 | Voyage embeddings (E10.8) | Service | ✅ Complete |
| DEP3 | Agent v2.0 retrieval layer | Integration | ✅ Complete |
| DEP4 | CIM MVP knowledge service | Integration | ✅ Complete |
| DEP5 | pg-boss job queue | Infrastructure | ✅ Complete |

### External Dependencies

| ID | Dependency | Type | Risk |
|----|------------|------|------|
| DEP6 | Anthropic Claude API | LLM Provider | Low — established |
| DEP7 | Voyage AI API | Embeddings | Low — established |
| DEP8 | Neo4j Aura / Self-hosted | Database | Low — operational |

### New Components Required

| ID | Component | Location | Effort |
|----|-----------|----------|--------|
| NEW1 | Dynamic extraction instructions | `manda-processing/src/graphiti/ingestion.py` | 4-6 hours |
| NEW2 | Extraction hints module | `manda-processing/src/graphiti/extraction_hints.py` | 2 hours |
| NEW3 | Complexity detection | `manda-processing/src/parsers/complexity.py` | 4 hours |
| NEW4 | Direct LLM extraction handler | `manda-processing/src/jobs/handlers/extract_direct_llm.py` | 6-8 hours |
| NEW5 | Query generator | `manda-app/lib/agent/cim-mvp/query-generator.ts` | 4-6 hours |
| NEW6 | Schema introspection endpoint | `manda-processing/src/api/routes/search.py` | 2-3 hours |

## Risks & Mitigations

### R1: Extraction Quality Risk

| Risk | LLM query generation produces bad/irrelevant queries |
|------|-----------------------------------------------------|
| Probability | Medium |
| Impact | High — retrieval quality degrades |
| Mitigation | Keep static mapping as fallback; log and monitor query quality; A/B test |

### R2: Cost Escalation Risk

| Risk | Direct LLM extraction costs too high at scale |
|------|-----------------------------------------------|
| Probability | Medium |
| Impact | Medium — margin impact |
| Mitigation | Only route truly complex docs (>80 complexity score); monitor costs per document |

### R3: Complexity Detection Accuracy

| Risk | Complexity detection routes wrong documents to expensive path |
|------|---------------------------------------------------------------|
| Probability | Medium |
| Impact | Low — cost inefficiency, not quality |
| Mitigation | Tune thresholds based on production data; add manual override |

### R4: Cache Invalidation Issues

| Risk | Stale cached queries return outdated results |
|------|----------------------------------------------|
| Probability | Low |
| Impact | Medium — retrieval quality |
| Mitigation | Short TTL initially (1h); add manual invalidation endpoint; invalidate on document upload |

### R5: Graph Schema Introspection Performance

| Risk | Schema introspection adds latency to every retrieval |
|------|-----------------------------------------------------|
| Probability | Low |
| Impact | Medium — UX degradation |
| Mitigation | Cache schema per deal; refresh on document processing completion |

## Implementation Phases

### Phase 1: Dynamic Entity Extraction (MVP)
**Effort:** 4-6 hours | **Impact:** High

Files to modify:
- `manda-processing/src/graphiti/ingestion.py` (lines 176-293, 327-413, 415-496)
- `manda-processing/src/graphiti/client.py` (lines 224-347)
- `manda-processing/src/jobs/handlers/ingest_graphiti.py` (lines 194-200)

New files:
- `manda-processing/src/graphiti/extraction_hints.py`

### Phase 3: Dynamic CIM Retrieval (MVP)
**Effort:** 6-8 hours | **Impact:** High

Files to modify:
- `manda-app/lib/agent/cim-mvp/graphiti-knowledge.ts` (lines 20-80)
- `manda-app/lib/agent/cim-mvp/tools.ts` (lines 233-321)
- `manda-app/lib/agent/cim-mvp/knowledge-service.ts`

New files:
- `manda-app/lib/agent/cim-mvp/query-generator.ts`
- `manda-processing/src/api/routes/search.py` (new endpoint)

### Phase 2: Complexity-Based Routing (Post-MVP)
**Effort:** 8-12 hours | **Impact:** Medium

Files to modify:
- `manda-processing/src/jobs/handlers/parse_document.py` (lines 180-220)
- `manda-processing/src/jobs/worker.py`

New files:
- `manda-processing/src/parsers/complexity.py`
- `manda-processing/src/jobs/handlers/extract_direct_llm.py`

---

## Appendix: Verification Plan

### Phase 1 Verification
1. Upload a document with novel entity types (e.g., "Patent", "License", "SKU")
2. Check Neo4j for nodes with those labels
3. Verify entities appear in Graphiti search results

### Phase 3 Verification
1. Create CIM for a deal with unusual content
2. Verify dynamic queries are generated (check Redis cache)
3. Compare retrieval quality to static queries
4. Test with different buyer personas

### Phase 2 Verification
1. Upload a complex Excel financial model
2. Verify complexity detection routes to direct LLM
3. Compare extraction quality vs standard path
4. Check cost difference in usage logs

