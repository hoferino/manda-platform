# Story 4.13: Build Real-Time Knowledge Graph Updates

Status: done

## Story

As an **M&A analyst**,
I want **to see the knowledge graph update in real-time as new findings are extracted, contradictions detected, or validations occur**,
so that **I can track how the system is learning from documents and stay informed of changes without manual refreshing**.

## Acceptance Criteria

1. **AC1: Supabase Realtime Subscription Setup**
   - Knowledge Explorer establishes Realtime subscriptions to findings and contradictions tables
   - Subscriptions are filtered by project_id for efficient data transfer
   - Subscriptions handle INSERT, UPDATE, and DELETE events
   - Connection status indicator shows subscription state (connected, connecting, disconnected)
   - Automatic reconnection with exponential backoff on connection loss (max 5 attempts)

2. **AC2: Findings Table Real-Time Updates**
   - When a new finding is extracted by the processing pipeline, it appears in the Findings tab automatically
   - When a finding's status is updated (validated/rejected), the change reflects immediately
   - When a finding is edited, the text and metadata update in place
   - When a finding is deleted, it is removed from the view
   - Updates are debounced (100ms) to prevent UI thrashing during rapid changes

3. **AC3: Contradictions Table Real-Time Updates**
   - When a new contradiction is detected, the Contradictions tab badge count updates
   - New contradictions appear in the Contradictions view list automatically
   - When a contradiction is resolved, its status updates in place
   - Resolution by another viewer (future: multi-user) reflects immediately
   - Unresolved contradiction count stays accurate in tab badge

4. **AC4: Tab Badge Count Updates**
   - Findings count in tab badge updates when findings are added/removed
   - Contradictions count badge updates (red badge for unresolved)
   - Counts are debounced to avoid rapid flickering
   - Badge shows "+N" animation briefly when count increases (optional enhancement)

5. **AC5: Toast Notifications for New Items**
   - Toast notification appears when new finding is extracted: "New finding extracted from [document name]"
   - Toast for new contradiction detected: "Contradiction detected: [brief description]"
   - Toast for processing completion: "[Document] processing complete - N findings extracted"
   - Toasts are dismissible and auto-hide after 5 seconds
   - Option to click toast to navigate to the relevant item
   - Maximum 3 simultaneous toasts (queue additional)

6. **AC6: Auto-Refresh Toggle**
   - Toggle switch in Knowledge Explorer header: "Auto-refresh" (default: ON)
   - When OFF, real-time updates are paused (subscription stays connected)
   - When OFF, badge shows indicator that updates are paused
   - Manual "Refresh" button available when auto-refresh is OFF
   - Setting persists in localStorage per project
   - Keyboard shortcut: Ctrl/Cmd+Shift+R to toggle

7. **AC7: Debouncing and UI Performance**
   - Multiple rapid updates within 100ms window are batched
   - UI remains responsive during high-frequency updates (>10/second)
   - Large batch updates (>20 items) show "Updating..." indicator briefly
   - React Query cache is invalidated efficiently (not full refetch on every change)
   - Memory usage stays stable during extended sessions (no subscription leaks)

8. **AC8: Connection Status Indicator**
   - Small status dot in Knowledge Explorer header (green=connected, yellow=connecting, red=disconnected)
   - Hover tooltip shows full status: "Real-time updates: Connected" / "Connecting..." / "Disconnected - click to reconnect"
   - Click on disconnected indicator attempts manual reconnection
   - Error state shows brief error message in tooltip

## Tasks / Subtasks

- [x] **Task 1: Create useFindingsRealtime Hook** (AC: 1, 2, 7)
  - [x] Create `lib/hooks/useFindingsRealtime.ts` following useDocumentUpdates pattern
  - [x] Subscribe to `findings` table filtered by `deal_id=eq.{projectId}`
  - [x] Handle INSERT, UPDATE, DELETE events
  - [x] Transform database records to Finding types
  - [x] Implement debounced callback (100ms)
  - [x] Add connection status tracking
  - [x] Implement reconnection with exponential backoff

