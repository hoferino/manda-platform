# Product Requirements Document (PRD)
# Manda - M&A Intelligence Platform

**Document Status:** In Development
**Created:** 2025-11-19
**Last Updated:** 2026-01-06
**Owner:** Max
**Contributors:** PM John
**Version:** 2.4 (E10/E11 Complete, E12 In Progress, E13 Planned)

---

## Implementation Status

### Phase 1: MVP (Complete)

| Epic | Status | Stories | Completion Date |
|------|--------|---------|-----------------|
| **E1: Project Foundation** | ✅ Complete | 9/9 | 2025-11-25 |
| **E2: Document Ingestion & Storage** | ✅ Complete | 8/8 | 2025-11-26 |
| **E3: Intelligent Document Processing** | ✅ Complete | 9/9 | 2025-11-28 |
| **E4: Collaborative Knowledge Workflow** | ✅ Complete | 13/13 | 2025-11-30 |
| **E5: Conversational Assistant** | ✅ Complete | 8/9 | 2025-12-02 |
| **E6: IRL Management & Auto-Generation** | ✅ Complete | 7/7 | 2025-12-03 |
| **E7: Learning Loop** | ✅ Complete | 6/6 | 2025-12-08 |
| **E8: Q&A Co-Creation Workflow** | ✅ Complete | 7/7 | 2025-12-09 |
| **E9: CIM Builder** | ✅ Complete | 15/15 | 2025-12-11 |

### Phase 2: Refinement Sprint (Complete)

| Epic | Status | Stories | Completion Date |
|------|--------|---------|-----------------|
| **E10: Knowledge Graph Foundation** | ✅ Complete | 8/8 | 2025-12-17 |
| **E11: Agent Context Engineering** | ✅ Complete | 7/7 | 2025-12-18 |

**Phase 2 Tech Debt:** All resolved (TD-010 through TD-014)

**Reference:** [Sprint Change Proposal 2025-12-14](sprint-change-proposal-2025-12-14.md), [Sprint Change Proposal 2025-12-15](sprint-change-proposal-2025-12-15.md)

### Phase 3: Production Readiness (In Progress)

| Epic | Status | Stories | Notes |
|------|--------|---------|-------|
| **E12: Production Readiness & Observability** | 🔄 In Progress | 7/8 (3 deferred) | Multi-tenant isolation, usage tracking, LangSmith observability |
| **E13: Agent Orchestration Optimization** | 📋 Planned | 0/7 | Supervisor pattern, model selection matrix, specialist agents |

### Architecture Decisions Made

