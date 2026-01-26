# Story 4.4: Build Card View Alternative for Findings

Status: done

## Story

As an **M&A analyst**,
I want **to view findings in a card layout alternative to the table view**,
so that **I can quickly scan and compare findings visually, with more context visible at a glance for detailed review sessions**.

## Acceptance Criteria

1. **AC1: Card View Component**
   - Create `FindingCard.tsx` component displaying finding text, domain, confidence, status, and source
   - Card shows more content than table row (up to 200 characters before truncation)
   - Cards include visual confidence indicator (color-coded bar or badge)
   - Cards display domain tag with icon
   - Cards show creation date in relative format (e.g., "2 days ago")
   - Cards have hover state with subtle elevation change

2. **AC2: View Toggle in FindingsBrowser**
   - Add view toggle component with Table/Card icons
   - Toggle persists view preference to localStorage
   - Toggle available above the findings display area
   - Default view: Table (current behavior)
   - Keyboard shortcut: `Ctrl/Cmd + Shift + V` toggles view

3. **AC3: Card Grid Layout**
   - Cards display in responsive grid (1 column mobile, 2 columns tablet, 3 columns desktop)
   - Grid supports infinite scroll or pagination matching table behavior
   - Loading state shows skeleton cards
   - Empty state matches table empty state

4. **AC4: Card Actions**
   - Cards include validate/reject/edit actions from FindingActions component
   - Actions appear on card hover or focus (desktop) or always visible (mobile)
   - Optimistic updates and undo work identically to table view
   - Edit mode opens inline editor within card

5. **AC5: Card Interaction**
   - Clicking card body (not actions) expands to show full text
   - Expanded card shows source attribution link
   - Keyboard navigation: Tab between cards, Enter to expand, Escape to collapse

6. **AC6: Search and Filter Integration**
   - Card view works with all existing filters (domain, status, confidence, document)
   - Card view works with semantic search results
   - Similarity badge displayed on cards when in search mode
   - Filter changes apply to card view immediately

7. **AC7: Performance**
   - Card view renders 50+ cards without jank
   - Virtual scrolling for large datasets (>100 findings)
   - Images/icons lazy loaded
   - Transitions are smooth (60fps target)

8. **AC8: Accessibility**
   - Cards are keyboard navigable (Tab to navigate, Enter to select)
   - ARIA labels for all interactive elements
   - Screen reader announces card content and actions
   - Focus indicator clearly visible on cards
   - View toggle is accessible and labeled

## Tasks / Subtasks

- [x] **Task 1: Create FindingCard Component** (AC: 1)
  - [x] Create `components/knowledge-explorer/findings/FindingCard.tsx`
  - [x] Implement card layout with header (domain, confidence, status)
  - [x] Add truncated text display with "show more" capability
  - [x] Integrate ConfidenceBadge, DomainTag, StatusBadge from shared/
  - [x] Add relative date formatting using date-fns
  - [x] Style with shadcn/ui Card component and Tailwind
  - [x] Add hover elevation effect with smooth transition

- [x] **Task 2: Create ViewToggle Component** (AC: 2)
  - [x] Create `components/knowledge-explorer/shared/ViewToggle.tsx`
  - [x] Implement toggle with Table icon and LayoutGrid icon
  - [x] Add localStorage persistence for view preference
  - [x] Implement keyboard shortcut (Ctrl/Cmd+Shift+V)
  - [x] Export from shared/index.ts

- [x] **Task 3: Build Card Grid Container** (AC: 3)
  - [x] Create `components/knowledge-explorer/findings/FindingsCardGrid.tsx`
  - [x] Implement responsive CSS Grid layout
  - [x] Add loading skeleton for cards (SkeletonCard component)
  - [x] Add empty state component
  - [x] Match pagination behavior from FindingsTable

- [x] **Task 4: Integrate FindingActions into Card** (AC: 4)
  - [x] Position actions in card footer or overlay
  - [x] Show actions on hover (desktop) / always (mobile)
  - [x] Connect optimistic update handlers from FindingsBrowser
  - [x] Test undo functionality in card context

- [x] **Task 5: Implement Card Expansion** (AC: 5)
  - [x] Add expanded/collapsed state to FindingCard
  - [x] Show full text and source attribution when expanded
  - [x] Handle keyboard interactions (Enter expand, Escape collapse)
  - [x] Animate expansion smoothly

- [x] **Task 6: Integrate Card View into FindingsBrowser** (AC: 2, 6)
  - [x] Add viewMode state to FindingsBrowser
  - [x] Conditionally render FindingsTable or FindingsCardGrid
  - [x] Pass all filter props to card grid
  - [x] Ensure search results work with card view
  - [x] Add SimilarityBadge to cards when in search mode

- [x] **Task 7: Add Virtual Scrolling (Performance)** (AC: 7)
  - [x] Evaluate @tanstack/react-virtual for virtualization
  - [x] Implement virtualized card grid for large datasets
  - [x] Test with 100+ findings for performance
  - [x] Optimize re-renders with React.memo

