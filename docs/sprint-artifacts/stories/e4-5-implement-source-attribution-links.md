# Story 4.5: Implement Source Attribution Links

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **to click on a source citation to view the original document location**,
so that **I can verify findings against their original context and trace information back to primary sources**.

## Acceptance Criteria

1. **AC1: Clickable Source Links in Findings**
   - Source attributions are displayed as clickable links throughout the application
   - Link format shows: document name, page/section/cell reference (e.g., "financial_model.xlsx, Sheet 'P&L', Cell B15")
   - Links use monospace font with subtle highlighting to indicate clickability
   - Hover state shows tooltip with full source path

2. **AC2: Document Preview Modal**
   - Clicking a source link opens a document preview modal
   - Modal displays document content at the referenced location
   - Modal has close button (X), keyboard dismiss (Escape), and click-outside-to-close
   - Modal shows document title, page/sheet info, and source reference in header
   - Loading state shown while document content is being fetched

3. **AC3: Excel Source Navigation**
   - For Excel sources, the preview opens to the correct sheet
   - The referenced cell (e.g., B15) is highlighted with a visual indicator
   - Sheet tabs are visible for navigation between sheets
   - Cell context is visible (surrounding cells for context)

4. **AC4: PDF Source Navigation**
   - For PDF sources, the preview opens to the referenced page
   - Page number is displayed and navigation controls available
   - The relevant section is scrolled into view
   - Text highlighting for the extracted content (if text-based)

5. **AC5: Unavailable Document Fallback**
   - If document preview is not available (not yet processed), show "Document preview not available"
   - Provide a link to download the original file from GCS
   - Show document metadata (name, size, upload date) as fallback

6. **AC6: SourceAttributionLink Component**
   - Create reusable `SourceAttributionLink` component in shared/
   - Component accepts: documentId, documentName, chunkId, pageNumber, sheetName, cellReference
   - Component handles click events and opens preview modal
   - Component is accessible with proper ARIA labels

7. **AC7: Integration with Existing Components**
   - Integrate SourceAttributionLink into FindingsTable source column
   - Integrate SourceAttributionLink into FindingCard expanded view
   - Ensure source links work in both table and card views
   - Source links work on finding detail views when implemented

8. **AC8: Performance and Error Handling**
   - Document content is fetched on-demand (not preloaded)
   - Error states shown for failed document fetches
   - Retry button for failed loads
   - Loading indicator during fetch

## Tasks / Subtasks

- [ ] **Task 1: Create SourceAttributionLink Component** (AC: 1, 6)
  - [ ] Create `components/knowledge-explorer/shared/SourceAttributionLink.tsx`
  - [ ] Implement link formatting with document name and location reference
  - [ ] Add hover state with tooltip showing full path
  - [ ] Add click handler to open preview modal
  - [ ] Export from shared/index.ts
  - [ ] Add ARIA labels for accessibility

- [ ] **Task 2: Create DocumentPreviewModal Component** (AC: 2, 8)
  - [ ] Create `components/knowledge-explorer/shared/DocumentPreviewModal.tsx`
  - [ ] Implement modal using shadcn Dialog component
  - [ ] Add document header with title, page/sheet, and reference info
  - [ ] Add loading state with skeleton
  - [ ] Add error state with retry button
  - [ ] Implement keyboard dismiss (Escape)

- [ ] **Task 3: Create Chunk API Endpoint** (AC: 2, 3, 4)
  - [ ] Create `app/api/projects/[id]/chunks/[chunkId]/route.ts`
  - [ ] Implement GET endpoint to fetch chunk with context
  - [ ] Include surrounding content for context (previous/next chunks)
  - [ ] Return sheet_name, cell_reference, page_number from document_chunks
  - [ ] Add authentication and RLS validation

- [ ] **Task 4: Implement Excel Preview** (AC: 3)
  - [ ] Create `components/knowledge-explorer/shared/ExcelPreview.tsx`
  - [ ] Display sheet content with cell grid visualization
  - [ ] Highlight referenced cell with visual indicator (border, background)
  - [ ] Show sheet tabs if document has multiple sheets
  - [ ] Display surrounding cells for context (5x5 grid around reference)

