# Manda Platform - Consolidated PRD for Testsprite
# M&A Intelligence Platform with Conversational AI

**Version:** 1.0
**Date:** 2026-01-14
**Status:** Active Development
**Source Documents:** manda-prd.md (v2.4), agent-system-prd.md (v1.0)

---

## 1. Product Overview

### 1.1 Product Description

Manda is a B2B SaaS M&A intelligence platform that combines a secure deal data room with a conversational AI agent. The platform transforms how analysts work with complex deal information through:

- **Deal Data Room**: Secure document storage, organization, and versioning
- **Knowledge Graph**: Persistent storage of findings, insights, and relationships (Graphiti + Neo4j)
- **Conversational Agent**: Natural language interface with multi-turn memory and tool-calling
- **Workflow Support**: IRL tracking, Q&A co-creation, CIM (Confidential Information Memorandum) generation

### 1.2 Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | FastAPI (Python 3.12+), Next.js API Routes |
| Database | Supabase PostgreSQL, Neo4j (knowledge graph) |
| AI/ML | LangGraph, Claude Sonnet, Gemini Flash, Voyage embeddings |
| Storage | Google Cloud Storage (GCS) |
| Auth | Supabase Auth |
| Queue | pg-boss |

### 1.3 Application Entry Points

| Entry Point | Path | Description |
|-------------|------|-------------|
| Dashboard | `/projects` | List of deals/projects |
| Deal View | `/projects/[id]` | Single deal workspace |
| Chat | `/projects/[id]/chat` | Conversational AI interface |
| CIM Builder | `/projects/[id]/cim-builder` | CIM creation workflow |
| Data Room | `/projects/[id]/data-room` | Document management |
| Q&A | `/projects/[id]/qa` | Q&A list management |

---

## 2. User Personas

### 2.1 Primary: M&A Analyst/Associate

- **Context**: Investment banking or private equity professional
- **Goals**: Analyze complex deal documents, surface insights, create CIMs, manage Q&A with clients
- **Pain Points**: Information overload, manual synthesis, scattered findings, repetitive document review

### 2.2 Secondary: Deal Team Lead

- **Context**: Senior associate or director overseeing multiple deals
- **Goals**: Review analysis quality, approve deliverables, track deal progress
- **Pain Points**: Quality consistency, coverage completeness, time constraints

---

## 3. Core Features & User Stories

### 3.1 Authentication & Project Management

#### US-AUTH-001: User Login
**As a** user,
**I want to** securely log in to the platform,
**So that** I can access my deals and data.

**Acceptance Criteria:**
- [ ] User can log in with email/password via Supabase Auth
- [ ] Invalid credentials show clear error message
- [ ] Session persists across browser refreshes
- [ ] User is redirected to dashboard after login

#### US-AUTH-002: Project/Deal Creation
**As a** user,
**I want to** create a new deal/project,
**So that** I can start organizing deal documents and analysis.

**Acceptance Criteria:**
- [ ] User can create project with name and optional description
- [ ] Project appears in dashboard after creation
- [ ] User is owner of created project
- [ ] Empty project has default folder structure ready

---

### 3.2 Document Management (Data Room)

#### US-DOC-001: Document Upload
**As a** user,
**I want to** upload documents to the data room,
**So that** they can be processed and analyzed.

**Acceptance Criteria:**
- [ ] User can upload PDF, DOCX, XLSX files via drag-and-drop or file picker
- [ ] Upload progress is displayed during transfer
- [ ] Documents appear in folder after successful upload
- [ ] File size limit (100MB) is enforced with clear error
- [ ] Supported formats validated before upload starts

#### US-DOC-002: Document Organization
**As a** user,
**I want to** organize documents into folders,
**So that** I can maintain a structured data room.

**Acceptance Criteria:**
- [ ] User can create folders and subfolders
- [ ] User can move documents between folders via drag-and-drop
- [ ] User can rename documents and folders
- [ ] User can delete documents (with confirmation)
- [ ] Folder hierarchy displays correctly in sidebar

#### US-DOC-003: IRL-Based Folder Generation
**As a** user,
**I want to** upload an Information Request List (IRL) to auto-generate folders,
**So that** my data room structure matches the deal requirements.

**Acceptance Criteria:**
- [ ] User can upload IRL in Excel/CSV format
- [ ] System detects hierarchical structure (categories, subcategories)
- [ ] Preview shows detected structure before confirmation
- [ ] Folders are created in GCS matching IRL hierarchy
- [ ] User can modify folder structure after generation

#### US-DOC-004: Document Processing
**As a** user,
**I want** uploaded documents to be automatically processed,
**So that** their content becomes searchable and analyzable.