- [x] **Task 2: Create useContradictionsRealtime Hook** (AC: 1, 3, 7)
  - [x] Create `lib/hooks/useContradictionsRealtime.ts` following same pattern
  - [x] Subscribe to `contradictions` table filtered by `deal_id=eq.{projectId}`
  - [x] Handle INSERT, UPDATE events (contradictions typically not deleted)
  - [x] Transform database records to Contradiction types
  - [x] Include both resolved and unresolved count tracking
  - [x] Implement debounced callback (100ms)

- [x] **Task 3: Create useKnowledgeExplorerRealtime Hook** (AC: 1, 4, 6, 8)
  - [x] Create `lib/hooks/useKnowledgeExplorerRealtime.ts` as composite hook
  - [x] Combine findings and contradictions realtime hooks
  - [x] Track aggregate connection status (connected only if both connected)
  - [x] Manage auto-refresh toggle state with localStorage persistence
  - [x] Expose counts, status, and control functions

- [x] **Task 4: Create ConnectionStatusIndicator Component** (AC: 8)
  - [x] Create `components/knowledge-explorer/ConnectionStatusIndicator.tsx`
  - [x] Render status dot with appropriate color (green/yellow/red)
  - [x] Add tooltip with full status message
  - [x] Implement click-to-reconnect functionality
  - [x] Add aria-label for accessibility

- [x] **Task 5: Create AutoRefreshToggle Component** (AC: 6)
  - [x] Create `components/knowledge-explorer/AutoRefreshToggle.tsx`
  - [x] Use shadcn/ui Switch component
  - [x] Wire to useKnowledgeExplorerRealtime hook
  - [x] Add keyboard shortcut (Ctrl/Cmd+Shift+R)
  - [x] Show paused indicator when OFF
  - [x] Add accessible label

- [x] **Task 6: Create RealtimeToastHandler Component** (AC: 5)
  - [x] Create `components/knowledge-explorer/RealtimeToastHandler.tsx`
  - [x] Listen to realtime events from composite hook
  - [x] Dispatch appropriate toast notifications via sonner
  - [x] Implement toast queue with max 3 visible
  - [x] Add click handler to navigate to item
  - [x] Include document name in finding notifications

- [x] **Task 7: Integrate Realtime into KnowledgeExplorerClient** (AC: 1-8)
  - [x] Add useKnowledgeExplorerRealtime hook to KnowledgeExplorerClient
  - [x] Pass realtime counts to tab badges (override initial server counts)
  - [x] Add ConnectionStatusIndicator to header
  - [x] Add AutoRefreshToggle to header
  - [x] Add RealtimeToastHandler component
  - [x] Update FindingsBrowser to receive realtime update callbacks
  - [x] Update ContradictionsView to receive realtime update callbacks

- [x] **Task 8: Update FindingsBrowser for Realtime Updates** (AC: 2, 4)
  - [x] Accept onRealtimeUpdate callback prop
  - [x] Invalidate React Query cache on relevant updates
  - [x] Handle optimistic updates for INSERT events (add to list immediately)
  - [x] Handle UPDATE events (update in place)
  - [x] Handle DELETE events (remove from list)
  - [x] Maintain scroll position during updates

- [x] **Task 9: Update ContradictionsView for Realtime Updates** (AC: 3, 4)
  - [x] Accept onRealtimeUpdate callback prop
  - [x] Invalidate React Query cache on updates
  - [x] Handle new contradiction INSERT (add to list)
  - [x] Handle resolution UPDATE (update status in place)
  - [x] Maintain filter state during updates

