# Epic Technical Specification: Collaborative Knowledge Workflow

Date: 2025-11-28
Author: Development Team
Epic ID: E4
Status: Draft

---

## Overview

Epic 4 implements the Collaborative Knowledge Workflow - the analyst's primary workspace for reviewing, validating, and exploring extracted intelligence from M&A deal documents. This epic builds the Knowledge Explorer interface, which enables analysts to browse findings, detect contradictions, resolve conflicts, identify information gaps, and export intelligence for use in other tools.

The Knowledge Explorer is the critical bridge between automated document processing (Epic 3) and the conversational assistant (Epic 5). It provides visibility into what the system has learned, enables human validation of AI-extracted information, and maintains the accuracy of the knowledge base through contradiction detection and resolution workflows.

**Key User Capabilities:**
- Browse all extracted findings in table or card view with filtering and sorting
- Perform semantic search across findings using natural language
- Validate, reject, or edit findings inline with confidence adjustments
- View source attribution with document preview and navigation
- Detect and resolve contradictions between findings
- Identify information gaps against IRL requirements
- Export findings to CSV/Excel for external use

## Objectives and Scope

### In Scope (14 Stories)

| Story | Title | Priority | Status |
|-------|-------|----------|--------|
| E4.1 | Build Knowledge Explorer UI Main Interface | P0 | Done |
| E4.2 | Implement Semantic Search for Findings | P0 | Ready for Review |
| E4.3 | Implement Inline Finding Validation (Confirm/Reject/Edit) | P0 | Backlog |
| E4.4 | Build Card View Alternative for Findings | P1 | Backlog |
| E4.5 | Implement Source Attribution Links | P0 | Backlog |
| E4.6 | Build Contradictions View | P0 | Backlog |
| E4.7 | Detect Contradictions Using Neo4j | P0 | Backlog |
| E4.8 | Build Gap Analysis View | P1 | Backlog |
| E4.9 | Implement Finding Detail View with Full Context | P1 | Backlog |
| E4.10 | Implement Export Findings to CSV/Excel | P1 | Backlog |
| E4.11 | Implement Contradiction Detection and Flagging | P0 | Backlog |
| E4.12 | Build Bulk Actions for Finding Management | P1 | Backlog |
| E4.13 | Implement Export Findings Feature (Advanced) | P1 | Backlog |
| E4.14 | Build Real-Time Knowledge Graph Updates | P1 | Backlog |

*Note: E4.1 encompasses the full Knowledge Explorer page structure including tab navigation, Findings Browser with table view, and filter controls.*

### Out of Scope
- Knowledge Graph visualization (Phase 2)
- Real-time collaborative editing (multi-user)
- Chat-based finding capture (Epic 5 integration)
- Excel/Word notes upload parsing (requires separate file processor)

### Dependencies
- **Epic 3 Complete**: Document processing, LLM analysis, findings extraction must be operational
- **findings table**: Must contain `finding_type`, `domain`, `confidence`, `chunk_id` columns
- **document_chunks table**: Required for source attribution
- **Neo4j**: Required for contradiction detection (E4.7, E4.11)

## System Architecture Alignment

### Architecture Pattern: Next.js App Router + Server Components

```
┌─────────────────────────────────────────────────────────────┐
│                    Knowledge Explorer UI                      │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐│
│  │  Findings   │ │Contradictions│ │ Gap Analysis│ │ Export  ││
│  │   Browser   │ │    View     │ │    View     │ │ Actions ││
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘ └────┬────┘│
└─────────┼───────────────┼───────────────┼──────────────┼─────┘
          │               │               │              │
          ▼               ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API Routes (Next.js)                     │
│  /api/findings     /api/contradictions   /api/gaps          │
│  /api/findings/search  /api/findings/validate               │
└─────────────────────────────────────────────────────────────┘
          │                       │                    │
          ▼                       ▼                    ▼
┌──────────────────┐    ┌──────────────────┐   ┌──────────────┐
│     Supabase     │    │      Neo4j       │   │   OpenAI     │
│  (PostgreSQL +   │    │ (Graph + CONTRA- │   │ (Embeddings) │
│    pgvector)     │    │   DICTS edges)   │   │              │
└──────────────────┘    └──────────────────┘   └──────────────┘
```

