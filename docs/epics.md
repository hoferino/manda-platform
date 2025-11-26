# Manda - Epic and Story Breakdown

**Document Status:** Complete (MVP Epics E1-E9)
**Created:** 2025-11-19
**Last Updated:** 2025-11-24
**Owner:** Max
**Version:** 2.2 (Infrastructure decisions: Supabase retained for MVP, Epic 3 uses Docling + Vertex AI RAG Engine hybrid, Cloud Run deployment target, future GCP migration path documented)

---

## Executive Summary

This document breaks down the Manda M&A Intelligence Platform into epics and stories based on **user value delivery**. Each epic delivers something users can actually use and benefit from, rather than organizing by technical layers.

**Source Documents:**
- PRD: [manda-prd.md](./manda-prd.md)
- UX Design: [ux-design-specification.md](./ux-design-specification.md)
- Architecture: [manda-architecture.md](./manda-architecture.md)

**Development Approach:**
- **Epic Structure:** User value first (not technical layers)
- **Story Size:** Small, implementable within 1-3 days
- **Acceptance Criteria:** BDD format (Given/When/Then)
- **FR Traceability:** All stories mapped to functional requirements

---

## Epic Overview

### Phase 1: MVP Epics (Core M&A Workflow)

| Epic # | Epic Name | User Value | Stories | Priority |
|--------|-----------|------------|---------|----------|
| E1 | Project Foundation | Users can create and manage project instances | 9 | P0 |
| E2 | Document Ingestion & Storage | Users can upload, organize, and track documents | 8 | P0 |
| E3 | Intelligent Document Processing | Users get automated analysis and findings from documents | 9 | P0 |
| E4 | Collaborative Knowledge Workflow | Users can capture, validate, and manage findings collaboratively with AI | 14 | P0 |
| E5 | Conversational Assistant | Users can query knowledge through natural language (11 chat tools) | 9 | P0 |
| E6 | IRL Management & Auto-Generation | Users can create IRLs and auto-generate Data Room folder structures | 8 | P0 |
| E7 | Learning Loop | System learns from analyst corrections and feedback to improve over time | 6 | P0 |
| E8 | Q&A Co-Creation Workflow | Users can collaboratively build Q&A lists with AI assistance | 8 | P1 |
| E9 | CIM Company Overview Creation (CIM v3 Workflow) | Users can create Company Overview chapters through 14-phase deeply interactive workflow | 9 | P1 |

**Total Stories (MVP):** 80

### Phase 2: Enhancement Epics (Platform Enhancement)

| Epic # | Epic Name | User Value | Stories | Priority |
|--------|-----------|------------|---------|----------|
| E10 | Smart Document Classification | Users get AI-assisted document classification with approval workflow | 8 | P2 |
| E11 | Advanced Data Room Features | Users get enhanced organization and collaboration | 6 | P2 |
| E12 | External Data Integration | Users can connect external data sources | 5 | P2 |
| E13 | Advanced CIM Features | Users get richer CIM capabilities | 6 | P2 |

**Total Stories (Phase 2):** 25

### Phase 3: Intelligence Epics (Competitive Moat)

| Epic # | Epic Name | User Value | Stories | Priority |
|--------|-----------|------------|---------|----------|
| E14 | Cross-Domain Intelligence Engine | Users get proactive pattern detection across domains (11+ patterns) | 12 | P3 |
| E15 | Proactive Insight Surfacing | System proactively alerts users to critical patterns | 5 | P3 |

**Total Stories (Phase 3):** 17

---

## Phase 1: MVP Epics (Detailed Breakdown)

---

## Epic 1: Project Foundation

**User Value:** Users can create and manage isolated project instances with clear navigation

**Description:** Implements the core project management infrastructure, allowing analysts to create projects, switch between them, and work within isolated project workspaces. Each project is a completely isolated instance with its own data room, knowledge base, and deliverables.

**Functional Requirements Covered:**
- FR-ARCH-001: Platform-Agent Separation
- FR-ARCH-002: Tool-Based Agent Integration
- FR-ARCH-003: Scalable Service Architecture

**UX Screens:**
- Projects Overview (Landing)
- Project Workspace Shell
- Top Navigation Bar
- Sidebar Navigation

**Technical Foundation:**
- Next.js 15 app structure (React 19.2, Turbopack beta)
- Supabase Auth setup
- PostgreSQL 18 schema (deals table)
- RLS policies for data isolation
- Docker Compose development environment

**Acceptance Criteria (Epic Level):**
- ✅ User can create new project with basic metadata
- ✅ User can see all their projects in overview
- ✅ User can switch between projects
- ✅ Each project workspace shows project-specific data only
- ✅ Data is completely isolated per project (RLS enforced)

### Stories

#### Story E1.1: Set up Next.js 14 Project with shadcn/ui

**As a** developer
**I want** a properly configured Next.js 14 project with shadcn/ui
**So that** I have the foundation for building the frontend

**Description:**
Initialize the Next.js 14 project with App Router, configure Tailwind CSS, install and configure shadcn/ui components, and set up the base project structure.

**Technical Details:**
- Use Next.js 14.2+ with App Router
- Configure Tailwind CSS 3+
- Install shadcn/ui with default theme
- Set up base folder structure (`app/`, `components/`, `lib/`, `hooks/`)
- Configure TypeScript strict mode

**Acceptance Criteria:**

```gherkin
Given I have Node.js 18+ installed
When I run `npm run dev`
Then the Next.js dev server starts on localhost:3000
And I can see a basic landing page

Given shadcn/ui is configured
When I import a Button component
Then it renders with Tailwind styling
And the component follows shadcn/ui design patterns

Given TypeScript is configured
When I add type errors
Then the build fails with clear error messages
```

**Related FR:** FR-ARCH-001 (Platform foundation)

**UX Reference:** Design System Foundation (Section 2)

**Definition of Done:**
- [ ] Next.js 14 project initialized with App Router
- [ ] Tailwind CSS configured and working
- [ ] shadcn/ui installed with 5+ base components (Button, Input, Card, Badge, Label)
- [ ] TypeScript configured with strict mode
- [ ] Project structure matches documented architecture
- [ ] Dev server runs without errors
- [ ] Basic test page renders shadcn/ui components

---

#### Story E1.2: Configure Supabase Auth and Database Connection

**As a** developer
**I want** Supabase authentication and database configured
**So that** users can securely authenticate and access project data

**Description:**
Set up Supabase project, configure authentication providers (email/password, magic links), establish database connection, and implement Row-Level Security (RLS) policies for multi-tenant data isolation.

**Technical Details:**
- Create Supabase project
- Configure Supabase Auth with email/password + magic links
- Set up environment variables (`.env.local`)
- Create Supabase client utilities (`lib/supabase/client.ts`, `lib/supabase/server.ts`)
- Implement auth middleware for protected routes

**Acceptance Criteria:**

```gherkin
Given Supabase is configured
When a user signs up with email/password
Then their account is created in Supabase Auth
And they receive a confirmation email
And they can sign in after confirming

Given a user is authenticated
When they make a database query
Then RLS policies enforce user-level access
And they cannot see other users' data

Given auth middleware is configured
When an unauthenticated user accesses `/projects`
Then they are redirected to `/login`

Given a user signs in
When they are redirected to the app
Then the auth state is persisted
And subsequent requests use their session
```

**Related FR:**
- NFR-SEC-001: Data Confidentiality
- NFR-SEC-002: Authentication & Authorization

**Architecture Reference:** Authentication & Authorization (Section in Architecture)

**Definition of Done:**
- [ ] Supabase project created and configured
- [ ] Email/password authentication working
- [ ] Magic link authentication working
- [ ] Supabase client utilities implemented
- [ ] Auth middleware protects routes
- [ ] Environment variables documented
- [ ] RLS policies tested and enforced
- [ ] Auth state persists across page reloads

---

#### Story E1.3: Create PostgreSQL Schema with RLS Policies

**As a** developer
**I want** the complete PostgreSQL schema with RLS policies
**So that** project data is structured and secured

**Description:**
Create all PostgreSQL tables (deals, documents, findings, insights, conversations, messages, irls, qa_lists, cims) with proper indexes, foreign keys, and Row-Level Security policies to ensure complete data isolation per user.

**Technical Details:**
- Create migration scripts using Supabase migrations
- Implement all tables from architecture document
- Add indexes for performance (deal_id, user_id, vector indexes)
- Create RLS policies: users can only access their own deals
- Enable pgvector extension

**Acceptance Criteria:**

```gherkin
Given the database migration runs
When I query the schema
Then all tables exist with correct columns and types
And foreign key constraints are enforced
And indexes are created

Given RLS is enabled on all tables
When User A creates a deal
Then only User A can see that deal
And User B cannot query or access it

Given pgvector is enabled
When I insert a finding with an embedding
Then the vector is stored correctly
And I can perform similarity search

Given proper indexes exist
When I query deals by user_id
Then the query uses the index (EXPLAIN shows index scan)
```

**Related FR:**
- FR-KB-001: Structured Knowledge Storage
- NFR-SEC-001: Data Confidentiality
- NFR-PERF-003: Scalability

**Architecture Reference:** PostgreSQL Schema (Data Architecture section)

**Definition of Done:**
- [ ] All tables created via migration
- [ ] Foreign keys and constraints working
- [ ] Indexes created on key columns
- [ ] pgvector extension enabled
- [ ] RLS policies enforce user isolation
- [ ] Migration can be rolled back
- [ ] Schema documented in migration file
- [ ] Test data can be inserted and queried

---

#### Story E1.4: Build Projects Overview Screen (Landing)

**As an** M&A analyst
**I want** to see all my projects in a clear overview
**So that** I can quickly access the project I'm working on

**Description:**
Implement the Projects Overview landing screen with card grid and table views, showing project metadata, status, progress indicators, and quick actions. This is the first screen users see after login.

**Technical Details:**
- Create `/projects` route (App Router)
- Implement card grid view (default)
- Implement table view (alternative)
- Add view toggle (card ↔ table)
- Fetch projects from Supabase (deals table)
- Show project metadata: name, company, status, progress, last activity
- Empty state for first-time users

**Acceptance Criteria:**

```gherkin
Given I am authenticated
When I navigate to the app
Then I land on the Projects Overview screen
And I see all my projects in card grid view

Given I have 3 projects
When I view the Projects Overview
Then I see 3 project cards
And each card shows: name, company, status badge, progress, last activity

Given I click the view toggle
When I switch to table view
Then projects display in a table
And I can sort by name, date, progress

Given I have no projects yet
When I view Projects Overview
Then I see an empty state
And a "Create Your First Project" button

Given another user has projects
When I view my Projects Overview
Then I only see my own projects (RLS enforced)
```

**Related FR:**
- FR-DOC-002: Document Organization (applied to projects)

**UX Reference:** Projects Overview (Section 3)