**Acceptance Criteria:**
- [ ] Documents enter processing queue on upload
- [ ] Processing status shown (queued, parsing, analyzing, complete, error)
- [ ] Parsed content is indexed in knowledge graph
- [ ] Excel formulas are preserved and extracted
- [ ] OCR is applied to scanned PDFs
- [ ] Processing errors are reported with retry option

---

### 3.3 Conversational Agent (Chat)

#### US-CHAT-001: Basic Conversation
**As a** user,
**I want to** have natural language conversations with the AI,
**So that** I can ask questions about my deal.

**Acceptance Criteria:**
- [ ] User can type messages in chat input
- [ ] AI responds with relevant, contextual answers
- [ ] Responses stream in real-time (token-by-token)
- [ ] Conversation displays in chat thread format
- [ ] User can send follow-up messages

#### US-CHAT-002: Conversation Memory
**As a** user,
**I want** the AI to remember our conversation,
**So that** I can reference earlier messages.

**Acceptance Criteria:**
- [ ] User can ask "what was my first question?" and get correct answer
- [ ] Conversation persists across browser refreshes
- [ ] Context from earlier messages informs later responses
- [ ] Thread history is saved to database (PostgresSaver)

#### US-CHAT-003: Knowledge Graph Queries
**As a** user,
**I want** to ask questions about deal documents,
**So that** I can get sourced answers from my data.

**Acceptance Criteria:**
- [ ] Agent searches knowledge graph for relevant context
- [ ] Responses include source attribution (document, page, section)
- [ ] Agent uses appropriate search method (vector, keyword, graph traversal)
- [ ] "I don't know" responses only when data genuinely missing

#### US-CHAT-004: Greeting and Casual Conversation
**As a** user,
**I want** natural responses to greetings,
**So that** the interaction feels conversational.

**Acceptance Criteria:**
- [ ] "Hello" receives friendly greeting, not document search error
- [ ] Casual questions get appropriate responses
- [ ] No hardcoded "I don't see that in documents" for non-document queries

#### US-CHAT-005: Multimodal Input
**As a** user,
**I want to** upload images in chat,
**So that** I can analyze screenshots or charts.

**Acceptance Criteria:**
- [ ] User can drag-and-drop images into chat
- [ ] AI analyzes image content
- [ ] Image analysis can reference knowledge graph data
- [ ] Supported formats: PNG, JPG, WEBP

#### US-CHAT-006: Complex Task Planning
**As a** user,
**I want** the AI to present plans for complex tasks,
**So that** I can approve before execution.

**Acceptance Criteria:**
- [ ] Multi-step tasks show plan with numbered steps
- [ ] User sees [Approve] [Modify] [Cancel] buttons
- [ ] Execution waits for user approval
- [ ] Progress streams during execution
- [ ] Simple queries execute without approval

#### US-CHAT-007: Q&A Suggestion
**As a** user,
**I want** the AI to suggest Q&A entries when information is missing,
**So that** I can track questions for the client.

**Acceptance Criteria:**
- [ ] Agent detects information gaps during analysis
- [ ] Suggests adding to Q&A list with context
- [ ] [Add to Q&A] button adds with one click
- [ ] [Skip] dismisses the suggestion
- [ ] Q&A entry includes source document reference

---

### 3.4 CIM Builder

#### US-CIM-001: CIM Creation Workflow
**As a** user,
**I want to** create a CIM through guided conversation,
**So that** I can build a professional pitch document.

**Acceptance Criteria:**
- [ ] User can start new CIM from CIM Builder page
- [ ] Agent guides through buyer persona selection
- [ ] Agent proposes investment thesis based on knowledge base
- [ ] User can define CIM structure/outline collaboratively

#### US-CIM-002: Slide Content Creation
**As a** user,
**I want to** create slide content with AI assistance,
**So that** I can build CIM sections efficiently.

**Acceptance Criteria:**
- [ ] Agent presents content options with source citations
- [ ] User can approve, modify, or request alternatives
- [ ] Approved content updates slide in preview panel
- [ ] Context flows forward (thesis informs all content)

#### US-CIM-003: CIM Preview
**As a** user,
**I want to** preview CIM slides in real-time,
**So that** I can see how the document is shaping up.

**Acceptance Criteria:**
- [ ] Right panel shows wireframe slide preview
- [ ] Slides update as content is approved
- [ ] Click on slide element to discuss/edit
- [ ] Visual concepts display correctly

#### US-CIM-004: CIM Export
**As a** user,
**I want to** export the CIM to PowerPoint,
**So that** I can use it in my deal process.

