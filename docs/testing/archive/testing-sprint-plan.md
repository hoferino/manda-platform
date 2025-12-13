# Testing Sprint Plan - Phase 1 MVP Validation

**Sprint Name:** Testing & Stabilization Sprint
**Duration:** 1+ week (starting 2025-12-11)
**Goal:** Validate Phase 1 MVP before Phase 2 enhancements
**Lead Tester:** Max (Project Lead)
**Bug Tracking:** Jira

---

## Objectives

1. Manual exploratory testing of all Phase 1 features
2. Fix bugs discovered during testing
3. Address accumulated technical debt
4. Validate full user journeys end-to-end
5. Ensure MVP is production-ready before Phase 2
6. Measure context window usage and agent performance

---

## Environment Setup Checklist

Before testing, verify all services are running:

```bash
cd manda-app

# 1. Start Neo4j
docker-compose -f docker-compose.dev.yml up -d

# 2. Verify Neo4j is running
docker ps | grep neo4j
# Access Neo4j Browser: http://localhost:7474 (neo4j/mandadev123)

# 3. Start the application
npm run dev

# 4. Open http://localhost:3000
```

### Environment Status

| Service | Status | Configuration |
|---------|--------|---------------|
| Supabase | ✅ Configured | cymfyqussypehaeebedn.supabase.co |
| Neo4j | ✅ Configured | localhost:7687 (Docker) |
| Google Cloud Storage | ✅ Configured | manda-documents-dev bucket |
| LLM Provider | ✅ Configured | OpenAI gpt-5-nano |

---

## User Journey Maps

### Journey 1: Deal Setup & IRL Foundation
**Epic Coverage:** E1, E6
**Priority:** HIGH (Baseline for all other testing)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DEAL SETUP & IRL (Baseline)                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Login] → [Create Deal] → [Create IRL]                     │
│     │          │              │                             │
│     ▼          ▼              ▼                             │
│  • Auth works • Deal form   • IRL created                   │
│  • Dashboard  • Deal saved  • Items added                   │
│                                                             │
│  [IRL as Request Framework]                                 │
│       │                                                     │
│       ▼                                                     │
│  • Add document requests ("Need financials", "Need org      │
│    chart", etc.)                                            │
│  • This IRL guides what documents to upload                 │
│  • Track fulfillment as documents arrive                    │
│                                                             │
│  [Upload Documents to Fulfill IRL]                          │
│       │                                                     │
│       ▼                                                     │
│  • Upload document                                          │
│  • Link to IRL item                                         │
│  • Mark IRL item fulfilled                                  │
│  • Progress tracking                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- [ ] T1.1: Login successfully
- [ ] T1.2: Create new deal with name and description
- [ ] T1.3: Create IRL for the deal
- [ ] T1.4: Add IRL items (document requests)
- [ ] T1.5: AI suggests IRL items based on deal type
- [ ] T1.6: Reorder IRL items
- [ ] T1.7: Export IRL to Excel
- [ ] T1.8: Upload document and link to IRL item
- [ ] T1.9: Mark IRL item as fulfilled
- [ ] T1.10: Progress bar updates correctly

---

### Journey 2: User Onboarding (Quick Validation)
**Epic Coverage:** E1
**Priority:** Medium

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USER ONBOARDING                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Landing Page] → [Sign Up] → [Email Verification]         │
│        │              │              │                      │
│        ▼              ▼              ▼                      │
│  • Page loads     • Form works   • Email sent?              │
│  • No errors      • Validation   • Can verify               │
│                   • Error msgs   • Redirects to app         │
│                                                             │
│  [Login] → [Dashboard] → [Create First Deal]               │
│     │          │              │                             │
│     ▼          ▼              ▼                             │
│  • Auth works  • Empty state  • Form submission             │
│  • Remember me • Guidance     • Deal created                │
│  • Logout      • Navigation   • Redirect to deal            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- [ ] T1.1: Sign up with new email
- [ ] T1.2: Sign up with existing email (error handling)
- [ ] T1.3: Login with valid credentials
- [ ] T1.4: Login with invalid credentials
- [ ] T1.5: Password reset flow
- [ ] T1.6: Dashboard loads for new user (empty state)
- [ ] T1.7: Create first deal
- [ ] T1.8: Logout and re-login

---

### Journey 2: Document Upload & Processing
**Epic Coverage:** E2, E3
**Priority:** High