### Component Hierarchy

```
/projects/[id]/knowledge-explorer/
├── page.tsx (Server Component - data fetching)
├── components/
│   ├── KnowledgeExplorerClient.tsx (Client - tab navigation)
│   ├── findings/
│   │   ├── FindingsBrowser.tsx (Table/Card container)
│   │   ├── FindingsTable.tsx (Table view)
│   │   ├── FindingCard.tsx (Card view)
│   │   ├── FindingFilters.tsx (Filter controls)
│   │   ├── FindingSearch.tsx (Semantic search input)
│   │   ├── FindingActions.tsx (Validate/Reject/Edit)
│   │   └── FindingDetailModal.tsx (Full context view)
│   ├── contradictions/
│   │   ├── ContradictionsView.tsx (Side-by-side layout)
│   │   ├── ContradictionCard.tsx (Comparison card)
│   │   └── ContradictionActions.tsx (Resolution actions)
│   ├── gaps/
│   │   ├── GapAnalysisView.tsx (Gap categories)
│   │   └── GapCard.tsx (Individual gap)
│   └── shared/
│       ├── SourceAttributionLink.tsx (Clickable source)
│       ├── ConfidenceBadge.tsx (Visual confidence)
│       ├── DomainTag.tsx (Domain badge)
│       └── ViewToggle.tsx (Table/Card switch)
```

## Detailed Design

### Services and Modules

#### 1. FindingsService (`lib/services/findings.ts`)

```typescript
interface FindingsService {
  // Query operations
  getFindings(dealId: string, filters: FindingFilters): Promise<Finding[]>
  getFindingById(id: string): Promise<FindingWithContext>
  searchFindings(dealId: string, query: string, limit?: number): Promise<Finding[]>

  // Mutation operations
  validateFinding(id: string, action: 'confirm' | 'reject'): Promise<Finding>
  updateFinding(id: string, updates: Partial<Finding>): Promise<Finding>

  // Statistics
  getFindingStats(dealId: string): Promise<FindingStats>
}

interface FindingFilters {
  documentId?: string
  domain?: FindingDomain[]
  findingType?: FindingType[]
  confidenceMin?: number
  confidenceMax?: number
  status?: 'pending' | 'validated' | 'rejected'
  sortBy?: 'confidence' | 'created_at' | 'domain'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}
```

#### 2. ContradictionsService (`lib/services/contradictions.ts`)

```typescript
interface ContradictionsService {
  // Query operations
  getContradictions(dealId: string, status?: ContradictionStatus): Promise<Contradiction[]>
  getContradictionById(id: string): Promise<ContradictionWithFindings>

  // Resolution operations
  resolveContradiction(id: string, resolution: ContradictionResolution): Promise<Contradiction>
  addNote(id: string, note: string): Promise<Contradiction>

  // Detection (called by job handler)
  detectContradictions(dealId: string): Promise<DetectionResult>
}

interface ContradictionResolution {
  action: 'accept_a' | 'accept_b' | 'investigate' | 'noted'
  note?: string
}
```

#### 3. GapAnalysisService (`lib/services/gap-analysis.ts`)

```typescript
interface GapAnalysisService {
  // IRL gap detection
  getIrlGaps(dealId: string): Promise<IrlGap[]>

  // Information gap detection (LLM-based)
  getInformationGaps(dealId: string): Promise<InformationGap[]>

  // Gap resolution
  resolveGap(gapId: string, resolution: GapResolution): Promise<Gap>
  addToIrl(gapId: string): Promise<void>
  addManualFinding(gapId: string, finding: ManualFinding): Promise<Finding>
}
```

