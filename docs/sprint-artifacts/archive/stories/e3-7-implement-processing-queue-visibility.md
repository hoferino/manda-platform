# Story 3.7: Implement Processing Queue Visibility

Status: done

## Story

As an **M&A analyst**,
I want **to see what documents are in the processing queue**,
so that **I understand what's being analyzed and can manage the queue**.

## Acceptance Criteria

1. **AC1: Processing Queue Panel Component**
   - Create a "Processing Queue" panel accessible from the Data Room
   - Display all documents currently being processed or queued
   - Show empty state when no documents are processing
   - Panel can be collapsed/expanded

2. **AC2: Queue Item Display**
   - Each queue item shows: document name, current status, time in queue
   - Display processing stage (parsing, embedding, analyzing)
   - Show estimated completion time (if available)
   - Visual indicator for current processing step

3. **AC3: Query pg-boss for Active Jobs**
   - Create FastAPI endpoint `GET /api/processing/queue` to list active jobs
   - Filter jobs by project_id for multi-tenant isolation
   - Return job metadata: document_id, status, created_at, started_at, retry_count
   - Handle pagination for large queues

4. **AC4: Cancel Job Action**
   - Add "Cancel" button for queued (not yet started) jobs
   - Create API endpoint `DELETE /api/processing/queue/{job_id}`
   - Update document status to "cancelled" when job is cancelled
   - Confirm cancellation with user before executing

5. **AC5: Real-time Queue Updates**
   - Queue panel updates in real-time as jobs progress
   - Use existing Supabase Realtime subscription (reuse useDocumentUpdates pattern)
   - Jobs removed from panel when processing completes
   - Handle WebSocket reconnection gracefully

6. **AC6: Tests Pass**
   - Unit tests for ProcessingQueue component
   - Unit tests for queue API endpoint
   - Integration tests for cancel job flow
   - Minimum 80% coverage on new code

## Tasks / Subtasks

- [x] **Task 1: Create FastAPI Queue API Endpoint** (AC: 3)
  - [x] Create `GET /api/processing/queue` endpoint in manda-processing
  - [x] Query pg-boss jobs table for active jobs (state: created, active, retry)
  - [x] Filter by project_id from request context
  - [x] Join with documents table for document metadata (file_name, file_type)
  - [x] Return structured response with job details
  - [x] Add pagination support (limit, offset)

- [x] **Task 2: Create Cancel Job API Endpoint** (AC: 4)
  - [x] Create `DELETE /api/processing/queue/{job_id}` endpoint
  - [x] Verify job belongs to user's project (authorization)
  - [x] Only allow cancellation of 'created' state jobs (not started)
  - [x] Use pg-boss cancel method to remove job
  - [x] Update document.processing_status to 'cancelled'
  - [x] Return success/failure response

- [x] **Task 3: Create Next.js API Routes** (AC: 3, 4)
  - [x] Create `/api/processing/queue/route.ts` GET handler
  - [x] Create `/api/processing/queue/[jobId]/route.ts` DELETE handler
  - [x] Forward requests to manda-processing service
  - [x] Handle authentication and error responses

- [x] **Task 4: Create ProcessingQueue Component** (AC: 1, 2)
  - [x] Create `ProcessingQueue` component in `manda-app/components/data-room/`
  - [x] Display list of queued/processing documents
  - [x] Show document name, status badge, time in queue
  - [x] Add collapsible/expandable panel behavior
  - [x] Implement empty state when queue is empty
  - [x] Show estimated completion time (based on document size/type)

- [x] **Task 5: Create QueueItem Component** (AC: 2)
  - [x] Create `QueueItem` component for individual queue entries
  - [x] Display document name with file type icon
  - [x] Show processing stage with ProcessingProgress (reuse from E3.6)
  - [x] Calculate and display time in queue
  - [x] Add Cancel button (visible only for queued jobs)
  - [x] Add Retry button (visible only for failed jobs)