- [ ] **Task 5: Implement PDF Preview** (AC: 4)
  - [ ] Create `components/knowledge-explorer/shared/PdfPreview.tsx`
  - [ ] Display page content at referenced page number
  - [ ] Add page navigation controls (prev/next, page number input)
  - [ ] Scroll to relevant section based on chunk position
  - [ ] Consider using react-pdf or similar library for rendering

- [ ] **Task 6: Implement Fallback for Unavailable Documents** (AC: 5)
  - [ ] Create fallback UI showing "Preview not available"
  - [ ] Add download link using existing GCS signed URL generation
  - [ ] Display document metadata from documents table
  - [ ] Handle documents with processing_status != 'completed'

- [ ] **Task 7: Integrate into FindingsTable** (AC: 7)
  - [ ] Replace static source text with SourceAttributionLink component
  - [ ] Pass chunk_id, document_id, and source metadata to component
  - [ ] Test click functionality opens preview modal
  - [ ] Verify table layout accommodates link component

- [ ] **Task 8: Integrate into FindingCard** (AC: 7)
  - [ ] Add SourceAttributionLink to expanded card view
  - [ ] Position source link appropriately in card layout
  - [ ] Test click functionality in card context
  - [ ] Ensure undo validation doesn't interfere with link clicks

- [ ] **Task 9: Write Tests** (AC: All)
  - [ ] Unit tests for SourceAttributionLink component
    - Renders correct link format
    - Click opens modal
    - Accessibility attributes present
  - [ ] Unit tests for DocumentPreviewModal
    - Loading state
    - Error state with retry
    - Close functionality (X, Escape, click outside)
  - [ ] Unit tests for ExcelPreview
    - Cell highlighting works
    - Sheet navigation works
  - [ ] Unit tests for PdfPreview
    - Page navigation works
    - Page scroll behavior
  - [ ] Integration test for end-to-end source link flow
  - [ ] API endpoint tests for chunks route

## Dev Notes

### Architecture Context

**This story adds clickable source attribution links throughout the Knowledge Explorer:**

| Layer | Technology | This Story's Role |
|-------|------------|-------------------|
| UI Components | Next.js + shadcn/ui | **Creates** SourceAttributionLink, DocumentPreviewModal, ExcelPreview, PdfPreview |
| API Routes | Next.js App Router | **Creates** /api/projects/[id]/chunks/[chunkId] endpoint |
| Data Source | Supabase (document_chunks table) | **Reads** chunk content with metadata |
| Storage | Google Cloud Storage | **Uses** existing signed URL generation for downloads |

**Component Architecture:**

```
FindingsTable / FindingCard (existing - MODIFIED)
└── SourceAttributionLink (NEW)    ← Clickable source link
    └── DocumentPreviewModal (NEW)  ← Preview container
        ├── ExcelPreview (NEW)      ← Excel sheet viewer
        ├── PdfPreview (NEW)        ← PDF page viewer
        └── FallbackPreview (NEW)   ← Unavailable document fallback
```

### Project Structure Notes

**New Files to Create:**

```
manda-app/
├── app/api/projects/[id]/chunks/[chunkId]/
│   └── route.ts                           ← NEW: Chunk fetch API
├── components/knowledge-explorer/
│   └── shared/
│       ├── SourceAttributionLink.tsx      ← NEW: Clickable source link
│       ├── DocumentPreviewModal.tsx       ← NEW: Preview modal container
│       ├── ExcelPreview.tsx               ← NEW: Excel content viewer
│       └── PdfPreview.tsx                 ← NEW: PDF page viewer
```

**Existing Files to Modify:**

- `components/knowledge-explorer/findings/FindingsTable.tsx` - Replace static source with SourceAttributionLink
- `components/knowledge-explorer/findings/FindingCard.tsx` - Add SourceAttributionLink to expanded view
- `components/knowledge-explorer/shared/index.ts` - Export new components

