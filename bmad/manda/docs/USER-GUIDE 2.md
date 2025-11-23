# M&A Deal Intelligence Platform - User Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Agent System](#agent-system)
4. [Workflows](#workflows)
5. [Knowledge Base](#knowledge-base)
6. [Data Room Management](#data-room-management)
7. [Inconsistency Detection](#inconsistency-detection)
8. [Storyline Development](#storyline-development)
9. [Output Documents](#output-documents)
10. [Configuration](#configuration)
11. [Best Practices](#best-practices)
12. [Advanced Usage](#advanced-usage)

---

## Overview

The M&A Deal Intelligence Platform is an AI-powered system designed for investment bankers, M&A advisors, and corporate development teams. It focuses on the **due diligence, analysis, and document creation phase** of M&A transactions.

### What This Platform Does

✅ **Intelligent Information Retrieval** - Instant access to deal data through AI agents
✅ **Due Diligence Automation** - Automated data room analysis and gap identification
✅ **Inconsistency Detection** - Cross-document validation and contradiction flagging
✅ **Assumption Validation** - Verify claims against knowledge base
✅ **Financial Analysis** - Comprehensive financial modeling and valuation
✅ **Business Intelligence** - Company analysis (products, customers, operations, market)
✅ **Storyline-First CIM Creation** - Narrative development before slide creation
✅ **Marketing Materials** - Teasers, CIMs, presentations

### What This Platform Does NOT Do

❌ Deal sourcing or origination
❌ Post-close integration planning
❌ Legal document drafting
❌ Regulatory compliance review

---

## Architecture

### Multi-Agent Orchestration

The platform uses a **5-agent architecture** where each agent has specialized expertise:

```
                    ┌─────────────────────┐
                    │  Deal Orchestrator  │ ← You interact here
                    │  (Primary Interface)│
                    └──────────┬──────────┘
                               │
          ┌────────────────────┼────────────────────┐
          │                    │                    │
          ▼                    ▼                    ▼
   ┌─────────────┐      ┌─────────────┐     ┌─────────────┐
   │Information  │      │  Company    │     │  Finance    │
   │   Vault     │      │  Analyst    │     │  Analyst    │
   │ (Backend)   │      │(Business)   │     │(Financial)  │
   └─────────────┘      └─────────────┘     └─────────────┘
          │                    │                    │
          └────────────────────┼────────────────────┘
                               │
                               ▼
                        ┌─────────────┐
                        │   Story     │
                        │  Architect  │
                        │(Narrative)  │
                        └─────────────┘
```

### Design Philosophy

1. **Single Interface** - You work with Deal Orchestrator only; never manually switch agents
2. **Seamless Delegation** - Orchestrator routes requests to specialists automatically
3. **No Forced Phases** - All workflows are independent and on-demand
4. **Story-First** - Narrative development before slide creation
5. **Evidence-Based** - Every claim must link to supporting data

---

## Agent System

### Deal Orchestrator (Module Agent)

**Your primary interface to the platform.**

**Responsibilities:**
- User interaction and conversation management
- Request routing to specialist agents
- Result synthesis across multiple agents
- Workflow coordination
- Context maintenance

**How to Use:**
```bash
/manda:deal-orchestrator
```

Then ask anything:
- "What was 2023 revenue?"
- "Analyze customer concentration risk"
- "Run a data room audit"
- "Develop an investment storyline"

**Key Commands:**
- `/analysis-status` - Data completeness and readiness overview
- `/upload-documents` - Document upload workflow

---

### Information Vault (Service Agent)

**Backend data retrieval engine with RAG architecture.**

**What It Does:**
- High-speed semantic search across all documents
- Source-cited responses with confidence levels
- Cross-document comparison for inconsistency detection
- Fact verification and provenance tracking

**RAG Architecture:**
1. **Hybrid Retrieval** - Combines vector search (semantic) + keyword matching
2. **Relevance Reranking** - Cross-encoder scores for best results
3. **Context Assembly** - Intelligent chunk assembly with citations

**Response Format:**
```
Answer: $47.2M
Source: 2023 Audited Financial Statements, Income Statement, p.3
Confidence: High (audited financials)
Additional Context: This represents 23% YoY growth from 2022 ($38.4M)
Gaps: None - complete audited data available
```

**You Don't Interact Directly** - Orchestrator queries Vault automatically when you ask factual questions.

---

### Company Analyst (Expert Agent)

**Business intelligence specialist.**

**What It Analyzes:**
- Products & Services (portfolio, differentiation, roadmap)
- Customer Base (segments, concentration, retention)
- Operations (efficiency, scalability, processes)
- People & Organization (leadership, structure, talent)
- Market & Competition (positioning, threats, opportunities)
- Growth Drivers (organic, expansion, leverage points)
- Business Risks (key person, customer, operational, regulatory)

**How to Trigger:**
Ask business-focused questions:
- "Who are the top customers?"
- "What's the competitive positioning?"
- "Analyze the management team"
- "What are the growth opportunities?"

**Output Format:**
- Executive summary with key insights
- Detailed findings by dimension
- Strengths and concerns
- Strategic insights
- Open questions for further diligence

---

### Finance Analyst (Expert Agent)

**Financial analysis and valuation specialist.**

**What It Analyzes:**
- Financial Statement Analysis (P&L, Balance Sheet, Cash Flow)
- Valuation (DCF, comps, precedent transactions)
- Revenue Quality (sustainability, recognition, concentration)
- Cash Flow Analysis (generation, working capital, burn)
- Forecast Review (management projections, achievability)
- Financial Risk Assessment
- Scenario Modeling (upside/base/downside cases)
- Inconsistency Detection (cross-document validation)

**How to Trigger:**
Ask financial questions:
- "Analyze historical financial performance"
- "Run a valuation analysis"
- "What are the key financial risks?"
- "Review management's forecast assumptions"
- "Check for financial inconsistencies"

**Valuation Methodologies:**
- **DCF:** Discounted cash flow with sensitivity analysis
- **Comps:** Trading multiples from public comparables
- **Precedents:** M&A transaction multiples
- **Scenarios:** Base/upside/downside probability-weighted

**Inconsistency Detection:**
Automatically compares metrics across documents and flags discrepancies based on configured sensitivity level.

---

### Story Architect (Expert Agent)

**Narrative development specialist for CIMs and marketing materials.**

**What It Creates:**
- Investment thesis statements
- Storyline synthesis (core themes, narrative arc)
- Message hierarchy (headline → pillars → evidence → details)
- Investment teasers (one-page summaries)
- Narrative CIM outlines (prose before slides)
- Buyer persona positioning

**How to Trigger:**
```bash
/manda:investment-storyline-workshop
```

Or ask:
- "Develop an investment thesis"
- "Create an investment teaser"
- "What's the storyline for this deal?"

**Investment Thesis Framework:**
```
The Opportunity: What is this company?
The Value: Why is it valuable?
The Potential: What could it become?
The Proof: Why should buyers believe it?
Ideal Buyer Profile: Who should buy and why?
```

**Workshop Process:**
1. **Discovery** - Understanding the business (your perspective + data)
2. **Synthesis** - Identifying 3-5 core themes
3. **Construction** - Building investment thesis and narrative arc
4. **Validation** - Testing coherence and buyer relevance
5. **Documentation** - Generating deliverables

---

## Workflows

### Data Room Audit

**Purpose:** Comprehensive data room analysis with gap identification and inconsistency detection.

**Command:**
```bash
/manda:data-room-audit
```

**What It Does:**
1. Scans all uploaded documents
2. Categorizes by type (financials, legal, operational, commercial, strategic)
3. Compares against M&A due diligence checklist
4. Calculates completeness by category
5. Runs inconsistency detection across documents (optional)
6. Identifies critical gaps blocking analysis
7. Generates actionable next steps

**Inputs:**
- `scope`: full | financials | legal | operational | commercial (default: full)
- `run_inconsistency_check`: true | false (default: true)

**Output:**
- Comprehensive audit report in `{output_location}/reports/`
- Includes:
  - Overall completeness percentage
  - Documents found (inventory by category)
  - Checklist status (complete/partial/missing)
  - Gap analysis (critical/important/nice-to-have)
  - Inconsistency detection results (if enabled)
  - Recommendations and next steps

**When to Run:**
- After initial document upload
- When new documents arrive
- Before starting analysis workflows
- Periodically to track data collection progress

---

### Investment Storyline Workshop

**Purpose:** Interactive storyline development for CIM creation using story-first approach.

**Command:**
```bash
/manda:investment-storyline-workshop
```

**What It Does:**
Facilitates 5-act workshop to develop compelling investment narrative:
1. **Discovery** - Capture your perspective on company strengths
2. **Synthesis** - Identify 3-5 core storyline themes
3. **Construction** - Build investment thesis and narrative arc
4. **Validation** - Test coherence, buyer relevance, clarity
5. **Documentation** - Generate storyline brief, teaser, CIM outline

**Inputs:**
- `target_buyer_type`: strategic | financial | international | competitor | mixed
- `storyline_depth`: quick (30 min) | standard (60 min) | comprehensive (90+ min)
- `include_teaser`: true | false (generate one-page teaser)
- `include_cim_outline`: true | false (generate narrative CIM outline)

**Outputs:**
- **Storyline Brief** - Complete storyline with thesis, themes, narrative arc
- **Investment Thesis One-Pager** - Standalone thesis statement
- **Investment Teaser** - One-page summary (if enabled)
- **CIM Narrative Outline** - Prose CIM structure (if enabled)
- **Evidence Map** - Claims linked to supporting sources

**Workshop Tips:**
- Have basic financial data uploaded before starting
- Be prepared to share your perspective on company strengths
- Expect 2-3 rounds of theme refinement
- All claims will be validated against knowledge base
- Missing data will be flagged for collection

**Deliverable Locations:**
- `{output_location}/storylines/storyline-brief-[date].md`
- `{output_location}/teasers/investment-teaser-[date].md`

---

## Knowledge Base

### Architecture

The Information Vault uses a **3-store knowledge base** architecture:

#### 1. Vector Store (Semantic Search)
- **Technology:** Vector database (Pinecone, Weaviate, or ChromaDB)
- **Contents:**
  - Document chunk embeddings (768-1536 dimensions)
  - Entity embeddings (companies, people, products)
  - Metric embeddings (financial KPIs, operational metrics)
- **Purpose:** Semantic similarity search for natural language queries

#### 2. Structured Store (Fast Queries)
- **Technology:** PostgreSQL or DuckDB
- **Contents:**
  - Financial time-series (revenue, expenses, margins by period)
  - Customer/supplier lists (names, revenue, contracts)
  - Contract metadata (parties, dates, terms, renewal status)
  - Org charts (employees, roles, reporting structure)
- **Purpose:** Fast structured queries and aggregations

#### 3. Metadata Store (Catalog & Provenance)
- **Technology:** MongoDB or PostgreSQL
- **Contents:**
  - Document catalog (name, type, date, size, quality)
  - Entity graph (relationships: works_for, supplies_to, competes_with)
  - Source tracking (provenance chain for every data point)
  - Version history (document updates, data corrections)
- **Purpose:** Catalog, lineage tracking, audit trail

### Document Ingestion Pipeline

```
Upload → Parse → Chunk → Embed → Index
   ↓
Metadata Extract → Structured Data Extract → Store
```

**Supported Formats:**
- PDF (with OCR for scanned documents)
- Excel (.xlsx, .xls)
- Word (.docx, .doc)
- PowerPoint (.pptx, .ppt)
- Plain text (.txt, .md)

**Processing:**
- Automatic categorization by content analysis
- Intelligent chunking (500-1000 tokens, semantically aware)
- Table extraction and structuring
- Entity recognition (companies, people, metrics)
- Relationship mapping

**Indexing Speed:**
- Small documents (<10 pages): 10-30 seconds
- Medium documents (10-50 pages): 30-90 seconds
- Large documents (50+ pages): 2-5 minutes
- Excel with complex tables: 1-3 minutes

---

## Data Room Management

### Directory Structure

```
data/deals/[deal-name]/
├── financials/          # Audited statements, models, projections
├── legal/               # Contracts, corporate docs, compliance
├── operational/         # Org charts, processes, KPIs
├── commercial/          # Customer data, pricing, sales
└── strategic/           # Business plans, presentations
```

### Document Organization Best Practices

#### 1. Use Descriptive Filenames

✅ **Good:**
- `2023-Audited-Financial-Statements.pdf`
- `Customer-Revenue-Analysis-2023.xlsx`
- `Acme-Corp-Master-Services-Agreement-2021.pdf`

❌ **Bad:**
- `financials.pdf`
- `file1.xlsx`
- `doc.pdf`

#### 2. Indicate Data Quality

Use filename prefixes:
- `AUDITED-` for audited financials
- `UNAUDITED-` for unaudited/management numbers
- `DRAFT-` for preliminary versions
- `FINAL-` for approved versions

#### 3. Include Dates

- `2023-Q4-Management-Report.pdf`
- `2024-01-15-Board-Presentation.pptx`
- `Customer-List-As-Of-2024-01-31.xlsx`

#### 4. Organize Hierarchically

```
legal/
├── corporate/
│   ├── Articles-of-Incorporation.pdf
│   └── Bylaws.pdf
├── customer-contracts/
│   ├── Acme-Corp-MSA-2021.pdf
│   └── GlobalTech-SOW-2023.pdf
└── ip/
    ├── Patents-List.xlsx
    └── Trademark-Registrations.pdf
```

### Data Quality Levels

The Information Vault tracks data quality:

**High Quality:**
- Audited financial statements
- Signed contracts
- Formal legal documents
- Official corporate records

**Medium Quality:**
- Management presentations
- Unaudited financials
- Board materials
- Internal reports

**Low Quality:**
- Meeting notes
- Informal communications
- Analyst observations
- Email exchanges

All responses indicate data quality and confidence level.

---

## Inconsistency Detection

### How It Works

The Finance Analyst compares the same metrics across different documents and flags discrepancies:

**Example:**
```
Inconsistency Found: 2023 Revenue

Source A: 2023 Audited Financials states $47.2M
Source B: Management Board Presentation (Oct 2023) states $47.5M
Discrepancy: $300K (0.6% difference)
Severity: Minor (likely rounding or timing difference)
```

### Sensitivity Levels

Configured during installation (`inconsistency_sensitivity`):

**Strict:**
- Flags any discrepancy >1%
- Use when: Audit-level rigor required, pristine data expected
- Pros: Catches everything
- Cons: May flag explainable differences (rounding, timing)

**Standard (Recommended):**
- Flags discrepancies >5% or material contradictions
- Use when: Normal due diligence
- Pros: Balanced - catches real issues, ignores noise
- Cons: May miss small but significant discrepancies

**Relaxed:**
- Only flags clear contradictions
- Use when: Early-stage analysis, known data quality issues
- Pros: Minimal false positives
- Cons: May miss important discrepancies

### What Gets Checked

- Revenue figures across all sources
- EBITDA/profit metrics
- Customer counts and revenue by customer
- Employee headcount
- Contract terms and renewal dates
- Forecasts vs. actuals
- Margin calculations

### Output Format

Inconsistencies categorized by severity:

**Critical (Immediate Attention Required):**
- Large discrepancies (>10%)
- Contradictory facts
- Missing explanations for differences

**Moderate (Should Investigate):**
- Medium discrepancies (5-10%)
- Timing mismatches
- Inconsistent assumptions

**Minor (Likely Explainable):**
- Small discrepancies (<5%)
- Rounding differences
- Different measurement periods

### How to Handle Inconsistencies

1. **Review the Details** - Check sources and context
2. **Investigate Root Cause** - Is this a data error, timing difference, or something else?
3. **Request Clarification** - Add to DD question list for company
4. **Document Resolution** - Update knowledge base with explanation
5. **Update Storyline** - Use correct/clarified numbers in CIM

---

## Storyline Development

### Story-First Philosophy

**Traditional Approach (Slides-First):**
```
Gather data → Make slides → Hope they tell a story
Result: Disjointed, hard to follow, lacks narrative coherence
```

**M&A Platform Approach (Story-First):**
```
Gather data → Develop narrative → Create slides from story
Result: Coherent, compelling, buyer-focused
```

### Investment Thesis Framework

Every deal needs a clear investment thesis answering: **"Why should a buyer acquire this company?"**

**Opportunity-Value-Potential-Proof-Fit Structure:**

**1. The Opportunity** (What is this company?)
- Industry and market
- What they do and how they make money
- Why it matters

**2. The Value** (Why is it valuable?)
- Financial performance
- Market position
- Customer proof points

**3. The Potential** (What could it become?)
- Growth drivers
- Expansion opportunities
- Strategic value to buyers

**4. The Proof** (Why should buyers believe it?)
- Track record
- Evidence and metrics
- Customer retention/satisfaction

**5. Ideal Buyer Profile** (Who should buy and why?)
- Strategic buyers (synergies)
- Financial buyers (growth/returns)
- International buyers (market entry)
- Competitors (consolidation)

### Core Storyline Themes

Every deal has 3-5 core themes that support the investment thesis.

**Examples:**

**SaaS Company:**
1. Market-leading position with defensible competitive advantages
2. Exceptional unit economics with 110% net revenue retention
3. Significant white space in mid-market segment
4. Mission-critical product with high switching costs
5. Proven management team with track record of execution

**Manufacturing Company:**
1. Dominant market share in niche specialty products
2. Long-term customer relationships (average 12 years)
3. Operational excellence with best-in-class margins
4. Geographic expansion opportunity (currently US-only)

**Consumer Brand:**
1. Strong brand with loyal customer base
2. Omnichannel distribution (DTC + retail + e-commerce)
3. Product line extension opportunities
4. International expansion potential

### Narrative Arc

Structure your story with beginning, middle, and end:

**Opening: The Opportunity**
- Grab attention with the headline
- Set context (industry, market, company overview)
- Preview the value proposition

**Rising Action: The Business**
- Explain what they do and why customers buy
- Show how the business works
- Highlight differentiators

**Climax: The Value Creation**
- Demonstrate performance to date
- Quantify the opportunity
- Show growth potential

**Resolution: The Investment**
- Position for target buyers
- Explain strategic fit
- Call to action (next steps)

### Message Hierarchy

Structure information in layers:

**Level 1: Headline** - What buyers remember
- "Market-leading SaaS platform with 95% retention and 40% growth"

**Level 2: Pillars** - 3-5 supporting themes
- Dominant market position
- Exceptional unit economics
- Proven management team

**Level 3: Evidence** - Facts supporting each pillar
- #1 market share in vertical SaaS for healthcare
- 110% net revenue retention over 3 years
- CEO built and sold previous company for $200M

**Level 4: Details** - Supporting context
- Customer retention breakdown by cohort
- Competitive positioning analysis
- Management team bios

---

## Output Documents

### Data Room Audit Report

**Location:** `{output_location}/reports/data-room-audit-[date].md`

**Contents:**
- Executive summary (completeness, gaps, inconsistencies)
- Documents found (inventory by category)
- Due diligence checklist status
- Completeness analysis with visualizations
- Gap analysis (critical/important/nice-to-have)
- Inconsistency detection results
- Recommendations and next steps

**Use Cases:**
- Understand data completeness before analysis
- Identify what to request from company
- Track data collection progress
- Report to senior management on DD status

---

### Storyline Brief

**Location:** `{output_location}/storylines/storyline-brief-[date].md`

**Contents:**
- Investment thesis (Opportunity-Value-Potential-Proof-Fit)
- The headline (what buyers should remember)
- Core storyline themes (3-5 pillars with evidence)
- Narrative arc (opening → resolution)
- Message hierarchy (4 levels)
- Evidence map (claims → sources)
- Buyer positioning (tailored messaging)
- Risks and mitigations
- Data gaps and recommendations

**Use Cases:**
- Foundation for CIM creation
- Alignment tool for deal team
- Buyer-focused messaging development
- Teaser and pitch deck creation

---

### Investment Teaser

**Location:** `{output_location}/teasers/investment-teaser-[date].md`

**Format:** One-page summary

**Contents:**
- Opportunity statement (2-3 sentences)
- Company overview (industry, size, location)
- Investment highlights (4-5 bullets with quantification)
- Financial snapshot (revenue, EBITDA, margins)
- Strategic value (why attractive to buyers)
- Transaction overview (process, timeline, contact)

**Use Cases:**
- Initial buyer outreach
- NDA discussions
- Pipeline development
- Quick deal overview

---

### CIM Narrative Outline

**Location:** `{output_location}/storylines/cim-narrative-outline-[date].md`

**Format:** Prose (paragraphs, not bullets)

**Structure:**
1. **Executive Summary** (2-3 pages narrative)
2. **The Business Story** (5-8 pages)
3. **The Value Creation Story** (3-5 pages)
4. **The Financial Story** (3-4 pages)
5. **The Investment Opportunity** (2-3 pages)

**Purpose:** Foundation for slide deck creation

**Philosophy:** Story first, slides second. Write the narrative in prose, THEN translate to slides. This ensures coherent storytelling.

---

## Configuration

### install-config.yaml

Located at: `bmad/manda/_module-installer/install-config.yaml`

**Interactive Fields (User Prompted):**

```yaml
data_room_path:
  prompt: 'Where is your deal data room located?'
  default: 'data/deals'
  result: '{project-root}/{value}'

output_location:
  prompt: 'Where should generated documents be saved?'
  default: 'output/manda'
  result: '{project-root}/{value}'

knowledge_base_path:
  prompt: 'Where should the knowledge base be stored?'
  default: 'data/knowledge-base'
  result: '{project-root}/{value}'

template_preference:
  prompt: 'Which CIM template style do you prefer?'
  default: 'standard'
  result: '{value}'
  single-select:
    - value: 'standard'
      label: 'Standard - Professional M&A template'
    - value: 'modern'
      label: 'Modern - Clean, minimal design'
    - value: 'custom'
      label: 'Custom - Use your own templates'

inconsistency_sensitivity:
  prompt: 'How sensitive should inconsistency detection be?'
  default: 'standard'
  result: '{value}'
  single-select:
    - value: 'relaxed'
      label: 'Relaxed - Only flag clear contradictions'
    - value: 'standard'
      label: 'Standard - Balanced detection (recommended)'
    - value: 'strict'
      label: 'Strict - Flag any potential inconsistencies'
```

**Static Fields (Hardcoded):**

```yaml
module_version: '1.0.0'
module_name: 'M&A Deal Intelligence Platform'
module_code: 'manda'

agents:
  - code: 'deal-orchestrator'
    name: 'Deal Orchestrator'
    type: 'module'
  - code: 'information-vault'
    name: 'Information Vault'
    type: 'service'
  # ... (all 5 agents)

workflows:
  - code: 'data-room-audit'
    name: 'Data Room Audit'
  - code: 'investment-storyline-workshop'
    name: 'Investment Storyline Workshop'
```

### Updating Configuration

To change settings after installation:

1. Edit `install-config.yaml` directly
2. Restart the module
3. New settings apply immediately (no reinstall needed)

---

## Best Practices

### 1. Document Organization

- ✅ Use descriptive filenames with dates
- ✅ Organize by category (financials, legal, operational, commercial, strategic)
- ✅ Mark data quality (audited, unaudited, draft)
- ✅ Maintain hierarchy within categories
- ❌ Don't use generic names (doc1.pdf, file.xlsx)
- ❌ Don't mix different document types in one folder

### 2. Data Collection

- ✅ Run data room audit early to identify gaps
- ✅ Prioritize critical documents (financials, customer data)
- ✅ Upload new documents as they arrive
- ✅ Request missing data based on audit recommendations
- ❌ Don't wait for "complete" data room to start analysis
- ❌ Don't upload duplicate documents with different names

### 3. Analysis Workflow

- ✅ Start with data room audit
- ✅ Run financial and business analysis in parallel
- ✅ Validate assumptions against knowledge base
- ✅ Check for inconsistencies proactively
- ✅ Develop storyline when core data is available
- ❌ Don't create CIM before developing storyline
- ❌ Don't skip inconsistency detection

### 4. Storyline Development

- ✅ Involve Story Architect early (don't wait until CIM needed)
- ✅ Iterate on themes 2-3 times for refinement
- ✅ Map all claims to evidence
- ✅ Test storyline against target buyer personas
- ✅ Use prose narrative before creating slides
- ❌ Don't create slides first and hope they tell a story
- ❌ Don't make claims without supporting data

### 5. Quality Control

- ✅ Always ask for sources when reviewing responses
- ✅ Verify critical numbers across multiple documents
- ✅ Review inconsistency detection results carefully
- ✅ Update knowledge base when gaps are filled
- ✅ Maintain evidence map for CIM claims
- ❌ Don't accept unsourced information
- ❌ Don't ignore flagged inconsistencies

---

## Advanced Usage

### Custom Queries

The Deal Orchestrator handles natural language queries. Advanced patterns:

**Comparative Analysis:**
```
"Compare 2023 revenue growth to industry benchmarks"
"How do margins compare to public comparables?"
```

**Trend Analysis:**
```
"Show revenue trends over the past 5 years"
"Analyze EBITDA margin progression"
```

**Scenario Testing:**
```
"What if customer concentration risk materializes?"
"Model downside case if top customer churns"
```

**Cross-Document Validation:**
```
"Find all references to revenue projections across documents"
"Compare customer counts in different sources"
```

### Workflow Chaining

Chain workflows for comprehensive analysis:

```
1. Upload documents
2. /manda:data-room-audit
3. Review gaps, request additional documents
4. Upload new documents
5. "Analyze financial performance" (triggers Finance Analyst)
6. "Analyze business model and market position" (triggers Company Analyst)
7. /manda:investment-storyline-workshop
8. Generate teaser and CIM outline
```

### Custom Templates

To use custom CIM templates:

1. Set `template_preference: custom` in install-config.yaml
2. Add your templates to `bmad/manda/cim-templates/custom/`
3. Use Handlebars syntax for variable substitution:
   ```handlebars
   {{company_name}}
   {{investment_thesis}}
   {{#each core_themes}}
     - {{theme_title}}: {{theme_description}}
   {{/each}}
   ```

### Batch Operations

Process multiple deals:

```bash
# Deal 1
cd data/deals/acme-acquisition
/manda:deal-orchestrator
/manda:data-room-audit

# Deal 2
cd ../beta-company-sale
/manda:deal-orchestrator
/manda:data-room-audit
```

Each deal maintains separate knowledge base and context.

---

## Support & Resources

**Documentation:**
- Quick Start Guide: `docs/QUICKSTART.md`
- User Guide: `docs/USER-GUIDE.md` (this document)
- RAG Implementation: `agents/information-vault-rag-implementation.md`

**Agent Documentation:**
- All agent YAML files in `bmad/manda/agents/`
- Workflow instructions in `bmad/manda/workflows/[workflow-name]/instructions.md`

**Getting Help:**
- Ask Deal Orchestrator: It can explain capabilities and guide you
- Review workflow templates for expected output formats
- Check install-config.yaml for configuration options

---

**Ready to dive deep?** Review the RAG Implementation Guide for technical details on the Information Vault architecture.
