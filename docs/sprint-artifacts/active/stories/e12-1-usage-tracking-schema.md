# Story 12.1: Usage Tracking Database Schema

**Status:** done

## Story

As a **platform developer**,
I want **a database schema to persist LLM usage, costs, and feature metrics**,
so that **I can query usage data for cost visibility, performance analysis, and alerting**.

## Acceptance Criteria

1. **LLM Usage Table** - PostgreSQL table `llm_usage` with columns: id, deal_id, user_id, organization_id, provider, model, feature, input_tokens, output_tokens, cost_usd, latency_ms, created_at
2. **Feature Usage Table** - PostgreSQL table `feature_usage` with columns: id, deal_id, user_id, organization_id, feature_name, status, duration_ms, error_message, metadata, created_at
3. **Indexes** - Efficient indexes on (organization_id, created_at) and (deal_id, created_at) for dashboard queries
4. **TypeScript Types** - Generated types include `LlmUsage` and `FeatureUsage` interfaces
5. **Python Models** - Pydantic models for `LlmUsage` and `FeatureUsage` in storage models

## Tasks / Subtasks

### Task 1: Create Database Migration (AC: #1, #2, #3)

- [x] **1.1 Create migration file `manda-app/supabase/migrations/00045_usage_tracking.sql`:**

```sql
-- Migration: 00045_usage_tracking
-- Description: Create llm_usage and feature_usage tables for observability
-- Story: E12.1 - Usage Tracking Database Schema
-- Epic: E12 - Production Readiness & Observability

-- ============================================================
-- LLM Usage Table: Track every LLM API call
-- ============================================================
CREATE TABLE llm_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,           -- google-gla, anthropic, voyage, openai
  model VARCHAR(100) NOT NULL,             -- gemini-2.5-flash, claude-sonnet-4-0, voyage-3.5
  feature VARCHAR(100) NOT NULL,           -- chat, document_analysis, extraction, embeddings, reranking
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE llm_usage IS 'Track every LLM API call for cost visibility and analysis';
COMMENT ON COLUMN llm_usage.provider IS 'LLM provider: google-gla, anthropic, voyage, openai';
COMMENT ON COLUMN llm_usage.model IS 'Model identifier: gemini-2.5-flash, claude-sonnet-4-0, voyage-3.5';
COMMENT ON COLUMN llm_usage.feature IS 'Feature using LLM: chat, document_analysis, extraction, embeddings, reranking';
COMMENT ON COLUMN llm_usage.cost_usd IS 'Estimated cost in USD based on token pricing';

-- ============================================================
-- Feature Usage Table: Track feature-level metrics
-- ============================================================
CREATE TABLE feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  feature_name VARCHAR(100) NOT NULL,      -- upload_document, chat, search, qa_response, cim_generation
  status VARCHAR(20) NOT NULL,             -- success, error, timeout
  duration_ms INTEGER,
  error_message TEXT,
  metadata JSONB,                          -- Flexible metadata for feature-specific data
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE feature_usage IS 'Track feature-level metrics for performance analysis';
COMMENT ON COLUMN feature_usage.feature_name IS 'Feature name: upload_document, chat, search, qa_response, cim_generation';
COMMENT ON COLUMN feature_usage.status IS 'Execution status: success, error, timeout';
COMMENT ON COLUMN feature_usage.metadata IS 'Feature-specific data: document_count, query_type, etc.';

-- ============================================================
-- Indexes for Dashboard Queries
-- ============================================================

-- Primary query pattern: organization costs over time
CREATE INDEX idx_llm_usage_org_time ON llm_usage(organization_id, created_at);

-- Secondary: per-deal cost breakdown
CREATE INDEX idx_llm_usage_deal_time ON llm_usage(deal_id, created_at);

-- Feature breakdown queries
CREATE INDEX idx_llm_usage_feature ON llm_usage(feature, created_at);

-- Similar indexes for feature_usage
CREATE INDEX idx_feature_usage_org_time ON feature_usage(organization_id, created_at);
CREATE INDEX idx_feature_usage_deal_time ON feature_usage(deal_id, created_at);
CREATE INDEX idx_feature_usage_name ON feature_usage(feature_name, created_at);

-- Error analysis queries
CREATE INDEX idx_feature_usage_status ON feature_usage(status) WHERE status != 'success';

-- ============================================================
-- Row-Level Security
-- ============================================================

-- Enable RLS
ALTER TABLE llm_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Users see their org's usage, superadmin sees all
-- Note: Uses helper functions created in 00043_organization_rls_policies.sql
CREATE POLICY "org_isolation_llm_usage" ON llm_usage
FOR ALL USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())  -- Legacy data before org assignment
);

CREATE POLICY "org_isolation_feature_usage" ON feature_usage
FOR ALL USING (
  is_superadmin()
  OR organization_id IN (SELECT user_organization_ids())
  OR (organization_id IS NULL AND user_id = auth.uid())  -- Legacy data before org assignment
);
```

