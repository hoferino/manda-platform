# Story 3.8: Implement Retry Logic for Failed Processing

Status: ready-for-dev

## Story

As an **M&A analyst**,
I want **failed document processing to automatically retry and resume from the failed stage**,
so that **temporary failures don't require manual intervention and I can focus on analysis**.

## Acceptance Criteria

1. **AC1: Automatic Retry with Exponential Backoff**
   - Jobs automatically retry up to 3 times on transient failures
   - Retry delay increases exponentially: 5s → 10s → 20s
   - Permanent failures (invalid file, unsupported format) skip retry
   - Document status shows "Retrying (attempt 2/3)" during retry

2. **AC2: Stage-Aware Retry (Resume from Failed Stage)**
   - Track last successful processing stage in document metadata
   - On retry, resume from failed stage instead of restarting
   - Skip completed stages: If parsing succeeded, retry starts at embedding
   - Clear only the failed stage's data on retry (preserve prior work)

3. **AC3: Error Classification System**
   - Classify errors as transient (retry) vs permanent (fail immediately)
   - Transient: Network timeout, rate limit, service unavailable, DB deadlock
   - Permanent: Invalid file format, file corrupted, unsupported type, auth error
   - Store error classification in `processing_error` JSON field

4. **AC4: Enhanced Error Reporting**
   - Store structured error details: error_type, message, stage, timestamp, retry_count
   - Display user-friendly error messages in Document Details panel
   - Show retry history with timestamps and error messages
   - Provide actionable guidance: "File appears corrupted - please re-upload"

5. **AC5: Manual Retry with Stage Selection**
   - "Retry Processing" button in Document Details (existing)
   - Option to retry from specific stage or full reprocess
   - Disable retry for documents with permanent errors (show reason)
   - Confirm before full reprocess if partial results exist

6. **AC6: Tests Pass**
   - Unit tests for error classification logic
   - Unit tests for stage-aware retry
   - Integration tests for retry flow (mock transient failures)
   - Minimum 80% coverage on new code

## Tasks / Subtasks

- [ ] **Task 1: Implement Error Classification** (AC: 3)
  - [ ] Create `ErrorClassifier` class in `manda-processing/src/jobs/errors.py`
  - [ ] Define error categories: `transient`, `permanent`, `unknown`
  - [ ] Map exception types to categories (NetworkError → transient, ValueError → permanent)
  - [ ] Add classification method that inspects exception and message
  - [ ] Include retry recommendation in classification result

- [ ] **Task 2: Add Stage Tracking to Documents** (AC: 2)
  - [ ] Add `last_completed_stage` column to documents table (migration)
  - [ ] Update handlers to set stage on completion: parsing → parsed, embedding → embedded
  - [ ] Add `retry_from_stage` field to job data
  - [ ] Create helper to determine next stage based on last_completed_stage

- [ ] **Task 3: Implement Stage-Aware Retry in Job Handlers** (AC: 2)
  - [ ] Modify `handle_parse_document` to check if already parsed (skip if so)
  - [ ] Modify `handle_generate_embeddings` to check if already embedded
  - [ ] Modify `handle_analyze_document` to check if already analyzed
  - [ ] Add logic to clear only failed stage data on retry
  - [ ] Preserve chunks/embeddings from successful stages

- [ ] **Task 4: Enhance Error Handling in Job Handlers** (AC: 3, 4)
  - [ ] Wrap handler logic with error classification
  - [ ] Store structured error in `processing_error` JSON field
  - [ ] Include: error_type, message, stage, timestamp, stack_trace (truncated)
  - [ ] Log classified errors with appropriate severity
  - [ ] Update document status based on error classification

- [ ] **Task 5: Create Retry History Tracking** (AC: 4)
  - [ ] Add `retry_history` JSONB column to documents table (migration)
  - [ ] Append retry attempt to history: {attempt, stage, error, timestamp}
  - [ ] Limit history to last 10 attempts
  - [ ] Create API endpoint to fetch retry history

- [ ] **Task 6: Update Document Details UI for Retry** (AC: 4, 5)
  - [ ] Display retry count and history in Document Details panel
  - [ ] Show user-friendly error message based on error_type
  - [ ] Add "Retry from Stage" dropdown (Parse, Embed, Analyze, Full)
  - [ ] Disable retry button for permanent errors with explanation
  - [ ] Show confirmation dialog if partial results exist

- [ ] **Task 7: Update Retry API Endpoint** (AC: 5)
  - [ ] Add `from_stage` query parameter to `/api/documents/[id]/retry`
  - [ ] Validate stage parameter (must be >= last_completed_stage)
  - [ ] Pass stage to webhook payload for stage-aware retry
  - [ ] Return updated document with retry_history

- [ ] **Task 8: Write Tests** (AC: 6)
  - [ ] Unit tests for ErrorClassifier
  - [ ] Unit tests for stage determination logic
  - [ ] Unit tests for retry history tracking
  - [ ] Integration tests for stage-aware retry flow
  - [ ] Frontend tests for retry UI components

## Dev Notes

### Architecture Patterns