**Definition of Done:**
- [ ] `/projects` route renders correctly
- [ ] Card grid view displays all user's projects
- [ ] Table view available with toggle
- [ ] Project metadata displayed correctly
- [ ] Empty state implemented
- [ ] RLS verified (only user's projects shown)
- [ ] Responsive on desktop and tablet
- [ ] Loading states implemented

---

#### Story E1.5: Implement Project Creation Wizard

**As an** M&A analyst
**I want** to create a new project through a guided wizard
**So that** I can quickly set up a project with the right configuration

**Description:**
Build a 3-step project creation wizard that guides users through project setup: basics (name, company, industry), project type selection, and IRL template selection. Upon completion, redirect to the new project's dashboard.

**Technical Details:**
- Create modal/page for wizard
- Step 1: Project basics (name, company name, industry dropdown)
- Step 2: Project type selection (Tech M&A, Industrial, Pharma, Custom)
- Step 3: IRL template auto-suggested based on type
- Progress indicator (1/3, 2/3, 3/3)
- Insert deal record into Supabase
- Redirect to `/projects/[id]/dashboard` after creation

**Acceptance Criteria:**

```gherkin
Given I click "+ New Project" on Projects Overview
When the wizard opens
Then I see Step 1: Project Basics
And fields for: Project Name, Company Name, Industry

Given I fill out Step 1
When I click Next
Then I proceed to Step 2: Project Type
And I see options: Tech M&A, Industrial, Pharma, Custom

Given I select "Tech M&A" on Step 2
When I click Next
Then I proceed to Step 3
And the IRL template is auto-suggested as "Tech M&A IRL"

Given I complete all 3 steps
When I click "Create Project"
Then a new deal record is created in the database
And I am redirected to the project dashboard
And the project appears in Projects Overview

Given I close the wizard mid-way
When I reopen Projects Overview
Then no partial project is created
```

**Related FR:**
- FR-IRL-001: IRL Creation (template selection)

**UX Reference:** Projects Overview (Section 3.1 - New Project Flow)

**Definition of Done:**
- [ ] Wizard modal/page implemented
- [ ] All 3 steps functional
- [ ] Progress indicator shows current step
- [ ] Form validation on each step
- [ ] Deal created in database on completion
- [ ] Redirect to project dashboard works
- [ ] Cancel/close clears wizard state
- [ ] Industry dropdown populated
- [ ] Project type selection saves to database

---

#### Story E1.6: Build Project Workspace Shell with Navigation

**As an** M&A analyst
**I want** a consistent workspace layout when I enter a project
**So that** I can easily navigate between project areas

**Description:**
Create the Project Workspace shell with top navigation bar (showing project name, status, notifications) and sidebar navigation (Dashboard, Data Room, Knowledge Explorer, Chat, Deliverables). This provides the container for all project-specific screens.

**Technical Details:**
- Create `/projects/[id]/` layout component
- Implement top navigation bar (project name, status dropdown, notifications bell, user menu)
- Implement sidebar navigation (5 main areas)
- Active state indication for current section
- Collapsible sidebar (icon-only mode)
- Breadcrumb navigation
- Fetch project metadata from Supabase

**Acceptance Criteria:**

```gherkin
Given I navigate to a project
When the workspace loads
Then I see the top navigation bar with project name
And I see the sidebar with 5 navigation items
And the current section is highlighted

Given I click "Data Room" in the sidebar
When the route changes to `/projects/[id]/data-room`
Then "Data Room" is highlighted as active
And the Data Room screen loads in the main area

Given I click the sidebar collapse button
When the sidebar collapses
Then only icons are visible
And clicking again expands it

Given I click the project status dropdown
When I select "On Hold"
Then the project status updates in the database
And the badge reflects the new status

Given I click "← Projects" in the top bar
When I navigate back
Then I return to Projects Overview
And my project list is displayed
```

**Related FR:**
- FR-ARCH-001: Platform-Agent Separation (workspace organization)

**UX Reference:** Project Workspace (Section 4)

**Definition of Done:**
- [ ] Project workspace layout component created
- [ ] Top navigation bar implemented
- [ ] Sidebar navigation with 5 sections
- [ ] Active state highlights current section
- [ ] Sidebar collapse/expand works
- [ ] Project name fetched and displayed
- [ ] Status dropdown updates database
- [ ] Back to Projects button works
- [ ] Responsive on desktop and tablet
- [ ] RLS verified (only authorized user can access)

---

#### Story E1.6: Configure Neo4j Graph Database

**As a** developer
**I want** Neo4j graph database configured and connected
**So that** the system can store knowledge graph relationships for cross-domain analysis

**Description:**
Set up Neo4j graph database instance (local for dev, cloud for production), define node and relationship schemas for knowledge graph, configure connection from backend, and implement basic health checks.

**Technical Details:**
- Neo4j 5+ (use Neo4j AuraDB Free for dev, or Docker container)
- Node types: Deal, Document, Finding, Insight
- Relationship types: EXTRACTED_FROM, CONTRADICTS, SUPPORTS, PATTERN_DETECTED, BASED_ON
- Connection via neo4j-driver package
- Store connection string in environment variables
- Implement connection pooling

**Acceptance Criteria:**

```gherkin
Given Docker Compose is running
When I start the development environment
Then Neo4j container starts on port 7687
And Neo4j Browser is accessible on port 7474

Given the backend application starts
When it connects to Neo4j
Then the connection succeeds
And a health check query runs successfully

Given I create a test node via Cypher
When I query for that node
Then it is retrieved successfully
And relationships can be created between nodes

Given the node schemas are defined
When I review the documentation
Then I see clear definitions for Deal, Document, Finding, Insight nodes
And relationship types are documented
```

**Related FR:**
- FR-KB-001: Structured Knowledge Storage
- FR-KB-002: Source Attribution
- FR-KB-004: Cross-Document Analysis

**Architecture Reference:** Neo4j Graph Database (Architecture section on data models)

**Definition of Done:**
- [ ] Neo4j instance running (Docker Compose or AuraDB)
- [ ] Backend can connect to Neo4j
- [ ] Connection health check implemented
- [ ] Node schemas documented (Deal, Document, Finding, Insight)
- [ ] Relationship schemas documented (5 types)
- [ ] Environment variables configured
- [ ] Basic CRUD operations tested
- [ ] Connection pooling configured

---

#### Story E1.7: Configure pg-boss Job Queue

**As a** developer
**I want** pg-boss job queue configured
**So that** the system can process documents asynchronously in the background

**Description:**
Set up pg-boss (PostgreSQL-based job queue) for background processing of document parsing, analysis, and knowledge base updates. Configure job types, workers, and monitoring.

**Technical Details:**
- pg-boss npm package
- Uses existing PostgreSQL (Supabase) for job storage
- Job types: parse_document, generate_embeddings, analyze_document, update_graph
- Configure retry policies (3 attempts, exponential backoff)
- Set up job monitoring/status endpoints
- Worker pool size: 3 concurrent workers (configurable)

**Acceptance Criteria:**

```gherkin
Given the backend application starts
When pg-boss initializes
Then the job tables are created in PostgreSQL
And workers start listening for jobs

Given I enqueue a test job
When the worker picks it up
Then the job executes successfully
And the status updates to "completed"

Given a job fails
When it is retried
Then it retries up to 3 times with exponential backoff
And the final status is "failed" after 3 attempts

Given I check job status via API
When I query /api/jobs/:jobId
Then I see job status, progress, and error details
And I can view job queue metrics
```

**Related FR:**
- FR-BG-001: Event-Driven Architecture
- FR-BG-002: Processing Pipeline
- FR-BG-004: Processing Transparency

**Architecture Reference:** pg-boss Job Queue (Architecture section on background processing)

**Definition of Done:**
- [ ] pg-boss installed and configured
- [ ] Job types defined (4 types minimum)
- [ ] Workers start automatically with backend
- [ ] Retry policies configured
- [ ] Job status API endpoint implemented
- [ ] Job monitoring dashboard or endpoint
- [ ] Error handling and logging
- [ ] Worker pool size configurable
- [ ] Integration tests for job lifecycle

---

#### Story E1.8: Implement Audit Logging for Security Events

**As a** security administrator
**I want** all security-relevant events logged
**So that** I can track access, changes, and potential security incidents

**Description:**
Implement comprehensive audit logging for authentication, authorization, data access, and modifications. Store audit logs in dedicated table with tamper-proof design.

**Technical Details:**
- Create `audit_logs` table in PostgreSQL
- Fields: id, timestamp, user_id, deal_id, event_type, action, resource, details (JSONB), ip_address, user_agent
- Event types: auth_login, auth_logout, auth_failed, document_upload, document_delete, finding_create, finding_update, finding_delete
- Append-only table (no updates/deletes)
- Middleware to auto-log API calls
- Retention: 1 year minimum

**Acceptance Criteria:**

```gherkin
Given a user logs in
When authentication succeeds
Then an "auth_login" event is logged
And it includes user_id, timestamp, ip_address

Given a user uploads a document
When the upload completes
Then a "document_upload" event is logged
And it includes deal_id, document_id, file_name

Given a user tries to access another user's deal
When authorization fails (RLS)
Then an "access_denied" event is logged
And it includes attempted resource and user_id

Given I query audit logs as admin
When I filter by user_id or date range
Then I see all relevant events
And logs cannot be modified or deleted

Given 1 year has passed
When the retention policy runs
Then logs older than 1 year are archived
```

**Related FR:**
- NFR-SEC-002: Authentication & Authorization (audit log requirement)
- NFR-SEC-004: Document Security (access logs)

**Architecture Reference:** Security & Compliance section

**Definition of Done:**
- [ ] audit_logs table created (append-only)
- [ ] Logging middleware implemented
- [ ] All auth events logged
- [ ] All document events logged
- [ ] All finding events logged
- [ ] API to query audit logs (admin only)
- [ ] Logs include sufficient detail (JSONB)
- [ ] IP address and user agent captured
- [ ] RLS prevents users from seeing others' logs
- [ ] Retention policy documented

---

#### Story E1.8: Set up Neo4j Database for Knowledge Graph

**As a** developer
**I want** Neo4j database configured for knowledge graph storage
**So that** we can model relationships between findings, documents, and cross-domain patterns

**Description:**
Set up Neo4j database instance (Docker or Neo4j Aura), configure connection from backend, create initial node and relationship schemas for knowledge graph, and implement basic CRUD operations for graph data.

**Technical Details:**
- Set up Neo4j 2025.01 instance (Docker Compose for dev, Neo4j Aura for prod)
- Configure Neo4j connection in backend (`neo4j` Python driver)
- Define node types: Finding, Document, Entity, Pattern, Contradiction
- Define relationship types: SOURCED_FROM, CONTRADICTS, RELATED_TO, VALIDATES
- Create indexes on key properties (finding_id, document_id)
- Implement graph service layer (`packages/knowledge/graph.py`)

**Acceptance Criteria:**

```gherkin
Given Neo4j is running
When I connect from the backend
Then the connection succeeds
And I can execute Cypher queries

Given I create a Finding node
When I link it to a Document node with SOURCED_FROM relationship
Then the relationship is created
And I can query the graph to find document sources

Given I have two contradicting findings
When I create a CONTRADICTS relationship between them
Then the contradiction is stored in the graph
And I can query for all contradictions

Given the graph service is implemented
When I call create_finding(data, source_doc_id)
Then a Finding node is created
And it's linked to the Document node
And the operation is idempotent
```

**Related FR:**
- FR-KB-001: Structured Knowledge Storage
- FR-KB-002: Source Attribution
- FR-KB-004: Cross-Document Analysis

**Architecture Reference:** Data Architecture - Neo4j Knowledge Graph

**Definition of Done:**
- [ ] Neo4j 2025.01 instance running (Docker Compose)
- [ ] Neo4j connection configured in backend
- [ ] Node types defined (Finding, Document, Entity, Pattern, Contradiction)
- [ ] Relationship types defined (SOURCED_FROM, CONTRADICTS, RELATED_TO, VALIDATES)
- [ ] Indexes created on key properties
- [ ] Graph service layer implemented (`create_node`, `create_relationship`, `query_graph`)
- [ ] Environment variables documented
- [ ] Connection tested and working
- [ ] Basic CRUD operations tested

---

#### Story E1.9: Set up pg-boss Background Job Queue

**As a** developer
**I want** pg-boss configured for background job processing
**So that** document processing and analysis can happen asynchronously

**Description:**
Install and configure pg-boss (PostgreSQL-backed job queue), set up worker infrastructure, create initial job types for document processing, and implement job monitoring and retry logic.

**Technical Details:**
- Install `pg-boss` npm package in backend
- Configure pg-boss to use existing PostgreSQL database
- Create job queues: `parse_document`, `generate_embeddings`, `analyze_document`, `update_graph`
- Set up worker process (`apps/workers/main.py`)
- Implement job handlers for each queue
- Configure retry logic (3 retries with exponential backoff)
- Add job monitoring endpoint (`/api/jobs/status`)

**Acceptance Criteria:**

```gherkin
Given pg-boss is configured
When I enqueue a job
Then the job is stored in PostgreSQL
And I receive a job ID

Given a worker is running
When a job is enqueued
Then the worker picks it up
And executes the job handler
And marks it complete

Given a job fails
When the failure occurs
Then the job is retried
And retry count increments
And after 3 failures, job is marked as failed

Given I query job status
When I call /api/jobs/status/{job_id}
Then I see job state (queued, active, completed, failed)
And I see retry count and error messages if failed

Given multiple jobs are queued
When workers process them
Then jobs are processed in priority order
And I can see queue depth and processing rate
```

**Related FR:**
- FR-BG-001: Event-Driven Architecture
- FR-BG-002: Processing Pipeline
- FR-BG-003: Autonomous Intelligence
- FR-BG-004: Processing Transparency

**Architecture Reference:** Background Processing Architecture

**Definition of Done:**
- [ ] pg-boss installed and configured
- [ ] Job queues created (parse_document, generate_embeddings, analyze_document, update_graph)
- [ ] Worker process implemented (`apps/workers/main.py`)
- [ ] Job handlers implemented for each queue
- [ ] Retry logic configured (3 retries, exponential backoff)
- [ ] Job monitoring endpoint (`/api/jobs/status`) implemented
- [ ] Error handling and logging implemented
- [ ] Worker can be started/stopped cleanly
- [ ] Jobs persist across worker restarts
- [ ] Queue depth and processing metrics available

---

## Epic 2: Document Ingestion & Storage

**User Value:** Users can upload, organize, and track documents in a secure data room

**Description:** Implements the Data Room with dual display modes (Folder Structure and Buckets view with IRL integration), document upload with drag-and-drop, file storage in Google Cloud Storage (GCS), and real-time upload progress tracking.

> **Architecture Decision (2025-11-25):** Document storage uses Google Cloud Storage instead of Supabase Storage for better cost model with large files, native Gemini/Vertex AI integration, and enterprise scalability.

**Functional Requirements Covered:**
- FR-DOC-001: Document Upload
- FR-DOC-002: Document Organization
- FR-DOC-003: Document Versioning
- FR-DOC-004: Document Processing (status tracking only in this epic)

**UX Screens:**
- Data Room (Buckets View)
- Data Room (Folder View)
- Upload Interface
- IRL Checklist Panel

**Technical Foundation:**
- Google Cloud Storage buckets (per project isolation)
- File upload API with signed URLs
- Document metadata in PostgreSQL
- WebSocket for real-time updates

**Acceptance Criteria (Epic Level):**
- ✅ User can upload documents via drag-and-drop or button
- ✅ Documents stored securely in Google Cloud Storage
- ✅ User can organize documents in folders or buckets
- ✅ User can track IRL items with checklist
- ✅ Upload progress shows in real-time
- ✅ Document versioning tracks changes

### Stories

#### Story E2.1: Configure Google Cloud Storage and Implement Upload API

**As a** developer
**I want** Google Cloud Storage configured with upload API
**So that** users can securely upload and store documents

**Description:**
Set up Google Cloud Storage buckets with IAM policies and signed URLs, implement file upload API endpoint in FastAPI, generate time-limited signed URLs for secure access, and validate file types/sizes.

**Technical Details:**
- Create GCS bucket per project: `manda-{project_id}`
- IAM policy: service account with storage.objectAdmin per bucket
- FastAPI endpoint: `POST /api/documents/upload`
- Accept: Excel (.xlsx, .xls), PDF, Word (.docx, .doc)
- Max file size: 100MB
- Generate signed URLs for download
- Store metadata in `documents` table

**Acceptance Criteria:**

```gherkin
Given Google Cloud Storage is configured
When I upload a file to my deal
Then the file is stored in `manda-{project_id}/{folder_path}/{filename}`
And metadata is saved in the documents table

Given I upload a 50MB Excel file
When the upload completes
Then I can retrieve a signed URL
And the URL allows me to download the file

Given I try to upload a 150MB file
When I send the upload request
Then the request is rejected
And I see error: "File size exceeds 100MB limit"

Given I try to upload a .exe file
When I send the upload request
Then the request is rejected
And I see error: "File type not supported"

Given another user tries to upload to my deal
When they send the upload request
Then RLS policy blocks the upload
And they receive a permission denied error
```

**Related FR:**
- FR-DOC-001: Document Upload
- NFR-SEC-001: Data Confidentiality
- NFR-SEC-004: Document Security

**Architecture Reference:** File Storage (Technology Stack section)

**Definition of Done:**
- [ ] GCS bucket created with proper IAM
- [ ] Service account configured with storage.objectAdmin
- [ ] FastAPI upload endpoint working
- [ ] File type validation implemented
- [ ] File size limit enforced (100MB)
- [ ] Signed URLs generated correctly
- [ ] Metadata saved to documents table
- [ ] Error handling for invalid uploads
- [ ] Upload tested with Excel, PDF, Word

---

#### Story E2.2: Build Document Upload UI with Drag-and-Drop

**As an** M&A analyst
**I want** to drag-and-drop documents to upload them
**So that** I can quickly add files to my data room

**Description:**
Implement the document upload interface with drag-and-drop support, file selection button, upload progress indicators, and real-time status updates.

**Technical Details:**
- Create upload component with drag-drop zone
- Use HTML5 drag-and-drop API
- Upload progress bar (0-100%)
- Multiple file upload support (bulk)
- Real-time status: queued, uploading, complete, error
- Display file preview (name, size, type)

**Acceptance Criteria:**

```gherkin
Given I am on the Data Room screen
When I drag a file over the drop zone
Then the zone highlights to indicate drop target
And I see "Drop files here to upload"

Given I drop 3 files into the drop zone
When the upload starts
Then I see progress bars for each file
And each shows upload percentage (0-100%)

Given I click "Upload Files" button
When the file picker opens
Then I can select multiple files
And they are added to the upload queue

Given files are uploading
When upload completes
Then each file shows "✓ Upload complete"
And the file appears in the document list

Given an upload fails
When the error occurs
Then the file shows "✗ Upload failed"
And I see the error message
And I can retry the upload
```

**Related FR:**
- FR-DOC-001: Document Upload
- NFR-USE-003: Feedback & Visibility

**UX Reference:** Data Room Upload Flow (Section 5.2)

**Definition of Done:**
- [ ] Drag-and-drop zone implemented
- [ ] Drop zone highlights on hover
- [ ] File picker button works
- [ ] Multiple files can be selected
- [ ] Upload progress bars show percentage
- [ ] Success/error states displayed
- [ ] Retry failed uploads works
- [ ] Real-time status updates
- [ ] Responsive design

---

#### Story E2.3: Implement Data Room Folder Structure View

**As an** M&A analyst
**I want** to organize documents in a folder hierarchy
**So that** I can structure documents logically

**Description:**
Build the Folder Structure view for the Data Room with hierarchical tree navigation, file list display, create/rename/delete folder operations, and drag-and-drop file organization.

**Technical Details:**
- Left panel: Folder tree view
- Main panel: Document list (files in selected folder)
- Create folder modal
- Rename/delete folder actions
- Drag-and-drop files between folders
- Update `documents` table with `folder_path`

**Acceptance Criteria:**

```gherkin
Given I am in Data Room Folder view
When I click "Create Folder"
Then a modal opens for folder name
And I can create a new folder
And it appears in the tree view

Given I have documents in the root
When I drag a file to a folder
Then the file moves to that folder
And the folder_path is updated in the database

Given I right-click a folder
When I select "Rename"
Then I can edit the folder name inline
And all documents in that folder update their folder_path

Given I select a folder
When I click "Delete"
Then I see a confirmation dialog
And deleting moves documents to root (or ask to confirm deletion)

Given I expand/collapse folders
When I click the arrow icon
Then subfolders show/hide
And the tree state persists in local storage
```

**Related FR:**
- FR-DOC-002: Document Organization

**UX Reference:** Data Room - Mode 1: Folder Structure (Section 5.2)

**Definition of Done:**
- [ ] Folder tree view renders correctly
- [ ] Create folder works
- [ ] Rename folder updates database
- [ ] Delete folder with confirmation
- [ ] Drag-and-drop files between folders
- [ ] Expand/collapse folders
- [ ] Document list shows files in selected folder
- [ ] Empty folder state displayed
- [ ] Tree state persists

---

#### Story E2.4: Implement Data Room Buckets View with Category Cards

**As an** M&A analyst
**I want** to organize documents by category buckets
**So that** I can see progress by document type

**Description:**
Build the Buckets View for the Data Room with category bucket cards showing progress indicators, status badges, nested item lists, and per-item upload actions.

**Technical Details:**
- Category cards: Financial, Legal, Operational, Market & Strategy, Technology & IP, HR & Organization
- Each card shows: progress bar (6/8), status badge (in progress/completed)
- Expandable nested item list
- Per-item upload button
- Sync with `documents` table using `category` field
- Calculate progress dynamically

**Acceptance Criteria:**

```gherkin
Given I am in Data Room Buckets view
When the page loads
Then I see category bucket cards
And each card shows: name, progress bar, status badge

Given "Financial Documents" has 6/8 items complete
When I view the bucket card
Then the progress bar shows 75%
And the status badge says "in progress"

Given I click on a bucket card
When it expands
Then I see the nested item list
And each item shows upload status (✓ uploaded, ⏱ pending, ○ not started)

Given I click "Upload" on an IRL item
When the file picker opens
Then I upload a file
And it is automatically linked to that IRL item
And the progress updates

Given all items in "Legal Documents" are uploaded
When I view the bucket card
Then the progress bar shows 100%
And the status badge changes to "completed"
```

**Related FR:**
- FR-DOC-002: Document Organization
- FR-IRL-003: IRL-Document Linking

**UX Reference:** Data Room - Mode 2: Buckets View (Section 5.2)

**Definition of Done:**
- [ ] Bucket cards display for all categories
- [ ] Progress bars calculate correctly
- [ ] Status badges update dynamically
- [ ] Nested item lists expand/collapse
- [ ] Per-item upload buttons work
- [ ] Files linked to IRL items
- [ ] Progress updates in real-time
- [ ] Empty bucket state displayed

---

#### Story E2.5: Build IRL Checklist Panel (Right Sidebar)

**As an** M&A analyst
**I want** a checklist panel showing IRL progress
**So that** I can track which documents I've received

**Description:**
Implement the IRL Checklist panel that displays on the right side of the Data Room, showing overall progress, hierarchical checklist with status indicators, file type icons, and quick upload actions.

**Technical Details:**
- Right panel component (collapsible)
- Overall progress: 15/19 documents (79%)
- Hierarchical checklist mirrors IRL structure
- Status indicators: ✓ Uploaded, ⏱ Pending, ○ Not started
- File type icons (PDF, XLSX, DOCX)
- Quick upload button per item
- Expand/collapse categories

**Acceptance Criteria:**

```gherkin
Given I am in Data Room with an active IRL
When the page loads
Then I see the checklist panel on the right
And it shows overall progress (e.g., 15/19, 79%)

Given the IRL has categories
When I view the checklist
Then categories are listed hierarchically
And I can expand/collapse each category

Given a document is uploaded and linked to an IRL item
When the checklist updates
Then the item shows ✓ (green checkmark)
And the overall progress increments

Given an item is not yet uploaded
When I view the checklist
Then it shows ○ (empty circle)
And the upload button is available

Given I click the upload button on an item
When the file picker opens
Then I upload a file
And it is linked to that IRL item automatically
And the checklist updates in real-time
```

**Related FR:**
- FR-IRL-002: IRL Tracking
- FR-IRL-003: IRL-Document Linking

**UX Reference:** Data Room - Document Checklist Panel (Section 5.2)

**Definition of Done:**
- [ ] Checklist panel renders on right side
- [ ] Overall progress calculated correctly
- [ ] Hierarchical checklist displays IRL items
- [ ] Status indicators (✓⏱○) work
- [ ] File type icons display correctly
- [ ] Quick upload per item works
- [ ] Real-time updates via WebSocket
- [ ] Panel is collapsible
- [ ] Empty state for no IRL

---

#### Story E2.6: Implement Document Metadata Display and Actions

**As an** M&A analyst
**I want** to view document metadata and perform actions
**So that** I can manage my documents effectively

**Description:**
Display document metadata (name, size, type, upload date, processing status) in both folder and bucket views, and implement document actions (view, download, delete, move, rename).

**Technical Details:**
- Document card/row shows: name, size, type, upload date, processing status
- Actions menu: View, Download, Delete, Move, Rename
- Document preview modal (optional for MVP)
- Confirmation for destructive actions
- Update `documents` table on actions

**Acceptance Criteria:**

```gherkin
Given I view a document in the list
When I see the document card
Then it shows: name, size (MB), type (PDF/XLSX/DOCX), upload date, status

Given I click on a document
When the actions menu opens
Then I see options: View, Download, Delete, Rename

Given I click "Download"
When the download starts
Then the file downloads using the signed URL
And I receive the original file

Given I click "Delete"
When I confirm the deletion
Then the file is removed from Google Cloud Storage
And the metadata is deleted from the database
And the document disappears from the list

Given I click "Rename"
When I edit the name inline
Then the document name updates in the database
And the new name displays immediately

Given a document is processing
When I view the status
Then it shows "Processing..." with a spinner
And I cannot perform certain actions (like download) yet
```

**Related FR:**
- FR-DOC-002: Document Organization
- FR-DOC-004: Document Processing (status display)

**UX Reference:** Data Room - Document Actions (Section 5.2)

**Definition of Done:**
- [ ] Document metadata displayed correctly
- [ ] Actions menu implemented
- [ ] Download works with signed URLs
- [ ] Delete removes file and metadata
- [ ] Rename updates database
- [ ] Confirmation dialogs for destructive actions
- [ ] Processing status shows correctly
- [ ] Actions disabled during processing
- [ ] Error handling for failed actions

---

#### Story E2.7: Add View Mode Toggle (Folders ↔ Buckets)

**As an** M&A analyst
**I want** to switch between folder and bucket views
**So that** I can choose the organization that fits my workflow

**Description:**
Implement a view mode toggle in the Data Room that switches between Folder Structure view and Buckets view, persisting the user's preference per project.

**Technical Details:**
- Toggle button in top-right corner
- Icon-based toggle (folder icon ↔ bucket icon)
- Save preference to local storage or user settings
- Smooth transition between views
- Maintain selected items/filters when switching

**Acceptance Criteria:**

```gherkin
Given I am in Data Room Folder view
When I click the view toggle
Then the view switches to Buckets view
And my documents are displayed in category buckets

Given I am in Data Room Buckets view
When I click the view toggle
Then the view switches to Folder view
And my folder structure is displayed

Given I set my view to Buckets
When I navigate away and return
Then the view defaults to Buckets
And my preference is persisted

Given I have a folder selected in Folder view
When I switch to Buckets view and back
Then the same folder is still selected
And my context is preserved
```

**Related FR:**
- FR-DOC-002: Document Organization (flexibility)

**UX Reference:** Data Room - Mode Toggle (Section 5.2)

**Definition of Done:**
- [ ] View toggle button implemented
- [ ] Switches between Folder and Buckets views
- [ ] User preference persisted
- [ ] Smooth transition animation
- [ ] Context preserved when switching
- [ ] Toggle state reflects current view
- [ ] Works on desktop and tablet

---

#### Story E2.8: Implement Document Versioning

**As an** M&A analyst
**I want** to track document versions
**So that** I can see how documents have changed over time

**Description:**
Implement document versioning that tracks when a document is re-uploaded with the same name, allows comparison between versions, and maintains a version history log.

**Technical Details:**
- Detect duplicate filename on upload
- Prompt user: "Replace existing?" or "Create new version?"
- Store versions in `document_versions` table
- Link versions to parent document
- Version history UI (list of versions with dates)
- Compare versions side-by-side (Phase 2 feature, foundation here)

**Acceptance Criteria:**

```gherkin
Given I upload a document named "financials_q3.xlsx"
When I later upload another file with the same name
Then I am prompted: "Replace or create new version?"

Given I choose "Create new version"
When the upload completes
Then a new version is created
And both versions are accessible
And the document shows "v2" in the list

Given a document has multiple versions
When I click "Version History"
Then I see a list of all versions
And each shows: version number, upload date, file size

Given I want to download an older version
When I click on a version in the history
Then I can download that specific version
And the signed URL points to the correct file

Given I delete a document with versions
When I confirm deletion
Then all versions are deleted
And storage is cleaned up
```

**Related FR:**
- FR-DOC-003: Document Versioning

**UX Reference:** Data Room - Document Versioning (implied in Architecture)

**Definition of Done:**
- [ ] Duplicate filename detection works
- [ ] User prompted to replace or version
- [ ] Versions stored in database
- [ ] Version history UI displays all versions
- [ ] Download specific version works
- [ ] Delete removes all versions
- [ ] Version numbering increments correctly
- [ ] Latest version is default

---

## Epic 3: Intelligent Document Processing

**User Value:** Users get automated analysis and findings extracted from documents through background processing

**Description:** Implements the background processing pipeline that automatically parses uploaded documents, extracts structured data, generates embeddings for semantic search, performs initial AI analysis, and stores findings in the knowledge base. This epic transforms raw documents into queryable intelligence.

**Processing Approach:** Uses **pg-boss queue jobs** for background processing (NOT LangGraph workflows). LangGraph is reserved for human-in-the-loop workflows (CIM v3, Q&A Co-Creation), while document processing is fully automated background work orchestrated through job queues.

**Architecture Decision (2025-11-25): Hybrid Document Processing**
- **Docling** for document parsing: Excel formula extraction, table structure, OCR for scanned PDFs - Docling excels at preserving complex document structure that M&A documents require
- **Vertex AI RAG Engine** for retrieval/indexing layer: Native GCS integration, managed chunking/embedding, semantic search - simplifies the RAG pipeline while leveraging GCP ecosystem synergies
- **Why Hybrid:** Docling's parsing quality for complex Excel/PDF documents is superior, while Vertex AI RAG Engine eliminates custom RAG infrastructure (chunking, embedding, vector indexing) with a managed service that syncs directly with GCS buckets

**Functional Requirements Covered:**
- FR-DOC-004: Document Processing
- FR-KB-001: Structured Knowledge Storage
- FR-KB-002: Source Attribution
- FR-BG-001: Event-Driven Architecture
- FR-BG-002: Processing Pipeline
- FR-BG-003: Autonomous Intelligence
- FR-BG-004: Processing Transparency

**Technical Components:**
- pg-boss job queue
- Docling document parser (parsing layer)
- Vertex AI RAG Engine (retrieval/indexing layer) - alternative to custom pgvector pipeline
- OpenAI embeddings API (fallback if not using Vertex AI RAG)
- Tiered LLM approach: Gemini 2.5 Flash (extraction), Gemini 2.5 Pro (deep analysis), Flash-Lite (batch)
- PostgreSQL + pgvector for metadata/findings storage (Vertex AI RAG handles vector search)
- WebSocket for status updates

**Acceptance Criteria (Epic Level):**
- ✅ Documents automatically processed on upload
- ✅ Text, tables, and formulas extracted from Excel
- ✅ PDFs parsed with OCR support
- ✅ Findings stored with source attribution
- ✅ Embeddings generated for semantic search
- ✅ Processing status visible to user
- ✅ Failed processing retryable

### Stories

#### Story E3.1: Set up FastAPI Backend with pg-boss Job Queue

**As a** developer
**I want** a FastAPI backend with pg-boss job queue configured
**So that** we can process documents asynchronously in the background

**Description:**
Initialize FastAPI backend project structure, configure pg-boss for Postgres-based job queuing, implement job creation and worker infrastructure, and set up the foundation for background processing.

**Technical Details:**
- Create `apps/api/` directory structure
- Initialize FastAPI app with routers
- Install pg-boss (Python client or use direct Postgres implementation)
- Configure job queue tables in Postgres
- Create worker process (`apps/workers/main.py`)
- Implement health check endpoints

**Acceptance Criteria:**

```gherkin
Given the FastAPI backend is running
When I navigate to `/health`
Then I receive a 200 OK response
And the response shows: {"status": "healthy"}

Given pg-boss is configured
When I create a test job
Then the job is inserted into the queue table
And I can query pending jobs

Given a worker process is running
When a job is available in the queue
Then the worker picks up the job
And processes it
And marks it as complete

Given a job fails
When the worker processes it
Then the error is logged
And the job is marked as failed
And it can be retried (up to 3 times)
```

**Related FR:**
- FR-BG-001: Event-Driven Architecture
- FR-ARCH-003: Scalable Service Architecture

**Architecture Reference:** Background Processing (System Architecture section)

**Definition of Done:**
- [ ] FastAPI app structure created
- [ ] pg-boss tables created in Postgres
- [ ] Job creation API endpoint works
- [ ] Worker process runs and picks up jobs
- [ ] Job status tracking implemented
- [ ] Error handling and retry logic
- [ ] Health check endpoint responds
- [ ] Logging configured

---

#### Story E3.2: Integrate Docling for Document Parsing

**As a** developer
**I want** Docling integrated for parsing Excel, PDF, and Word documents
**So that** we can extract structured content from uploaded files

**Description:**
Integrate IBM's Docling library for document parsing, configure parsers for Excel (with formula preservation), PDF (with OCR), and Word documents, and implement a unified parsing interface.

**Technical Details:**
- Install Docling Python library
- Configure Excel parser (preserve formulas, multiple sheets, pivot tables)
- Configure PDF parser with OCR support (Tesseract)
- Configure Word parser
- Create `DocumentParser` class with `parse(file_path, file_type)` method
- Return structured output: text chunks, tables, formulas, metadata

**Acceptance Criteria:**

```gherkin
Given I have an Excel file with formulas
When I parse the document using Docling
Then the parser extracts all text content
And formulas are preserved (e.g., "=SUM(A1:A10)")
And tables are structured with rows/columns
And multiple sheets are all processed

Given I have a scanned PDF
When I parse the document using Docling
Then OCR is applied to extract text
And the text is returned in chunks
And page numbers are preserved

Given I have a Word document
When I parse the document using Docling
Then text is extracted with formatting metadata
And tables are structured
And the content is chunked semantically

Given a document is corrupted
When I try to parse it
Then an error is raised gracefully
And the error message is descriptive
And the job can be marked as failed
```

**Related FR:**
- FR-DOC-004: Document Processing
- NFR-INT-001: File Format Support

**Architecture Reference:** Document Processing (Technology Stack section)

**Definition of Done:**
- [ ] Docling library installed and configured
- [ ] Excel parser extracts text, tables, formulas
- [ ] PDF parser with OCR works
- [ ] Word parser extracts content
- [ ] DocumentParser interface implemented
- [ ] Structured output format defined
- [ ] Error handling for corrupted files
- [ ] Unit tests for each parser

---

#### Story E3.3: Implement Document Parsing Job Handler

**As a** developer
**I want** a job handler that processes uploaded documents
**So that** documents are automatically parsed when uploaded

**Description:**
Create a job handler for the `parse_document` job type that retrieves the uploaded file from Google Cloud Storage, parses it using Docling, and stores the parsed content (text chunks, tables, formulas) in the database.

**Technical Details:**
- Job type: `parse_document`
- Job payload: `{document_id, file_path, file_type}`
- Download file from GCS to temp location
- Call DocumentParser.parse()
- Store results in `document_chunks` table (text chunks)
- Store results in `document_tables` table (structured tables)
- Update `documents` table: `processing_status = "parsed"`
- Emit `document_parsed` event

**Acceptance Criteria:**

```gherkin
Given a document is uploaded
When the `document_uploaded` event is emitted
Then a `parse_document` job is enqueued
And the job contains: document_id, file_path, file_type

Given a `parse_document` job is picked up
When the worker processes it
Then the file is downloaded from GCS
And Docling parses the file
And parsed chunks are stored in document_chunks table
And the document status updates to "parsed"

Given parsing fails
When an error occurs
Then the job is marked as failed
And the error is logged
And the document status updates to "failed"
And the user is notified

Given an Excel with 3 sheets is parsed
When the chunks are stored
Then each sheet's content is in separate chunks
And table structures are preserved in document_tables
```

**Related FR:**
- FR-BG-002: Processing Pipeline
- FR-DOC-004: Document Processing

**Architecture Reference:** Document Processing Flow (System Architecture section)

**Definition of Done:**
- [ ] `parse_document` job handler created
- [ ] File download from GCS works
- [ ] Docling parsing called correctly
- [ ] Chunks stored in database
- [ ] Tables stored in structured format
- [ ] Document status updated
- [ ] Error handling implemented
- [ ] Event emitted on completion

---

#### Story E3.4: Generate Embeddings for Semantic Search

**As a** developer
**I want** embeddings generated for document chunks
**So that** users can perform semantic search across documents

**Description:**
Create a job handler that generates embeddings for parsed document chunks using OpenAI's text-embedding-3-large model and stores them in PostgreSQL with pgvector for similarity search.

**Technical Details:**
- Job type: `generate_embeddings`
- Job payload: `{document_id}`
- Retrieve chunks from `document_chunks` table
- Call OpenAI embeddings API for each chunk
- Store vectors in `chunk_embeddings` column (pgvector)
- Batch processing for efficiency (e.g., 20 chunks at a time)
- Update document status: `embeddings_generated = true`

**Acceptance Criteria:**

```gherkin
Given a document is parsed
When the `generate_embeddings` job is enqueued
Then the job payload contains the document_id

Given the embeddings job is processed
When chunks are retrieved
Then each chunk is sent to OpenAI embeddings API
And the resulting vector (1536 dimensions) is stored in the database
And the chunk_embeddings column is populated

Given a document has 100 chunks
When embeddings are generated
Then chunks are batched (e.g., 20 at a time)
And API rate limits are respected
And all 100 embeddings are stored

Given embeddings are generated
When I perform a similarity search query
Then pgvector returns relevant chunks ranked by cosine similarity
And the search is performant (<100ms)

Given the embeddings API fails
When an error occurs
Then the job is retried (up to 3 times)
And the error is logged
```

**Related FR:**
- FR-KB-003: Knowledge Retrieval (semantic search foundation)
- NFR-PERF-001: Response Time

**Architecture Reference:** Embeddings (Technology Stack section)

**Definition of Done:**
- [ ] `generate_embeddings` job handler created
- [ ] OpenAI embeddings API integrated
- [ ] Embeddings stored in pgvector column
- [ ] Batch processing implemented
- [ ] Rate limiting handled
- [ ] Similarity search tested and working
- [ ] Performance meets <100ms requirement
- [ ] Error handling and retry logic

---

#### Story E3.5: Implement LLM Analysis with Gemini 2.5 (Tiered Approach)

**As a** developer
**I want** LLM analysis using tiered Gemini 2.5 models to extract findings from documents
**So that** users get intelligent insights automatically with optimized cost/quality

**Description:**
Create a job handler that uses Gemini 2.5 Flash for initial extraction and Gemini 2.5 Pro for complex financial analysis, extract key findings (financial metrics, operational data, risks, opportunities), and store findings with source attribution in the knowledge base.

**Technical Details:**
- Job type: `analyze_document`
- Job payload: `{document_id}`
- Retrieve parsed chunks from database
- **Tiered LLM Strategy:**
  - **Gemini 2.5 Flash** (`gemini-2.5-flash`): Default for extraction ($0.30/1M input, $2.50/1M output)
  - **Gemini 2.5 Pro** (`gemini-2.5-pro`): Complex financial analysis ($1.25/1M input, $10/1M output)
  - **Gemini 2.5 Flash-Lite** (`gemini-2.5-flash-lite`): Batch processing ($0.10/1M input, $0.40/1M output)
- Prompt: "Extract key findings from this M&A document. Focus on: financial metrics, operational data, risks, opportunities. Provide source attribution."
- Parse LLM response (structured JSON)
- Store findings in `findings` table with confidence scores
- Link findings to source chunks (source attribution)

**Acceptance Criteria:**

```gherkin
Given a document is parsed and embeddings generated
When the `analyze_document` job is enqueued
Then the job contains the document_id

Given the analysis job runs
When Gemini 2.5 Flash processes the document
Then it extracts key findings (e.g., "Q3 Revenue: $5.2M")
And each finding has a confidence score (0-100%)
And each finding is linked to the source chunk

Given findings are extracted
When I query the findings table
Then I see findings with: text, confidence, domain (financial/operational/etc.), source_chunk_id
And the source attribution is traceable

Given a financial document is analyzed
When findings are extracted
Then I see metrics like: revenue, EBITDA, margins, growth rates
And each metric has the exact source (sheet, cell reference)

Given the LLM returns invalid JSON
When the response is parsed
Then the error is caught gracefully
And the job is marked as failed
And the document can be re-analyzed
```

**Related FR:**
- FR-KB-001: Structured Knowledge Storage
- FR-KB-002: Source Attribution
- FR-BG-003: Autonomous Intelligence

**Architecture Reference:** Intelligence Layer - Multi-Model Strategy (Section)

**Definition of Done:**
- [ ] `analyze_document` job handler created
- [ ] Gemini 2.5 Flash/Pro API integrated (tiered approach)
- [ ] Analysis prompt optimized for M&A documents
- [ ] Findings extracted and stored
- [ ] Confidence scores assigned
- [ ] Source attribution linked
- [ ] Structured JSON parsing works
- [ ] Error handling for invalid responses

---

#### Story E3.6: Create Processing Status Tracking and WebSocket Updates

**As an** M&A analyst
**I want** to see real-time processing status for my documents
**So that** I know when analysis is complete

**Description:**
Implement real-time processing status tracking that shows users the current stage of document processing (queued, parsing, analyzing, complete) with WebSocket updates pushing status changes to the frontend.

**Technical Details:**
- Processing stages: `queued`, `parsing`, `parsed`, `analyzing`, `analyzed`, `complete`, `failed`
- Update `documents.processing_status` at each stage
- WebSocket integration (Supabase Realtime)
- Frontend subscribes to document status changes
- Display status in Data Room (spinner, progress indicator)
- Notification on completion

**Acceptance Criteria:**

```gherkin
Given I upload a document
When the upload completes
Then the status shows "queued"
And a spinner indicates processing

Given parsing starts
When the status changes to "parsing"
Then the frontend receives a WebSocket update
And the UI updates to show "Parsing document..."

Given parsing completes
When the status changes to "parsed"
Then the UI updates to show "Analyzing content..."

Given analysis completes
When the status changes to "complete"
Then I receive a notification: "Financial statements analyzed. 12 findings extracted."
And the spinner disappears
And I can view the document

Given processing fails
When the status changes to "failed"
Then I see an error message
And a "Retry" button is available
And I can click to re-process

Given I navigate away during processing
When I return to the Data Room
Then the document status is current
And I see what stage it's in
```

**Related FR:**
- FR-BG-004: Processing Transparency
- NFR-USE-003: Feedback & Visibility

**UX Reference:** Data Room - Upload Flow (Section 5.2)

**Definition of Done:**
- [ ] Processing status enum implemented
- [ ] Status updates at each pipeline stage
- [ ] WebSocket integration working
- [ ] Frontend subscribes to status changes
- [ ] UI displays current status
- [ ] Spinner shows during processing
- [ ] Notification on completion
- [ ] Error state with retry button

---

#### Story E3.7: Implement Processing Queue Visibility

**As an** M&A analyst
**I want** to see what documents are in the processing queue
**So that** I understand what's being analyzed

**Description:**
Build a processing queue panel that displays all documents currently being processed, their status, estimated completion time, and allows users to prioritize or cancel jobs.

**Technical Details:**
- Create "Processing Queue" panel (Dashboard or Data Room)
- Query pg-boss for active jobs
- Display: document name, status, time in queue, estimated completion
- Actions: Cancel job, Retry failed job
- Real-time updates via polling or WebSocket

**Acceptance Criteria:**

```gherkin
Given I have 5 documents processing
When I view the Processing Queue panel
Then I see all 5 documents listed
And each shows: name, status (parsing/analyzing), time in queue

Given a document is currently being parsed
When I view the queue
Then it shows "Parsing document..." with a spinner
And estimated completion (if available)

Given a job has failed
When I view the queue
Then it shows "Failed" with an error icon
And I can click "Retry" to re-process

Given I want to cancel a queued job
When I click "Cancel"
Then the job is removed from the queue
And the document status updates to "cancelled"

Given processing completes
When the document finishes
Then it is removed from the queue panel
And the queue updates in real-time
```

**Related FR:**
- FR-BG-004: Processing Transparency
- NFR-USE-003: Feedback & Visibility

**UX Reference:** Dashboard - Processing Queue Status (Section 5.1)

**Definition of Done:**
- [ ] Processing Queue panel implemented
- [ ] Lists all active jobs
- [ ] Displays document name and status
- [ ] Shows time in queue
- [ ] Cancel action works
- [ ] Retry failed jobs works
- [ ] Real-time updates implemented
- [ ] Empty state for no jobs

---

#### Story E3.8: Implement Retry Logic for Failed Processing

**As an** M&A analyst
**I want** to retry failed document processing
**So that** I can recover from temporary failures

**Description:**
Implement automatic retry logic for failed jobs (up to 3 attempts) with exponential backoff, and allow users to manually trigger re-processing for failed documents.

**Technical Details:**
- pg-boss retry configuration: max 3 attempts, exponential backoff (1s, 5s, 15s)
- Manual retry button in UI
- Re-enqueue job with same payload
- Track retry count in job metadata
- Log failures for debugging

**Acceptance Criteria:**

```gherkin
Given a job fails on first attempt
When the failure occurs
Then pg-boss automatically retries after 1 second
And the retry count increments to 1

Given a job fails on second attempt
When the failure occurs
Then pg-boss retries after 5 seconds
And the retry count increments to 2

Given a job fails 3 times
When the third failure occurs
Then pg-boss marks it as permanently failed
And the document status shows "failed"
And no more automatic retries occur

Given a document has failed permanently
When I click "Retry" in the UI
Then the job is re-enqueued
And the retry count resets
And processing starts again

Given retries are occurring
When I view the Processing Queue
Then I see the retry count (e.g., "Attempt 2/3")
```

**Related FR:**
- NFR-ACC-004: Data Integrity
- FR-BG-004: Processing Transparency

**Architecture Reference:** Error handling in job queue

**Definition of Done:**
- [ ] Automatic retry with exponential backoff
- [ ] Max 3 retry attempts
- [ ] Manual retry button in UI
- [ ] Retry count tracked and displayed
- [ ] Permanently failed state after 3 attempts
- [ ] Errors logged for debugging
- [ ] User notified of permanent failure

---

#### Story E3.9: Build Neo4j Graph Relationships for Source Attribution

**As a** developer
**I want** findings linked to source documents in Neo4j
**So that** we can trace every finding back to its source

**Description:**
Create a job handler that updates the Neo4j graph database with relationships between findings and source documents, enabling complex traversal queries for source attribution and cross-document analysis.

**Technical Details:**
- Job type: `update_graph`
- Job payload: `{document_id, findings[]}`
- Connect to Neo4j
- Create nodes: Deal, Document, Finding
- Create relationships: `EXTRACTED_FROM` (Finding → Document)
- Store metadata on nodes (confidence, domain, timestamp)
- Query interface for graph traversal

**Acceptance Criteria:**

```gherkin
Given findings are extracted from a document
When the `update_graph` job runs
Then Document node is created in Neo4j
And Finding nodes are created for each finding
And `EXTRACTED_FROM` relationships link findings to the document

Given I query Neo4j for a finding
When I traverse the graph
Then I can find the source document
And retrieve the document path, chunk reference, confidence

Given I want to find all findings from a specific document
When I query: MATCH (f:Finding)-[:EXTRACTED_FROM]->(d:Document {id: "123"})
Then I get all findings extracted from that document

Given findings are linked across multiple documents
When I query the graph
Then I can trace relationships
And perform cross-document analysis (Phase 3 foundation)

Given Neo4j is unavailable
When the job tries to update the graph
Then the error is logged
And the job is retried
And processing continues (graph update is not blocking)
```

**Related FR:**
- FR-KB-002: Source Attribution
- FR-KB-004: Cross-Document Analysis (foundation)

**Architecture Reference:** Neo4j Graph Schema (Data Architecture section)

**Definition of Done:**
- [ ] Neo4j connection configured
- [ ] `update_graph` job handler created
- [ ] Nodes created for Deal, Document, Finding
- [ ] Relationships created correctly
- [ ] Metadata stored on nodes
- [ ] Graph traversal queries tested
- [ ] Error handling for Neo4j unavailable
- [ ] Job retry logic works

---

#### Story E3.6: Financial Model Integration - Extract and Query Financial Metrics

**As an** analyst
**I want** financial metrics extracted from Excel models and queryable through chat
**So that** I can quickly access financial data without manually searching through spreadsheets

**Description:**
Implement financial data extraction from Excel models with formula preservation, store metrics in a dedicated financial_metrics table, integrate with knowledge base for cross-validation, and enable agent queries for financial data (e.g., "What was Q3 2023 EBITDA?").

**Technical Details:**
- Create `financial_metrics` table in PostgreSQL
- Implement `FinancialModelExtractor` service (`packages/financial-extraction/extractor.py`)
- Extract key metrics: revenue (by period, segment), EBITDA, cash flow, balance sheet items, projections, assumptions
- Parse Excel formulas and identify calculation dependencies
- Store metrics with source attribution (sheet name, cell reference)
- Create Neo4j nodes for financial metrics with SOURCED_FROM relationships
- Add agent tool: `query_financial_metric(metric_type, period)`
- Implement cross-validation logic to detect contradictions across documents

**Acceptance Criteria:**

```gherkin
Given I upload a financial model Excel file
When the document processing completes
Then financial metrics are extracted
And stored in the financial_metrics table
And I see: "Financial model processed. Extracted revenue, EBITDA, and cash flow data for 12 periods."

Given financial metrics are extracted
When I ask "What was Q3 2023 revenue?"
Then the agent queries the financial_metrics table
And responds with the value and source
And shows: "Q3 2023 revenue was $5.2M (source: financial_model.xlsx, sheet 'P&L', cell B15)"

Given I upload a second document with conflicting revenue data
When the cross-validation runs
Then a contradiction is detected
And flagged in the knowledge graph
And the agent notifies: "Contradiction detected: Q3 2023 revenue shows $5.2M in financial_model.xlsx but $4.8M in management_presentation.pptx"

Given formulas are extracted
When I query formula dependencies
Then I can see calculation logic
And understand how metrics are derived

Given financial metrics span multiple periods
When I ask "Show revenue growth from Q1 to Q4 2023"
Then the agent retrieves all relevant periods
And calculates growth percentage
And cites sources for each period
```

**Related FR:**
- FR-DOC-004: Document Processing (formula extraction)
- FR-KB-001: Structured Knowledge Storage
- FR-KB-002: Source Attribution
- FR-KB-004: Cross-Document Analysis (cross-validation)
- FR-CONV-002: Query Capabilities

**Architecture Reference:** Financial Model Integration section

**Definition of Done:**
- [ ] `financial_metrics` table created with indexes
- [ ] `FinancialModelExtractor` service implemented
- [ ] Extraction logic for revenue, EBITDA, cash flow, balance sheet items
- [ ] Formula parsing and dependency tracking
- [ ] Source attribution stored (sheet, cell reference)
- [ ] Neo4j integration for financial metric nodes
- [ ] Agent tool `query_financial_metric` implemented
- [ ] Cross-validation logic detects contradictions
- [ ] Integration tested with sample financial models
- [ ] Agent can answer financial queries with sources

---

## Epic 4: Collaborative Knowledge Workflow

**User Value:** Users can capture, validate, and manage findings collaboratively with AI through multiple input methods

**Description:** Implements the collaborative knowledge workflow where analysts can capture findings through three methods: (1) Direct chat input during document analysis, (2) Upload Excel/Word notes for extraction, and (3) Collaborative analysis where analyst reads document and tells system findings via chat. System validates findings against existing knowledge, detects contradictions, and enables seamless knowledge graph updates. Includes the Knowledge Explorer interface for browsing and managing all intelligence.

**Functional Requirements Covered:**
- FR-COLLAB-001: Collaborative Document Analysis
- FR-COLLAB-002: Finding Capture & Validation
- FR-COLLAB-003: Q&A Integration
- FR-KB-003: Knowledge Retrieval
- FR-KB-004: Cross-Document Analysis
- FR-CONV-002: Query Capabilities (search foundation)
- NFR-ACC-003: Contradiction Detection

**UX Screens:**
- Chat Interface - Collaborative Analysis Mode
- Chat Interface - Finding Capture Flow
- Knowledge Explorer - Findings Browser
- Knowledge Explorer - Insights Panel (basic)
- Knowledge Explorer - Contradictions View
- Knowledge Explorer - Gap Analysis
- Upload Interface - Notes Upload (Excel/Word)

**Technical Components:**
- Agent tools: `update_knowledge_base`, `update_knowledge_graph`, `validate_finding`, `add_to_qa`
- pgvector semantic search
- Neo4j for contradiction detection and relationship tracking
- Frontend table/card views
- Inline validation UI
- Notes parsing (Excel/Word with finding extraction)
- Real-time validation during chat

**Acceptance Criteria (Epic Level):**
- ✅ User can initiate collaborative analysis via chat ("analyze this doc with me")
- ✅ User can capture findings via chat and system validates in real-time
- ✅ User can upload analyst notes (Excel/Word) and system extracts findings
- ✅ System validates new findings against existing knowledge for contradictions
- ✅ User can resolve contradictions (accept new, keep old, flag for investigation)
- ✅ User can browse all extracted findings in Knowledge Explorer
- ✅ User can filter findings by document, domain, confidence, capture method
- ✅ User can validate, reject, or edit findings inline
- ✅ User can search findings semantically
- ✅ User can view and resolve contradictions
- ✅ System suggests Q&A questions based on findings
- ✅ User can identify information gaps

### Stories

#### Story E4.1: Build Findings Browser with Table View

**As an** M&A analyst
**I want** to view all extracted findings in a table
**So that** I can quickly scan and review intelligence

**Description:**
Implement the Findings Browser table view displaying all findings with columns for finding text, source, domain, confidence, and status. Include sorting, filtering, and pagination.

**Technical Details:**
- Route: `/projects/[id]/knowledge-explorer`
- Default tab: Findings Browser
- Table columns: Finding, Source, Domain, Confidence, Status, Actions
- Use shadcn/ui DataTable component
- Sortable by: confidence, domain, date
- Filterable by: document, domain, confidence range, status
- Pagination: 50 items per page
- Fetch from `findings` table

**Acceptance Criteria:**

```gherkin
Given I navigate to Knowledge Explorer
When the page loads
Then I see the Findings Browser in table view
And findings are displayed with all columns
And the table shows 50 items per page

Given I click a column header
When I sort by "Confidence"
Then findings are sorted high to low (or low to high on second click)

Given I use the domain filter
When I select "Financial"
Then only financial findings are displayed
And the count updates

Given I use the confidence filter
When I set range to "High (>80%)"
Then only findings with >80% confidence show
And low confidence findings are hidden

Given there are 200 findings
When I navigate to page 2
Then findings 51-100 are displayed
And pagination controls work correctly
```

**Related FR:**
- FR-KB-003: Knowledge Retrieval

**UX Reference:** Knowledge Explorer - Findings Browser (Section 5.3)

**Definition of Done:**
- [ ] Findings Browser route created
- [ ] Table view displays all columns
- [ ] Sorting works on all columns
- [ ] Filters implemented (document, domain, confidence, status)
- [ ] Pagination works (50 per page)
- [ ] Table responsive on desktop/tablet
- [ ] Loading states implemented
- [ ] Empty state for no findings

---

#### Story E4.2: Implement Semantic Search for Findings

**As an** M&A analyst
**I want** to search findings using natural language
**So that** I can find relevant information quickly

**Description:**
Add semantic search functionality to the Findings Browser that uses pgvector similarity search to find relevant findings based on natural language queries.

**Technical Details:**
- Search input at top of Findings Browser
- Generate query embedding using OpenAI API
- Perform pgvector similarity search
- Return top 20 most relevant findings ranked by cosine similarity
- Highlight search results
- Clear search to return to all findings

**Acceptance Criteria:**

```gherkin
Given I enter "revenue growth Q3" in the search
When I press Enter
Then the system generates an embedding for my query
And performs similarity search using pgvector
And displays the top 20 most relevant findings
And results are ranked by relevance

Given search results are displayed
When I view the findings
Then the most relevant appears first
And I can see why it matched (highlight keywords if possible)

Given I want to clear the search
When I click the X button
Then the search clears
And all findings are displayed again

Given no findings match my query
When I search for "xyz123"
Then I see "No findings match your search"
And suggestions to try different terms

Given search is slow
When embeddings are generating
Then I see a loading indicator
And results appear within 2-3 seconds
```

**Related FR:**
- FR-KB-003: Knowledge Retrieval
- FR-CONV-002: Query Capabilities

**Architecture Reference:** Vector Search with pgvector

**Definition of Done:**
- [ ] Search input added to Findings Browser
- [ ] Query embedding generation works
- [ ] pgvector similarity search implemented
- [ ] Results ranked by relevance
- [ ] Top 20 results displayed
- [ ] Clear search functionality
- [ ] Loading indicator during search
- [ ] Empty state for no results
- [ ] Performance <3 seconds

---

#### Story E4.3: Implement Inline Finding Validation (Confirm/Reject/Edit)

**As an** M&A analyst
**I want** to validate findings inline
**So that** I can mark them as correct, incorrect, or edit them

**Description:**
Add inline validation actions to each finding row (✓ Confirm, ✗ Reject, ✏️ Edit) that update the finding status and optionally adjust confidence scores.

**Technical Details:**
- Action buttons on each finding row: ✓ (confirm), ✗ (reject), ✏️ (edit)
- Confirm: Update status to "validated", boost confidence +5%
- Reject: Update status to "rejected", move to rejected list
- Edit: Inline editor to modify finding text, save updates
- Update `findings` table
- Real-time UI update (optimistic update pattern)

**Acceptance Criteria:**

```gherkin
Given I see a finding I want to validate
When I click the ✓ button
Then the finding status changes to "validated"
And a green checkmark appears
And the confidence score increases by 5%

Given I see an incorrect finding
When I click the ✗ button
Then the finding status changes to "rejected"
And the finding is removed from the main list
And it appears in a "Rejected" filter view

Given I want to edit a finding
When I click the ✏️ button
Then an inline editor opens
And I can modify the finding text
And I click Save to commit changes

Given I edit a finding
When I save the changes
Then the updated text is stored in the database
And the UI updates immediately
And the edit is logged (for learning loop Phase 3)

Given validation actions are performed
When I filter by "Validated"
Then I see only validated findings
And the count is correct
```

**Related FR:**
- FR-KB-001: Structured Knowledge Storage (validation status)
- FR-CDI-004: Learning Loop (foundation for Phase 3)

**UX Reference:** Knowledge Explorer - Inline Validation Workflow (Section 5.3)

**Definition of Done:**
- [ ] Confirm action updates status and confidence
- [ ] Reject action moves to rejected list
- [ ] Edit action opens inline editor
- [ ] Changes saved to database
- [ ] Optimistic UI updates
- [ ] Filter by validation status works
- [ ] Rejected findings have separate view
- [ ] Edits logged for future learning

---

#### Story E4.4: Build Card View Alternative for Findings

**As an** M&A analyst
**I want** a card view option for findings
**So that** I can see more detail in a visual format

**Description:**
Implement an alternative card view for the Findings Browser that displays findings as cards with more visual space, showing finding text, source attribution, confidence badge, domain tag, and validation actions.

**Technical Details:**
- View toggle: Table ↔ Card (top-right)
- Card layout: finding text (main), source (clickable link), confidence badge, domain tag, actions
- Grid layout: 2-3 columns responsive
- Same filtering/sorting as table view
- Preserve view preference in local storage

**Acceptance Criteria:**

```gherkin
Given I am in Findings Browser table view
When I click the view toggle
Then the view switches to card view
And findings display as cards in a grid

Given I view findings as cards
When I see a finding card
Then it shows: finding text, source link, confidence badge, domain tag, validation actions
And the layout is spacious and readable

Given I validate a finding in card view
When I click ✓ Confirm
Then the card updates immediately
And the green checkmark appears

Given I switch between views
When I toggle to card view and back
Then my filters and sorting are preserved
And my view preference is saved

Given I have many findings
When I scroll in card view
Then cards load with pagination or infinite scroll
And performance is smooth
```

**Related FR:**
- FR-KB-003: Knowledge Retrieval (display flexibility)

**UX Reference:** Knowledge Explorer - Findings Card View (Section 5.3)

**Definition of Done:**
- [ ] Card view implemented
- [ ] View toggle switches between table and card
- [ ] Cards display all metadata
- [ ] Validation actions work in card view
- [ ] Filters and sorting preserved
- [ ] View preference persisted
- [ ] Responsive grid layout (2-3 columns)
- [ ] Pagination or infinite scroll

---

#### Story E4.5: Implement Source Attribution Links

**As an** M&A analyst
**I want** to click on a source citation
**So that** I can view the original document location

**Description:**
Make source attribution clickable throughout the application, opening the source document at the exact location (page, section, cell reference) where the finding was extracted.

**Technical Details:**
- Source citation format: "document_name.xlsx, Sheet 'P&L', Cell B15"
- Clickable link component
- On click: Open document viewer/preview modal
- Navigate to exact location (highlight cell, jump to page)
- Document viewer supports Excel, PDF, Word (MVP: basic preview)

**Acceptance Criteria:**

```gherkin
Given a finding has source attribution
When I view the finding
Then the source is displayed as a clickable link
And it shows: document name, page/section/cell reference

Given I click a source link
When the link is clicked
Then the document viewer opens
And navigates to the exact location
And the relevant cell/section is highlighted

Given the source is an Excel cell
When I click the link
Then the Excel preview opens to the correct sheet
And the cell B15 is highlighted

Given the source is a PDF page
When I click the link
Then the PDF preview opens to that page
And the page is scrolled into view

Given the document is not yet processed
When I click the source link
Then I see "Document preview not available"
And a link to download the original file
```

**Related FR:**
- FR-KB-002: Source Attribution
- NFR-ACC-002: Source Precision

**UX Reference:** Shared Components - Source Citation Link (Section 10.2)

**Definition of Done:**
- [ ] Source citations are clickable links
- [ ] Document viewer modal implemented
- [ ] Excel preview with sheet navigation
- [ ] PDF preview with page jump
- [ ] Cell/section highlighting works
- [ ] Fallback for unavailable previews
- [ ] Download original file option
- [ ] Preview modal responsive

---

#### Story E4.6: Build Contradictions View

**As an** M&A analyst
**I want** to see conflicting findings side-by-side
**So that** I can resolve contradictions

**Description:**
Implement the Contradictions View tab in Knowledge Explorer that displays conflicting findings in a side-by-side comparison layout with resolution actions.

**Technical Details:**
- Tab: Contradictions
- Detect contradictions using Neo4j `CONTRADICTS` relationships
- Side-by-side card layout: Finding A vs Finding B
- Show confidence scores for each
- Resolution actions: Accept A, Accept B, Investigate, Add Note
- Update `contradictions` table with resolution
- Filter: Unresolved, Resolved, Noted

**Acceptance Criteria:**

```gherkin
Given contradictions are detected
When I navigate to Contradictions tab
Then I see a list of contradictions
And each shows Finding A vs Finding B side-by-side

Given I view a contradiction
When I see the comparison
Then both findings show: text, source, confidence
And I can compare them easily

Given I want to resolve a contradiction
When I click "Accept A"
Then Finding A is marked as correct
And Finding B status updates to "rejected"
And the contradiction is marked as resolved

Given I need more information
When I click "Investigate Further"
Then the contradiction is flagged for review
And I can add a note explaining why

Given I want to explain a discrepancy
When I click "Add Note"
Then I can write an explanation
And the note is saved with the contradiction
And the status changes to "noted"

Given contradictions are resolved
When I filter by "Unresolved"
Then only unresolved contradictions show
And the count updates
```

**Related FR:**
- FR-KB-004: Cross-Document Analysis
- NFR-ACC-003: Contradiction Detection

**UX Reference:** Knowledge Explorer - Contradictions View (Section 5.3)

**Definition of Done:**
- [ ] Contradictions tab implemented
- [ ] Side-by-side comparison layout
- [ ] Resolution actions work (Accept A, Accept B, Investigate, Add Note)
- [ ] Contradictions table updated
- [ ] Filter by resolution status
- [ ] Notes can be added
- [ ] Empty state for no contradictions
- [ ] Resolved contradictions archived

---

#### Story E4.7: Detect Contradictions Using Neo4j

**As a** developer
**I want** to detect contradictions between findings
**So that** analysts can resolve conflicting information

**Description:**
Implement contradiction detection logic that compares findings using LLM analysis and stores `CONTRADICTS` relationships in Neo4j when conflicting information is found.

**Technical Details:**
- Job type: `detect_contradictions`
- Run after document analysis completes
- Group findings by topic/domain
- Use Gemini 3.0 Pro to compare findings: "Do these findings contradict each other?"
- If contradiction detected, create `CONTRADICTS` relationship in Neo4j
- Store contradiction in `contradictions` table
- Confidence threshold: >70% contradiction likelihood

**Acceptance Criteria:**

```gherkin
Given two findings state different Q3 revenues
When contradiction detection runs
Then the LLM identifies the contradiction
And a `CONTRADICTS` relationship is created in Neo4j
And a record is added to the contradictions table

Given findings are from different domains
When contradiction detection runs
Then only relevant comparisons are made
And unrelated findings are not compared

Given a contradiction is detected
When I query the contradictions table
Then I see: finding_a_id, finding_b_id, confidence, status
And the status is "unresolved"

Given no contradictions exist
When detection runs
Then no false positives are created
And the contradictions table remains empty

Given the LLM confidence is below 70%
When a potential contradiction is found
Then it is not flagged as a contradiction
And analysts are not alerted
```

**Related FR:**
- NFR-ACC-003: Contradiction Detection
- FR-KB-004: Cross-Document Analysis

**Architecture Reference:** Cross-Domain Intelligence (Phase 3 foundation)

**Definition of Done:**
- [ ] `detect_contradictions` job handler created
- [ ] LLM comparison logic implemented
- [ ] Neo4j `CONTRADICTS` relationships created
- [ ] Contradictions table populated
- [ ] Confidence threshold applied (>70%)
- [ ] False positive rate minimized
- [ ] Job runs after document analysis
- [ ] Performance acceptable for large datasets

---

#### Story E4.8: Build Gap Analysis View

**As an** M&A analyst
**I want** to identify missing information
**So that** I can request additional documents or data

**Description:**
Implement the Gap Analysis tab that identifies missing IRL items, information gaps in the knowledge base, and incomplete analysis areas.

**Technical Details:**
- Tab: Gap Analysis
- Categories: IRL Items Not Received, Information Gaps, Incomplete Analysis
- IRL gaps: Compare IRL items vs uploaded documents
- Information gaps: Use LLM to identify missing data points based on deal type
- Display gap cards with priority (High, Medium, Low)
- Actions: Add to IRL, Mark N/A, Add Manual Finding

**Acceptance Criteria:**

```gherkin
Given I have an IRL with 10 items
When 3 items are not yet uploaded
Then Gap Analysis shows "3 IRL items not received"
And lists the missing items

Given the knowledge base is analyzed
When information gaps are detected
Then Gap Analysis shows missing data points
And each gap has a description (e.g., "5-year revenue forecast not found")

Given I view a gap
When I see the gap card
Then it shows: category, description, priority
And actions are available: Add to IRL, Mark N/A, Add Manual Finding

Given I click "Add to IRL"
When the action completes
Then the gap is added to the IRL as a new request item
And the gap is marked as addressed

Given I click "Mark N/A"
When I confirm
Then the gap is marked as not applicable
And it is removed from the active gaps list

Given I click "Add Manual Finding"
When I enter the information
Then a manual finding is created
And the gap is marked as resolved
```

**Related FR:**
- FR-KB-004: Cross-Document Analysis (gap identification)
- FR-IRL-003: IRL-Document Linking (gap context)

**UX Reference:** Knowledge Explorer - Gap Analysis (Section 5.3)

**Definition of Done:**
- [ ] Gap Analysis tab implemented
- [ ] IRL gap detection works
- [ ] Information gap detection using LLM
- [ ] Gap cards display with priority
- [ ] Add to IRL action works
- [ ] Mark N/A action works
- [ ] Add Manual Finding action works
- [ ] Gaps update dynamically
- [ ] Empty state for no gaps

---

#### Story E4.9: Implement Finding Detail View with Full Context

**As an** M&A analyst
**I want** to see full context for a finding
**So that** I can understand it deeply

**Description:**
Create a finding detail modal or side panel that shows all metadata, source attribution with preview, related findings, confidence reasoning, and validation history.

**Technical Details:**
- Modal or slide-out panel
- Sections: Finding text, Confidence score with reasoning, Source attribution (clickable), Related findings (same topic), Validation history (edits, status changes)
- Fetch from `findings`, `document_chunks`, `contradictions`, `validation_history` tables
- Display thinking mode reasoning from Gemini (if available)

**Acceptance Criteria:**

```gherkin
Given I click on a finding
When the detail view opens
Then I see the full finding text
And the confidence score with reasoning

Given the detail view is open
When I view source attribution
Then I see the document name, page/section, and preview
And I can click to open full document

Given there are related findings
When I view the detail
Then I see "Related Findings" section
And findings on the same topic are listed

Given the finding has been validated
When I view the validation history
Then I see who validated it and when
And any edits that were made

Given I want to close the detail view
When I click outside or press Escape
Then the modal closes
And I return to the findings list
```

**Related FR:**
- FR-KB-001: Structured Knowledge Storage (full metadata)
- FR-KB-002: Source Attribution (detailed view)

**UX Reference:** Knowledge Explorer interactions (implied)

**Definition of Done:**
- [ ] Finding detail modal/panel implemented
- [ ] All metadata displayed
- [ ] Source attribution with preview
- [ ] Related findings section
- [ ] Validation history shown
- [ ] Confidence reasoning displayed
- [ ] Modal/panel opens on click
- [ ] Close actions work (outside click, Escape)

---

#### Story E4.10: Implement Export Findings to CSV/Excel

**As an** M&A analyst
**I want** to export findings to CSV or Excel
**So that** I can use them in other tools

**Description:**
Add export functionality to the Findings Browser that allows users to export all findings (or filtered subset) to CSV or Excel format with all metadata.

**Technical Details:**
- Export button in Findings Browser
- Format options: CSV, Excel (.xlsx)
- Include columns: Finding, Source, Domain, Confidence, Status, Date
- Apply current filters to export
- Use library: csv-writer for CSV, exceljs for Excel
- Download file to user's machine

**Acceptance Criteria:**

```gherkin
Given I am viewing findings
When I click "Export" button
Then I see format options: CSV, Excel

Given I select "Export to CSV"
When the export processes
Then a CSV file downloads
And it contains all visible findings
And columns are: Finding, Source, Domain, Confidence, Status, Date

Given I select "Export to Excel"
When the export processes
Then an Excel file downloads
And it is formatted with headers
And columns are properly sized

Given I have filters applied
When I export findings
Then only filtered findings are included in the export
And the export respects my current view

Given there are 500 findings
When I export
Then all 500 are included (not just current page)
And the export completes within 10 seconds
```

**Related FR:**
- NFR-INT-002: Export Formats

**UX Reference:** Knowledge Explorer actions (implied)

**Definition of Done:**
- [ ] Export button added to Findings Browser
- [ ] CSV export works
- [ ] Excel export works
- [ ] All columns included in export
- [ ] Current filters applied to export
- [ ] All findings exported (not just current page)
- [ ] File downloads correctly
- [ ] Performance acceptable (<10s for 500 findings)

---

## Epic 5: Conversational Assistant

**User Value:** Users can query knowledge through natural language and get instant answers with source attribution (11 chat tools)

**Description:** Implements the Analysis/Chat interface with Claude Sonnet 4.5 as the conversational agent using LangChain's tool-calling agent framework. Users can ask questions about their deal, request summaries, compare across documents, drill down into specific findings, upload documents directly in chat, and capture findings collaboratively. The agent uses native function calling with 11 specialized tools to dynamically select and invoke platform services: query the knowledge base, update findings, validate contradictions, detect uncertainty and suggest Q&A items, and provide accurate, source-attributed answers. Supports collaborative analysis workflows and real-time finding capture with temporal validation.

**Note:** CIM v3 tools (suggest_narrative_outline, validate_idea_coherence, generate_slide_blueprint) are NOT available in chat - they belong to the separate CIM Builder workflow agent (Epic 9).

**Functional Requirements Covered:**
- FR-CONV-001: Chat Interface
- FR-CONV-002: Query Capabilities
- FR-CONV-004: Response Quality
- FR-ARCH-002: Tool-Based Agent Integration
- FR-COLLAB-001: Collaborative Document Analysis (chat-based capture)

**UX Screens:**
- Chat Interface
- Conversation History
- Message with Sources
- Quick Actions
- Collaborative Analysis Mode

**Technical Components:**
- Claude Sonnet 4.5 via LangChain ChatAnthropic adapter
- LangGraph for conversation workflow orchestration
- Pydantic v2 for type-safe tool definitions and structured outputs
- Tool calling framework (11 chat tools - CIM v3 tools are in separate workflow agent)
  - Knowledge: query_knowledge_base, update_knowledge_base, update_knowledge_graph, validate_finding
  - Documents: get_document_info, trigger_analysis
  - Workflows: create_irl, suggest_questions, add_to_qa
  - Intelligence: detect_contradictions, find_gaps
- Conversation state management with LangGraph checkpoints
- WebSocket for real-time responses
- Real-time finding validation during chat

**Acceptance Criteria (Epic Level):**
- ✅ User can ask questions in natural language
- ✅ Agent provides answers with source citations
- ✅ Conversation history persists across sessions
- ✅ Agent can call all 11 chat tools to access platform services
- ✅ Responses include confidence indicators
- ✅ Follow-up questions maintain context
- ✅ User can capture findings via chat and system validates in real-time
- ✅ System suggests Q&A questions based on conversation

### Stories

#### Story E5.1: Integrate Claude Sonnet 4.5 via LangChain

**As a** developer
**I want** Claude Sonnet 4.5 integrated via LangChain ChatAnthropic adapter
**So that** we have a production-ready LLM interface for conversation with type safety

**Description:**
Set up LangChain ChatAnthropic adapter for Claude Sonnet 4.5, implement basic chat completion endpoint with Pydantic v2 structured outputs, configure retry/timeout logic, and create type-safe LLM client wrapper for the application.

**Technical Details:**
- Install LangChain core and langchain-anthropic packages
- Configure ChatAnthropic with Claude Sonnet 4.5 model (claude-sonnet-4-5-20250929)
- Set up Pydantic v2 models for structured outputs using `with_structured_output()`
- Implement LLM client wrapper with type safety
- Configure retry logic (built-in LangChain retry with exponential backoff)
- Enable cost tracking via LangSmith or custom callback handlers
- Set up observability hooks

**Acceptance Criteria:**

```gherkin
Given LangChain ChatAnthropic is configured
When I send a chat completion request
Then Claude Sonnet 4.5 responds with generated text
And the response time is logged

Given the API fails on first attempt
When the request is made
Then LangChain automatically retries with exponential backoff
And succeeds on the second attempt

Given I make multiple LLM calls
When I check the cost tracker
Then I can see total tokens used and estimated cost
And each request is logged with model and tokens

Given I use structured output with Pydantic models
When I call the LLM with a Pydantic schema
Then the response is validated and parsed into the Pydantic model
And invalid outputs raise validation errors

Given I use the LLM client wrapper
When I call it with invalid parameters
Then Pydantic validation catches the error
And I receive a clear type error message
```

**Related FR:**
- FR-ARCH-002: Tool-Based Agent Integration
- FR-CONV-004: Response Quality (retry ensures reliability)

**Architecture Reference:** Intelligence Layer - Pydantic + LangGraph Integration Strategy

**Definition of Done:**
- [ ] LangChain and langchain-anthropic installed
- [ ] ChatAnthropic configured with Claude Sonnet 4.5
- [ ] Pydantic v2 structured output working
- [ ] LLM client wrapper with type safety
- [ ] Retry logic implemented (LangChain built-in)
- [ ] Cost tracking enabled (LangSmith or callbacks)
- [ ] Logging and observability working
- [ ] Basic chat completion tested
- [ ] Error handling for API failures
- [ ] Structured output validation tested

---

#### Story E5.2: Implement LangChain Agent with 11 Chat Tools

**As a** developer
**I want** to implement LangChain tool-calling agent with 11 chat-specific agent tools
**So that** the conversational agent can dynamically select and invoke tools during conversation

**Description:**
Create the LangChain tool-calling agent framework using `create_tool_calling_agent()` and implement 11 chat agent tools. The agent uses native function calling (Claude/Gemini) to dynamically select which tools to invoke based on user queries. CIM v3 tools are NOT included here - they belong to the separate CIM Builder workflow agent.

**Technical Details:**
- **Agent Pattern:** LangChain `create_tool_calling_agent()` with `AgentExecutor`
- **Tool Framework:** LangChain `@tool` decorator with Pydantic v2 schemas for validation
- **Streaming:** `astream_events()` for token-by-token streaming with tool call indicators
- **Security:** System prompt and tool metadata never exposed to frontend
- **Implement 11 tools** (each with Pydantic input/output validation):
  1. `query_knowledge_base(query, filters)` - Semantic search across findings
  2. `update_knowledge_base(finding, source, confidence, date_referenced)` - Store analyst-provided findings with temporal metadata
  3. `update_knowledge_graph(finding_id, relationships)` - Create relationships between findings
  4. `validate_finding(finding, context, date_referenced)` - Check finding against existing knowledge with temporal validation (prevents false contradictions)
  5. `get_document_info(doc_id)` - Retrieve document details
  6. `trigger_analysis(doc_id, analysis_type)` - Request processing
  7. `create_irl(deal_type)` - Generate IRL from template
  8. `suggest_questions(topic, max_count=10)` - Generate Q&A suggestions (hard cap at 10)
  9. `add_to_qa(question, answer, sources, priority)` - Add question/answer to Q&A list
  10. `detect_contradictions(topic)` - Find inconsistencies (temporal-aware)
  11. `find_gaps(category)` - Identify missing information
- Each tool returns formatted string for LLM consumption
- Tools access platform services via API calls
- **Key Pattern:** Tools wrap Pydantic-validated functions and format results for LLM
- **Uncertainty Detection:** Agent detects phrases like "I'm not sure" and suggests adding to Q&A list

**Acceptance Criteria:**

```gherkin
Given the agent receives a query about Q3 revenue
When it calls `query_knowledge_base(query="Q3 revenue")`
Then the tool performs semantic search using pgvector
And returns top findings with sources
And the agent formats them into a natural language response

Given the agent is asked about contradictions
When it calls `detect_contradictions(topic="revenue")`
Then the tool queries Neo4j for CONTRADICTS relationships
And returns conflicting findings
And the agent presents them side-by-side

Given the agent needs document metadata
When it calls `get_document_info(doc_id="123")`
Then the tool retrieves document from database
And returns name, type, upload date, processing status

Given a tool call fails
When an error occurs
Then the agent handles it gracefully
And tells the user what went wrong
```

**Related FR:**
- FR-CONV-002: Query Capabilities
- FR-ARCH-002: Tool-Based Agent Integration

**Architecture Reference:**
- Agent Tools (Intelligence Layer section)
- **Conversational Agent Implementation (Real-Time Chat)** section (NEW - added 2025-11-24)

**Definition of Done:**
- [ ] LangChain `create_tool_calling_agent()` implemented with AgentExecutor
- [ ] All 11 chat agent tools created with `@tool` decorator
- [ ] Each tool has Pydantic schema for input validation
- [ ] Temporal metadata (date_referenced) integrated in update_knowledge_base and validate_finding
- [ ] Tools wrap Pydantic-validated functions and format results for LLM
- [ ] Agent executor configured with streaming (`astream_events`)
- [ ] Tool selection works dynamically (LLM decides which tools to call)
- [ ] Uncertainty detection triggers Q&A suggestion
- [ ] Security: System prompt never exposed to frontend
- [ ] Error handling in tools (graceful failures)
- [ ] Tools tested independently
- [ ] Agent integration tested with sample conversations
- [ ] Documentation for each tool (docstrings + architecture doc)

---

#### Story E5.3: Build Chat Interface with Conversation History

**As an** M&A analyst
**I want** a chat interface to ask questions
**So that** I can query my knowledge base naturally

**Description:**
Implement the Chat UI component with message display, input area, conversation history, and real-time streaming responses from Claude.

**Technical Details:**
- Route: `/projects/[id]/chat`
- Message list (scrollable, auto-scroll to bottom)
- Input textarea with submit button
- Conversation history sidebar (collapsible)
- Streaming responses (token-by-token display)
- Loading indicators during tool calls
- Store conversations in `conversations` and `messages` tables

**Acceptance Criteria:**

```gherkin
Given I navigate to Chat
When the page loads
Then I see the chat interface
And a text input at the bottom
And conversation history on the left (if exists)

Given I type a question and press Enter
When I submit the message
Then my message appears in the chat
And a loading indicator shows
And the agent's response streams in token-by-token

Given the agent calls a tool
When the tool is executing
Then I see "Searching knowledge base..." indicator
And the response includes the tool results

Given I have previous conversations
When I open Chat
Then I see a list of past conversations in the sidebar
And I can click one to load it

Given I want to start a new conversation
When I click "New Conversation"
Then the chat clears
And a fresh conversation is created
And the old one is saved
```

**Related FR:**
- FR-CONV-001: Chat Interface
- FR-CONV-002: Query Capabilities

**UX Reference:** Chat Interface (Section 5.4)

**Definition of Done:**
- [ ] Chat route implemented
- [ ] Message display with scrolling
- [ ] Input textarea with submit
- [ ] Streaming responses working
- [ ] Conversation history sidebar
- [ ] New conversation button
- [ ] Loading indicators
- [ ] Messages saved to database
- [ ] Responsive design

---

#### Story E5.4: Implement Source Citation Display in Messages

**As an** M&A analyst
**I want** to see source citations in chat responses
**So that** I can verify the agent's answers

**Description:**
Format agent responses to include inline source citations that are clickable, showing the document name and location. When clicked, open the document viewer at the exact location.

**Technical Details:**
- Parse LLM responses for source citations
- Format: "Q3 revenues were $5.2M (source: financials.xlsx, P&L, B15)"
- Make citations clickable links
- On click: Open document viewer modal at exact location
- Citations styled distinctly (subtle background, monospace font)

**Acceptance Criteria:**

```gherkin
Given the agent provides an answer with a source
When I view the response
Then I see the source citation inline
And it shows: document name, page/section/cell reference
And it's formatted as a clickable link

Given I click on a source citation
When the link is activated
Then the document viewer opens
And navigates to the exact location
And the relevant section is highlighted

Given multiple sources are cited
When I view the response
Then each source is a separate clickable link
And they're clearly distinguished

Given a source citation format is invalid
When the message is rendered
Then the citation still displays
And a fallback format is used
```

**Related FR:**
- FR-CONV-004: Response Quality
- FR-KB-002: Source Attribution

**UX Reference:** Message with Sources (Section 5.4)

**Definition of Done:**
- [ ] Source citations parsed from LLM responses
- [ ] Citations rendered as clickable links
- [ ] Document viewer integration
- [ ] Highlighting of cited location
- [ ] Multiple citations supported
- [ ] Citation styling implemented
- [ ] Fallback for invalid formats
- [ ] Mobile-friendly citation display

---

#### Story E5.5: Implement Quick Actions and Suggested Follow-ups

**As an** M&A analyst
**I want** quick action buttons and suggested follow-ups
**So that** I can efficiently perform common tasks

**Description:**
Add quick action buttons in the chat interface for common operations (Generate Q&A draft, Find contradictions, Summarize findings, Create CIM section) and implement suggested follow-up questions that appear after each response.

**Technical Details:**
- Quick action buttons (always visible at bottom)
- Suggested follow-ups generated by LLM based on context
- Clicking a suggestion populates the input field
- Quick actions trigger specific tool calls
- Button states: enabled, disabled, loading

**Acceptance Criteria:**

```gherkin
Given I am in Chat
When I view the interface
Then I see quick action buttons at the bottom
And they include: Generate Q&A, Find Contradictions, Summarize, Create CIM

Given I click "Find Contradictions"
When the action triggers
Then the agent automatically searches for contradictions
And displays results in the chat

Given the agent responds to my question
When the response completes
Then I see 2-3 suggested follow-up questions
And they're relevant to the current context

Given I click a suggested follow-up
When I select it
Then the question is populated in the input field
And I can edit before submitting

Given a quick action is not available
When the conditions aren't met (e.g., no documents uploaded)
Then the button is disabled
And a tooltip explains why
```

**Related FR:**
- FR-CONV-002: Query Capabilities
- NFR-USE-001: User Interface (efficiency)

**UX Reference:** Chat - Quick Actions (Section 5.4)

**Definition of Done:**
- [ ] Quick action buttons implemented
- [ ] Each action triggers correct tool
- [ ] Suggested follow-ups generated
- [ ] Follow-ups clickable and populate input
- [ ] Button states (enabled/disabled/loading)
- [ ] Tooltips for disabled buttons
- [ ] Actions tested and working
- [ ] Responsive button layout

---

#### Story E5.6: Add Conversation Context and Multi-turn Support

**As an** M&A analyst
**I want** the agent to remember previous messages
**So that** I can have natural multi-turn conversations

**Description:**
Implement conversation context management that maintains message history across multiple turns, allows the agent to reference previous exchanges, and preserves context across sessions.

**Technical Details:**
- Store conversation history in `conversations` table
- Pass last N messages to LLM (e.g., 10 messages)
- Implement context window management (truncate if needed)
- Reference previous exchanges: "As we discussed earlier..."
- Persist context across page reloads

**Acceptance Criteria:**

```gherkin
Given I ask "What was Q3 revenue?"
When the agent responds "$5.2M"
Then the conversation history is saved

Given I follow up with "How does that compare to Q2?"
When the agent responds
Then it remembers Q3 revenue from the previous exchange
And provides a comparison

Given I navigate away and return
When I reload the Chat page
Then my conversation history is still there
And the context is preserved

Given I have a long conversation (20+ messages)
When I ask a new question
Then the agent uses the last 10 messages for context
And older messages are summarized or truncated

Given I reference something from earlier
When I say "the revenue you mentioned"
Then the agent knows I'm referring to Q3 revenue
And responds appropriately
```

**Related FR:**
- FR-CONV-001: Chat Interface (context preservation)
- FR-CONV-002: Query Capabilities

**Architecture Reference:** Conversation state management

**Definition of Done:**
- [ ] Conversation history stored in database
- [ ] Last N messages passed to LLM
- [ ] Context window management implemented
- [ ] Agent references previous exchanges correctly
- [ ] Context persists across sessions
- [ ] Long conversations handled gracefully
- [ ] Context truncation tested
- [ ] Multi-turn conversations work naturally

---

#### Story E5.7: Implement Confidence Indicators and Uncertainty Handling

**As an** M&A analyst
**I want** to see confidence indicators on agent responses
**So that** I know how certain the information is

**Description:**
Add confidence badges/indicators to agent responses, clearly mark uncertain information, and provide caveats when the agent doesn't have enough data to answer confidently.

**Technical Details:**
- Confidence score extraction from tool responses
- Visual indicators: High (>80%), Medium (60-80%), Low (<60%)
- Uncertainty phrases: "Based on available data..." "I'm not certain, but..."
- Badge component with color coding (green/yellow/red)
- Tooltip with confidence reasoning

**Acceptance Criteria:**

```gherkin
Given the agent provides a fact-based answer
When the response includes findings with high confidence
Then I see a green "High Confidence" badge
And the badge shows 95%

Given the agent's answer is less certain
When the confidence is 65%
Then I see a yellow "Medium Confidence" badge
And the agent includes caveats like "Based on available data..."

Given the agent doesn't have enough information
When I ask about something not in the knowledge base
Then the agent says "I don't have information about that"
And suggests where to find it or what to upload

Given I hover over a confidence badge
When my cursor is over it
Then I see a tooltip explaining the confidence score
And what factors contributed to it

Given multiple findings contribute to an answer
When confidences vary
Then the agent shows the lowest confidence
And explains the range
```

**Related FR:**
- FR-CONV-004: Response Quality
- NFR-ACC-001: Information Accuracy

**UX Reference:** Confidence Badge (Section 10.2)

**Definition of Done:**
- [ ] Confidence scores extracted from responses
- [ ] Badge component implemented
- [ ] Color coding (green/yellow/red)
- [ ] Uncertainty phrases in responses
- [ ] Tooltip with reasoning
- [ ] Low confidence triggers caveats
- [ ] Missing information handled gracefully
- [ ] Badge displays correctly in messages

---

#### Story E5.8: Implement Chat Export Functionality

**As an** M&A analyst
**I want** to export chat conversations
**So that** I can share insights with colleagues or save for records

**Description:**
Enable users to export chat conversations in multiple formats (Markdown, PDF, Word) with all messages, sources, and timestamps preserved.

**Technical Details:**
- Export button in chat interface
- Format options: Markdown, PDF, Word
- Include: all messages, timestamps, source citations, confidence scores
- Preserve formatting and structure

**Acceptance Criteria:**

```gherkin
Given I have an active conversation
When I click "Export Conversation"
Then I see format options (Markdown, PDF, Word)

Given I select Markdown format
When export completes
Then I download a .md file with full conversation history
And all source links are preserved

Given the conversation has 50+ messages
When I export to PDF
Then the document is properly paginated
And formatting is preserved
```

**Related FR:**
- FR-CONV-001: Chat Interface

**Definition of Done:**
- [ ] Export button in chat UI
- [ ] Markdown export works
- [ ] PDF export works
- [ ] Word export works
- [ ] Source citations preserved
- [ ] Timestamps included
- [ ] Formatting maintained

---

#### Story E5.9: Implement Document Upload via Chat Interface

**As an** M&A analyst
**I want** to upload documents directly in the chat
**So that** I can quickly add files without leaving the conversation

**Description:**
Add drag-and-drop and file picker support to chat interface for document uploads. Uploaded files automatically trigger the same processing pipeline as Data Room uploads.

**Technical Details:**
- File picker button in chat input area
- Drag-and-drop support on chat window
- Accepted formats: PDF, Excel, Word, images
- Upload triggers E3 processing pipeline
- Status updates via chat message ("Analyzing document...")
- Post-processing notification ("12 findings extracted from financials.xlsx")

**Acceptance Criteria:**

```gherkin
Given I'm in the chat interface
When I click the file upload button
Then I see file picker dialog

Given I select a PDF document
When upload completes
Then I see "Uploading financials.pdf..." message
And processing status updates in chat
And final notification "Analysis complete - 12 findings extracted"

Given I drag and drop an Excel file onto chat
When file is dropped
Then upload and processing begins automatically
And I see progress updates in chat

Given upload or processing fails
When error occurs
Then I see clear error message in chat
And suggested actions to resolve
```

**Related FR:**
- FR-DOC-001: Document Upload
- FR-BG-001: Event-Driven Architecture

**UX Reference:** Chat Interface (Section 5.4)

**Definition of Done:**
- [ ] File picker button in chat input
- [ ] Drag-and-drop support
- [ ] Upload triggers processing pipeline
- [ ] Status updates via chat messages
- [ ] Post-processing notification
- [ ] Error handling with user-friendly messages
- [ ] Multiple file formats supported
- [ ] Upload integrated with Data Room storage

---

## Epic 6: IRL Management & Auto-Generation

**User Value:** Users can upload Excel IRLs to extract structure and auto-generate Data Room folders, track document fulfillment, and identify gaps

**Description:** Implements the IRL (Information Request List) workflow focused on: (1) **Upload and Extract IRL**: Upload IRL Excel file and system extracts structure, categories, and requested items, (2) **Auto-Generate Data Room**: Automatically create hierarchical folder structure based on extracted IRL, (3) **Track Fulfillment**: IRL checklist auto-updates as documents are placed in folders, showing coverage and gaps, (4) **Gap Identification**: System identifies missing items and suggests follow-up requests. Users can also select from templates for different deal types and customize IRL items as needed.

**Functional Requirements Covered:**
- FR-IRL-001: IRL Creation
- FR-IRL-002: IRL Tracking
- FR-IRL-003: IRL-Document Linking
- FR-IRL-004: Template Library
- FR-IRL-005: Auto-Generate Folder Structure from IRL (NEW - PRD v1.1)

**UX Screens:**
- Deliverables > IRL Tab
- IRL Template Selection
- IRL Builder
- IRL Upload Interface (Excel)
- Data Room - Auto-Generated Folder Structure
- IRL Status Tracking with Auto-Update

**Technical Components:**
- IRL templates (JSON/YAML)
- Excel parser for IRL structure extraction
- PostgreSQL `irls` and `irl_items` tables
- Automatic folder structure generation in Data Room
- Document linking logic with auto-status updates
- Progress calculation
- Folder-to-IRL-item mapping

**Acceptance Criteria (Epic Level):**
- ✅ User can create IRL from templates
- ✅ User can upload IRL Excel file
- ✅ System auto-generates Data Room folder structure from uploaded IRL
- ✅ Folder structure matches IRL categories and hierarchy
- ✅ User can customize IRL items
- ✅ User can track which items are fulfilled
- ✅ When documents placed in IRL-linked folders, IRL checklist auto-updates
- ✅ Documents can be manually linked to IRL items
- ✅ Progress indicators show completion percentage
- ✅ IRL can be exported to PDF/Word

### Stories

#### Story E6.1: Create IRL Template Library

**As a** developer
**I want** a library of IRL templates for different deal types
**So that** users can quickly create relevant IRLs

**Description:**
Create IRL template files for common M&A deal types (Tech M&A, Industrial, Pharma, Financial Services) with pre-defined categories and standard document requests.

**Technical Details:**
- Template format: JSON or YAML
- Templates stored in `/packages/shared/templates/irls/`
- Template structure:
  - Deal type
  - Categories (Financial, Legal, Operational, etc.)
  - Items per category (with priority, description)
- Load templates from file system
- API endpoint to list available templates

**Acceptance Criteria:**

```gherkin
Given the IRL template library exists
When I query available templates
Then I see templates for: Tech M&A, Industrial, Pharma, Financial Services, Custom

Given I load the Tech M&A template
When I inspect its contents
Then I see categories: Financial, Legal, Operational, Technology & IP, Market & Strategy
And each category has 5-10 standard items

Given I load the Industrial template
When I inspect its contents
Then it has industry-specific items like Environmental Compliance, Safety Records

Given I create a new template type
When I add a JSON file to the templates folder
Then it appears in the available templates list
And can be used for IRL creation
```

**Related FR:**
- FR-IRL-004: Template Library

**Architecture Reference:** Workflow Service - IRL Management

**Definition of Done:**
- [ ] Template format defined (JSON/YAML)
- [ ] 4 standard templates created (Tech, Industrial, Pharma, Financial)
- [ ] Template structure documented
- [ ] Templates stored in correct location
- [ ] API endpoint to list templates
- [ ] Templates validated and tested
- [ ] Documentation for adding new templates

---

#### Story E6.2: Build IRL Template Selection UI

**As an** M&A analyst
**I want** to select an IRL template when creating a new IRL
**So that** I don't have to build from scratch

**Description:**
Implement the IRL template selection interface in the Deliverables tab that shows available templates with previews and allows users to select one as the starting point.

**Technical Details:**
- Route: `/projects/[id]/deliverables` (IRL tab)
- Template cards showing: name, description, number of items
- Preview modal showing template structure
- Select button to choose template
- Custom template option (blank slate)

**Acceptance Criteria:**

```gherkin
Given I navigate to Deliverables > IRL tab
When no IRL exists yet
Then I see "Create IRL" button
And template selection UI

Given I click "Create IRL"
When the template selection opens
Then I see 4 template cards: Tech M&A, Industrial, Pharma, Financial Services
And a "Custom (Blank)" option

Given I click "Preview" on a template
When the modal opens
Then I see the full template structure
And all categories and items listed

Given I select "Tech M&A" template
When I click "Use This Template"
Then the IRL builder opens
And is pre-populated with the template items
And I can customize it

Given I select "Custom (Blank)"
When I click "Start from Scratch"
Then the IRL builder opens empty
And I can add my own categories and items
```

**Related FR:**
- FR-IRL-001: IRL Creation
- FR-IRL-004: Template Library

**UX Reference:** Deliverables Studio - IRL Tab (Section 5.5)

**Definition of Done:**
- [ ] IRL tab in Deliverables implemented
- [ ] Template selection UI built
- [ ] Template cards display correctly
- [ ] Preview modal shows template structure
- [ ] Select template works
- [ ] Custom blank option available
- [ ] Transitions to IRL builder
- [ ] Responsive design

---

#### Story E6.3: Implement IRL Builder (Add/Edit/Remove Items)

**As an** M&A analyst
**I want** to customize my IRL items
**So that** I can request exactly what I need for this deal

**Description:**
Build the IRL builder interface that allows users to add, edit, remove, and reorder categories and items, set priorities, add notes, and structure their custom IRL.

**Technical Details:**
- Category sections (collapsible)
- Add/remove category
- Add/remove/edit items within categories
- Drag-and-drop reordering
- Item properties: name, description, priority (high/medium/low), expected delivery date, notes
- Save IRL to `irls` and `irl_items` tables

**Acceptance Criteria:**

```gherkin
Given I am in the IRL builder
When I click "Add Category"
Then a new category section is created
And I can name it

Given I have a category
When I click "Add Item"
Then a new item form appears
And I can enter: item name, description, priority, expected date

Given I want to reorder items
When I drag an item up or down
Then the order updates visually
And the new order is saved

Given I want to edit an item
When I click the edit icon
Then an inline editor opens
And I can modify all fields

Given I want to remove an item
When I click delete and confirm
Then the item is removed from the IRL

Given I've customized my IRL
When I click "Save IRL"
Then the IRL is saved to the database
And I can see it in the IRL tab
```

**Related FR:**
- FR-IRL-001: IRL Creation

**UX Reference:** Deliverables - IRL Builder (Section 5.5)

**Definition of Done:**
- [ ] IRL builder UI implemented
- [ ] Add/remove categories works
- [ ] Add/edit/remove items works
- [ ] Drag-and-drop reordering
- [ ] Item properties editable
- [ ] Save IRL to database
- [ ] Validation for required fields
- [ ] Cancel/discard changes option

---

#### Story E6.4: Implement IRL Status Tracking

**As an** M&A analyst
**I want** to track which IRL items are fulfilled
**So that** I know what I'm still waiting for

**Description:**
Add status tracking to IRL items (not started, pending, received, complete) with visual indicators, progress calculation, and the ability to update status manually or automatically when documents are linked.

**Technical Details:**
- Status enum: `not_started`, `pending`, `received`, `complete`
- Status indicators: ○ Not started, ⏱ Pending, ✓ Received, ✅ Complete
- Progress calculation: items complete / total items
- Manual status update (dropdown or buttons)
- Automatic status update when document linked

**Acceptance Criteria:**

```gherkin
Given I have an IRL with 10 items
When I view the IRL
Then each item shows a status indicator
And the overall progress shows 0/10 (0%)

Given I mark an item as "Pending"
When I update the status
Then the indicator changes to ⏱
And the item is highlighted as pending

Given a document is uploaded and linked to an IRL item
When the link is created
Then the item status automatically updates to "Received"
And the progress increments to 1/10 (10%)

Given I mark an item as "Complete"
When I update the status
Then the indicator changes to ✅
And the item is styled as complete

Given 8 out of 10 items are complete
When I view the progress
Then it shows 8/10 (80%)
And a progress bar reflects this visually
```

**Related FR:**
- FR-IRL-002: IRL Tracking

**UX Reference:** Deliverables - IRL Status Tracking (Section 5.5)

**Definition of Done:**
- [ ] Status field added to irl_items table
- [ ] Status indicators implemented
- [ ] Progress calculation correct
- [ ] Manual status update works
- [ ] Automatic status update on document link
- [ ] Progress bar visual
- [ ] Status filters (show only pending, etc.)
- [ ] Real-time updates

---

#### Story E6.5: Link Documents to IRL Items

**As an** M&A analyst
**I want** to link uploaded documents to IRL items
**So that** I can track fulfillment automatically

**Description:**
Implement document-to-IRL-item linking that allows users to manually link documents or have the system suggest mappings based on document category and filename matching.

**Technical Details:**
- Junction table: `irl_item_documents`
- Manual linking: Select document from dropdown per IRL item
- Suggested mappings: LLM analyzes filename and suggests IRL item
- Show linked documents per IRL item
- Unlink action
- Automatic status update on link

**Acceptance Criteria:**

```gherkin
Given I have an IRL item "Annual Financial Statements"
When I upload "financials_2023.xlsx"
Then the system suggests linking it to that IRL item

Given I view an IRL item
When I click "Link Document"
Then I see a dropdown of available documents
And I can select one to link

Given a document is linked to an IRL item
When I view the IRL item
Then I see the linked document name
And can click to view or download it

Given I want to unlink a document
When I click "Unlink" and confirm
Then the document is removed from the IRL item
And the status may revert to "Not Started" if no other docs linked

Given I link a document to an IRL item
When the link is created
Then the item status automatically updates to "Received"
And the progress bar updates
```

**Related FR:**
- FR-IRL-003: IRL-Document Linking

**UX Reference:** Data Room - IRL Integration (Section 5.2)

**Definition of Done:**
- [ ] irl_item_documents junction table created
- [ ] Manual linking UI implemented
- [ ] Suggested mappings using LLM
- [ ] Linked documents displayed on IRL item
- [ ] Unlink action works
- [ ] Status updates automatically on link
- [ ] Multiple documents can be linked to one item
- [ ] Progress updates correctly

---

#### Story E6.6: Export IRL to PDF/Word

**As an** M&A analyst
**I want** to export my IRL to PDF or Word
**So that** I can send it to the seller

**Description:**
Add export functionality that generates a professionally formatted IRL document in PDF or Word format with all categories, items, priorities, and notes.

**Technical Details:**
- Export button in IRL view
- Format options: PDF, Word (.docx)
- Template for IRL document (letterhead, formatting)
- Include: project name, date, all categories and items, priorities, notes
- Use library: pdfkit for PDF, python-docx for Word
- Download file to user's machine

**Acceptance Criteria:**

```gherkin
Given I have a completed IRL
When I click "Export"
Then I see format options: PDF, Word

Given I select "Export to PDF"
When the export processes
Then a PDF file downloads
And it contains all IRL categories and items
And priorities are clearly marked (High, Medium, Low)

Given I select "Export to Word"
When the export processes
Then a Word document downloads
And it's editable
And maintains professional formatting

Given my IRL has notes on items
When I export
Then the notes are included in the export
And clearly associated with each item

Given the export includes letterhead
When I view the exported document
Then it shows the project name at the top
And the export date
```

**Related FR:**
- NFR-INT-002: Export Formats

**UX Reference:** Deliverables - Export Actions

**Definition of Done:**
- [ ] Export button in IRL view
- [ ] PDF export works (pdfkit)
- [ ] Word export works (python-docx)
- [ ] Professional formatting applied
- [ ] All IRL data included
- [ ] Priorities displayed correctly
- [ ] Notes included in export
- [ ] Letterhead/header with project info
- [ ] File downloads correctly

---

## Epic 7: Learning Loop

**User Value:** System learns from analyst corrections and feedback to continuously improve accuracy and relevance

**Description:** Implements the learning loop where the system learns from analyst interactions - corrections to findings, validations/rejections, edits to agent responses, and general feedback. The system updates confidence scores, improves extraction patterns, stores analyst edits as examples for future generations, and maintains a feedback database to identify systematic issues. Moved from Phase 3 to MVP in PRD v1.1 to enable continuous improvement from day one.

**Learning Approach (MVP):** Uses **prompt optimization with few-shot examples** - system stores corrections in database and dynamically includes relevant correction patterns in agent system prompts. Future phases may explore fine-tuning or RAG-based learning enhancements.

**Functional Requirements Covered:**
- FR-LEARN-001: Finding Corrections
- FR-LEARN-002: Confidence Score Learning
- FR-LEARN-003: Response Improvement
- FR-LEARN-004: Feedback Incorporation

**UX Screens:**
- Knowledge Explorer - Inline Finding Correction
- Chat Interface - Response Edit Mode
- Knowledge Explorer - Validation Feedback UI
- Admin/Analytics - Feedback Dashboard (Phase 2)

**Technical Components:**
- Feedback database (PostgreSQL tables: `finding_corrections`, `validation_feedback`, `response_edits`)
- Confidence score adjustment algorithm
- Pattern learning service
- Correction propagation to knowledge graph
- Audit trail maintenance
- Analytics aggregation (Phase 2)

**Acceptance Criteria (Epic Level):**
- ✅ User can correct system-generated findings through chat or Knowledge Explorer
- ✅ Corrected findings update knowledge graph immediately
- ✅ System maintains complete correction history for audit
- ✅ Corrected findings propagate to related insights and answers
- ✅ System tracks analyst validation/rejection of findings
- ✅ Confidence scores adjust based on validation history
- ✅ User can edit agent-generated responses (Q&A, CIM content)
- ✅ System stores edits as examples for future generations
- ✅ All feedback linked to specific findings, sources, and contexts
- ✅ System learns from correction patterns to improve extraction

### Stories

#### Story E7.1: Implement Finding Correction via Chat

**As an** M&A analyst
**I want** to correct system-generated findings through the chat interface
**So that** the knowledge base reflects accurate information

**Description:**
Enable analysts to correct findings directly in chat using natural language commands like "That revenue number is wrong, it should be $50M not $45M" or "Correct: EBITDA margin is 22%, not 18%". System updates the finding, knowledge graph, and provides confirmation.

**Technical Details:**
- Detect correction intent in chat messages
- Agent tool: `update_knowledge_base` with correction flag
- Update finding in `findings` table
- Store original value in `finding_corrections` table
- Update Neo4j relationships
- Propagate changes to related insights
- Return confirmation message with updated finding

**Acceptance Criteria:**

```gherkin
Given I'm in a chat about financial findings
When I say "The revenue should be $50M, not $45M"
Then the system detects correction intent
And updates the finding to $50M
And stores the original $45M in corrections history
And updates the knowledge graph
And confirms "I've corrected the revenue finding to $50M. The original value ($45M) has been archived."

Given a corrected finding is linked to an insight
When I correct the finding
Then the related insight is flagged for review
And the system notifies me about dependent insights

Given I correct multiple findings in one message
When I provide corrections
Then all corrections are processed
And a summary confirmation is provided
```

**Related FR:**
- FR-LEARN-001: Finding Corrections
- FR-COLLAB-002: Finding Capture & Validation

**Definition of Done:**
- [ ] Chat detects correction intent
- [ ] Findings updated via update_knowledge_base tool
- [ ] Original values stored in finding_corrections table
- [ ] Correction history maintained with timestamp, analyst
- [ ] Knowledge graph updates propagated
- [ ] Related insights flagged for review
- [ ] Confirmation message provided
- [ ] Audit trail complete

---

#### Story E7.2: Track Validation/Rejection Feedback

**As a** system
**I want** to track when analysts validate or reject findings
**So that** confidence scores can be adjusted based on accuracy

**Description:**
Capture analyst validation/rejection actions in Knowledge Explorer and store in feedback database. Track which findings are validated, which are rejected, and adjust confidence scores accordingly. High rejection rates trigger review alerts.

**Technical Details:**
- Add "Validate" and "Reject" buttons to findings in Knowledge Explorer
- Store feedback in `validation_feedback` table (finding_id, action, analyst_id, timestamp)
- Calculate validation rate per finding source/domain
- Adjust confidence scores based on validation history
- Flag findings with >50% rejection rate for review
- Analytics on validation patterns

**Acceptance Criteria:**

```gherkin
Given I view a finding in Knowledge Explorer
When I click "Validate"
Then the finding is marked as validated
And the validation is recorded in feedback database
And the finding's confidence score increases slightly

Given I click "Reject" on a finding
When I provide a rejection reason (optional)
Then the finding is marked as rejected
And the rejection is recorded with reason
And the finding's confidence score decreases

Given a finding source has >50% rejection rate
When the threshold is exceeded
Then the system flags the source for review
And I see a warning when viewing similar findings

Given I validate 10 findings from the same document
When I check the confidence scores
Then similar findings from that document have increased confidence
And the extraction pattern is reinforced
```

**Related FR:**
- FR-LEARN-002: Confidence Score Learning

**Definition of Done:**
- [ ] Validate/Reject buttons in Knowledge Explorer
- [ ] validation_feedback table created and populated
- [ ] Confidence score adjustment algorithm implemented
- [ ] High rejection rate triggers review flag
- [ ] Validation patterns tracked by source/domain
- [ ] Feedback stored with analyst, timestamp
- [ ] Analytics on validation rates available

---

#### Story E7.3: Enable Response Editing and Learning

**As an** M&A analyst
**I want** to edit agent-generated responses (Q&A, CIM content)
**So that** the system learns my preferred style and improves over time

**Description:**
Allow analysts to edit agent responses in Q&A answers and CIM sections. Store edits as examples, identify patterns (e.g., analyst always changes "utilize" to "use"), and improve future generations based on learned preferences.

**Technical Details:**
- Add "Edit Response" button to Q&A answers and CIM sections
- Store original + edited versions in `response_edits` table
- Text diff algorithm to identify edit patterns
- Store frequently edited phrases/patterns
- Use edit examples in few-shot prompts for future generation
- Per-analyst or per-deal learning (configurable)

**Acceptance Criteria:**

```gherkin
Given I view a Q&A answer
When I click "Edit Response"
Then I can modify the text inline
And the edited version is saved
And the original version is archived

Given I save an edited response
When the system processes the edit
Then it identifies the differences (text diff)
And stores the edit pattern
And links it to my analyst profile

Given I frequently change "utilize" to "use"
When the system detects this pattern (3+ occurrences)
Then future generations avoid "utilize"
And prefer "use" instead

Given the system generates a new Q&A answer
When it uses my edit examples
Then the answer matches my preferred style
And requires fewer edits than before

Given I edit a CIM section
When I provide feedback on tone
Then future CIM sections adopt that tone
And I see "Based on your feedback, I'm using..."
```

**Related FR:**
- FR-LEARN-003: Response Improvement

**Definition of Done:**
- [ ] Edit Response UI in Q&A and CIM views
- [ ] response_edits table stores original + edited versions
- [ ] Text diff algorithm identifies edit patterns
- [ ] Frequently edited phrases stored
- [ ] Edit examples used in few-shot prompts
- [ ] Per-analyst learning configurable
- [ ] Pattern detection algorithm (3+ occurrences)
- [ ] System feedback on learned preferences

---

#### Story E7.4: Build Feedback Incorporation System

**As a** system
**I want** to analyze all analyst feedback to identify systematic issues
**So that** extraction and generation quality improves over time

**Description:**
Create a feedback incorporation service that analyzes corrections, validations, and edits to identify systematic issues (e.g., "financial tables always extracted incorrectly", "tech jargon confuses the model"). Use insights to improve prompts, adjust confidence thresholds, and flag problematic patterns.

**Technical Details:**
- Background job to analyze feedback database weekly
- Group feedback by: document type, domain, extraction pattern
- Identify systematic issues (high rejection rate for specific pattern)
- Generate improvement recommendations
- Adjust prompts/confidence thresholds automatically
- Admin dashboard showing feedback insights (Phase 2)

**Acceptance Criteria:**

```gherkin
Given 50+ findings have been corrected with similar pattern
When the feedback analysis runs
Then the system identifies the systematic issue
And flags it in the admin dashboard
And suggests a prompt improvement

Given financial tables have 40% rejection rate
When the analysis detects this
Then the system lowers confidence threshold for table extraction
And flags tables for manual review
And logs the adjustment

Given the system makes an adjustment
When I check the feedback dashboard
Then I see what changed and why
And the impact on accuracy
And can revert if needed

Given the feedback system runs weekly
When a new batch of feedback is analyzed
Then improvements are suggested
And confidence thresholds are adjusted
And extraction patterns are reinforced or deprecated
```

**Related FR:**
- FR-LEARN-004: Feedback Incorporation

**Definition of Done:**
- [ ] Weekly background job for feedback analysis
- [ ] Feedback grouped by type, domain, pattern
- [ ] Systematic issue detection algorithm
- [ ] Automatic confidence threshold adjustment
- [ ] Prompt improvement recommendations
- [ ] Admin dashboard (basic - full in Phase 2)
- [ ] Change log for all adjustments
- [ ] Revert capability for adjustments

---

#### Story E7.5: Maintain Comprehensive Audit Trail

**As a** compliance officer / analyst
**I want** a complete audit trail of all corrections and feedback
**So that** I can track what changed, when, and why

**Description:**
Ensure all finding corrections, validations, rejections, and response edits are logged with complete context (analyst, timestamp, reason, original value, new value). Audit trail is immutable and queryable for compliance and debugging.

**Technical Details:**
- finding_corrections table: finding_id, original_value, new_value, analyst_id, timestamp, reason
- validation_feedback table: finding_id, action (validate/reject), analyst_id, timestamp, reason
- response_edits table: response_id, original_text, edited_text, analyst_id, timestamp
- Immutable design (append-only, no deletes)
- Audit trail API for querying history
- Export audit trail to CSV/JSON

**Acceptance Criteria:**

```gherkin
Given I correct a finding
When the correction is saved
Then it's logged in finding_corrections with full context
And I can query the history later

Given I want to see all corrections by a specific analyst
When I query the audit trail
Then I see all their corrections with timestamps
And can filter by date range, finding type

Given I need to understand why a finding changed
When I view the finding history
Then I see the original value, new value, who changed it, when, and why
And can trace the complete lineage

Given I export the audit trail
When I download the CSV
Then all corrections, validations, and edits are included
And the file is formatted for compliance review
```

**Related FR:**
- FR-LEARN-001: Finding Corrections (audit requirement)
- NFR-COMP-001: Data Retention and Audit

**Definition of Done:**
- [ ] finding_corrections table with complete context
- [ ] validation_feedback table with actions
- [ ] response_edits table with text history
- [ ] Immutable append-only design
- [ ] Audit trail query API
- [ ] Export to CSV/JSON
- [ ] Date range filtering
- [ ] Analyst filtering
- [ ] Finding lineage view

---

#### Story E7.6: Propagate Corrections to Related Insights

**As an** M&A analyst
**I want** corrected findings to update related insights automatically
**So that** downstream work reflects accurate information

**Description:**
When a finding is corrected, identify all related insights (CIM sections, Q&A answers, contradictions) that depend on it, flag them for review, and optionally regenerate them with the corrected data. Ensure consistency across the knowledge base.

**Technical Details:**
- Neo4j query to find all insights connected to corrected finding
- Flag related insights as "Needs Review" due to dependency update
- Optionally regenerate insights with corrected data
- Notify analyst of downstream impacts
- Update knowledge graph relationships

**Acceptance Criteria:**

```gherkin
Given a finding is used in a Q&A answer
When I correct the finding
Then the Q&A answer is flagged "Needs Review"
And I'm notified about the dependent Q&A

Given I choose to regenerate dependent insights
When the system regenerates
Then the Q&A answer uses the corrected finding
And the "Needs Review" flag is cleared

Given a finding appears in a CIM section
When I correct it
Then the CIM section is flagged for review
And I can choose to regenerate or manually edit

Given I correct a finding with 5 dependent insights
When the correction propagates
Then all 5 insights are flagged
And I see a summary: "This correction affects 5 Q&A answers and 2 CIM sections"
```

**Related FR:**
- FR-LEARN-001: Finding Corrections (propagation requirement)
- FR-KB-004: Cross-Document Analysis

**Definition of Done:**
- [ ] Neo4j query finds dependent insights
- [ ] Dependent insights flagged "Needs Review"
- [ ] Notification of downstream impacts
- [ ] Optional regeneration with corrected data
- [ ] Knowledge graph relationships updated
- [ ] Impact summary displayed to analyst
- [ ] Regeneration option in UI

---

## Epic 8: Q&A Co-Creation Workflow

**User Value:** Users can collaboratively build comprehensive Q&A lists with AI assistance

**Description:** Enables analysts to create, organize, and collaboratively answer questions with AI assistance. The system suggests questions (max 10 at a time) based on knowledge base analysis, generates draft answers with sources, and supports iterative refinement through conversational interface.

**Q&A Format:** Excel spreadsheet with columns: Question | Priority | Answer | Date Answered. User can modify format or request agent to create alternative formats (Word, PDF).

**Workflow Simplification:** Streamlined to 2-3 phases - user requests suggestions (max 10), agent drafts answers, user edits and exports. No complex multi-phase orchestration needed.

**Functional Requirements Covered:**
- FR-QA-001: Question List Management
- FR-QA-002: AI-Suggested Questions
- FR-QA-003: Collaborative Answering
- FR-QA-004: Answer Quality
- FR-COLLAB-003: Q&A Integration

**Technical Foundation:**
- Q&A data model (questions, answers, categories, status)
- Agent tool: `suggest_questions(topic)`
- Agent tool: `add_to_qa(question, answer, sources)`
- Knowledge base integration for answer generation
- Source attribution and confidence scoring

**Acceptance Criteria (Epic Level):**
- ✅ User can create and organize Q&A lists by topic
- ✅ AI suggests relevant questions based on KB analysis
- ✅ AI generates draft answers with source attribution
- ✅ User can edit and refine answers conversationally
- ✅ All answers track provenance (AI draft, user edit, final)
- ✅ Q&A items link to source findings and documents

### Stories

#### Story E8.1: Q&A Data Model and Basic CRUD

**As a** developer
**I want** a Q&A data model with CRUD operations
**So that** the system can store and manage Q&A lists

**Technical Details:**
- Tables: `qa_lists`, `qa_items` (question + answer), `qa_categories`
- Fields: question, answer, category, priority, status, sources, confidence, provenance
- Status enum: draft, answered, reviewed, approved
- RLS policies for project isolation

**Acceptance Criteria:**

```gherkin
Given I am authenticated
When I create a Q&A list with name and deal_id
Then the list is saved and I can retrieve it by deal_id

Given a Q&A list exists
When I add a question with category and priority
Then the question is saved with status "draft"

Given I have multiple Q&A items
When I query by category or status
Then I get filtered results sorted by priority
```

**Related FR:** FR-QA-001

**Definition of Done:**
- [ ] Database schema created and migrated
- [ ] CRUD API endpoints implemented
- [ ] RLS policies enforced
- [ ] Filtering and sorting works

---

#### Story E8.2: Q&A Management UI

**As an** analyst
**I want** to view and manage my Q&A lists
**So that** I can organize questions by topic and track their status

**Technical Details:**
- New route: `/projects/[id]/qa`
- List view with expandable categories
- Status badges and priority indicators
- Filter controls

**Acceptance Criteria:**

```gherkin
Given I navigate to Q&A section
When the page loads
Then I see all Q&A lists grouped by category
And each question shows status and priority

Given I filter by status "answered"
Then I see only answered questions
```

**Related FR:** FR-QA-001

**Definition of Done:**
- [ ] Q&A list view renders
- [ ] Category grouping works
- [ ] Filtering works

---

#### Story E8.3: Agent Tool - suggest_questions()

**As an** analyst
**I want** the AI to suggest relevant questions
**So that** I don't miss important areas of inquiry

**Technical Details:**
- New agent tool: `suggest_questions(topic: string, max_count: int = 10)`
- Queries Neo4j knowledge graph for findings
- Identifies information gaps
- Returns structured array with rationale
- **Hard cap at 10 suggestions** to prevent overwhelming user

**Acceptance Criteria:**

```gherkin
Given the knowledge base has findings about "Revenue Model"
When I ask "Suggest questions about revenue"
Then the agent returns up to 10 relevant questions with rationale
And questions target information gaps in the KB
And suggestions are prioritized by importance

Given I request more than 10 suggestions
When the agent processes my request
Then exactly 10 questions are returned (capped)
And agent explains "showing top 10 most critical questions"
```

**Related FR:** FR-QA-002

**Definition of Done:**
- [ ] suggest_questions() tool implemented
- [ ] Gap analysis logic works
- [ ] Agent can call tool in conversation

---

#### Story E8.4: Conversational Q&A Suggestion Flow

**As an** analyst
**I want** to ask the AI for question suggestions
**So that** I can quickly build comprehensive Q&A lists

**Acceptance Criteria:**

```gherkin
Given I say "Suggest questions about market size"
Then the agent suggests 5 questions with rationale
And I see options to accept/reject/modify

Given I say "Accept question 1 and 3"
Then Q&A items are created with status "draft"
```

**Related FR:** FR-QA-002

**Definition of Done:**
- [ ] Conversational flow works
- [ ] Accept/reject/modify flows implemented
- [ ] Draft Q&A items created

---

#### Story E8.5: Agent Tool - generate_answer()

**As an** analyst
**I want** the AI to draft answers with sources
**So that** I can quickly build comprehensive answers

**Technical Details:**
- New agent tool: `generate_answer(question: string)`
- Queries KB using vector similarity
- Synthesizes answer with source attribution
- Returns confidence score

**Acceptance Criteria:**

```gherkin
Given a question "What is the company's revenue model?"
When generate_answer() executes
Then it generates a comprehensive answer
And includes source citations with confidence score
```

**Related FR:** FR-QA-003, FR-QA-004

**Definition of Done:**
- [ ] generate_answer() tool implemented
- [ ] Source attribution works
- [ ] Confidence scoring implemented

---

#### Story E8.6: Conversational Answer Generation Flow

**As an** analyst
**I want** to ask the AI to draft answers
**So that** I can quickly build Q&A responses grounded in my knowledge base

**Acceptance Criteria:**

```gherkin
Given I say "Draft an answer for question #42"
Then the agent generates an answer with source citations

Given I say "Make it more concise"
Then the agent shortens the answer maintaining sources

Given I say "Approve this answer"
Then the answer is saved with provenance tracking
```

**Related FR:** FR-QA-003, FR-QA-004

**Definition of Done:**
- [ ] Conversational flow works
- [ ] Refinement requests work
- [ ] Approval saves with provenance

---

#### Story E8.7: Q&A Answer Editor UI

**As an** analyst
**I want** to manually edit Q&A answers
**So that** I can refine AI drafts or write my own answers

**Technical Details:**
- Rich text editor (Tiptap)
- Source picker
- Provenance display

**Acceptance Criteria:**

```gherkin
Given I click "Edit" on a Q&A item
Then I see rich text editing controls
And I see attached sources

Given I click "Finalize"
Then status changes to "answered"
And provenance shows edit history
```

**Related FR:** FR-QA-003, FR-QA-004

**Definition of Done:**
- [ ] Rich text editor works
- [ ] Source picker works
- [ ] Provenance tracking works

---

#### Story E8.8: Q&A Export

**As an** analyst
**I want** to export Q&A lists
**So that** I can share them with stakeholders

**Technical Details:**
- Export formats: Word (.docx), PDF, JSON, CSV
- Filter before export
- Word template with source footnotes

**Acceptance Criteria:**

```gherkin
Given I have 50 Q&A items
When I click "Export to Word"
Then a formatted .docx file is generated
And questions have source footnotes
```

**Related FR:** FR-QA-001

**Definition of Done:**
- [ ] Export to Word works
- [ ] Filtering before export works
- [ ] Formatting templates applied

---

## Epic 9: CIM Company Overview Creation (CIM v3 Workflow)

**User Value:** Users can create professional-grade Company Overview chapters through structured interactive workflow with comprehensive AI guidance and live preview

**Description:** Implements the proven CIM v3 workflow from POC into the full platform. Enables analysts to create Company Overview chapters through a deeply conversational, iterative process (typically ~14 phases, adaptable based on complexity) in a dedicated CIM Builder UI at `/projects/[id]/cim-builder` with **live preview capability** for visual concepts. The workflow:
1. Discovers buyer context and narrative approach organically (not template-driven)
2. Builds investment thesis collaboratively (3-part: Asset, Timing, Opportunity)
3. Creates narrative outline with logical flow reasoning
4. Builds slides one at a time (content-first, then visual concepts with **live preview**)
5. Validates narrative coherence continuously with balance checks after each section
6. Provides extreme visual precision (position, format, styling for EVERY element)
7. Supports non-linear workflow (jump between sections, go back, reorder)
8. Exports comprehensive outputs (content markdown, slide blueprints, guide, LLM prompt template)

**Note on Phase Structure:** The workflow is designed with ~14 phases as the established structure, but can adapt based on complexity and user needs. The critical aspect is **comprehensive guidance** through buyer persona discovery, narrative development, content creation, and visual design—not a fixed phase count.

**Scope:** Company Overview chapter ONLY (other CIM chapters in Phase 2/E13)

**Functional Requirements Covered:**
- FR-CIM-001: CIM Builder UI and Workflow Interface (with live preview)
- FR-CIM-002: Structured Interactive Workflow (adaptive phase count)
- FR-CIM-003: Agent Intelligence and Tools
- FR-CIM-004: Workflow State Management
- FR-CIM-005: Special Commands
- FR-CIM-006: Version Control and Iteration

**Technical Foundation:**
- **Frontend:** Dedicated CIM Builder UI with:
  - Left Sidebar: Visual workflow progress (14 phases)
  - Main Area: Conversational interaction with AI
  - Right Panel: Context (buyer persona, thesis, section info)
- **Backend:** LangGraph workflow with 14 nodes and human-in-the-loop interrupts at each phase
- **State Management:** `cim_workflow_states` and `cim_slides` tables for persistence and resume capability
- **RAG Integration:** `query_knowledge_base()` for semantic search (pgvector) throughout workflow
- **Agent Tools:** 3 CIM-specific tools:
  - `suggest_narrative_outline(buyer_persona, context)`
  - `validate_idea_coherence(narrative, proposed_idea)`
  - `generate_slide_blueprint(slide_topic, narrative_context, content_elements)`
- **Buyer Persona System:** Strategic Buyer, Financial Buyer, Custom
- **Multi-Format Export:** Content markdown, slide blueprints markdown, guide, LLM prompt template

**Acceptance Criteria (Epic Level):**
- ✅ User completes 14-phase workflow for Company Overview chapter
- ✅ Buyer persona drives narrative tailoring through conversational discovery
- ✅ Investment thesis (3-part) established before content creation
- ✅ Narrative outline built collaboratively with flow reasoning
- ✅ Slides built one-at-a-time with two-step process (content approval → visual approval)
- ✅ Visual concepts include extreme precision (positioning, styling, icons for ALL elements)
- ✅ Continuous balance checks after each section completion
- ✅ Non-linear workflow (can jump between sections, go back, reorder)
- ✅ Phase 12 coherence validation from buyer's perspective
- ✅ Phase 13 deck optimization with improvement suggestions
- ✅ Multi-format export (content, slides, guide, LLM prompt) with RAG source citations
- ✅ Resume capability from any checkpoint
- ✅ Version control tracks iterations
- ✅ Special commands work throughout (undo, history, explain, balance check, etc.)

### Stories

#### Story E9.1: CIM Workflow Database Schema and State Management

**As a** developer
**I want** a CIM workflow state database schema
**So that** the system can persist workflow progress and support resume capability

**Technical Details:**
- Tables: `cim_workflow_states`, `cim_slides`
- `cim_workflow_states`: Stores current phase, completed phases, buyer persona (JSONB), investment thesis (JSONB), sections (JSONB[]), conversation history
- `cim_slides`: Stores slide content_elements (JSONB[]) with source citations, visual_concept (JSONB) with extreme precision specs, approval flags
- Buyer persona templates: Strategic Buyer (growth focus), Financial Buyer (returns focus), Custom
- Version control: Full workflow state snapshots with timestamps
- Resume capability: Load workflow state by deal_id + user_id

**Acceptance Criteria:**

```gherkin
Given I start a CIM workflow
Then a cim_workflow_states record is created
And current_phase is set to 1
And workflow state is persisted continuously

Given I select "Strategic Buyer" persona
Then buyer_persona JSON is stored with {type, motivations, concerns, story_hero}
And persona drives narrative tailoring throughout workflow

Given I create 3 slides in "Company History" section
Then 3 cim_slides records are created
And each has content_elements[] with source_finding_id references
And each has visual_concept{} with positioned_elements[] specs

Given I close browser mid-workflow
When I return and resume
Then workflow loads from saved state
And I continue from exact checkpoint
```

**Related FR:** FR-CIM-001, FR-CIM-004, FR-CIM-006

**Definition of Done:**
- [ ] `cim_workflow_states` table created with JSONB columns
- [ ] `cim_slides` table created with approval flags
- [ ] Buyer persona templates seeded (Strategic, Financial, Custom)
- [ ] Version control implemented (snapshot on save)
- [ ] Resume capability tested

---

#### Story E9.2: CIM Builder UI with Workflow Progress Visualization

**As an** analyst
**I want** a dedicated CIM Builder interface with visual workflow progress
**So that** I can clearly see my progress through the 14 phases

**Technical Details:**
- New route: `/projects/[id]/cim-builder`
- **Layout Structure:**
  - Left Sidebar (25%): Workflow progress with 14 phase indicators
    - Current phase highlighted
    - Completed phases marked with checkmarks
    - Pending phases greyed out
    - Narrative structure tree view (sections + slides)
    - Navigation controls
  - Main Content Area (50%): Conversational interaction
    - AI messages with options/suggestions
    - User input field
    - Content previews
    - Visual concept previews
  - Right Panel (25%): Context
    - Buyer persona summary
    - Investment thesis display
    - Current section info
    - Quick action buttons (undo, history, explain, balance check)
- Auto-save workflow state continuously
- WebSocket connection for real-time AI responses

**Acceptance Criteria:**

```gherkin
Given I navigate to /projects/[deal_id]/cim-builder
Then I see the CIM Builder interface with 3-panel layout
And left sidebar shows "Phase 1/14: Understand Buyer Context" as current
And all 14 phases are listed
And main area shows welcome message from AI

Given I'm on Phase 5 (building slides)
Then left sidebar shows Phases 1-4 with checkmarks
And Phase 5 is highlighted as current
And Phases 6-14 are greyed out
And narrative structure tree shows sections I've created

Given I complete a slide
Then the narrative tree updates in real-time
And I see the slide under its section
And workflow state auto-saves

Given AI is generating a response
Then I see streaming text in main content area
And responses appear token-by-token
```

**Related FR:** FR-CIM-001

**Definition of Done:**
- [ ] `/projects/[id]/cim-builder` route implemented
- [ ] 3-panel layout responsive and functional
- [ ] Workflow progress indicator shows all 14 phases
- [ ] Narrative structure tree view works
- [ ] Main content area handles conversational interaction
- [ ] Right panel shows context dynamically
- [ ] Auto-save implemented
- [ ] WebSocket streaming responses work

---

#### Story E9.3: Agent Tool - suggest_narrative_outline()

**As an** analyst
**I want** the AI to suggest a narrative outline for my CIM
**So that** I can establish a coherent story arc before defining slides

**Technical Details:**
- New agent tool: `suggest_narrative_outline(buyer_persona, company_context, key_findings)`
- Queries Neo4j for key findings from knowledge base
- Suggests story arc: Hook → Context → Value → Proof → Vision → Call to Action
- Tailors messaging to buyer persona (strategic vs financial priorities)
- Returns outline with recommended narrative flow

**Acceptance Criteria:**

```gherkin
Given I request narrative outline for "Strategic Buyer"
When suggest_narrative_outline() executes with knowledge base context
Then it returns story arc emphasizing growth potential, synergies, market position
And each arc section has clear narrative purpose

Given I request narrative outline for "Financial Buyer"
When suggest_narrative_outline() executes with knowledge base context
Then it returns story arc emphasizing ROI, cash flow, exit multiples
And each arc section has clear financial value proposition
```

**Related FR:** FR-CIM-002

**Definition of Done:**
- [ ] suggest_narrative_outline() tool implemented
- [ ] Queries knowledge base for grounding
- [ ] Strategic buyer narrative logic works
- [ ] Financial buyer narrative logic works
- [ ] Story arc structure returned

---

#### Story E9.4: LangGraph CIM v3 Workflow Implementation (14 Phases)

**As a** developer
**I want** the 14-phase CIM v3 workflow implemented in LangGraph
**So that** analysts can create Company Overview chapters through the proven interactive process

**Description:**
Implement the complete 14-phase workflow from CIM v3 POC as a LangGraph workflow with human-in-the-loop interrupts at each major decision point.

**Technical Details:**
- LangGraph workflow definition with 14 nodes (one per phase)
- Human checkpoints:
  - Phase 1: Buyer persona confirmation
  - Phase 2: Investment thesis approval
  - Phase 3: Narrative outline confirmation
  - Phases 4-11: Content approval → Visual approval (per slide)
  - Phase 12: Coherence improvements acceptance
  - Phase 13: Optimization approval
  - Phase 14: Export format selection
- Workflow state stored in `cim_workflow_states` table
- Resume capability from any checkpoint
- Conditional routing (user can go back, skip, reorder sections)
- Non-linear section building (user chooses which section to build next)

**Acceptance Criteria:**

```gherkin
Given I start the CIM workflow
When I progress through Phase 1 (Buyer Context)
Then the system pauses for my persona confirmation
And I can describe buyer type conversationally

Given I confirm buyer persona
When Phase 2 begins
Then the system proposes 3 investment thesis options based on RAG queries
And pauses for my approval or modifications

Given I approve investment thesis
When Phase 3 begins
Then the system suggests narrative outline with flow reasoning
And I can reorder, add, or remove sections
And I confirm when ready to proceed

Given I'm in Phase 5 (Building Company History section)
When I approve slide content
Then the system generates visual concept
And pauses for my visual approval
And I can request modifications

Given I interrupt the workflow
When I return later
Then I can resume from the exact checkpoint
And all my previous decisions are preserved
```

**Related FR:** FR-CIM-002, FR-CIM-004, FR-CIM-005

**Definition of Done:**
- [ ] LangGraph workflow with 14 nodes implemented
- [ ] All human checkpoints functional
- [ ] State persistence working
- [ ] Resume capability tested
- [ ] Conditional routing (back/skip/reorder) works
- [ ] Integration with RAG knowledge queries
- [ ] Non-linear section selection works
- [ ] Error handling and validation

---

#### Story E9.5: Content-First, Then Visual Workflow

**As an** analyst
**I want** to approve slide content before visual design
**So that** I can focus on message first, then presentation

**Description:**
Implement the two-step slide creation process within Phases 4-11: (1) content elements with sources from RAG, (2) visual concept design with extreme precision. Each step requires separate approval.

**Technical Details:**
- **Content Phase** (for each slide):
  - Query knowledge base via `query_knowledge_base(slide_topic, filters)`
  - Present 3 content options with specific data points and sources
  - User selects, modifies, or suggests alternative
  - Content locked after approval
- **Visual Phase** (only after content approved):
  - Call `generate_slide_blueprint(slide_topic, narrative_context, content_elements)`
  - Generate visual concept with extreme precision:
    - Type, layout description, main visual element
    - ALL content elements positioned (position, format, styling, icon)
    - Data viz details, color scheme, visual hierarchy
    - Graphics/icons specs, designer guidance
  - User approves or requests modifications
  - Visual concept regenerated if modifications requested
  - Slide locked after both approvals
- Validation: Check ALL content elements have positioning specs

**Acceptance Criteria:**

```gherkin
Given I'm building a slide about "Founding Story"
When the content phase begins
Then the system queries RAG for relevant findings
And presents 3 content options:
  - Option A: Chronological narrative (founders, date, pivots)
  - Option B: Problem-solution framing
  - Option C: Credibility-first approach
And each option has 3-5 specific data points with sources

Given I select Option A and approve content
When the visual phase begins
Then the system generates visual concept:
  - Type: Timeline infographic
  - Layout: Horizontal timeline with milestone markers
  - ALL 5 content elements positioned precisely
  - Color scheme: Brand colors specified
  - Visual hierarchy: What viewer sees 1st, 2nd, 3rd
And I can approve or request changes

Given I request "add a rocket graphic to show momentum"
When I submit the modification
Then the system regenerates visual concept
And incorporates rocket with specs (size, position, style, purpose)
And I see updated visual concept for approval

Given visual concept is missing positioning for 1 content element
When validation runs
Then an error is raised
And I'm told which element is missing specs
```

**Related FR:** FR-CIM-002, FR-CIM-003

**Definition of Done:**
- [ ] Two-step approval workflow per slide
- [ ] Content phase queries RAG knowledge base
- [ ] 3 content options presented with sources
- [ ] Visual phase generates extreme precision specs
- [ ] ALL content elements positioning validated
- [ ] User modifications incorporated immediately
- [ ] Both approvals required before locking slide

---

#### Story E9.6: Extreme Visual Precision Generation and Validation

**As an** analyst
**I want** visual concepts with extreme precision
**So that** designers have complete specifications without ambiguity

**Description:**
Implement visual concept generation that specifies position, format, styling, and icons for EVERY content element on each slide with validation to ensure nothing is missed.

**Technical Details:**
- LLM prompt engineering for extreme visual precision
- Required specifications for each slide visual concept:
  - **Type**: Chart/infographic/timeline/diagram
  - **Layout Description**: What goes where on slide
  - **Main Visual Element**: Chart description, dimensions, dominance
  - **ALL Content Elements Positioned**: For EVERY data point:
    - Position (top left, center, bottom right, etc.)
    - Format (callout box, text annotation, chart label)
    - Styling (font size, color, background)
    - Icon/graphic (if applicable with specs)
  - **Data Visualization Details** (if chart): Type, axes, data points, scale, comparisons
  - **Color Scheme**: Primary, secondary, accent, text colors with usage
  - **Visual Hierarchy**: 1st, 2nd, 3rd what viewer sees
  - **Graphics/Icons/Images**: Each with placement, size, style, purpose
  - **Designer Guidance**: Spacing, alignment, emphasis notes
- Examples embedded in prompt (good vs bad visual concepts)
- Validation: Count content elements vs positioned elements (must match)

**Acceptance Criteria:**

```gherkin
Given a slide has 5 content elements
When the visual concept is generated
Then ALL 5 elements have positioning specified
And NONE are missing from visual concept

Given content includes "LTV $1.3M" and "CAC $80K"
When visual concept is bar chart
Then the specification includes:
  - Chart type: Vertical bar chart
  - Y-axis: Dollar values (scale 0-$1.5M)
  - Bars: Left bar (CAC, gray, 1 unit), Right bar (LTV, green gradient, 16 units)
  - Labels: "$80K CAC" above left bar, "$1.3M LTV" above right bar
  - Position: Each label center-aligned above respective bar
  - Format: Bold, medium size
  - Color: Dark gray for CAC, dark green for LTV

Given user requests "add a rocket graphic"
When visual concept regenerates
Then rocket specifications include:
  - Position: Top of LTV bar, angled 45° upward-right
  - Size: ~20% of slide height
  - Style: Flat design, brand colors, with motion trail
  - Purpose: Symbolizes fast growth trajectory
And ALL other elements remain positioned

Given visual concept generator misses 1 element
When validation runs
Then error raised: "Missing positioning for element 'growth_rate'"
And generation retries automatically
```

**Related FR:** FR-CIM-002, FR-CIM-003

**Definition of Done:**
- [ ] Visual concept prompt generates extreme precision
- [ ] All content elements positioned (validation check)
- [ ] Chart specifications complete (type, axes, scale, data)
- [ ] Color scheme specified
- [ ] Visual hierarchy defined
- [ ] Graphics/icons specified with full details
- [ ] Designer guidance included
- [ ] Validation prevents incomplete visual concepts
- [ ] Examples in prompt prevent vague outputs

---

#### Story E9.7: Continuous Balance Checks and Coherence Validation

**As an** analyst
**I want** continuous narrative balance checks
**So that** I can ensure the story remains coherent and well-proportioned

**Description:**
Implement balance checks after each section completion (Phases 4-11) and comprehensive coherence validation from buyer's perspective in Phase 12.

**Technical Details:**
- **After each section (Phases 4-11):**
  - Calculate section size (number of slides)
  - Compare emphasis across completed sections
  - Evaluate against buyer persona priorities
  - Present balance assessment to user
  - Allow retroactive adjustments
- **Phase 12 (Coherence & Risk Assessment):**
  - Agent adopts buyer POV
  - Reviews investment thesis delivery
  - Checks storytelling arc (setup → climax → resolution)
  - Assesses risk transparency
  - Validates growth driver clarity
  - Provides honest assessment + suggestions
  - User can accept or address issues

**Acceptance Criteria:**

```gherkin
Given I complete "Company History" section (3 slides)
When the balance check runs
Then the system shows:
  - ✅ Company History: 3 slides
  - ⏳ Corporate Structure: pending
And asks: "We've emphasized [founding story] heavily - does that feel right for your [Strategic] buyer?"

Given all sections completed
When Phase 12 coherence review begins
Then the agent reviews from buyer's perspective:
  - Investment thesis validation
  - Storytelling arc assessment
  - Risk transparency check
  - Growth driver clarity
  - Overall impression
And provides specific suggestions for improvement
And I can choose to address or proceed

Given the agent flags "Missing: employee retention story"
When I accept the suggestion
Then the system offers to add a slide
And I can build it or decline

Given emphasis is heavily on history (40% of slides)
When balance check runs
Then system asks: "History is 40% of deck - rebalance toward [business model] for strategic buyer?"
```

**Related FR:** FR-CIM-002, FR-CIM-005

**Definition of Done:**
- [ ] Balance checks after each section
- [ ] Emphasis comparison across sections
- [ ] Buyer persona alignment validation
- [ ] Phase 12 buyer POV review implemented
- [ ] Investment thesis delivery check
- [ ] Storytelling arc assessment
- [ ] Risk transparency validation
- [ ] Retroactive adjustment capability

---

#### Story E9.8: Non-Linear Workflow and Special Commands

**As an** analyst
**I want** to navigate the workflow non-linearly and use special commands
**So that** I have flexibility to build the CIM my way

**Description:**
Implement non-linear workflow navigation (jump between sections, go back, reorder) and special commands (undo, history, save version, explain, etc.) available throughout the workflow.

**Technical Details:**
- **Non-Linear Navigation:**
  - Section selection menu (user chooses which section to build next)
  - Go back capability (return to previous phase)
  - Reorder slides within sections (drag-and-drop or command)
- **Special Commands** (available anytime during workflow):
  - **Navigation**: `undo`, `restart [step/section]`, `history`, `save version [name]`, `show structure`
  - **Analysis**: `explain [topic]`, `why [decision]`, `alternatives`, `data score`, `balance check`
  - **Content**: `add finding`, `correct [detail]`, `questions for seller`, `strengthen [section]`
- Workflow state tracks: current phase, completed phases, pending sections, user decisions
- Command parser in chat interface (frontend + backend)

**Acceptance Criteria:**

```gherkin
Given I've completed "Company History" section
When I'm asked "Which section should we tackle next?"
Then I see a list of pending sections:
  - Corporate Structure
  - Management Team
  - Geographic Footprint
  - Business Model
And I can choose any section (non-sequential)

Given I'm in "Management Team" section
When I type "/go back to Company History"
Then the workflow navigates back
And I can edit previous slides

Given I type "/show structure"
When the command executes
Then I see the current organization:
  - ✅ Company History (3 slides)
  - 🔄 Management Team (in progress, 1 slide)
  - ⏳ Corporate Structure (pending)
  - ⏳ Geographic Footprint (pending)
  - ⏳ Business Model (pending)

Given I type "/explain LTV"
When the educational moment triggers
Then the system explains:
  - Definition: Lifetime Value
  - Formula: Average revenue per customer × customer lifetime
  - Benchmarks: SaaS typically 3-5x CAC
  - Context: Why it matters for this buyer type

Given I'm satisfied with current state
When I type "/save version Pitch to Acme Ventures"
Then the workflow state is saved with that name
And I can restore it later
```

**Related FR:** FR-CIM-005

**Definition of Done:**
- [ ] Non-linear section selection works
- [ ] Go back navigation works
- [ ] Slide reordering works
- [ ] All special navigation commands implemented
- [ ] All analysis commands implemented
- [ ] All content commands implemented
- [ ] Command parser functional (frontend + backend)
- [ ] Workflow state tracks all context

---

#### Story E9.9: Multi-Format Export with RAG Source Citations

**As an** analyst
**I want** to export the CIM in multiple formats with RAG-sourced citations
**So that** I can use it as a guide, LLM prompt, or presentation base

**Description:**
Implement Phase 14 export functionality for 4 formats: (1) Content Markdown, (2) Slide Blueprints Markdown, (3) Guide Markdown, (4) LLM Prompt Template. All exports include source citations from RAG knowledge base.

**Technical Details:**
- **Export formats:**
  1. **company-overview-content.md**: Full narrative text for all sections with source citations throughout
  2. **company-overview-slides.md**: Slide blueprints (title, purpose, content elements, visual concepts, designer guidance)
  3. **company-overview-guide.md**: How to use blueprints, design tips, implementation workflow
  4. **company-overview-prompt.txt**: LLM prompt template (includes buyer persona, narrative arc, slide specs, knowledge base context)
- Source citations link to PostgreSQL findings (via RAG queries during workflow)
- Save to project's CIM output folder: `/projects/[id]/cim-outputs/`
- Version control: Track iterations with timestamps

**Acceptance Criteria:**

```gherkin
Given I complete the workflow
When I reach Phase 14 (Export)
Then I see export format options:
  - Content Markdown
  - Slide Blueprints Markdown
  - Guide Markdown
  - LLM Prompt Template
  - All formats (recommended)

Given I select "All formats"
When export completes
Then 4 files are created in `/projects/[deal_id]/cim-outputs/`:
  - company-overview-content.md
  - company-overview-slides.md
  - company-overview-guide.md
  - company-overview-prompt.txt
And each file includes source citations from knowledge base

Given I open company-overview-slides.md
Then I see for each slide:
  - **Slide N: [Action Title]**
  - Purpose: [What this slide accomplishes]
  - Content Elements: [Specific data points with sources]
  - Visual Concept: [Extreme precision specifications]
  - Source: [PostgreSQL findings with IDs and citations]

Given I open company-overview-prompt.txt
Then I see a comprehensive prompt that includes:
  - Buyer persona and priorities
  - Investment thesis (Asset, Timing, Opportunity)
  - Narrative arc
  - Each slide's purpose and requirements
  - Knowledge base context (relevant findings)
  - Formatting and tone expectations
And I can paste this into Claude/GPT to generate actual CIM content
```

**Related FR:** FR-CIM-003, FR-CIM-006

**Definition of Done:**
- [ ] Content markdown export works
- [ ] Slide blueprints markdown export works
- [ ] Guide markdown export works
- [ ] LLM prompt template export works
- [ ] All exports include RAG source citations
- [ ] Files saved to project output folder
- [ ] Version control implemented (timestamp + version name)
- [ ] Export summary shown to user

---

## Functional Requirements Coverage Matrix

| Functional Requirement | Epic(s) | Story/Stories | Status |
|------------------------|---------|---------------|--------|
| FR-ARCH-001: Platform-Agent Separation | E1, E3, E5 | E1.1, E1.6, E3.1, E5.1 | Covered |
| FR-ARCH-002: Tool-Based Agent Integration | E1, E5 | E1.2, E5.2, E5.3 | Covered |
| FR-ARCH-003: Scalable Service Architecture | E1, E3 | E1.3, E3.1 | Covered |
| FR-DOC-001: Document Upload | E2 | E2.1, E2.2 | Covered |
| FR-DOC-002: Document Organization | E2 | E2.3, E2.4, E2.6, E2.7 | Covered |
| FR-DOC-003: Document Versioning | E2 | E2.8 | Covered |
| FR-DOC-004: Document Processing | E3 | E3.2, E3.3, E3.6, E3.8 | Covered |
| FR-KB-001: Structured Knowledge Storage | E3, E4 | E3.5, E4.3, E4.9 | Covered |
| FR-KB-002: Source Attribution | E3, E4, E5 | E3.5, E3.9, E4.5, E4.9, E5.4 | Covered |
| FR-KB-003: Knowledge Retrieval | E4, E5 | E4.1, E4.2, E4.4, E5.2 | Covered |
| FR-KB-004: Cross-Document Analysis | E4 | E4.6, E4.7, E4.8 | Covered |
| FR-BG-001: Event-Driven Architecture | E3 | E3.1 | Covered |
| FR-BG-002: Processing Pipeline | E3 | E3.3, E3.4, E3.5 | Covered |
| FR-BG-003: Autonomous Intelligence | E3 | E3.5 | Covered |
| FR-BG-004: Processing Transparency | E3 | E3.6, E3.7, E3.8 | Covered |
| FR-CONV-001: Chat Interface | E5 | E5.3, E5.6 | Covered |
| FR-CONV-002: Query Capabilities | E5 | E5.2, E5.3, E5.5 | Covered |
| FR-CONV-004: Response Quality | E5 | E5.1, E5.4, E5.7 | Covered |
| FR-IRL-001: IRL Creation | E6 | E6.1, E6.2, E6.3 | Covered |
| FR-IRL-002: IRL Tracking | E6 | E6.4 | Covered |
| FR-IRL-003: IRL-Document Linking | E6 | E6.5 | Covered |
| FR-IRL-004: Template Library | E6 | E6.1, E6.2 | Covered |

*(Epics E7-E14 will be detailed next)*

---

## Story Sizing Guidelines

**Small (1-2 days):**
- UI component implementation
- Single API endpoint
- Basic CRUD operations
- Simple integrations

**Medium (2-3 days):**
- Complex UI with state management
- Multiple related API endpoints
- LLM integration with prompt engineering
- Database schema changes

**Large (4-5 days - should be split):**
- Full workflow implementation
- Complex multi-step processes
- Major architectural changes

**Epic sizing:** Each epic should deliver user value within 2-3 weeks (8-15 stories).

---

## Next Steps

1. **Review and Approve:** Product owner reviews epic breakdown
2. **Prioritize:** Confirm P0 epics for MVP
3. **Detailed E5-E14:** Complete story breakdown for remaining epics
4. **Sprint Planning:** Create sprint plan starting with E1-E2
5. **Story Refinement:** Add technical specs and dependencies

---

_This document will be progressively updated as stories are refined and implementation progresses._

**Status:** In Progress - First 4 epics detailed (E1-E4), remaining epics (E5-E14) to be detailed next.