```
┌─────────────────────────────────────────────────────────────┐
│ 2. DOCUMENT MANAGEMENT & PROCESSING                         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Deal Dashboard] → [Data Room] → [Upload Documents]        │
│        │               │              │                     │
│        ▼               ▼              ▼                     │
│  • Deal loads      • Empty state  • Drag & drop works       │
│  • Navigation      • Folder view  • Progress indicator      │
│  • Tabs work       • Bucket view  • Upload to GCS           │
│                                                             │
│  [Processing] → [View Document] → [See Findings]            │
│       │              │                │                     │
│       ▼              ▼                ▼                     │
│  • Status updates • PDF viewer    • Findings extracted      │
│  • Real-time      • Page nav      • Categories assigned     │
│  • Completion     • Highlights    • Confidence scores       │
│                                                             │
│  [Folder Operations]                                        │
│       │                                                     │
│       ▼                                                     │
│  • Create folder                                            │
│  • Rename folder                                            │
│  • Move documents                                           │
│  • Delete folder                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- [ ] T2.1: Upload single PDF document
- [ ] T2.2: Upload multiple documents at once
- [ ] T2.3: Upload Excel/spreadsheet
- [ ] T2.4: Upload Word document
- [ ] T2.5: Create folder and organize documents
- [ ] T2.6: Document processing completes
- [ ] T2.7: View processed document
- [ ] T2.8: Findings are extracted and visible
- [ ] T2.9: Drag and drop document to folder
- [ ] T2.10: Delete document
- [ ] T2.11: Upload large file (>10MB)
- [ ] T2.12: Upload unsupported file type (error handling)

---

### Journey 3: Knowledge Explorer
**Epic Coverage:** E4
**Priority:** Medium

```
┌─────────────────────────────────────────────────────────────┐
│ 3. KNOWLEDGE EXPLORER                                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Deal] → [Knowledge Tab] → [Browse Findings]               │
│    │           │                 │                          │
│    ▼           ▼                 ▼                          │
│  • Tab nav   • Categories     • Finding cards               │
│  • Loads     • Filters        • Source links                │
│              • Search         • Confidence badges           │
│                                                             │
│  [Filter/Search] → [View Finding Detail] → [See Sources]    │
│        │                  │                    │            │
│        ▼                  ▼                    ▼            │
│  • Category filter    • Full text          • Document link  │
│  • Text search        • Metadata           • Page/location  │
│  • Confidence filter  • Related findings   • Highlight      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- [ ] T3.1: Knowledge tab loads with findings
- [ ] T3.2: Filter findings by category
- [ ] T3.3: Search findings by text
- [ ] T3.4: Filter by confidence level
- [ ] T3.5: View finding detail
- [ ] T3.6: Click source link navigates to document
- [ ] T3.7: Empty state when no findings

---

### Journey 4: AI Chat Agent
**Epic Coverage:** E5
**Priority:** High

```
┌─────────────────────────────────────────────────────────────┐
│ 4. AI-POWERED CHAT AGENT                                    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Deal] → [Chat Tab] → [Ask Question]                       │
│    │          │            │                                │
│    ▼          ▼            ▼                                │
│  • Tab nav  • Chat UI    • Message sent                     │
│  • Loads    • History    • Loading state                    │
│             • Input      • Streaming response               │
│                                                             │
│  [Agent Response] → [View Sources] → [Follow-up]            │
│        │                │               │                   │
│        ▼                ▼               ▼                   │
│  • Answer appears   • Source cards   • Context retained     │
│  • Formatted text   • Click to doc   • Multi-turn works     │
│  • Source refs      • Page numbers   • Related questions    │
│                                                             │
│  [Tool Usage]                                               │
│        │                                                    │
│        ▼                                                    │
│  • Agent uses RAG tools                                     │
│  • Searches findings                                        │
│  • Searches documents                                       │
│  • Searches Q&A items                                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- [ ] T4.1: Chat tab loads
- [ ] T4.2: Send simple question
- [ ] T4.3: Agent responds with sources
- [ ] T4.4: Click source navigates to document
- [ ] T4.5: Multi-turn conversation works
- [ ] T4.6: Agent uses RAG to find relevant information
- [ ] T4.7: Long response streams correctly
- [ ] T4.8: Error handling for failed LLM call
- [ ] T4.9: Chat history persists on page refresh
- [ ] T4.10: New conversation clears history

---

### Journey 5: Information Request List (IRL)
**Epic Coverage:** E6
**Priority:** Medium

```
┌─────────────────────────────────────────────────────────────┐
│ 5. INFORMATION REQUEST LIST (IRL)                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Deal] → [IRL Tab] → [Create IRL]                          │
│    │         │            │                                 │
│    ▼         ▼            ▼                                 │
│  • Tab nav  • List view  • Form works                       │
│  • Loads    • Empty state• IRL created                      │
│                                                             │
│  [Add Items] → [Track Status] → [Export]                    │
│       │            │              │                         │
│       ▼            ▼              ▼                         │
│  • Manual add   • Status toggle  • Excel export             │
│  • AI suggest   • Progress bar   • Download works           │
│  • Drag order   • Completion %                              │
│                                                             │
│  [Fulfill Items]                                            │
│       │                                                     │
│       ▼                                                     │
│  • Mark fulfilled                                           │
│  • Link to document                                         │
│  • Add notes                                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- [ ] T5.1: IRL tab loads
- [ ] T5.2: Create new IRL
- [ ] T5.3: Add item manually
- [ ] T5.4: AI suggests items based on deal
- [ ] T5.5: Reorder items via drag and drop
- [ ] T5.6: Mark item as fulfilled
- [ ] T5.7: Link item to document
- [ ] T5.8: Export IRL to Excel
- [ ] T5.9: Progress tracking updates
- [ ] T5.10: Delete item

