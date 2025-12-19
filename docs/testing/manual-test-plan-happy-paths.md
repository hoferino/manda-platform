# Manual Test Plan - Happy Paths

**Document Status:** Active
**Epic:** E12 - Production Readiness & Observability
**Story:** E12.4 - Manual Test Plan - Happy Paths
**Created:** 2025-12-19
**Last Executed:** [DATE_OF_EXECUTION]

---

## Overview

This document defines the manual test scenarios for critical happy path user journeys. These are the core workflows that MUST work flawlessly before going to production.

**Prerequisites:**
- All services running (Next.js, FastAPI, Worker, Neo4j)
- Valid Supabase connection
- Test user account with superadmin role
- Sample documents ready (CIM PDF, financial Excel)

**Environment:**
- Next.js: http://localhost:3000
- FastAPI: http://localhost:8000
- Neo4j: http://localhost:7474

---

## HP-001: New Deal Creation

**Priority:** P0 (Critical)
**Estimated Time:** 2 minutes
**Dependencies:** User logged in

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to `/projects` | Projects list displayed | |
| 2 | Click "New Project" or navigate to `/projects/new` | 2-step wizard opens (Step 1: Basic Info) | |
| 3 | Enter project name: "Test Acquisition Co" | projectName field accepts input | |
| 4 | Enter company name: "Target Corp" (optional) | companyName field accepts input | |
| 5 | Select industry from searchable dropdown | Industry selected | |
| 6 | Click "Next" button | Wizard advances to Step 2: IRL Template | |
| 7 | Select IRL template (or "Start Empty") | Template selection highlighted | |
| 8 | Click "Create Project" button | Project created, redirect to `/projects/[id]/dashboard` | |
| 9 | Verify project dashboard loads | Dashboard page with project name visible | |
| 10 | Navigate to project tabs | All tabs accessible: dashboard, data-room, knowledge-explorer, chat, qa | |

### Success Criteria
- Deal appears in dashboard within 2 seconds of creation
- All project tabs accessible (dashboard, data-room, knowledge-explorer, chat, qa, cim-builder)
- Deal shows in organization scope (E12.9 multi-tenant isolation)
- If IRL template selected, folders created automatically

### Evidence Required
- Screenshot of wizard Step 1
- Screenshot of wizard Step 2
- Screenshot of project dashboard after creation

---

## HP-002: Document Upload (PDF)

**Priority:** P0 (Critical)
**Estimated Time:** 1 minute upload + 30 seconds processing
**Dependencies:** HP-001 completed (deal exists)

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to `/projects/[id]/data-room` | Data Room page displayed | |
| 2 | Click "Upload" button | Upload dialog/dropzone opens | |
| 3 | Select sample CIM PDF (10 pages) | File selected, name displayed | |
| 4 | Click "Upload" or drop file | Progress indicator shown | |
| 5 | Wait for upload completion | Status changes to "Processing" | |
| 6 | Document appears in list immediately | Document visible with pending status | |
| 7 | Wait for processing (watch real-time updates) | Status: Parsed → Embedded → Analyzed | |
| 8 | Verify final status: "Processed" | Green checkmark, processing complete | |
| 9 | Navigate to Knowledge Explorer | Findings extracted from document visible | |

### Success Criteria
- Document visible in UI within 2 seconds of upload
- Processing completes within 30 seconds for 10-page PDF
- At least 5 findings extracted
- Real-time status updates visible via Supabase Realtime WebSocket

### Evidence Required
- Screenshot of upload progress
- Screenshot of processed document with status
- Screenshot of extracted findings in Knowledge Explorer

---

## HP-003: Chat - Simple Query

**Priority:** P0 (Critical)
**Estimated Time:** 10 seconds
**Dependencies:** HP-002 completed (document processed)

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to `/projects/[id]/chat` | Chat interface displayed with conversation sidebar | |
| 2 | Type message in textarea: "What is the company's revenue?" | Message appears in input | |
| 3 | Press Enter or click Send button | Message sent, loading indicator | |
| 4 | Wait for response | Response streams in real-time | |
| 5 | Verify response includes revenue figure | Correct revenue mentioned | |
| 6 | Verify source citation present | Document source chip/link shown | |
| 7 | Click on source citation | Source preview opens/highlights | |

### Success Criteria
- Response within 5 seconds
- Response references correct document
- Source citation is clickable and accurate
- No errors or timeouts

### Evidence Required
- Screenshot of chat with question and response
- Screenshot of source citation

---

## HP-004: Chat - Knowledge Write-Back