#### 4. EmbeddingService (`lib/services/embeddings.ts`)

```typescript
interface EmbeddingService {
  generateEmbedding(text: string): Promise<number[]>
  semanticSearch(
    dealId: string,
    queryEmbedding: number[],
    limit: number
  ): Promise<SimilarityResult[]>
}
```

### Data Models and Contracts

#### Findings Table (Existing + New Columns)

```sql
-- Current schema from migrations
CREATE TABLE findings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    document_id uuid REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id uuid REFERENCES document_chunks(id) ON DELETE SET NULL,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    text text NOT NULL,
    source_document text,
    page_number int,
    confidence float CHECK (confidence >= 0 AND confidence <= 1),
    finding_type finding_type_enum DEFAULT 'fact',
    domain finding_domain_enum DEFAULT 'operational',
    embedding vector(3072),  -- OpenAI text-embedding-3-large (3072 dims)
    -- IMPORTANT: pgvector HNSW index limited to 2000 dims
    -- Use halfvec cast for indexing: USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
    -- See: https://github.com/pgvector/pgvector/issues/461
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now()
);

-- New migration required for E4
ALTER TABLE findings ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'pending';
ALTER TABLE findings ADD COLUMN IF NOT EXISTS validation_history jsonb DEFAULT '[]';

-- Status values: 'pending', 'validated', 'rejected'
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
```

#### Contradictions Table (New)

```sql
-- New migration: 00021_create_contradictions_table.sql
CREATE TABLE IF NOT EXISTS contradictions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deal_id uuid REFERENCES deals(id) ON DELETE CASCADE NOT NULL,
    finding_a_id uuid REFERENCES findings(id) ON DELETE CASCADE NOT NULL,
    finding_b_id uuid REFERENCES findings(id) ON DELETE CASCADE NOT NULL,
    confidence float CHECK (confidence >= 0 AND confidence <= 1),
    status varchar(20) DEFAULT 'unresolved',  -- unresolved, resolved, noted, investigating
    resolution varchar(20),  -- accept_a, accept_b, noted, investigating
    resolution_note text,
    detected_at timestamptz DEFAULT now(),
    resolved_at timestamptz,
    resolved_by uuid REFERENCES auth.users(id),
    metadata jsonb DEFAULT '{}'
);

CREATE INDEX idx_contradictions_deal_id ON contradictions(deal_id);
CREATE INDEX idx_contradictions_status ON contradictions(status);

-- RLS
ALTER TABLE contradictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contradictions_isolation ON contradictions
    FOR ALL USING (
        deal_id IN (SELECT id FROM deals WHERE user_id = auth.uid())
    );
```

#### TypeScript Interfaces

```typescript
// lib/types/findings.ts
export type FindingDomain = 'financial' | 'operational' | 'market' | 'legal' | 'technical'
export type FindingType = 'metric' | 'fact' | 'risk' | 'opportunity' | 'contradiction'
export type FindingStatus = 'pending' | 'validated' | 'rejected'

export interface Finding {
  id: string
  dealId: string
  documentId: string | null
  chunkId: string | null
  text: string
  sourceDocument: string | null
  pageNumber: number | null
  confidence: number | null
  findingType: FindingType
  domain: FindingDomain
  status: FindingStatus
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface FindingWithContext extends Finding {
  document: {
    id: string
    name: string
    filePath: string
  } | null
  chunk: {
    id: string
    content: string
    sheetName: string | null
    cellReference: string | null
    pageNumber: number | null
  } | null
  relatedFindings: Finding[]
  validationHistory: ValidationEvent[]
}

export interface ValidationEvent {
  action: 'validated' | 'rejected' | 'edited'
  previousValue?: string
  newValue?: string
  timestamp: string
  userId: string
}

// lib/types/contradictions.ts
export type ContradictionStatus = 'unresolved' | 'resolved' | 'noted' | 'investigating'

export interface Contradiction {
  id: string
  dealId: string
  findingAId: string
  findingBId: string
  confidence: number
  status: ContradictionStatus
  resolution: string | null
  resolutionNote: string | null
  detectedAt: string
  resolvedAt: string | null
}

export interface ContradictionWithFindings extends Contradiction {
  findingA: Finding
  findingB: Finding
}

// lib/types/gaps.ts
export type GapCategory = 'irl_missing' | 'information_gap' | 'incomplete_analysis'
export type GapPriority = 'high' | 'medium' | 'low'

export interface Gap {
  id: string
  dealId: string
  category: GapCategory
  description: string
  priority: GapPriority
  relatedIrlItemId?: string
  status: 'active' | 'resolved' | 'na'
  resolvedAt?: string
}
```