---

### Journey 6: Finding Corrections (Learning Loop)
**Epic Coverage:** E7
**Priority:** Medium

```
┌─────────────────────────────────────────────────────────────┐
│ 6. LEARNING LOOP & CORRECTIONS                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [View Finding] → [Report Issue] → [Submit Correction]      │
│       │               │                │                    │
│       ▼               ▼                ▼                    │
│  • Finding detail  • Issue types    • Correction saved      │
│  • Edit option     • Free text      • Finding updated       │
│                    • Severity       • Confidence adjusted   │
│                                                             │
│  [Correction Propagation]                                   │
│       │                                                     │
│       ▼                                                     │
│  • Related findings flagged                                 │
│  • Neo4j relationships updated                              │
│  • Agent learns from correction                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- [ ] T6.1: Report incorrect finding
- [ ] T6.2: Submit correction with new value
- [ ] T6.3: Finding confidence adjusts
- [ ] T6.4: Related findings flagged for review
- [ ] T6.5: Validate correction against source
- [ ] T6.6: Reject invalid correction

---

### Journey 7: Q&A List Management
**Epic Coverage:** E8
**Priority:** Medium

```
┌─────────────────────────────────────────────────────────────┐
│ 7. Q&A LIST MANAGEMENT                                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Deal] → [Q&A Tab] → [Create Q&A List]                     │
│    │         │             │                                │
│    ▼         ▼             ▼                                │
│  • Tab nav  • List view   • Form works                      │
│  • Loads    • Empty state • List created                    │
│                                                             │
│  [Add Questions] → [Export] → [Import Answers]              │
│        │             │            │                         │
│        ▼             ▼            ▼                         │
│  • Manual add    • Excel export • Upload Excel              │
│  • AI suggest    • Template     • Answers mapped            │
│  • Categories    • Formatting   • Status updates            │
│                                                             │
│  [View Answers] → [Use in Chat]                             │
│        │              │                                     │
│        ▼              ▼                                     │
│  • Answer display  • Agent prioritizes Q&A                  │
│  • Source link     • "Most recent info"                     │
│  • Date answered                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- [ ] T7.1: Q&A tab loads
- [ ] T7.2: Create Q&A list
- [ ] T7.3: Add question manually
- [ ] T7.4: AI suggests questions
- [ ] T7.5: Export Q&A to Excel
- [ ] T7.6: Import answers from Excel
- [ ] T7.7: Answers appear in Q&A list
- [ ] T7.8: Agent uses Q&A in chat responses
- [ ] T7.9: Delete question
- [ ] T7.10: Edit question

---

### Journey 8: CIM Builder (CRITICAL)
**Epic Coverage:** E9
**Priority:** CRITICAL

