# Manda - M&A Intelligence Platform

**A comprehensive M&A intelligence platform that transforms how analysts work with complex deal information.**

> Manda is not just a chatbot, not just a data room, but a **platform with an intelligent conversational layer** - a persistent knowledge synthesizer that combines the organizational capabilities of a data room with the analytical power of a specialized AI agent.

## 📋 Project Overview

**Status:** In Development - Phase 1 MVP (Epics 1-6 Complete)
**Version:** PRD 1.9, Architecture 3.3, Epics 2.3
**Last Updated:** 2025-12-13

### What is Manda?

Manda is an AI-powered M&A intelligence platform designed for investment banking analysts that provides:

- **Conversational Knowledge Base:** Chat interface backed by semantic search (RAG) across all deal documents
- **Intelligent Document Processing:** Automated extraction, analysis, and relationship mapping with cross-domain intelligence patterns
- **CIM Creation Workflow:** 14-phase deeply interactive workflow for creating Company Overview chapters with extreme visual precision
- **Information Request List (IRL):** Template-based IRL generation with auto-population from knowledge base
- **Q&A Management:** Collaborative Q&A workspace with draft suggestions and version control
- **Learning Loop:** System learns from analyst corrections and tracks confidence scores

## 🗂️ Repository Structure

```
manda-platform/
├── manda-app/                     # Next.js 15 Frontend Application
│   ├── app/                       # App Router pages and API routes
│   ├── components/                # React components (shadcn/ui)
│   ├── lib/                       # Services, hooks, utilities
│   └── public/                    # Static assets
├── manda-processing/              # FastAPI Document Processing Service
│   ├── src/api/                   # REST endpoints, webhooks
│   ├── src/jobs/                  # pg-boss job handlers (parse, embed, analyze)
│   ├── src/llm/                   # LLM client (Gemini, OpenAI)
│   └── src/storage/               # GCS, Neo4j clients
├── docs/                          # Documentation (see docs/README.md)
│   ├── manda-prd.md              # Product Requirements Document (v1.9)
│   ├── manda-architecture.md      # Technical Architecture (v3.3)
│   ├── epics.md                   # Epic and Story Breakdown (v2.3)
│   ├── ux-design-specification.md # UX Design Specification
│   ├── testing/                   # Testing guide and archives
│   ├── sprint-artifacts/          # Tech specs, stories, retrospectives
│   └── archive/                   # Historical planning documents
├── bmad/                          # BMAD Framework
│   ├── bmm/                       # BMAD Method (agents, workflows)
│   ├── bmb/                       # BMAD Builder
│   ├── core/                      # Core infrastructure
│   └── manda/                     # Manda-specific module
└── .claude/                       # Claude Code configuration
```

## 🚀 Key Features

### 1. Conversational Knowledge Base
- Hybrid search (vector + BM25 + graph) via Graphiti + Neo4j
- Voyage voyage-3.5 embeddings with rerank-2.5 for accuracy
- Temporal knowledge graph with entity resolution
- Multi-source synthesis with confidence indicators
- Source attribution chains for transparency

> **Architecture Note (E10 - 2025-12-17):** Knowledge architecture consolidated from pgvector + Neo4j dual-database to unified Graphiti + Neo4j. See [Sprint Change Proposal 2025-12-15](docs/sprint-change-proposal-2025-12-15.md).

### 2. CIM Company Overview Creation (CIM v3 Workflow)
- **14-phase interactive workflow** for creating Company Overview chapters
- **Content-first, then visual** approach with separate approvals
- **Extreme visual precision:** ALL content elements positioned individually with specs
- **Buyer persona-driven narrative:** Strategic Buyer, Financial Buyer, or Custom
- **Investment thesis framework:** Asset, Timing, Opportunity
- **Non-linear navigation:** Jump between sections, go back, reorder
- **Special commands:** Navigation, analysis, and content commands throughout
- **Multi-format export:** Content MD, Slide Blueprints MD, Guide MD, LLM Prompt Template
- **Continuous balance checks:** After each section completion
- **Coherence validation:** Buyer's perspective review in Phase 12

### 3. Intelligent Document Processing
- Automated extraction with Gemini 3.0 Pro (2M context, thinking mode)
- 11 cross-domain intelligence patterns (Financial × Operational, Growth × Quality, etc.)
- Entity recognition and relationship mapping
- Pattern detection across deal artifacts

### 4. Information Request List (IRL)
- Template-based IRL generation by deal type
- Auto-population from knowledge base
- Gap identification and prioritization
- Version control and iteration tracking

### 5. Q&A Management
- Collaborative Q&A workspace
- AI-powered draft suggestions with source citations
- Approval workflow with version control
- Source provenance tracking

## 📖 Documentation

### Core Documents

- **[Documentation Index](docs/README.md)** - Navigation hub for all documentation
- **[Product Requirements Document](docs/manda-prd.md)** - Complete product requirements (v1.9)
- **[Architecture Document](docs/manda-architecture.md)** - Technical architecture (v3.3)
- **[Epics & Stories](docs/epics.md)** - Epic breakdown (v2.3, 9 epics, 86 stories)
- **[UX Design Specification](docs/ux-design-specification.md)** - Complete UX design

