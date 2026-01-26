# Story 4.9: Implement Finding Detail View with Full Context

Status: done

## Story

As an **M&A analyst**,
I want **to see full context for a finding in a dedicated detail view**,
so that **I can understand it deeply, see all related information, and verify its accuracy before making decisions**.

## Acceptance Criteria

1. **AC1: Detail View Trigger**
   - Clicking on a finding row in table view opens the detail view
   - Clicking on a finding card in card view opens the detail view
   - Detail view opens as a slide-out panel (Sheet) from the right
   - URL updates to include finding ID for deep linking (`?findingId=xxx`)
   - Loading skeleton shown while fetching full context

2. **AC2: Finding Text and Metadata Display**
   - Full finding text displayed prominently at the top
   - Finding type badge (Metric, Fact, Risk, Opportunity, Contradiction)
   - Domain badge (Financial, Operational, Market, Legal, Technical)
   - Confidence score with visual bar and percentage
   - Status badge (Pending, Validated, Rejected)
   - Created date and last updated timestamp
   - User who created the finding (if available from metadata)

3. **AC3: Confidence Reasoning Display**
   - "Confidence Reasoning" section with explanation from LLM analysis
   - Pull reasoning from `metadata.confidence_reasoning` if available
   - Display as expandable section if text is long (>200 chars)
   - Show "No reasoning available" placeholder if not present
   - Format reasoning in readable paragraphs

4. **AC4: Source Attribution with Preview**
   - Clickable source attribution link (using existing SourceAttributionLink)
   - Document preview integrated (DocumentPreviewModal)
   - Show: document name, sheet name (for Excel), cell reference or page number
   - "Open in Data Room" button to navigate to document in Data Room
   - Fallback message if document preview unavailable

5. **AC5: Related Findings Section**
   - "Related Findings" section showing findings on the same topic/domain
   - Use semantic similarity to find related findings (top 5)
   - Each related finding shows: text snippet (truncated), confidence, source
   - Click on related finding opens its detail view (navigation)
   - Empty state: "No related findings found"

6. **AC6: Validation History**
   - "History" section showing all validation events
   - Each event shows: action type, timestamp, user (if available)
   - For edits: show previous value and new value (diff view)
   - Sorted chronologically (newest first)
   - Empty state: "No validation history"

7. **AC7: Actions in Detail View**
   - Validate/Reject/Edit buttons available in detail view header
   - Same functionality as inline actions (reuse FindingActions component)
   - Changes reflect immediately in the detail view
   - Toast notifications for success/error
   - Close button (X) and Escape key to dismiss

8. **AC8: Accessibility and Keyboard Navigation**
   - Panel has proper ARIA role="dialog" and aria-modal="true"
   - Focus trapped within panel when open
   - Escape key closes the panel
   - Screen reader announces panel opening
   - All interactive elements keyboard accessible

## Tasks / Subtasks

- [x] **Task 1: Create FindingDetailPanel Component** (AC: 1, 2, 7, 8)
  - [x] Create `components/knowledge-explorer/findings/FindingDetailPanel.tsx`
  - [x] Use shadcn/ui Sheet component for slide-out panel
  - [x] Implement header with finding type/domain badges and close button
  - [x] Add FindingActions in header for validate/reject/edit
  - [x] Implement loading skeleton state
  - [x] Add ARIA attributes and keyboard handling

- [x] **Task 2: Create Finding Detail API Endpoint** (AC: 2, 3, 4, 5, 6)
  - [x] Enhanced existing `app/api/projects/[id]/findings/[findingId]/route.ts` GET handler
  - [x] Return FindingWithContext with full metadata
  - [x] Include confidence_reasoning from metadata
  - [x] Join with documents table for document info
  - [x] Join with document_chunks for chunk content
  - [x] Fetch validation_history from finding record

- [x] **Task 3: Implement Related Findings Query** (AC: 5)
  - [x] Added `getFindingById` function to findings API client
  - [x] Use pgvector similarity search via match_findings RPC
  - [x] Limit to top 5 related findings (exclude current finding)
  - [x] Filter to same project
  - [x] Return similarity score with findings

- [x] **Task 4: Build ConfidenceReasoning Component** (AC: 3)
  - [x] Create `components/knowledge-explorer/findings/ConfidenceReasoning.tsx`
  - [x] Display confidence bar with percentage
  - [x] Show reasoning text with expand/collapse for long text
  - [x] Handle missing reasoning gracefully

- [x] **Task 5: Build ValidationHistory Component** (AC: 6)
  - [x] Create `components/knowledge-explorer/findings/ValidationHistory.tsx`
  - [x] Display timeline of validation events
  - [x] Show diff view for edits (previous vs new value)
  - [x] Format timestamps with date-fns
  - [x] Empty state for no history