### APIs and Interfaces

#### REST API Routes

```typescript
// app/api/projects/[id]/findings/route.ts
GET    /api/projects/[id]/findings
       Query: documentId, domain[], type[], confidenceMin, confidenceMax,
              status, sortBy, sortOrder, page, limit
       Response: { findings: Finding[], total: number, page: number }

POST   /api/projects/[id]/findings
       Body: { text, domain, findingType, ... }  // Manual finding creation
       Response: Finding

// app/api/projects/[id]/findings/search/route.ts
POST   /api/projects/[id]/findings/search
       Body: { query: string, limit?: number }
       Response: { findings: Finding[], searchTime: number }

// app/api/projects/[id]/findings/[findingId]/route.ts
GET    /api/projects/[id]/findings/[findingId]
       Response: FindingWithContext

PATCH  /api/projects/[id]/findings/[findingId]
       Body: { text?, status? }
       Response: Finding

// app/api/projects/[id]/findings/[findingId]/validate/route.ts
POST   /api/projects/[id]/findings/[findingId]/validate
       Body: { action: 'confirm' | 'reject' }
       Response: Finding

// app/api/projects/[id]/contradictions/route.ts
GET    /api/projects/[id]/contradictions
       Query: status
       Response: { contradictions: ContradictionWithFindings[], total: number }

// app/api/projects/[id]/contradictions/[contradictionId]/resolve/route.ts
POST   /api/projects/[id]/contradictions/[contradictionId]/resolve
       Body: { action: 'accept_a' | 'accept_b' | 'investigate' | 'noted', note?: string }
       Response: Contradiction

// app/api/projects/[id]/gaps/route.ts
GET    /api/projects/[id]/gaps
       Response: { gaps: Gap[], irlGaps: number, infoGaps: number }

// app/api/projects/[id]/findings/export/route.ts
POST   /api/projects/[id]/findings/export
       Body: { format: 'csv' | 'xlsx', filters?: FindingFilters }
       Response: Binary file download
```

### Workflows and Sequencing

#### Finding Validation Flow

```
User clicks ✓ Confirm
    │
    ▼
┌─────────────────────────────┐
│ Optimistic UI Update        │
│ - Show green checkmark      │
│ - Update status to validated│
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ API: PATCH /findings/[id]   │
│ - status: 'validated'       │
│ - confidence: +5%           │
│ - Add to validation_history │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Supabase Update             │
│ - Update finding record     │
│ - Trigger updated_at        │
└─────────────────────────────┘
```

#### Contradiction Detection Flow (Job-Based)

```
Document Analysis Complete
    │
    ▼
┌─────────────────────────────┐
│ pg-boss: detect_contradictions │
│ - Triggered after analyze_doc  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Group Findings by Domain    │
│ - Financial findings        │
│ - Operational findings      │
│ - etc.                      │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ LLM Comparison (Gemini)     │
│ - Compare within domain     │
│ - Identify contradictions   │
│ - Return confidence score   │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ If confidence > 70%:        │
│ - Create Neo4j CONTRADICTS  │
│ - Insert contradictions row │
└─────────────────────────────┘
```