- [x] **1.2 Apply migration to Supabase:**
```bash
cd manda-app
npx supabase db push
# OR for hosted Supabase:
# npx supabase db push --linked
```

- [x] **1.3 Verify migration applied:**
```sql
-- Run in Supabase SQL Editor or psql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('llm_usage', 'feature_usage');

-- Verify indexes
SELECT indexname FROM pg_indexes
WHERE tablename IN ('llm_usage', 'feature_usage');
```

---

### Task 2: Regenerate TypeScript Types (AC: #4)

- [x] **2.1 Regenerate database types:**
```bash
cd manda-app
npm run db:types
```

- [x] **2.2 Verify generated types in `manda-app/lib/supabase/database.types.ts`:**

Expected interfaces (auto-generated):
```typescript
// These will be in Tables interface
export interface LlmUsage {
  id: string
  deal_id: string | null
  user_id: string | null
  organization_id: string | null
  provider: string
  model: string
  feature: string
  input_tokens: number
  output_tokens: number
  cost_usd: number  // Decimal maps to number
  latency_ms: number | null
  created_at: string
}

export interface FeatureUsage {
  id: string
  deal_id: string | null
  user_id: string | null
  organization_id: string | null
  feature_name: string
  status: string
  duration_ms: number | null
  error_message: string | null
  metadata: Json | null
  created_at: string
}
```

- [x] **2.3 Create helper types in `manda-app/lib/types/usage.ts`:**

```typescript
/**
 * Usage tracking types for E12 observability.
 * Story: E12.1 - Usage Tracking Database Schema
 */

import { z } from 'zod'

// ============================================================
// LLM Usage Types
// ============================================================

export const LLM_PROVIDERS = ['google-gla', 'anthropic', 'voyage', 'openai'] as const
export type LLMProvider = typeof LLM_PROVIDERS[number]

export const LLM_FEATURES = [
  'chat',
  'document_analysis',
  'extraction',
  'embeddings',
  'reranking',
  'contradiction_detection',
  'qa_ingestion',
] as const
export type LLMFeature = typeof LLM_FEATURES[number]

export const CreateLlmUsageSchema = z.object({
  dealId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  provider: z.enum(LLM_PROVIDERS),
  model: z.string().min(1),
  feature: z.enum(LLM_FEATURES),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  latencyMs: z.number().int().min(0).optional(),
})

export type CreateLlmUsageInput = z.infer<typeof CreateLlmUsageSchema>

// ============================================================
// Feature Usage Types
// ============================================================

export const FEATURE_NAMES = [
  'upload_document',
  'chat',
  'search',
  'qa_response',
  'cim_generation',
  'irl_generation',
  'document_processing',
  'knowledge_retrieval',
] as const
export type FeatureName = typeof FEATURE_NAMES[number]

export const FEATURE_STATUSES = ['success', 'error', 'timeout'] as const
export type FeatureStatus = typeof FEATURE_STATUSES[number]

export const CreateFeatureUsageSchema = z.object({
  dealId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  featureName: z.enum(FEATURE_NAMES),
  status: z.enum(FEATURE_STATUSES),
  durationMs: z.number().int().min(0).optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
})

export type CreateFeatureUsageInput = z.infer<typeof CreateFeatureUsageSchema>

// ============================================================
// Query Types (for E12.3 dashboard)
// ============================================================

export interface DailyCost {
  date: string
  costUsd: number
  tokens: number
}

export interface FeatureCost {
  feature: string
  costUsd: number
  callCount: number
}

export interface ProviderCost {
  provider: string
  costUsd: number
  callCount: number
}

export interface DealCostSummary {
  dealId: string
  dealName: string
  totalCostUsd: number
  conversationCount: number
  documentCount: number
}
```