**Priority:** P0 (Critical)
**Estimated Time:** 15 seconds
**Dependencies:** HP-003 completed (chat working)

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | In chat, type: "The Q3 revenue was actually $5.2M" | Message appears in input | |
| 2 | Press Enter to send | Agent processes message | |
| 3 | Verify agent response | "Got it, I've noted..." or similar acknowledgment | |
| 4 | Start new conversation (click "New Chat" or refresh) | Fresh chat context | |
| 5 | Ask: "What is Q3 revenue?" | Question sent | |
| 6 | Verify response includes $5.2M | Agent uses corrected value | |
| 7 | Verify response indicates user-provided source | Source shows user/chat origin | |

### Success Criteria
- Agent acknowledges user correction
- Corrected fact persists across sessions
- New queries return updated information
- Source attribution shows user/chat as origin

### Evidence Required
- Screenshot of correction message and acknowledgment
- Screenshot of subsequent query with corrected answer

---

## HP-005: Q&A Workflow

**Priority:** P0 (Critical)
**Estimated Time:** 2 minutes
**Dependencies:** HP-002 completed (document processed)

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to `/projects/[id]/qa` | Q&A interface displayed | |
| 2 | Click "Add Question" or "New" button | Question input form opens | |
| 3 | Enter question: "What is the EBITDA margin?" | Question field accepts input | |
| 4 | Submit question | Question appears in list as "Pending" | |
| 5 | Click on the question to expand | Answer input area visible | |
| 6 | Enter answer: "The EBITDA margin is 25%..." | Answer field accepts input | |
| 7 | Click "Save Answer" | Answer saved, status changes | |
| 8 | Navigate to Chat tab | Chat interface opens | |
| 9 | Ask: "What is the EBITDA margin?" | Question sent | |
| 10 | Verify chat uses Q&A answer | Response references Q&A item | |

### Success Criteria
- Q&A item created and saved
- Status transitions: Pending → Answered
- Chat agent can retrieve Q&A content
- Q&A source attribution visible in chat

### Evidence Required
- Screenshot of Q&A list with question
- Screenshot of chat using Q&A answer

---

## HP-006: Search Across Deal

**Priority:** P0 (Critical)
**Estimated Time:** 30 seconds
**Dependencies:** HP-002, HP-004, HP-005 completed (content exists)

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to `/projects/[id]/knowledge-explorer` | Knowledge explorer displayed | |
| 2 | Locate search input (data-testid="finding-search-input") | Search input visible | |
| 3 | Enter search term: "revenue growth" | Search input accepts text | |
| 4 | Press Enter or wait for auto-search | Search executes | |
| 5 | Verify results include document findings | Findings from CIM shown | |
| 6 | Verify results include Q&A items (if relevant) | Q&A items in results | |
| 7 | Verify results include chat-indexed facts | User corrections visible | |
| 8 | Check result source types are indicated | Source type badges shown | |
| 9 | Click on a search result | Result detail/preview opens | |

### Success Criteria
- Search returns results within 2 seconds
- Multiple source types represented (Documents, Q&A, Chat)
- Source type clearly indicated per result
- Results are relevance-ordered

### Evidence Required
- Screenshot of search results with multiple source types
- Screenshot of result detail view

---

## Test Environment Setup

### Service Startup Commands

```bash
# 1. Start Neo4j
docker-compose -f docker-compose.dev.yml up -d

# 2. Start FastAPI (in manda-processing directory)
cd manda-processing
python3 -m uvicorn src.main:app --port 8000

# 3. Start Worker (in manda-processing directory)
python3 -m src.jobs

# 4. Start Next.js (in manda-app directory)
cd manda-app
npm run dev
```

### Health Checks

```bash
# FastAPI
curl http://localhost:8000/health

# Next.js
curl -s http://localhost:3000 | grep -i title

# Neo4j
docker exec neo4j cypher-shell -u neo4j -p mandadev123 "RETURN 'healthy'"
```

### Sample Test Data

| File | Purpose | Location |
|------|---------|----------|
| sample-cim.pdf | 10-page CIM for upload tests | e2e/fixtures/sample-cim.pdf |
| financial-statements.xlsx | Excel with financial data | e2e/fixtures/financial-statements.xlsx |

---

## Test Execution Log Template

```markdown
## Test Execution: [DATE]

**Tester:** [NAME]
**Environment:** localhost
**Build:** [GIT_COMMIT_SHA]

### HP-001: New Deal Creation
- Start Time: [HH:MM]
- End Time: [HH:MM]
- Result: [PASS/FAIL]
- Notes: [Any observations]
- Issues: [Issue IDs if any]

### HP-002: Document Upload
...

### Summary
- Total Tests: 6
- Passed: [X]
- Failed: [X]
- Blocked: [X]

### Issues Found
| ID | Test | Severity | Description | Status |
|----|------|----------|-------------|--------|
| | | | | |
```
