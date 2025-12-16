# Manda Platform - Technical Overview for Co-Founders

**Created:** 2025-12-15
**Purpose:** Comprehensive platform description for co-founder discussions

---

## The One-Liner

**Manda is an AI-powered M&A intelligence platform that transforms how investment banking analysts work with deal documents** — turning weeks of manual document analysis into structured, queryable knowledge with AI-assisted deliverable creation.

---

## The Problem We're Solving

### The Pain: Information Overload in M&A Deals

Investment banking analysts spend **60-70% of their time** on manual document analysis:

1. **Massive Document Volumes**: Every M&A deal involves hundreds of documents — years of financials, multiple subsidiaries, legal contracts, market research, management presentations

2. **Scattered Knowledge**: Analysts extract findings manually, scatter them across Excel sheets, Word docs, emails, and their own memory. Weeks later: *"Where did I see that revenue number?"*

3. **Missing Critical Connections**: Important patterns get buried — contradictions between documents, red flags, cross-domain insights that require connecting financial data with operational metrics

4. **Time-Consuming Deliverables**: Creating CIMs (Confidential Information Memorandums), Q&A lists, and IRL tracking is repetitive manual work

### The Market

- **$40B+ investment banking M&A advisory market**
- Target users: M&A analysts at investment banks, PE firms, corporate development teams
- Each deal generates **$1-50M in fees** — even small efficiency gains justify premium pricing

---

## What Manda Does

### Core Value Proposition

**Manda is a persistent knowledge synthesizer** — not just a chatbot, not just a data room, but a platform that:

1. **Continuously processes documents in the background** — extracting facts, detecting patterns, building relationships
2. **Stores everything in a structured knowledge base** — queryable, with source attribution and confidence scores
3. **Provides an intelligent conversational interface** — analysts ask questions, get answers with citations
4. **Accelerates deliverable creation** — IRLs, Q&A lists, and CIMs are generated from the knowledge base

### Feature Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MANDA PLATFORM                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐                │
│  │  DATA ROOM  │   │  KNOWLEDGE  │   │    CHAT     │                │
│  │             │   │  EXPLORER   │   │  ASSISTANT  │                │
│  │ • Upload    │   │ • Browse    │   │ • Ask       │                │
│  │ • Organize  │   │ • Validate  │   │ • Query KB  │                │
│  │ • Version   │   │ • Correct   │   │ • Get cited │                │
│  │ • Link IRL  │   │ • Export    │   │   answers   │                │
│  └─────────────┘   └─────────────┘   └─────────────┘                │
│         │                 │                 │                        │
│         └────────────────────────────────────                        │
│                           │                                          │
│                  ┌────────▼────────┐                                 │
│                  │  KNOWLEDGE BASE │                                 │
│                  │  (PostgreSQL +  │                                 │
│                  │   Neo4j Graph)  │                                 │
│                  └────────┬────────┘                                 │
│                           │                                          │
│         ┌─────────────────┼─────────────────┐                        │
│         │                 │                 │                        │
│  ┌──────▼──────┐   ┌──────▼──────┐   ┌──────▼──────┐                │
│  │     IRL     │   │     Q&A     │   │     CIM     │                │
│  │  MANAGEMENT │   │ CO-CREATION │   │   BUILDER   │                │
│  │             │   │             │   │             │                │
│  │ • Templates │   │ • AI drafts │   │ • 14-phase  │                │
│  │ • Auto-gen  │   │ • Sources   │   │   workflow  │                │
│  │ • Progress  │   │ • Approve   │   │ • Persona   │                │
│  │ • Export    │   │ • Export    │   │ • Export    │                │
│  └─────────────┘   └─────────────┘   └─────────────┘                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### How It Works — User Journey

```
1. UPLOAD → Analyst uploads deal documents (Excel, PDF, Word)
                 ↓
2. PROCESS → Background AI extracts facts, detects patterns, builds graph
                 ↓
3. EXPLORE → Analyst browses findings, validates/corrects, searches
                 ↓
4. CHAT → "What's the revenue trend?" → Cited answer from knowledge base
                 ↓
5. DELIVER → AI generates IRLs, Q&As, CIM from accumulated knowledge
```

---

## Technical Architecture

### Stack Overview