- [x] **Task 10: Write Hook Unit Tests** (AC: 1, 2, 3, 7)
  - [x] Test useFindingsRealtime subscription and cleanup
  - [x] Test useContradictionsRealtime subscription and cleanup
  - [x] Test useKnowledgeExplorerRealtime composite behavior
  - [x] Test debouncing behavior
  - [x] Test reconnection logic
  - [x] Mock Supabase Realtime using existing patterns from useDocumentUpdates.test.ts

- [x] **Task 11: Write Component Tests** (AC: 4, 5, 6, 8)
  - [x] Test ConnectionStatusIndicator rendering and interactions
  - [x] Test AutoRefreshToggle state and persistence
  - [x] Test RealtimeToastHandler notification behavior
  - [x] Test toast queue limiting
  - [x] Test keyboard shortcuts

- [x] **Task 12: Write Integration Tests** (AC: All)
  - [x] Test full Knowledge Explorer with realtime updates
  - [x] Test badge count updates
  - [x] Test auto-refresh toggle behavior
  - [x] Test connection status display
  - [x] Verify no subscription leaks on unmount

- [x] **Task 13: Verify Build and All Tests Pass** (AC: All)
  - [x] Run full test suite
  - [x] Run production build
  - [x] Manual testing of realtime flows
  - [x] Verify memory stability during extended usage

## Dev Notes

### Architecture Context

**This story adds real-time update capability to the Knowledge Explorer:**

| Layer | Technology | Existing | This Story Adds |
|-------|------------|----------|-----------------|
| UI Components | React + shadcn/ui | KnowledgeExplorerClient | **ConnectionStatusIndicator**, **AutoRefreshToggle**, **RealtimeToastHandler** |
| Hooks | React Hooks | - | **useFindingsRealtime**, **useContradictionsRealtime**, **useKnowledgeExplorerRealtime** |
| Data Sync | Supabase Realtime | useDocumentUpdates (Data Room) | **Knowledge Explorer subscriptions** |
| Notifications | sonner | Toast patterns | **Realtime-triggered toasts** |

**Real-Time Data Flow:**

```
Backend Processing Pipeline
         ↓
Supabase Database (findings/contradictions tables)
         ↓
Supabase Realtime broadcasts INSERT/UPDATE/DELETE
         ↓
useFindingsRealtime / useContradictionsRealtime hooks receive events
         ↓
useKnowledgeExplorerRealtime aggregates and debounces
         ↓
┌─────────────────────────────────────────────────┐
│ KnowledgeExplorerClient                         │
│  - Update tab badge counts                      │
│  - Trigger toast notifications                  │
│  - Invalidate React Query cache                 │
│  - Update UI optimistically                     │
└─────────────────────────────────────────────────┘
```

### Project Structure Notes

**New Files to Create:**

```
manda-app/
├── lib/hooks/
│   ├── useFindingsRealtime.ts             ← NEW: Findings realtime subscription
│   ├── useContradictionsRealtime.ts       ← NEW: Contradictions realtime subscription
│   └── useKnowledgeExplorerRealtime.ts    ← NEW: Composite hook
├── components/knowledge-explorer/
│   ├── ConnectionStatusIndicator.tsx      ← NEW: Status dot component
│   ├── AutoRefreshToggle.tsx              ← NEW: Toggle switch component
│   ├── RealtimeToastHandler.tsx           ← NEW: Toast dispatcher component
│   └── index.ts                           ← MODIFY: Export new components
└── __tests__/
    ├── lib/hooks/
    │   ├── useFindingsRealtime.test.ts    ← NEW
    │   ├── useContradictionsRealtime.test.ts ← NEW
    │   └── useKnowledgeExplorerRealtime.test.ts ← NEW
    └── components/knowledge-explorer/
        ├── ConnectionStatusIndicator.test.tsx ← NEW
        ├── AutoRefreshToggle.test.tsx     ← NEW
        └── RealtimeToastHandler.test.tsx  ← NEW
```

**Existing Files to Modify:**