**Phase 1 (MVP) — ✅ IMPLEMENTED:**
1. **Document Storage:** Google Cloud Storage (GCS) - selected for better cost model with large files and native Gemini/Vertex AI integration
2. **Test Infrastructure:** Vitest + React Testing Library
3. **Error Handling:** Hierarchical error boundaries at global, app, and route levels
4. **Database & Auth:** Supabase for PostgreSQL and Auth
5. **Document Processing:** Docling for parsing (Excel formulas, tables, OCR)
6. **Embeddings (MVP):** ~~pgvector + OpenAI text-embedding-3-large (3072d)~~ — *replaced by E10 (see #9)*
7. **Knowledge Graph (MVP):** ~~Neo4j (basic)~~ — *enhanced by E10 (see #9)*
8. **Deployment Target:** Google Cloud Run - scale-to-zero, cost-effective for variable traffic

**Phase 2 (E10 Knowledge Graph Foundation) — ✅ IMPLEMENTED:**

> E10 completed 2025-12-17. Knowledge architecture consolidated to Graphiti + Neo4j.

9. **Graphiti + Neo4j:** Temporal knowledge graph framework consolidating all knowledge storage. Bi-temporal model (valid_at, invalid_at) tracks truth evolution. Single source of truth replacing pgvector dual-database approach. See [Sprint Change Proposal 2025-12-15](sprint-change-proposal-2025-12-15.md)
10. **Voyage Embeddings:** voyage-3.5 model (1024d, 32K context) — replaces OpenAI embeddings. Best general-purpose model, outperforms domain-specific models, $0.06/1M tokens. *(Updated from voyage-finance-2 in E10 retrospective)*
11. **Hybrid Retrieval with Reranking:** Graphiti hybrid search (vector + BM25 + graph) + Voyage rerank-2.5. 20-35% accuracy improvement.
12. **Sell-Side Spine Schema:** Core Pydantic entity types guide extraction while allowing dynamic discovery.
13. **Entity Resolution:** Graphiti's built-in resolution tuned for M&A naming variations.

**Phase 2 (E11 Agent Context Engineering) — 📋 PLANNED:**

> These decisions are approved but NOT YET IMPLEMENTED. E11 depends on E10 completion.
> **Reprioritized (2025-12-17):** Retrieval quality and autonomous persistence are now P0. Token optimization (isolation, summarization) moved to backlog — M&A conversations are typically short sessions.

**P0 - Critical:**
14. **Intent-Aware Retrieval (Select strategy):** Pre-model hook retrieves relevant KB context for factual queries. Primary defense against hallucinations.
15. **Agent-Autonomous Write-Back (Write strategy):** Agent autonomously indexes user-provided facts to Graphiti — no user confirmation needed. Graphiti handles entity extraction, deduplication, and contradiction detection.

**P1 - Important:**
16. **Type-Safe Agent Tools:** Pydantic AI for Python backend tools.
17. **Model Configuration:** Provider-agnostic model switching via config.

**P2/P3 - Backlog:**
18. **Conversation Summarization (Compress strategy):** LangGraph `trimMessages` + LLM summarization for older messages.
19. **Tool Result Isolation (Isolate strategy):** Tool executions return concise summaries to LLM context. (Lower priority — context window isn't the bottleneck for typical M&A sessions.)

---

## 1. Vision & Alignment

### Product Vision

Manda is a comprehensive M&A intelligence platform that transforms how analysts work with complex deal information. It's not just a chatbot, not just a data room, but a **platform with an intelligent conversational layer** - a persistent knowledge synthesizer that combines the organizational capabilities of a data room with the analytical power of a specialized AI agent.

**The Platform Foundation:**
- **Deal-Centric Data Room**: Secure document storage, organization, and versioning for all deal-related materials
- **Knowledge Base**: Persistent, structured storage of findings, insights, contradictions, and relationships across all documents
- **Background Processing Engine**: Autonomous document analysis and intelligence building that runs continuously
- **Workflow Management**: IRL tracking, Q&A co-creation, CIM generation, and deliverable management

**The Intelligent Agent Layer:**
- **Conversational Interface**: Natural language interaction that queries the knowledge base and guides the analyst
- **Cross-Domain Analysis**: Sophisticated pattern detection across financial, operational, market, and strategic dimensions with configurable pattern library
- **Proactive Intelligence**: System initiates insights when it detects patterns, not just responding to queries
- **Continuous Learning**: Builds cumulative understanding over time, never starting fresh

**How They Work Together:**
The platform provides the infrastructure (storage, processing, organization), while the agent provides the intelligence (analysis, synthesis, conversation). The agent has access to all platform capabilities through tool calling:
- Query and update the knowledge base
- Trigger document processing jobs
- Access and organize documents in the data room
- Generate Q&A lists and CIM sections
- Track IRL status and coverage

The magic moment occurs when an analyst realizes the system has already analyzed new documents in the background, stored findings in the knowledge base, detected cross-domain patterns, and now proactively surfaces a critical insight through the conversational interface (e.g., "margin compression detected across Q2-Q3 financials - want to explore?") - demonstrating the seamless integration of platform and intelligence.

### What Makes This Different

**Core Differentiator:** Manda is in the loop from the start as a persistent collaborator, not a tool you occasionally consult.

Unlike generic AI assistants that start fresh each conversation, or traditional data rooms that only organize files:

- **Structured Deal Intelligence**: Every finding stored with precise source attribution (document, page, cell), confidence scoring, and relationship mapping to other findings. The system knows not just what you learned, but where it came from, how confident it is, and what it contradicts — building a queryable knowledge graph, not just a memory.
- **Background Intelligence**: Continuously processes new information, performs cross-domain analysis, and synthesizes insights even when analysts aren't actively engaged
- **Proactive + Reactive**: Surfaces insights bi-directionally (system initiates "I noticed..." alongside analyst queries)
- **Semantic Understanding**: Deep contextual analysis at ingestion — the system understands time periods, entities, accounting bases, and how facts relate to each other. Contradictions and gaps are detected organically, not through pre-defined pattern matching.
- **Source Attribution**: Every finding traced to source with confidence scoring - critical for banking credibility
- **Platform Integration**: Combines conversational interface with data room organization, IRL tracking, Q&A co-creation, and CIM generation in one unified experience

### Project Classification

**Project Type:** New Product (greenfield rebuild)

**Domain Type:** M&A / Investment Banking

**Complexity Level:** High
- Complex domain requiring deep M&A expertise
- Sophisticated multi-document analysis across diverse formats (Excel with formulas, PDFs, Word docs)
- Background processing architecture with knowledge graph/database
- Cross-domain intelligence engine with pattern detection
- Real-time and asynchronous processing coordination
- Multiple user workflows (IRL → ingestion → analysis → Q&A → CIM)

---

## 2. Problem Statement & Pain Points

### Current Pain Points

**Primary Pain Points:**

1. **Information Overload**
   - Massive document volume (years of financials, multiple subsidiaries, unconsolidated data)
   - Bad data quality from target companies
   - Missing the forest for the trees - critical patterns buried in details
   - Context switching between financial, operational, market, and legal domains
   - Risk of overlooking contradictions or red flags across disparate sources

2. **CIM Creation Complexity**
   - Manual synthesis across hundreds of documents into compelling narrative
   - Difficulty tailoring messaging to different buyer types (strategic vs financial)
   - Time-consuming to build coherent story arc before drafting content
   - Challenge ensuring narrative consistency across all sections
   - Ensuring all critical insights are included with proper source attribution
   - Visual design and formatting takes significant time away from content strategy

3. **Findings Capture & Knowledge Retention**
   - Analysts extract findings manually while reading documents
   - Findings scattered across Excel sheets, Word docs, or analyst's memory
   - Weeks/months later: "Where did I see that revenue number?"
   - No structured system to capture insights as they work
   - Knowledge fragmented across files, not cumulative or searchable
   - Have to dig through old notes or re-read documents when information needed later

### Target Users

**Primary User:** M&A Analyst / Associate in investment banking or private equity

**User Needs:**
- Organize and analyze large volumes of complex documents efficiently
- Capture findings as they work and retrieve them instantly later
- Cumulate information from multiple sources (uploaded docs + external research + analyst notes)
- Collaborate with AI during document analysis (tell system findings, get validation)
- Surface cross-domain insights that aren't obvious from single-domain analysis
- Co-create comprehensive Q&A lists addressing all stakeholder concerns
- Build compelling CIM narrative storybooks tailored to buyer persona with AI guidance
- Validate narrative coherence before investing time in content creation
- Separate content strategy from visual design for efficiency
- Maintain continuous context across weeks/months of deal work
- Trust the system won't hallucinate or miss critical details

---

## 3. Success Definition

### Success Metrics

**Primary Success Metrics:**

1. **Time Savings (Efficiency)**
   - **CIM Storybook Creation**: Reduce narrative planning time through AI-guided outline and blueprint generation
   - **Visual Styling**: Reduce formatting time through style template extraction and reuse
   - **Document Processing Speed**: Faster turnaround from document receipt to insights
   - **Task Automation**: Reduce analyst time on repetitive synthesis tasks while preserving analyst judgment on original document review

2. **Quality Improvements (Output Excellence)**
   - **Narrative Coherence**: Improved CIM story arc alignment and buyer-persona fit through coherence validation
   - **Strategic Messaging**: Better-tailored messaging for different buyer types (strategic vs financial)
   - **Insight Quality**: High-quality cross-domain insights that analysts trust and find valuable
   - **Accuracy**: Minimal hallucinations, strong source attribution
   - **Comprehensiveness**: Reduced risk of missing critical patterns or red flags

3. **User Adoption (Engagement)**
   - **Daily Active Usage**: % of analysts using chat daily
   - **Chat Sessions**: Average chat sessions per analyst per week
   - **Analyst Confidence**: Trust in system recommendations and insights (measured through feedback/corrections)
   - **Deal Coverage**: Number of active deals being managed through the platform

4. **Business Impact (Value Delivery)**
   - **Analyst Capacity**: Enable analysts to handle more concurrent deals without quality degradation
   - **"Connecting the Dots" Value**: System excels at surfacing non-obvious connections that help analysts understand what stakeholders are looking for
   - **Deal Quality**: Better-informed decisions through comprehensive cross-domain analysis

### Key Principles for Success

**Analyst as Expert**: The system supports but doesn't replace analyst expertise. Good analysts should still work through original documents themselves - Manda's value is in:
- Connecting dots across documents
- Surfacing patterns that might be missed
- Understanding stakeholder needs and questions
- Accelerating synthesis without replacing judgment

**Quality Over Speed**: While efficiency matters, narrative quality and insight accuracy are paramount. The system must earn and maintain analyst trust.

---

## 4. Scope

### Architecture Overview (Platform + Agent)

**Goal**: Build a comprehensive platform that is usable standalone, with the conversational agent tightly integrated as the primary interface for intelligent interaction

**Platform Layer (Infrastructure & Services):**

1. **Data Room Service**
   - Document storage and retrieval
   - Folder/tag organization
   - Version control
   - Access control and permissions
   - Metadata management

2. **Knowledge Base Service**
   - Structured storage (findings, insights, contradictions, sources)
   - Graph/relational database for relationships
   - Search and retrieval APIs
   - Temporal tracking (when info discovered/updated)
   - Confidence scoring storage

3. **Processing Service**
   - Event-driven job queue (document upload triggers processing)
   - Document parsers (Excel, PDF, Word, OCR)
   - Analysis pipeline stages (parse → extract → analyze → store)
   - Background workers (run autonomously)
   - Status tracking and error handling

4. **Workflow Service**
   - IRL management (create, track, link to documents)
   - Q&A management (create, edit, status tracking)
   - CIM generation (templates, section assembly, export)
   - Deal lifecycle tracking

5. **API Layer**
   - RESTful APIs for all platform services
   - Authentication and authorization
   - Rate limiting and error handling
   - Webhooks for event notifications

**Agent Layer (Intelligence & Conversation):**

> **Reference:** See [agent-behavior-spec.md](agent-behavior-spec.md) for detailed agent behavior specifications including search architecture, response formatting, use case behaviors, and testing strategy.

1. **Main Conversational Agent**
   - LLM-powered natural language interface
   - Tool calling capabilities (can invoke platform services)
   - Multi-turn conversation management
   - Context preservation across sessions
   - Prompt engineering for M&A domain
   - Intent inference (fact lookup, deep dive, due diligence, comparison, synthesis, gap identification, exploration)
   - Adaptive response formatting (per agent-behavior-spec P2-P3)

2. **Agent Tools (Platform Integration)**
   - `query_knowledge_base(query, filters)` → search findings
   - `update_knowledge_base(finding, source, confidence)` → store analyst-provided findings
   - `update_knowledge_graph(finding_id, relationships)` → create relationships between findings
   - `validate_finding(finding, context)` → check finding against existing knowledge for contradictions
   - `get_document_info(doc_id)` → retrieve document details
   - `trigger_analysis(doc_id, analysis_type)` → request processing
   - `create_irl(deal_type)` → generate IRL from template
   - `suggest_questions(topic)` → generate Q&A suggestions
   - `add_to_qa(question, answer, sources)` → add question/answer to Q&A list
   - `suggest_narrative_outline(buyer_persona, context)` → propose story arc for CIM storybook
   - `validate_idea_coherence(narrative, proposed_idea)` → check narrative alignment
   - `generate_slide_blueprint(slide_topic, narrative_context)` → create slide guidance (not content)
   - `suggest_visual_style(buyer_persona, industry)` → recommend visual styling
   - `detect_contradictions(topic)` → find inconsistencies
   - `find_gaps(category)` → identify missing info

3. **Specialized Analysis Functions (Called by Agent)**
   - Financial analysis (ratios, trends, quality of earnings)
   - Cross-domain pattern detection (Phase 3)
   - Anomaly detection (Phase 3)
   - Source attribution and confidence scoring

**Key Architectural Principles:**

- **Separation of Concerns**: Platform handles infrastructure, agent handles intelligence
- **Tool-Based Integration**: Agent accesses platform through well-defined tools (not complex inter-agent communication)
- **Background Processing**: Heavy work happens asynchronously in platform layer
- **Lightweight Conversation**: Agent queries pre-computed knowledge base, doesn't reprocess documents in real-time
- **Immediate Availability**: Documents become queryable within seconds of upload via fast vector search, while deeper knowledge graph extraction continues in background (see [Sprint Change Proposal 2026-01-05](sprint-artifacts/sprint-change-proposal-2026-01-05.md))
- **Stateless Agent**: Conversation state stored in platform, agent itself is stateless between invocations
- **Extensibility**: New analysis types added as new tools, new document types as new parsers

**Architecture Flow Example:**

```
User: "Upload financial_statements.xlsx"
  ↓
UI → Data Room Service (store document)
  ↓
Event: document_uploaded
  ↓
Processing Service (background worker picks up job)
  ↓
Parse Excel → Extract data → Analyze financials
  ↓
Knowledge Base Service (store findings with sources)
  ↓
Event: processing_complete
  ↓
UI shows notification: "Financial statements processed"

---

User: "What were Q3 revenues?"
  ↓
Conversational Agent receives query
  ↓
Agent calls tool: query_knowledge_base(query="Q3 revenues", filters={doc: "financials"})
  ↓
Knowledge Base Service returns findings with sources
  ↓
Agent formats response with sources and confidence
  ↓
User sees: "Q3 revenues were $5.2M (source: financial_statements.xlsx, sheet 'P&L', cell B15, confidence: 95%)"

---

User: "Help me build a CIM storybook for a strategic buyer"
  ↓
Agent calls tool: suggest_narrative_outline(buyer_persona="strategic", context={deal_data})
  ↓
Agent queries knowledge base for key findings to ground narrative
  ↓
Agent proposes story arc: Hook → Context → Value → Proof → Vision → Call to Action
  ↓
User approves narrative outline
  ↓
User: "Generate blueprint for Market Opportunity slide"
  ↓
Agent calls tool: generate_slide_blueprint(slide_topic="market_opportunity", narrative_context={...})
  ↓
User sees slide blueprint: Purpose="Demonstrate addressable market size and growth trajectory"
                          Content Direction="Show TAM/SAM/SOM breakdown, 5-year CAGR, key drivers"
                          Action Title="$2.5B Market Growing at 18% CAGR"
  ↓
User exports as unstyled PowerPoint storybook, then applies visual style template
```

### MVP Features (Phase 1): Core M&A Workflow

**Goal**: Deliver immediate banking value with essential IRL-driven workflow and collaborative analysis

**Core Features:**

1. **IRL-Driven Workflow**
   - **Upload and Extract IRL**: Upload IRL (Excel/CSV) with intelligent parser that automatically detects hierarchical structure
   - **Real-Time Preview**: Preview detected categories, subcategories, and items before creating project
   - **Auto-Generate Data Room**: Automatically create folder structure in Data Room based on extracted IRL hierarchy
   - **Document Organization**: Manual drag & drop document organization into folders
   - **IRL Checklist Tracking**: IRL checklist auto-updates as documents placed in folders, showing coverage and gaps
   - **Gap Identification**: System identifies missing items and suggests follow-up requests
   - Template library for common M&A deal types
   - Progress tracking and status indicators

2. **Document Ingestion & Processing**
   - Upload support for Excel (with formula preservation), PDF, Word documents
   - Background processing triggered by document arrival with real-time progress indicators
   - Automatic parsing and initial analysis
   - Document versioning and organization (Data Room)
   - Processing status visibility (queued, parsing, analyzing, complete)

3. **Knowledge Base Construction**
   - Structured storage of findings, insights, contradictions
   - Source attribution for every piece of information
   - Cross-reference tracking between documents
   - Knowledge graph with relationships between findings
   - Semantic search and retrieval

4. **Collaborative Workflow**
   - **Collaborative Document Analysis**: Analyst tells system to analyze doc → reads it himself → captures findings via chat → system validates and stores
   - **Finding Capture & Validation**: Direct chat input, upload notes (Excel/Word), system validates against existing knowledge
   - **Q&A Co-Creation**: System suggests Q&A based on knowledge base, analyst uploads findings with questions → system asks to add to Q&A, collaborative refinement
   - System provides relevant suggestions without overwhelming user
   - Source linking for all findings and answers

5. **Learning Loop**
   - Analyst corrects findings → system updates knowledge graph
   - Analyst validates/rejects findings → system learns confidence scores
   - Analyst edits agent responses → system improves over time
   - Feedback incorporation into knowledge base

6. **CIM Narrative Storybook**
   - Buyer persona-driven narrative outline (Strategic vs Financial buyer)
   - AI-guided storybook creation (slide blueprints: purpose, content direction, action titles)
   - Narrative coherence validation against established story arc
   - Export as unstyled PowerPoint blueprint or LLM prompt
   - Visual style template extraction and application
   - **Live preview capability** for visual concepts and slide layouts

7. **Financial Model Integration**
   - Extract key financial metrics from Excel models (revenue, EBITDA, cash flow, balance sheet items)
   - Parse formula dependencies and calculation logic
   - Identify projection assumptions and growth drivers
   - Store financial time series data in knowledge base with source attribution
   - Support queries about financial metrics ("What was Q3 2023 EBITDA?")
   - Cross-validate financial data across multiple documents

8. **Basic Insight Surfacing**
   - Simple pattern detection (e.g., missing data, inconsistencies)
   - Contradiction detection with confidence thresholds
   - Reactive insights (answers to analyst questions)
   - Confidence scores for AI-generated content

**Out of Scope for MVP:**
- Smart Document Classification & Organization (AI-assisted classification with user approval - Phase 2)
- Complex cross-domain intelligence patterns (extensive pattern library - Phase 3)
- Proactive insight surfacing (system initiates insights - Phase 3)
- Deal-type specific configurations
- External data source integration
- Advanced analytics and visualization
- Comparable company analysis (Phase 2)
- Deal-breaker detection (might do - Phase 3)

### Growth Features (Phase 2): Platform Enhancement

**Goal**: Build out platform capabilities and integrations

**Features:**

1. **Styled CIM Output Research (Spike)**
   - Research style extraction from uploaded PPTX/PDF files
   - Evaluate conversion pipelines (LibreOffice headless, CloudConvert API)
   - Define style guide schema (colors, fonts, spacing, logo handling)
   - Prototype styled preview and export capability
   - Deliverable: Architecture recommendation and effort estimate for styled output

2. **Smart Document Classification & Organization**
   - AI-assisted document classification with user approval workflow
   - Upload section UI: Left (Work Area for uploads) + Right (Folder Structure)
   - Manual drag & drop OR AI classification options
   - LLM analyzes content + filename, matches against folder structure
   - Mandatory user review before moving documents (no auto-move without consent)
   - Confidence scoring: High (>70%) → suggest, Low (<70%) → Uncategorized section
   - Batch operations for multiple documents
   - User override always available with low burden (undoing is painful, so require approval)

3. **Enhanced Data Room**
   - Advanced document organization and tagging
   - Collaborative features (comments, annotations)
   - Version control and change tracking
   - Access control and permissions

4. **External Data Integration**
   - Web research integration (market data, company info)
   - Bloomberg/Capital IQ connectors (if applicable)
   - Public filing imports (SEC, etc.)
   - News and announcement monitoring

5. **Direct Source Connections**
   - Google Drive / SharePoint integration
   - Automatic document sync and updates
   - Cloud storage connectors

6. **Advanced CIM Storybook Features**
   - Industry-specific buyer persona templates (Tech, Healthcare, Manufacturing)
   - Collaborative storybook editing with real-time updates
   - AI-generated chart recommendations based on narrative context
   - Auto-populate storybook blueprints with actual data from knowledge base
   - Sensitivity analysis and valuation visualization suggestions
   - Direct PowerPoint content generation from approved storybook (bypass manual population)

7. **Workflow Automation**
   - Automated IRL reminders and follow-ups
   - Document receipt notifications
   - Analysis completion alerts
   - Progress dashboards

8. **Multi-Deal Management**
   - Portfolio view across multiple active deals
   - Cross-deal pattern recognition
   - Template and insight reuse across deals

### Vision Features (Phase 3): Intelligence Differentiation

**Goal**: Implement sophisticated cross-domain intelligence that creates competitive moat

**Features:**

1. **Semantic Intelligence Engine**

   Rather than relying on pre-defined pattern matching, Manda builds deep semantic understanding during document analysis. Each finding is stored with:
   - **Contextual metadata**: Time period, entity, accounting basis, source reliability
   - **Semantic classification**: What type of fact this is (revenue figure, contract term, headcount, assumption)
   - **Relationship mapping**: How this finding connects to others (supports, contradicts, depends on)

   This enables the system to detect contradictions and gaps organically — not because it was programmed to check "Revenue × Contracts," but because it understands that a $10M revenue projection for Customer X is inconsistent with a $2M/year contract that expires in 6 months.

   **Key capabilities:**
   - Contradiction detection across any domain combination
   - Automatic identification of unstated assumptions
   - Gap detection (what's missing given what we know)
   - Confidence degradation when sources conflict

   The intelligence emerges from understanding, not from rules.

2. **Proactive Insight Surfacing**
   - Bi-directional intelligence (system initiates + analyst queries)
   - "Just analyzed Q3 - detected margin compression, want to explore?" style notifications
   - Priority ranking of insights
   - Context-aware timing of suggestions

3. **Deal-Type Specific Configurations**
   - Tech M&A specialized patterns
   - Industrial deal configurations
   - Pharma/biotech specific analysis
   - Financial services patterns
   - Custom configuration builder

4. **Learning & Improvement Loop**
   - Capture analyst corrections and feedback
   - Improve future analysis based on corrections
   - Pattern refinement over time
   - Confidence calibration

5. **Advanced Intelligence Features**
   - Anomaly detection ("This pattern appears in 2% successful deals but 45% failed deals")
   - Deal precedent database (learning from past outcomes)
   - Proxy market intelligence (identify upstream markets for niche companies)
   - Multi-dimensional scoring (financial health, technical debt, market position)
   - Covenant compliance tracking (post-acquisition portfolio monitoring)

6. **Sophisticated Analytics**
   - Porter's Five Forces automation
   - Value chain analysis
   - SWOT generation with cross-validation
   - Scenario modeling
   - Weighted scoring models (credit rating style)

**Innovation Principles for Phase 3:**
- Domain expertise is the moat
- Patterns should be explainable and traceable
- System learns but analyst always validates
- Confidence transparency is critical

---

## 5. Functional Requirements

### 5.0 Platform Architecture Requirements

**FR-ARCH-001: Platform-Agent Separation**
- Clear separation between platform services (data, storage, processing) and agent (intelligence, conversation)
- Platform exposes APIs/tools that agent calls
- Agent is stateless - all state stored in platform
- No direct database access from agent - all through service APIs

**FR-ARCH-002: Tool-Based Agent Integration**
- Agent accesses platform capabilities through well-defined tools
- Each tool maps to a platform service endpoint
- Tools have clear input/output contracts
- Platform services can be tested independently of agent

**FR-ARCH-003: Scalable Service Architecture**
- Platform services independently scalable
- Processing service scales horizontally (multiple workers)
- Knowledge base service optimized for query performance
- API layer handles rate limiting and load balancing

**FR-ARCH-004: Event-Driven Communication**
- Document upload triggers processing event
- Processing completion triggers knowledge base update event
- Knowledge base updates can trigger agent notifications (Phase 3)
- Webhook support for external integrations (Phase 2)

### 5.1 Document Management & Data Room (Platform Service)

**FR-DOC-001: Document Upload**
- Support Excel (.xlsx, .xls with formula preservation), PDF, Word (.docx, .doc)
- Drag-and-drop interface
- Bulk upload capability
- Upload progress indication
- File size limits and validation

**FR-DOC-002: Document Organization**
- Hierarchical folder structure
- Document tagging and categorization
- Custom naming and renaming
- Document metadata (upload date, version, source)
- Search and filter capabilities

**FR-DOC-003: Document Versioning**
- Track document versions over time
- Compare versions side-by-side
- Restore previous versions
- Version history log

**FR-DOC-004: Document Processing**
- Automatic background processing on upload
- Processing status indication (queued, processing, complete, error)
- Retry failed processing
- OCR for scanned documents
- Excel formula extraction and preservation

### 5.2 Knowledge Base Service (Platform Service)

**FR-KB-001: Structured Knowledge Storage**
- Store findings with source attribution
- Store insights with confidence scores
- Track contradictions across documents
- Cross-reference relationships between information pieces
- Temporal tracking (when information was discovered)

**FR-KB-002: Source Attribution**
- Every piece of information linked to source document(s)
- Page/section/cell reference for precise sourcing
- Support multiple sources for same finding
- Confidence decay for older or contradicted information

**FR-KB-003: Knowledge Retrieval**
- Search across entire knowledge base
- Filter by document, topic, date range
- Retrieve by confidence level
- Show source trail for any finding

**FR-KB-004: Cross-Document Analysis**
- Identify contradictions between documents
- Surface missing information gaps
- Track information evolution over time
- Flag inconsistencies automatically

### 5.3 Conversational Agent (Agent Layer)

**FR-CONV-001: Chat Interface**
- Natural language conversation with system
- Multi-turn conversations with context preservation
- Conversation history saved per deal
- Ability to reference previous conversations

**FR-CONV-002: Query Capabilities**
- Ask questions about any aspect of the deal
- Request summaries of specific topics
- Compare across documents or time periods
- Drill down into specific findings

**FR-CONV-003: Proactive Suggestions (Phase 3)**
- System initiates conversation about new findings
- Alert format: "Just analyzed Q3 financials - detected [insight], want to explore?"
- Priority-ranked notifications
- User control over notification frequency/types

**FR-CONV-004: Response Quality**
- Answers cite specific sources
- Display confidence scores
- Indicate when information is uncertain or missing
- Provide options to drill deeper

### 5.4 IRL Management (Platform Service + Agent)

**FR-IRL-001: IRL Creation (Platform Service)**
- Create new IRL from templates
- Support multiple IRL templates (Tech M&A, Industrial, etc.)
- Custom IRL creation and editing
- Add/remove/modify requested items
- IRL upload during project creation triggers folder generation

**FR-IRL-002: IRL Tracking**
- Simple checkbox for each requested item (unfulfilled / fulfilled)
- **Manual checkbox updates only** - user checks items via expandable checklist in Data Room
- No automatic status changes when documents are uploaded (user may restructure folders)
- Progress visualization (X of Y items fulfilled, percentage complete)

**FR-IRL-003: IRL-Document Linking**
- Map received documents to IRL items manually via checklist
- Trigger document processing when uploaded to Data Room folders
- Track coverage (which requests have responses)
- Identify missing information gaps
- **Note:** Documents uploaded to folders are NOT auto-linked to IRL items

**FR-IRL-004: Template Library**
- Pre-built IRL templates for common deal types
- User can save custom templates
- Template versioning and updates
- Template sharing (if multi-user)

**FR-IRL-005: Auto-Generate Folder Structure from IRL**
- Parse uploaded IRL (Excel/CSV format) to extract categories and structure
- **Intelligent Parser (v2.7, 2025-12-12)**: Smart column detection analyzes header rows to automatically detect column purposes
  - Supports hierarchical categories (Category Level 1 → Category Level 2)
  - Handles flexible column ordering and naming conventions
  - Automatically cleans category names (removes "1.", "2." numbering)
  - Detects common column types: Category, Subcategory, Item, Status, Priority, Description
- **Real-time Preview**: Show detected structure before importing
  - Preview API displays total items, categories, subcategories
  - Expandable tree view of detected hierarchy
  - Warning messages about column detection
  - User confirms structure before project creation
- **Create real GCS folders** in Data Room matching IRL hierarchy
- Folder structure stored in `folders` table with `gcs_path` for each folder
- Documents uploaded to folders stored in GCS at `{deal_id}/data-room/{folder_path}/`
- User can modify folder structure after generation (add/rename/delete folders)
- IRL checklist remains separate from folder structure (manual tracking)
- Maintain relationship between IRL categories and initial folder structure

### 5.5 Collaborative Workflow (Platform Service + Agent)

**FR-COLLAB-001: Collaborative Document Analysis**
- Analyst can initiate analysis of specific document via chat
- System opens/previews document for analyst review
- Analyst reads document and captures findings through conversational interface
- System stores findings with source attribution in real-time
- System validates new findings against existing knowledge base
- System provides relevant suggestions without overwhelming user

**FR-COLLAB-002: Finding Capture & Validation**
- Support multiple capture methods: direct chat input, uploaded notes (Excel/Word), collaborative analysis
- Parse uploaded analyst notes and extract findings with source references
- Validate each finding against existing knowledge graph for contradictions
- Store findings with confidence scores and source attribution
- Alert analyst when contradictions detected with existing findings
- Allow analyst to resolve contradictions (accept new, keep old, flag for investigation)

**FR-COLLAB-003: Q&A Integration**
- System suggests Q&A questions based on knowledge base gaps and findings
- When analyst uploads findings with questions, prompt to add to Q&A list
- Support collaborative refinement of questions and answers
- Link Q&A items to source findings and documents
- Track Q&A status (draft, ready for review, finalized)

### 5.6 Q&A Co-Creation (Platform Service + Agent)

**Purpose:** Q&A lists are questions sent to the CLIENT to answer (not AI-generated answers). The AI helps identify gaps and inconsistencies during document analysis, suggests questions for the client, and manages the Excel round-trip workflow.

**FR-QA-001: Question List Management (Platform Service)**
- Create and organize Q&A lists with real-time collaborative editing
- Categorize questions by topic/domain (Financials, Legal, Operations, Market, Technology, HR)
- Priority ranking (High/Medium/Low)
- Track dates: date_added, date_answered
- Optimistic locking for concurrent edit conflict detection
- Conflict resolution UI (Keep Mine / Keep Theirs / Merge)

**FR-QA-002: AI-Suggested Questions (Agent)**
- Agent suggests Q&A items when knowledge base cannot resolve a gap or inconsistency
- Workflow: User asks question → AI checks KB → If unresolved after discussion → "Should I add this to the Q&A list?"
- Questions derived from inconsistency findings with one-click add to Q&A
- Agent drafts question text from context, user confirms before adding
- Link Q&A items to source findings via source_finding_id

**FR-QA-003: Excel Export (Platform Service)**
- Export Q&A list to Excel format for client distribution
- Columns: Question | Priority | Answer | Date Answered (Category as grouping)
- Filter before export (by category, priority, status)
- Professional formatting for client-facing document

**FR-QA-004: Excel Import and Merge (Platform Service + Agent)**
- UI upload path: Import button in Q&A management section
- Chat upload path: User says "Here's the new Q&A" with file attachment
- Matching logic:
  - Primary: Exact text match on Question field
  - Fallback: Fuzzy match (>90% similarity) with user confirmation
  - Handle new questions added by client (prompt to import)
  - Handle questions removed by client (prompt to keep or delete)
- Import preview showing: exact matches (auto-merge), fuzzy matches (confirm), new items, missing items
- Merge client answers and update date_answered

### 5.6 CIM Builder (Platform Service + Agent)

**Scope:** Complete CIM creation framework. Users define their own CIM structure collaboratively with the agent — not limited to Company Overview. Supports multiple CIMs per deal for different buyer types.

**FR-CIM-001: CIM Builder UI and Workflow Interface (Platform Service)**
- Dedicated CIM Builder interface at `/projects/[id]/cim-builder`
- **NotebookLM-inspired 3-panel layout:**
  - Left Panel: Sources (documents, findings, Q&A from the deal)
  - Center Panel: Conversation (agent-guided workflow interaction)
  - Right Panel: Preview (wireframe slide preview with visual chart/table representations and click-to-reference)
- Structure sidebar showing CIM outline with progress indicators
- Buyer persona selection (Strategic Buyer, Financial Buyer, Custom)
- Drag-and-drop slide reordering
- Non-linear navigation (jump between slides, go back, reorder)
- Auto-save workflow state continuously
- Resume capability from any checkpoint
- Multiple CIMs per deal support

**FR-CIM-002: Agent-Guided Workflow (Agent + Platform)**

**User-Defined Structure**: Unlike a fixed-phase workflow, users define their own CIM agenda/outline collaboratively with the agent. The agent guides through buyer persona, investment thesis, and outline definition, then helps create slides iteratively with RAG-powered content suggestions.

**Workflow Stages (User-Defined Order)**

The workflow consists of flexible stages that users progress through conversationally:

**Stage: Buyer Persona & Investment Thesis**
- Conversational buyer persona discovery (not template selection)
- AI asks about buyer type, motivations, and concerns
- AI proposes 3-part investment thesis based on knowledge base findings:
  - The Asset: What makes this company valuable
  - The Timing: Why now
  - The Opportunity: What's the upside
- Thesis becomes north star for all content

**Stage: Agenda/Outline Definition**
- User defines CIM structure collaboratively with agent
- AI suggests sections with logical flow reasoning
- User can add, remove, or reorder sections
- No fixed structure — supports custom CIM types for different buyer audiences

**Stage: Slide Content Creation (Iterative)**
- Agent initiates content ideation with clear opening for each section
- Hybrid content retrieval: Graphiti search (vector + BM25 + graph traversal) with Voyage reranking
- Q&A answers prioritized (most recent client data) over findings and document chunks
- AI presents 2-3 content options with source citations: `(qa: question)`, `(finding: excerpt)`, `(source: file, page)`
- User selects, modifies, or requests alternative content approaches
- Content approval changes slide status to 'approved' (reversible)
- Context flows forward: agent references buyer persona, thesis, prior slides
- Contradiction awareness: agent alerts user when findings have CONTRADICTS relationships
- Dependency tracking: changes to early slides can propagate to later ones

**Stage: Visual Concept Generation**
- AI generates visual concept with positioning and layout specs:
  - Type of visual (chart, infographic, timeline, diagram)
  - Layout description and element positioning
  - Data visualization details
  - Color scheme and visual hierarchy
  - Designer guidance notes
- User can request modifications via conversation
- Wireframe preview renders in right panel (click-to-reference for editing)

**Stage: Export**
- PowerPoint (.pptx) export with wireframe slides
- LLM prompt export (comprehensive prompt for Claude/GPT to generate styled content)
- Files saved to project's CIM output folder
- Version automatically saved with timestamp

**FR-CIM-003: Agent Intelligence and Tools**
- Agent queries knowledge base (Graphiti hybrid retrieval with reranking) throughout workflow
- Agent validates narrative coherence continuously
- Agent generates slide blueprints with extreme visual precision
- Source citations link to Graphiti entities/facts with provenance chain
- 3 CIM-specific agent tools:
  - `suggest_narrative_outline(buyer_persona, context)` - Propose story arc
  - `validate_idea_coherence(narrative, proposed_idea)` - Check narrative alignment
  - `generate_slide_blueprint(slide_topic, narrative_context, content_elements)` - Create slide guidance with visual concepts

**FR-CIM-004: Workflow State Management**
- LangGraph workflow with human-in-the-loop checkpoints
- Workflow state stored in `cims` table (JSONB workflow_state and slides columns)
- State includes:
  - Buyer persona and investment thesis
  - CIM outline/agenda
  - Slides with content and visual concepts
  - Conversation context
- Resume capability from any checkpoint
- State persists across sessions
- Multiple CIMs per deal supported

**FR-CIM-005: Click-to-Reference Interaction**
- Click any source in left panel to reference in conversation
- Click any element in preview to discuss/edit
- Agent understands context from clicked references
- Natural conversation flow (no slash commands required)

**FR-CIM-006: Dependency Tracking**
- Track dependencies between slides (e.g., thesis → all content slides)
- Alert when changes to early slides may affect later ones
- Consistency validation across CIM
- Non-linear navigation with context preservation

### 5.7 Learning Loop (Platform Service + Agent)

**FR-LEARN-001: Finding Corrections**
- Analyst can correct system-generated findings through chat or UI
- System updates knowledge graph when findings corrected
- System maintains correction history for audit trail
- Corrected findings propagate to related insights and answers
- System learns from correction patterns to improve future extractions

**FR-LEARN-002: Confidence Score Learning**
- System tracks analyst validation/rejection of findings
- Confidence scores adjust based on validation history
- Similar patterns receive updated confidence scores
- High rejection rate triggers review of extraction logic
- Confidence calibration improves over time per analyst preferences

**FR-LEARN-003: Response Improvement**
- Analyst can edit agent-generated responses (Q&A answers, CIM content)
- System stores analyst edits as examples for future generations
- System identifies patterns in edits to improve prompt engineering
- Frequently edited phrases/formats updated in generation logic
- System suggests improvements based on analyst's editing patterns

**FR-LEARN-004: Feedback Incorporation**
- All analyst interactions (corrections, validations, edits) stored in feedback database
- Feedback linked to specific findings, sources, and contexts
- System analyzes feedback to identify systematic issues
- Feedback informs knowledge graph relationship strength
- Aggregate feedback visible in analytics (Phase 2)

### 5.8 Cross-Domain Intelligence (Agent Layer - Phase 3)

**FR-CDI-001: Pattern Detection Engine (Agent)**
- Implement 11+ cross-domain patterns (see scope section)
- Configurable pattern rules
- Confidence scoring for each detected pattern
- Threshold-based surfacing (>60-70%)

**FR-CDI-002: Deal-Type Configurations**
- Pre-built pattern sets for Tech M&A, Industrial, Pharma, Financial Services
- User can enable/disable patterns
- Custom pattern builder
- Pattern priority weighting

**FR-CDI-003: Anomaly Detection**
- Compare current deal against historical patterns
- Flag unusual combinations
- Cite historical precedent frequencies
- Risk scoring based on patterns

### 5.9 Background Processing (Platform Service)

**FR-BG-001: Event-Driven Architecture (Platform)**
- Document upload triggers processing job
- Processing happens asynchronously
- Queue management for multiple documents
- Priority processing for user-requested analysis

**FR-BG-002: Processing Pipeline**
- Document parsing → extraction → analysis → knowledge base update
- Each stage independent and recoverable
- Error handling and retry logic
- Processing status available to user

**FR-BG-003: Autonomous Intelligence**
- System continues processing even when user offline
- New insights ready when user returns
- Background cross-document analysis
- Knowledge base enrichment over time

**FR-BG-004: Processing Transparency**
- User can view processing queue
- See what's been analyzed
- Understand what's pending
- Trigger manual re-processing if needed

### 5.10 Smart Document Classification (Platform Service + Agent - Phase 2)

**FR-CLASS-001: AI-Assisted Classification**
- LLM analyzes document content and filename to determine category
- Match document against existing Data Room folder structure
- Confidence score per classification suggestion (0-100%)
- Support batch classification of multiple documents
- Classification reasoning provided to user (why this folder was suggested)

**FR-CLASS-002: User Approval Workflow**
- Upload section divided: Left (Work Area) + Right (Folder Structure view)
- Documents land in Work Area upon upload
- User selects documents and chooses: Manual (drag & drop) OR AI-Assisted classification
- AI presents suggested classifications with confidence scores
- Mandatory user review before any documents moved
- User can approve, reject, or modify each suggestion
- No auto-move without explicit user consent

**FR-CLASS-003: Confidence Handling**
- High confidence (>70%): Present suggestion with folder destination
- Medium confidence (40-70%): Present suggestion with warning
- Low confidence (<40%): Move to "Uncategorized" section in Data Room
- When multiple folder matches: Select highest confidence, show runner-up to user
- User override always available with low friction

**FR-CLASS-004: Uncategorized Section**
- Dedicated "Uncategorized" section in Data Room for low-confidence documents
- Visually distinct from regular folders
- Documents can be manually moved out to proper folders
- Count of uncategorized documents visible in UI
- Filters to show only uncategorized items

**FR-CLASS-005: IRL Integration**
- Classification suggestions prioritize IRL-defined categories
- When document classified to IRL-linked folder, update IRL checklist automatically
- IRL item status changes from "pending" to "received"
- Support linking one document to multiple IRL items if applicable

**FR-CLASS-006: Learning from User Actions**
- Track user's manual placements and overrides
- Learn patterns from user corrections (e.g., "contracts always go in Legal, not Operational")
- Improve future classification suggestions based on user preferences
- Per-user or per-deal learning (configurable)

---

## 6. Non-Functional Requirements

### 6.1 Performance

**NFR-PERF-001: Response Time**
- Chat responses within 3-5 seconds for simple queries
- Complex analysis requests acknowledged immediately with background processing
- Knowledge base queries return results within 2 seconds
- Document upload feedback immediate (processing happens asynchronously)

**NFR-PERF-002: Processing Throughput**
- Handle document uploads up to 100MB
- Process standard Excel file (5-10 sheets) within 5-10 minutes
- Support multiple simultaneous document processing jobs
- Queue management for bulk uploads

**NFR-PERF-003: Scalability**
- Support deals with 500+ documents
- Knowledge base can store 10,000+ findings per deal
- Handle 10+ concurrent active deals per user
- System performance doesn't degrade with knowledge base growth

**NFR-PERF-004: Background Processing**
- Processing doesn't block user interaction
- Clear indication of processing status
- Graceful degradation if processing delayed
- Priority queue for user-initiated requests

### 6.2 Accuracy & Reliability

**NFR-ACC-001: Information Accuracy**
- Minimize hallucination through strict source attribution
- All generated content traceable to source
- Confidence scores calibrated to actual accuracy (70% confidence = 70% correct)
- Uncertainty clearly indicated when information incomplete

**NFR-ACC-002: Source Precision**
- Source references include: document name, page/section/cell, date
- Support multiple sources for single finding
- Version tracking for source documents
- Handle source document updates/replacements

**NFR-ACC-003: Contradiction Detection**
- Flag contradictions between sources automatically
- Present conflicting information with all sources
- Track resolution of contradictions
- Don't hide or auto-resolve contradictions without user input

**NFR-ACC-004: Data Integrity**
- No data loss during processing
- Transactional updates to knowledge base
- Backup and recovery capabilities
- Audit trail for all changes

### 6.3 Security & Privacy

**NFR-SEC-001: Data Confidentiality**
- All deal data encrypted at rest
- All communications encrypted in transit (TLS)
- Isolated data storage per deal (no cross-contamination)
- Secure document storage with access controls

**NFR-SEC-002: Authentication & Authorization**
- Secure user authentication
- Role-based access control (if multi-user)
- Session management and timeout
- Audit log of all access

**NFR-SEC-003: Compliance**
- GDPR compliance for personal data handling
- Data retention policies configurable
- Right to delete all deal data
- No training on user data without explicit permission

**NFR-SEC-004: Document Security**
- Documents stored securely with encryption
- Access logs for sensitive documents
- Watermarking support for exports (Phase 2)
- DLP (data loss prevention) considerations for exports

### 6.4 Usability

**NFR-USE-001: User Interface**
- Clean, professional interface appropriate for banking context
- Responsive design (desktop primary, tablet support)
- Minimal learning curve (intuitive navigation)
- Keyboard shortcuts for power users

**NFR-USE-002: Error Handling**
- Clear, actionable error messages
- Graceful degradation when features unavailable
- Recovery options for failed operations
- Help documentation easily accessible

**NFR-USE-003: Feedback & Visibility**
- Always indicate system status
- Progress indicators for long operations
- Clear confirmation for important actions
- Undo/redo where applicable

**NFR-USE-004: Accessibility**
- Support standard browser zoom
- Keyboard navigation support
- Screen reader compatibility (WCAG 2.1 AA target)
- High contrast mode support

### 6.5 Maintainability & Extensibility

**NFR-MAINT-001: Code Quality**
- Clean architecture with separation of concerns
- Comprehensive test coverage (unit, integration, e2e)
- Documentation for all major components
- Type safety (TypeScript/Python type hints)

**NFR-MAINT-002: Modularity**
- Pluggable document processors (easy to add new formats)
- Extensible knowledge base schema
- Configurable cross-domain patterns
- Template system for IRL/CIM/Q&A

**NFR-MAINT-003: Monitoring & Debugging**
- Comprehensive logging
- Error tracking and alerting
- Performance monitoring
- Usage analytics (privacy-preserving)

**NFR-MAINT-004: Deployment**
- Automated deployment pipeline
- Environment separation (dev, staging, production)
- Database migration management
- Rollback capability

### 6.6 Data Quality

**NFR-DATA-001: Input Validation**
- Validate document formats before processing
- Handle corrupted or malformed documents gracefully
- Detect and flag low-quality OCR results
- Warning for potentially problematic data

**NFR-DATA-002: Bad Data Handling**
- Robust parsing for inconsistent Excel formats
- Handle missing data gracefully
- Flag data quality issues to user
- Don't fail completely on partial data issues

**NFR-DATA-003: Confidence Calibration**
- Confidence scores reflect actual accuracy
- Regular calibration against analyst feedback
- Track confidence vs accuracy metrics
- Adjust thresholds based on performance

### 6.7 Integration & Compatibility

**NFR-INT-001: File Format Support**
- Excel: .xlsx, .xls (including formulas, multiple sheets, pivot tables)
- PDF: native and scanned (OCR)
- Word: .docx, .doc
- Future: PowerPoint, CSV, plain text

**NFR-INT-002: Export Formats**
- Word (.docx) with full formatting
- PDF export capability
- Excel export for data tables
- JSON/CSV for data extraction (API use)

**NFR-INT-003: Browser Support**
- Modern Chrome, Firefox, Safari, Edge (latest 2 versions)
- Progressive enhancement approach
- Graceful degradation for older browsers

**NFR-INT-004: External Integration (Phase 2)**
- RESTful API for external tools
- Webhook support for notifications
- OAuth for third-party auth
- Cloud storage connectors (Google Drive, SharePoint, OneDrive)

---

## 7. Domain-Specific Requirements

### 7.1 M&A Domain Context

M&A transactions involve analyzing companies across multiple dimensions to assess value, risks, and opportunities. Key domains include:

**Financial Analysis**
- Historical financial performance (P&L, balance sheet, cash flow)
- Quality of earnings
- Working capital analysis
- Revenue composition and trends
- Cost structure analysis
- EBITDA normalization
- Projections and assumptions

**Operational Assessment**
- Business model and value proposition
- Key operational metrics (KPIs)
- Process efficiency
- Capacity and scalability
- Vendor/supplier relationships
- Geographic footprint

**Market & Strategy**
- Market size and growth
- Competitive positioning
- Customer analysis and concentration
- Product/service portfolio
- Growth strategy and initiatives
- Market share and trends

**Technology & IP**
- Technology stack and architecture
- Technical debt assessment
- IP portfolio (patents, trademarks, etc.)
- R&D capabilities
- Digital transformation status

**Legal & Compliance**
- Corporate structure
- Material contracts
- Litigation and legal proceedings
- Regulatory compliance
- Labor and employment matters
- Environmental issues

**People & Organization**
- Organizational structure
- Key person dependencies
- Management quality and depth
- Employee retention and culture
- Compensation structures

### 7.2 M&A-Specific Features

**DR-MA-001: Cross-Domain Pattern Detection**
- Financial × Operational: Cost trends vs efficiency metrics
- Growth × Quality: Revenue growth vs customer satisfaction
- Contracts × Projections: Contract terms vs financial forecasts
- Market × Valuation: Market position vs valuation multiples
- Technical × Growth: Technical debt vs growth plans
- Key Person × Business Risk: Concentration risks
- Compliance × Financial: Legal exposure vs reserves

**DR-MA-002: M&A Workflow Support**
- Phase tracking: Teaser → NDA → CIM → IOI → LOI → Due Diligence → Close
- Deliverable templates: Teaser, CIM, Management Presentation, Q&A
- Stakeholder management: Buyer questions, seller responses, advisor notes
- Timeline tracking: Milestones and deadlines

**DR-MA-003: Valuation Support**
- Comparable company analysis
- Precedent transaction analysis
- DCF model support (extract inputs from documents)
- Football field visualization (Phase 2)
- Sensitivity analysis (Phase 2)
- Multiple expansion/compression analysis

**DR-MA-004: Due Diligence Focus Areas**
- Red flag detection (cross-domain contradictions)
- Information gap identification
- Synergy opportunity surfacing
- Risk categorization (deal-breaker, negotiable, manageable)
- Post-merger integration considerations

**DR-MA-005: Deal-Type Specialization**
- **Tech M&A**: Focus on ARR/MRR, churn, NRR, technical debt, scalability, product roadmap
- **Industrial**: Operational efficiency, capacity utilization, supply chain, labor relations, environmental
- **Pharma/Biotech**: Pipeline, regulatory, clinical trials, IP, reimbursement, R&D productivity
- **Financial Services**: Regulatory capital, credit quality, compliance, risk management

**DR-MA-006: Quality of Earnings Considerations**
- Revenue recognition policies
- Non-recurring items identification
- Accounting policy changes
- Related party transactions
- Off-balance sheet items
- Working capital normalization

### 7.3 Investment Banking Standards

**DR-IB-001: Professional Output Quality**
- CIM quality comparable to top-tier investment banks
- Source citation format meets banking standards
- Chart and table formatting (professional templates)
- Executive summary structure (investment highlights first)

**DR-IB-002: Confidentiality & Sensitivity**
- Treat all deal information as highly confidential
- No leakage of deal-specific information across deals
- Sanitization of examples (no real company names in documentation)
- Secure handling of sensitive financial data

**DR-IB-003: Fact-Based Analysis**
- Every claim backed by source
- Clear distinction between fact and assumption
- Transparent methodology for calculations
- Proper caveats and disclaimers

**DR-IB-004: Stakeholder Communication**
- Buyer-focused CIM (investment opportunity framing)
- Management presentation support (company perspective)
- Q&A responses (balanced, factual)
- Sensitivity to commercial dynamics

### 7.4 Information Request Lists (IRL)

**DR-IRL-001: Standard IRL Categories**
- Corporate structure and ownership
- Financial information (historical and projections)
- Operational data and KPIs
- Customer and sales information
- Product/service details
- Technology and IP
- Legal and compliance
- Human resources
- Market and competitive data
- Strategic plans and initiatives

**DR-IRL-002: IRL Best Practices**
- Prioritize critical information (Phase 1 vs Phase 2 requests)
- Standard requests for industry/deal type
- Custom requests based on preliminary findings
- Follow-up requests as analysis progresses

---

## 8. User Workflows

### 8.1 Primary Workflow: New Deal Setup → CIM Creation

**Step 1: Deal Initialization**
1. User creates new deal in system
2. Enters basic deal information (company name, industry, deal type)
3. System suggests IRL template based on industry/deal type
4. User customizes IRL as needed

**Step 2: IRL Distribution & Document Collection**
1. User exports IRL (or sends via system if integrated)
2. As documents arrive, user uploads to system
3. System automatically maps documents to IRL items
4. Background processing begins immediately
5. User can continue working while processing happens

**Step 3: Document Analysis & Knowledge Building**
1. System processes each document:
   - Parse and extract data
   - Identify key findings
   - Store in knowledge base with source attribution
   - Perform cross-document analysis
   - Flag contradictions or gaps
2. User receives notification when major documents complete processing
3. User can query knowledge base at any time

**Step 4: Conversational Q&A Co-Creation**
1. User starts Q&A session in chat interface
2. System suggests initial questions based on knowledge base
3. User accepts/modifies/adds questions collaboratively
4. System provides draft answers with sources
5. User refines answers through conversation
6. Iterative refinement until Q&A complete
7. User locks finalized Q&A sections

**Step 5: CIM Generation**
1. User selects CIM template
2. System generates draft CIM sections from knowledge base:
   - Executive summary
   - Company overview
   - Market analysis
   - Financial performance
   - Growth opportunities
   - Risk factors
   - Appendices
3. User reviews and edits each section
4. System maintains source citations throughout
5. User exports final CIM to Word

**Step 6: Iteration & Updates**
1. As new documents arrive, system updates knowledge base
2. User can regenerate CIM sections with new information
3. Version tracking maintains audit trail
4. Q&A updated with new information as needed

### 8.2 Secondary Workflows

**Workflow: Ad-Hoc Analysis Query**
1. User asks question in chat interface
2. System queries knowledge base
3. System provides answer with sources and confidence
4. User can drill deeper with follow-up questions
5. System saves conversation for future reference

**Workflow: Document Update**
1. User uploads new version of existing document
2. System detects this is an update (not new document)
3. Background processing identifies what changed
4. System flags impacted findings in knowledge base
5. User reviews changes and updates as needed

**Workflow: Gap Analysis**
1. User requests gap analysis
2. System compares IRL requests vs received documents
3. System identifies missing information in knowledge base
4. System suggests follow-up questions for seller
5. User exports updated IRL or follow-up request list

**Workflow: Cross-Domain Insight Review (Phase 3)**
1. System proactively surfaces detected pattern
2. "Detected margin compression: Q2 COGS up 15% while revenue up 8%, Q3 trend continuing"
3. User can: explore further, dismiss, or mark as important
4. If exploring, system provides detailed analysis with sources
5. Insight saved to knowledge base for CIM inclusion

### 8.3 User Journey Map

**New User Onboarding**
1. Create account and first deal
2. Guided tour of interface
3. Upload sample documents (or use demo deal)
4. See processing in action
5. Try chat interface with sample queries
6. Generate sample Q&A
7. Export sample CIM section

**Experienced User - Active Deal**
1. Morning: Check overnight processing results
2. Review new insights surfaced by system
3. Upload documents received from seller
4. Work on Q&A draft in collaboration with system
5. Respond to buyer questions using knowledge base
6. Update CIM sections as needed
7. Export deliverables for team review

---

## 9. Open Questions & Risks

### 9.1 Technical Questions

**Q-TECH-001: Knowledge Base Technology Choice**
- Question: Graph DB (Neo4j) vs Relational (PostgreSQL with JSONB) vs Vector DB vs Hybrid?
- Impact: Architecture foundation, affects all downstream decisions
- Considerations: Relationship modeling, query patterns, scalability, cost
- Decision needed by: Architecture phase kickoff

**Q-TECH-002: Document Parsing Depth**
- Question: How deep should automatic analysis go? Full formula extraction vs summary?
- Impact: Processing time, accuracy, complexity
- Considerations: Excel formula complexity, OCR quality, processing cost
- Decision needed by: Before MVP implementation

**Q-TECH-003: Event Queue System**
- Question: Real-time stream (Redis/RabbitMQ) vs batch jobs vs simple file-based?
- Impact: Processing architecture, complexity, scalability
- Considerations: Volume, latency requirements, operational complexity
- Decision needed by: Architecture phase

**Q-TECH-004: LLM Strategy**
- Question: Which LLM(s) to use? Single model vs specialized models per task?
- Impact: Cost, quality, latency
- Considerations: GPT-4, Claude, open-source options, fine-tuning possibilities
- Decision needed by: Before prototype

**Q-TECH-005: Frontend Technology**
- Question: React vs Vue vs Svelte? Next.js vs plain SPA?
- Impact: Development speed, performance, ecosystem
- Considerations: Team expertise, component libraries, SSR needs
- Decision needed by: Before UI development

### 9.2 Product Questions

**Q-PROD-001: Phase 1 Intelligence Scope**
- Question: Should MVP include basic cross-domain checks or save ALL intelligence for Phase 3?
- Impact: MVP complexity, time-to-market, user value perception
- Recommendation: Include 2-3 simple patterns in MVP to prove concept
- Decision needed by: Scope finalization

**Q-PROD-002: Multi-User Support Timing**
- Question: When to add team collaboration features?
- Impact: Architecture decisions, security model
- Considerations: Single analyst MVP vs team from start
- Decision needed by: Architecture phase

**Q-PROD-003: CIM Generation Approach**
- Question: Template-based vs AI-generated structure vs hybrid?
- Impact: Quality, flexibility, development effort
- Recommendation: Start with templates, add AI flexibility in Phase 2
- Decision needed by: Before CIM feature development

**Q-PROD-004: Confidence Scoring Algorithm**
- Question: What factors determine confidence? How to calibrate?
- Impact: User trust, insight quality
- Considerations: Source quality, cross-validation, pattern strength, recency
- Decision needed by: Before insight surfacing implementation

**Q-PROD-005: Deal Precedent Privacy**
- Question: How to learn from past deals without revealing confidential info?
- Impact: Phase 3 anomaly detection capability
- Considerations: Anonymization, aggregation, opt-in/opt-out
- Decision needed by: Before Phase 3

### 9.3 Risks & Mitigation Strategies

**RISK-001: LLM Hallucination**
- Risk: AI generates plausible but incorrect information
- Severity: HIGH (destroys user trust)
- Mitigation:
  - Strict source attribution for all claims
  - Confidence scoring with calibration
  - User validation workflow for critical outputs
  - Regular accuracy auditing
  - Clear "uncertain" indicators

**RISK-002: Processing Performance**
- Risk: Large documents cause unacceptable processing delays
- Severity: MEDIUM (degrades user experience)
- Mitigation:
  - Background processing architecture
  - Progressive results (show partial results as available)
  - Processing priority queue
  - Optimize parsers for common formats
  - Set realistic user expectations

**RISK-003: Knowledge Base Complexity**
- Risk: Complex schema becomes unmaintainable or limits flexibility
- Severity: MEDIUM (technical debt)
- Mitigation:
  - Start with minimal viable schema
  - Design for extensibility from start
  - Regular schema review and refactoring
  - Comprehensive tests for schema changes
  - Migration strategy for schema evolution

**RISK-004: Cross-Domain Pattern Quality**
- Risk: Patterns produce too many false positives or miss real issues
- Severity: HIGH (Phase 3 differentiation fails)
- Mitigation:
  - Extensive validation against historical deals
  - Confidence thresholds to filter noise
  - Learning loop to improve patterns
  - User feedback mechanism
  - Start conservative, tune based on data

**RISK-005: Security Breach**
- Risk: Unauthorized access to highly confidential deal data
- Severity: CRITICAL (business destroying)
- Mitigation:
  - Defense in depth (encryption, access controls, audit logs)
  - Regular security audits
  - Compliance with SOC2/ISO27001 standards
  - Data isolation per deal
  - Incident response plan

**RISK-006: Scope Creep**
- Risk: Feature requests expand beyond MVP, delay launch
- Severity: MEDIUM (impacts timeline)
- Mitigation:
  - Strict phase discipline (MVP → Growth → Vision)
  - Regular prioritization reviews
  - User feedback gates (validate before building more)
  - Timeboxed iterations
  - Clear "out of scope" communication

**RISK-007: Testing Complexity**
- Risk: Difficult to test conversational knowledge synthesizer end-to-end
- Severity: MEDIUM (quality issues)
- Mitigation:
  - Component testing strategy (test parts independently)
  - Synthetic deal datasets for testing
  - User acceptance testing with real analysts
  - Monitoring in production
  - Phased rollout

**RISK-008: Bad Data Quality**
- Risk: Seller documents have errors, inconsistencies, low quality
- Severity: MEDIUM (garbage in, garbage out)
- Mitigation:
  - Robust error handling
  - Data quality flagging to user
  - Don't fail on partial issues
  - User can override/correct system findings
  - Clear indication of data quality issues

**RISK-009: Confidence Scoring and Contradiction Resolution Complexity**
- Risk: System flags too many false positive contradictions, or misses real ones, causing analysts to either ignore the system or lose trust
- Severity: HIGH (undermines core value proposition)
- Context: The "Complexity of Truth" - balancing sensitivity vs specificity in contradiction detection
- Mitigation:
  - **Learning Loop (Epic 7) is CRITICAL**: System must learn from analyst corrections to calibrate thresholds
  - Conservative initial thresholds (fewer false positives, prioritize precision over recall)
  - Confidence calibration based on analyst validation/rejection patterns
  - Clear categorization of contradictions (hard conflict vs discrepancy vs context difference)
  - User control over sensitivity settings (can adjust threshold based on preference)
  - Track false positive rate and tune detection algorithms
  - Provide clear context for why system flagged contradiction (don't just say "conflict")
  - Allow analyst to mark contradictions as "acceptable difference" vs "real issue"
  - Regular review of contradiction detection quality metrics

---

## 10. Dependencies & Constraints

### 10.1 Technical Dependencies

**DEP-TECH-001: LLM API Access**
- Dependency: OpenAI API, Anthropic Claude, or equivalent
- Impact: Core intelligence capabilities
- Risk: API changes, rate limits, cost increases
- Mitigation: Abstract LLM layer, consider multiple providers

**DEP-TECH-002: Document Processing Libraries**
- Dependency: Excel parsing (openpyxl, xlrd), PDF (PyPDF2, pdfplumber), OCR (Tesseract)
- Impact: Document ingestion quality
- Risk: Library limitations for complex formats
- Mitigation: Test with real M&A documents early, fallback strategies

**DEP-TECH-003: Database Technology**
- Dependency: PostgreSQL, Neo4j, or chosen knowledge base technology
- Impact: All data storage and retrieval
- Risk: Scalability, complexity
- Mitigation: Benchmark early, design for migration if needed

**DEP-TECH-004: Cloud Infrastructure**
- Dependency: AWS, GCP, or Azure for hosting
- Impact: Deployment, scalability, cost
- Risk: Vendor lock-in, cost escalation
- Mitigation: Use portable technologies where possible

### 10.2 Resource Dependencies

**DEP-RES-001: M&A Domain Expertise**
- Dependency: Access to M&A professionals for validation
- Impact: Pattern quality, workflow accuracy, user acceptance
- Risk: Limited availability of domain experts
- Mitigation: Early engagement, structured feedback sessions

**DEP-RES-002: Sample Deal Data**
- Dependency: Real (anonymized) or realistic synthetic deal documents
- Impact: Testing, validation, training
- Risk: Confidentiality constraints limit access
- Mitigation: Create synthetic datasets, use public filings

**DEP-RES-003: Design Resources**
- Dependency: UX/UI design for professional banking interface
- Impact: User adoption, perceived quality
- Risk: Banking standards are high
- Mitigation: Reference top-tier tools, user testing

### 10.3 Business Constraints

**CONST-BUS-001: Confidentiality Requirements**
- Constraint: Deal data is highly confidential
- Impact: No training on user data, strict data isolation, compliance requirements
- Implications: Architecture, security, testing approach

**CONST-BUS-002: Quality Standards**
- Constraint: Output must meet investment banking professional standards
- Impact: CIM quality, source citation, accuracy requirements
- Implications: Higher bar than typical AI products

**CONST-BUS-003: User Expertise Level**
- Constraint: Users are domain experts who will catch errors
- Impact: System must be accurate, not just plausible
- Implications: Validation, testing, confidence scoring critical

**CONST-BUS-004: Time Sensitivity**
- Constraint: M&A deals operate on tight timelines
- Impact: Processing speed, availability, reliability requirements
- Implications: Background processing, uptime SLAs

### 10.4 Technical Constraints

**CONST-TECH-001: Document Format Complexity**
- Constraint: Excel files with complex formulas, multiple sheets, pivot tables
- Impact: Parsing difficulty, potential for errors
- Implications: Robust error handling, user validation workflow

**CONST-TECH-002: Data Volume**
- Constraint: Deals can involve 500+ documents, years of financials
- Impact: Processing time, storage, knowledge base size
- Implications: Scalability requirements, efficient indexing

**CONST-TECH-003: Context Window Limits**
- Constraint: LLMs have finite context windows
- Impact: Can't simply dump all documents into prompt
- Implications: Knowledge base + retrieval architecture essential

**CONST-TECH-004: Real-Time Processing Limits**
- Constraint: Complex analysis can't happen instantly
- Impact: User expectations, architecture
- Implications: Background processing, async patterns, status indication

---

## Appendix

### References
- [Project Documentation Index](manda-index.md)
- [Sprint Change Proposal 2025-12-14](sprint-change-proposal-2025-12-14.md)
- [Sprint Change Proposal 2025-12-15](sprint-change-proposal-2025-12-15.md)
- [ADR-001: Graphiti Migration](architecture-decisions/adr-001-graphiti-migration.md)

### Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-11-19 | Initial PRD creation |
| 1.5 | 2025-12-09 | Phase 1 MVP complete (E1-E9) |
| 2.0 | 2025-12-14 | Phase 2 planning: E10 Knowledge Base 2.0, E11 Agent Context Engineering. PRD differentiator language updated, pattern matching approach replaced with semantic intelligence |
| 2.1 | 2025-12-15 | **Knowledge Architecture Evolution:** Consolidated to Graphiti + Neo4j (replacing pgvector dual-database). Switched to Voyage finance-2 embeddings (1024d). Added Voyage rerank-2.5 to retrieval pipeline. E10 renamed to "Knowledge Graph Foundation" with 8 stories. See [Sprint Change Proposal 2025-12-15](sprint-change-proposal-2025-12-15.md) |
| 2.2 | 2025-12-17 | **E11 Context Engineering Research:** Updated E11 with LangChain's 4 context engineering strategies (Write, Select, Compress, Isolate). E11.1 renamed from "Context Compression" to "Tool Result Isolation" following Isolate pattern. Added E11.4 Intent-Aware Retrieval for Select strategy. |
| 2.3 | 2025-12-17 | **E11 Reprioritization:** Based on research into Graphiti, LangGraph memory, and M&A workflow analysis. E11.4 (retrieval) and E11.3 (autonomous write-back) now P0. E11.1/E11.2 (token optimization) moved to backlog — conversations aren't long enough to be the bottleneck. E11.3 revised to agent-autonomous persistence (no user confirmation). |
| 2.4 | 2026-01-06 | **Phase 2 Complete, Phase 3 Started:** E10 (Knowledge Graph Foundation) and E11 (Agent Context Engineering) marked complete. E12 (Production Readiness) in progress with 5/11 stories done. E13 (Agent Orchestration Optimization) planned with supervisor pattern, model selection matrix, and specialist agents. Tech debt TD-010 through TD-014 resolved. |

---

*This PRD follows the BMAD Method track for brownfield/enhancement projects and integrates insights from comprehensive brainstorming session exploring First Principles, SCAMPER analysis, and cross-domain intelligence patterns.*