```yaml
Frontend:
  - Next.js 15 (React 19) with App Router
  - Tailwind CSS 4 + shadcn/ui components
  - Zustand + TanStack Query for state
  - SSE streaming for real-time chat

Backend:
  - FastAPI (Python) for document processing
  - Next.js API routes for web gateway
  - pg-boss job queue (Postgres-based)

Data:
  - PostgreSQL 18 (Supabase) — transactional data, auth, RLS
  - Neo4j 5.26 — knowledge graph, relationships, contradictions
  - pgvector — semantic search (MVP, evolving to Graphiti)
  - Google Cloud Storage — document files

AI/ML:
  - LangChain 1.0 + LangGraph 1.0 — agent orchestration
  - Claude Sonnet 4.5 / Gemini Pro — conversation
  - Gemini 2.5 Flash — document extraction ($0.30/1M tokens)
  - OpenAI embeddings (MVP) → Voyage finance-2 (planned)
  - Docling (IBM) — PDF/Excel/Word parsing
```

### System Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        USER (Browser)                           │
└─────────────────────────────┬──────────────────────────────────┘
                              │
┌─────────────────────────────▼──────────────────────────────────┐
│                    NEXT.JS 15 FRONTEND                          │
│  React 19 + shadcn/ui + Tailwind + SSE streaming               │
└─────────────────────────────┬──────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
┌───────▼───────┐                         ┌─────────▼─────────┐
│  NEXT.JS API  │                         │  FASTAPI (Python) │
│    ROUTES     │                         │                   │
│               │                         │  Document parse   │
│  Chat, CRUD,  │ ──webhook──────────────▶│  Embedding gen    │
│  Auth, Upload │                         │  LLM analysis     │
└───────┬───────┘                         │  Graph updates    │
        │                                 └────────┬──────────┘
        │                                          │
        │         ┌───────────────────────────────┘
        │         │
┌───────▼─────────▼───────────────────────────────────────────┐
│                       DATA LAYER                             │
│                                                              │
│  ┌────────────────┐  ┌──────────────┐  ┌────────────────┐   │
│  │   PostgreSQL   │  │    Neo4j     │  │  Google Cloud  │   │
│  │   (Supabase)   │  │   (Graph)    │  │    Storage     │   │
│  │                │  │              │  │                │   │
│  │  • Deals       │  │  • Findings  │  │  • Documents   │   │
│  │  • Documents   │  │  • Relations │  │  • Signed URLs │   │
│  │  • Messages    │  │  • Patterns  │  │                │   │
│  │  • Embeddings  │  │  • Contra-   │  │                │   │
│  │  • Job Queue   │  │    dictions  │  │                │   │
│  └────────────────┘  └──────────────┘  └────────────────┘   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### AI Agent Architecture

The conversational assistant uses **LangGraph** with **11 specialized tools**:

```
User Message
    │
    ▼
┌─────────────────────────────────────────────────────┐
│              LANGGRAPH AGENT EXECUTOR               │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │           TOOL SELECTION (Claude)               ││
│  │                                                 ││
│  │  "What were Q3 revenues?" → search_findings    ││
│  │  "Create IRL for tech deal" → create_irl       ││
│  │  "Draft Q&A about revenue" → generate_qa       ││
│  └─────────────────────────────────────────────────┘│
│                        │                            │
│    ┌───────────────────┼───────────────────┐       │
│    │                   │                   │       │
│    ▼                   ▼                   ▼       │
│ ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│ │Knowledge │    │   IRL    │    │   Q&A    │      │
│ │  Tools   │    │  Tools   │    │  Tools   │      │
│ │          │    │          │    │          │      │
│ │• search  │    │• create  │    │• generate│      │
│ │• context │    │• update  │    │• update  │      │
│ │• contra- │    │• status  │    │          │      │
│ │  dict    │    │          │    │          │      │
│ └──────────┘    └──────────┘    └──────────┘      │
│                        │                           │
│                        ▼                           │
│  ┌─────────────────────────────────────────────┐  │
│  │      RESPONSE WITH CITATIONS (SSE Stream)   │  │
│  │                                             │  │
│  │  "Q3 revenues were $5.2M                    │  │
│  │   (source: financials.xlsx, P&L, B15)"     │  │
│  └─────────────────────────────────────────────┘  │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Knowledge Graph Model

```
                    ┌─────────────┐
                    │   DOCUMENT  │
                    │             │
                    │ • name      │
                    │ • type      │
                    │ • uploaded  │
                    └──────┬──────┘
                           │
              EXTRACTED_FROM
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   FINDING    │   │   FINDING    │   │   FINDING    │
│              │   │              │   │              │
│ "Revenue     │   │ "EBITDA      │   │ "Customer    │
│  $5.2M Q3"   │   │  margin 22%" │   │  conc. 40%" │
│              │   │              │   │              │
│ confidence:  │   │ confidence:  │   │ confidence:  │
│ 0.95         │   │ 0.88         │   │ 0.72         │
│              │   │              │   │              │
│ domain:      │   │ domain:      │   │ domain:      │
│ Financial    │   │ Financial    │   │ Operational  │
└──────┬───────┘   └──────┬───────┘   └──────────────┘
       │                  │
       │    RELATED_TO    │
       │◄─────────────────┘
       │
       │                  ┌──────────────┐
       │   CONTRADICTS    │   FINDING    │
       └─────────────────►│              │
                          │ "Revenue     │
                          │  $4.8M Q3"   │
                          │              │
                          │ source: old  │
                          │ doc.pdf      │
                          └──────────────┘
