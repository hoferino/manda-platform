# Story 6.7: Build IRL Checklist Progress Visualization

Status: ready-for-review

## Story

As an M&A analyst,
I want to see visual progress indicators for my IRL checklist,
so that I can quickly understand how much of my document request is fulfilled.

## Acceptance Criteria

1. **AC1**: Overall progress bar shows percentage complete (e.g., "32/45 items - 71%")
2. **AC2**: Category headers display category-level progress (e.g., "Financial: 4/6")
3. **AC3**: Progress updates in real-time when item status changes (optimistic UI)
4. **AC4**: Dashboard-style summary view shows counts for fulfilled vs unfulfilled items
5. **AC5**: Progress visualization is responsive and works on tablet/desktop
6. **AC6**: Progress calculation uses the `fulfilled` boolean field from `irl_items`

## Tasks / Subtasks

- [x] Task 1: Enhance Progress Calculation Utilities (AC: 1, 2, 6) ✅
  - [x] 1.1 Update `calculateIRLFulfilledProgress()` in `lib/types/irl.ts` to return category-level breakdown
  - [x] 1.2 Create `IRLProgressByCategory` type: `{ category: string, fulfilled: number, total: number, percentComplete: number }`
  - [x] 1.3 Ensure progress recalculation on fulfilled toggle (via useMemo in hook)

- [x] Task 2: Create Progress Visualization Components (AC: 1, 2, 4, 5) ✅
  - [x] 2.1 Create `components/irl/IRLProgressBar.tsx` - enhanced progress bar with percentage label
  - [x] 2.2 Create `components/irl/IRLProgressSummary.tsx` - dashboard-style summary (fulfilled/unfulfilled counts)
  - [x] 2.3 Create `components/irl/IRLCategoryProgress.tsx` - inline progress for category headers (text/badge/bar variants)

- [x] Task 3: Update IRLCategory Component (AC: 2, 3) ✅
  - [x] 3.1 Add category-level progress indicator to `IRLCategory.tsx` header
  - [x] 3.2 Show "X/Y" fulfilled items next to category name
  - [x] 3.3 Use mini progress bar variant for visual distinction

- [x] Task 4: Update IRLBuilder with Enhanced Progress (AC: 1, 4, 5) ✅
  - [x] 4.1 Replace basic progress in `IRLBuilder.tsx` header with `IRLProgressSummary`
  - [x] 4.2 Add progress summary section below title showing fulfilled/unfulfilled breakdown
  - [x] 4.3 Ensure responsive layout for progress components (compact mode for summary)

- [x] Task 5: Update useIRLBuilder Hook for Category Progress (AC: 3, 6) ✅
  - [x] 5.1 Extend `useIRLBuilder` to compute and expose `progressByCategory`
  - [x] 5.2 Ensure category progress updates optimistically on fulfilled toggle (via useMemo dependency on items)
  - [x] 5.3 Add `fulfilledProgress` and `progressByCategory` to hook return value

- [x] Task 6: Write Tests (AC: 1-6) ✅
  - [x] 6.1 Unit tests for enhanced progress calculation functions (12 tests)
  - [x] 6.2 Component tests for `IRLProgressBar`, `IRLProgressSummary`, `IRLCategoryProgress` (24 tests)
  - [x] 6.3 Integration test: IRLBuilder test updated to verify progress summary display
  - [x] 6.4 Test responsive behavior via compact mode props

## Dev Notes

### Relevant Architecture Patterns and Constraints

- **Progress Data Source**: Use the `fulfilled` boolean field from `irl_items` table (added in E6.5)
- **Calculation Pattern**: Follow existing `calculateIRLFulfilledProgress()` utility in `lib/types/irl.ts`
- **Real-time Updates**: Leverage existing optimistic UI pattern in `useIRLBuilder` hook
- **Component Naming**: Follow existing IRL component naming convention (`IRL*.tsx`)
- **Styling**: Use Tailwind CSS and shadcn/ui components (Progress, Badge)

### Source Tree Components to Touch

| File | Operation | Notes |
|------|-----------|-------|
| `lib/types/irl.ts` | MODIFY | Add `IRLProgressByCategory` type, enhance progress calculation |
| `components/irl/IRLProgressBar.tsx` | CREATE | Enhanced progress bar with percentage label |
| `components/irl/IRLProgressSummary.tsx` | CREATE | Dashboard-style summary component |
| `components/irl/IRLCategoryProgress.tsx` | CREATE | Inline category progress indicator |
| `components/irl/IRLCategory.tsx` | MODIFY | Add category-level progress display |
| `components/irl/IRLBuilder.tsx` | MODIFY | Replace basic progress with enhanced components |
| `components/irl/useIRLBuilder.ts` | MODIFY | Add progressByCategory computation |
| `__tests__/components/irl/IRLProgressBar.test.tsx` | CREATE | Component tests |
| `__tests__/components/irl/IRLProgressSummary.test.tsx` | CREATE | Component tests |
| `__tests__/components/irl/IRLCategoryProgress.test.tsx` | CREATE | Component tests |

### Testing Standards Summary

- **Unit Tests**: Vitest with `@testing-library/react` for components
- **Coverage Target**: 80% for new components
- **Test Pattern**: Follow existing IRL component test patterns in `__tests__/components/irl/`
- **Mock Pattern**: Use `mockRouter` and shadcn/ui mock providers as established

### Project Structure Notes