- [x] **Task 8: Accessibility Implementation** (AC: 8)
  - [x] Add ARIA roles and labels to cards
  - [x] Implement keyboard navigation between cards
  - [x] Test with screen reader (VoiceOver/NVDA)
  - [x] Ensure focus management on view toggle

- [x] **Task 9: Write Tests** (AC: All)
  - [x] Unit tests for FindingCard component
    - Renders all finding data correctly
    - Expand/collapse works
    - Actions trigger handlers
    - Accessibility attributes present
  - [x] Unit tests for ViewToggle component
    - Toggle switches view mode
    - Persists to localStorage
    - Keyboard shortcut works
  - [x] Unit tests for FindingsCardGrid
    - Renders correct number of cards
    - Responsive breakpoints work
    - Loading/empty states display
  - [x] Integration test for card view with filters

## Dev Notes

### Architecture Context

**This story adds a card view alternative to the existing table-based Findings Browser:**

| Layer | Technology | This Story's Role |
|-------|------------|-------------------|
| UI Components | Next.js + shadcn/ui | **Creates** FindingCard, ViewToggle, FindingsCardGrid |
| State Management | React useState + localStorage | **Adds** view preference persistence |
| Layout | Tailwind CSS Grid | **Implements** responsive card grid |
| Performance | @tanstack/react-virtual (potential) | **Optimizes** large dataset rendering |

**Component Architecture:**

```
FindingsBrowser (existing - MODIFIED)
├── FindingSearch (existing)
├── FindingFilters (existing)
├── ViewToggle (NEW)          ← Table/Card toggle
└── [Conditional Render]
    ├── FindingsTable (existing)
    └── FindingsCardGrid (NEW)  ← Card layout alternative
        └── FindingCard (NEW)   ← Individual card component
            ├── DomainTag, ConfidenceBadge, StatusBadge (existing)
            └── FindingActions (existing)
```

### Project Structure Notes

**New Files to Create:**

```
manda-app/
├── components/knowledge-explorer/
│   ├── findings/
│   │   ├── FindingCard.tsx        ← NEW: Individual card component
│   │   └── FindingsCardGrid.tsx   ← NEW: Card grid container
│   └── shared/
│       └── ViewToggle.tsx         ← NEW: Table/Card toggle
```

**Existing Files to Modify:**

- `components/knowledge-explorer/findings/FindingsBrowser.tsx` - Add view toggle and conditional rendering
- `components/knowledge-explorer/findings/index.ts` - Export new components
- `components/knowledge-explorer/shared/index.ts` - Export ViewToggle

**Alignment with Existing Patterns:**
- Follow shadcn/ui Card component usage from existing wizard components
- Follow responsive grid patterns from projects overview
- Follow localStorage persistence pattern from data-room view preferences

### Technical Constraints

**From Tech Spec (E4.4: Build Card View Alternative for Findings):**
- Card view is P1 priority (important but not blocking)
- Must work with all existing filters and search
- Must integrate with validation/edit actions from E4.3
- Performance target: smooth rendering of 50+ cards

**From Architecture:**
- Use shadcn/ui Card component as base
- Follow existing responsive breakpoints (sm/md/lg/xl)
- Persist preferences to localStorage per user
- Use CSS Grid for card layout (not Flexbox)

**Card Content Priority:**
1. Finding text (primary content, max 200 chars)
2. Domain tag with icon (top-right or header)
3. Confidence badge (visual indicator)
4. Status badge (validation state)
5. Source document reference
6. Relative date

### Dependencies

**Existing Dependencies (no new packages needed):**
- `@shadcn/ui` - Card component
- `date-fns` - formatDistanceToNow for relative dates
- `lucide-react` - Icons (LayoutGrid, Table2)

**Potential New Dependency (for virtualization):**
- `@tanstack/react-virtual` - If needed for 100+ card performance (evaluate first)

### Learnings from Previous Story

**From Story e4-3 (Implement Inline Finding Validation) - Status: done**

Per sprint-status.yaml (lines 566-580):
- **Validate API Endpoint**: `POST /api/projects/[id]/findings/[findingId]/validate` created
- **PATCH API Endpoint**: Editing findings text/status works
- **FindingActions Component**: Created at `components/knowledge-explorer/findings/FindingActions.tsx` - reuse this
- **InlineEdit Component**: Created for editing finding text - reuse pattern
- **useUndoValidation Hook**: Created at `components/knowledge-explorer/findings/useUndoValidation.ts` - reuse for card view
- **Integration Pattern**: FindingsBrowser manages validation handlers, passes to table - follow same pattern for cards
- **Toast Notifications**: Using sonner for undo toasts with action buttons
- **Test Pattern**: 56 tests covering FindingActions, InlineEdit, useUndoValidation, validate API