#### Semantic Search Flow

```
User enters search query
    │
    ▼
┌─────────────────────────────┐
│ Show loading indicator      │
│ - Debounce 300ms            │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ API: POST /findings/search  │
│ - Generate query embedding  │
│   (OpenAI text-embedding-3) │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ pgvector Similarity Search  │
│ - SELECT ... ORDER BY       │
│   embedding <=> $query_emb  │
│ - LIMIT 20                  │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ Return ranked results       │
│ - Include similarity score  │
│ - Hide loading indicator    │
└─────────────────────────────┘
```

## Non-Functional Requirements

### Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| Findings table load | < 500ms | Time to first contentful paint |
| Semantic search | < 3s | Query submission to results display |
| Inline validation | < 200ms | Click to UI update (optimistic) |
| Export 500 findings | < 10s | Export button to download complete |
| Pagination navigation | < 300ms | Page change to data display |

**Optimizations:**
- Server components for initial data fetch
- React Query for client-side caching
- Optimistic updates for mutations
- pgvector HNSW index with halfvec cast for similarity search (3072-dim embeddings)
- Debounced search input (300ms)

### Security

| Requirement | Implementation |
|-------------|----------------|
| Data isolation | RLS policies on all tables (user_id = auth.uid()) |
| API authentication | Supabase auth middleware on all routes |
| Input validation | Zod schemas for all API inputs |
| XSS prevention | React's built-in escaping, DOMPurify for rich text |
| CSRF protection | SameSite cookies, origin validation |

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| Error boundaries | React error boundaries per major section |
| Graceful degradation | Show cached data if API fails |
| Retry logic | 3 retries with exponential backoff for API calls |
| Empty states | Clear messaging for no findings/no contradictions |
| Loading states | Skeleton loaders for all data-dependent components |

### Observability

| Aspect | Implementation |
|--------|----------------|
| Client errors | Sentry integration for error tracking |
| API latency | Console logging with timing (dev), Vercel Analytics (prod) |
| Search analytics | Log search queries and result counts |
| Validation tracking | Log all validation actions with user_id |

## Dependencies and Integrations

### External Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| @supabase/supabase-js | ^2.84.0 | Database client |
| neo4j-driver | ^6.0.1 | Graph database for contradictions |
| lucide-react | ^0.554.0 | Icons |
| date-fns | ^4.1.0 | Date formatting |
| sonner | ^2.0.7 | Toast notifications |

### New Dependencies to Add

| Dependency | Purpose |
|------------|---------|
| @tanstack/react-table | DataTable component for Findings Browser |
| exceljs | Excel export functionality |
| csv-stringify | CSV export functionality |

### Internal Dependencies

| Module | Required By |
|--------|-------------|
| `lib/supabase/client` | All services |
| `lib/supabase/server` | Server components |
| `lib/neo4j/client` | ContradictionsService |
| `components/ui/*` | All UI components (shadcn/ui) |

## Acceptance Criteria (Authoritative)

### E4.1: Findings Browser Table View

```gherkin
Given I navigate to Knowledge Explorer
When the page loads
Then I see the Findings Browser in table view
And findings are displayed with columns: Finding, Source, Domain, Confidence, Status, Actions
And the table shows 50 items per page

Given I click a column header
When I sort by "Confidence"
Then findings are sorted high to low (toggle for low to high)

Given I use filters
When I select Domain: "Financial" and Confidence: ">80%"
Then only matching findings display
And the count updates
```

### E4.2: Semantic Search

```gherkin
Given I enter "revenue growth Q3" in search
When I press Enter
Then results appear within 3 seconds
And top 20 most relevant findings are displayed
And results are ranked by similarity

Given I clear the search
When I click X
Then all findings are displayed again
```

### E4.3: Inline Validation

