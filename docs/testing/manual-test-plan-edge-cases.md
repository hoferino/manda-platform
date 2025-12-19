# Manual Test Plan - Edge Cases & Failures

**Document Status:** Active
**Epic:** E12 - Production Readiness & Observability
**Story:** E12.5 - Manual Test Plan - Edge Cases & Failures
**Created:** 2025-12-19
**Last Executed:** [DATE_OF_EXECUTION]

---

## Overview

This document defines manual test scenarios for edge cases and failure modes that real M&A users will encounter. These tests validate the platform's robustness and graceful degradation under adverse conditions.

**Prerequisites:**
- All services running (Next.js, FastAPI, Worker, Neo4j)
- Valid Supabase connection
- Test user account with superadmin role
- Test files prepared (see Test Data section)

**Environment:**
- Next.js: http://localhost:3000
- FastAPI: http://localhost:8000
- Neo4j: http://localhost:7474

**Severity Definitions:**
- **Critical (Blocker):** Prevents core functionality, must fix before release
- **High (Fix Soon):** Significant impact on usability, fix before production
- **Medium (Polish):** Minor UX issues, can defer but should track

---

## EC-001: Empty Document Upload

**Priority:** P1 (High)
**Estimated Time:** 1 minute
**Dependencies:** Deal exists

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Create empty PDF file (0 bytes) | File created | |
| 2 | Navigate to `/projects/[id]/data-room` | Data Room displayed | |
| 3 | Upload empty PDF | Upload starts | |
| 4 | Observe processing status | Status shows error | |
| 5 | Check error message | Clear, user-friendly message displayed | |

### Expected Behavior
- Graceful error message: "This file appears to be empty. Please upload a document with content."
- No crash or 500 error
- Document marked as failed in list with clear indicator
- No partial records left in database

### Evidence Required
- Screenshot of error message

---

## EC-002: Huge Document (500+ Pages)

**Priority:** P1 (High)
**Estimated Time:** 15 minutes
**Dependencies:** Deal exists, large CIM PDF available

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Upload 500-page PDF (sample large CIM) | Upload starts | |
| 2 | Monitor upload progress | Progress indicator visible | |
| 3 | Wait for processing | Status updates shown | |
| 4 | Monitor worker logs | No memory errors | |
| 5 | Check final status | Processed successfully OR clear timeout message | |

### Expected Behavior
- Processing completes within 10 minutes (timeout threshold)
- Status updates visible throughout: Uploading -> Processing -> Parsed -> Embedded -> Analyzed
- If timeout: Clear message explaining processing time and option to retry
- Memory usage stays within limits (no OOM kills)
- Findings extracted proportional to document length

### Evidence Required
- Screenshot of processing status timeline
- Worker log excerpt (no errors)
- Final status screenshot

---

## EC-003: Scanned PDF (Image-Only)

**Priority:** P0 (Critical)
**Estimated Time:** 3 minutes
**Dependencies:** Deal exists, scanned PDF without text layer

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Upload scanned PDF (image-only, no text layer) | Upload completes | |
| 2 | Wait for processing | Status shows parsing | |
| 3 | Check if OCR runs | Text extracted via OCR | |
| 4 | Navigate to Knowledge Explorer | Findings visible | |

### Expected Behavior
- Docling OCR kicks in automatically for image-only PDFs (verify `ocr_enabled: true` in Docling config)
- Text extracted (may take longer than text-based PDFs)
- If OCR fails: Clear message "This document contains images without extractable text. OCR was attempted but no text could be recovered."
- Partial results acceptable with clear indicator

### Pre-Test Verification
- Confirm Docling OCR is enabled: check `manda-processing/src/parsers/docling_parser.py` for `ocr_enabled` setting

### Evidence Required
- Screenshot of extracted text/findings from scanned document
- OR screenshot of graceful error if OCR fails

---

## EC-004: Non-English Document