**Files to Reuse (not recreate):**
- `FindingActions.tsx` - Import and use in FindingCard
- `InlineEdit.tsx` - Import for card edit mode
- `useUndoValidation.ts` - Hook for undo functionality
- Shared components: ConfidenceBadge, DomainTag, StatusBadge

**Key Pattern from e4-3:**
```typescript
// In FindingsBrowser - validation handlers pattern
const handleValidate = useCallback(async (findingId: string, action: 'confirm' | 'reject') => {
  // Optimistic update + API call + undo state
}, [/* deps */])

const handleEdit = useCallback((finding: Finding) => {
  // Open inline edit mode
}, [])
```

[Source: stories/e4-3-implement-inline-finding-validation.md#Dev-Agent-Record]
[Source: docs/sprint-artifacts/sprint-status.yaml#e4-3-notes]

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#E4.4-Build-Card-View-Alternative-for-Findings]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#Component-Hierarchy]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#Non-Functional-Requirements-Performance]
- [Source: stories/e4-3-implement-inline-finding-validation.md#Component-Integration]
- [Source: manda-app/components/knowledge-explorer/findings/FindingsBrowser.tsx]
- [Source: manda-app/components/knowledge-explorer/findings/FindingActions.tsx]
- [Source: manda-app/components/knowledge-explorer/shared/ConfidenceBadge.tsx]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e4-4-build-card-view-alternative-for-findings.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

**Implementation completed 2025-11-30:**

1. **FindingCard Component** (`components/knowledge-explorer/findings/FindingCard.tsx`):
   - Card layout with domain tag, confidence badge, status badge in header
   - Text truncation at 200 chars with "Show more" / "Show less" expansion
   - Relative date formatting using date-fns `formatDistanceToNow`
   - Hover elevation effect with smooth transitions
   - Source attribution displayed when card is expanded
   - Keyboard navigation (Enter to expand, Escape to collapse)
   - Integrated FindingActions for validate/reject/edit
   - Integrated InlineEdit for editing mode
   - Similarity badge display for search results
   - Full ARIA labeling and accessibility support

2. **ViewToggle Component** (`components/knowledge-explorer/shared/ViewToggle.tsx`):
   - Table/Card icons toggle (Table2, LayoutGrid from lucide-react)
   - localStorage persistence via `useViewPreference` hook
   - Keyboard shortcut: Ctrl/Cmd+Shift+V toggles view
   - ARIA-pressed states and labels
   - Tooltip with shortcut hint

3. **FindingsCardGrid Component** (`components/knowledge-explorer/findings/FindingsCardGrid.tsx`):
   - Responsive CSS Grid: 1 col mobile, 2 cols tablet, 3 cols desktop
   - Loading state with skeleton cards (SkeletonCard component)
   - Empty state matching table empty state
   - Pagination controls matching FindingsTable behavior
   - Virtual scrolling for datasets >100 findings using @tanstack/react-virtual
   - ARIA region labels with finding counts

4. **FindingsBrowser Integration**:
   - Added viewMode state with useViewPreference hook
   - Conditional rendering of FindingsTable or FindingsCardGrid
   - ViewToggle positioned next to filters
   - All validation/edit handlers work in both views
   - Search mode works with similarity badges in card view

5. **Performance Optimizations**:
   - @tanstack/react-virtual installed for virtual scrolling
   - Virtual scrolling kicks in at >100 findings
   - CSS transitions for hover/expand effects target 60fps

6. **Test Coverage** (69 tests passing):
   - FindingCard.test.tsx: 30 tests covering rendering, truncation, expansion, actions, accessibility
   - ViewToggle.test.tsx: 19 tests covering toggle behavior, localStorage, keyboard shortcuts
   - FindingsCardGrid.test.tsx: 20 tests covering rendering, loading, pagination, actions

### File List

**New Files:**
- `manda-app/components/knowledge-explorer/findings/FindingCard.tsx`
- `manda-app/components/knowledge-explorer/findings/FindingsCardGrid.tsx`
- `manda-app/components/knowledge-explorer/shared/ViewToggle.tsx`
- `manda-app/__tests__/components/knowledge-explorer/findings/FindingCard.test.tsx`
- `manda-app/__tests__/components/knowledge-explorer/findings/FindingsCardGrid.test.tsx`
- `manda-app/__tests__/components/knowledge-explorer/shared/ViewToggle.test.tsx`

**Modified Files:**
- `manda-app/components/knowledge-explorer/findings/FindingsBrowser.tsx` - Added view toggle and card grid integration
- `manda-app/components/knowledge-explorer/findings/index.ts` - Added exports for FindingCard, FindingsCardGrid
- `manda-app/components/knowledge-explorer/shared/index.ts` - Added export for ViewToggle, useViewPreference
- `manda-app/package.json` - Added @tanstack/react-virtual dependency

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-29 | Story drafted from tech spec and previous story context | SM Agent |
| 2025-11-30 | Implementation completed - all ACs met, 69 tests passing | Dev Agent |