```gherkin
Given I see a finding
When I click ✓ Confirm
Then status changes to "validated"
And confidence increases by 5%
And a green checkmark appears

Given I click ✗ Reject
Then status changes to "rejected"
And the finding is hidden from default view
And appears in "Rejected" filter
```

### E4.5: Source Attribution

```gherkin
Given a finding has source "financial_model.xlsx, Sheet 'P&L', Cell B15"
When I click the source link
Then a document preview modal opens
And navigates to the correct sheet
And highlights cell B15
```

### E4.6: Contradictions View

```gherkin
Given contradictions exist
When I navigate to Contradictions tab
Then I see side-by-side comparison cards
And each shows Finding A vs Finding B

Given I click "Accept A"
Then Finding A is marked validated
And Finding B is marked rejected
And the contradiction status is "resolved"
```

## Traceability Mapping

| Story | Functional Requirement | UX Section | Database Table |
|-------|----------------------|------------|----------------|
| E4.1 | FR-KB-003 | 5.3 Findings Browser | findings |
| E4.2 | FR-KB-003, FR-CONV-002 | 5.3 Findings Browser | findings (pgvector) |
| E4.3 | FR-KB-001 | 5.3 Inline Validation | findings |
| E4.4 | FR-KB-003 | 5.3 Card View | findings |
| E4.5 | FR-KB-002 | 10.2 Source Citation | document_chunks |
| E4.6 | FR-KB-004, NFR-ACC-003 | 5.3 Contradictions View | contradictions |
| E4.7 | NFR-ACC-003 | - | contradictions, Neo4j |
| E4.8 | FR-KB-004 | 5.3 Gap Analysis | irl_items, findings |
| E4.9 | FR-KB-001, FR-KB-002 | 5.3 Finding Detail | findings, document_chunks |
| E4.10 | NFR-INT-002 | - | findings |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large datasets (10K+ findings) may slow pgvector search | Medium | Pre-compute embeddings, use HNSW index with halfvec cast (required for 3072-dim embeddings > 2000-dim limit) |
| Neo4j latency for contradiction queries | Medium | Cache contradiction counts, batch queries |
| Excel export memory issues for large exports | Low | Stream CSV, paginate Excel exports |

### Assumptions

1. **Findings exist**: Epic 3 document processing has populated findings table
2. **Neo4j operational**: Graph database is available for contradiction detection
3. **OpenAI API available**: For generating query embeddings in semantic search
4. **Single user per deal**: RLS policies assume one user owns all findings in a deal

### Open Questions

1. **Q**: Should validation history include user identity for multi-user support?
   **A**: Yes, store user_id in validation_history for audit trail.

2. **Q**: What happens to a contradiction when one of its findings is deleted?
   **A**: CASCADE delete the contradiction record.

3. **Q**: Should semantic search filter by current filters or search all?
   **A**: Search respects current document/domain filters for relevance.

## Test Strategy Summary

### Unit Tests

| Component | Test Focus |
|-----------|------------|
| FindingsService | Filter application, pagination, sorting |
| ContradictionsService | Resolution logic, status transitions |
| EmbeddingService | Mock OpenAI responses, error handling |
| UI Components | Render states, click handlers, accessibility |

### Integration Tests

| Scenario | Scope |
|----------|-------|
| Findings API | Full CRUD with Supabase |
| Semantic search | Embedding generation + pgvector query |
| Export flow | Filter application + file generation |
| Contradiction detection | LLM comparison + Neo4j + Supabase |

### E2E Tests (Playwright)

| User Flow | Priority |
|-----------|----------|
| Browse findings with filters | P0 |
| Validate a finding | P0 |
| Resolve a contradiction | P0 |
| Semantic search | P0 |
| Export to CSV | P1 |

### Test Data Requirements

- 50+ findings across multiple domains
- 5+ contradictions with varying confidence
- 10+ IRL items with partial document coverage
- Multiple documents with overlapping content