```
┌─────────────────────────────────────────────────────────────┐
│ 8. CIM BUILDER - FULL WORKFLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Deal] → [CIM Tab] → [Create New CIM]                      │
│    │         │             │                                │
│    ▼         ▼             ▼                                │
│  • Tab nav  • List view   • CIM created                     │
│  • Loads    • Empty state • 3-panel layout                  │
│                                                             │
│  PHASE 1: BUYER PERSONA                                     │
│  ─────────────────────────                                  │
│  [Chat with Agent] → [Define Persona] → [Approve]           │
│        │                  │                │                │
│        ▼                  ▼                ▼                │
│  • Agent guides       • Type selected   • Saved to CIM      │
│  • Questions asked    • Priorities set  • Phase advances    │
│  • Context gathered   • Concerns noted                      │
│                                                             │
│  PHASE 2: INVESTMENT THESIS                                 │
│  ──────────────────────────                                 │
│  [Agent Proposes] → [Refine Together] → [Approve]           │
│        │                  │                │                │
│        ▼                  ▼                ▼                │
│  • Draft thesis       • Edit via chat   • Saved to CIM      │
│  • Based on persona   • Iterations      • Phase advances    │
│  • Uses deal data                                           │
│                                                             │
│  PHASE 3: OUTLINE DEFINITION                                │
│  ───────────────────────────                                │
│  [Agent Suggests] → [Add/Remove/Reorder] → [Approve]        │
│        │                   │                  │             │
│        ▼                   ▼                  ▼             │
│  • Section list        • Drag reorder     • Structure set   │
│  • Descriptions        • Delete sections  • Phase advances  │
│  • Structure tree      • Add custom                         │
│                                                             │
│  PHASE 4: CONTENT CREATION                                  │
│  ─────────────────────────                                  │
│  [For Each Section]:                                        │
│  [Agent Searches] → [Presents Options] → [User Selects]     │
│        │                  │                  │              │
│        ▼                  ▼                  ▼              │
│  • RAG search         • 2-3 options      • Option chosen    │
│  • Q&A priority       • Source citations • Slide created    │
│  • Findings search    • Content preview  • Can modify       │
│                                                             │
│  [Slide Created] → [Approve Content] → [Next Section]       │
│        │                │                   │               │
│        ▼                ▼                   ▼               │
│  • Preview renders  • Status: approved  • Loop continues    │
│  • Components shown • Can revisit       • All sections done │
│                                                             │
│  PHASE 5: VISUAL CONCEPTS                                   │
│  ────────────────────────                                   │
│  [Agent Suggests] → [Layout & Charts] → [Approve]           │
│        │                  │                │                │
│        ▼                  ▼                ▼                │
│  • Layout types       • Chart types     • Visual set        │
│  • Image suggestions  • Recommendations • Phase advances    │
│                                                             │
│  PHASE 6: REVIEW                                            │
│  ───────────────                                            │
│  [Coherence Check] → [Fix Issues] → [Finalize]              │
│        │                 │              │                   │
│        ▼                 ▼              ▼                   │
│  • Consistency scan  • Navigate to   • CIM complete         │
│  • Dependencies      • Edit & fix    • Ready for export     │
│  • Contradictions                                           │
│                                                             │
│  EXPORT                                                     │
│  ──────                                                     │
│  [Export PPTX] and/or [Export LLM Prompt]                   │
│        │                    │                               │
│        ▼                    ▼                               │
│  • Wireframe PPTX       • XML prompt                        │
│  • Downloads            • Copy to clipboard                 │
│  • Opens in PowerPoint  • Download .txt                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases - CIM Creation:**
- [ ] T8.1: CIM tab loads
- [ ] T8.2: Create new CIM
- [ ] T8.3: 3-panel layout renders correctly
- [ ] T8.4: Chat panel works (send message, receive response)
- [ ] T8.5: Structure panel shows outline
- [ ] T8.6: Preview panel shows slides

**Test Cases - Buyer Persona Phase:**
- [ ] T8.7: Agent asks about buyer type
- [ ] T8.8: Define buyer persona through conversation
- [ ] T8.9: Persona saved to CIM
- [ ] T8.10: Phase transitions to thesis

**Test Cases - Investment Thesis Phase:**
- [ ] T8.11: Agent proposes thesis based on persona
- [ ] T8.12: Refine thesis through conversation
- [ ] T8.13: Thesis saved to CIM
- [ ] T8.14: Phase transitions to outline

**Test Cases - Outline Phase:**
- [ ] T8.15: Agent suggests outline sections
- [ ] T8.16: Add custom section
- [ ] T8.17: Remove section
- [ ] T8.18: Reorder sections (drag and drop)
- [ ] T8.19: Outline saved to CIM
- [ ] T8.20: Phase transitions to content creation

**Test Cases - Content Creation Phase:**
- [ ] T8.21: Agent searches for content (RAG working)
- [ ] T8.22: Agent presents 2-3 content options
- [ ] T8.23: Source citations shown correctly
- [ ] T8.24: Select content option
- [ ] T8.25: Modify content through conversation
- [ ] T8.26: Slide created and visible in preview
- [ ] T8.27: Approve slide content
- [ ] T8.28: Progress through all sections

**Test Cases - Visual Concepts Phase:**
- [ ] T8.29: Agent suggests layout for each slide
- [ ] T8.30: Chart recommendations shown
- [ ] T8.31: Image suggestions provided
- [ ] T8.32: Visual concepts saved

**Test Cases - Review Phase:**
- [ ] T8.33: Coherence check runs
- [ ] T8.34: Dependency warnings shown
- [ ] T8.35: Navigate to flagged slides
- [ ] T8.36: Fix issues via conversation

**Test Cases - Export:**
- [ ] T8.37: Export PPTX button visible
- [ ] T8.38: PPTX downloads successfully
- [ ] T8.39: PPTX opens in PowerPoint/LibreOffice
- [ ] T8.40: Export LLM Prompt opens modal
- [ ] T8.41: Copy to clipboard works
- [ ] T8.42: Download .txt works

**Test Cases - State Persistence:**
- [ ] T8.43: Close browser, reopen - CIM state restored
- [ ] T8.44: Resume from exact phase left off
- [ ] T8.45: Conversation history preserved
- [ ] T8.46: Slides and content preserved

**Test Cases - Non-Linear Navigation:**
- [ ] T8.47: Click on earlier section in structure tree
- [ ] T8.48: Edit previous slide content
- [ ] T8.49: Dependency warnings appear for affected slides
- [ ] T8.50: Return to current section

---

## Backend Processing Pipeline Validation (CRITICAL)

This section validates the **end-to-end document processing pipeline** - from upload through to RAG retrieval. This is where the "intelligence" of the platform lives.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENT PROCESSING PIPELINE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. UPLOAD                    2. PROCESSING                                 │
│  ─────────                    ─────────────                                 │
│  [User uploads doc]           [manda-processing Python service]             │
│       │                            │                                        │
│       ▼                            ▼                                        │
│  GCS Storage ──────────────► Docling Parser                                 │
│  manda-documents-dev              │                                         │
│                                   ├── PDF Parser (OCR support)              │
│                                   ├── Excel Parser (formulas)               │
│                                   └── Word Parser                           │
│                                        │                                    │
│                                        ▼                                    │
│                              Semantic Chunker                               │
│                              (512-1024 tokens)                              │
│                                        │                                    │
│  3. STORAGE                            │                                    │
│  ─────────                             ▼                                    │
│  ┌─────────────┐    ┌─────────────────────────────────┐                    │
│  │  Supabase   │◄───│  Generate Embeddings            │                    │
│  │  pgvector   │    │  (text-embedding-3-large)       │                    │
│  │             │    └─────────────────────────────────┘                    │
│  │ - findings  │                                                            │
│  │ - chunks    │                                                            │
│  │ - embeddings│                                                            │
│  └─────────────┘                                                            │
│        │                                                                    │
│        ▼                                                                    │
│  4. KNOWLEDGE GRAPH                                                         │
│  ──────────────────                                                         │
│  ┌─────────────┐                                                            │
│  │   Neo4j     │◄─── Relationship Detection                                 │
│  │             │     - SUPPORTS (corroborating info)                        │
│  │ - Finding   │     - CONTRADICTS (conflicting info)                       │
│  │ - Document  │     - SUPERSEDES (newer info)                              │
│  │ - QAItem    │     - FROM_DOCUMENT (source link)                          │
│  └─────────────┘                                                            │
│        │                                                                    │
│        ▼                                                                    │
│  5. RAG RETRIEVAL                                                           │
│  ────────────────                                                           │
│  [Agent queries] ──► Hybrid Search                                          │
│                      ├── pgvector semantic similarity                       │
│                      └── Neo4j relationship traversal                       │
│                              │                                              │
│                              ▼                                              │
│                      Ranked Results with Sources                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Implementation Status

| Component | Location | Status | Notes |
|-----------|----------|--------|-------|
| **Docling Parser** | `manda-processing/src/parsers/docling_parser.py` | ✅ Implemented | PDF, Excel, Word, OCR |
| **Semantic Chunker** | `manda-processing/src/parsers/chunker.py` | ✅ Implemented | 512-1024 tokens, tiktoken |
| **Job Handler (Next.js)** | `manda-app/lib/pgboss/handlers/document-parse.ts` | ❓ Placeholder | Says "TODO: Implement in Epic 3" |
| **Embedding Generator** | `manda-app/lib/pgboss/handlers/generate-embeddings.ts` | ❓ Placeholder | Says "TODO: Implement in Epic 3" |
| **Neo4j Operations** | `manda-app/lib/neo4j/operations.ts` | ✅ Implemented | SUPPORTS, CONTRADICTS, SUPERSEDES |
| **Hybrid RAG** | `manda-app/lib/agent/cim/utils/content-retrieval.ts` | ✅ Implemented | pgvector + Neo4j |

### Critical Question: How Does Processing Trigger?

**Need to verify:** Is there a connection between:
1. Next.js app (document upload)
2. manda-processing Python service (Docling parsing)
3. Back to Next.js (embedding + Neo4j)?

**Hypothesis:** The pg-boss handlers in Next.js are placeholders - the actual processing happens in `manda-processing` Python service.

---

### Backend Test Journey: Single Document Processing

```
┌─────────────────────────────────────────────────────────────┐
│ BACKEND TEST: Single Document Pipeline                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TEST SETUP                                                 │
│  ──────────                                                 │
│  1. Create deal via UI                                      │
│  2. Upload single PDF (e.g., Company Overview)              │
│                                                             │
│  VERIFY: GCS Upload                                         │
│  ──────────────────                                         │
│  □ File appears in gs://manda-documents-dev bucket          │
│  □ documents table has new row with gcs_path                │
│  □ Document status = "uploaded" or "processing"             │
│                                                             │
│  VERIFY: Parsing (manda-processing)                         │
│  ────────────────────────────────────                       │
│  □ Docling processes the file                               │
│  □ Pages extracted (check logs or DB)                       │
│  □ Text chunked (512-1024 tokens each)                      │
│  □ Tables extracted separately                              │
│                                                             │
│  VERIFY: Chunk Storage                                      │
│  ─────────────────────                                      │
│  □ document_chunks table has rows for this document         │
│  □ Each chunk has content, page_number, chunk_index         │
│  □ Chunk sizes within expected range                        │
│                                                             │
│  VERIFY: Embeddings                                         │
│  ─────────────────                                          │
│  □ Embeddings generated for chunks                          │
│  □ embeddings column populated (3072 dimensions)            │
│  □ findings table has extracted facts                       │
│  □ findings have embeddings populated                       │
│                                                             │
│  VERIFY: Neo4j Nodes                                        │
│  ────────────────────                                       │
│  □ Document node created in Neo4j                           │
│  □ Finding nodes created                                    │
│  □ FROM_DOCUMENT relationships exist                        │
│                                                             │
│  VERIFY: Document Status                                    │
│  ───────────────────────                                    │
│  □ Status updates to "processed" or "completed"             │
│  □ UI reflects completion                                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases - Single Document:**
- [ ] TB.1: Upload PDF → appears in GCS bucket
- [ ] TB.2: Document row created in Supabase with correct gcs_path
- [ ] TB.3: Processing job triggers (check logs)
- [ ] TB.4: document_chunks table populated
- [ ] TB.5: Chunk count reasonable (e.g., 10-page PDF = ~10-30 chunks)
- [ ] TB.6: Embeddings generated (check embedding column not null)
- [ ] TB.7: Findings extracted from document
- [ ] TB.8: Neo4j Document node created
- [ ] TB.9: Neo4j Finding nodes created
- [ ] TB.10: FROM_DOCUMENT relationships exist
- [ ] TB.11: Document status = "completed"
- [ ] TB.12: Knowledge Explorer shows findings