**Error Classification:**
```python
# manda-processing/src/jobs/errors.py
from enum import Enum
from dataclasses import dataclass
from typing import Optional
import re

class ErrorCategory(str, Enum):
    TRANSIENT = "transient"  # Retry
    PERMANENT = "permanent"  # Fail immediately
    UNKNOWN = "unknown"      # Default to retry

@dataclass
class ClassifiedError:
    category: ErrorCategory
    error_type: str
    message: str
    should_retry: bool
    user_message: str
    guidance: Optional[str] = None

class ErrorClassifier:
    """Classify errors for retry decisions."""

    TRANSIENT_PATTERNS = [
        (r"timeout|timed out", "timeout"),
        (r"rate.?limit|429|too many requests", "rate_limit"),
        (r"service.?unavailable|503", "service_unavailable"),
        (r"connection.?(refused|reset|error)", "connection_error"),
        (r"deadlock|lock.?timeout", "database_lock"),
        (r"temporary|transient", "transient_error"),
    ]

    PERMANENT_PATTERNS = [
        (r"invalid.?file|file.?corrupt", "invalid_file"),
        (r"unsupported.?(format|type)", "unsupported_format"),
        (r"permission.?denied|403|unauthorized|401", "auth_error"),
        (r"not.?found|404|does.?not.?exist", "not_found"),
        (r"validation.?error|invalid.?data", "validation_error"),
    ]

    def classify(self, error: Exception) -> ClassifiedError:
        """Classify an error for retry decisions."""
        message = str(error).lower()
        error_name = type(error).__name__

        # Check transient patterns
        for pattern, error_type in self.TRANSIENT_PATTERNS:
            if re.search(pattern, message):
                return ClassifiedError(
                    category=ErrorCategory.TRANSIENT,
                    error_type=error_type,
                    message=str(error),
                    should_retry=True,
                    user_message=self._get_user_message(error_type),
                )

        # Check permanent patterns
        for pattern, error_type in self.PERMANENT_PATTERNS:
            if re.search(pattern, message):
                return ClassifiedError(
                    category=ErrorCategory.PERMANENT,
                    error_type=error_type,
                    message=str(error),
                    should_retry=False,
                    user_message=self._get_user_message(error_type),
                    guidance=self._get_guidance(error_type),
                )

        # Default: unknown, retry once
        return ClassifiedError(
            category=ErrorCategory.UNKNOWN,
            error_type="unknown",
            message=str(error),
            should_retry=True,
            user_message="An unexpected error occurred",
        )
```

**Stage-Aware Retry:**
```python
# In job handler
class ProcessingStage(str, Enum):
    PENDING = "pending"
    PARSED = "parsed"
    EMBEDDED = "embedded"
    ANALYZED = "analyzed"
    COMPLETE = "complete"

def get_next_stage(last_completed: ProcessingStage | None) -> ProcessingStage:
    """Determine which stage to start from."""
    if last_completed is None:
        return ProcessingStage.PENDING

    stage_order = [
        ProcessingStage.PENDING,
        ProcessingStage.PARSED,
        ProcessingStage.EMBEDDED,
        ProcessingStage.ANALYZED,
        ProcessingStage.COMPLETE,
    ]

    current_idx = stage_order.index(last_completed)
    if current_idx + 1 < len(stage_order):
        return stage_order[current_idx + 1]
    return ProcessingStage.COMPLETE

async def handle_parse_document(job: Job) -> dict:
    """Parse document with stage-aware retry."""
    document_id = job.data["document_id"]
    retry_from_stage = job.data.get("retry_from_stage")

    # Check if already parsed and not forcing reparse
    doc = await get_document(document_id)
    if doc.last_completed_stage == "parsed" and retry_from_stage != "pending":
        logger.info("Skipping parse - already completed", document_id=document_id)
        # Enqueue next stage
        await enqueue_embeddings(document_id)
        return {"status": "skipped", "reason": "already_parsed"}

    # Proceed with parsing...
```

**Structured Error Storage:**
```typescript
// processing_error JSON structure
interface ProcessingError {
  error_type: string;        // "timeout" | "rate_limit" | "invalid_file" | etc.
  category: string;          // "transient" | "permanent" | "unknown"
  message: string;           // Full error message
  stage: string;             // "parsing" | "embedding" | "analyzing"
  timestamp: string;         // ISO timestamp
  retry_count: number;       // Current retry attempt
  stack_trace?: string;      // Truncated stack trace (first 500 chars)
  guidance?: string;         // User guidance message
}

// retry_history JSON structure
type RetryHistory = Array<{
  attempt: number;
  stage: string;
  error_type: string;
  message: string;
  timestamp: string;
}>;
```