- [x] **Task 6: Integrate Queue Panel in Data Room** (AC: 1, 5)
  - [x] Add ProcessingQueue panel to Data Room page
  - [x] Position in action bar or side panel
  - [x] Hook up to queue API for initial data load
  - [x] Subscribe to real-time updates using existing pattern
  - [x] Auto-refresh when documents are uploaded

- [x] **Task 7: Implement Cancel Flow** (AC: 4)
  - [x] Add confirmation dialog before cancelling
  - [x] Call cancel API on confirmation
  - [x] Show toast notification on success/failure
  - [x] Update queue display immediately (optimistic update)
  - [x] Handle edge cases (job started during cancel attempt)

- [x] **Task 8: Write Tests** (AC: 6)
  - [x] Unit tests for ProcessingQueue component
  - [x] Unit tests for QueueItem component
  - [x] Unit tests for cancel confirmation dialog
  - [x] API tests for queue endpoint (manda-processing)
  - [x] API tests for cancel endpoint (manda-processing)
  - [x] Integration test for full cancel flow

## Dev Notes

### Architecture Patterns

**Queue API Response Structure:**
```typescript
// GET /api/processing/queue response
interface QueueResponse {
  jobs: QueueJob[];
  total: number;
  hasMore: boolean;
}

interface QueueJob {
  id: string;
  documentId: string;
  documentName: string;
  fileType: string;
  status: 'queued' | 'processing' | 'failed';
  processingStage: 'parsing' | 'embedding' | 'analyzing' | null;
  createdAt: string;
  startedAt: string | null;
  timeInQueue: number; // seconds
  estimatedCompletion: string | null;
  retryCount: number;
  error: string | null;
}
```

**pg-boss Job Query:**
```python
# manda-processing/src/api/routes/processing.py
async def get_queue_jobs(project_id: str, limit: int = 20, offset: int = 0):
    """Query pg-boss for active jobs belonging to project."""
    query = """
        SELECT
            j.id,
            j.name,
            j.state,
            j.data,
            j.createdon,
            j.startedon,
            j.retrycount,
            d.file_name,
            d.file_type,
            d.processing_status
        FROM pgboss.job j
        JOIN documents d ON (j.data->>'document_id')::uuid = d.id
        WHERE d.project_id = $1
        AND j.state IN ('created', 'active', 'retry')
        ORDER BY j.createdon ASC
        LIMIT $2 OFFSET $3
    """
    return await db.fetch_all(query, [project_id, limit, offset])
```

**Cancel Job Implementation:**
```python
# manda-processing/src/api/routes/processing.py
async def cancel_job(job_id: str, project_id: str):
    """Cancel a queued job and update document status."""
    # Verify job belongs to project
    job = await get_job_with_project_check(job_id, project_id)
    if not job:
        raise HTTPException(404, "Job not found")

    if job['state'] != 'created':
        raise HTTPException(400, "Can only cancel queued jobs")

    # Cancel in pg-boss
    await pgboss.cancel(job_id)

    # Update document status
    await update_document_status(job['data']['document_id'], 'cancelled')

    return {"success": True, "message": "Job cancelled"}
```

**ProcessingQueue Component:**
```typescript
// components/data-room/ProcessingQueue.tsx
'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { QueueItem } from './QueueItem';
import { useProcessingQueue } from '@/lib/hooks/useProcessingQueue';

interface ProcessingQueueProps {
  projectId: string;
}

export function ProcessingQueue({ projectId }: ProcessingQueueProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { jobs, isLoading, refetch } = useProcessingQueue(projectId);

  // Subscribe to document updates for real-time queue changes
  useDocumentUpdates(projectId, (update) => {
    if (['pending', 'parsing', 'embedding', 'analyzing'].includes(update.document.processing_status)) {
      refetch();
    }
  });

  if (jobs.length === 0 && !isLoading) {
    return null; // Don't show panel when queue is empty
  }

  return (
    <Card className="mb-4">
      <CardHeader
        className="cursor-pointer py-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Processing Queue ({jobs.length})
          </CardTitle>
          {isExpanded ? <ChevronUp /> : <ChevronDown />}
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="pt-0">
          {jobs.map((job) => (
            <QueueItem key={job.id} job={job} onCancel={refetch} />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
```