**Priority:** P1 (High)
**Estimated Time:** 2 minutes
**Dependencies:** Deal exists, German financial document

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Upload German financial document | Upload completes | |
| 2 | Wait for processing | Processed successfully | |
| 3 | Navigate to Chat | Chat interface displayed | |
| 4 | Ask question in English: "What is the company revenue?" | Response generated | |
| 5 | Verify response language | Response in English | |

### Expected Behavior
- Document content extracted regardless of language
- Findings extracted with semantic understanding
- Chat responds in English even for non-English source
- Source citations work correctly

### Evidence Required
- Screenshot of chat question/answer with English response
- Screenshot of extracted findings from German document

---

## EC-005: Concurrent Document Uploads

**Priority:** P1 (High)
**Estimated Time:** 3 minutes
**Dependencies:** Deal exists, 5 sample documents

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Select 5 documents simultaneously | All selected | |
| 2 | Start upload | All uploads begin | |
| 3 | Monitor upload progress | Parallel progress bars | |
| 4 | Wait for all processing | All reach final status | |
| 5 | Verify all documents present | 5 documents in list | |

### Expected Behavior
- All 5 documents upload in parallel (XHR-based upload)
- Individual progress indicators for each
- No race conditions in database writes
- All documents reach "Processed" status
- pg-boss queue handles concurrent jobs correctly

### Evidence Required
- Screenshot of parallel upload progress
- Screenshot of all 5 documents in processed state

---

## EC-006: Chat with No Documents

**Priority:** P0 (Critical)
**Estimated Time:** 1 minute
**Dependencies:** Empty deal (no documents uploaded)

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Create new deal (HP-001 wizard) | Deal created | |
| 2 | Navigate to `/projects/[id]/chat` | Chat interface displayed | |
| 3 | Ask: "What is the company revenue?" | Response generated | |
| 4 | Verify response content | Explains no documents available | |

### Expected Behavior
- Agent responds: "I don't have any documents for this deal yet. Please upload some documents to the Data Room so I can help answer your questions."
- No crash, no hanging, no empty response
- Response is helpful and actionable
- Source citations section empty (not erroring)

### Evidence Required
- Screenshot of chat response explaining no documents

---

## EC-007: Very Long Chat (50+ Messages)

**Priority:** P1 (High)
**Estimated Time:** 10 minutes
**Dependencies:** Deal with processed document, patience

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Start chat with processed document | Chat ready | |
| 2 | Send 50+ messages (varied topics) | All messages processed | |
| 3 | Verify context maintained | References earlier topics | |
| 4 | Check for summarization | Memory summarization kicks in | |
| 5 | Ask about topic from message #5 | Agent remembers | |

### Expected Behavior
- Conversation history persists (Supabase-backed)
- LangGraph memory buffer summarizes after threshold (verify in `lib/agent/executor.ts` - look for `maxMessages` or summarization config)
- Agent maintains coherent context
- References earlier conversation topics correctly
- No performance degradation (response time stays <5s)

### Pre-Test Verification
- Check memory summarization threshold in `manda-app/lib/agent/executor.ts`

### Evidence Required
- Screenshot showing long conversation history
- Screenshot of agent referencing earlier topic

---

## EC-008: Rate Limit Simulation

**Priority:** P1 (High)
**Estimated Time:** 2 minutes
**Dependencies:** Deal with document

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open chat interface | Chat ready | |
| 2 | Send 10 rapid-fire messages (fast typing) | Messages queued | |
| 3 | Observe behavior | Graceful handling | |
| 4 | Check for error handling | User-friendly message if rate limited | |

### Expected Behavior
- E12.6 retry with exponential backoff handles rate limits
- If rate limited: Toast notification with retry option
- No crashes, no 500 errors exposed to user
- Messages eventually process after backoff

### Evidence Required
- Screenshot of any rate limit handling UI
- OR confirmation messages process normally

