# M&A Deal Intelligence Platform

**Module Code:** `manda`
**Version:** 1.0.0
**Type:** Standard → Complex Module

## Overview

The M&A Deal Intelligence Platform is an intelligent agent framework designed specifically for investment bankers, M&A advisors, and corporate development teams. It revolutionizes deal execution through a storyline-first approach to document generation and intelligent information retrieval.

## Core Capabilities

- **Intelligent Information Retrieval** - Quick access to deal-relevant information through specialized agents
- **Storyline-First CIM Creation** - Revolutionary approach: develop narrative before slides
- **Due Diligence Automation** - Comprehensive data room analysis and validation
- **Inconsistency Detection** - Identify contradictions across multiple documents
- **Assumption Validation** - Cross-check user assumptions against knowledge base
- **Valuation & Financial Analysis** - Expert-driven financial modeling and analysis
- **Document Generation** - Teasers, CIMs, and other deal materials

## Architecture

### Agent System (5 Agents)

1. **Deal Orchestrator** (Module Agent)
   - Primary user interface
   - Routes requests to specialist agents
   - Coordinates multi-agent workflows

2. **Information Vault** (Backend Service)
   - High-speed data retrieval engine
   - Serves structured and unstructured data to specialists
   - No direct user interaction

3. **Company Analyst** (Expert Agent)
   - Business intelligence specialist
   - Products, patents, personnel, operations
   - Market positioning and competitive analysis

4. **Finance Analyst** (Expert Agent)
   - Financial analysis and valuation
   - Deal structuring and modeling
   - Quantitative due diligence

5. **Story Architect** (Expert Agent)
   - Narrative development for CIMs and marketing materials
   - Storyline-first document creation
   - Compelling deal positioning

### Workflow Philosophy

**No Forced Phases** - All workflows are independent, on-demand capabilities. Users can execute any workflow at any time without following a prescribed sequence. This mirrors the non-linear reality of M&A deal execution.

### Workflows

1. **data-room-audit** - Comprehensive data room analysis with inconsistency detection
   - Scans all documents in data room
   - Compares against M&A due diligence checklist
   - Identifies gaps and completeness by category
   - Runs cross-document inconsistency detection
   - Generates actionable next steps

2. **investment-storyline-workshop** - Interactive storyline development for CIMs
   - 5-act collaborative process (Discovery → Synthesis → Construction → Validation → Documentation)
   - Story-first philosophy: narrative before slides
   - Develops investment thesis and core themes
   - Creates evidence-mapped storyline
   - Generates teaser, storyline brief, and CIM outline

## Installation

```bash
# Install via BMAD installer
bmad install manda
```

During installation, you'll configure:
- Output locations for generated documents
- Data room integration settings
- Knowledge base paths
- Document templates

## Quick Start

```bash
# Activate the Deal Orchestrator
/manda:deal-orchestrator

# Run a data room audit
/manda:data-room-audit

# Develop an investment storyline
/manda:investment-storyline-workshop
```

## Directory Structure

```
bmad/manda/
├── agents/              # 5 specialist agents
├── workflows/           # Independent workflow capabilities
├── tasks/               # Shared utility tasks
├── cim-templates/       # CIM and marketing document templates
├── data/                # Knowledge base and reference data
├── _module-installer/   # Installation configuration
└── README.md           # This file
```

## Development Status

**Module Status:** ✅ MVP COMPLETE (100%)

**Core Components:**
- ✅ All 5 agents built and configured
- ✅ 2 MVP workflows complete (data-room-audit, investment-storyline-workshop)
- ✅ RAG architecture designed for Information Vault
- ✅ Installation infrastructure complete
- ✅ Comprehensive documentation (Quick Start, User Guide, Component Roadmap)
- ✅ Validation and testing scripts ready

**Deployment Ready:** Module has completed all development tasks and is ready for production use.

**Validation:**
Run complete module validation: `node _module-installer/validate-module.js`

## Component Inventory

### Agents (5/5 Complete)
- ✓ [deal-orchestrator.agent.yaml](agents/deal-orchestrator.agent.yaml) - Module agent (user interface)
- ✓ [information-vault.agent.yaml](agents/information-vault.agent.yaml) - Service agent (RAG-powered data retrieval)
- ✓ [company-analyst.agent.yaml](agents/company-analyst.agent.yaml) - Expert agent (business intelligence)
- ✓ [finance-analyst.agent.yaml](agents/finance-analyst.agent.yaml) - Expert agent (financial analysis)
- ✓ [story-architect.agent.yaml](agents/story-architect.agent.yaml) - Expert agent (narrative development)

### Workflows (2/2 MVP Complete)
- ✓ [data-room-audit](workflows/data-room-audit/) - Data room completeness and inconsistency detection
- ✓ [investment-storyline-workshop](workflows/investment-storyline-workshop/) - Interactive storyline development

### Installation Infrastructure (Complete)
- ✓ [install-config.yaml](_module-installer/install-config.yaml) - Installation configuration
- ✓ [installer.js](_module-installer/installer.js) - Custom installation logic
- ✓ [validate-config.js](_module-installer/validate-config.js) - Configuration validator
- ✓ [compile-agents.js](_module-installer/compile-agents.js) - Agent compilation check
- ✓ [validate-module.js](_module-installer/validate-module.js) - Complete module validator

### Documentation (Complete)
- ✓ [README.md](README.md) - Module overview and quick reference
- ✓ [QUICKSTART.md](docs/QUICKSTART.md) - Beginner-friendly quick start guide
- ✓ [USER-GUIDE.md](docs/USER-GUIDE.md) - Comprehensive user documentation
- ✓ [COMPONENT-ROADMAP.md](docs/COMPONENT-ROADMAP.md) - Development roadmap and future enhancements
- ✓ [information-vault-rag-implementation.md](agents/information-vault-rag-implementation.md) - RAG architecture guide

## Design Principles

1. **Agent Specialization** - Each agent has a clear, focused purpose
2. **Flexibility First** - No forced workflows or phases
3. **Storyline-First** - Narrative before slides
4. **Intelligence at Core** - Inconsistency detection and assumption validation built-in
5. **Speed Matters** - Quick information retrieval is critical

---

*Built with the BMAD Method - AI-powered agent framework for professional workflows*