---

### Backend Test Journey: Multi-Document Relationships

```
┌─────────────────────────────────────────────────────────────┐
│ BACKEND TEST: Cross-Document Relationship Detection         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TEST SETUP                                                 │
│  ──────────                                                 │
│  1. Same deal as above                                      │
│  2. Upload SECOND document (e.g., Financial Statements)     │
│     that references or contradicts first document           │
│                                                             │
│  SCENARIO A: Supporting Information                         │
│  ──────────────────────────────────                         │
│  Doc 1: "Revenue was $10M in 2024"                          │
│  Doc 2: "Q4 2024 revenue: $2.5M (full year: $10M)"          │
│  Expected: SUPPORTS relationship between findings           │
│                                                             │
│  SCENARIO B: Contradicting Information                      │
│  ─────────────────────────────────────                      │
│  Doc 1: "Company founded in 2015"                           │
│  Doc 2: "Established in 2018"                               │
│  Expected: CONTRADICTS relationship detected                │
│                                                             │
│  SCENARIO C: Superseding Information                        │
│  ────────────────────────────────────                       │
│  Doc 1 (older): "Employee count: 50"                        │
│  Doc 2 (newer): "Current headcount: 75"                     │
│  Expected: SUPERSEDES relationship (newer info wins)        │
│                                                             │
│  VERIFY: Relationship Detection                             │
│  ───────────────────────────────                            │
│  □ System compares new findings to existing                 │
│  □ SUPPORTS relationships created where corroborating       │
│  □ CONTRADICTS relationships created where conflicting      │
│  □ SUPERSEDES relationships created where newer replaces    │
│                                                             │
│  VERIFY: Neo4j Graph                                        │
│  ────────────────────                                       │
│  □ Query: MATCH (f1)-[:SUPPORTS]->(f2) RETURN count(*)      │
│  □ Query: MATCH (f1)-[:CONTRADICTS]->(f2) RETURN count(*)   │
│  □ Relationships link correct findings                      │
│                                                             │
│  VERIFY: RAG Retrieval                                      │
│  ─────────────────────                                      │
│  □ Agent query about revenue returns BOTH documents         │
│  □ Agent mentions supporting evidence                       │
│  □ Agent flags contradictions to user                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases - Multi-Document Relationships:**
- [ ] TB.13: Upload second related document
- [ ] TB.14: Both documents processed successfully
- [ ] TB.15: Findings from both docs in database
- [ ] TB.16: Neo4j has nodes for both documents
- [ ] TB.17: SUPPORTS relationships detected (if applicable)
- [ ] TB.18: CONTRADICTS relationships detected (if applicable)
- [ ] TB.19: Agent RAG returns findings from both documents
- [ ] TB.20: Agent response mentions source documents
- [ ] TB.21: Agent flags contradictions when present

---

### Hybrid RAG Validation

```
┌─────────────────────────────────────────────────────────────┐
│ BACKEND TEST: Hybrid RAG (pgvector + Neo4j)                 │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TEST: Semantic Search (pgvector)                           │
│  ─────────────────────────────────                          │
│  Query: "What is the company's revenue?"                    │
│  Expected:                                                  │
│  □ Finds findings about revenue via embedding similarity    │
│  □ Returns top-k most relevant findings                     │
│  □ Confidence scores reflect relevance                      │
│                                                             │
│  TEST: Relationship Traversal (Neo4j)                       │
│  ────────────────────────────────────                       │
│  Given: Finding about revenue                               │
│  Expected:                                                  │
│  □ Traverses to SUPPORTING findings (more context)          │
│  □ Identifies CONTRADICTING findings (flags conflict)       │
│  □ Finds SUPERSEDING findings (uses most recent)            │
│                                                             │
│  TEST: Q&A Priority                                         │
│  ────────────────────                                       │
│  Setup: Add Q&A item "Revenue confirmed as $10M"            │
│  Query: "What is the revenue?"                              │
│  Expected:                                                  │
│  □ Q&A answer prioritized over document findings            │
│  □ Agent cites Q&A as primary source                        │
│  □ Document findings shown as supporting                    │
│                                                             │
│  TEST: Hybrid Combination                                   │
│  ────────────────────────                                   │
│  Query: Complex question spanning multiple topics           │
│  Expected:                                                  │
│  □ pgvector finds semantically relevant chunks              │
│  □ Neo4j expands with related findings                      │
│  □ Results deduplicated and ranked                          │
│  □ Agent synthesizes coherent answer                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Test Cases - RAG:**
- [ ] TB.22: Semantic search returns relevant findings
- [ ] TB.23: Search results include confidence scores
- [ ] TB.24: Neo4j traversal finds related findings
- [ ] TB.25: Q&A items prioritized in retrieval
- [ ] TB.26: Contradictions surfaced in agent response
- [ ] TB.27: Agent cites specific sources with page numbers
- [ ] TB.28: Hybrid search combines pgvector + Neo4j