- `components/knowledge-explorer/KnowledgeExplorerClient.tsx` - Integrate realtime hooks and components
- `components/knowledge-explorer/findings/FindingsBrowser.tsx` - Accept realtime callbacks
- `components/knowledge-explorer/contradictions/ContradictionsView.tsx` - Accept realtime callbacks
- `lib/hooks/index.ts` - Export new hooks

### Technical Constraints

**From Tech Spec (E4):**
- Performance: Pagination navigation < 300ms
- Optimistic updates for mutations
- Debounced inputs (300ms for search, 100ms for realtime)

**From Architecture:**
- Supabase Realtime for WebSocket connections
- React Query for client-side caching
- Row-Level Security (RLS) ensures project isolation

**Supabase Realtime Patterns (from useDocumentUpdates):**
- Channel naming: `{table}:project={projectId}`
- Filter: `deal_id=eq.${projectId}`
- Handle SUBSCRIBED, CLOSED, CHANNEL_ERROR states
- Exponential backoff for reconnection (max 30s delay)
- Clean up subscription on component unmount

### Learnings from Previous Story

**From Story e4-12 (Implement Export Findings Feature Advanced) - Status: done**

- **Toast Pattern**: Success toasts with action button - use for clickable notifications
- **Modal Pattern**: Dialog components are well established - use for any confirmation if needed
- **State Persistence**: localStorage pattern for user preferences (export history) - reuse for auto-refresh toggle
- **Accessibility**: ARIA patterns established - apply to status indicator and toggle

**From Story e3-6 (Processing Status Tracking) - Status: done**

- **useDocumentUpdates Hook**: The exact pattern to follow for realtime subscriptions
  - Location: `lib/hooks/useDocumentUpdates.ts`
  - Features: connection status, reconnection logic, event transformation
  - Test patterns: `__tests__/lib/hooks/useDocumentUpdates.test.ts`
- **Connection Status Indicator**: Already implemented in Data Room - can reference for styling
- **Debouncing**: Use 100ms for realtime, 300ms for user input

**Files/Patterns to Reuse:**
- `lib/hooks/useDocumentUpdates.ts` - Base pattern for all new realtime hooks
- `__tests__/lib/hooks/useDocumentUpdates.test.ts` - Test patterns for mocking Realtime
- `__tests__/utils/supabase-mock.ts` - Mock utilities including realtime
- `components/ui/switch.tsx` - For auto-refresh toggle
- `sonner` - Toast notifications (already integrated)

**Key Insight**: The useDocumentUpdates hook provides a proven pattern for Supabase Realtime subscriptions. This story extends that pattern to findings and contradictions tables, with the addition of debouncing and a composite hook for unified state management.

