# Epic Technical Specification: Q&A Co-Creation Workflow

Date: 2025-12-09
Author: Max
Epic ID: E8
Status: Draft

---

## Overview

Epic 8 delivers a collaborative Q&A management system that enables M&A analysts to build, organize, and manage question lists sent to clients for answers. Unlike AI-generated answers, the Q&A list captures questions that CANNOT be answered from available documents - the AI's role is to identify gaps and inconsistencies during document analysis and suggest Q&A items when the knowledge base cannot resolve an issue.

The system supports:
- **Conversational Q&A creation**: AI suggests questions during document analysis when it detects gaps/inconsistencies that cannot be resolved through discussion
- **Real-time collaborative editing**: Multiple team members can edit Q&A items with optimistic locking and conflict resolution
- **Excel round-trip workflow**: Export Q&A list to Excel for client distribution, import client responses with intelligent matching
- **Finding-to-Q&A linking**: One-click creation of Q&A items from inconsistency findings with source attribution

This epic fulfills PRD functional requirements FR-QA-001 through FR-QA-004 and FR-COLLAB-003, enabling the analyst workflow: document analysis → gap identification → Q&A suggestion → client distribution → answer import → knowledge base update.

## Objectives and Scope

### Objectives

1. Enable analysts to create and manage Q&A lists for client clarification
2. Integrate AI-suggested questions into the conversational workflow
3. Provide real-time collaborative editing with conflict resolution
4. Support Excel-based client workflow (export questions → import answers)
5. Link Q&A items to source findings for traceability
6. Extend agent tool count from 13 to 20 (7 new Q&A tools)

### In-Scope

- `qa_items` database table with optimistic locking via `updated_at`
- CRUD API endpoints for Q&A management
- Q&A Management UI with inline editing and category grouping
- 7 new agent tools for Q&A operations
- Conversational Q&A suggestion flow (AI detects gap → discusses → suggests Q&A)
- Finding-to-Q&A quick-add from Knowledge Explorer
- Excel export with category grouping and professional formatting
- Excel import with exact match, fuzzy match (>90% similarity), and new item detection
- Conflict resolution UI (Keep Mine / Keep Theirs / Merge)

### Out-of-Scope

- Real-time WebSocket sync for collaborative editing (using optimistic locking instead)
- Auto-status updates from document uploads (IRL has manual tracking)
- Q&A templates library (Phase 2)
- Q&A approval workflows (Phase 2)
- Integration with external Q&A systems (Phase 2)

## System Architecture Alignment

### Architecture Integration

Epic 8 extends the existing platform architecture defined in `manda-architecture.md v3.0`:

**Data Layer:**
- New `qa_items` table in PostgreSQL (Supabase) with RLS policies
- Uses existing `findings` table for source attribution via `source_finding_id` FK

**API Layer:**
- FastAPI endpoints at `/api/deals/{id}/qa/*` following existing patterns
- Next.js API routes proxying to FastAPI backend