---

### Database Inspection Queries

Run these in **Supabase SQL Editor** to validate pipeline:

```sql
-- Check documents and their processing status
SELECT id, title, status, gcs_path, created_at
FROM documents
WHERE deal_id = '[YOUR_DEAL_ID]'
ORDER BY created_at DESC;

-- Check document chunks
SELECT dc.document_id, d.title, COUNT(*) as chunk_count,
       AVG(LENGTH(dc.content)) as avg_chunk_length
FROM document_chunks dc
JOIN documents d ON dc.document_id = d.id
WHERE d.deal_id = '[YOUR_DEAL_ID]'
GROUP BY dc.document_id, d.title;

-- Check findings and embeddings
SELECT id, title, category, confidence,
       CASE WHEN embedding IS NOT NULL THEN 'YES' ELSE 'NO' END as has_embedding
FROM findings
WHERE deal_id = '[YOUR_DEAL_ID]'
ORDER BY created_at DESC
LIMIT 20;

-- Check embedding dimensions
SELECT id, title, array_length(embedding, 1) as embedding_dims
FROM findings
WHERE embedding IS NOT NULL
AND deal_id = '[YOUR_DEAL_ID]'
LIMIT 5;

-- Test semantic search (requires actual embedding vector)
-- This is conceptual - actual query needs embedding
SELECT id, title, 1 - (embedding <=> '[query_embedding]') as similarity
FROM findings
WHERE deal_id = '[YOUR_DEAL_ID]'
AND embedding IS NOT NULL
ORDER BY embedding <=> '[query_embedding]'
LIMIT 5;
```