---

### Task 3: Create Python Models (AC: #5)

- [x] **3.1 Add models to `manda-processing/src/storage/models.py`:**

```python
# Add to existing models.py after OrganizationContext class

# ============================================================
# Usage Tracking Models (E12.1)
# ============================================================

from decimal import Decimal
from enum import Enum


class LLMProvider(str, Enum):
    """LLM provider identifiers."""
    GOOGLE_GLA = "google-gla"
    ANTHROPIC = "anthropic"
    VOYAGE = "voyage"
    OPENAI = "openai"


class LLMFeature(str, Enum):
    """Features that use LLM calls."""
    CHAT = "chat"
    DOCUMENT_ANALYSIS = "document_analysis"
    EXTRACTION = "extraction"
    EMBEDDINGS = "embeddings"
    RERANKING = "reranking"
    CONTRADICTION_DETECTION = "contradiction_detection"
    QA_INGESTION = "qa_ingestion"


class FeatureStatus(str, Enum):
    """Feature execution status."""
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"


class LlmUsage(BaseModel):
    """
    LLM API usage record for cost tracking.

    Story: E12.1 - Usage Tracking Database Schema
    """
    id: UUID
    deal_id: UUID | None = None
    user_id: UUID | None = None
    organization_id: UUID | None = None
    provider: LLMProvider
    model: str
    feature: LLMFeature
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Decimal = Decimal("0")
    latency_ms: int | None = None
    created_at: datetime


class LlmUsageCreate(BaseModel):
    """
    Input for creating LLM usage record.

    Note: id and created_at are auto-generated.
    """
    deal_id: UUID | None = None
    user_id: UUID | None = None
    organization_id: UUID | None = None
    provider: LLMProvider
    model: str
    feature: LLMFeature
    input_tokens: int = 0
    output_tokens: int = 0
    cost_usd: Decimal = Decimal("0")
    latency_ms: int | None = None


class FeatureUsage(BaseModel):
    """
    Feature-level usage record for performance analysis.

    Story: E12.1 - Usage Tracking Database Schema
    """
    id: UUID
    deal_id: UUID | None = None
    user_id: UUID | None = None
    organization_id: UUID | None = None
    feature_name: str
    status: FeatureStatus
    duration_ms: int | None = None
    error_message: str | None = None
    metadata: dict | None = None
    created_at: datetime


class FeatureUsageCreate(BaseModel):
    """
    Input for creating feature usage record.

    Note: id and created_at are auto-generated.
    """
    deal_id: UUID | None = None
    user_id: UUID | None = None
    organization_id: UUID | None = None
    feature_name: str
    status: FeatureStatus
    duration_ms: int | None = None
    error_message: str | None = None
    metadata: dict | None = None
```

- [x] **3.2 Update `__init__.py` exports:**

