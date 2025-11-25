# Epic Technical Specification: Project Foundation

Date: 2025-11-24
Author: Max
Epic ID: 1
Status: Draft

---

## Overview

Epic 1: Project Foundation establishes the core infrastructure for the Manda M&A Intelligence Platform. This epic implements the foundational technical stack including Next.js 15 frontend with React 19.2, Supabase authentication and database (PostgreSQL 18 with pgvector), Neo4j graph database for knowledge relationships, and pg-boss background job queue. The work enables project creation, user authentication, data isolation via Row-Level Security (RLS), and prepares the platform for document processing and intelligence features in subsequent epics.

## Objectives and Scope

**In Scope:**
- Next.js 15 project setup with App Router, Tailwind CSS 4, and shadcn/ui component library
- Supabase Auth configuration (email/password, magic links, OAuth)
- PostgreSQL 18 schema with RLS policies for multi-tenant data isolation
- Projects Overview UI (card and table views) with project creation wizard
- Project Workspace shell with navigation (Dashboard, Data Room, Knowledge Explorer, Chat, Deliverables)
- Neo4j 2025.01 graph database setup for knowledge graph relationships
- pg-boss job queue configuration for background processing
- Docker Compose development environment orchestration

**Out of Scope:**
- Document processing pipeline (Epic 3)
- Conversational AI agent (Epic 5)
- Actual data room functionality (Epic 2)
- Any LLM integrations or intelligence features
- Production deployment configuration (covered in separate deployment epic)

## System Architecture Alignment

This epic aligns with the Platform-Agent architectural pattern by implementing the **Platform Layer** foundation. Key components from the architecture include:

- **Frontend**: Next.js 15 (App Router) + React 19.2 + Tailwind CSS 4 + shadcn/ui (Decision: Architecture Section - Technology Stack)
- **Authentication**: Supabase Auth with RLS enforcement (Decision: NFR-SEC-002)
- **Primary Database**: PostgreSQL 18 with pgvector 0.8+ extension (Decision: Data Architecture)
- **Graph Database**: Neo4j 2025.01 for knowledge relationships (Decision: Data Architecture)
- **Job Queue**: pg-boss (Postgres-based) for MVP simplicity (Decision: Background Processing)
- **Development Environment**: Docker Compose for local Supabase + Neo4j + Next.js orchestration (Decision: Docker Architecture)

The implementation follows the monorepo structure defined in the Project Structure section with `apps/web/` for Next.js frontend and prepares database schemas for subsequent epic implementations.

## Detailed Design

### Services and Modules

| Module/Service | Responsibility | Inputs | Outputs | Owner |
|----------------|----------------|--------|---------|-------|
| **apps/web** | Next.js 15 frontend application | User interactions, API responses | Rendered UI, API requests | Frontend Team |
| **Supabase Auth** | User authentication & session management | Email/password, OAuth tokens | JWT tokens, user sessions | Supabase (managed) |
| **PostgreSQL (Supabase)** | Primary data store with RLS | Deal CRUD operations | Isolated deal data per user | Backend Team |
| **Neo4j Community** | Knowledge graph relationships | Finding/document relationships | Graph queries for source attribution | Backend Team |
| **pg-boss** | Background job queue (Postgres-based) | Job submissions (document processing) | Job status, worker execution | Backend Team |
| **Docker Compose** | Local development orchestration | Service definitions | Running services (Supabase, Neo4j, Next.js) | DevOps |

### Data Models and Contracts

**Deals Table (PostgreSQL):**
```sql
CREATE TABLE deals (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) NOT NULL,
    name text NOT NULL,
    company_name text,
    industry text,
    deal_type text, -- 'Tech M&A', 'Industrial', 'Pharma', 'Custom'
    status text DEFAULT 'active', -- 'active', 'on-hold', 'archived'
    irl_template text, -- Selected IRL template
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_deals_user_id ON deals(user_id);

-- RLS Policy: Users can only see their own deals
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY deals_isolation_policy ON deals
    FOR ALL
    USING (auth.uid() = user_id);
```

**Users (Supabase Auth):**
- Managed by Supabase Auth
- Schema: `auth.users` table (built-in)
- Fields: id (uuid), email, encrypted_password, email_confirmed_at, etc.

**Neo4j Graph Schema (Initial):**
```cypher
// Node: Deal
(:Deal {
    id: UUID,
    name: String,
    user_id: UUID
})

// Relationships: None in Epic 1 (prepared for Epic 3+)
```

### APIs and Interfaces

**Frontend → Supabase API:**

```typescript
// Authentication
POST /auth/v1/signup
Request: { email: string, password: string }
Response: { user: User, session: Session }

POST /auth/v1/token?grant_type=magic_link
Request: { email: string }
Response: { /* magic link sent */ }

POST /auth/v1/token?grant_type=password
Request: { email: string, password: string }
Response: { access_token: string, refresh_token: string, user: User }

// Deals CRUD
GET /rest/v1/deals
Headers: { Authorization: Bearer <token> }
Response: Deal[]

POST /rest/v1/deals
Headers: { Authorization: Bearer <token> }
Request: { name: string, company_name: string, industry: string, deal_type: string }
Response: Deal

PATCH /rest/v1/deals?id=eq.<deal_id>
Headers: { Authorization: Bearer <token> }
Request: { status: string }
Response: Deal
```