- [x] **Task 6: Build RelatedFindings Component** (AC: 5)
  - [x] Create `components/knowledge-explorer/findings/RelatedFindings.tsx`
  - [x] Display list of related findings with similarity score
  - [x] Truncate long text with "Show more" option
  - [x] Make findings clickable to navigate
  - [x] Empty state handling

- [x] **Task 7: Integrate into FindingsBrowser** (AC: 1)
  - [x] Add click handler to FindingsTable rows
  - [x] Add click handler to FindingCard components
  - [x] Pass selectedFindingId to FindingDetailPanel
  - [x] Handle URL state with `?findingId=` parameter
  - [x] Ensure panel closes when navigating away

- [x] **Task 8: Write Component Tests** (AC: All)
  - [x] Test FindingDetailPanel rendering with finding data
  - [x] Test loading and error states
  - [x] Test click-to-open behavior in table and card views
  - [x] Test RelatedFindings display
  - [x] Test ValidationHistory timeline
  - [x] Test ConfidenceReasoning expand/collapse
  - [x] Test keyboard navigation (Escape to close)
  - [x] Test accessibility (ARIA attributes, focus trap)

## Dev Notes

### Architecture Context

**This story implements the Finding Detail View in Knowledge Explorer:**

| Layer | Technology | This Story's Role |
|-------|------------|-------------------|
| UI Components | React + shadcn/ui | **Creates** FindingDetailPanel, ConfidenceReasoning, ValidationHistory, RelatedFindings |
| API Routes | Next.js App Router | **Creates** /api/projects/[id]/findings/[findingId] endpoint |
| Types | TypeScript | **Extends** FindingWithContext type if needed |
| Data | Supabase | **Queries** findings, documents, document_chunks tables |

**Finding Detail Flow:**

```
User clicks on finding (row or card)
         ↓
URL updates: ?findingId=xxx
         ↓
FindingDetailPanel opens (Sheet slide-out)
         ↓
┌────────────────────────────────────────┐
│ GET /api/projects/[id]/findings/[findingId]
│ - Fetch finding with full metadata     │
│ - Join documents table                 │
│ - Join document_chunks table           │
│ - Return FindingWithContext            │
└────────────────────────────────────────┘
         ↓
┌────────────────────────────────────────┐
│ Get Related Findings:                   │
│ - pgvector similarity on finding text  │
│ - Top 5 excluding current finding      │
│ - Filter to same project               │
└────────────────────────────────────────┘
         ↓
Render full detail view with all sections
```

### Project Structure Notes

**New Files to Create:**

```
manda-app/
├── app/api/projects/[id]/findings/[findingId]/
│   └── route.ts                           ← NEW: GET finding detail endpoint
├── components/knowledge-explorer/findings/
│   ├── FindingDetailPanel.tsx             ← NEW: Main detail panel component
│   ├── ConfidenceReasoning.tsx            ← NEW: Confidence reasoning display
│   ├── ValidationHistory.tsx              ← NEW: Validation history timeline
│   └── RelatedFindings.tsx                ← NEW: Related findings list
└── __tests__/components/knowledge-explorer/findings/
    ├── FindingDetailPanel.test.tsx        ← NEW: Panel tests
    ├── ConfidenceReasoning.test.tsx       ← NEW: Reasoning tests
    ├── ValidationHistory.test.tsx         ← NEW: History tests
    └── RelatedFindings.test.tsx           ← NEW: Related findings tests
```

**Existing Files to Modify:**

- `components/knowledge-explorer/findings/FindingsTable.tsx` - Add row click handler
- `components/knowledge-explorer/findings/FindingCard.tsx` - Add card click handler
- `components/knowledge-explorer/findings/FindingsBrowser.tsx` - Add detail panel integration, URL state
- `components/knowledge-explorer/findings/index.ts` - Export new components
- `lib/api/findings.ts` - Add getFindingById function

### Technical Constraints

**From Tech Spec (E4.9: Implement Finding Detail View with Full Context):**
- Modal or slide-out panel approach
- Sections: Finding text, Confidence reasoning, Source attribution, Related findings, Validation history
- Fetch from findings, document_chunks, contradictions, validation_history
- Display thinking mode reasoning from Gemini (if available in metadata)

**From UX Design Specification:**
- Slide-out panel is preferred for detail views (maintains context of list)
- Source attribution clickable with document preview
- Validation history as timeline

**From Architecture (shadcn/ui):**
- Use Sheet component for slide-out panel
- Consistent with existing patterns (DocumentPreviewModal uses Dialog)
- Sheet provides better UX for detail views that need to maintain list context

**Existing Components to Reuse:**
- `SourceAttributionLink` - Clickable source with formatted display
- `DocumentPreviewModal` - Document preview functionality
- `ConfidenceBadge` - Confidence score visualization
- `DomainTag` - Domain badge display
- `StatusBadge` - Status badge display
- `FindingActions` - Validate/Reject/Edit actions
- `sheet.tsx` - shadcn/ui Sheet component

### Learnings from Previous Story

