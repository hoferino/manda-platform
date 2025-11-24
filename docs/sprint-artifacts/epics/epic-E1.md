# Epic 1: Project Foundation

**Epic ID:** E1
**Jira Issue:** SCRUM-1
**Synced:** 2025-11-24
**User Value:** Users can create and manage isolated project instances with clear navigation

**Description:**
Implements the core project management infrastructure, allowing analysts to create projects, switch between them, and work within isolated project workspaces. Each project is a completely isolated instance with its own data room, knowledge base, and deliverables.

**Functional Requirements Covered:**
- FR-ARCH-001: Platform-Agent Separation
- FR-ARCH-002: Tool-Based Agent Integration
- FR-ARCH-003: Scalable Service Architecture

**Stories:**
- E1.1: Set up Next.js 14 Project with shadcn/ui
- E1.2: Configure Supabase Auth and Database Connection
- E1.3: Create PostgreSQL Schema with RLS Policies
- E1.4: Build Projects Overview Screen (Landing)
- E1.5: Implement Project Creation Wizard
- E1.6: Build Project Workspace Shell with Navigation
- E1.7: Configure Neo4j Graph Database
- E1.8: Configure pg-boss Job Queue
- E1.9: Implement Audit Logging for Security Events

**Total Stories:** 9

**Priority:** P0

---

**Full Details:** See [docs/epics.md](../../epics.md) lines 72-784