**Database Migration:**
```sql
-- 00018_add_retry_tracking.sql
ALTER TABLE documents
ADD COLUMN last_completed_stage TEXT DEFAULT NULL;

ALTER TABLE documents
ADD COLUMN retry_history JSONB DEFAULT '[]'::jsonb;

-- Add check constraint for valid stages
ALTER TABLE documents
ADD CONSTRAINT valid_last_completed_stage
CHECK (last_completed_stage IN ('parsed', 'embedded', 'analyzed', 'complete') OR last_completed_stage IS NULL);

-- Index for finding documents in specific stages
CREATE INDEX idx_documents_last_completed_stage ON documents(last_completed_stage)
WHERE last_completed_stage IS NOT NULL;

COMMENT ON COLUMN documents.last_completed_stage IS 'Last successfully completed processing stage';
COMMENT ON COLUMN documents.retry_history IS 'History of retry attempts with errors';
```

### Error Type to User Message Mapping

| Error Type | User Message | Guidance |
|------------|--------------|----------|
| timeout | Processing timed out | Will retry automatically. Large documents may take longer. |
| rate_limit | Service temporarily busy | Will retry in a few seconds. |
| service_unavailable | Processing service unavailable | Will retry automatically. |
| connection_error | Network connection error | Will retry automatically. |
| invalid_file | File appears to be invalid or corrupted | Please re-upload the document. |
| unsupported_format | File format not supported | Supported formats: PDF, XLSX, DOCX, TXT |
| auth_error | Access denied | Contact administrator if issue persists. |
| not_found | Document file not found | Please re-upload the document. |

### Retry Flow Diagram

```
Document Upload
      │
      ▼
┌─────────────────┐
│   PARSE JOB     │
│ last_stage=null │
└────────┬────────┘
         │
    ┌────┴────┐
    │ Success │──────────────────────────────────────┐
    └────┬────┘                                      │
         │                                           │
    ┌────┴────┐                                      │
    │ Failure │                                      │
    └────┬────┘                                      │
         │                                           │
    ┌────┴────────────┐                              │
    │ Classify Error  │                              │
    └────┬────────────┘                              │
         │                                           │
    ┌────┴────┐    ┌──────────┐                     │
    │Transient│───▶│ RETRY    │                     │
    └─────────┘    │ (wait)   │                     │
                   └────┬─────┘                     │
                        │                           │
    ┌─────────┐    ┌────┴─────┐                     │
    │Permanent│───▶│ FAIL     │                     │
    └─────────┘    │ (no retry)│                    │
                   └──────────┘                     │
                                                    │
                                               ┌────┴─────┐
                                               │last_stage│
                                               │= "parsed"│
                                               └────┬─────┘
                                                    │
                                                    ▼
                                          ┌─────────────────┐
                                          │  EMBED JOB      │
                                          │ (skip if done)  │
                                          └────────┬────────┘
                                                   │
                                              [continues...]
```

### Frontend Integration Points

**Existing Components to Modify:**
- `DocumentDetails` panel - Add retry history display, stage selector
- `ProcessingStatusBadge` - Show retry count in badge
- `QueueItem` - Show retry attempt number

**User-Friendly Error Display:**
```tsx
// In DocumentDetails panel
function ErrorDisplay({ error }: { error: ProcessingError }) {
  const isPermanent = error.category === 'permanent';

  return (
    <Alert variant={isPermanent ? 'destructive' : 'warning'}>
      <AlertTitle>{error.user_message}</AlertTitle>
      {error.guidance && (
        <AlertDescription>{error.guidance}</AlertDescription>
      )}
      {!isPermanent && error.retry_count < 3 && (
        <p className="text-sm text-muted-foreground mt-2">
          Retry attempt {error.retry_count}/3 scheduled
        </p>
      )}
    </Alert>
  );
}
```

### References

- [Source: docs/sprint-artifacts/tech-spec-epic-E3.md#E3.8-Retry-Logic]
- [Source: docs/epics.md#Story-E3.8]
- [Source: docs/manda-architecture.md#Error-Handling]

### Learnings from Previous Stories

**From Story e3-7-implement-processing-queue-visibility (Status: done)**

- **ProcessingQueue Component**: Shows queue with retry button for failed jobs
- **QueueItem Component**: Already has retry handler that calls `/api/documents/[id]/retry`
- **Retry API Exists**: `/api/documents/[id]/retry` resets status and triggers webhook
- **pg-boss Retry**: Built-in 3x retry with exponential backoff already configured
- **REUSE**: Extend existing retry flow, don't replace

**From Story e3-6-create-processing-status-tracking-and-websocket-updates (Status: done)**

- **ProcessingStatusBadge**: Already shows failed state - can add retry count
- **DocumentDetails**: Has "Retry Processing" button - add stage selection
- **Real-time Updates**: Status changes broadcast via Supabase Realtime
- **Toast Notifications**: Show on failure - can include guidance

**Key Implementation Notes:**
- pg-boss already handles automatic retry (3 attempts, exponential backoff)
- Focus on: error classification, stage-aware resume, better error UX
- Don't break existing retry flow - enhance it

## Dev Agent Record

### Context Reference

- [e3-8-implement-retry-logic-for-failed-processing.context.xml](e3-8-implement-retry-logic-for-failed-processing.context.xml)

### Agent Model Used

{{agent_model_name_version}}

### Debug Log References

### Completion Notes List

### File List

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-11-27 | Story drafted | SM Agent |