### Development Resources

- **[Testing & Operations Guide](docs/testing/testing-guide.md)** - Service setup, testing procedures, troubleshooting
- **[Sprint Artifacts](docs/sprint-artifacts/)** - Tech specs, stories, retrospectives

## 🏗️ BMAD Framework

This project is built using the **BMAD Framework** (Build Mad Agentic Delivery) - a comprehensive framework for AI-agent-assisted software development.

### BMAD Components Used

**BMM (BMAD Method)** - Product Development Framework
- Agents: PM, Architect, Dev, Analyst, UX Designer, Scrum Master, Test Engineer, Tech Writer, Frame Expert
- Workflows: PRD, Architecture, UX Design, Epic Creation, Story Development, Code Review, Retrospective
- Scale-adaptive system: Adjusts workflows based on project size and complexity

**BMB (BMAD Builder)** - Meta-Framework Development
- Create and edit BMAD agents, workflows, and modules
- Audit workflow quality and adherence to standards
- Generate comprehensive documentation (redoc)

**BMAD Core** - Foundation Infrastructure
- Party mode: Multi-agent collaborative discussions
- Advanced elicitation: Deep requirement discovery
- Brainstorming: Creative problem-solving sessions

### Documentation
- **[BMM Quick Start](bmad/bmm/docs/quick-start.md)**
- **[BMM Agents Guide](bmad/bmm/docs/agents-guide.md)**
- **[BMM Workflows Analysis](bmad/bmm/docs/workflows-analysis.md)**
- **[Brownfield Guide](bmad/bmm/docs/brownfield-guide.md)**
- **[Enterprise Agentic Development](bmad/bmm/docs/enterprise-agentic-development.md)**

## 🛠️ Technology Stack

### Backend
- **Framework:** FastAPI 0.121+ (Python 3.11+)
- **Transactional DB:** PostgreSQL 18 (Supabase) for deals, users, Q&A, conversations
- **Knowledge Graph:** Graphiti + Neo4j 5.26+ (embeddings, entity resolution, hybrid search)
- **Embeddings:** Voyage voyage-3.5 (1024d) with rerank-2.5
- **AI Framework:** LangChain 1.0 + LangGraph 1.0 (workflow orchestration, human-in-the-loop)
- **Type Safety:** Pydantic v2.12+ (structured outputs, validation)
- **LLM Integration:** LangChain adapters (model-agnostic, multi-provider support)

### Frontend
- **Framework:** Next.js 15 (App Router) with React 19.2
- **UI:** Tailwind CSS 4, shadcn/ui
- **State:** Zustand + React Query
- **Real-time:** WebSockets (chat), SSE (background processing)

### AI/ML (Model-Agnostic Configuration)
- **Conversation:** Configurable (default: Claude Sonnet 4.5 or Gemini 2.0 Pro)
- **Document Extraction:** Configurable (default: Gemini 2.0 Pro 2M context or Claude Opus 3)
- **Speed Tasks:** Configurable (default: Claude Haiku 4 or Gemini 2.0 Flash)
- **Embeddings:** Voyage voyage-3.5 (1024d, 32K context) — general-purpose, $0.06/1M tokens
- **Reranking:** Voyage rerank-2.5 (20-35% accuracy improvement)
- **Provider Support:** Anthropic Claude, Google Gemini, OpenAI GPT, Voyage AI, and more via LangChain

### Infrastructure
- **Deployment:** Docker Compose (development), Kubernetes (production)
- **Storage:** Local filesystem + S3-compatible object storage
- **Monitoring:** OpenTelemetry, Prometheus, Grafana

## 📊 Implementation Status

| Epic | Name | Status | Stories |
|------|------|--------|---------|
| E1 | Project Foundation | ✅ Complete | 9/9 |
| E2 | Document Ingestion & Storage | ✅ Complete | 8/8 |
| E3 | Intelligent Document Processing | ✅ Complete | 9/9 |
| E4 | Collaborative Knowledge Workflow | ✅ Complete | 13/13 |
| E5 | Conversational Assistant | ✅ Complete | 8/9 |
| E6 | IRL Management & Auto-Generation | ✅ Complete | 7/7 |
| E7 | Learning Loop | ✅ Complete | 6/6 |
| E8 | Q&A Co-Creation Workflow | ✅ Complete | 7/7 |
| E9 | CIM Builder | ✅ Complete | 15/15 |
| E10 | Knowledge Graph Foundation | ✅ Complete | 8/8 |
| E11 | Agent Context Engineering | In Progress | 0/7 |
| E12 | Testing & Stabilization | In Progress | 0/9 |

**Current Phase:** Phase 2 - Refinement Sprint (E11 Agent Context Engineering, E12 Testing & Stabilization)

## 🤝 Contributing

This is a private project under active development. The BMAD framework used here is open for collaboration - reach out if you're interested in contributing to the framework or building with it.

## 📝 License

Proprietary - All Rights Reserved

## 📧 Contact

**Owner:** Max Hofer
**Email:** maxi.hoefer@gmx.net

---

*Built with the BMAD Framework - Agentic delivery for modern software development*

*Last Updated: 2025-12-19*