### Database Considerations

**pg-boss Job States:**
- `created` - Job is queued, waiting to be picked up
- `active` - Job is currently being processed
- `retry` - Job failed and is waiting for retry
- `completed` - Job finished successfully (filtered out of queue view)
- `failed` - Job permanently failed after max retries
- `cancelled` - Job was cancelled by user

**Document Processing Status Mapping:**
| pg-boss State | Document Status |
|---------------|-----------------|
| created | pending |
| active | parsing/embedding/analyzing |
| retry | pending (retry scheduled) |
| cancelled | cancelled |
| failed | failed |

### Frontend Integration Points

**Existing Components to Reuse:**
- `ProcessingStatusBadge` from E3.6 - for status display
- `ProcessingProgress` from E3.6 - for stage indicator
- `useDocumentUpdates` from E3.6 - for real-time updates
- Toast system for notifications

**New Hook:**
```typescript
// lib/hooks/useProcessingQueue.ts
export function useProcessingQueue(projectId: string) {
  return useQuery({
    queryKey: ['processing-queue', projectId],
    queryFn: () => fetchQueueJobs(projectId),
    refetchInterval: 10000, // Poll every 10s as backup
  });
}
```

### Error Handling

| Scenario | User Experience |
|----------|-----------------|
| Queue API fails | Show error state with retry button |
| Cancel fails (job started) | Toast: "Job already started, cannot cancel" |
| Cancel fails (network) | Toast: "Failed to cancel, please try again" |
| Empty queue | Hide panel completely |

### Performance Considerations

- Only fetch queue when Data Room is active
- Limit queue display to 20 items with pagination
- Use optimistic updates for cancel action
- Debounce real-time updates to prevent flicker

### Project Structure Notes

**Files to Create:**
```
manda-app/
├── components/data-room/
│   ├── processing-queue.tsx
│   └── queue-item.tsx
├── lib/hooks/
│   └── useProcessingQueue.ts
├── app/api/processing/queue/
│   ├── route.ts
│   └── [jobId]/route.ts

manda-processing/
├── src/api/routes/
│   └── processing.py  (add queue endpoints)
```

