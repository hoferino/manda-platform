# Manda - M&A Intelligence Platform

**A comprehensive M&A intelligence platform that transforms how analysts work with complex deal information.**

> Manda is not just a chatbot, not just a data room, but a **platform with an intelligent conversational layer** - a persistent knowledge synthesizer that combines the organizational capabilities of a data room with the analytical power of a specialized AI agent.

## 📋 Project Overview

**Status:** In Development - Phase 1 Planning Complete
**Version:** PRD 1.3, Architecture 2.1, Epics 2.0
**Last Updated:** 2025-11-23

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
├── bmad/                          # BMAD Framework (Build Mad Agentic Delivery)
│   ├── core/                      # Core BMAD infrastructure
│   │   ├── agents/                # bmad-master agent
│   │   ├── workflows/             # party-mode, brainstorming
│   │   ├── tasks/                 # advanced-elicitation, index-docs
│   │   └── tools/                 # shard-doc
│   ├── bmm/                       # BMAD Method (Product Development)
│   │   ├── agents/                # pm, architect, dev, analyst, ux-designer, sm, tea, tech-writer, frame-expert
│   │   ├── workflows/             # prd, architecture, epics, dev-story, code-review, etc.
│   │   ├── docs/                  # Complete BMM documentation
│   │   ├── teams/                 # Team configurations
│   │   └── testarch/              # Test architecture knowledge base
│   ├── bmb/                       # BMAD Builder (Meta-Framework Development)
│   │   ├── agents/                # bmad-builder agent
│   │   └── workflows/             # create-workflow, create-agent, create-module, audit-workflow
│   ├── manda/                     # Manda-specific BMAD module
│   │   ├── agents/                # M&A-specific agents (coming soon)
│   │   ├── workflows/             # M&A-specific workflows (coming soon)
│   │   └── cim-templates/         # CIM templates
│   └── _cfg/                      # Framework configuration
│       ├── agents/                # Agent customization configs
│       ├── ides/                  # IDE-specific configs (Claude Code, Codex)
│       └── manifest files         # Component manifests
├── docs/                          # Manda Platform Documentation
│   ├── manda-prd.md              # Product Requirements Document (v1.3)
│   ├── manda-architecture.md      # Technical Architecture (v2.1)
│   ├── epics.md                   # Epic and Story Breakdown (v2.0)
│   ├── ux-design-specification.md # UX Design Specification
│   ├── frontend-development-plan.md
│   ├── implementation-readiness-report-2025-11-21.md
│   ├── validation-report-2025-11-19.md
│   └── brainstorming-session-results-2025-11-19.md
├── manda-standalone-poc/          # Proof of Concept for CIM v3 Workflow
│   ├── PRD-V2-SLASH-COMMANDS.md
│   ├── TEST-SIMULATION-RESULTS-V3.md
│   ├── data/test-company/         # Sample test data
│   ├── workflows/                 # POC workflow implementations
│   └── README.md                  # POC-specific documentation
├── .claude/                       # Claude Code Configuration
│   └── commands/                  # Slash commands
│       ├── manda-analyze.md       # Document analysis command
│       ├── manda-cim-company-overview-v3.md
│       └── bmad/                  # BMAD slash commands
└── README.md                      # This file
```

## 🚀 Key Features

### 1. Conversational Knowledge Base
- Semantic search (RAG via pgvector) across all deal documents
- Multi-source synthesis with confidence indicators
- Neo4j knowledge graph for relationship mapping
- Source attribution chains for transparency

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
- **[Product Requirements Document](docs/manda-prd.md)** - Complete product requirements (v1.3)
- **[Architecture Document](docs/manda-architecture.md)** - Technical architecture and implementation details (v2.1)
- **[Epics & Stories](docs/epics.md)** - Epic breakdown for implementation (v2.0, 9 epics, 60+ stories)

### Planning Documents
- **[UX Design Specification](docs/ux-design-specification.md)** - Complete UX design and interaction patterns
- **[Frontend Development Plan](docs/frontend-development-plan.md)** - Frontend implementation roadmap
- **[Implementation Readiness Report](docs/implementation-readiness-report-2025-11-21.md)** - Validation of PRD, Architecture, and Epics alignment

### Research & Validation
- **[Brainstorming Session Results](docs/brainstorming-session-results-2025-11-19.md)** - First principles analysis and cross-domain patterns
- **[Validation Report](docs/validation-report-2025-11-19.md)** - Quality validation of planning artifacts

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
- **Database:** PostgreSQL 18 (Supabase) with pgvector 0.8+
- **Graph DB:** Neo4j 2025.01 (knowledge graph, source attribution)
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
- **Embeddings:** Configurable (default: OpenAI text-embedding-3-large)
- **Provider Support:** Anthropic Claude, Google Gemini, OpenAI GPT, and more via LangChain

### Infrastructure
- **Deployment:** Docker Compose (development), Kubernetes (production)
- **Storage:** Local filesystem + S3-compatible object storage
- **Monitoring:** OpenTelemetry, Prometheus, Grafana

## 📊 Implementation Plan

### Phase 1: Foundation (Weeks 1-4) ✅ COMPLETE
- [x] PRD development and validation
- [x] Architecture design and review
- [x] Epic and story breakdown
- [x] UX design specification
- [x] CIM v3 workflow POC and testing

### Phase 2: Infrastructure (Weeks 5-8)
- [ ] Database setup (PostgreSQL + Neo4j)
- [ ] Authentication and user management
- [ ] Document storage and processing pipeline
- [ ] Background job system

### Phase 3: Core Features (Weeks 9-16)
- [ ] Conversational knowledge base with RAG
- [ ] Chat interface with agent integration
- [ ] Document upload and extraction
- [ ] Knowledge graph construction

### Phase 4: Advanced Features (Weeks 17-20)
- [ ] CIM Company Overview workflow (14 phases)
- [ ] IRL generation and management
- [ ] Q&A workspace
- [ ] Cross-domain intelligence patterns

### Phase 5: Polish & Testing (Weeks 21-24)
- [ ] End-to-end testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] User acceptance testing

## 🧪 POC: CIM v3 Workflow

The `manda-standalone-poc/` directory contains a proof-of-concept implementation of the CIM v3 workflow that was used to validate the approach before integration into the full platform.

**Key Results:**
- ✅ 20 successful test simulations demonstrating workflow viability
- ✅ Validated 14-phase structure with human-in-the-loop checkpoints
- ✅ Confirmed content-first, then visual approach
- ✅ Tested extreme visual precision validation
- ✅ Validated multi-format export functionality

See [manda-standalone-poc/TEST-SIMULATION-RESULTS-V3.md](manda-standalone-poc/TEST-SIMULATION-RESULTS-V3.md) for detailed results.

## 🤝 Contributing

This is a private project under active development. The BMAD framework used here is open for collaboration - reach out if you're interested in contributing to the framework or building with it.

## 📝 License

Proprietary - All Rights Reserved

## 📧 Contact

**Owner:** Max Hofer
**Email:** maxi.hoefer@gmx.net

---

*Built with the BMAD Framework - Agentic delivery for modern software development*

*Last Updated: 2025-11-23*