**Database Tables Used:**

- `document_chunks` - chunk content, sheet_name, cell_reference, page_number
- `documents` - document name, file_path, processing_status
- `findings` - chunk_id reference for linking

### Technical Constraints

**From Tech Spec (E4.5: Implement Source Attribution Links):**
- Source citation format: "document_name.xlsx, Sheet 'P&L', Cell B15"
- Document viewer supports Excel, PDF, Word (MVP: basic preview)
- Navigate to exact location (highlight cell, jump to page)
- Fallback for unavailable previews with download option

**From Architecture (document_chunks table schema):**
```sql
CREATE TABLE document_chunks (
    id UUID PRIMARY KEY,
    document_id UUID REFERENCES documents(id),
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    chunk_type TEXT NOT NULL DEFAULT 'text',  -- text, table, formula, image
    page_number INTEGER,
    sheet_name TEXT,
    cell_reference TEXT,
    metadata JSONB DEFAULT '{}'
);
```

**From Finding Types (FindingWithContext interface):**
```typescript
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
}
```

### Dependencies

**Existing Dependencies (available):**
- `@shadcn/ui` - Dialog component for modal
- `lucide-react` - Icons (ExternalLink, FileSpreadsheet, FileText, Download)
- `@supabase/supabase-js` - Database queries for chunks

**Potential New Dependencies (evaluate):**
- `react-pdf` or `@react-pdf/renderer` - PDF rendering in browser
- `xlsx` or `exceljs` - Excel content parsing (if not using chunk content directly)

**Note:** MVP approach should use chunk.content directly rather than re-parsing files. The document_chunks table already contains extracted content with metadata.

### Learnings from Previous Story

**From Story e4-4 (Build Card View Alternative for Findings) - Status: done**

Per sprint-status.yaml (lines 581-595):
- **FindingCard Component**: Created at `components/knowledge-explorer/findings/FindingCard.tsx` - has expanded view where source link should be added
- **ViewToggle Pattern**: localStorage persistence pattern available for reuse
- **Responsive Grid**: CSS Grid implementation can inform preview modal layout
- **Virtual Scrolling**: @tanstack/react-virtual added - not needed for this story
- **Test Pattern**: 69 tests covering card components - follow established patterns
- **Component Integration**: FindingsBrowser manages card/table views - both need source link integration

**Files to Integrate With (not recreate):**
- `FindingCard.tsx` - Add SourceAttributionLink to expanded state
- `FindingsTable.tsx` - Replace source text column with SourceAttributionLink
- Shared badge components (ConfidenceBadge, DomainTag, StatusBadge) - follow patterns

**Key Pattern from e4-4:**
```typescript
// FindingCard expanded view pattern
{isExpanded && (
  <div className="mt-4 pt-4 border-t">
    {/* Full text and source attribution displayed here */}
    <SourceAttributionLink {...sourceProps} />  // ADD HERE
  </div>
)}
```

**Existing Source Display (to replace):**
- FindingCard currently shows `sourceDocument` as plain text when expanded
- FindingsTable has "Source" column with static text
- Both need to be replaced with clickable SourceAttributionLink component

[Source: stories/e4-4-build-card-view-alternative-for-findings.md#Dev-Agent-Record]
[Source: docs/sprint-artifacts/sprint-status.yaml#e4-4-notes]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#E4.5-Implement-Source-Attribution-Links]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#Component-Hierarchy]
- [Source: docs/epics.md#Story-E4.5-Implement-Source-Attribution-Links]
- [Source: manda-app/supabase/migrations/00015_create_document_chunks_table.sql]
- [Source: manda-app/lib/types/findings.ts#FindingWithContext]
- [Source: docs/ux-design-specification.md#Section-2.2-Visual-Foundation]
- [Source: stories/e4-4-build-card-view-alternative-for-findings.md#Completion-Notes]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e4-5-implement-source-attribution-links.context.xml

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-30 | Story drafted from tech spec and previous story context | SM Agent |