**Agent Layer:**
- 7 new tools added to LangChain agent (tools #8-14 become Q&A tools, renumbering existing)
- Total agent tools: 19 chat + 3 CIM = 22 (was 16 + 3 = 19)
- Tools use existing Pydantic validation patterns

**Frontend:**
- New route: `/projects/[id]/qa` for Q&A management
- Extends Knowledge Explorer with "Add to Q&A" action on findings

### Key Architectural Decisions

1. **No status field**: Q&A item status derived from `date_answered` (NULL = pending, NOT NULL = answered)
2. **Optimistic locking**: Conflict detection via `updated_at` timestamp in WHERE clause
3. **Excel-first workflow**: Client interaction via Excel round-trip (not web portal)
4. **Agent-driven suggestion**: AI suggests Q&A only when KB cannot resolve gaps

## Detailed Design

### Services and Modules

| Service/Module | Responsibility | Inputs | Outputs |
|---------------|---------------|--------|---------|
| `lib/services/qa.ts` | Q&A CRUD operations, conflict detection | QAItem data, updated_at | QAItem, conflict errors |
| `lib/services/qa-export.ts` | Excel generation with formatting | QAItem[], filters | Excel file buffer |
| `lib/services/qa-import.ts` | Excel parsing, fuzzy matching | Excel file | ImportPreview, matched items |
| `lib/api/qa.ts` | Client-side API functions | Params | API responses |
| `app/api/deals/[id]/qa/*` | Next.js API routes | HTTP requests | HTTP responses |
| `manda-processing/src/tools/qa_tools.py` | Agent tool implementations | Tool inputs | Tool outputs |
| `components/qa/*` | React UI components | Props, state | UI rendering |

### Data Models and Contracts

#### Database Schema

```sql
-- Q&A items are questions sent to the CLIENT to answer (not AI-generated answers)
-- Used during document analysis when gaps/inconsistencies cannot be resolved from knowledge base
CREATE TABLE qa_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'Financials', 'Legal', 'Operations', 'Market', 'Technology', 'HR'
  priority TEXT DEFAULT 'medium',  -- 'high', 'medium', 'low'
  answer TEXT,  -- Client's response (NULL until answered)
  comment TEXT,  -- Optional notes from client or team
  source_finding_id UUID REFERENCES findings(id),  -- Link to finding that triggered Q&A
  created_by UUID REFERENCES auth.users(id),
  date_added TIMESTAMPTZ DEFAULT NOW(),
  date_answered TIMESTAMPTZ,  -- NULL = pending, NOT NULL = answered (replaces status field)
  updated_at TIMESTAMPTZ DEFAULT NOW(),  -- Used for optimistic locking on concurrent edits

  CONSTRAINT valid_category CHECK (category IN ('Financials', 'Legal', 'Operations', 'Market', 'Technology', 'HR')),
  CONSTRAINT valid_priority CHECK (priority IN ('high', 'medium', 'low'))
);

CREATE INDEX idx_qa_items_deal ON qa_items(deal_id);
CREATE INDEX idx_qa_items_category ON qa_items(category);
CREATE INDEX idx_qa_items_pending ON qa_items(deal_id) WHERE date_answered IS NULL;
CREATE INDEX idx_qa_items_source_finding ON qa_items(source_finding_id);

-- RLS Policies
ALTER TABLE qa_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view Q&A items for their deals"
  ON qa_items FOR SELECT
  USING (deal_id IN (
    SELECT id FROM deals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can insert Q&A items for their deals"
  ON qa_items FOR INSERT
  WITH CHECK (deal_id IN (
    SELECT id FROM deals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can update Q&A items for their deals"
  ON qa_items FOR UPDATE
  USING (deal_id IN (
    SELECT id FROM deals WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can delete Q&A items for their deals"
  ON qa_items FOR DELETE
  USING (deal_id IN (
    SELECT id FROM deals WHERE user_id = auth.uid()
  ));
```

#### TypeScript Types

```typescript
// lib/types/qa.ts

export type QACategory = 'Financials' | 'Legal' | 'Operations' | 'Market' | 'Technology' | 'HR';
export type QAPriority = 'high' | 'medium' | 'low';

export interface QAItem {
  id: string;
  deal_id: string;
  question: string;
  category: QACategory;
  priority: QAPriority;
  answer: string | null;
  comment: string | null;
  source_finding_id: string | null;
  created_by: string;
  date_added: string;
  date_answered: string | null;
  updated_at: string;
}

export interface CreateQAItemInput {
  question: string;
  category: QACategory;
  priority: QAPriority;
  source_finding_id?: string;
  comment?: string;
}

export interface UpdateQAItemInput {
  question?: string;
  category?: QACategory;
  priority?: QAPriority;
  answer?: string;
  comment?: string;
  date_answered?: string;
  updated_at: string; // Required for optimistic locking
}

export interface QAConflictError {
  type: 'conflict';
  currentItem: QAItem;
  yourChanges: Partial<QAItem>;
}

export interface QAImportPreview {
  exactMatches: Array<{ existing: QAItem; imported: ImportedQARow; }>;
  fuzzyMatches: Array<{ existing: QAItem; imported: ImportedQARow; similarity: number; }>;
  newItems: ImportedQARow[];
  missingItems: QAItem[]; // In system but not in Excel
}

export interface ImportedQARow {
  question: string;
  priority: string;
  answer: string | null;
  dateAnswered: string | null;
  category?: string;
}
```

#### Pydantic Models (Agent Tools)

```python
# manda-processing/src/models/qa.py

from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime

QACategory = Literal['Financials', 'Legal', 'Operations', 'Market', 'Technology', 'HR']
QAPriority = Literal['high', 'medium', 'low']

class AddQAItemInput(BaseModel):
    """Input for add_qa_item tool"""
    question: str = Field(..., min_length=10, description="Question for client")
    category: QACategory = Field(..., description="Question category")
    priority: QAPriority = Field(default='medium', description="Priority level")
    source_finding_id: Optional[str] = Field(None, description="ID of related finding")

class AddQAItemOutput(BaseModel):
    """Output from add_qa_item tool"""
    id: str
    message: str

class AddQAItemsBatchInput(BaseModel):
    """Input for add_qa_items_batch tool"""
    items: list[AddQAItemInput] = Field(..., min_items=1, max_items=50)

class GetQASummaryOutput(BaseModel):
    """Output from get_qa_summary tool (lightweight for context efficiency)"""
    total: int
    pending: int
    answered: int
    by_category: dict[str, int]
    by_priority: dict[str, int]

class GetQAItemsInput(BaseModel):
    """Input for get_qa_items tool"""
    category: Optional[QACategory] = None
    priority: Optional[QAPriority] = None
    answered_only: bool = False
    pending_only: bool = False
    limit: int = Field(default=20, ge=1, le=100)

class UpdateQAItemInput(BaseModel):
    """Input for update_qa_item tool"""
    id: str
    question: Optional[str] = None
    category: Optional[QACategory] = None
    priority: Optional[QAPriority] = None
    comment: Optional[str] = None

class SuggestQAFromFindingInput(BaseModel):
    """Input for suggest_qa_from_finding tool"""
    finding_id: str = Field(..., description="ID of the finding to suggest Q&A from")

class SuggestQAFromFindingOutput(BaseModel):
    """Output from suggest_qa_from_finding tool"""
    suggested_question: str
    suggested_category: QACategory
    suggested_priority: QAPriority
    finding_text: str
    message: str
```

### APIs and Interfaces

#### REST API Endpoints

| Method | Path | Description | Request Body | Response |
|--------|------|-------------|--------------|----------|
| GET | `/api/deals/{id}/qa` | List Q&A items with filters | Query params | QAItem[] |
| POST | `/api/deals/{id}/qa` | Create Q&A item | CreateQAItemInput | QAItem |
| GET | `/api/deals/{id}/qa/{itemId}` | Get single Q&A item | - | QAItem |
| PUT | `/api/deals/{id}/qa/{itemId}` | Update Q&A item (with locking) | UpdateQAItemInput | QAItem or QAConflictError |
| DELETE | `/api/deals/{id}/qa/{itemId}` | Delete Q&A item | - | 204 No Content |
| GET | `/api/deals/{id}/qa/export` | Export to Excel | Query params (filters) | Excel file |
| POST | `/api/deals/{id}/qa/import` | Import from Excel | FormData (file) | QAImportPreview |
| POST | `/api/deals/{id}/qa/import/confirm` | Confirm import | ImportConfirmation | QAItem[] |
| GET | `/api/deals/{id}/qa/summary` | Get summary stats | - | QASummary |

#### Query Parameters for GET /qa

```typescript
interface QAListParams {
  category?: QACategory;
  priority?: QAPriority;
  status?: 'pending' | 'answered' | 'all';
  sort?: 'priority' | 'date_added' | 'category';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

#### Error Responses

```typescript
// 409 Conflict - Optimistic locking failure
{
  error: "conflict",
  message: "Item was modified by another user",
  currentItem: QAItem,
  yourChanges: Partial<QAItem>
}

// 400 Bad Request - Validation error
{
  error: "validation",
  message: "Invalid category: 'Marketing' is not a valid category",
  field: "category"
}

// 404 Not Found
{
  error: "not_found",
  message: "Q&A item not found"
}
```

### Workflows and Sequencing

#### Conversational Q&A Suggestion Flow

```
User: "What's the customer churn rate?"
  ↓
Agent: query_knowledge_base("customer churn rate")
  ↓
Agent: [No relevant findings found]
  ↓
Agent: "I couldn't find churn rate data in the uploaded documents.
        This seems like important information for the deal analysis.
        Should I add this to your Q&A list for the client?"
  ↓
User: "Yes, add it"
  ↓
Agent: add_qa_item(
  question="What is the historical customer churn rate (monthly/annual) for the past 3 years?",
  category="Operations",
  priority="high"
)
  ↓
Agent: "Added to Q&A list: 'What is the historical customer churn rate...'
        under Operations category (High priority).
        You now have 23 questions in your Q&A list."
```

#### Excel Round-Trip Workflow

```
1. Analyst exports Q&A list
   POST /api/deals/{id}/qa/export?status=pending
   ↓
   Returns: Company_QA_List_2025-12-09.xlsx

2. Client fills in answers in Excel

3. Analyst imports answered Excel
   POST /api/deals/{id}/qa/import
   Body: FormData with Excel file
   ↓
   Returns: QAImportPreview
   {
     exactMatches: 18 items (auto-merge),
     fuzzyMatches: 3 items (need confirmation),
     newItems: 2 items (client added questions),
     missingItems: 0 items
   }

4. Analyst reviews and confirms
   POST /api/deals/{id}/qa/import/confirm
   Body: {
     mergeExact: true,
     fuzzyMatchDecisions: [{id: "...", action: "merge"}, ...],
     importNewItems: true
   }
   ↓
   Returns: Updated QAItem[]
```

#### Optimistic Locking Flow

```
1. User A loads Q&A item (updated_at: "2025-12-09T10:00:00Z")
2. User B loads same item (updated_at: "2025-12-09T10:00:00Z")
3. User B saves changes (updated_at in request: "2025-12-09T10:00:00Z")
   → Success, item updated_at now "2025-12-09T10:01:00Z"
4. User A saves changes (updated_at in request: "2025-12-09T10:00:00Z")
   → 409 Conflict: updated_at doesn't match current value
   → UI shows conflict resolution modal:
     - Keep Mine: Force save with User A's changes
     - Keep Theirs: Reload with User B's changes
     - Merge: Manual merge of both changes
```

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Q&A list load time | < 500ms | 95th percentile for 100 items |
| Create/Update latency | < 200ms | API response time |
| Excel export | < 3s | For up to 500 items |
| Excel import parsing | < 5s | For up to 500 rows |
| Fuzzy matching | < 2s | Levenshtein on 500 items |

### Security

- RLS policies enforce deal-level isolation
- `created_by` tracked for audit trail
- Input validation on all API endpoints (Zod on frontend, Pydantic on backend)
- File upload validation for Excel import (MIME type, size limit 10MB)
- Rate limiting: 100 requests/minute per user on Q&A endpoints

### Reliability/Availability

- Optimistic locking prevents silent overwrites
- Transaction isolation for import operations
- Rollback on partial import failure
- Idempotent import with deduplication

### Observability

- Log all Q&A CRUD operations with user_id, deal_id
- Track import/export events with item counts
- Monitor conflict resolution frequency
- Alert on high conflict rates (>10% of updates)

## Dependencies and Integrations

### New Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `exceljs` | ^4.4.0 | Excel generation and parsing (already installed from E4) |
| `fast-levenshtein` | ^3.0.0 | Fuzzy string matching for import |

### Existing Integrations

| System | Integration Point |
|--------|-------------------|
| Supabase PostgreSQL | `qa_items` table with RLS |
| LangChain Agent | 7 new tools added to existing agent |
| Knowledge Explorer | "Add to Q&A" button on findings |
| Findings table | FK relationship via `source_finding_id` |

### Migration Path

1. Create `qa_items` table (Migration 00035)
2. Add RLS policies
3. Regenerate Supabase types (`npm run db:types`)
4. Deploy agent tool updates to manda-processing

## Acceptance Criteria (Authoritative)

### E8.1: Q&A Data Model and CRUD API

| AC ID | Criteria | Testable Statement |
|-------|----------|-------------------|
| AC-8.1.1 | Create Q&A item | POST /qa with valid input returns 201 with QAItem |
| AC-8.1.2 | Read Q&A items | GET /qa returns list filtered by query params |
| AC-8.1.3 | Update with valid timestamp | PUT /qa/{id} with current updated_at succeeds |
| AC-8.1.4 | Update with stale timestamp | PUT /qa/{id} with old updated_at returns 409 |
| AC-8.1.5 | Delete Q&A item | DELETE /qa/{id} returns 204 |
| AC-8.1.6 | RLS enforcement | Users cannot access other users' Q&A items |

### E8.2: Q&A Management UI

| AC ID | Criteria | Testable Statement |
|-------|----------|-------------------|
| AC-8.2.1 | Table rendering | Q&A items display in table with category grouping |
| AC-8.2.2 | Inline editing | Click to edit question, blur saves |
| AC-8.2.3 | Priority badges | High=red, Medium=yellow, Low=green badges display |
| AC-8.2.4 | Conflict modal | 409 response triggers conflict resolution modal |
| AC-8.2.5 | Conflict resolution | Keep Mine/Theirs/Merge options function correctly |
| AC-8.2.6 | Refresh data | Refresh button reloads Q&A list |

### E8.3: Agent Tool - add_qa_item()

| AC ID | Criteria | Testable Statement |
|-------|----------|-------------------|
| AC-8.3.1 | Tool invocation | Agent can call add_qa_item with valid parameters |
| AC-8.3.2 | Validation | Invalid category returns error, no item created |
| AC-8.3.3 | Source linking | source_finding_id correctly links to finding |
| AC-8.3.4 | Response format | Tool returns lightweight confirmation message |

### E8.4: Conversational Q&A Flow

| AC ID | Criteria | Testable Statement |
|-------|----------|-------------------|
| AC-8.4.1 | Gap detection | AI detects when KB cannot answer query |
| AC-8.4.2 | Q&A suggestion | AI suggests adding to Q&A list conversationally |
| AC-8.4.3 | User confirmation | Q&A created only after user confirms |
| AC-8.4.4 | Question drafting | AI drafts question text from conversation context |

### E8.5: Finding-to-Q&A Quick-Add

| AC ID | Criteria | Testable Statement |
|-------|----------|-------------------|
| AC-8.5.1 | Add button | Inconsistency findings show "Add to Q&A" button |
| AC-8.5.2 | Pre-drafted question | Modal opens with pre-drafted question |
| AC-8.5.3 | Category mapping | Category pre-selected based on finding domain |
| AC-8.5.4 | Source linking | Created Q&A item has source_finding_id set |
| AC-8.5.5 | Visual indicator | Finding shows "Q&A exists" when linked |

### E8.6: Excel Export

| AC ID | Criteria | Testable Statement |
|-------|----------|-------------------|
| AC-8.6.1 | File generation | GET /export returns valid .xlsx file |
| AC-8.6.2 | Column structure | Columns: Question, Priority, Answer, Date Answered |
| AC-8.6.3 | Category grouping | Rows grouped by category with section headers |
| AC-8.6.4 | Filter support | Filters apply before export |
| AC-8.6.5 | Filename format | File named {company}_QA_List_{date}.xlsx |

### E8.7: Excel Import

| AC ID | Criteria | Testable Statement |
|-------|----------|-------------------|
| AC-8.7.1 | File parsing | POST /import parses Excel and returns preview |
| AC-8.7.2 | Exact matching | Questions with exact text match auto-identified |
| AC-8.7.3 | Fuzzy matching | Questions with >90% similarity flagged for review |
| AC-8.7.4 | New item detection | Questions not in system identified as new |
| AC-8.7.5 | Confirmation flow | /import/confirm merges approved items |
| AC-8.7.6 | Answer population | Merged items have answer and date_answered set |

## Traceability Mapping

| AC ID | Spec Section | Component(s) | Test Idea |
|-------|--------------|--------------|-----------|
| AC-8.1.1 | Data Models | qa.ts, API routes | POST with valid data returns 201 |
| AC-8.1.2 | APIs | API routes | GET with filters returns correct subset |
| AC-8.1.3 | Workflows | qa.ts service | Update with fresh timestamp succeeds |
| AC-8.1.4 | Workflows | qa.ts service | Update with stale timestamp returns 409 |
| AC-8.1.5 | APIs | API routes | DELETE returns 204, item gone |
| AC-8.1.6 | Data Models | RLS policies | Cross-user access returns 404 |
| AC-8.2.1 | Services | QATable component | Render snapshot test |
| AC-8.2.2 | Workflows | QAInlineEdit | Blur triggers API call |
| AC-8.2.3 | Services | PriorityBadge | Badge color matches priority |
| AC-8.2.4 | Workflows | QATable | 409 response shows modal |
| AC-8.2.5 | Workflows | ConflictModal | Each option triggers correct action |
| AC-8.2.6 | Services | QATable | Refresh button refetches data |
| AC-8.3.1 | Agent Tools | add_qa_item tool | Tool callable with valid input |
| AC-8.3.2 | Agent Tools | add_qa_item tool | Invalid enum rejected |
| AC-8.3.3 | Agent Tools | add_qa_item tool | FK constraint enforced |
| AC-8.3.4 | Agent Tools | add_qa_item tool | Response is concise string |
| AC-8.4.1 | Workflows | Agent prompts | KB miss triggers suggestion |
| AC-8.4.2 | Workflows | Agent prompts | Suggestion phrased as question |
| AC-8.4.3 | Workflows | Agent flow | No tool call without "yes" |
| AC-8.4.4 | Workflows | Agent prompts | Question incorporates context |
| AC-8.5.1 | Services | FindingCard | Button renders for inconsistencies |
| AC-8.5.2 | Workflows | AddToQAModal | Modal pre-fills question |
| AC-8.5.3 | Workflows | AddToQAModal | Domain → Category mapping |
| AC-8.5.4 | Data Models | qa.ts service | FK populated on create |
| AC-8.5.5 | Services | FindingCard | Badge shows when Q&A exists |
| AC-8.6.1 | Services | qa-export.ts | File buffer is valid xlsx |
| AC-8.6.2 | Services | qa-export.ts | Headers match spec |
| AC-8.6.3 | Services | qa-export.ts | Category rows grouped |
| AC-8.6.4 | APIs | export route | Filters applied |
| AC-8.6.5 | Services | qa-export.ts | Filename pattern correct |
| AC-8.7.1 | Services | qa-import.ts | Excel parsed to preview |
| AC-8.7.2 | Services | qa-import.ts | Exact matches identified |
| AC-8.7.3 | Services | qa-import.ts | 91% match flagged fuzzy |
| AC-8.7.4 | Services | qa-import.ts | Unknown questions flagged new |
| AC-8.7.5 | APIs | import/confirm route | Approved items merged |
| AC-8.7.6 | Services | qa-import.ts | date_answered set on merge |

## Risks, Assumptions, Open Questions

### Risks

| ID | Risk | Severity | Mitigation |
|----|------|----------|------------|
| R1 | High conflict rate with multiple editors | Medium | Show "last edited by" indicator, add real-time sync in Phase 2 |
| R2 | Fuzzy matching false positives | Low | 90% threshold conservative, require confirmation |
| R3 | Large Excel import performance | Low | Batch processing, streaming parse |
| R4 | Agent suggests too many Q&A items | Medium | Rate limit suggestions, require user confirmation |

### Assumptions

| ID | Assumption |
|----|------------|
| A1 | Client Excel workflow is acceptable (vs. web portal) |
| A2 | 6 categories cover all M&A Q&A needs |
| A3 | Optimistic locking sufficient without real-time sync |
| A4 | Q&A items don't need version history (no edits audit) |

### Open Questions

| ID | Question | Owner | Deadline |
|----|----------|-------|----------|
| Q1 | Should we add Q&A templates for common deal types? | PM | Post-E8 |
| Q2 | Need approval workflow before export to client? | PM | Post-E8 |
| Q3 | Should agent auto-suggest Q&A or always ask first? | PM | Story E8.4 |

## Test Strategy Summary

### Test Levels

| Level | Framework | Coverage Focus |
|-------|-----------|----------------|
| Unit | Vitest | Service functions, utility functions |
| Component | React Testing Library | UI components, interactions |
| Integration | Vitest + Supabase | API routes, database operations |
| E2E | Playwright | Critical flows: create, edit, export, import |

### Test Coverage Targets

- Unit tests: 85% coverage on services
- Component tests: All interactive components
- Integration tests: All API endpoints
- E2E tests: Happy path + conflict resolution

### Critical Test Scenarios

1. **Optimistic locking conflict**: Two users edit same item → conflict modal → resolution
2. **Excel round-trip**: Export → modify → import → verify data integrity
3. **Fuzzy matching accuracy**: Test with 85%, 90%, 95% similarity strings
4. **Agent Q&A flow**: Simulate KB miss → suggestion → confirmation → creation
5. **Finding-to-Q&A link**: Create Q&A from finding → verify FK → check indicator

### Test Data

- Use existing test project with findings for source linking
- Create 50+ Q&A items across all categories for list testing
- Prepare Excel files with exact, fuzzy, and new items for import testing