In `manda-processing/src/storage/__init__.py`, update imports and `__all__`:
```python
"""
Storage clients for file and database operations.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #2)
Story: E12.9 - Multi-Tenant Data Isolation (AC: #1, #2)
Story: E12.1 - Usage Tracking Database Schema (AC: #5)

This module provides:
- GCS client for Google Cloud Storage operations
- Supabase client for database operations
- Organization models for multi-tenant isolation
- Usage tracking models for observability
"""

from src.storage.gcs_client import GCSClient, get_gcs_client
from src.storage.models import (
    Organization,
    OrganizationContext,
    OrganizationMember,
    # E12.1 - Usage tracking
    LLMProvider,
    LLMFeature,
    FeatureStatus,
    LlmUsage,
    LlmUsageCreate,
    FeatureUsage,
    FeatureUsageCreate,
)
from src.storage.supabase_client import SupabaseClient, get_supabase_client

__all__ = [
    "GCSClient",
    "get_gcs_client",
    "Organization",
    "OrganizationContext",
    "OrganizationMember",
    "SupabaseClient",
    "get_supabase_client",
    # E12.1 - Usage tracking
    "LLMProvider",
    "LLMFeature",
    "FeatureStatus",
    "LlmUsage",
    "LlmUsageCreate",
    "FeatureUsage",
    "FeatureUsageCreate",
]
```

---

### Task 4: Create Unit Tests (All ACs)

- [x] **4.1 Create `manda-app/__tests__/lib/types/usage.test.ts`:**

```typescript
import { describe, it, expect } from 'vitest'
import {
  CreateLlmUsageSchema,
  CreateFeatureUsageSchema,
  LLM_PROVIDERS,
  LLM_FEATURES,
  FEATURE_NAMES,
  FEATURE_STATUSES,
} from '@/lib/types/usage'

describe('Usage Types', () => {
  describe('CreateLlmUsageSchema', () => {
    it('validates valid LLM usage input', () => {
      const input = {
        dealId: '550e8400-e29b-41d4-a716-446655440000',
        userId: '550e8400-e29b-41d4-a716-446655440001',
        organizationId: '550e8400-e29b-41d4-a716-446655440002',
        provider: 'google-gla',
        model: 'gemini-2.5-flash',
        feature: 'chat',
        inputTokens: 1000,
        outputTokens: 500,
        costUsd: 0.0015,
        latencyMs: 1234,
      }

      const result = CreateLlmUsageSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('rejects invalid provider', () => {
      const input = {
        provider: 'invalid-provider',
        model: 'test-model',
        feature: 'chat',
        inputTokens: 100,
        outputTokens: 50,
        costUsd: 0.001,
      }

      const result = CreateLlmUsageSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('rejects negative tokens', () => {
      const input = {
        provider: 'anthropic',
        model: 'claude-sonnet-4-0',
        feature: 'chat',
        inputTokens: -100,
        outputTokens: 50,
        costUsd: 0.001,
      }

      const result = CreateLlmUsageSchema.safeParse(input)
      expect(result.success).toBe(false)
    })

    it('allows optional fields to be omitted', () => {
      const input = {
        provider: 'voyage',
        model: 'voyage-3.5',
        feature: 'embeddings',
        inputTokens: 5000,
        outputTokens: 0,
        costUsd: 0.0003,
      }

      const result = CreateLlmUsageSchema.safeParse(input)
      expect(result.success).toBe(true)
    })
  })

  describe('CreateFeatureUsageSchema', () => {
    it('validates valid feature usage input', () => {
      const input = {
        dealId: '550e8400-e29b-41d4-a716-446655440000',
        featureName: 'upload_document',
        status: 'success',
        durationMs: 5432,
        metadata: { documentCount: 3, totalBytes: 1024000 },
      }

      const result = CreateFeatureUsageSchema.safeParse(input)
      expect(result.success).toBe(true)
    })

    it('validates error status with message', () => {
      const input = {
        featureName: 'chat',
        status: 'error',
        errorMessage: 'Rate limit exceeded',
        metadata: { retryCount: 3 },
      }

      const result = CreateFeatureUsageSchema.safeParse(input)
      expect(result.success).toBe(true)
    })
  })

  describe('Enum Constants', () => {
    it('LLM_PROVIDERS includes expected providers', () => {
      expect(LLM_PROVIDERS).toContain('google-gla')
      expect(LLM_PROVIDERS).toContain('anthropic')
      expect(LLM_PROVIDERS).toContain('voyage')
      expect(LLM_PROVIDERS).toContain('openai')
    })

    it('LLM_FEATURES includes expected features', () => {
      expect(LLM_FEATURES).toContain('chat')
      expect(LLM_FEATURES).toContain('document_analysis')
      expect(LLM_FEATURES).toContain('embeddings')
    })

    it('FEATURE_STATUSES includes success, error, timeout', () => {
      expect(FEATURE_STATUSES).toContain('success')
      expect(FEATURE_STATUSES).toContain('error')
      expect(FEATURE_STATUSES).toContain('timeout')
    })
  })
})
```