- **Component Location**: All new components in `manda-app/components/irl/`
- **Type Location**: Progress types in `lib/types/irl.ts` alongside existing IRL types
- **Test Location**: `manda-app/__tests__/components/irl/` following existing pattern
- **No New Dependencies**: Uses existing Progress component from shadcn/ui

### Learnings from Previous Story

**From Story e6-6-build-irl-export-functionality-excel-csv (Status: done)**

- **Binary Fulfilled Status**: The `irl_items.fulfilled` boolean is the only status field - no enum, just true/false
- **Progress Utility**: `calculateIRLFulfilledProgress()` already exists in `lib/types/irl.ts` - extend don't recreate
- **IRLBuilder Integration**: Export dropdown was added to the toolbar area - use same location for progress summary
- **Test Count**: 1600+ tests passing - maintain green build
- **useIRLBuilder Hook**: Already returns `progress` object with `{ total, complete, percentComplete }` - extend this

[Source: docs/sprint-artifacts/stories/e6-6-build-irl-export-functionality-excel-csv.md#Dev-Notes]

### Current State Analysis

The IRLBuilder currently has a basic progress indicator:
```tsx
{progress && (
  <div className="w-32 text-right">
    <div className="text-sm font-medium mb-1">
      {progress.complete}/{progress.total} Complete
    </div>
    <Progress value={progress.percentComplete} className="h-2" />
  </div>
)}
```

This story enhances it with:
1. Category-level progress in each `IRLCategory` header
2. Dashboard summary with fulfilled/unfulfilled breakdown
3. More prominent percentage display

### References

- [Source: docs/epics.md#Story E6.7] - Full story requirements with Gherkin scenarios
- [Source: docs/sprint-artifacts/tech-spec-epic-E6.md#E6.4] - Manual tracking flow (E6.7 builds on E6.4/E6.5)
- [Source: manda-app/components/irl/IRLBuilder.tsx] - Current progress implementation to enhance
- [Source: manda-app/components/irl/useIRLBuilder.ts] - Hook for progress state
- [Source: manda-app/lib/types/irl.ts] - IRLProgress type and calculation utilities
- [Source: manda-app/components/irl/IRLCategory.tsx] - Category component to add progress to

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e6-7-build-irl-checklist-progress-visualization.context.xml

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

N/A - Implementation completed successfully without debugging issues.

### Completion Notes List

1. **Task 1 (Progress Calculation)**: Added `IRLProgressByCategory` type and `calculateIRLProgressByCategory()`, `calculateIRLFulfilledProgressWithCategories()` functions to lib/types/irl.ts. Progress now includes `percentComplete` field for each category.

2. **Task 2 (Components)**: Created three new visualization components:
   - `IRLProgressBar.tsx` - Enhanced bar with count/percentage labels, size variants (sm/md/lg)
   - `IRLProgressSummary.tsx` - Dashboard card with fulfilled/unfulfilled breakdown, category count
   - `IRLCategoryProgress.tsx` - Flexible inline indicator with text/badge/bar variants

3. **Task 3 (IRLCategory)**: Updated IRLCategory component to accept optional `progress` prop and display IRLCategoryProgress with "bar" variant showing mini progress bar next to category name.

4. **Task 4 (IRLBuilder)**: Replaced old "X/Y Complete" display with IRLProgressSummary component in compact mode below the header. Removed unused Progress import.

5. **Task 5 (useIRLBuilder)**: Added `fulfilledProgress` and `progressByCategory` computed values using useMemo for efficiency. Both automatically recalculate when items change, providing real-time optimistic updates.

6. **Task 6 (Tests)**: Created 36 new tests:
   - `__tests__/lib/types/irl-progress.test.ts` (12 tests) - Progress calculation utilities
   - `__tests__/components/irl/IRLProgressVisualization.test.tsx` (24 tests) - All three components
   - Updated `IRLBuilder.test.tsx` to verify new progress summary display and added fulfilled field to mock data

7. **Build Status**: `npm run build` succeeds. All IRL tests pass (127 tests total).

### File List

| File | Operation | Status |
|------|-----------|--------|
| `manda-app/lib/types/irl.ts` | MODIFIED | Added IRLProgressByCategory type and 3 new functions |
| `manda-app/components/irl/IRLProgressBar.tsx` | CREATED | Enhanced progress bar component |
| `manda-app/components/irl/IRLProgressSummary.tsx` | CREATED | Dashboard summary component |
| `manda-app/components/irl/IRLCategoryProgress.tsx` | CREATED | Category progress indicator |
| `manda-app/components/irl/IRLCategory.tsx` | MODIFIED | Added progress prop and display |
| `manda-app/components/irl/IRLBuilder.tsx` | MODIFIED | Integrated IRLProgressSummary |
| `manda-app/components/irl/useIRLBuilder.ts` | MODIFIED | Added fulfilledProgress and progressByCategory |
| `manda-app/__tests__/lib/types/irl-progress.test.ts` | CREATED | 12 unit tests |
| `manda-app/__tests__/components/irl/IRLProgressVisualization.test.tsx` | CREATED | 24 component tests |
| `manda-app/__tests__/components/irl/IRLBuilder.test.tsx` | MODIFIED | Updated progress test, added fulfilled to mocks |

## Change Log

| Date | Author | Change |
|------|--------|--------|
| 2025-12-03 | SM Agent | Initial story draft created |
| 2025-12-03 | Dev Agent | Implementation complete - all 6 tasks done, 36 new tests passing |