**Error Codes:**
- 401 Unauthorized: Invalid/expired token
- 403 Forbidden: RLS policy violation
- 422 Unprocessable Entity: Validation errors
- 500 Internal Server Error: Database errors

### Workflows and Sequencing

**User Registration Flow:**
```
1. User enters email/password on signup page
2. Frontend calls POST /auth/v1/signup
3. Supabase creates user in auth.users
4. Supabase sends confirmation email
5. User clicks confirmation link
6. Email confirmed, user can sign in
```

**Project Creation Flow:**
```
1. User clicks "+ New Project"
2. Wizard opens (3 steps)
   Step 1: Enter project name, company, industry
   Step 2: Select project type (Tech M&A, Industrial, etc.)
   Step 3: IRL template auto-suggested based on type
3. User clicks "Create Project"
4. Frontend calls POST /rest/v1/deals
5. Supabase validates request, checks RLS
6. Deal record created in database
7. Frontend redirects to /projects/[id]/dashboard
8. User sees project workspace
```

**Authentication State Management:**
```
1. User signs in
2. Supabase returns JWT access token + refresh token
3. Frontend stores tokens in localStorage (Supabase client handles)
4. All API requests include Authorization header
5. Access token expires after 1 hour
6. Supabase client auto-refreshes using refresh token
7. If refresh fails, redirect to login
```

## Non-Functional Requirements

### Performance

**NFR-PERF-001: API Response Time**
- Next.js SSR pages render within 1-2 seconds (initial load)
- Client-side navigation (React Router) under 200ms
- Supabase REST API responses under 500ms for simple queries
- Deal list view loads within 1 second (typical: 10-50 deals per user)

**NFR-PERF-002: Authentication Performance**
- Login via email/password completes within 2 seconds
- Magic link generation within 1 second
- Session validation (JWT check) under 100ms
- OAuth redirect flow completes within 3-5 seconds (network dependent)

**NFR-PERF-003: Database Query Performance**
- Deal CRUD operations (single record) under 200ms
- RLS policy evaluation adds <50ms overhead per query
- Indexed queries (deals by user_id) under 100ms
- Support 100+ concurrent users without degradation (MVP target)

**NFR-PERF-004: Frontend Bundle Size**
- Initial bundle <300KB gzipped (Next.js 15 with tree-shaking)
- Route-level code splitting for lazy loading
- Tailwind CSS purged to production size <50KB
- shadcn/ui components load on-demand

### Security

**NFR-SEC-001: Authentication & Authorization**
- Supabase Auth JWT tokens expire after 1 hour
- Refresh tokens stored securely in httpOnly cookies
- MFA support available (optional for MVP)
- OAuth providers verified (Google, Microsoft)
- Password requirements: min 8 chars, complexity enforced

**NFR-SEC-002: Row-Level Security (RLS)**
- All tables enforce RLS policies (no exceptions)
- Users can ONLY access their own deals (enforced at database level)
- RLS policy: `auth.uid() = user_id` on all multi-tenant tables
- Database-level isolation prevents data leaks even if application code fails
- No admin bypass in MVP (all access goes through RLS)

**NFR-SEC-003: Data Encryption**
- All data encrypted at rest (Supabase managed encryption)
- TLS 1.3 for all communications (API, database, storage)
- Document storage uses signed URLs (expiring, scoped access) - Note: GCS selected for Epic 2
- Environment variables never committed to version control
- API keys rotated regularly (documented in deployment guide)

**NFR-SEC-004: Input Validation & XSS Prevention**
- All user inputs sanitized before database insertion
- React 19.2 auto-escapes JSX content (XSS protection)
- Supabase parameterized queries prevent SQL injection
- File upload validation: type, size, malware scanning (Phase 2)
- CORS configured to allow only frontend origin

### Reliability/Availability

**NFR-REL-001: Error Handling**
- All API endpoints return consistent error format (JSON with status code, message, error_code)
- Frontend gracefully handles API failures (retry logic with exponential backoff)
- Database connection failures trigger automatic reconnect (max 3 retries)
- User-friendly error messages (no stack traces exposed to frontend)
- Toast notifications for all error states

**NFR-REL-002: Data Integrity**
- Foreign key constraints enforce referential integrity (deals → users)
- Transactions for multi-step operations (deal creation + folder initialization)
- Optimistic UI updates with rollback on failure
- No orphaned records (cascading deletes where appropriate)
- Database migrations tested before deployment

**NFR-REL-003: Session Management**
- Sessions persist across browser restarts (refresh token stored)
- Graceful session expiry handling (redirect to login)
- Concurrent session support (same user, multiple tabs)
- Session revocation on logout (server-side token invalidation)
- Inactivity timeout: 7 days (configurable)

**NFR-REL-004: Deployment Reliability**
- Zero-downtime deployments (Vercel/Railway rolling deploys)
- Database migrations run before new code deploys
- Rollback capability (revert to previous deployment)
- Health check endpoints for monitoring
- Automated database backups (Supabase daily snapshots)

### Observability

**NFR-OBS-001: Logging**
- Structured logging (JSON format) for all API requests
- Log levels: DEBUG, INFO, WARN, ERROR
- Request ID tracking for distributed tracing
- Error logs include stack traces (server-side only)
- Sensitive data redacted from logs (passwords, tokens)

**NFR-OBS-002: Monitoring Metrics**
- API response times (p50, p95, p99)
- Database query performance (slow query log >1s)
- Error rates by endpoint
- Authentication success/failure rates
- Active user sessions (gauge metric)