- [x] **4.2 Create `manda-processing/tests/unit/test_storage/test_usage_models.py`:**

```python
"""Unit tests for E12.1 usage tracking models."""
import pytest
from decimal import Decimal
from datetime import datetime
from uuid import uuid4

from src.storage.models import (
    LLMProvider,
    LLMFeature,
    FeatureStatus,
    LlmUsage,
    LlmUsageCreate,
    FeatureUsage,
    FeatureUsageCreate,
)


class TestLlmUsageModels:
    """Test LLM usage Pydantic models."""

    def test_llm_usage_create_valid(self):
        """Valid LlmUsageCreate should pass validation."""
        usage = LlmUsageCreate(
            deal_id=uuid4(),
            user_id=uuid4(),
            organization_id=uuid4(),
            provider=LLMProvider.GOOGLE_GLA,
            model="gemini-2.5-flash",
            feature=LLMFeature.CHAT,
            input_tokens=1000,
            output_tokens=500,
            cost_usd=Decimal("0.0015"),
            latency_ms=1234,
        )
        assert usage.provider == LLMProvider.GOOGLE_GLA
        assert usage.input_tokens == 1000
        assert usage.cost_usd == Decimal("0.0015")

    def test_llm_usage_create_minimal(self):
        """LlmUsageCreate with only required fields."""
        usage = LlmUsageCreate(
            provider=LLMProvider.ANTHROPIC,
            model="claude-sonnet-4-0",
            feature=LLMFeature.DOCUMENT_ANALYSIS,
        )
        assert usage.deal_id is None
        assert usage.input_tokens == 0
        assert usage.cost_usd == Decimal("0")

    def test_llm_usage_full_model(self):
        """Full LlmUsage model with id and created_at."""
        usage = LlmUsage(
            id=uuid4(),
            provider=LLMProvider.VOYAGE,
            model="voyage-3.5",
            feature=LLMFeature.EMBEDDINGS,
            input_tokens=5000,
            output_tokens=0,
            cost_usd=Decimal("0.0003"),
            created_at=datetime.now(),
        )
        assert usage.id is not None
        assert usage.created_at is not None

    def test_llm_provider_values(self):
        """Verify LLMProvider enum values."""
        assert LLMProvider.GOOGLE_GLA.value == "google-gla"
        assert LLMProvider.ANTHROPIC.value == "anthropic"
        assert LLMProvider.VOYAGE.value == "voyage"
        assert LLMProvider.OPENAI.value == "openai"

    def test_llm_feature_values(self):
        """Verify LLMFeature enum values."""
        assert LLMFeature.CHAT.value == "chat"
        assert LLMFeature.EMBEDDINGS.value == "embeddings"
        assert LLMFeature.RERANKING.value == "reranking"


class TestFeatureUsageModels:
    """Test feature usage Pydantic models."""

    def test_feature_usage_create_success(self):
        """FeatureUsageCreate for successful operation."""
        usage = FeatureUsageCreate(
            deal_id=uuid4(),
            feature_name="upload_document",
            status=FeatureStatus.SUCCESS,
            duration_ms=5432,
            metadata={"document_count": 3, "total_bytes": 1024000},
        )
        assert usage.status == FeatureStatus.SUCCESS
        assert usage.error_message is None
        assert usage.metadata["document_count"] == 3

    def test_feature_usage_create_error(self):
        """FeatureUsageCreate for failed operation."""
        usage = FeatureUsageCreate(
            feature_name="chat",
            status=FeatureStatus.ERROR,
            error_message="Rate limit exceeded",
            metadata={"retry_count": 3},
        )
        assert usage.status == FeatureStatus.ERROR
        assert "Rate limit" in usage.error_message

    def test_feature_usage_create_timeout(self):
        """FeatureUsageCreate for timeout."""
        usage = FeatureUsageCreate(
            feature_name="search",
            status=FeatureStatus.TIMEOUT,
            duration_ms=30000,
        )
        assert usage.status == FeatureStatus.TIMEOUT
        assert usage.duration_ms == 30000

    def test_feature_status_values(self):
        """Verify FeatureStatus enum values."""
        assert FeatureStatus.SUCCESS.value == "success"
        assert FeatureStatus.ERROR.value == "error"
        assert FeatureStatus.TIMEOUT.value == "timeout"
```

