# Manda Agent Framework Strategy

**Document Status:** Strategic Planning
**Created:** 2026-01-05
**Last Updated:** 2026-01-05
**Owner:** Max
**Contributors:** PM John, Architect Winston, Analyst Mary, Dev Amelia, TEA Murat
**Version:** 1.1

---

## Executive Summary

This document outlines the strategic vision for Manda's agent framework using LangGraph and LangSmith. It identifies core problems in the current implementation, proposes solutions with memory files and autonomous write-back, and simulates detailed user workflows showing what happens in the UI and background.

**Key Findings:**
1. **[NEW - E12.10]** Documents must be queryable immediately after upload (solved by two-tier retrieval)
2. Current architecture is reactive-only; knowledge doesn't accumulate from conversations
3. Querying the full graph for every question is inefficient
4. Memory files + selective retrieval can reduce tokens by 60-80%
5. Autonomous write-back is critical for persistent intelligence
6. LangSmith observability is essential for optimization

**Recent Updates (2026-01-05):**
- Added E12.10 Fast Path Retrieval to solve immediate document querying
- Updated Problem Matrix with P0 (immediate querying)
- Added Solution 0 deep dive for two-tier retrieval architecture
- Updated all workflow simulations to show parallel processing paths
- Added Phase 0 to Implementation Roadmap

---

## Table of Contents