**NFR-OBS-003: Error Tracking**
- Frontend errors captured and reported (Sentry or similar)
- Backend exceptions logged with context
- User impact assessment (how many users affected)
- Error grouping and deduplication
- Alert on critical errors (auth failures, database down)

**NFR-OBS-004: Development Observability**
- Next.js dev server logs all requests
- FastAPI debug mode shows SQL queries (dev only)
- Docker Compose logs aggregated per service
- Neo4j query logging for graph operations (dev)
- pg-boss job queue visibility (pending, processing, failed)

## Dependencies and Integrations

### External Dependencies

**Frontend Framework:**
- **Next.js 15.5** (React Framework)
  - Version: `^15.5.0`
  - Purpose: Server-side rendering, App Router, Turbopack dev builds
  - Official Docs: [Next.js 15 Documentation](https://nextjs.org/docs) | [What's New in Next.js 15](https://nextjs.org/blog/next-15)
  - Key Features: React 19 support, Turbopack stable in dev, Server Actions
  - Best Practices: Use App Router, middleware for auth, route-level code splitting

- **React 19.2** (UI Library)
  - Version: `^19.2.0`
  - Purpose: Component-based UI, Server Components, improved hooks
  - Official Docs: [React 19 Changelog](https://react.dev/blog/2024/12/05/react-19)
  - Integration: Fully integrated via Next.js 15

- **Tailwind CSS 4** (Styling)
  - Version: `^4.0.0`
  - Purpose: Utility-first CSS framework
  - Official Docs: [Tailwind v4 Documentation](https://tailwindcss.com/docs)
  - Integration: Configured in `tailwind.config.ts`, purged for production (<50KB)

- **shadcn/ui** (Component Library)
  - Version: Latest (compatible with Tailwind 4 + React 19)
  - Purpose: Accessible, customizable UI components
  - Official Docs: [shadcn/ui Tailwind v4 Guide](https://ui.shadcn.com/docs/tailwind-v4)
  - Integration: Components use OKLCH colors, data-slot attributes, React 19 primitives
  - Best Practices: On-demand imports, theme directive for customization

**Backend & Database:**
- **Supabase** (Backend-as-a-Service)
  - Version: Cloud-hosted or self-hosted via Docker
  - Components:
    - PostgreSQL 18 (managed database with pgvector 0.8+)
    - Supabase Auth (JWT-based authentication)
    - Google Cloud Storage (document file storage - decided in Epic 2 planning)
    - Supabase Realtime (WebSocket updates)
  - Official Docs: [Supabase Documentation](https://supabase.com/docs)
  - RLS Guide: [Row Level Security Best Practices](https://supabase.com/docs/guides/database/postgres/row-level-security)
  - Best Practices:
    - Always enable RLS on public tables
    - Add indexes on columns used in RLS policies for performance
    - Use service keys only server-side (never expose to client)
    - Enable RLS early in development
  - Version Compatibility: PostgreSQL 18.1 released November 13, 2025

- **Neo4j 2025.01** (Graph Database)
  - Version: Community Edition 5.x+ (note: search didn't confirm "2025.01" version)
  - Purpose: Knowledge graph relationships, source attribution, contradiction detection
  - Official Docs: [Neo4j Getting Started](https://neo4j.com/docs/getting-started/)
  - Driver Best Practices: [Neo4j Driver Guide](https://neo4j.com/blog/developer/neo4j-driver-best-practices/)
  - Connection: Use `neo4j+s://` for secured connections
  - Best Practices:
    - Use specific relationship names for efficient traversal
    - Avoid supernodes by using intermediate nodes
    - Index frequently queried properties
    - Use constraints for data integrity

**Job Queue:**
- **pg-boss** (PostgreSQL-based Job Queue)
  - Version: `^8.4.2+`
  - Purpose: Background document processing, asynchronous task execution
  - Official Docs: [pg-boss GitHub](https://github.com/timgit/pg-boss) | [npm Package](https://www.npmjs.com/package/pg-boss)
  - Key Features: Exactly-once delivery, retry logic, dead letter queues, SKIP LOCKED
  - Production-Proven: Used by companies like hey.com for millions of jobs/day
  - Best Practices:
    - One pg-boss instance per application
    - Use custom schemas for multi-tenant isolation
    - Monitor queue depth and processing times
    - Configure retry limits and exponential backoff

**Development Tools:**
- **Docker Compose** (Container Orchestration)
  - Version: `3.8+`
  - Purpose: Local development environment (Supabase + Neo4j + Next.js + API)
  - Official Docs: [Docker Compose Documentation](https://docs.docker.com/compose/)
  - Services: postgres, neo4j, api, worker, web
  - Best Practice: Single `docker-compose up` command for entire stack

### Internal Dependencies (Monorepo Packages)

**packages/database:**
- Database clients (Supabase, Neo4j)
- Connection pooling
- Migration utilities

**packages/shared:**
- TypeScript types
- Common utilities
- Validation schemas (Zod or Pydantic equivalent)

**packages/ui:**
- shadcn/ui component wrappers
- Theme configuration
- Tailwind utilities

### Integration Points

**Frontend ↔ Supabase:**
- Authentication: Supabase Auth SDK (`@supabase/auth-helpers-nextjs`)
- Database: Supabase Client SDK for REST API calls
- Realtime: WebSocket subscriptions for live updates
- Storage: Signed URLs for document access

**Backend ↔ PostgreSQL:**
- RLS enforcement on all queries (no bypass in MVP)
- pg-boss job queue (same database, separate schema)
- pgvector extension for semantic search (Phase 3)

**Backend ↔ Neo4j:**
- Neo4j JavaScript Driver (`neo4j-driver`)
- Cypher queries for graph operations
- Bidirectional sync: Postgres findings → Neo4j relationships

**Future Integrations (Out of Scope for Epic 1):**
- Document processing pipeline (Docling parser - Epic 3)
- LLM providers (Claude, Gemini, OpenAI - Epic 5)
- Embeddings generation (OpenAI text-embedding-3-large - Epic 3)
- FastAPI backend (Python service layer - Epic 2+)

### Version Compatibility Matrix

| Component | Version | Compatibility Notes |
|-----------|---------|---------------------|
| Node.js | 20+ LTS | Required for Next.js 15 |
| npm | 10+ | Package manager |
| PostgreSQL | 18.1 | Via Supabase, released Nov 2025 |
| pgvector | 0.8+ | PostgreSQL extension for embeddings |
| Neo4j | 5.x+ | Community Edition, Java 21 compatible |
| React | 19.2 | Required by Next.js 15 |
| Next.js | 15.5 | Stable Turbopack in dev |
| Tailwind CSS | 4.x | OKLCH colors, @theme directive |
| Docker | 24+ | For local development |

### Known Compatibility Issues

**None identified for Epic 1 scope.** All dependencies are stable, production-ready versions released in 2024-2025.

### Dependency Management

**Lock Files:**
- `package-lock.json` for frontend (npm)
- Commit lock files to version control
- Regular dependency audits (`npm audit`)

**Security:**
- Dependabot enabled for automated security updates
- Review breaking changes before upgrading major versions
- Pin critical dependencies to specific minor versions

### Official Documentation Sources

- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Next.js 15 Release Notes](https://nextjs.org/blog/next-15)
- [Supabase Documentation](https://supabase.com/docs)
- [Supabase RLS Guide](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL 18 Row Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Neo4j Getting Started](https://neo4j.com/docs/getting-started/)
- [Neo4j Driver Best Practices](https://neo4j.com/blog/developer/neo4j-driver-best-practices/)
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [pg-boss GitHub Repository](https://github.com/timgit/pg-boss)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

## Acceptance Criteria (Authoritative)

Epic 1 establishes the foundational infrastructure for the Manda platform. The following acceptance criteria define what must be demonstrable at epic completion.

### AC-1: Project Creation and Management
```gherkin
Given I am an authenticated user
When I create a new project with name "Acme Corp Acquisition"
Then the project appears in my Projects Overview
And the project has a unique ID
And the project is linked to my user account via RLS

Given I have created multiple projects
When I view Projects Overview
Then I see all my projects in card grid view (default)
And I can switch to table view
And each project shows: name, company, status, progress, last activity
And I only see projects I own (RLS enforced)
```

### AC-2: Authentication and Authorization
```gherkin
Given I am a new user
When I sign up with email and password
Then my account is created in Supabase Auth
And I receive a confirmation email
And I can sign in after email confirmation

Given I am authenticated
When I make database queries
Then RLS policies enforce that I can only access my own deals
And I cannot see or modify other users' projects

Given I am unauthenticated
When I try to access /projects
Then I am redirected to /login
And I cannot access protected routes
```

### AC-3: Data Isolation (Row-Level Security)
```gherkin
Given User A has 3 projects
And User B has 2 projects
When User A queries the deals table
Then User A sees only their 3 projects
And User A cannot query User B's projects
And the database enforces this isolation (not application logic)

Given User A tries to access /projects/[user-b-project-id]
When they navigate to the URL
Then they receive a 403 Forbidden error
And RLS policy prevents data retrieval
```

### AC-4: Project Workspace Navigation
```gherkin
Given I have selected a project
When I enter the project workspace
Then I see the top navigation bar with project name
And I see the sidebar with 5 sections: Dashboard, Data Room, Knowledge Explorer, Chat, Deliverables
And the current section is highlighted

Given I click "Data Room" in the sidebar
When the route changes
Then the sidebar highlights "Data Room" as active
And the Data Room screen loads
And the URL shows /projects/[id]/data-room
```

### AC-5: Database Schema and Constraints
```gherkin
Given the PostgreSQL schema is deployed
When I inspect the database
Then all tables exist: deals, documents, findings, insights, conversations, messages, irls, qa_lists, cims
And all foreign key constraints are enforced
And indexes exist on: deals(user_id), documents(deal_id), findings(deal_id)
And pgvector extension is enabled

Given I try to insert a document with invalid deal_id
When the insert executes
Then it fails with foreign key constraint violation
And no orphaned records are created
```

### AC-6: Neo4j Graph Database
```gherkin
Given Neo4j is configured and running
When the backend application starts
Then it connects successfully to Neo4j
And a health check query returns success

Given I create a test Finding node
When I query for that node via Cypher
Then the node is retrieved
And I can create relationships (EXTRACTED_FROM, CONTRADICTS, SUPPORTS)
```

### AC-7: Background Job Queue (pg-boss)
```gherkin
Given pg-boss is configured
When the backend starts
Then job tables are created in PostgreSQL
And worker processes start listening for jobs

Given I enqueue a test job
When the worker picks it up
Then the job executes successfully
And the status updates to "completed"
And I can query job status via API

Given a job fails
When it retries
Then it attempts up to 3 times with exponential backoff
And the final status is "failed" after exhausting retries
```

### AC-8: Docker Compose Development Environment
```gherkin
Given I have Docker installed
When I run docker-compose up
Then all services start: postgres, neo4j, web, api, worker
And the Next.js dev server is accessible at localhost:3000
And the API is accessible at localhost:8000
And Neo4j Browser is accessible at localhost:7474
And PostgreSQL is accessible at localhost:5432

Given all services are running
When I make changes to Next.js code
Then hot reload updates the browser
And I don't need to restart Docker
```

### AC-9: Audit Logging for Security Events
```gherkin
Given audit logging is configured
When a user signs in
Then an audit log entry is created with event_type "auth_login"
And the log includes: timestamp, user_id, ip_address, user_agent

Given a user creates a project
When the deal record is inserted
Then an audit log entry captures the action
And the log includes deal_id and project details

Given I query the audit_logs table
When I filter by user_id
Then I see all security events for that user in chronological order
And logs are tamper-proof (append-only)
```

### Epic-Level Success Criteria

**The epic is complete when all of the following are true:**

1. ✅ New users can sign up, confirm email, and sign in
2. ✅ Authenticated users land on Projects Overview showing their projects
3. ✅ Users can create projects via 3-step wizard (name, type, IRL template)
4. ✅ Created projects appear in Projects Overview with correct metadata
5. ✅ Users can enter project workspace and see navigation shell
6. ✅ Sidebar navigation works for all 5 sections (even if sections are empty)
7. ✅ RLS policies enforce complete data isolation (verified via tests)
8. ✅ PostgreSQL schema is complete with all tables and indexes
9. ✅ Neo4j graph database is connected and operational
10. ✅ pg-boss job queue can enqueue, process, and monitor jobs
11. ✅ Docker Compose environment starts all services with one command
12. ✅ Audit logs capture all security-relevant events
13. ✅ No user can access another user's projects (security verified)
14. ✅ Frontend is responsive on desktop (1920x1080) and tablet (1024x768)
15. ✅ All environment variables are documented in `.env.example`

## Traceability Mapping

This table maps acceptance criteria to architectural components, APIs/interfaces, and test strategies, ensuring full traceability from requirements to implementation to testing.

| AC # | Acceptance Criterion | Spec Sections | Components/APIs | Test Strategy |
|------|---------------------|---------------|-----------------|---------------|
| **AC-1** | Project Creation and Management | Services: apps/web (Next.js)<br/>Data Models: deals table<br/>APIs: POST /rest/v1/deals | - Next.js App Router (`/projects` route)<br/>- Supabase Client SDK<br/>- Deals table with RLS<br/>- Project creation wizard component | **Unit:** Test wizard form validation<br/>**Component:** Test wizard steps, progress indicator<br/>**API:** Test POST /rest/v1/deals endpoint<br/>**E2E:** Create project flow end-to-end |
| **AC-2** | Authentication and Authorization | Services: Supabase Auth<br/>Security: RLS policies<br/>Workflows: Login/signup flows | - Supabase Auth SDK<br/>- Auth middleware<br/>- JWT token handling<br/>- `/login`, `/signup` routes | **Unit:** Test auth middleware logic<br/>**Integration:** Test Supabase Auth API calls<br/>**E2E:** Signup → confirm → login flow<br/>**Security:** Test RLS enforcement |
| **AC-3** | Data Isolation (RLS) | Data Models: RLS policies<br/>Security: NFR-SEC-002 | - PostgreSQL RLS policies<br/>- `auth.uid() = user_id` policy<br/>- Database triggers | **Integration:** Multi-user RLS test<br/>**Security:** Attempt cross-user access (should fail)<br/>**Database:** Verify policy application with EXPLAIN |
| **AC-4** | Project Workspace Navigation | Services: apps/web layout<br/>Workflows: Navigation | - Project workspace layout component<br/>- Sidebar navigation<br/>- Top navigation bar<br/>- Route guards | **Component:** Test sidebar active states<br/>**E2E:** Click through all navigation sections<br/>**Accessibility:** Keyboard navigation |
| **AC-5** | Database Schema and Constraints | Data Models: PostgreSQL schema<br/>APIs: Database migrations | - All database tables<br/>- Foreign keys<br/>- Indexes<br/>- pgvector extension | **Database:** Migration up/down tests<br/>**Integration:** Test foreign key constraints<br/>**Performance:** Verify indexes used (EXPLAIN) |
| **AC-6** | Neo4j Graph Database | Services: Neo4j<br/>Data Models: Graph schema | - Neo4j driver<br/>- Graph nodes (Deal, Document, Finding, Insight)<br/>- Relationships<br/>- Health check | **Integration:** Neo4j connection test<br/>**Graph:** CRUD operations on nodes/relationships<br/>**Health:** Health check endpoint |
| **AC-7** | Background Job Queue (pg-boss) | Services: pg-boss<br/>Workflows: Job processing | - pg-boss instance<br/>- Job handlers<br/>- Worker processes<br/>- Job API endpoints | **Integration:** Enqueue → process → complete flow<br/>**Retry:** Test retry logic and backoff<br/>**Monitoring:** Job status API tests |
| **AC-8** | Docker Compose Dev Environment | Services: All (Docker orchestration) | - docker-compose.dev.yml<br/>- All service containers<br/>- Volume mounts<br/>- Health checks | **Infrastructure:** docker-compose up succeeds<br/>**Integration:** Services communicate correctly<br/>**Developer:** Hot reload works |
| **AC-9** | Audit Logging | Services: Audit service<br/>Data Models: audit_logs table | - audit_logs table<br/>- Logging middleware<br/>- Event capture hooks | **Unit:** Test event capture logic<br/>**Integration:** Verify logs created on events<br/>**Security:** Test tamper-proof design |

### Requirements Traceability

**PRD Requirements → Epic 1:**

| PRD Requirement | Epic 1 Coverage | Implementation Component |
|-----------------|-----------------|--------------------------|
| FR-ARCH-001: Platform-Agent Separation | ✅ Full | Monorepo structure, service separation |
| FR-ARCH-002: Tool-Based Agent Integration | ✅ Foundational | APIs ready for agent tool calling (Epic 5) |
| FR-ARCH-003: Scalable Service Architecture | ✅ Full | Docker services, RLS for multi-tenant |
| FR-ARCH-004: Event-Driven Communication | ✅ Full | pg-boss job queue for async processing |
| FR-DOC-001: Document Upload | ⏸️ Phase 2 (Epic 2) | Placeholder only |
| FR-DOC-002: Document Organization | ⏸️ Phase 2 (Epic 2) | Folder structure prepared |
| NFR-SEC-001: Data Confidentiality | ✅ Full | Encryption at rest (Supabase), TLS in transit |
| NFR-SEC-002: Authentication & Authorization | ✅ Full | Supabase Auth, RLS policies |
| NFR-PERF-001: Response Time | ✅ Full | Next.js 15 SSR, optimized bundles |
| NFR-PERF-003: Scalability | ✅ Full | RLS scales horizontally, connection pooling |

### Architecture Decision Traceability

| Architecture Decision | Implemented In | Verification |
|----------------------|----------------|--------------|
| Next.js 15 + React 19.2 | Story E1.1 | npm run dev succeeds |
| Supabase Auth + PostgreSQL 18 | Story E1.2, E1.3 | Auth works, RLS enforced |
| Neo4j 2025.01 graph database | Story E1.6 | Neo4j connection health check |
| pg-boss job queue | Story E1.7 | Job enqueue/process works |
| Docker Compose dev environment | All stories | docker-compose up starts all services |
| RLS for data isolation | Story E1.3 | Multi-user isolation tests pass |
| shadcn/ui + Tailwind CSS 4 | Story E1.1 | Components render correctly |

### Test Coverage Matrix

| Test Level | Focus | Tools | Epic 1 Stories Covered |
|------------|-------|-------|------------------------|
| **Unit** | Individual functions, components | Jest, React Testing Library | E1.1 (components), E1.2 (auth utils), E1.7 (job handlers) |
| **Component** | UI components in isolation | Jest, React Testing Library | E1.1 (shadcn/ui), E1.4 (project cards), E1.5 (wizard), E1.6 (navigation) |
| **Integration** | Service-to-service communication | Jest, Supertest | E1.2 (Supabase), E1.6 (Neo4j), E1.7 (pg-boss), E1.3 (database) |
| **API** | REST endpoints | Postman, Jest | E1.2 (auth), E1.3 (deals CRUD), E1.7 (job status) |
| **E2E** | Full user workflows | Playwright | E1.4 + E1.5 (create project), E1.2 (signup/login), E1.6 (navigation) |
| **Security** | RLS, auth, data isolation | Custom scripts, Penetration tests | E1.2 (auth), E1.3 (RLS), E1.8 (audit logging) |
| **Performance** | Response times, load testing | Lighthouse, k6 | E1.4 (Projects Overview load), E1.6 (workspace rendering) |
| **Infrastructure** | Docker, deployment | docker-compose, health checks | All stories (Docker environment) |

## Risks, Assumptions, Open Questions

### Risks

**RISK-E1-001: RLS Policy Complexity**
- **Description:** Complex RLS policies may introduce performance overhead or edge cases where isolation fails
- **Severity:** HIGH (security-critical)
- **Mitigation:**
  - Start with simplest possible policies: `auth.uid() = user_id`
  - Add comprehensive security tests for multi-user scenarios
  - Use EXPLAIN ANALYZE to monitor query performance with RLS
  - Regular security audits during development
  - Benchmark RLS overhead (<50ms target per query)
- **Owner:** Backend Team

**RISK-E1-002: Docker Compose Performance on Dev Machines**
- **Description:** Running 5 Docker containers (postgres, neo4j, api, worker, web) may strain developer laptops
- **Severity:** MEDIUM (developer experience)
- **Mitigation:**
  - Provide minimum hardware requirements (16GB RAM, SSD recommended)
  - Optimize Docker resource limits per service
  - Option to use cloud-hosted Supabase/Neo4j for low-spec machines
  - Profile resource usage and document in setup guide
- **Owner:** DevOps

**RISK-E1-003: Next.js 15 / React 19.2 Stability**
- **Description:** Next.js 15 and React 19.2 are relatively new (released Q4 2024); potential for bugs or breaking changes
- **Severity:** MEDIUM (technical risk)
- **Mitigation:**
  - Pin exact versions in package.json (not `^` ranges)
  - Monitor Next.js GitHub for known issues
  - Test major features thoroughly before relying on them
  - Delay upgrading minor versions until community validates stability
  - Follow Next.js 15 migration guide strictly
- **Owner:** Frontend Team

**RISK-E1-004: Supabase Free Tier Limits**
- **Description:** Supabase free tier has limits (500MB database, 1GB file storage, 50K monthly active users)
- **Severity:** LOW (MVP acceptable)
- **Mitigation:**
  - Document tier limits in setup guide
  - Plan for paid tier upgrade before beta launch
  - Monitor usage in dev environment
  - Design for upgrade path (no architectural changes needed)
- **Owner:** Product Team

**RISK-E1-005: Neo4j Learning Curve**
- **Description:** Team may be unfamiliar with graph databases and Cypher query language
- **Severity:** MEDIUM (development velocity)
- **Mitigation:**
  - Allocate learning time in sprint planning
  - Start with simple queries, increase complexity gradually
  - Use Neo4j official tutorials and documentation
  - Pair programming on graph operations
  - Document common patterns in project wiki
- **Owner:** Backend Team

### Assumptions

**ASSUMPTION-E1-001: Single-Tenant MVP**
- **Assumption:** Each user works on their own deals independently (no team collaboration in MVP)
- **Impact:** Simplifies RLS policies, no need for team/role management
- **Validation:** Confirmed in PRD v1.4 (multi-user is Phase 2)
- **Risk if Wrong:** Medium - would require additional tables and complex RLS policies

**ASSUMPTION-E1-002: Development on macOS/Linux**
- **Assumption:** Developers use macOS or Linux (Docker Compose works best on Unix)
- **Impact:** Windows developers may need WSL2 for Docker
- **Validation:** Team survey confirms macOS majority
- **Risk if Wrong:** Low - WSL2 is well-documented alternative

**ASSUMPTION-E1-003: Node.js 20 LTS Availability**
- **Assumption:** Developers have or can install Node.js 20 LTS
- **Impact:** Required for Next.js 15
- **Validation:** Node.js 20 is current LTS (until April 2026)
- **Risk if Wrong:** None - widely available

**ASSUMPTION-E1-004: PostgreSQL 18 via Supabase**
- **Assumption:** Using Supabase provides PostgreSQL 18 automatically
- **Impact:** No need to manage PostgreSQL upgrades
- **Validation:** Supabase uses latest PostgreSQL (confirmed: 18.1 released Nov 2025)
- **Risk if Wrong:** None - Supabase manages upgrades

**ASSUMPTION-E1-005: pgvector Extension Enabled**
- **Assumption:** Supabase projects have pgvector enabled by default or on request
- **Impact:** Required for semantic search in Epic 3
- **Validation:** Needs verification during E1.3 (database setup)
- **Risk if Wrong:** Medium - would need to enable manually or use alternative

**ASSUMPTION-E1-006: Internet Connectivity for OAuth**
- **Assumption:** Development environment has internet access for OAuth providers (Google, Microsoft)
- **Impact:** OAuth login flows require external API calls
- **Validation:** Standard development setup
- **Risk if Wrong:** Low - email/password works offline

### Open Questions

**QUESTION-E1-001: Nextbase Lite Template Adoption**
- **Question:** Should we use Nextbase Lite starter template, or build from scratch?
- **Impact:** 1-2 weeks of setup time saved if using template
- **Decision Needed By:** Start of Story E1.1
- **Recommendation:** Use Nextbase Lite - it provides Next.js 15 + Supabase + Tailwind 4 + testing pre-configured
- **Decision Owner:** Tech Lead

**QUESTION-E1-002: Neo4j Cloud vs Self-Hosted**
- **Question:** Use Neo4j AuraDB Free (cloud) or Docker container for development?
- **Impact:** Docker provides offline development, AuraDB simplifies setup
- **Decision Needed By:** Start of Story E1.6
- **Recommendation:** Docker for dev (docker-compose), AuraDB for staging/prod
- **Decision Owner:** DevOps

**QUESTION-E1-003: FastAPI Backend Timing**
- **Question:** When to introduce FastAPI backend? Epic 1 or defer to Epic 2?
- **Impact:** Epic 1 can work with Supabase Edge Functions, FastAPI adds complexity
- **Decision Needed By:** Sprint planning for Epic 1
- **Recommendation:** Defer to Epic 2 (document processing) - Supabase REST API sufficient for Epic 1
- **Decision Owner:** Architect

**QUESTION-E1-004: Environment Variable Management**
- **Question:** Use .env.local files or centralized secret management (e.g., Doppler)?
- **Impact:** Security and ease of onboarding
- **Decision Needed By:** Start of Story E1.2
- **Recommendation:** .env.local for MVP, migrate to secret manager before production
- **Decision Owner:** DevOps

**QUESTION-E1-005: Monorepo Tool Selection**
- **Question:** Use Turborepo, Nx, or plain npm workspaces for monorepo?
- **Impact:** Build performance and developer experience
- **Decision Needed By:** Start of Story E1.1
- **Recommendation:** Start with npm workspaces (simplest), evaluate Turborepo if build times become issue
- **Decision Owner:** Tech Lead

## Test Strategy Summary

Epic 1 establishes critical infrastructure, so testing emphasizes **security, data isolation, and infrastructure reliability**. The test strategy follows a hybrid testing pyramid with additional security and infrastructure layers.

### Test Levels and Coverage Targets

| Test Level | Target Coverage | Focus Areas | Tools |
|------------|-----------------|-------------|-------|
| **Unit** | 70% | Utility functions, auth middleware, validation | Jest, React Testing Library |
| **Component** | 80% | UI components, forms, navigation | Jest, React Testing Library, Storybook |
| **Integration** | 100% (critical paths) | Supabase APIs, Neo4j, pg-boss, RLS | Jest, Supertest |
| **API** | 100% (all endpoints) | REST endpoints, auth flows | Postman Collections, Jest |
| **E2E** | 100% (user flows) | Signup, login, create project, navigate | Playwright |
| **Security** | 100% (RLS policies) | Data isolation, auth bypass attempts | Custom scripts, manual testing |
| **Infrastructure** | 100% | Docker Compose, service health | docker-compose, health check scripts |

### Critical Test Scenarios

**Security Tests (Highest Priority):**
1. **Multi-User Data Isolation:**
   - User A creates 3 projects
   - User B creates 2 projects
   - Verify User A cannot query User B's projects via API
   - Verify User A cannot access User B's project URLs
   - Test at database level (EXPLAIN shows RLS policy applied)

2. **Authentication Bypass Attempts:**
   - Attempt to access protected routes without token
   - Attempt to use expired/invalid JWT
   - Attempt SQL injection on login form
   - Attempt to modify user_id in JWT (should fail signature verification)

3. **RLS Policy Edge Cases:**
   - User with no projects (empty state)
   - User attempting to UPDATE another user's project
   - User attempting to DELETE another user's project
   - Concurrent access by multiple users

**Infrastructure Tests:**
1. **Docker Compose Reliability:**
   - `docker-compose up` starts all services within 60 seconds
   - All health checks pass
   - Services can communicate (web → api → postgres → neo4j)
   - Hot reload works for Next.js code changes
   - `docker-compose down` cleanly stops all services

2. **Database Migration Testing:**
   - Migration up succeeds
   - Migration down (rollback) succeeds
   - Idempotent migrations (running twice is safe)
   - Foreign key constraints enforced
   - Indexes created correctly

**End-to-End User Flows:**
1. **New User Onboarding:**
   - Visit app → redirected to /login
   - Click "Sign Up"
   - Enter email/password → submit
   - Check email for confirmation link
   - Click confirmation link → redirected to login
   - Sign in → land on Projects Overview (empty state)

2. **Create First Project:**
   - Click "+ New Project"
   - Step 1: Enter "Acme Corp Acquisition", company "Acme", industry "Technology"
   - Step 2: Select "Tech M&A"
   - Step 3: IRL template auto-suggested → confirm
   - Click "Create Project"
   - Redirected to project dashboard
   - Verify project appears in Projects Overview

3. **Navigation Flow:**
   - Enter project workspace
   - Click "Data Room" → verify navigation and URL
   - Click "Knowledge Explorer" → verify navigation
   - Click "Chat" → verify navigation
   - Click "← Projects" → return to overview

### Test Data Strategy

**Test Users:**
- `alice@test.com` - regular user with 3 projects
- `bob@test.com` - regular user with 2 projects
- `charlie@test.com` - user with 0 projects (empty state testing)

**Test Projects:**
- "Acme Corp Acquisition" (Alice) - Tech M&A
- "Beta Industries" (Alice) - Industrial
- "Gamma Pharma" (Alice) - Pharma
- "Delta Financial" (Bob) - Financial Services
- "Epsilon Retail" (Bob) - Custom

**Database Seeding:**
- Seed script creates test users and projects
- Seed data includes all project types and statuses
- RLS policies tested against seed data
- Seed script is idempotent (can run multiple times)

### Test Environments

**Local Development:**
- Docker Compose with all services
- Seeded test data
- `.env.local` configuration
- Hot reload for rapid iteration

**CI/CD Pipeline:**
- GitHub Actions workflow
- Automated test execution on PR
- Database migrations tested
- RLS security tests enforced
- E2E tests run headlessly (Playwright)

**Staging:**
- Cloud-hosted Supabase + Neo4j
- Production-like environment
- Manual QA testing
- Performance benchmarks

### Test Execution Order

1. **Unit Tests** - Fast feedback loop (< 5 seconds)
2. **Component Tests** - UI verification (< 30 seconds)
3. **Integration Tests** - Service communication (< 2 minutes)
4. **Security Tests** - RLS enforcement (< 1 minute)
5. **E2E Tests** - Full workflows (< 5 minutes)
6. **Infrastructure Tests** - Docker health (< 2 minutes)

**Total Test Suite Runtime Target:** < 10 minutes for complete epic test run

### Definition of Done (Testing)

Epic 1 is complete when:
- ✅ All unit tests pass (>70% coverage)
- ✅ All component tests pass (>80% coverage)
- ✅ All integration tests pass (100% of critical paths)
- ✅ All security tests pass (100% - no failures allowed)
- ✅ All E2E flows pass (signup, login, create project, navigate)
- ✅ Docker Compose environment starts successfully
- ✅ RLS policies verified with multi-user test scenarios
- ✅ No user can access another user's data (security verified)
- ✅ Test documentation complete (README in `/tests` directory)
- ✅ CI/CD pipeline runs all tests automatically