---

## Dev Notes

### Architecture Patterns

- **E12.9 Dependency**: This story builds on E12.9's organization isolation. Both tables include `organization_id` for multi-tenant cost breakdowns.
- **RLS Policies**: Use the `is_superadmin()` and `user_organization_ids()` helper functions from migration 00043.
- **Existing Pattern**: Follow E12.9's pattern for models.py organization (imports, docstrings, exports).

### Existing LLM Cost Tracking

The platform already has cost tracking infrastructure in [manda-processing/src/llm/pydantic_agent.py](manda-processing/src/llm/pydantic_agent.py):

```python
# Existing log_usage() function (line 346-393)
def log_usage(result: Any, model_str: str) -> dict[str, Any]:
    """Log token usage and cost after agent run."""
    # Currently logs to structlog only - E12.2 will persist to database
```

This function:
- Extracts provider/model from model string (e.g., "google-gla:gemini-2.5-flash")
- Calculates cost using `get_model_costs()` from [src/config.py](manda-processing/src/config.py)
- Logs to structlog with event="llm_usage"

**E12.2 will modify this to also write to `llm_usage` table.**

### Cost Calculation Reference

Model pricing is defined in [manda-processing/config/models.yaml](manda-processing/config/models.yaml) and accessed via:
- `get_model_costs(model_str)` returns `{"input": rate, "output": rate}` per million tokens
- Current models: Gemini Flash ($0.075/$0.30), Claude Sonnet ($3.00/$15.00), Voyage ($0.06/0)

### Migration Number

The next migration number is **00045** (00044 was organization_backfill from E12.9).

### Testing Standards

- **TypeScript**: Vitest with Zod schema validation tests
- **Python**: pytest with Pydantic model validation tests
- **Coverage**: Focus on schema validation and enum constraints
- **No Integration Tests**: E12.1 is schema-only; E12.2 will add write integration tests

### Project Structure Notes

**Files to create:**
- `manda-app/supabase/migrations/00045_usage_tracking.sql` - Database migration
- `manda-app/lib/types/usage.ts` - TypeScript types with Zod schemas
- `manda-app/__tests__/lib/types/usage.test.ts` - TypeScript unit tests
- `manda-processing/tests/unit/test_storage/test_usage_models.py` - Python unit tests

**Files to modify:**
- `manda-app/lib/supabase/database.types.ts` - Regenerated (auto)
- `manda-processing/src/storage/models.py` - Add Pydantic models
- `manda-processing/src/storage/__init__.py` - Export new models

### References