1. [The Sell-Side M&A Workflow](#1-the-sell-side-ma-workflow)
2. [Current State Analysis](#2-current-state-analysis)
3. [Problems & Solutions](#3-problems--solutions)
4. [Proposed Architecture](#4-proposed-architecture)
5. [Workflow Simulations](#5-workflow-simulations)
6. [LangGraph Implementation](#6-langgraph-implementation)
7. [LangSmith Observability](#7-langsmith-observability)
8. [Implementation Roadmap](#8-implementation-roadmap)

---

## 1. The Sell-Side M&A Workflow

### What Analysts Actually Do (8-Week Deal Cycle)

```
WEEK 1-2: RECEIVE & ORGANIZE
├── Receive 100-500 documents from client
├── Organize into data room (IRL-driven folder structure)
├── Flag missing items, send follow-up requests
└── Initial document triage

WEEK 2-4: ANALYZE & SYNTHESIZE
├── Read every document (analyst's core job)
├── Extract key findings while reading
├── Note contradictions, questions, red flags
├── Build mental model of the company
└── Validate data quality

WEEK 4-6: BUILD KNOWLEDGE
├── Cross-reference findings across documents
├── Identify patterns (margin trends, customer concentration)
├── Resolve contradictions via client Q&A
├── Build the "story" of the company
└── Prepare for buyer questions

WEEK 6-8: CREATE DELIVERABLES
├── Draft Q&A list for client clarifications
├── Build CIM narrative (buyer-persona driven)
├── Create slide deck with visualizations
├── Review, iterate, finalize
└── Deliver to potential buyers
```

### What Analysts Want from AI

Analysts DON'T want AI to replace their judgment. They want AI to:

| Need | Description |
|------|-------------|
| **Remember everything** | Never lose context from any conversation or document |
| **Surface connections** | Find patterns across 500 documents humans might miss |
| **Never start fresh** | Resume after 2 weeks with full context preserved |
| **Accelerate synthesis** | Help create CIM without hallucinating facts |
| **Maintain source attribution** | Every fact traceable to document, page, cell |

---

## 2. Current State Analysis

> **Updated 2026-01-05:** Added E12.10 Fast Path Retrieval to address immediate document querying. See [Sprint Change Proposal 2026-01-05](sprint-artifacts/sprint-change-proposal-2026-01-05.md).

### What's Built (Phase 1 & 2 MVP Complete)

| Component | Status | Implementation |
|-----------|--------|----------------|
| Document Processing | ✅ Complete | Docling + pg-boss pipeline |
| Knowledge Graph | ✅ Complete | Graphiti + Neo4j with Voyage embeddings |
| Chat Agent | ✅ Complete | LangGraph `createReactAgent` with 17 tools |
| CIM Builder | ✅ Complete | LangGraph StateGraph with 5 nodes, 20 tools |
| Intent Classification | ✅ Complete | Semantic router + regex fallback |
| Retrieval | ✅ Complete | Graphiti hybrid search (vector + BM25 + graph) |
| Multi-Tenant Isolation | ✅ Complete | E12.9 - org_id scoping, RLS policies |
| Fast Path Retrieval | 📋 Planned | E12.10 - ChunkNodes for immediate querying |

### What's Missing (Critical Gaps)

| Gap | Impact | Status |
|-----|--------|--------|
| **Immediate Document Querying** | Users wait 2-3 min/chunk before querying | **E12.10 planned** - Two-tier retrieval |
| **Write-Back Integration** | Knowledge doesn't accumulate from chat | E11.3 not implemented |
| **Memory Files** | Full graph query for every question (slow, expensive) | Not designed |
| **Proactive Insights** | System is reactive-only | Phase 3 not started |
| **Token Optimization** | Unknown efficiency, no measurement | LangSmith not enabled |
| **Persistent Checkpoints** | CIM state lost on restart (MemorySaver) | Needs PostgreSQL checkpointer |

### Architecture Gap Visualization

```
CURRENT STATE (pre-E12.10):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │────▶│  Chat Agent  │────▶│   Neo4j      │
│   Query      │     │  (Reactive)  │     │  (Full Query)│
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            ▼
                     [Response Only]
                     (Knowledge Lost)
                     ⚠️ Must wait for Graphiti extraction (2-3 min/chunk)

WITH E12.10 (Two-Tier Retrieval):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Document   │────▶│  PARALLEL    │────▶│   Neo4j      │
│   Upload     │     │  JOBS        │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                  ┌─────────┴─────────┐          │
                  ▼                   ▼          │
           ┌──────────────┐   ┌──────────────┐   │
           │ embed_chunks │   │ingest_graphiti│  │
           │ (~5 seconds) │   │(2-3 min/chunk)│  │
           └──────────────┘   └──────────────┘   │
                  │                   │          │
                  ▼                   ▼          │
           ┌──────────────┐   ┌──────────────┐   │
           │ ChunkNodes   │   │ Entity/Edge  │   │
           │ (Tier 1)     │   │ Nodes (Tier 2)│  │
           └──────────────┘   └──────────────┘   │
                  │                   │          │
                  └─────────┬─────────┘          │
                            ▼                    │
┌──────────────┐     ┌──────────────┐            │
│   User       │────▶│  Chat Agent  │────────────┘
│   Query      │     │  (Two-Tier)  │
└──────────────┘     └──────────────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
        [Tier 2 First] [Fallback T1] [Force T1]
        (Rich context) (Immediate)  (Raw search)

TARGET STATE (with Memory Files):
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   User       │────▶│  Chat Agent  │────▶│ Memory Files │
│   Query      │     │  (Proactive) │     │ (Pre-computed)│
└──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  Write-Back  │     │ Neo4j (Gap   │
                     │  to Graph    │     │ Queries Only)│
                     └──────────────┘     └──────────────┘
```

---

## 3. Problems & Solutions

> **Updated 2026-01-05:** Added P0 (Immediate Document Querying) - solved by E12.10 Fast Path Retrieval.

### Problem Matrix

| # | Problem | Current Pain | Solution | Value Add | Status |
|---|---------|--------------|----------|-----------|--------|
| **P0** | Documents not queryable immediately | Users wait 2-3 min/chunk for entity extraction before asking questions | **E12.10 Fast Path**: Parallel embed-chunks job creates ChunkNodes for immediate search | Query documents within ~5 seconds of upload; entity extraction continues in background | 📋 **Planned** |
| **P1** | Knowledge doesn't persist from chat | Analyst tells system facts, forgets them next session | **Autonomous Write-Back**: Index facts to Neo4j automatically | Never lose context; "Where did I see that?" → instant answer | ⬚ Not started |
| **P2** | Full graph query for every question | 3-5s latency, high token cost, irrelevant results | **Memory Files**: Pre-computed summaries loaded by intent | 10x faster, 60-80% token reduction | ⬚ Not started |
| **P3** | No proactive intelligence | System only responds to questions | **Background Analysis Agent**: Pattern detection + notifications | "Margin compression detected" without asking | ⬚ Phase 3 |
| **P4** | Context lost between sessions | Start fresh every conversation | **Persistent State**: PostgreSQL checkpointer + memory files | Resume after 2 weeks with full context | ⬚ Not started |
| **P5** | Contradictions slip through | Manual review of all findings | **Contradiction Workflow**: Confidence-aware detection | Flag real issues, reduce false positives | ⬚ Phase 2 |
| **P6** | CIM disconnected from knowledge | Agent may hallucinate content | **Memory-Aware CIM**: Load deal thesis + key findings | CIM grounded in verified facts | ⬚ Phase 2 |
| **P7** | Token usage unknown | No visibility into costs | **LangSmith Tracing**: Full observability | Optimize costs, measure quality | ⬚ Phase 1 |

### Solution Deep Dives

#### Solution 0: Fast Path Retrieval (E12.10)

**Problem:** Graphiti entity extraction takes 2-3 minutes per chunk due to LLM calls. Users expect to query documents immediately after upload (like Claude).

**Solution:** Two-tier retrieval architecture with parallel processing paths.

**Architecture:**
```
Document Upload
     │
     ▼
┌─────────────┐
│ Docling     │
│ Parse       │
└─────────────┘
     │
     ├────────────────────────────────────────┐
     ▼                                        ▼
┌─────────────────┐              ┌─────────────────┐
│ embed-chunks    │              │ ingest-graphiti │
│ (FAST PATH)     │              │ (DEEP PATH)     │
│ ~5 seconds      │              │ ~2-3 min/chunk  │
└─────────────────┘              └─────────────────┘
     │                                        │
     ▼                                        ▼
┌─────────────────┐              ┌─────────────────┐
│ ChunkNodes      │              │ Entity/Edge     │
│ (Tier 1)        │              │ Nodes (Tier 2)  │
│ - Raw content   │              │ - Resolved      │
│ - Voyage embed  │              │   entities      │
│ - No LLM calls  │              │ - Relationships │
└─────────────────┘              └─────────────────┘
```

**Retrieval Strategy:**
1. **Tier 2 first:** Try knowledge graph (rich entity context, relationships)
2. **Tier 1 fallback:** If no results, search ChunkNodes (raw content)
3. **Force Tier 1:** User can request "raw search" for recently uploaded docs

**Implementation:** See [E12.10 in Epic E12](sprint-artifacts/epics/epic-E12.md) and [Sprint Change Proposal 2026-01-05](sprint-artifacts/sprint-change-proposal-2026-01-05.md).

---

#### Solution 1: Memory Files

**Concept:** Pre-computed, structured summaries that capture "what we know" about specific topics.

**Storage:** PostgreSQL `deal_memory_files` table with JSONB content column. Cached in Redis for fast retrieval (5-min TTL).

```
deal_memory_files table:
├── deal_id: uuid
├── file_type: enum (company_profile, financial_summary, customer_analysis, etc.)
├── content: jsonb  # Structured data, not markdown
├── token_count: int  # Pre-computed for budget planning
├── version: int  # Incremented on regeneration
├── stale: boolean  # True when Neo4j has newer data
├── last_regenerated_at: timestamp
└── created_at, updated_at: timestamps

File types:
├── company_profile      # Basics, history, structure, key people
├── financial_summary    # Revenue, EBITDA, margins, trends, projections
├── customer_analysis    # Concentration, contracts, churn, top customers
├── operational_overview # Team, processes, capacity, technology
├── risk_register        # Identified risks, contradictions, open items
├── deal_thesis          # Investment highlights, buyer fit, valuation
└── open_questions       # Unresolved items, Q&A pending, follow-ups
```

**How it works:**
1. **Event-driven regeneration**: Memory file marked stale when Neo4j ingests related entities
2. **Lazy regeneration**: Stale files regenerated on next access (not immediately)
3. **Intent classifier** selects 1-3 files to load based on query
4. **Coverage check**: LLM determines if memory files answer query (>80% confidence = skip retrieval)
5. **Targeted retrieval**: Only query Neo4j for specific gaps not in memory files
6. **Write-back**: Updates Neo4j → marks affected memory files stale

**Token Impact:**
- Current: ~6-8K tokens per query (full retrieval + history)
- Target: ~2-4K tokens per query (memory file + targeted retrieval)
- Savings: 50-70%

#### Solution 2: Autonomous Write-Back

**Concept:** Agent automatically indexes user-provided facts to Neo4j without confirmation dialogs.

**Trigger conditions:**
- User states a fact: "Revenue was $10M in Q3"
- User provides context: "The CEO mentioned they're expanding to Europe"
- User corrects the system: "No, it was $12M, not $10M"
- Agent synthesizes: "Based on these documents, EBITDA margin is 15%"

**Process:**
1. Parse agent response for fact candidates
2. Extract entities (company, metric, date, value)
3. Call Graphiti ingest with source attribution
4. Graphiti handles entity resolution + deduplication
5. Mark memory files as stale for regeneration

---

## 4. Proposed Architecture

### LangGraph Agent Orchestration

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MANDA AGENT ORCHESTRATION                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SUPERVISOR AGENT                          │   │
│  │  Routes to specialized agents based on intent                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│        │              │              │              │               │
│        ▼              ▼              ▼              ▼               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │  CHAT    │  │ ANALYSIS │  │   CIM    │  │BACKGROUND│          │
│  │  AGENT   │  │  AGENT   │  │  AGENT   │  │  AGENT   │          │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│        │              │              │              │               │
│        └──────────────┴──────────────┴──────────────┘               │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    SHARED STATE GRAPH                        │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │ Deal State │  │ Memory     │  │ Pending    │             │   │
│  │  │ (context)  │  │ Files Refs │  │ Write-Back │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    PERSISTENCE LAYER                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │   │
│  │  │ Neo4j        │  │ Memory Files │  │ PostgreSQL   │       │   │
│  │  │ (Knowledge)  │  │ (Summaries)  │  │ (Checkpoints)│       │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Chat Agent Node Graph

> **Updated 2026-01-05:** Added two-tier retrieval (E12.10) with ChunkNode fallback for recently uploaded documents.

```
START
  │
  ▼
┌─────────────────┐
│ CLASSIFY INTENT │  ← Semantic router + LLM fallback
└─────────────────┘
  │
  ├─── greeting ──────▶ GENERATE (skip retrieval)
  │
  ├─── meta ──────────▶ GENERATE (skip retrieval)
  │
  └─── factual/task ──▶ SELECT MEMORY FILES
                              │
                              ▼
                       ┌─────────────────┐
                       │ LOAD MEMORY     │  ← Load 1-3 relevant files
                       │ FILES           │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ CHECK COVERAGE  │  ← Can memory files answer?
                       └─────────────────┘
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              [Sufficient]        [Gap Detected]
                    │                   │
                    │                   ▼
                    │            ┌─────────────────┐
                    │            │ TWO-TIER        │  ← E12.10
                    │            │ RETRIEVAL       │
                    │            └─────────────────┘
                    │                   │
                    │         ┌─────────┴─────────┐
                    │         ▼                   ▼
                    │   ┌───────────┐       ┌───────────┐
                    │   │ TIER 2:   │       │ TIER 1:   │
                    │   │ Knowledge │       │ ChunkNode │
                    │   │ Graph     │──────▶│ Fallback  │
                    │   │ (Graphiti)│ if    │ (Neo4j)   │
                    │   └───────────┘ empty └───────────┘
                    │         │                   │
                    │         └─────────┬─────────┘
                    │                   │
                    │                   ▼
                    │            ┌─────────────────┐
                    │            │ VOYAGE RERANK   │  ← Merge & rank results
                    │            └─────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ GENERATE        │  ← LLM with context
                       │ RESPONSE        │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ DETECT          │  ← Find facts to persist
                       │ WRITE-BACK      │
                       └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │ EXECUTE         │  ← Index to Graphiti
                       │ WRITE-BACK      │
                       └─────────────────┘
                              │
                              ▼
                            END
```

---

## 5. Workflow Simulations

### Workflow 1: Document Upload & Initial Analysis

> **Updated 2026-01-05:** With E12.10, documents become queryable within ~5 seconds (fast path) while full entity extraction continues in background.

**Scenario:** Analyst uploads Q3 financial statements for TechFlow GmbH

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  📁 Data Room - TechFlow GmbH                                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📤 Drop files here or click to upload                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  Recent Uploads:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📊 Q3_2024_Financials.xlsx                                  │   │
│  │  Status: ⏳ Processing...                                     │   │
│  │  ├── ✅ Uploaded to storage                                  │   │
│  │  ├── ✅ Parsing document                                     │   │
│  │  ├── ✅ Ready for questions (fast path)     ← NEW WITH E12.10│   │
│  │  ├── ⏳ Extracting entities (background)                     │   │
│  │  └── ⬚ Analyzing content                                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  💡 Document is ready for questions! Entity extraction continues.   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**~5 seconds after upload (NEW with E12.10):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Q3_2024_Financials.xlsx                                         │
│  Status: ✅ Queryable | ⏳ Enriching...                              │
│                                                                     │
│  🚀 Fast Path Complete:                                             │
│  ├── 15 chunks indexed for search                                   │
│  └── You can now ask questions about this document                  │
│                                                                     │
│  ⏳ Background Processing:                                          │
│  ├── Entity extraction: 40% complete                                │
│  └── ETA: ~2 minutes for full knowledge graph                       │
│                                                                     │
│  [Ask Questions] [View Raw Content]                                 │
└─────────────────────────────────────────────────────────────────────┘
```

**~3 minutes later (full extraction complete):**

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 Q3_2024_Financials.xlsx                                         │
│  Status: ✅ Complete                                                 │
│                                                                     │
│  📈 Extracted Insights:                                             │
│  ├── Revenue: €3.2M (+8% QoQ)                                       │
│  ├── EBITDA: €480K (15% margin)                                     │
│  ├── Gross Margin: 68%                                              │
│  └── 12 entities indexed to knowledge graph                         │
│                                                                     │
│  ⚠️ 2 items need attention:                                         │
│  ├── Potential contradiction: Revenue vs contract schedule          │
│  └── Missing: Q3 customer breakdown                                 │
│                                                                     │
│  [View Details] [Ask Questions] [Add to CIM]                        │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Document Upload → Query Ready (~5s) → Full Analysis (~3 min)

T+0ms: User drops file
  │
  ├── Frontend: Upload to GCS bucket
  ├── Frontend: Create document record in Supabase
  └── Frontend: Enqueue "document-parse" job to pg-boss

T+500ms: Parse job starts
  │
  ├── Worker: Download file from GCS
  ├── Worker: Docling parses Excel
  │   ├── Extract sheets (P&L, Balance Sheet, Cash Flow)
  │   ├── Preserve formulas and cell references
  │   └── Convert to structured chunks
  └── Worker: Store chunks in PostgreSQL

T+5000ms: Parse complete, trigger PARALLEL jobs (E12.10)
  │
  ├─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  ┌─────────────────────┐        ┌─────────────────────┐        │
  │  │   "embed-chunks"    │        │  "ingest-graphiti"  │        │
  │  │   (FAST PATH)       │        │  (DEEP PATH)        │        │
  │  │   ~5 seconds        │        │  ~2-3 min/chunk     │        │
  │  └─────────────────────┘        └─────────────────────┘        │
  │           │                              │                      │
  │           ▼                              ▼                      │
  │  ┌─────────────────────┐        ┌─────────────────────┐        │
  │  │ Voyage embeddings   │        │ LLM entity extract  │        │
  │  │ Write ChunkNodes    │        │ Entity resolution   │        │
  │  │ to Neo4j            │        │ Write Entity/Edges  │        │
  │  └─────────────────────┘        └─────────────────────┘        │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

T+10000ms: Fast path complete ✅ QUERYABLE
  │
  ├── Worker: Send WebSocket "fast_path_complete"
  ├── Frontend: Show "Ready for questions" badge
  └── User can now query document via Tier 1 retrieval

T+180000ms: Graphiti complete, trigger "analyze-document" job
  │
  ├── Worker: Gemini 2.5 Flash analysis
  │   ├── Financial metric extraction
  │   ├── Trend detection (QoQ, YoY)
  │   ├── Anomaly flagging
  │   └── Contradiction detection vs existing knowledge
  ├── Worker: Store findings in Neo4j with confidence scores
  └── Worker: Mark memory files as stale

T+210000ms: Analysis complete ✅ FULL INSIGHTS
  │
  ├── Worker: Send WebSocket "analysis_complete"
  └── Frontend: Update UI with full results

T+240000ms: Background job regenerates memory files
  │
  ├── Job: Query Neo4j for financial entities
  ├── Job: LLM generates financial-summary.md
  └── Job: Store in deal memory folder
```

#### Current vs. Improved (LangGraph)

| Aspect | Current | Improved with LangGraph |
|--------|---------|------------------------|
| Processing | pg-boss sequential jobs | ✅ Same (works well) |
| Entity extraction | Gemini via API | StateGraph node with checkpoints |
| Contradiction detection | Single-pass | Multi-pass with human review checkpoint |
| Memory files | ❌ Not implemented | Background regeneration job |
| Real-time updates | WebSocket notification | Streaming progress via `astream_events()` |

---

### Workflow 2: Analyst Chat with Knowledge Retrieval

> **Updated 2026-01-05:** With E12.10, retrieval uses two-tier strategy. Tier 2 (Knowledge Graph) for rich entity context, Tier 1 (ChunkNodes) as fallback for recently uploaded documents.

**Scenario:** Analyst asks about revenue trends after reading documents

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  💬 Chat - TechFlow GmbH                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  👤 Analyst:                                                        │
│  "What's the revenue trend over the last 4 quarters?"               │
│                                                                     │
│  🤖 Manda: (typing...)                                              │
│  ████████░░░░░░░░ Loading context...                                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**2 seconds later:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  🤖 Manda:                                                          │
│                                                                     │
│  Revenue has grown consistently over the last 4 quarters:           │
│                                                                     │
│  | Quarter | Revenue | QoQ Growth |                                 │
│  |---------|---------|------------|                                 │
│  | Q4 2023 | €2.6M   | +5%        |                                 │
│  | Q1 2024 | €2.8M   | +8%        |                                 │
│  | Q2 2024 | €3.0M   | +7%        |                                 │
│  | Q3 2024 | €3.2M   | +7%        |                                 │
│                                                                     │
│  **Key observations:**                                              │
│  - Consistent 6-8% QoQ growth indicates healthy momentum            │
│  - Annual run rate: €12.8M (based on Q3 annualized)                │
│  - Growth acceleration in Q1 driven by enterprise deals             │
│                                                                     │
│  📎 Sources:                                                        │
│  - Q3_2024_Financials.xlsx (Sheet: P&L, Cell B4)                   │
│  - Q2_2024_Financials.xlsx (Sheet: P&L, Cell B4)                   │
│  - Management_Presentation.pdf (Page 12)                            │
│                                                                     │
│  💡 Follow-up: Want me to analyze the drivers of Q1 acceleration?   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Query → Response (2.1 seconds)

T+0ms: User sends message
  │
  └── Frontend: POST /api/projects/{id}/chat

T+50ms: Intent Classification
  │
  ├── Semantic Router: Embed query with Voyage voyage-3-lite
  ├── Compare against intent examples (cosine similarity)
  ├── Result: "factual" (confidence: 0.89)
  └── Decision: Trigger retrieval

T+100ms: Memory File Selection (future enhancement)
  │
  ├── Intent "factual" + keyword "revenue" → select financial-summary.md
  ├── Load memory file from storage (cached in Redis)
  └── Token count: 1,200 tokens

T+150ms: Coverage Check
  │
  ├── Parse query: "revenue trend", "4 quarters"
  ├── Check memory file: Has Q2-Q3 data, missing Q4 2023, Q1 2024
  └── Decision: Need targeted retrieval for Q4 2023, Q1 2024

T+200ms: Two-Tier Retrieval (E12.10)
  │
  ├── TIER 2 FIRST: Graphiti Knowledge Graph
  │   ├── Hybrid search: "TechFlow revenue Q4 2023 Q1 2024"
  │   ├── Vector search on Entity/Edge nodes
  │   ├── BM25 keyword: Filter for exact quarter matches
  │   ├── Graph traversal: Related entities
  │   └── Result: Found Q2-Q3 entities with relationships
  │
  ├── TIER 1 FALLBACK: ChunkNode Search (if needed)
  │   ├── Check: Are all quarters covered by Tier 2?
  │   ├── Gap detected: Q4 2023, Q1 2024 not in knowledge graph yet
  │   ├── Vector search on ChunkNodes for missing data
  │   └── Result: Raw chunk content from recently uploaded docs
  │
  └── MERGE RESULTS
      ├── Tier 2 entities: Rich context with relationships
      ├── Tier 1 chunks: Raw content for recent uploads
      └── Voyage rerank: Select top 5 combined

T+400ms: Context Assembly
  │
  ├── System prompt: 400 tokens
  ├── Memory file (financial-summary.md): 1,200 tokens
  ├── Targeted retrieval results: 600 tokens
  ├── Conversation history (last 5 turns): 800 tokens
  └── Total context: 3,000 tokens ✅ (vs 6-8K without memory files)

T+500ms: LLM Generation (streaming)
  │
  ├── Claude/GPT processes context
  ├── Stream tokens via SSE
  └── Duration: 1,500ms

T+2000ms: Response Complete
  │
  ├── Extract sources from tool calls
  ├── Generate follow-up suggestions
  └── Stream final response chunk

T+2100ms: Write-Back Detection
  │
  ├── Parse response for new facts
  ├── Found: "Annual run rate: €12.8M" (synthesized fact)
  ├── Queue for Graphiti ingest
  └── Mark financial-summary.md for refresh

[BACKGROUND - T+5000ms]
  │
  ├── Graphiti ingest: "TechFlow annual run rate €12.8M"
  ├── Entity resolution: Link to existing Company node
  └── Memory file regeneration triggered
```

#### Current vs. Improved Comparison

| Aspect | Current | Improved with Memory Files |
|--------|---------|---------------------------|
| Context tokens | 6-8K | 3K (60% reduction) |
| Retrieval latency | 500ms (full search) | 200ms (targeted only) |
| Response time | 3-4s | 2s |
| Write-back | ❌ None | ✅ Automatic |
| Follow-ups | Basic | Memory-aware |

---

### Workflow 3: Analyst Provides New Information

**Scenario:** Analyst tells the system something learned from a call

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  💬 Chat - TechFlow GmbH                                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  👤 Analyst:                                                        │
│  "Just got off a call with the CFO. They're expecting Q4 revenue    │
│  of €3.5M, which would be 9% growth. Also, they mentioned the       │
│  main driver is a new enterprise contract with BMW worth €400K."    │
│                                                                     │
│  🤖 Manda:                                                          │
│                                                                     │
│  Got it! I've noted the following from your call:                   │
│                                                                     │
│  📊 **Financial Update:**                                           │
│  - Q4 2024 revenue projection: €3.5M (+9% QoQ)                      │
│  - This accelerates growth from 7% average                          │
│                                                                     │
│  🏢 **New Contract:**                                               │
│  - Customer: BMW                                                    │
│  - Value: €400K                                                     │
│  - Type: Enterprise contract                                        │
│                                                                     │
│  ✅ Added to knowledge base with source: "CFO Call - Jan 5, 2026"   │
│                                                                     │
│  ⚠️ Note: This projection would bring annual revenue to €12.5M,     │
│  slightly below the €12.8M run rate I calculated earlier.           │
│  Want me to reconcile this?                                         │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Message → Knowledge Indexed (3 seconds)

T+0ms: User sends message
  │
  └── Frontend: POST /api/projects/{id}/chat

T+50ms: Intent Classification
  │
  ├── Semantic Router: "factual" intent detected
  ├── Sub-classification: "fact_provision" (user providing info)
  └── Decision: Generate response + execute write-back

T+100ms: Memory File Selection
  │
  ├── Select: financial-summary.md, customer-analysis.md
  └── Load for context (check for contradictions)

T+200ms: LLM Generation
  │
  ├── Prompt includes: "User is providing new facts. Acknowledge,
  │   structure the information, and check for contradictions
  │   against existing knowledge."
  ├── Context: Memory files + conversation history
  └── Generate acknowledgment with structured facts

T+1500ms: Write-Back Detection
  │
  ├── Parse response for fact candidates:
  │   ├── Fact 1: Q4 2024 revenue projection €3.5M
  │   ├── Fact 2: Q4 growth rate 9%
  │   ├── Fact 3: BMW enterprise contract €400K
  │   └── Source: "CFO Call - Jan 5, 2026"
  └── Queue all for Graphiti ingest

T+1600ms: Write-Back Execution (parallel)
  │
  ├── POST /api/graphiti/ingest
  │   ├── Fact 1: Create Revenue node, link to TechFlow, Q4 2024
  │   ├── Fact 2: Create Growth node, link to Revenue
  │   ├── Fact 3: Create Contract node, link to BMW (new), TechFlow
  │   └── Entity resolution: BMW → create new Company node
  └── All facts get source attribution: "Analyst Note: CFO Call"

T+2500ms: Contradiction Check
  │
  ├── Compare: New projection (€12.5M annual) vs calculated (€12.8M)
  ├── Difference: 2.4% → flag as minor discrepancy
  └── Include in response as observation

T+3000ms: Memory File Invalidation
  │
  ├── Mark stale: financial-summary.md, customer-analysis.md
  └── Queue background regeneration

[BACKGROUND - T+10000ms]
  │
  ├── Regenerate financial-summary.md with Q4 projection
  ├── Regenerate customer-analysis.md with BMW contract
  └── Store updated files
```

#### The Key Improvement: Autonomous Write-Back

**Current behavior:** Facts mentioned in chat are NOT persisted. Next session, the system doesn't remember.

**Improved behavior:**
1. Agent automatically detects facts in user messages
2. Extracts entities and relationships
3. Calls Graphiti ingest without user confirmation
4. Memory files updated to include new facts
5. Future queries retrieve this information

---

### Workflow 4: CIM Builder - Creating a Slide

**Scenario:** Analyst builds a "Market Opportunity" slide for the CIM

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  📑 CIM Builder - TechFlow GmbH                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐  ┌─────────────────────────┐  ┌─────────────────┐ │
│  │  SOURCES    │  │      CONVERSATION       │  │    PREVIEW      │ │
│  │             │  │                         │  │                 │ │
│  │ 📊 Q3 Fin   │  │ 🤖 Let's build your    │  │  [Wireframe]    │ │
│  │ 📊 Q2 Fin   │  │ Market Opportunity     │  │                 │ │
│  │ 📄 Mgmt Pres│  │ slide.                 │  │  ┌───────────┐  │ │
│  │ 📄 Market   │  │                         │  │  │ TAM/SAM/  │  │ │
│  │    Research │  │ Based on your deal     │  │  │   SOM     │  │ │
│  │             │  │ thesis targeting       │  │  └───────────┘  │ │
│  │ ─────────── │  │ strategic buyers, I    │  │                 │ │
│  │             │  │ recommend focusing on: │  │  Market Size:   │ │
│  │ Key Findings│  │                         │  │  €2.1B TAM     │ │
│  │ • Revenue   │  │ 1. Large addressable   │  │  18% CAGR      │ │
│  │   €3.2M     │  │    market (€2.1B TAM)  │  │                 │ │
│  │ • Growth 8% │  │ 2. Strong growth (18%) │  │  [Regenerate]   │ │
│  │ • BMW deal  │  │ 3. Underserved segment │  │                 │ │
│  │             │  │                         │  │                 │ │
│  │             │  │ 📎 Sources: Market     │  │                 │ │
│  │             │  │ Research.pdf (p.4-7)   │  │                 │ │
│  │             │  │                         │  │                 │ │
│  │             │  │ 👤 Looks good, but can │  │                 │ │
│  │             │  │ you add the competitor │  │                 │ │
│  │             │  │ landscape?             │  │                 │ │
│  │             │  │                         │  │                 │ │
│  └─────────────┘  └─────────────────────────┘  └─────────────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Slide Request → Content Generated (4 seconds)

T+0ms: User in CIM Builder, requests "Market Opportunity" slide
  │
  └── Frontend: POST /api/projects/{id}/cims/{cimId}/chat

T+50ms: CIM Agent State Loaded
  │
  ├── Load CIM workflow state from PostgreSQL
  │   ├── Current phase: "slides"
  │   ├── Buyer persona: "Strategic (Industry Player)"
  │   ├── Investment thesis: "Platform for European expansion"
  │   └── Approved outline: 12 slides
  └── Load CIM-specific memory context

T+100ms: Slide Context Assembly
  │
  ├── Load memory files:
  │   ├── deal-thesis.md (buyer persona, thesis)
  │   ├── company-profile.md (market context)
  │   └── open-questions.md (gaps to avoid)
  ├── Load slide dependencies:
  │   └── Previous slides (Executive Summary, Company Overview)
  └── Total context: 3,500 tokens

T+200ms: Targeted Retrieval for Slide Topic
  │
  ├── Query: "market size TAM SAM SOM growth CAGR addressable"
  ├── Graphiti search with reranking
  ├── Top 5 results from Market_Research.pdf
  └── Token count: 800 tokens

T+400ms: CIM Agent Tool Calls
  │
  ├── Tool: queryKnowledgeBaseTool (market data)
  ├── Tool: generateSlideContentTool
  │   ├── Input: slide_topic, narrative_context, sources
  │   └── Output: 3 content options ranked by fit
  └── Tool: checkNarrativeCompatibilityTool
      └── Verify slide fits approved outline

T+1500ms: LLM Generates Content Options
  │
  ├── Option A: TAM/SAM/SOM focus (recommended for strategic)
  ├── Option B: Growth trajectory focus
  └── Option C: Competitive positioning focus

T+2500ms: Preview Generation
  │
  ├── Generate wireframe layout
  ├── Stream to right panel
  └── Include source citations

T+3000ms: State Checkpoint
  │
  ├── LangGraph checkpoint: Save current state
  ├── PostgreSQL: Update cims.workflow_state
  └── Enable resume if browser closes

T+4000ms: Response Complete
  │
  └── Wait for user approval or iteration
```

#### LangGraph CIM Workflow StateGraph

```python
# Current implementation (simplified)
workflow = StateGraph(CIMAgentState)
  .addNode('welcome', welcomeNode)
  .addNode('router', routerNode)
  .addNode('agent', agentNode)
  .addNode('error_handler', errorHandlerNode)
  .addNode('phase_transition', phaseTransitionNode)
  .addEdge(START, 'welcome')
  .addEdge('welcome', 'router')
  .addConditionalEdges('router', shouldContinue, {...})
```

**Improvement:** Add memory file integration to agent node:

```python
# Enhanced with memory files
def agentNode(state: CIMAgentState) -> CIMAgentState:
    # Load CIM-specific memory files
    memory_files = load_memory_files(state.deal_id, [
        'deal-thesis.md',      # Always for CIM
        'company-profile.md',  # Always for CIM
        'financial-summary.md' # If slide needs financials
    ])

    # Add to context
    context = assemble_context(
        memory_files=memory_files,
        slide_dependencies=state.approved_slides,
        retrieval_results=state.retrieval_results
    )

    # Generate with enhanced context
    response = agent.invoke(context)

    return {**state, messages: [...state.messages, response]}
```

---

### Workflow 5: Proactive Insight Notification

**Scenario:** System detects a pattern and notifies the analyst

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  🔔 New Insight Detected                              [x] Dismiss   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ⚠️ Margin Compression Detected                                     │
│                                                                     │
│  Gross margin has declined for 3 consecutive quarters:              │
│                                                                     │
│  Q1 2024: 72% → Q2 2024: 70% → Q3 2024: 68%                        │
│                                                                     │
│  This 4 percentage point decline is significant and may indicate:   │
│  • Pricing pressure from competition                                │
│  • Rising COGS (materials, labor)                                   │
│  • Product mix shift to lower-margin offerings                      │
│                                                                     │
│  📊 Related findings:                                               │
│  • New competitor entered market Q1 (Market_Research.pdf, p.8)      │
│  • Raw material costs up 12% YoY (Mgmt_Presentation.pdf, p.15)      │
│                                                                     │
│  🎯 Recommended action:                                             │
│  Add this to Q&A list for management clarification                  │
│                                                                     │
│  [Explore] [Add to Q&A] [Add to Risk Register] [Dismiss]            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Background Analysis (runs every 30 minutes)

T+0ms: Background Analysis Job Triggered
  │
  └── Worker: Start pattern detection for deal

T+100ms: Load Memory Files + Recent Changes
  │
  ├── Load: financial-summary.md, risk-register.md
  ├── Query Neo4j: Nodes updated in last 30 minutes
  └── Build analysis context

T+500ms: Pattern Detection Engine
  │
  ├── Pattern Library (3 high-impact patterns for MVP):
  │   ├── MARGIN_COMPRESSION: 3+ quarters declining margin
  │   ├── CUSTOMER_CONCENTRATION: Top 3 > 50% revenue
  │   └── GROWTH_DECELERATION: QoQ growth declining trend
  │
  ├── Run MARGIN_COMPRESSION check:
  │   ├── Query: Get gross_margin for last 4 quarters
  │   ├── Data: [72%, 70%, 68%, ?]
  │   ├── Trend: Declining 3 consecutive quarters
  │   └── Result: TRIGGERED (confidence: 0.92)
  │
  └── Run other patterns...

T+2000ms: Insight Generation
  │
  ├── LLM: Generate human-readable insight
  ├── Include: Trend data, potential causes, related findings
  ├── Graphiti search: Find related facts (competitor, costs)
  └── Generate recommended actions

T+3000ms: Store Insight
  │
  ├── PostgreSQL: Insert into insights table
  │   ├── type: "margin_compression"
  │   ├── severity: "warning"
  │   ├── confidence: 0.92
  │   ├── data: {trend, causes, related_findings}
  │   └── status: "pending_review"
  └── Update risk-register.md memory file

T+3500ms: Notify User
  │
  ├── WebSocket: Push notification to connected clients
  └── Frontend: Display notification banner

[NEXT BACKGROUND RUN - T+30min]
  │
  └── Pattern already triggered → skip unless new data
```

#### LangGraph Background Agent

```python
class BackgroundAnalysisAgent:
    """Runs periodically to detect patterns and surface insights"""

    patterns = [
        MarginCompressionPattern(),
        CustomerConcentrationPattern(),
        GrowthDecelerationPattern(),
    ]

    async def analyze(self, deal_id: str) -> list[Insight]:
        # Load current state
        memory_files = await load_memory_files(deal_id)
        recent_facts = await get_recent_facts(deal_id, hours=1)

        insights = []
        for pattern in self.patterns:
            if pattern.should_check(memory_files, recent_facts):
                result = await pattern.detect(deal_id)
                if result.triggered:
                    insight = await self.generate_insight(result)
                    insights.append(insight)

        return insights

    async def generate_insight(self, pattern_result) -> Insight:
        # LLM generates human-readable insight
        prompt = f"""
        Pattern detected: {pattern_result.type}
        Data: {pattern_result.data}

        Generate a clear, actionable insight for an M&A analyst.
        Include: what was detected, why it matters, recommended actions.
        """
        return await llm.generate(prompt)
```

---

### Workflow 6: Resuming Work After 2 Weeks

**Scenario:** Analyst returns to a deal after vacation

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  💬 Chat - TechFlow GmbH                           Last active: 14d │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  🤖 Manda:                                                          │
│                                                                     │
│  Welcome back! Here's what's happened since Dec 22:                 │
│                                                                     │
│  📥 **New Documents (3):**                                          │
│  • Q4_Forecast_Updated.xlsx - Processed ✅                          │
│  • Customer_Contracts_Summary.pdf - Processed ✅                    │
│  • Management_Responses_Q&A.docx - Processed ✅                     │
│                                                                     │
│  🔔 **Insights Detected (2):**                                      │
│  • ⚠️ Q4 forecast revised down 5% from CFO projection               │
│  • ✅ BMW contract confirmed, signed Dec 28                         │
│                                                                     │
│  📊 **Knowledge Base:**                                             │
│  • 47 new facts indexed                                             │
│  • 3 contradictions resolved                                        │
│  • 2 open questions remaining                                       │
│                                                                     │
│  📑 **CIM Status:**                                                 │
│  • 8/12 slides drafted                                              │
│  • Last: "Financial Performance" slide                              │
│  • [Resume CIM Builder]                                             │
│                                                                     │
│  What would you like to focus on?                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Session Resume (500ms)

T+0ms: User opens deal
  │
  └── Frontend: GET /api/projects/{id}/status

T+50ms: Load Deal Context
  │
  ├── PostgreSQL: Get deal metadata, last_active timestamp
  ├── Calculate: days_since_active = 14
  └── Decision: Show "welcome back" summary

T+100ms: Query Changes Since Last Active
  │
  ├── Documents: WHERE created_at > last_active
  ├── Insights: WHERE created_at > last_active AND status = 'pending'
  ├── Facts: COUNT(*) WHERE created_at > last_active
  └── CIM: Get workflow state, completed slides

T+200ms: Load Memory Files
  │
  ├── All memory files current (background jobs kept them updated)
  ├── No cold start needed
  └── Agent has full context immediately

T+300ms: Generate Welcome Summary
  │
  ├── LLM: Summarize changes in user-friendly format
  ├── Prioritize: New insights > new documents > stats
  └── Include actionable next steps

T+500ms: Display to User
  │
  └── Full context restored, ready to work
```

#### The Key Improvement: Persistent Memory

**Current behavior:**
- Agent starts fresh each session
- User must re-explain context
- Previous findings not accessible

**Improved behavior:**
- Memory files maintain full context
- Background jobs kept knowledge current
- Insights detected even while analyst away
- Resume exactly where left off

---

## 5.5 Decision Framework: Quick vs Deep Responses

A key question you raised: **When do we invoke quick responses vs deep thinking?**

### Response Strategy Matrix

| Query Type | Intent | Memory Files | Retrieval | Thinking Mode | Example |
|------------|--------|--------------|-----------|---------------|---------|
| Greeting | `greeting` | None | Skip | Quick | "Hi, how are you?" |
| System question | `meta` | None | Skip | Quick | "What can you do?" |
| Simple fact lookup | `factual` | 1 file | Skip if covered | Quick | "What's the revenue?" |
| Multi-fact synthesis | `factual` | 2-3 files | Targeted | Medium | "Revenue trend over 4 quarters?" |
| Analysis request | `task` | 2-3 files | Full | Deep | "Analyze customer concentration risk" |
| Pattern detection | `task` | All relevant | Full + cross-ref | Deep | "Find contradictions in financials" |
| CIM content | `task` | deal_thesis + topic | Full + rerank | Deep | "Generate Market Opportunity slide" |

### Decision Flow

```
User Query
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ STEP 1: INTENT CLASSIFICATION                       │
│ Semantic router (50ms) → confidence score           │
│ If confidence < 0.7 → LLM fallback (500ms)         │
└─────────────────────────────────────────────────────┘
    │
    ├── greeting/meta ──────────────────────────────────▶ QUICK RESPONSE
    │                                                     (No retrieval, <1s)
    │
    └── factual/task
          │
          ▼
┌─────────────────────────────────────────────────────┐
│ STEP 2: COMPLEXITY ASSESSMENT                       │
│ - Keyword analysis (revenue, trend, analyze, etc.) │
│ - Question structure (single vs compound)          │
│ - Historical context (follow-up vs new topic)      │
└─────────────────────────────────────────────────────┘
    │
    ├── Simple (single fact) ────────────────────────────▶ QUICK + MEMORY FILE
    │                                                     (1 file, <2s)
    │
    ├── Medium (multi-fact synthesis) ───────────────────▶ MEDIUM + TARGETED
    │                                                     (2-3 files + retrieval, 2-3s)
    │
    └── Complex (analysis/pattern) ──────────────────────▶ DEEP + FULL CONTEXT
                                                          (All files + retrieval + reasoning, 3-5s)
```

### Complexity Signals

**Quick Response Signals:**
- Single entity query ("What is X?")
- Recent context available (follow-up question)
- High memory file coverage (>80%)
- No comparison or trend analysis needed

**Deep Thinking Signals:**
- Multiple entities or time periods
- Analysis verbs: "analyze", "compare", "find", "detect"
- Contradiction or pattern keywords: "inconsistent", "trend", "risk"
- CIM or Q&A creation context
- Low memory file coverage (<50%)

### Token Budget by Response Type

| Response Type | Context Budget | Generation Budget | Total |
|---------------|----------------|-------------------|-------|
| Quick | 500 tokens | 500 tokens | 1K |
| Quick + Memory | 1,500 tokens | 1,000 tokens | 2.5K |
| Medium | 3,000 tokens | 1,500 tokens | 4.5K |
| Deep | 5,000 tokens | 2,000 tokens | 7K |

### Implementation: Complexity Classifier

```typescript
interface ComplexityResult {
  level: 'quick' | 'medium' | 'deep';
  memoryFilesNeeded: MemoryFileType[];
  retrievalNeeded: boolean;
  reasoningNeeded: boolean;
  estimatedTokens: number;
}

function assessComplexity(
  query: string,
  intent: Intent,
  conversationContext: Message[]
): ComplexityResult {
  // Quick signals
  const isFollowUp = conversationContext.length > 0 &&
    isSameTopicAsLast(query, conversationContext);
  const isSingleEntity = countEntities(query) === 1;
  const hasAnalysisVerb = /analyze|compare|find|detect|assess/i.test(query);
  const hasTimeRange = /trend|over time|quarters|years|growth/i.test(query);

  if (intent === 'greeting' || intent === 'meta') {
    return { level: 'quick', memoryFilesNeeded: [], retrievalNeeded: false, ... };
  }

  if (isSingleEntity && !hasAnalysisVerb && !hasTimeRange) {
    return { level: 'quick', memoryFilesNeeded: [selectPrimaryFile(query)], ... };
  }

  if (hasAnalysisVerb || hasTimeRange) {
    return { level: 'deep', memoryFilesNeeded: selectAllRelevant(query), ... };
  }

  return { level: 'medium', memoryFilesNeeded: selectTopFiles(query, 2), ... };
}
```

---

## 6. LangGraph Implementation

### State Schema

```python
from typing import TypedDict, Annotated
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages

class ChatAgentState(TypedDict):
    # Core conversation
    messages: Annotated[list, add_messages]

    # Deal context
    deal_id: str
    deal_name: str

    # Intent routing
    intent: str  # greeting | meta | factual | task
    intent_confidence: float

    # Memory management
    memory_files_loaded: list[str]
    memory_file_contents: dict[str, str]

    # Retrieval
    retrieval_needed: bool
    retrieval_query: str
    retrieval_results: list[dict]

    # Write-back
    pending_write_back: list[dict]
    write_back_executed: bool

    # Observability
    token_usage: dict[str, int]
    latency_ms: dict[str, int]
```

### Node Implementations

```python
# Node 1: Intent Classification
@traceable(name="classify_intent")
async def classify_intent(state: ChatAgentState) -> ChatAgentState:
    """Classify user intent to determine routing"""

    last_message = state["messages"][-1].content

    # Try semantic classification first
    intent, confidence = await semantic_router.classify(last_message)

    # LLM fallback for low confidence
    if confidence < 0.7:
        intent, confidence = await llm_classify_intent(last_message)

    return {
        **state,
        "intent": intent,
        "intent_confidence": confidence,
        "retrieval_needed": intent in ["factual", "task"]
    }

# Node 2: Memory File Selection
@traceable(name="select_memory_files")
async def select_memory_files(state: ChatAgentState) -> ChatAgentState:
    """Select which memory files to load based on intent and query"""

    if not state["retrieval_needed"]:
        return state

    query = state["messages"][-1].content
    intent = state["intent"]

    # Intent-based selection
    file_map = {
        "factual": ["company-profile.md", "financial-summary.md"],
        "task": ["company-profile.md", "deal-thesis.md", "open-questions.md"],
    }

    # Keyword enhancement
    if "revenue" in query.lower() or "ebitda" in query.lower():
        files = ["financial-summary.md"]
    elif "customer" in query.lower() or "contract" in query.lower():
        files = ["customer-analysis.md"]
    elif "risk" in query.lower() or "red flag" in query.lower():
        files = ["risk-register.md"]
    else:
        files = file_map.get(intent, ["company-profile.md"])

    # Load files
    contents = {}
    for f in files:
        contents[f] = await load_memory_file(state["deal_id"], f)

    return {
        **state,
        "memory_files_loaded": files,
        "memory_file_contents": contents
    }

# Node 3: Targeted Retrieval
@traceable(name="targeted_retrieval")
async def targeted_retrieval(state: ChatAgentState) -> ChatAgentState:
    """Query Neo4j only for gaps not covered by memory files"""

    if not state["retrieval_needed"]:
        return state

    query = state["messages"][-1].content
    memory_content = "\n".join(state["memory_file_contents"].values())

    # Check if memory files can answer
    coverage = await check_coverage(query, memory_content)

    if coverage > 0.8:
        # Memory files sufficient
        return {**state, "retrieval_results": []}

    # Need targeted retrieval
    results = await graphiti_search(
        query=query,
        group_id=state["deal_id"],
        limit=5
    )

    # Rerank results
    reranked = await voyage_rerank(query, results)

    return {**state, "retrieval_results": reranked[:3]}

# Node 4: Generate Response
@traceable(name="generate_response")
async def generate_response(state: ChatAgentState) -> ChatAgentState:
    """Generate LLM response with assembled context"""

    # Assemble context
    context_parts = []

    # Add memory files
    for name, content in state["memory_file_contents"].items():
        context_parts.append(f"## {name}\n{content}")

    # Add retrieval results
    if state["retrieval_results"]:
        context_parts.append("## Additional Context")
        for r in state["retrieval_results"]:
            context_parts.append(f"- {r['content']} (Source: {r['source']})")

    context = "\n\n".join(context_parts)

    # Generate response
    response = await llm.generate(
        system=SYSTEM_PROMPT,
        context=context,
        messages=state["messages"]
    )

    return {
        **state,
        "messages": [*state["messages"], response]
    }

# Node 5: Write-Back Detection
@traceable(name="detect_write_back")
async def detect_write_back(state: ChatAgentState) -> ChatAgentState:
    """Detect facts in user message and response to persist"""

    candidates = []

    # Check user message for facts
    user_message = state["messages"][-2].content
    user_facts = await extract_facts(user_message)
    candidates.extend(user_facts)

    # Check agent response for synthesized facts
    agent_response = state["messages"][-1].content
    synthesized_facts = await extract_synthesized_facts(agent_response)
    candidates.extend(synthesized_facts)

    return {**state, "pending_write_back": candidates}

# Node 6: Execute Write-Back
@traceable(name="execute_write_back")
async def execute_write_back(state: ChatAgentState) -> ChatAgentState:
    """Index detected facts to Graphiti"""

    if not state["pending_write_back"]:
        return {**state, "write_back_executed": False}

    for fact in state["pending_write_back"]:
        await graphiti_ingest(
            content=fact["content"],
            source=fact["source"],
            group_id=state["deal_id"]
        )

    # Invalidate affected memory files
    await invalidate_memory_files(
        state["deal_id"],
        affected_files=determine_affected_files(state["pending_write_back"])
    )

    return {**state, "write_back_executed": True}
```

### Graph Assembly

```python
# Build the graph
workflow = StateGraph(ChatAgentState)

# Add nodes
workflow.add_node("classify_intent", classify_intent)
workflow.add_node("select_memory", select_memory_files)
workflow.add_node("retrieve", targeted_retrieval)
workflow.add_node("generate", generate_response)
workflow.add_node("detect_write_back", detect_write_back)
workflow.add_node("execute_write_back", execute_write_back)

# Add edges
workflow.add_edge(START, "classify_intent")
workflow.add_conditional_edges(
    "classify_intent",
    lambda s: "select_memory" if s["retrieval_needed"] else "generate"
)
workflow.add_edge("select_memory", "retrieve")
workflow.add_edge("retrieve", "generate")
workflow.add_edge("generate", "detect_write_back")
workflow.add_edge("detect_write_back", "execute_write_back")
workflow.add_edge("execute_write_back", END)

# Compile with checkpointer
from langgraph.checkpoint.postgres import PostgresSaver
checkpointer = PostgresSaver(connection_string=DATABASE_URL)

app = workflow.compile(checkpointer=checkpointer)
```

---

## 7. LangSmith Observability

> **Implementation Status:** E12.11 (5 points, P2) - See [Epic E12](sprint-artifacts/epics/epic-E12.md#e1211-langsmith-observability)
>
> **Current State:** Not enabled. Token counts are estimated (chars/4), no trace visualization.
>
> **Quick Start:** LangChain.js auto-traces when env vars are set - zero code changes required for basic tracing.

### Tracing Configuration (TypeScript - Actual Implementation)

```typescript
// Environment variables (.env.local)
// LANGSMITH_TRACING=true
// LANGSMITH_API_KEY=lsv2_pt_xxx
// LANGSMITH_PROJECT=manda-platform
// LANGSMITH_ENDPOINT=https://api.smith.langchain.com

// For serverless (Vercel): ensure traces complete
// LANGCHAIN_CALLBACKS_BACKGROUND=false

// For local dev: background processing for lower latency
// LANGCHAIN_CALLBACKS_BACKGROUND=true

// Auto-tracing: createReactAgent and streamEvents automatically
// send traces when LANGSMITH_TRACING=true. No code changes needed.

// Optional: Custom metadata for filtering
const eventStream = agent.streamEvents(
  { messages },
  {
    version: 'v2',
    metadata: {
      deal_id: dealId,
      user_id: userId,
      organization_id: orgId,
    }
  }
)
```

### Python Backend (Conceptual - for future pydantic-ai integration)

```python
# Enable tracing via environment
# LANGSMITH_TRACING=true
# LANGSMITH_API_KEY=lsv2_pt_xxx
# LANGSMITH_PROJECT=manda-platform

# Every node automatically traced via @traceable decorator
from langsmith import traceable

@traceable(name="my_node", metadata={"version": "1.0"})
async def my_node(state):
    # Execution automatically logged to LangSmith
    pass
```

### Custom Metrics

```python
from langsmith import Client

client = Client()

async def log_custom_metrics(run_id: str, state: ChatAgentState):
    """Log custom metrics after each conversation turn"""

    # Token efficiency
    client.create_feedback(
        run_id=run_id,
        key="token_usage",
        value={
            "memory_files": state["token_usage"].get("memory", 0),
            "retrieval": state["token_usage"].get("retrieval", 0),
            "generation": state["token_usage"].get("generation", 0),
            "total": sum(state["token_usage"].values())
        }
    )

    # Memory file hit rate
    client.create_feedback(
        run_id=run_id,
        key="memory_hit_rate",
        value=1.0 if not state["retrieval_results"] else 0.5
    )

    # Write-back activity
    client.create_feedback(
        run_id=run_id,
        key="write_back_count",
        value=len(state["pending_write_back"])
    )
```

### Evaluation Datasets

```yaml
# evaluation_config.yaml
datasets:
  - name: manda_intent_classification
    description: Test intent classification accuracy
    examples:
      - input: "Hi, how are you?"
        expected_intent: "greeting"
      - input: "What was Q3 revenue?"
        expected_intent: "factual"
      - input: "Analyze the customer concentration"
        expected_intent: "task"

  - name: manda_retrieval_quality
    description: Test retrieval relevance
    examples:
      - query: "What is TechFlow's EBITDA margin?"
        expected_sources: ["Q3_Financials.xlsx"]
        expected_answer_contains: ["15%", "margin"]

  - name: manda_write_back_detection
    description: Test fact extraction from messages
    examples:
      - input: "Revenue was $10M in Q3"
        expected_facts:
          - entity: "Revenue"
            value: "$10M"
            period: "Q3"
```

### Dashboard Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Response latency (P95) | < 3s | > 5s |
| Token per query | < 4K | > 6K |
| Memory file hit rate | > 70% | < 50% |
| Retrieval relevance | > 0.8 | < 0.6 |
| Write-back accuracy | > 95% | < 90% |
| Intent classification accuracy | > 90% | < 80% |
| Error rate | < 1% | > 5% |

---

## 8. Implementation Roadmap

> **Updated 2026-01-05:** Added E12.10 (Fast Path Retrieval) as prerequisite before memory files. Reordered Phase 1 to prioritize immediate document querying.

### Phase 0: Fast Path Retrieval (E12.10) - NOW IN PROGRESS

| Story | Points | Description | Status |
|-------|--------|-------------|--------|
| E12.10 | 8 | Fast Path Document Retrieval - Two-tier architecture | 📋 Planned |

**Deliverables:**
- Documents queryable within ~5 seconds of upload
- ChunkNodes in Neo4j with Voyage embeddings
- Two-tier retrieval (Tier 1: ChunkNodes, Tier 2: Knowledge Graph)
- No user-facing wait for entity extraction

**Reference:** [Sprint Change Proposal 2026-01-05](sprint-artifacts/sprint-change-proposal-2026-01-05.md)

---

### Phase 1: Foundation (2-3 weeks)

| Story | Points | Description |
|-------|--------|-------------|
| MF-1 | 5 | Design memory file schema and storage |
| MF-2 | 8 | Implement memory file generator for financial-summary, company-profile |
| MF-3 | 5 | Integrate memory file loading into chat agent |
| WB-1 | 5 | Implement write-back detection in agent |
| WB-2 | 5 | Integrate Graphiti ingest endpoint |
| LS-1 | 3 | Enable LangSmith tracing for all nodes |
| CP-1 | 3 | Replace MemorySaver with PostgreSQL checkpointer |

**Deliverables:**
- Memory files generated for each deal
- Chat agent loads memory files based on intent
- Facts from conversations persist to Neo4j
- Full observability in LangSmith

### Phase 2: Intelligence (2-3 weeks)

| Story | Points | Description |
|-------|--------|-------------|
| PA-1 | 8 | Background analysis agent infrastructure |
| PA-2 | 5 | Implement 3 pattern detectors (margin, concentration, growth) |
| PA-3 | 5 | Insight notification system |
| CR-1 | 8 | Enhanced contradiction resolution workflow |

**Deliverables:**
- Proactive insights surface automatically
- Analysts notified of patterns
- Contradictions handled with confidence scores

### Phase 3: Optimization (2 weeks)

| Story | Points | Description |
|-------|--------|-------------|
| TO-1 | 5 | Intent-to-memory-file routing optimization |
| TO-2 | 3 | LangSmith evaluation dashboard |
| TO-3 | 5 | Retrieval quality tuning based on metrics |
| TO-4 | 3 | Token budget enforcement and alerts |

**Deliverables:**
- < 3s P95 response time
- < 4K tokens per query
- Quality metrics tracked and improving

---

## Appendix A: Key Files Reference

### Current Implementation
- `manda-app/lib/agent/executor.ts` - Chat agent with `createReactAgent`
- `manda-app/lib/agent/cim/workflow.ts` - CIM Builder StateGraph
- `manda-app/lib/agent/intent.ts` - Semantic router
- `manda-app/lib/agent/retrieval.ts` - Graphiti pre-model hook
- `manda-processing/src/llm/pydantic_agent.py` - Backend Pydantic AI agents

### Documentation
- `docs/manda-prd.md` - Product requirements
- `docs/manda-architecture.md` - Technical architecture
- `docs/agent-behavior-spec.md` - Agent behavior specifications
- `docs/sprint-change-proposal-2025-12-15.md` - E10 knowledge graph pivot

---

## Appendix B: TypeScript Implementation Notes

The Python code examples in this document are **conceptual**. Actual implementation will be in TypeScript for the frontend agent. Key adaptations:

```typescript
// TypeScript equivalent of ChatAgentState
interface ChatAgentState {
  messages: BaseMessage[];
  dealId: string;
  dealName: string;
  intent: 'greeting' | 'meta' | 'factual' | 'task';
  intentConfidence: number;
  memoryFilesLoaded: string[];
  memoryFileContents: Record<string, MemoryFileContent>;
  retrievalNeeded: boolean;
  retrievalResults: RetrievalResult[];
  pendingWriteBack: FactCandidate[];
  writeBackExecuted: boolean;
}

// Memory file content structure
interface MemoryFileContent {
  type: MemoryFileType;
  version: number;
  tokenCount: number;
  data: Record<string, unknown>;  // Structured, not markdown
  lastRegenerated: Date;
}

// Where code runs:
// - Chat Agent (manda-app): TypeScript, runs in Next.js API routes
// - Memory File Generation (manda-processing): Python, runs as pg-boss job
// - Write-Back Ingestion (manda-processing): Python, calls Graphiti API
```

---

## Appendix C: Additional Workflow Simulations

### Workflow 7: Q&A Co-Creation

**Scenario:** Analyst builds Q&A list with AI assistance after client requests clarifications

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  📋 Q&A Builder - TechFlow GmbH                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────┐  ┌─────────────────────────────────┐  │
│  │     Q&A LIST (12)       │  │         CHAT ASSISTANT          │  │
│  │                         │  │                                 │  │
│  │ ✅ Revenue recognition  │  │ 🤖 Based on your knowledge      │  │
│  │    policy               │  │ base, I've identified 5         │  │
│  │ ✅ Customer contract    │  │ questions buyers will likely    │  │
│  │    terms                │  │ ask:                            │  │
│  │ ⏳ EBITDA adjustments   │  │                                 │  │
│  │ ⏳ Working capital      │  │ **High Priority:**              │  │
│  │    normalization        │  │ 1. Why did gross margin drop    │  │
│  │ ❌ Management incentive │  │    4pp in 2024? (risk_register) │  │
│  │    structure            │  │                                 │  │
│  │                         │  │ 2. What's the customer churn    │  │
│  │ ─────────────────────── │  │    rate? (open_questions)       │  │
│  │                         │  │                                 │  │
│  │ 💡 Suggested (5):       │  │ 3. Explain the BMW contract     │  │
│  │ • Gross margin decline  │  │    economics (customer_analysis)│  │
│  │ • Customer churn rate   │  │                                 │  │
│  │ • BMW contract terms    │  │ **Medium Priority:**            │  │
│  │ • R&D capitalization    │  │ 4. R&D capitalization policy?   │  │
│  │ • Debt covenants        │  │ 5. Current debt covenant status?│  │
│  │                         │  │                                 │  │
│  │ [+ Add Question]        │  │ [Add All] [Add Selected]        │  │
│  └─────────────────────────┘  └─────────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**User clicks "Add All", then types a custom question:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  👤 Analyst:                                                        │
│  "Add a question about the technology stack and any technical       │
│  debt. Also, I spoke with the CTO who said they're planning a       │
│  cloud migration in Q2 2025 that will cost €500K."                  │
│                                                                     │
│  🤖 Manda:                                                          │
│                                                                     │
│  Added Q&A item:                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ **Q: What is the current technology stack and are there     │   │
│  │ any significant technical debt items?**                      │   │
│  │                                                              │   │
│  │ 📝 Draft Answer (from knowledge base):                       │   │
│  │ "TechFlow runs on AWS with a React/Node.js stack. Key        │   │
│  │ technical debt items include legacy payment integration      │   │
│  │ and database migration needs."                               │   │
│  │ Source: Technical_Assessment.pdf (p.12-15)                   │   │
│  │                                                              │   │
│  │ [Edit Answer] [Approve] [Request More Info]                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ✅ Also noted: Cloud migration planned Q2 2025, budget €500K       │
│  Added to knowledge base with source: "CTO conversation"            │
│                                                                     │
│  💡 This is relevant to the technical debt question - should I      │
│  incorporate it into the draft answer?                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Q&A Suggestion → Question Added (4 seconds)

T+0ms: User opens Q&A Builder
  │
  └── Frontend: GET /api/projects/{id}/qa

T+50ms: Load Q&A Context
  │
  ├── Load memory files:
  │   ├── open_questions.md (gaps and unresolved items)
  │   ├── risk_register.md (issues buyers will probe)
  │   └── financial_summary.md (numbers that need explanation)
  ├── Load existing Q&A items from database
  └── Calculate: What's answered vs what's missing?

T+200ms: Generate Q&A Suggestions
  │
  ├── LLM Prompt:
  │   "Based on these knowledge gaps and risks, generate 5 questions
  │   a sophisticated M&A buyer would ask. Prioritize by:
  │   1. Items flagged in risk_register (must address)
  │   2. Items in open_questions (gaps in knowledge)
  │   3. Anomalies in financial_summary (need explanation)"
  │
  ├── Cross-reference with existing Q&A (avoid duplicates)
  └── Return ranked suggestions with source attribution

T+1500ms: Display Suggestions
  │
  └── Frontend: Show suggestions with "Add" buttons

--- USER INTERACTION ---

T+0ms: User sends message with custom question + new fact
  │
  └── Frontend: POST /api/projects/{id}/qa/chat

T+50ms: Intent Classification
  │
  ├── Detect dual intent:
  │   ├── "Add a question about..." → Q&A creation task
  │   └── "CTO said..." → Fact provision
  └── Route: Create Q&A + Execute write-back

T+100ms: Q&A Question Generation
  │
  ├── Load memory file: operational_overview.md (for tech context)
  ├── Graphiti search: "technology stack technical debt"
  ├── Generate question text and draft answer
  └── Include source citations

T+1500ms: Write-Back Detection
  │
  ├── Fact detected: "Cloud migration Q2 2025, €500K"
  ├── Source: "CTO conversation"
  ├── Entity extraction:
  │   ├── Event: Cloud Migration
  │   ├── Date: Q2 2025
  │   ├── Cost: €500K
  │   └── Source: CTO
  └── Queue for Graphiti ingest

T+2000ms: Write-Back Execution
  │
  ├── Graphiti ingest: Cloud migration fact
  ├── Link to: TechFlow (company), Technology (topic)
  ├── Mark stale: operational_overview.md
  └── Detect relevance to current question

T+2500ms: Context Connection
  │
  ├── LLM determines: New fact relevant to tech debt question
  ├── Offer to incorporate into draft answer
  └── Update Q&A item status

T+3000ms: Database Updates
  │
  ├── Insert Q&A item to qa_items table
  ├── Status: "draft"
  ├── Link sources
  └── Notify frontend via WebSocket

T+4000ms: Response Complete
  │
  └── Display Q&A item with edit options
```

#### Current vs. Improved

| Aspect | Current | Improved with Memory Files |
|--------|---------|---------------------------|
| Q&A suggestions | Basic keyword matching | Memory-driven prioritization from risk_register |
| Draft answers | Retrieval only | Memory file context + targeted retrieval |
| Fact capture | Manual entry | Automatic write-back from conversation |
| Cross-referencing | None | New facts linked to relevant Q&A items |

---

### Workflow 8: IRL Gap Resolution

**Scenario:** System identifies missing IRL items and helps analyst prioritize follow-ups

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  📊 IRL Tracker - TechFlow GmbH                          Coverage: 72% │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  FINANCIAL (14/18 items)                              78%   │   │
│  │  ├── ✅ Annual financial statements (2021-2024)            │   │
│  │  ├── ✅ Monthly management accounts                         │   │
│  │  ├── ✅ Budget vs actual analysis                           │   │
│  │  ├── ❌ Quality of earnings analysis                        │   │
│  │  ├── ❌ Working capital analysis                            │   │
│  │  ├── ❌ Debt schedule with covenants                        │   │
│  │  └── ❌ Tax returns (last 3 years)                          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  OPERATIONAL (8/12 items)                             67%   │   │
│  │  ├── ✅ Organizational chart                                │   │
│  │  ├── ✅ Employee roster                                     │   │
│  │  ├── ❌ Key employee contracts                              │   │
│  │  └── ❌ IT systems inventory                                │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  🔔 **Proactive Insight:**                                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ 4 Critical Items Missing for CIM                        │   │
│  │                                                              │   │
│  │  Based on your deal thesis (strategic buyer focus), these   │   │
│  │  gaps will likely block CIM completion:                     │   │
│  │                                                              │   │
│  │  1. **Quality of Earnings** - Required for EBITDA bridge    │   │
│  │     → Blocks: Financial Performance slide                   │   │
│  │                                                              │   │
│  │  2. **Working Capital Analysis** - Needed for valuation     │   │
│  │     → Blocks: Transaction Structure slide                   │   │
│  │                                                              │   │
│  │  3. **Key Employee Contracts** - Strategic buyers check     │   │
│  │     → Blocks: Management Team slide                         │   │
│  │                                                              │   │
│  │  4. **Debt Schedule** - Covenant status needed              │   │
│  │     → Blocks: Financial Performance slide                   │   │
│  │                                                              │   │
│  │  [Generate Follow-Up Email] [Add to Q&A] [Dismiss]          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**User clicks "Generate Follow-Up Email":**

```
┌─────────────────────────────────────────────────────────────────────┐
│  📧 Draft Follow-Up Email                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  To: [CFO Email]                                                    │
│  Subject: TechFlow - Outstanding IRL Items (4 Critical)             │
│                                                                     │
│  Dear [CFO Name],                                                   │
│                                                                     │
│  Thank you for the materials provided to date. To complete our      │
│  analysis and prepare the CIM, we require the following items:      │
│                                                                     │
│  **Critical (blocking CIM preparation):**                           │
│                                                                     │
│  1. Quality of Earnings Analysis                                    │
│     - Required for: EBITDA bridge and adjustment schedule           │
│     - Format: Excel workbook with supporting documentation          │
│                                                                     │
│  2. Working Capital Analysis                                        │
│     - Required for: Normalized working capital calculation          │
│     - Format: Monthly WC for trailing 12 months                     │
│                                                                     │
│  3. Key Employee Contracts                                          │
│     - Required for: Management retention analysis                   │
│     - Format: Contracts for C-suite and key technical leads         │
│                                                                     │
│  4. Debt Schedule with Covenant Status                              │
│     - Required for: Capital structure and covenant compliance       │
│     - Format: Current debt summary with covenant calculations       │
│                                                                     │
│  Please let us know if you have any questions.                      │
│                                                                     │
│  [Copy to Clipboard] [Send via Integration] [Edit]                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: IRL Gap Analysis (runs on document upload + scheduled)

T+0ms: Trigger IRL Analysis
  │
  ├── Trigger conditions:
  │   ├── New document uploaded (check if fills gap)
  │   ├── Scheduled (daily at 9am)
  │   └── User opens IRL Tracker
  └── Start background analysis job

T+100ms: Load IRL Template + Uploaded Documents
  │
  ├── PostgreSQL: Load IRL items for deal
  ├── PostgreSQL: Load all documents with metadata
  ├── Load memory files:
  │   ├── deal_thesis.md (buyer type → priorities)
  │   └── company_profile.md (context for matching)
  └── Build analysis context

T+300ms: Document-to-IRL Matching
  │
  ├── For each uploaded document:
  │   ├── Extract document type from metadata
  │   ├── LLM classification: Which IRL items does this satisfy?
  │   ├── Confidence scoring (>80% = matched)
  │   └── Update IRL item status
  │
  ├── Example matches:
  │   ├── "Q3_2024_Financials.xlsx" → "Quarterly financial statements" ✅
  │   ├── "Org_Chart_2024.pdf" → "Organizational chart" ✅
  │   └── "Board_Minutes.pdf" → No clear match (flag for review)
  │
  └── Calculate overall coverage percentage

T+1000ms: Gap Prioritization
  │
  ├── Load deal_thesis.md:
  │   └── Buyer type: "Strategic (Industry Player)"
  │
  ├── Prioritize gaps by buyer type:
  │   ├── Strategic buyers care about: Operations, IP, Key employees
  │   ├── Financial buyers care about: QoE, Working capital, Debt
  │   └── Both care about: Financials, Legal
  │
  ├── Cross-reference with CIM outline:
  │   ├── Which CIM slides are blocked by missing items?
  │   └── Generate dependency map
  │
  └── Rank: Critical → Important → Nice-to-have

T+2000ms: Generate Insight
  │
  ├── LLM prompt:
  │   "Based on deal thesis (strategic buyer) and CIM outline,
  │   identify which missing IRL items are blocking CIM completion.
  │   Explain the impact of each gap."
  │
  ├── Generate actionable insight text
  └── Include specific blocking relationships

T+3000ms: Store Results
  │
  ├── PostgreSQL: Update IRL item statuses
  ├── PostgreSQL: Insert insight (type: "irl_gap")
  ├── Update memory file: open_questions.md
  └── WebSocket: Notify connected clients

--- USER CLICKS "Generate Follow-Up Email" ---

T+0ms: Email Generation Request
  │
  └── Frontend: POST /api/projects/{id}/irl/follow-up-email

T+100ms: Load Context for Email
  │
  ├── Load gap analysis results
  ├── Load deal contacts (CFO email, name)
  ├── Load previous correspondence (tone matching)
  └── Load IRL item specifications (format requirements)

T+500ms: Generate Email
  │
  ├── LLM prompt:
  │   "Generate a professional follow-up email requesting these
  │   IRL items. Be specific about format requirements and explain
  │   why each item is needed. Tone: Professional, slightly urgent."
  │
  ├── Include:
  │   ├── Personalized greeting (CFO name)
  │   ├── Context (CIM preparation)
  │   ├── Specific items with format requirements
  │   └── Clear call to action
  │
  └── Return draft email

T+1500ms: Display Email
  │
  └── Frontend: Show email in modal with edit options
```

#### Current vs. Improved

| Aspect | Current | Improved with Memory Files |
|--------|---------|---------------------------|
| Gap detection | Manual review of IRL | Automatic document-to-IRL matching |
| Prioritization | None | Deal thesis-driven (buyer type aware) |
| CIM blocking | Unknown | Explicit dependency tracking |
| Follow-up emails | Manual drafting | AI-generated with context |

---

### Workflow 9: Document Analysis with Findings Capture

**Scenario:** Analyst reads a document and captures findings via chat

#### What the User Sees

```
┌─────────────────────────────────────────────────────────────────────┐
│  📄 Document Viewer - Management_Presentation.pdf                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐  │
│  │      PDF VIEWER (p.15/42)   │  │      ANALYSIS CHAT          │  │
│  │                             │  │                             │  │
│  │  ┌─────────────────────┐   │  │ 👤 Analyst:                 │  │
│  │  │  REVENUE GROWTH     │   │  │ "Interesting - page 15      │  │
│  │  │                     │   │  │ shows they're projecting    │  │
│  │  │  2024: €12.5M (+18%)│   │  │ 18% growth but the market   │  │
│  │  │  2025: €15.0M (+20%)│   │  │ research doc said the       │  │
│  │  │  2026: €18.5M (+23%)│   │  │ market is only growing 12%. │  │
│  │  │                     │   │  │ That's a red flag."         │  │
│  │  │  [Chart: Hockey     │   │  │                             │  │
│  │  │   stick growth]     │   │  │ 🤖 Manda:                   │  │
│  │  │                     │   │  │                             │  │
│  │  └─────────────────────┘   │  │ Good catch! I've noted:     │  │
│  │                             │  │                             │  │
│  │  Key Growth Drivers:        │  │ ⚠️ **Potential Red Flag:**  │  │
│  │  • Enterprise expansion     │  │ Revenue projection (18-23%) │  │
│  │  • New product launch Q2    │  │ significantly exceeds       │  │
│  │  • Geographic expansion     │  │ market growth (12%).        │  │
│  │                             │  │                             │  │
│  │  [◀ Prev] [Page 15] [Next ▶]│  │ 📎 Sources:                 │  │
│  │                             │  │ • Mgmt_Presentation.pdf:15  │  │
│  │                             │  │ • Market_Research.pdf:8     │  │
│  │                             │  │                             │  │
│  │                             │  │ ✅ Added to:                │  │
│  │                             │  │ • Risk Register             │  │
│  │                             │  │ • Open Questions            │  │
│  │                             │  │                             │  │
│  │                             │  │ 💡 Suggested Q&A:           │  │
│  │                             │  │ "How does management        │  │
│  │                             │  │ justify 18%+ growth in a    │  │
│  │                             │  │ 12% growth market?"         │  │
│  │                             │  │                             │  │
│  │                             │  │ [Add to Q&A] [Explore]      │  │
│  └─────────────────────────────┘  └─────────────────────────────┘  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Analyst continues reading and adds more findings:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  👤 Analyst:                                                        │
│  "Page 23 has the customer breakdown. Top 3 customers are 45%       │
│  of revenue. The largest is BMW at 18%. Also note that customer     │
│  #2 (Siemens) has a contract expiring in 6 months."                 │
│                                                                     │
│  🤖 Manda:                                                          │
│                                                                     │
│  Captured the following findings:                                   │
│                                                                     │
│  📊 **Customer Concentration:**                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Customer      │ Revenue % │ Contract Status                 │   │
│  │───────────────│───────────│─────────────────────────────────│   │
│  │ BMW           │ 18%       │ Active (from earlier: €400K)    │   │
│  │ Siemens       │ 15%       │ ⚠️ Expiring in 6 months         │   │
│  │ Customer #3   │ 12%       │ Unknown                         │   │
│  │ **Top 3 Total**│ **45%** │                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ⚠️ **Risk Identified:** Customer concentration (45% in top 3)     │
│  is moderate-high. Siemens contract expiry adds renewal risk.       │
│                                                                     │
│  🔗 **Connected to existing knowledge:**                            │
│  • BMW contract €400K noted from CFO call (Jan 5)                   │
│  • This confirms BMW as largest customer                            │
│                                                                     │
│  ✅ Updated:                                                        │
│  • customer_analysis memory file                                    │
│  • risk_register (concentration + renewal risk)                     │
│                                                                     │
│  📎 Source: Management_Presentation.pdf (Page 23)                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Finding Capture → Knowledge Update (3 seconds)

T+0ms: User sends finding via chat
  │
  └── Frontend: POST /api/projects/{id}/documents/{docId}/chat
      └── Include: current_page: 15, document_context: visible text

T+50ms: Intent Classification
  │
  ├── Detect: "fact_provision" + "contradiction_flag"
  ├── Keywords: "red flag", "but", "only growing"
  └── Route: Capture finding + Check contradiction + Write-back

T+100ms: Load Context
  │
  ├── Memory files:
  │   ├── financial_summary.md (for growth numbers)
  │   ├── risk_register.md (to add new risk)
  │   └── open_questions.md (for follow-up)
  │
  ├── Document context:
  │   ├── Current document: Management_Presentation.pdf
  │   ├── Current page: 15
  │   └── Visible text (if OCR available)
  │
  └── Graphiti search: "market growth rate TechFlow"

T+300ms: Contradiction Detection
  │
  ├── User claim: "Projecting 18% growth but market is 12%"
  ├── Verify from knowledge:
  │   ├── Management projection: 18% (Mgmt_Presentation.pdf:15) ✓
  │   └── Market growth: 12% (Market_Research.pdf:8) ✓
  ├── Calculate gap: 6 percentage points
  ├── Assess: Significant discrepancy
  └── Flag as: Risk (growth_assumption_aggressive)

T+800ms: Entity Extraction
  │
  ├── Entities found:
  │   ├── Metric: Revenue Growth Projection
  │   ├── Value: 18%
  │   ├── Time: 2024
  │   ├── Contradiction: vs Market Growth 12%
  │   └── Source: Management_Presentation.pdf:15
  │
  └── Generate structured finding

T+1000ms: Write-Back Execution
  │
  ├── Graphiti ingest:
  │   ├── Fact: "TechFlow projects 18% revenue growth 2024"
  │   ├── Fact: "Growth projection exceeds market rate by 6pp"
  │   └── Relationship: CONTRADICTS market_growth_12_percent
  │
  ├── Mark stale:
  │   ├── financial_summary.md
  │   └── risk_register.md
  │
  └── Insert to risks table (PostgreSQL)

T+1500ms: Q&A Suggestion Generation
  │
  ├── LLM: Based on contradiction, suggest clarifying question
  ├── Draft: "How does management justify 18%+ growth..."
  └── Return as suggested follow-up

T+2000ms: Response Generation
  │
  ├── Acknowledge finding
  ├── Confirm contradiction with sources
  ├── Show what was updated
  └── Offer next actions

T+3000ms: Response Complete
  │
  └── Display with action buttons

--- SECOND MESSAGE (Customer Breakdown) ---

T+0ms: User provides customer data
  │
  └── Multi-fact provision detected

T+100ms: Entity Extraction (Multiple)
  │
  ├── Customer: BMW, 18% revenue
  ├── Customer: Siemens, 15% revenue, contract expiring 6mo
  ├── Customer: #3, 12% revenue
  ├── Aggregate: Top 3 = 45%
  └── Risk: Concentration + Renewal

T+500ms: Knowledge Connection
  │
  ├── Search existing knowledge: "BMW"
  ├── Found: BMW enterprise contract €400K (from CFO call)
  ├── Link: Confirm BMW as largest customer
  └── Enrich: BMW node with revenue percentage

T+800ms: Write-Back (Batch)
  │
  ├── Graphiti ingest (4 facts):
  │   ├── BMW: 18% of revenue
  │   ├── Siemens: 15% of revenue, contract expiring
  │   ├── Customer concentration: 45% top 3
  │   └── Renewal risk: Siemens 6 months
  │
  ├── Update relationships:
  │   └── BMW (Company) -[CUSTOMER_OF]-> TechFlow, revenue_pct: 18%
  │
  └── Mark stale: customer_analysis.md, risk_register.md

T+1500ms: Generate Structured Response
  │
  ├── Format as table (easier to read)
  ├── Show connections to existing knowledge
  ├── Highlight risks
  └── Confirm updates

T+2500ms: Response Complete
  │
  └── Display with table and update confirmation
```

#### Current vs. Improved

| Aspect | Current | Improved with Memory Files |
|--------|---------|---------------------------|
| Finding capture | Manual chat, not persisted | Automatic write-back to Neo4j |
| Contradiction detection | None | Real-time cross-reference with knowledge |
| Knowledge connection | None | Links new facts to existing entities |
| Document context | Lost between sessions | Page-level attribution preserved |
| Risk surfacing | Manual | Automatic risk categorization |

---

### Workflow 10: Multi-Analyst Collaboration

**Scenario:** Two analysts work on same deal simultaneously

#### What the User Sees (Analyst A)

```
┌─────────────────────────────────────────────────────────────────────┐
│  💬 Chat - TechFlow GmbH                     👥 Sarah also viewing  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  📢 Live Updates                                            │   │
│  │  • Sarah added: "Siemens contract renewal risk" (2min ago) │   │
│  │  • Sarah uploaded: Siemens_Contract.pdf (5min ago)          │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  👤 Analyst A (You):                                                │
│  "What do we know about the Siemens contract situation?"            │
│                                                                     │
│  🤖 Manda:                                                          │
│                                                                     │
│  Here's the current knowledge on Siemens:                           │
│                                                                     │
│  **Contract Status:**                                               │
│  • Revenue contribution: 15% (~€1.9M annually)                      │
│  • Contract expiry: June 2026 (6 months)                            │
│  • Renewal status: Negotiations not started                         │
│                                                                     │
│  **Recent Activity:** (from Sarah, 5 min ago)                       │
│  • Contract document uploaded and analyzed                          │
│  • Key finding: 90-day notice clause                                │
│  • Risk flag: No automatic renewal provision                        │
│                                                                     │
│  📎 Sources:                                                        │
│  • Siemens_Contract.pdf (uploaded by Sarah)                         │
│  • Management_Presentation.pdf:23 (your earlier finding)            │
│                                                                     │
│  ⚠️ This is a **shared risk** - both you and Sarah have flagged it. │
│  Want me to consolidate into a single risk register entry?          │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### What Happens in the Background

```
TIMELINE: Multi-User Knowledge Sync

T+0ms: Analyst A sends query
  │
  └── Context includes: user_id: analyst_a

T+50ms: Load Shared Memory Files
  │
  ├── Memory files are SHARED (PostgreSQL, deal-level)
  ├── customer_analysis.md includes Sarah's additions
  ├── risk_register.md includes Sarah's flags
  └── No user-specific filtering (all knowledge shared)

T+100ms: Load Recent Activity
  │
  ├── Query: Changes in last 24 hours by OTHER users
  ├── Filter: Same deal, different user_id
  └── Return: Sarah's uploads and findings

T+200ms: Attribution Tracking
  │
  ├── Each fact in Neo4j has:
  │   ├── created_by: user_id
  │   ├── created_at: timestamp
  │   └── source: document or "analyst_note"
  │
  └── Response includes attribution: "(from Sarah, 5 min ago)"

T+500ms: Conflict Detection
  │
  ├── Check: Did Sarah add conflicting information?
  ├── In this case: No conflict, complementary information
  └── If conflict: Flag for resolution

T+1000ms: Consolidation Suggestion
  │
  ├── Detect: Multiple analysts flagged same risk
  ├── Suggest: Consolidate into single entry
  └── Offer action button

T+1500ms: Response Complete
  │
  └── Display with collaboration indicators

--- WRITE OPERATIONS ---

When Analyst A adds a finding:
  │
  ├── Write-back includes: created_by: analyst_a
  ├── Memory file regeneration includes ALL facts (not user-filtered)
  ├── WebSocket: Notify Sarah of new finding
  └── No locking (optimistic concurrency)

Conflict Resolution:
  │
  ├── Strategy: Last-write-wins for same entity
  ├── Audit trail: All versions preserved in Neo4j (temporal)
  ├── Notification: "Sarah updated EBITDA margin (was 15%, now 14%)"
  └── Manual resolution option in UI
```

#### Collaboration Features

| Feature | Implementation |
|---------|---------------|
| **Real-time presence** | WebSocket shows who's viewing |
| **Activity feed** | Recent changes by other analysts |
| **Attribution** | Every fact tagged with creator |
| **Conflict detection** | Alert when same fact modified |
| **Consolidation** | Merge duplicate findings |
| **Audit trail** | Full history in Neo4j temporal model |

---

## Appendix D: Open Questions

| Question | Owner | Status |
|----------|-------|--------|
| Should memory files be markdown or structured JSON? | Architect | **Decision: JSONB** (queryable, typed) |
| How to handle memory file versioning for rollback? | Dev | Open |
| Should write-back require confidence threshold? | PM | Open (recommend: yes, >0.7) |
| How to test memory file coverage accuracy? | TEA | Open |
| Multi-tenant isolation for memory files? | Architect | Use `deal_id` + RLS |

---

*Document generated by Party Mode analysis session, January 5, 2026*
*Last refined: January 5, 2026*