---

## EC-009: Network Failure During Upload

**Priority:** P1 (High)
**Estimated Time:** 3 minutes
**Dependencies:** Deal exists, sample document

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Start document upload | Progress indicator shown | |
| 2 | At ~50% progress, disable network | Upload fails | |
| 3 | Observe error handling | Clear error message | |
| 4 | Re-enable network | Connection restored | |
| 5 | Retry upload | Option available | |

### Expected Behavior
- XHR upload shows clear failure message
- Error: "Upload failed - please check your connection and try again"
- No partial files left in GCS
- Retry button available
- Document record cleaned up (no orphans)

### Evidence Required
- Screenshot of network error message
- Screenshot of retry option

---

## EC-010: Special Characters in Deal Name

**Priority:** P1 (High)
**Estimated Time:** 2 minutes
**Dependencies:** None

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to `/projects/new` | Wizard opens | |
| 2 | Enter project name: "Test & Co. (2024) - $10M+" | Accepts input | |
| 3 | Complete wizard | Deal created | |
| 4 | Verify deal name in dashboard | Displayed correctly | |
| 5 | Navigate to all tabs | All work with special chars | |

### Expected Behavior
- Special characters handled: & ' " ( ) - $ + % @
- Deal created successfully
- Name displays correctly everywhere (dashboard, sidebar, breadcrumbs)
- No encoding issues in URL or database
- Search finds deal by special-char name

### Evidence Required
- Screenshot of deal with special character name

---

## EC-011: Malformed Excel (Merged Cells, Hidden Sheets)

**Priority:** P1 (High)
**Estimated Time:** 3 minutes
**Dependencies:** Deal exists, complex Excel file

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Create Excel with: merged cells, hidden sheets, formulas | File ready | |
| 2 | Upload to Data Room | Upload completes | |
| 3 | Wait for processing | Parsed successfully | |
| 4 | Check extracted content | Visible data extracted | |
| 5 | Verify formulas preserved | Formula values captured | |

### Expected Behavior
- Excel parser (openpyxl) handles merged cells
- Hidden sheets NOT processed (only visible sheets)
- Formula VALUES extracted (not formulas themselves)
- Cell relationships maintained where possible
- No crashes on complex spreadsheets

### Evidence Required
- Screenshot of extracted findings from complex Excel
- Or error message if specific issue

---

## EC-012: Password-Protected PDF

**Priority:** P0 (Critical)
**Estimated Time:** 2 minutes
**Dependencies:** Deal exists, encrypted PDF

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Upload password-protected/encrypted PDF | Upload starts | |
| 2 | Wait for processing | Processing fails | |
| 3 | Check error message | Clear explanation shown | |
| 4 | Verify document status | Marked as failed with reason | |

### Expected Behavior
- E12.6 DocumentParsingError with reason: password_protected
- User-friendly message: "This file is password-protected. Please remove the password and upload again."
- Document marked failed in list with clear indicator
- No partial processing, no hanging

### Evidence Required
- Screenshot of password-protected error message

---

## EC-013: Timeout - Long Running Query

**Priority:** P1 (High)
**Estimated Time:** 2 minutes
**Dependencies:** Deal with large knowledge graph

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Navigate to Chat | Chat ready | |
| 2 | Ask complex question requiring graph traversal | Query sent | |
| 3 | Wait for response (up to 30s) | Response or timeout | |
| 4 | If timeout, verify message | Clear timeout message with retry option | |

### Expected Behavior
- Response within 30 seconds OR
- Timeout message: "This query is taking longer than expected. Please try again or rephrase your question."
- Retry option provided
- No hanging UI, no stuck loading state

### Evidence Required
- Screenshot of response OR timeout message

---

## EC-014: Graphiti/Neo4j Down

**Priority:** P0 (Critical)
**Estimated Time:** 3 minutes
**Dependencies:** Deal with documents