---

### Neo4j Inspection Queries

Run these in **Neo4j Browser** (http://localhost:7474):

```cypher
-- Count all nodes by type
MATCH (n)
RETURN labels(n) as type, count(n) as count;

-- Count all relationships by type
MATCH ()-[r]->()
RETURN type(r) as relationship, count(r) as count;

-- View Document → Finding relationships
MATCH (d:Document)-[:FROM_DOCUMENT]->(f:Finding)
RETURN d.title, collect(f.title)[0..3] as sample_findings, count(f) as finding_count
LIMIT 10;

-- Find SUPPORTS relationships
MATCH (f1:Finding)-[r:SUPPORTS]->(f2:Finding)
RETURN f1.title as finding1, f2.title as finding2, r.confidence
LIMIT 10;

-- Find CONTRADICTS relationships
MATCH (f1:Finding)-[r:CONTRADICTS]->(f2:Finding)
RETURN f1.title as finding1, f2.title as finding2, r.reason
LIMIT 10;

-- Visualize a deal's knowledge graph (limit nodes)
MATCH (d:Document {dealId: '[YOUR_DEAL_ID]'})-[r]-(connected)
RETURN d, r, connected
LIMIT 50;

-- Find findings with most connections
MATCH (f:Finding)
WHERE f.dealId = '[YOUR_DEAL_ID]'
WITH f, size((f)-[]-()) as connections
ORDER BY connections DESC
RETURN f.title, connections
LIMIT 10;
```

---

### manda-processing Service Validation

The Python processing service needs to be running for document parsing:

```bash
# Navigate to processing service
cd manda-processing

# Check if dependencies installed
pip list | grep docling

# Start the service (check how it's intended to run)
# Option 1: Direct Python
python -m src.main

# Option 2: With uvicorn (if FastAPI)
uvicorn src.main:app --reload --port 8001

# Option 3: Check if there's a docker-compose
docker-compose up manda-processing
```

**Service Validation Test Cases:**
- [ ] TB.29: manda-processing service starts without errors
- [ ] TB.30: Service can connect to Supabase
- [ ] TB.31: Service can connect to GCS bucket
- [ ] TB.32: Test parse endpoint with sample PDF
- [ ] TB.33: Chunking produces expected results
- [ ] TB.34: Service can write to document_chunks table

---

## Technical Validation

### Neo4j Validation

```cypher
-- Run in Neo4j Browser (http://localhost:7474)

-- Check nodes exist
MATCH (n) RETURN labels(n), count(n);

-- Check relationships
MATCH ()-[r]->() RETURN type(r), count(r);

-- Test SUPPORTS relationship
MATCH (f1:Finding)-[:SUPPORTS]->(f2:Finding)
RETURN f1.id, f2.id LIMIT 5;

-- Test CONTRADICTS relationship
MATCH (f1:Finding)-[:CONTRADICTS]->(f2:Finding)
RETURN f1.id, f2.id LIMIT 5;
```

**Neo4j Test Cases:**
- [ ] TN.1: Neo4j container starts successfully
- [ ] TN.2: Can connect via bolt://localhost:7687
- [ ] TN.3: Finding nodes are created when documents processed
- [ ] TN.4: SUPPORTS relationships are created
- [ ] TN.5: CONTRADICTS relationships are created
- [ ] TN.6: Relationship queries return results in agent

---

### pgvector Validation

```sql
-- Run in Supabase SQL Editor

-- Check embeddings exist
SELECT COUNT(*) FROM findings WHERE embedding IS NOT NULL;

-- Test semantic search
SELECT id, title, 1 - (embedding <=> '[embedding_vector]') as similarity
FROM findings
ORDER BY embedding <=> '[embedding_vector]'
LIMIT 5;

-- Check match_findings RPC exists
SELECT routine_name FROM information_schema.routines
WHERE routine_name = 'match_findings';
```

**pgvector Test Cases:**
- [ ] TV.1: Findings have embeddings populated
- [ ] TV.2: match_findings RPC exists and works
- [ ] TV.3: Semantic search returns relevant results
- [ ] TV.4: Agent RAG uses vector search correctly

---

### LangGraph Validation (CIM Agent)

**LangGraph Test Cases:**
- [ ] TL.1: CIM workflow state persists to database
- [ ] TL.2: Phase transitions work correctly
- [ ] TL.3: Resume from previous state works
- [ ] TL.4: Tool calls execute successfully
- [ ] TL.5: Streaming responses work
- [ ] TL.6: Error recovery and retry logic works

---

### Context Window Monitoring

During testing, monitor these metrics:

| Metric | How to Measure | Target |
|--------|---------------|--------|
| Tokens per message | Check LLM API logs | Track growth |
| Context size over conversation | Count messages × avg tokens | <100K tokens |
| Response latency | Stopwatch / network tab | <5 seconds |
| Token usage per session | OpenAI dashboard | Track daily |

---

## Technical Debt Items

| # | Item | Priority | Effort |
|---|------|----------|--------|
| TD.1 | Fix CIM_TOOL_COUNT test assertions | High | 1h |
| TD.2 | Resolve 15 failing tests in tools.test.ts | High | 2h |
| TD.3 | Standardize story status format | Low | 30m |
| TD.4 | Document match_document_chunks RPC gap | Medium | 1h |
| TD.5 | Clean up console warnings/errors | Medium | 2h |

---

## Bug Report Template

When logging bugs in Jira, use this format:

```
Title: [AREA] Brief description

**Environment:**
- Browser: Chrome/Safari/Firefox
- OS: macOS
- App Version: localhost:3000

**Steps to Reproduce:**
1. Go to...
2. Click on...
3. Enter...
4. Observe...

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happened

**Screenshots/Logs:**
Attach any relevant screenshots or console logs

**Severity:**
- Critical: App crashes / data loss
- High: Feature broken, no workaround
- Medium: Feature broken, workaround exists
- Low: Cosmetic / minor inconvenience
```

---

## Daily Testing Log Template

```markdown
# Testing Log - [DATE]

## Focus Area
[Which journey/feature tested today]

## Tests Completed
- [ ] Test ID: Result (Pass/Fail)
- [ ] Test ID: Result (Pass/Fail)

## Bugs Found
1. [JIRA-XXX] Brief description - Severity
2. [JIRA-XXX] Brief description - Severity

## Observations
- [Any UX friction, performance issues, or improvement ideas]

## Blockers
- [Anything preventing testing]

## Tomorrow's Plan
- [What to test next]
```

---

## Success Criteria

Testing Sprint is complete when:

1. [ ] All Journey test cases executed (T1.x - T8.x)
2. [ ] All Critical/High bugs fixed
3. [ ] Neo4j validation passed
4. [ ] pgvector validation passed
5. [ ] LangGraph validation passed
6. [ ] CIM end-to-end workflow works
7. [ ] Technical debt items addressed
8. [ ] Context window usage documented
9. [ ] No blocking issues remain

---

## Post-Testing Deliverables

1. **Bug Summary Report** - All bugs found, fixed, and remaining
2. **Performance Baseline** - Response times, token usage
3. **User Journey Validation** - Which journeys work, which need improvement
4. **Technical Findings** - Neo4j, pgvector, LangGraph status
5. **Phase 2 Readiness Assessment** - Go/No-Go for starting E10

---

*Created: 2025-12-11*
*Sprint Start: 2025-12-11*
*Sprint End: TBD (1+ week)*