```

---

## Current Status

### MVP Complete (Phase 1) — 86 Stories Implemented

| Epic | Description | Status |
|------|-------------|--------|
| E1 | Project Foundation | ✅ Complete |
| E2 | Document Ingestion & Storage | ✅ Complete |
| E3 | Intelligent Document Processing | ✅ Complete |
| E4 | Knowledge Explorer | ✅ Complete |
| E5 | Conversational Assistant | ✅ Complete |
| E6 | IRL Management | ✅ Complete |
| E7 | Learning Loop | ✅ Complete |
| E8 | Q&A Co-Creation | ✅ Complete |
| E9 | CIM Builder | ✅ Complete |

**Development Timeline**: Nov 19 → Dec 11, 2025 (23 days)

### What's Built

- Full data room with folder organization and document linking
- Background document processing with Docling + Gemini
- Semantic search across all findings (pgvector)
- Knowledge graph with contradiction detection (Neo4j)
- Conversational chat with 11 tools and SSE streaming
- IRL templates, auto-generation, Excel import/export
- Q&A co-creation with AI drafting and source linking
- CIM Builder with 14-phase workflow and buyer persona targeting
- Learning loop — corrections feed back into the system

### Roadmap (Phase 2)

| Epic | Focus | Value |
|------|-------|-------|
| E10 | Knowledge Graph Foundation | Graphiti temporal graph, Voyage embeddings, hybrid retrieval |
| E11 | Agent Context Engineering | Better context management, smarter tool use |
| E12 | Smart Document Classification | AI-assisted auto-organization |
| E13 | Advanced Data Room | Versioning, collaboration |
| E14 | External Data Integration | Market data, public filings |
| E15 | Advanced CIM Features | Styled output, direct PowerPoint |

---

## Differentiation — Why This Wins

### vs. Generic AI (ChatGPT, Claude.ai)
- **Persistent knowledge** — doesn't start fresh each conversation
- **Source attribution** — every answer traces to document + page
- **Structured storage** — queryable database, not chat history
- **Background processing** — insights ready before you ask

### vs. Traditional Data Rooms (Intralinks, Datasite)
- **Intelligence layer** — not just file storage
- **Cross-document analysis** — patterns across 100s of docs
- **Conversational interface** — ask questions, get answers
- **Deliverable generation** — CIM, Q&A, IRL automated

### vs. M&A Software (Ansarada, DealRoom)
- **AI-native architecture** — built for LLMs from ground up
- **Knowledge graph** — relationships and contradictions
- **Continuous learning** — improves with analyst corrections
- **Modern stack** — not legacy enterprise software

---

## Summary

**What we're building**: An AI platform that transforms M&A due diligence from manual document review into intelligent knowledge management.

**Why it matters**: Investment bankers waste 60-70% of their time on repetitive analysis. Manda automates the mundane and surfaces insights humans miss.

**Where we are**: MVP complete with 9 core features (86 user stories). Working product that ingests documents, builds knowledge graphs, answers questions with citations, and generates deal deliverables.

**Tech stack**: Modern (Next.js 15, FastAPI, PostgreSQL, Neo4j, LangGraph) with AI at the core (Claude, Gemini, vector search).

**What's next**: Enhanced knowledge architecture (Graphiti), then customer validation and go-to-market.