### Steps

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Stop Neo4j container: `docker stop neo4j` | Neo4j down | |
| 2 | Navigate to Chat | Chat loads | |
| 3 | Ask question | Response generated | |
| 4 | Verify graceful degradation | Vector search only mode | |
| 5 | Restart Neo4j: `docker start neo4j` | Neo4j restored | |

### Expected Behavior
- E12.6 graceful degradation kicks in
- Chat responds using vector search only
- Message: "I'm having trouble accessing some of my knowledge right now. I can still help with document search, but some features may be limited."
- No 500 errors exposed to user
- System recovers when Neo4j restored

### Evidence Required
- Screenshot of degraded mode message
- Screenshot of response using vector search only

---

## Test Data Preparation

### Required Test Files

| File | Description | How to Create |
|------|-------------|---------------|
| empty.pdf | 0-byte PDF | `touch empty.pdf` |
| large-cim.pdf | 500+ page PDF | Use real CIM or generate |
| scanned.pdf | Image-only PDF without text layer | Scan physical doc OR screenshot to PDF |
| german-financials.pdf | German financial statements | Download sample or use test doc |
| complex.xlsx | Merged cells, hidden sheets, formulas | Create manually in Excel |
| encrypted.pdf | Password-protected PDF | Save PDF with password in Acrobat/Preview |
| sample-*.pdf | 5 small PDFs for concurrent test | Copy sample docs |

### File Locations

Store test files in: `manda-app/e2e/fixtures/edge-cases/`

---

## Issue Tracker Template

### Issue Log Format

```markdown
## Issue: [ID]

**Test Case:** EC-XXX
**Severity:** Critical / High / Medium
**Status:** Open / In Progress / Fixed / Wont Fix

### Description
[What happened vs expected]

### Steps to Reproduce
1. ...
2. ...

### Actual Behavior
[What actually happened]

### Expected Behavior
[What should happen per test case]

### Evidence
[Screenshots, logs, error messages]

### Resolution
[How it was fixed, or why it won't be fixed]
```

---

## Test Execution Log Template

```markdown
## Test Execution: [DATE]

**Tester:** [NAME]
**Environment:** localhost
**Build:** [GIT_COMMIT_SHA]

### EC-001: Empty Document
- Start Time: [HH:MM]
- End Time: [HH:MM]
- Result: [PASS/FAIL]
- Actual Behavior: [Description]
- Issues: [Issue IDs if any]

### EC-002: Huge Document
...

### Summary
- Total Tests: 14
- Passed: [X]
- Failed: [X]
- Blocked: [X]

### Issues Found
| ID | Test | Severity | Description | Status |
|----|------|----------|-------------|--------|
| | | | | |
```

---

## Service Health Check Commands

```bash
# Neo4j
docker exec neo4j cypher-shell -u neo4j -p mandadev123 "RETURN 'healthy'"

# FastAPI
curl http://localhost:8000/health

# Next.js
curl -s http://localhost:3000 | grep -i title

# Stop Neo4j (for EC-014)
docker stop neo4j

# Start Neo4j
docker start neo4j
```

---

## Execution Order

**Execute P0 (Critical) tests first, then P1 (High):**

### P0 - Critical (Blockers)
1. EC-003: Scanned PDF (Image-Only)
2. EC-006: Chat with No Documents
3. EC-012: Password-Protected PDF
4. EC-014: Graphiti/Neo4j Down

### P1 - High (Important)
5. EC-001: Empty Document Upload
6. EC-002: Huge Document (500+ Pages)
7. EC-004: Non-English Document
8. EC-005: Concurrent Document Uploads
9. EC-007: Very Long Chat (50+ Messages)
10. EC-008: Rate Limit Simulation
11. EC-009: Network Failure During Upload
12. EC-010: Special Characters in Deal Name
13. EC-011: Malformed Excel
14. EC-013: Timeout - Long Running Query