**Acceptance Criteria:**
- [ ] User can export to .pptx format
- [ ] Export includes all approved slides
- [ ] File saves to project's CIM folder
- [ ] Export includes version timestamp

---

### 3.5 Q&A Management

#### US-QA-001: Q&A List View
**As a** user,
**I want to** view all Q&A entries in a table,
**So that** I can manage questions for the client.

**Acceptance Criteria:**
- [ ] Q&A displays in sortable table format
- [ ] Columns: Question, Priority, Category, Status, Date Added
- [ ] User can filter by category and priority
- [ ] User can search questions

#### US-QA-002: Q&A Entry Management
**As a** user,
**I want to** add, edit, and delete Q&A entries,
**So that** I can maintain an accurate list.

**Acceptance Criteria:**
- [ ] User can add new Q&A entry manually
- [ ] User can edit existing entries inline
- [ ] User can delete entries (with confirmation)
- [ ] User can mark entries as answered

#### US-QA-003: Q&A Export
**As a** user,
**I want to** export Q&A to Excel,
**So that** I can send it to the client.

**Acceptance Criteria:**
- [ ] Export generates .xlsx file
- [ ] Includes Question, Priority, Answer, Date columns
- [ ] Category used for grouping
- [ ] Professional formatting for client distribution

#### US-QA-004: Q&A Import
**As a** user,
**I want to** import answered Q&A from Excel,
**So that** client responses are captured.

**Acceptance Criteria:**
- [ ] User can upload Excel with answers
- [ ] System matches questions (exact or fuzzy >90%)
- [ ] Preview shows matches before import
- [ ] New questions from client can be imported
- [ ] Answers merge with existing entries

---

### 3.6 Knowledge Base & Learning

#### US-KB-001: Finding Storage
**As a** user,
**I want** the system to store findings with source attribution,
**So that** I can trace any fact to its source.

**Acceptance Criteria:**
- [ ] Findings stored with document, page, section reference
- [ ] Confidence scores assigned to extracted data
- [ ] Cross-references tracked between related findings
- [ ] Temporal tracking (when discovered, last updated)

#### US-KB-002: Contradiction Detection
**As a** user,
**I want** the system to flag contradictions,
**So that** I can identify data inconsistencies.

**Acceptance Criteria:**
- [ ] System detects conflicting information across documents
- [ ] Contradictions surfaced with both sources
- [ ] User can resolve (accept one, flag for investigation)
- [ ] Resolution tracked in audit trail

#### US-KB-003: User Corrections
**As a** user,
**I want to** correct system findings,
**So that** the knowledge base stays accurate.

**Acceptance Criteria:**
- [ ] User can edit findings via chat or UI
- [ ] Corrections update knowledge graph
- [ ] Original value preserved in history
- [ ] System confidence adjusts based on corrections

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target |
|--------|--------|
| First token latency (chat) | < 2 seconds |
| Document upload feedback | Immediate |
| Knowledge graph query | < 500ms |
| Page load time | < 3 seconds |
| Concurrent users per deal | No artificial limit |

### 4.2 Security

| Requirement | Implementation |
|-------------|----------------|
| Data encryption | At rest and in transit |
| Authentication | Supabase Auth with session management |
| Authorization | RLS policies on all tables |
| Multi-tenancy | project_id isolation on all queries |
| Data residency | EU data centers |

### 4.3 Reliability

| Metric | Target |
|--------|--------|
| Uptime | 99.9% |
| Data durability | Zero data loss |
| Checkpoint integrity | All state persisted before ack |
| Error recovery | Graceful degradation |

### 4.4 Accessibility

| Requirement | Standard |
|-------------|----------|
| Keyboard navigation | Full support |
| Screen reader | WCAG 2.1 AA |
| Color contrast | 4.5:1 minimum |
| Zoom support | Up to 200% |

---

## 5. API Endpoints

### 5.1 Project APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List user's projects |
| POST | `/api/projects` | Create new project |
| GET | `/api/projects/[id]` | Get project details |
| PATCH | `/api/projects/[id]` | Update project |
| DELETE | `/api/projects/[id]` | Delete project |

### 5.2 Document APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/[id]/documents` | Upload document |
| GET | `/api/projects/[id]/documents` | List documents |
| DELETE | `/api/projects/[id]/documents/[docId]` | Delete document |
| GET | `/api/projects/[id]/folders` | Get folder structure |
| POST | `/api/projects/[id]/folders` | Create folder |

### 5.3 Chat APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/[id]/chat` | Send chat message (SSE streaming) |
| GET | `/api/projects/[id]/conversations` | List conversations |
| GET | `/api/projects/[id]/conversations/[convId]` | Get conversation history |