**Files to Modify:**
```
manda-app/
├── app/projects/[id]/data-room/data-room-client.tsx  (add ProcessingQueue)
├── components/data-room/index.ts  (export new components)
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#E3.7-Processing-Queue-Visibility]
- [Source: docs/epics.md#Story-E3.7-Implement-Processing-Queue-Visibility]
- [Source: docs/manda-architecture.md#Background-Processing]

### Learnings from Previous Story

**From Story e3-6-create-processing-status-tracking-and-websocket-updates (Status: done)**

- **ProcessingStatusBadge Available**: Comprehensive status badge component at `manda-app/components/data-room/processing-status-badge.tsx` - supports all granular statuses (pending, parsing, parsed, embedding, analyzing, analyzed, complete, failed, analysis_failed)

- **ProcessingProgress Available**: Pipeline progress indicator at `manda-app/components/data-room/processing-progress.tsx` - shows stages with checkmarks and spinner

- **useDocumentUpdates Hook**: Supabase Realtime subscription hook at `manda-app/lib/hooks/useDocumentUpdates.ts` - provides:
  - Project-filtered document change subscriptions
  - Connection status tracking (connecting, connected, disconnected, error)
  - Helper functions for detecting status changes
  - **REUSE**: Subscribe to document updates to trigger queue refresh

- **Real-time Pattern**: DataRoomClient integration pattern established:
  - Live document list updates
  - Connection status indicator in action bar
  - Toast notifications for completion/failures
  - **REUSE**: Same pattern for queue panel updates

- **Retry API**: `/api/documents/[id]/retry` endpoint exists - validates failed state, resets status, triggers webhook
  - **NOTE**: This story adds cancel functionality, similar pattern

- **ProcessingStatus Type**: Updated Document type with granular ProcessingStatus type at `manda-app/lib/api/documents.ts`

- **Test Patterns**: 207 tests passing - follow established patterns for:
  - Component tests with mocked dependencies
  - Hook tests with mocked Supabase client
  - API route tests

[Source: stories/e3-6-create-processing-status-tracking-and-websocket-updates.md#Dev-Agent-Record]

## Dev Agent Record

### Context Reference

- [e3-7-implement-processing-queue-visibility.context.xml](e3-7-implement-processing-queue-visibility.context.xml)

### Agent Model Used

claude-opus-4-5-20251101

### Debug Log References

N/A

### Completion Notes List

1. **FastAPI Queue Endpoints Created**: Added `GET /api/processing/queue` and `DELETE /api/processing/queue/{job_id}` endpoints in `manda-processing/src/api/routes/processing.py`. Queries pg-boss job table joined with documents for metadata, filters by project_id, supports pagination.

2. **Next.js API Routes Created**: Proxy routes at `manda-app/app/api/processing/queue/route.ts` and `manda-app/app/api/processing/queue/[jobId]/route.ts` forward requests to manda-processing with authentication.

3. **ProcessingQueue Component**: Collapsible panel component at `manda-app/components/data-room/processing-queue.tsx` shows queue status with real-time updates via document subscription. Empty state hides panel.

4. **QueueItem Component**: Individual queue entry at `manda-app/components/data-room/queue-item.tsx` displays document name, file icon, processing stage (reuses ProcessingProgress), time in queue, and action buttons (Cancel for queued, Retry for failed).

5. **useProcessingQueue Hook**: Data fetching hook at `manda-app/lib/hooks/useProcessingQueue.ts` with polling (10s backup) and pagination support.

6. **Processing API Client**: Type definitions and fetch functions at `manda-app/lib/api/processing.ts`.

7. **Integration**: ProcessingQueue integrated into DataRoomClient above document list.

8. **Tests**: Unit tests for QueueItem, ProcessingQueue components, useProcessingQueue hook, and FastAPI endpoints.

### File List

**Created:**
- `manda-processing/src/api/routes/processing.py` - FastAPI queue endpoints
- `manda-app/app/api/processing/queue/route.ts` - Next.js GET route
- `manda-app/app/api/processing/queue/[jobId]/route.ts` - Next.js DELETE route
- `manda-app/components/data-room/processing-queue.tsx` - Queue panel component
- `manda-app/components/data-room/queue-item.tsx` - Queue item component
- `manda-app/lib/hooks/useProcessingQueue.ts` - Queue data hook
- `manda-app/lib/api/processing.ts` - API client and types
- `manda-app/__tests__/components/data-room/queue-item.test.tsx` - QueueItem tests
- `manda-app/__tests__/components/data-room/processing-queue.test.tsx` - ProcessingQueue tests
- `manda-app/__tests__/lib/hooks/useProcessingQueue.test.ts` - Hook tests
- `manda-processing/tests/unit/test_api/test_processing.py` - FastAPI tests

**Modified:**
- `manda-processing/src/main.py` - Added processing router
- `manda-app/components/data-room/index.ts` - Export new components
- `manda-app/lib/hooks/index.ts` - Export new hook
- `manda-app/app/projects/[id]/data-room/data-room-client.tsx` - Integrated ProcessingQueue

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-27 | Story drafted | SM Agent |
| 2025-11-27 | Context generated, status changed to ready-for-dev | SM Agent |
| 2025-11-27 | Implementation completed, all tasks done | Dev Agent (Opus 4.5) |