- [Epic E12 Full Spec](../epics/epic-E12.md#e121-usage-tracking-database-schema)
- [E12.9 Story](./e12-9-multi-tenant-isolation.md) - Organization isolation pattern
- [Architecture Document](../../docs/manda-architecture.md) - Database and model patterns
- [Existing log_usage()](../../manda-processing/src/llm/pydantic_agent.py#L346) - Current structlog-only implementation

---

## Completion Checklist

Before marking story complete, verify:

### Database
- [x] Migration 00045 applied successfully
- [x] `llm_usage` table exists with all columns
- [x] `feature_usage` table exists with all columns
- [x] All 7 indexes created
- [x] RLS policies in place: `org_isolation_llm_usage`, `org_isolation_feature_usage`

### TypeScript
- [x] Types regenerated: `npm run db:types` completed
- [x] `LlmUsage` interface in database.types.ts
- [x] `FeatureUsage` interface in database.types.ts
- [x] `lib/types/usage.ts` created with Zod schemas
- [x] All TypeScript tests pass (9/9 pass)

### Python
- [x] `LlmUsage`, `LlmUsageCreate` models in models.py
- [x] `FeatureUsage`, `FeatureUsageCreate` models in models.py
- [x] `LLMProvider`, `LLMFeature`, `FeatureStatus` enums in models.py
- [x] Exports added to `__init__.py`
- [x] All Python tests pass (9/9 pass)

### Build Verification
- [x] TypeScript tests pass (pre-existing type errors unrelated to this story)
- [x] Python tests pass: `pytest tests/unit/test_storage/test_usage_models.py`

---

## Dev Agent Record

### Context Reference
- Epic: E12 - Production Readiness & Observability
- Story: E12.1 - Usage Tracking Database Schema
- All 5 ACs addressed

### Agent Model Used
Claude Opus 4.5 (claude-opus-4-5-20251101)

### Debug Log References
- If type errors occur after regeneration, check that `decimal` maps to `number` in TypeScript
- If RLS errors occur, verify helper functions exist from migration 00043

### Completion Notes List
- ✅ All 5 Acceptance Criteria satisfied
- ✅ Database migration 00045 created and applied successfully
- ✅ TypeScript types generated with `llm_usage` and `feature_usage` interfaces
- ✅ Zod schemas created for input validation (`CreateLlmUsageSchema`, `CreateFeatureUsageSchema`)
- ✅ Python Pydantic models created (`LlmUsage`, `LlmUsageCreate`, `FeatureUsage`, `FeatureUsageCreate`)
- ✅ Python enums created (`LLMProvider`, `LLMFeature`, `FeatureStatus`, `FeatureName`)
- ✅ All unit tests pass (11 TypeScript + 14 Python = 25 total)
- ✅ RLS policies use existing helper functions from E12.9 (`is_superadmin()`, `user_organization_ids()`)
- ✅ Code review fixes applied (see Change Log)

### File List
**Created:**
- `manda-app/supabase/migrations/00045_usage_tracking.sql` - Database migration with tables, indexes, RLS
- `manda-app/supabase/migrations/00046_usage_tracking_insert_policy.sql` - RLS INSERT policies with WITH CHECK (code review fix)
- `manda-app/lib/types/usage.ts` - TypeScript types with Zod schemas
- `manda-app/__tests__/lib/types/usage.test.ts` - TypeScript unit tests
- `manda-processing/tests/unit/test_storage/test_usage_models.py` - Python unit tests

**Modified:**
- `manda-app/lib/supabase/database.types.ts` - Regenerated via `npm run db:types`
- `manda-processing/src/storage/models.py` - Added Pydantic models and enums (including FeatureName)
- `manda-processing/src/storage/__init__.py` - Added imports and exports

### Change Log
- 2025-12-19: E12.1 Implementation complete - Added usage tracking database schema with TypeScript and Python types
- 2025-12-19: Code Review Fixes Applied:
  - [HIGH] Added `FeatureName` enum to Python models for type safety (was `str`)
  - [MEDIUM] Added migration 00046 with proper INSERT policies using WITH CHECK
  - [MEDIUM] Added TypeScript tests for invalid featureName/status rejection
  - [MEDIUM] Added Python validation error tests for enum constraints