**From Story e4-8 (Build Gap Analysis View) - Status: done**

- **Pattern to Follow**: GapAnalysisView uses URL state management with useSearchParams/useRouter
- **Test Coverage**: 96 tests across 3 files - maintain similar coverage for this story
- **Component Structure**: Separate View, Card, Actions components - apply same pattern here
- **Dialogs/Modals**: Use shadcn/ui Dialog/Sheet components with proper ARIA attributes
- **API Client Pattern**: lib/api/gaps.ts pattern for API client functions

**Files/Patterns to Reuse:**
- `lib/api/findings.ts` - Existing findings API client (extend, DO NOT RECREATE)
- `lib/types/findings.ts` - FindingWithContext type already exists!
- `components/knowledge-explorer/shared/` - All badge components available
- `components/knowledge-explorer/shared/SourceAttributionLink.tsx` - Source link with preview
- `components/knowledge-explorer/shared/DocumentPreviewModal.tsx` - Document preview
- `components/ui/sheet.tsx` - shadcn/ui Sheet component

**Key Insight**: `FindingWithContext` interface already includes `document`, `chunk`, `relatedFindings`, and `validationHistory` fields. The API endpoint needs to populate these fields, and the UI needs to display them.

[Source: stories/e4-8-build-gap-analysis-view.md#Completion-Notes]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#E4.9]
- [Source: docs/epics.md#Story-E4.9-Implement-Finding-Detail-View]
- [Source: manda-app/lib/types/findings.ts#FindingWithContext]
- [Source: manda-app/components/knowledge-explorer/shared/SourceAttributionLink.tsx]
- [Source: manda-app/components/knowledge-explorer/shared/DocumentPreviewModal.tsx]
- [Source: manda-app/components/ui/sheet.tsx]
- [Source: stories/e4-8-build-gap-analysis-view.md#Completion-Notes]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e4-9-implement-finding-detail-view-with-full-context.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

**Implementation Summary (2025-11-30):**

1. **FindingDetailPanel Component**: Created a slide-out Sheet panel that displays full finding context including metadata badges, confidence reasoning, source attribution, related findings, and validation history. Supports inline editing and validation actions.

2. **API Enhancement**: Enhanced the existing GET /api/projects/[id]/findings/[findingId] endpoint to return FindingWithContext with:
   - Document information (id, name, filePath)
   - Chunk data (content, sheetName, cellReference, pageNumber)
   - Related findings via semantic similarity (match_findings RPC)
   - Full validation history

3. **Supporting Components**:
   - `ConfidenceReasoning.tsx`: Visual confidence bar with expandable reasoning text
   - `ValidationHistory.tsx`: Timeline of validation events with diff view for edits
   - `RelatedFindings.tsx`: List of semantically similar findings with similarity scores

4. **Integration**: Added click handlers to FindingsTable and FindingCard, URL state management for deep linking (?findingId=xxx), and seamless navigation between related findings.

5. **Test Coverage**: 173 tests pass covering all new components and integration points.

**Key Technical Decisions:**
- Used existing `match_findings` RPC for semantic similarity (avoids new database function)
- Sheet component from shadcn/ui for slide-out panel pattern
- URL-based state for deep linking support
- Reused existing shared components (SourceAttributionLink, ConfidenceBadge, DomainTag, StatusBadge)

### File List

**New Files Created:**
- `manda-app/components/knowledge-explorer/findings/FindingDetailPanel.tsx`
- `manda-app/components/knowledge-explorer/findings/ConfidenceReasoning.tsx`
- `manda-app/components/knowledge-explorer/findings/ValidationHistory.tsx`
- `manda-app/components/knowledge-explorer/findings/RelatedFindings.tsx`
- `manda-app/__tests__/components/knowledge-explorer/findings/FindingDetailPanel.test.tsx`
- `manda-app/__tests__/components/knowledge-explorer/findings/ConfidenceReasoning.test.tsx`
- `manda-app/__tests__/components/knowledge-explorer/findings/ValidationHistory.test.tsx`
- `manda-app/__tests__/components/knowledge-explorer/findings/RelatedFindings.test.tsx`

**Files Modified:**
- `manda-app/app/api/projects/[id]/findings/[findingId]/route.ts` - Enhanced GET handler
- `manda-app/lib/api/findings.ts` - Added getFindingById function
- `manda-app/components/knowledge-explorer/findings/FindingsTable.tsx` - Added row click handler
- `manda-app/components/knowledge-explorer/findings/FindingCard.tsx` - Added card click handler
- `manda-app/components/knowledge-explorer/findings/FindingsCardGrid.tsx` - Added click prop passthrough
- `manda-app/components/knowledge-explorer/findings/FindingsBrowser.tsx` - Added detail panel integration
- `manda-app/components/knowledge-explorer/findings/index.ts` - Added exports

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-30 | Story drafted from tech spec, epics, and previous story context | SM Agent |