### 5.4 CIM APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/projects/[id]/cims` | Create new CIM |
| GET | `/api/projects/[id]/cims` | List CIMs |
| GET | `/api/projects/[id]/cims/[cimId]` | Get CIM details |
| POST | `/api/projects/[id]/cims/[cimId]/chat-mvp` | CIM chat (SSE streaming) |
| POST | `/api/projects/[id]/cims/[cimId]/export` | Export CIM to PPTX |

### 5.5 Q&A APIs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects/[id]/qa` | List Q&A entries |
| POST | `/api/projects/[id]/qa` | Create Q&A entry |
| PATCH | `/api/projects/[id]/qa/[qaId]` | Update Q&A entry |
| DELETE | `/api/projects/[id]/qa/[qaId]` | Delete Q&A entry |
| POST | `/api/projects/[id]/qa/export` | Export to Excel |
| POST | `/api/projects/[id]/qa/import` | Import from Excel |

---

## 6. Database Schema (Key Tables)

### 6.1 Core Tables

```
projects
├── id (uuid, PK)
├── name (text)
├── description (text)
├── owner_id (uuid, FK → auth.users)
├── created_at (timestamp)
└── updated_at (timestamp)

documents
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── name (text)
├── gcs_path (text)
├── mime_type (text)
├── status (enum: pending, processing, complete, error)
├── folder_id (uuid, FK → folders)
└── created_at (timestamp)

folders
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── name (text)
├── parent_id (uuid, FK → folders, nullable)
├── gcs_path (text)
└── created_at (timestamp)

conversations
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── user_id (uuid, FK → auth.users)
├── title (text)
├── created_at (timestamp)
└── updated_at (timestamp)

cims
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── title (text)
├── buyer_persona (jsonb)
├── workflow_state (jsonb)
├── slides (jsonb)
├── status (enum: draft, in_progress, complete)
└── created_at (timestamp)

qa_entries
├── id (uuid, PK)
├── project_id (uuid, FK → projects)
├── question (text)
├── answer (text, nullable)
├── category (text)
├── priority (enum: high, medium, low)
├── status (enum: pending, answered)
├── source_document_id (uuid, FK → documents, nullable)
├── date_added (timestamp)
└── date_answered (timestamp, nullable)
```

---

## 7. Test Scenarios (Priority Order)

### 7.1 Critical Path (P0)

1. **User Authentication Flow**
   - Login with valid credentials → Dashboard
   - Login with invalid credentials → Error message
   - Session persistence → Refresh maintains login

2. **Document Upload & Processing**
   - Upload PDF → Processing starts → Status shows complete
   - Upload XLSX → Excel formulas extracted
   - Upload invalid format → Error message

3. **Chat Conversation**
   - Send message → Streaming response received
   - Follow-up question → Context maintained
   - Knowledge query → Source-attributed answer

4. **CIM Builder Workflow**
   - Start CIM → Buyer persona selection
   - Approve content → Slide preview updates
   - Export → PPTX file generated

### 7.2 Important (P1)

5. **Q&A Management**
   - Add entry → Appears in table
   - Export → Excel generated
   - Import → Answers merged

6. **Data Room Organization**
   - Create folder → Appears in hierarchy
   - Move document → Updates location
   - Delete document → Removed with confirmation

### 7.3 Standard (P2)

7. **Error Handling**
   - Network failure during upload → Retry option
   - Chat API timeout → Error message, conversation intact
   - Invalid file type → Clear rejection

8. **Edge Cases**
   - Empty project → Graceful empty states
   - Long conversation → Memory maintained
   - Concurrent edits → Conflict handling

---

## 8. Glossary

| Term | Definition |
|------|------------|
| CIM | Confidential Information Memorandum - a pitch document for selling a company |
| IRL | Information Request List - checklist of documents needed for due diligence |
| Knowledge Graph | Neo4j-based storage of entities, relationships, and findings |
| Deal | A project representing an M&A transaction |
| Finding | An extracted fact with source attribution |
| Q&A | Question and Answer list sent to client for clarification |

---

## 9. References

- [Full Platform PRD](manda-prd.md) - Comprehensive platform requirements
- [Agent System PRD](../_bmad-output/planning-artifacts/agent-system-prd.md) - Conversational AI specifications
- [Architecture Document](manda-architecture.md) - Technical implementation details
- [Agent Behavior Spec](agent-behavior-spec.md) - Agent response formatting

---

*This document consolidates requirements from the Manda Platform PRD (v2.4) and Agent System PRD for use with Testsprite automated testing.*