[Source: stories/e4-12-implement-export-findings-feature-advanced.md#Dev-Notes]
[Source: lib/hooks/useDocumentUpdates.ts - Full realtime subscription pattern]
[Source: components/knowledge-explorer/KnowledgeExplorerClient.tsx - Tab structure]

### References

- [Source: docs/epics.md#Story-E4.13-Build-Real-Time-Knowledge-Graph-Updates]
- [Source: docs/sprint-artifacts/tech-spec-epic-E4.md#Non-Functional-Requirements]
- [Source: docs/manda-architecture.md#Technology-Stack - Supabase Realtime]
- [Source: lib/hooks/useDocumentUpdates.ts - Realtime subscription pattern]
- [Source: __tests__/lib/hooks/useDocumentUpdates.test.ts - Test patterns]
- [Source: stories/e4-12-implement-export-findings-feature-advanced.md]

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/stories/e4-13-build-real-time-knowledge-graph-updates.context.xml

### Agent Model Used

Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References

N/A

### Completion Notes List

1. **Supabase Realtime Integration Complete**: Implemented full real-time subscription system using Supabase Realtime WebSockets for both findings and contradictions tables. Subscriptions are filtered by project_id (deal_id) for efficient data transfer.

2. **Hook Architecture**: Created three layered hooks following the existing useDocumentUpdates pattern:
   - `useFindingsRealtime` - Subscribes to findings table changes, handles INSERT/UPDATE/DELETE events
   - `useContradictionsRealtime` - Subscribes to contradictions table changes, tracks resolved/unresolved counts
   - `useKnowledgeExplorerRealtime` - Composite hook combining both, managing auto-refresh state and keyboard shortcuts

3. **UI Components**: Created three new components for the Knowledge Explorer:
   - `ConnectionStatusIndicator` - Status dot (green/yellow/red) with tooltip and click-to-reconnect
   - `AutoRefreshToggle` - Switch component with localStorage persistence and Ctrl/Cmd+Shift+R shortcut
   - `RealtimeToastHandler` - Toast dispatcher for new findings/contradictions with navigation actions

4. **Performance Optimizations**:
   - 100ms debouncing on realtime updates to prevent UI thrashing
   - Exponential backoff reconnection (max 5 attempts, 30s max delay)
   - Clean subscription cleanup on component unmount

5. **Test Coverage**: Comprehensive tests created:
   - Hook unit tests for subscription, cleanup, debouncing, reconnection
   - Component tests for rendering, interactions, keyboard shortcuts
   - Integration tests for full Knowledge Explorer realtime behavior

6. **TypeScript Fix**: Fixed type casting issue in `useFindingsRealtime.ts` line 94 - validation_history required `as unknown as` cast for proper type conversion from database record to Finding type.

7. **Missing Component Created**: Created `components/ui/switch.tsx` - shadcn/ui Switch component was missing, needed for AutoRefreshToggle. Added `@radix-ui/react-switch` dependency.

### File List

**New Files Created:**
- `lib/hooks/useFindingsRealtime.ts` - Findings realtime subscription hook
- `lib/hooks/useContradictionsRealtime.ts` - Contradictions realtime subscription hook
- `lib/hooks/useKnowledgeExplorerRealtime.ts` - Composite hook for Knowledge Explorer
- `components/knowledge-explorer/ConnectionStatusIndicator.tsx` - Status dot component
- `components/knowledge-explorer/AutoRefreshToggle.tsx` - Auto-refresh toggle switch
- `components/knowledge-explorer/RealtimeToastHandler.tsx` - Toast notification handler
- `components/ui/switch.tsx` - shadcn/ui Switch component
- `__tests__/lib/hooks/useFindingsRealtime.test.ts` - Hook unit tests
- `__tests__/lib/hooks/useContradictionsRealtime.test.ts` - Hook unit tests
- `__tests__/lib/hooks/useKnowledgeExplorerRealtime.test.ts` - Composite hook tests
- `__tests__/components/knowledge-explorer/ConnectionStatusIndicator.test.tsx` - Component tests
- `__tests__/components/knowledge-explorer/AutoRefreshToggle.test.tsx` - Component tests
- `__tests__/components/knowledge-explorer/RealtimeToastHandler.test.tsx` - Component tests
- `__tests__/components/knowledge-explorer/KnowledgeExplorerRealtime.integration.test.tsx` - Integration tests

**Modified Files:**
- `components/knowledge-explorer/KnowledgeExplorerClient.tsx` - Integrated realtime hooks and components
- `components/knowledge-explorer/findings/FindingsBrowser.tsx` - Added realtime update callbacks
- `components/knowledge-explorer/contradictions/ContradictionsView.tsx` - Added realtime update callbacks
- `components/knowledge-explorer/index.ts` - Exported new components
- `lib/hooks/index.ts` - Exported new hooks
- `package.json` - Added @radix-ui/react-switch dependency

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-30 | Story drafted from epics, tech spec, and previous story (e4-12) learnings. Last story in Epic 4. | SM Agent |
| 2025-11-30 | Story completed. All 13 tasks done. Created 3 hooks, 4 components (including switch.tsx), and comprehensive tests. Build passes. | Dev Agent (Claude Opus 4.5) |
