# Epic Technical Specification: Learning Loop

Date: 2025-12-07
Author: Max
Epic ID: E7
Status: Draft

---

## Overview

Epic 7 implements the Learning Loop for the Manda M&A Platform - the mechanism by which the system learns from analyst corrections, validations, and feedback to continuously improve accuracy and relevance over time.

The core innovation is **prompt optimization with few-shot examples**: the system stores analyst corrections in a structured feedback database and dynamically includes relevant correction patterns in agent system prompts. This enables immediate improvement without requiring model fine-tuning, while building a foundation for future advanced learning approaches.

This epic addresses a critical risk identified in the PRD (RISK-009): confidence scoring and contradiction resolution complexity. By capturing analyst feedback on findings, validations, and response quality, the system can calibrate its confidence thresholds and improve extraction accuracy based on real-world usage patterns.

Key workflows delivered:
1. **Finding Correction via Chat** - Analysts correct findings using natural language ("That revenue should be $50M, not $45M")
2. **Validation/Rejection Tracking** - Track which findings analysts confirm vs reject to adjust confidence scores
3. **Response Edit Learning** - Capture edits to Q&A answers and CIM content to learn preferred style
4. **Feedback Incorporation** - Analyze patterns in corrections to identify systematic issues
5. **Audit Trail** - Immutable history of all corrections for compliance and debugging
6. **Correction Propagation** - Update dependent insights when source findings are corrected

## Objectives and Scope

### In-Scope

1. **Finding Correction via Chat (E7.1)** - Natural language correction commands updating knowledge base
2. **Validation/Rejection Feedback (E7.2)** - UI buttons and tracking for finding accuracy assessment
3. **Response Edit Learning (E7.3)** - Capture edits to agent responses with pattern detection
4. **Feedback Incorporation System (E7.4)** - Background analysis of feedback to improve prompts
5. **Comprehensive Audit Trail (E7.5)** - Immutable logging of all corrections and feedback
6. **Correction Propagation (E7.6)** - Flag and optionally regenerate dependent insights

### Out-of-Scope

- **Model fine-tuning** - System uses few-shot examples in prompts; fine-tuning deferred to Phase 3
- **Real-time confidence recalculation** - Confidence updates happen on next analysis, not retroactively
- **Multi-user feedback aggregation** - Per-analyst learning in MVP; cross-user patterns in Phase 2
- **Feedback analytics dashboard** - Basic admin view only; full dashboard deferred to Phase 2
- **External feedback import** - No integration with external feedback systems
- **Automated prompt rewriting** - Human review required before prompt changes; auto-suggest only

## System Architecture Alignment

### Architecture Components Referenced

| Component | Role in E7 | Reference |
|-----------|------------|-----------|
| **PostgreSQL (Supabase)** | Stores feedback tables: `finding_corrections`, `validation_feedback`, `response_edits` | Data Layer |
| **Neo4j** | Tracks correction relationships, finding dependencies, propagation paths | Graph Database |
| **LangChain Agent** | `update_knowledge_base` tool enhanced for corrections | Agent Layer |
| **Next.js 15 Frontend** | Validation buttons, inline edit UI, correction confirmation | Frontend Layer |
| **Background Workers** | Weekly feedback analysis job | Processing Layer |

### Key Architecture Decisions

1. **Few-Shot Learning** - Corrections stored in database, relevant examples dynamically included in prompts (not fine-tuning)
2. **Immediate Knowledge Base Update** - Corrections update PostgreSQL findings table immediately; Neo4j relationships updated asynchronously
3. **Append-Only Audit** - All feedback tables are append-only; no DELETE operations for compliance
4. **Per-Analyst Learning** - Edit patterns tracked per analyst; configurable to share patterns across team (Phase 2)
5. **Confidence Adjustment Algorithm** - Simple weighted average: +0.05 per validation, -0.10 per rejection, capped at [0.1, 0.95]
6. **Dependent Insight Flagging** - Neo4j BASED_ON relationships used to find insights requiring review when source finding corrected
7. **Feature Flags for Dangerous Operations** - Source validation and cascade operations controlled by feature flags for safe rollout

### Feature Flags

The Learning Loop introduces potentially dangerous cascade operations. All high-impact features are gated behind feature flags for safe rollout and quick disable capability.

| Flag | Default | Description | Risk Level |
|------|---------|-------------|------------|
| `LEARNING_SOURCE_VALIDATION_ENABLED` | `true` | Show source citation before accepting corrections | Low |
| `LEARNING_SOURCE_ERROR_CASCADE_ENABLED` | `false` | Enable full cascade when source document has errors | **HIGH** |
| `LEARNING_AUTO_FLAG_DOCUMENT_FINDINGS` | `false` | Auto-flag all findings from error document | **HIGH** |
| `LEARNING_AUTO_REEMBED_CORRECTIONS` | `true` | Regenerate embeddings for corrected findings | Medium |
| `LEARNING_NEO4J_SYNC_ENABLED` | `true` | Sync corrections to Neo4j knowledge graph | Medium |
| `LEARNING_CONFIDENCE_ADJUSTMENT_ENABLED` | `true` | Adjust confidence scores on validation/rejection | Low |
| `LEARNING_PATTERN_DETECTION_ENABLED` | `true` | Detect edit patterns from response edits | Low |

**Flag Storage:** Environment variables with fallback to database `feature_flags` table for runtime toggling.

```typescript
// lib/config/feature-flags.ts
export const LEARNING_FLAGS = {
  sourceValidationEnabled:
    process.env.LEARNING_SOURCE_VALIDATION_ENABLED !== 'false',

  sourceErrorCascadeEnabled:
    process.env.LEARNING_SOURCE_ERROR_CASCADE_ENABLED === 'true', // OFF by default

  autoFlagDocumentFindings:
    process.env.LEARNING_AUTO_FLAG_DOCUMENT_FINDINGS === 'true', // OFF by default

  autoReembedCorrections:
    process.env.LEARNING_AUTO_REEMBED_CORRECTIONS !== 'false',

  neo4jSyncEnabled:
    process.env.LEARNING_NEO4J_SYNC_ENABLED !== 'false',

  confidenceAdjustmentEnabled:
    process.env.LEARNING_CONFIDENCE_ADJUSTMENT_ENABLED !== 'false',

  patternDetectionEnabled:
    process.env.LEARNING_PATTERN_DETECTION_ENABLED !== 'false',
};

// Runtime override from database (checked on each request)
export async function getFeatureFlag(flag: keyof typeof LEARNING_FLAGS): Promise<boolean> {
  // Check database override first
  const dbOverride = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('flag_name', flag)
    .single();

  if (dbOverride.data) {
    return dbOverride.data.enabled;
  }

  // Fall back to environment variable
  return LEARNING_FLAGS[flag];
}
```

**Behavior When Flags Disabled:**

| Flag Disabled | Behavior |
|---------------|----------|
| `sourceValidationEnabled = false` | Skip source citation display; accept corrections immediately (original E7 design) |
| `sourceErrorCascadeEnabled = false` | Treat `source_error` same as `override_without_source`; NO cascade to other findings |
| `autoFlagDocumentFindings = false` | Only flag the corrected finding, not sibling findings from same document |
| `autoReembedCorrections = false` | Skip embedding regeneration; old embedding remains (may cause stale search results) |
| `neo4jSyncEnabled = false` | Skip Neo4j updates; PostgreSQL is source of truth |
| `confidenceAdjustmentEnabled = false` | Validation/rejection recorded but confidence unchanged |
| `patternDetectionEnabled = false` | Edits saved but no pattern detection or learning |

**Rollout Strategy:**

1. **Phase 1 (Initial Deploy):**
   - `sourceErrorCascadeEnabled = false`
   - `autoFlagDocumentFindings = false`
   - All other flags `true`
   - Monitor: correction volume, user feedback, error rates

2. **Phase 2 (After 1 week stable):**
   - Enable `autoReembedCorrections` if search quality acceptable
   - Monitor: search result relevance, embedding costs

3. **Phase 3 (After 2 weeks stable):**
   - Enable `sourceErrorCascadeEnabled` for select power users via database flag
   - Monitor: cascade frequency, false positive rate, user complaints

4. **Phase 4 (After validation):**
   - Enable `autoFlagDocumentFindings` if cascade accuracy > 90%
   - Full rollout

## Detailed Design

### Services and Modules

| Module | Responsibility | Location |
|--------|---------------|----------|
| **Correction Service** | Process finding corrections, update knowledge base, store history | `lib/services/corrections.ts` |
| **Source Error Cascade Service** | Handle source_error corrections: flag document, update all findings, re-embed, sync Neo4j | `lib/services/source-error-cascade.ts` |
| **Validation Feedback Service** | Track validation/rejection actions, adjust confidence scores | `lib/services/validation-feedback.ts` |
| **Response Edit Service** | Capture response edits, detect patterns, store examples | `lib/services/response-edits.ts` |
| **Feedback Analysis Service** | Analyze feedback patterns, generate improvement suggestions | `lib/services/feedback-analysis.ts` |
| **Audit Trail Service** | Query correction history, export audit logs | `lib/services/audit-trail.ts` |
| **Correction Propagation Service** | Find dependent insights, flag for review, trigger regeneration | `lib/services/correction-propagation.ts` |
| **Prompt Enhancement Service** | Inject few-shot examples into system prompts | `lib/services/prompt-enhancement.ts` |

### Component Structure

```
manda-app/
├── lib/
│   ├── services/
│   │   ├── corrections.ts            # Finding correction logic (E7.1)
│   │   ├── validation-feedback.ts    # Validation tracking (E7.2)
│   │   ├── response-edits.ts         # Response edit capture (E7.3)
│   │   ├── feedback-analysis.ts      # Pattern analysis (E7.4)
│   │   ├── audit-trail.ts            # Audit queries (E7.5)
│   │   ├── correction-propagation.ts # Dependent insight updates (E7.6)
│   │   └── prompt-enhancement.ts     # Few-shot injection
│   ├── agent/tools/
│   │   └── knowledge-tools.ts        # Enhanced update_knowledge_base
│   └── types/
│       └── feedback.ts               # Feedback type definitions
├── components/
│   ├── knowledge-explorer/
│   │   ├── FindingValidationButtons.tsx  # Validate/Reject UI (E7.2)
│   │   ├── FindingCorrectionModal.tsx    # Manual correction UI (E7.1)
│   │   └── FindingHistoryPanel.tsx       # Correction history (E7.5)
│   ├── chat/
│   │   └── ResponseEditMode.tsx          # Inline response edit (E7.3)
│   └── feedback/
│       ├── FeedbackDashboard.tsx         # Basic admin view (E7.4)
│       └── AuditTrailExport.tsx          # Export controls (E7.5)
└── app/api/projects/[id]/
    ├── findings/
    │   ├── [findingId]/
    │   │   ├── correct/route.ts      # POST correction
    │   │   ├── validate/route.ts     # POST validation
    │   │   └── history/route.ts      # GET correction history
    │   └── feedback/route.ts         # GET feedback analytics
    ├── responses/
    │   └── [responseId]/
    │       └── edit/route.ts         # POST response edit
    └── audit/
        └── export/route.ts           # GET audit export
```

### Data Models and Contracts

#### PostgreSQL Schema (New Tables)

```sql
-- Migration: 00028_create_finding_corrections_table.sql
CREATE TABLE finding_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID REFERENCES findings(id) ON DELETE CASCADE NOT NULL,
  original_value TEXT NOT NULL,
  corrected_value TEXT NOT NULL,
  correction_type TEXT NOT NULL CHECK (correction_type IN ('value', 'source', 'confidence', 'text')),
  reason TEXT,
  analyst_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Source validation fields
  original_source_document TEXT,           -- Document where finding was extracted from
  original_source_location TEXT,           -- Page number, cell reference, paragraph
  user_source_reference TEXT,              -- User's basis for correction (e.g., "Management confirmed in call")
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'confirmed_with_source', 'override_without_source', 'source_error')),

  -- Immutable: no UPDATE or DELETE policies
  CONSTRAINT finding_corrections_immutable CHECK (true)
);

CREATE INDEX idx_finding_corrections_finding ON finding_corrections(finding_id);
CREATE INDEX idx_finding_corrections_analyst ON finding_corrections(analyst_id);
CREATE INDEX idx_finding_corrections_created ON finding_corrections(created_at DESC);

-- RLS Policy (append-only)
ALTER TABLE finding_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view corrections for their deals" ON finding_corrections
  FOR SELECT USING (
    finding_id IN (
      SELECT id FROM findings WHERE deal_id IN (
        SELECT id FROM deals WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert corrections for their deals" ON finding_corrections
  FOR INSERT WITH CHECK (
    finding_id IN (
      SELECT id FROM findings WHERE deal_id IN (
        SELECT id FROM deals WHERE user_id = auth.uid()
      )
    )
    AND analyst_id = auth.uid()
  );
-- No UPDATE or DELETE policies - append-only
```

```sql
-- Migration: 00029_create_validation_feedback_table.sql
CREATE TABLE validation_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id UUID REFERENCES findings(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('validate', 'reject')),
  reason TEXT,
  analyst_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_validation_feedback_finding ON validation_feedback(finding_id);
CREATE INDEX idx_validation_feedback_action ON validation_feedback(action);
CREATE INDEX idx_validation_feedback_analyst ON validation_feedback(analyst_id);

-- Aggregation view for confidence adjustment
CREATE VIEW finding_validation_stats AS
SELECT
  finding_id,
  COUNT(*) FILTER (WHERE action = 'validate') AS validation_count,
  COUNT(*) FILTER (WHERE action = 'reject') AS rejection_count,
  COUNT(*) AS total_feedback
FROM validation_feedback
GROUP BY finding_id;

-- RLS Policy
ALTER TABLE validation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view feedback for their deals" ON validation_feedback
  FOR SELECT USING (
    finding_id IN (
      SELECT id FROM findings WHERE deal_id IN (
        SELECT id FROM deals WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert feedback for their deals" ON validation_feedback
  FOR INSERT WITH CHECK (
    finding_id IN (
      SELECT id FROM findings WHERE deal_id IN (
        SELECT id FROM deals WHERE user_id = auth.uid()
      )
    )
    AND analyst_id = auth.uid()
  );
```

```sql
-- Migration: 00030_create_response_edits_table.sql
CREATE TABLE response_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE NOT NULL,
  original_text TEXT NOT NULL,
  edited_text TEXT NOT NULL,
  edit_type TEXT NOT NULL CHECK (edit_type IN ('style', 'content', 'factual', 'formatting')),
  analyst_id UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_response_edits_message ON response_edits(message_id);
CREATE INDEX idx_response_edits_analyst ON response_edits(analyst_id);
CREATE INDEX idx_response_edits_type ON response_edits(edit_type);

-- RLS Policy
ALTER TABLE response_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view edits for their conversations" ON response_edits
  FOR SELECT USING (
    message_id IN (
      SELECT id FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE deal_id IN (
          SELECT id FROM deals WHERE user_id = auth.uid()
        )
      )
    )
  );

CREATE POLICY "Users can insert edits for their conversations" ON response_edits
  FOR INSERT WITH CHECK (
    message_id IN (
      SELECT id FROM messages WHERE conversation_id IN (
        SELECT id FROM conversations WHERE deal_id IN (
          SELECT id FROM deals WHERE user_id = auth.uid()
        )
      )
    )
    AND analyst_id = auth.uid()
  );
```

```sql
-- Migration: 00031_create_edit_patterns_table.sql
CREATE TABLE edit_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analyst_id UUID REFERENCES auth.users(id) NOT NULL,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('word_replacement', 'phrase_removal', 'tone_adjustment', 'structure_change')),
  original_pattern TEXT NOT NULL,
  replacement_pattern TEXT NOT NULL,
  occurrence_count INTEGER DEFAULT 1,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT unique_pattern_per_analyst UNIQUE (analyst_id, pattern_type, original_pattern)
);

CREATE INDEX idx_edit_patterns_analyst ON edit_patterns(analyst_id);
CREATE INDEX idx_edit_patterns_active ON edit_patterns(is_active) WHERE is_active = true;
CREATE INDEX idx_edit_patterns_count ON edit_patterns(occurrence_count DESC);

-- RLS Policy
ALTER TABLE edit_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own patterns" ON edit_patterns
  FOR SELECT USING (analyst_id = auth.uid());

CREATE POLICY "Users can manage their own patterns" ON edit_patterns
  FOR ALL USING (analyst_id = auth.uid());
```

```sql
-- Migration: 00032_add_needs_review_to_findings.sql
ALTER TABLE findings ADD COLUMN needs_review BOOLEAN DEFAULT false;
ALTER TABLE findings ADD COLUMN review_reason TEXT;
ALTER TABLE findings ADD COLUMN last_corrected_at TIMESTAMPTZ;

CREATE INDEX idx_findings_needs_review ON findings(needs_review) WHERE needs_review = true;
```

```sql
-- Migration: 00033_add_document_reliability_tracking.sql
-- Track document reliability for source error cascade handling

ALTER TABLE documents ADD COLUMN reliability_status TEXT NOT NULL DEFAULT 'trusted'
  CHECK (reliability_status IN ('trusted', 'contains_errors', 'superseded'));
ALTER TABLE documents ADD COLUMN reliability_notes TEXT;
ALTER TABLE documents ADD COLUMN error_count INTEGER DEFAULT 0;

CREATE INDEX idx_documents_reliability ON documents(reliability_status)
  WHERE reliability_status != 'trusted';

-- View for documents with known errors
CREATE VIEW documents_with_errors AS
SELECT
  d.id,
  d.name,
  d.reliability_status,
  d.reliability_notes,
  d.error_count,
  COUNT(f.id) AS total_findings,
  COUNT(f.id) FILTER (WHERE f.needs_review = true) AS findings_needing_review
FROM documents d
LEFT JOIN findings f ON f.document_id = d.id
WHERE d.reliability_status = 'contains_errors'
GROUP BY d.id;
```

```sql
-- Migration: 00034_create_feature_flags_table.sql
-- Runtime feature flags for safe rollout of dangerous operations

CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_name TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Insert default flags for Learning Loop (E7)
INSERT INTO feature_flags (flag_name, enabled, description, risk_level) VALUES
  ('sourceValidationEnabled', true, 'Show source citation before accepting corrections', 'low'),
  ('sourceErrorCascadeEnabled', false, 'Enable full cascade when source document has errors', 'high'),
  ('autoFlagDocumentFindings', false, 'Auto-flag all findings from error document', 'high'),
  ('autoReembedCorrections', true, 'Regenerate embeddings for corrected findings', 'medium'),
  ('neo4jSyncEnabled', true, 'Sync corrections to Neo4j knowledge graph', 'medium'),
  ('confidenceAdjustmentEnabled', true, 'Adjust confidence scores on validation/rejection', 'low'),
  ('patternDetectionEnabled', true, 'Detect edit patterns from response edits', 'low');

-- RLS: Only admins can modify flags
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature flags" ON feature_flags
  FOR SELECT USING (true);

-- Note: UPDATE policy should be restricted to admin role in production
CREATE POLICY "Authenticated users can update flags" ON feature_flags
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- Audit trigger for flag changes
CREATE OR REPLACE FUNCTION log_feature_flag_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_logs (event_type, entity_type, entity_id, user_id, details)
  VALUES (
    'feature_flag_changed',
    'feature_flags',
    NEW.id,
    auth.uid(),
    jsonb_build_object(
      'flag_name', NEW.flag_name,
      'old_enabled', OLD.enabled,
      'new_enabled', NEW.enabled
    )
  );
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER feature_flag_audit
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION log_feature_flag_change();
```

#### TypeScript Types

```typescript
// lib/types/feedback.ts
export interface FindingCorrection {
  id: string;
  findingId: string;
  originalValue: string;
  correctedValue: string;
  correctionType: 'value' | 'source' | 'confidence' | 'text';
  reason?: string;
  analystId: string;
  createdAt: string;

  // Source validation fields
  originalSourceDocument?: string;   // Document where finding was extracted from
  originalSourceLocation?: string;   // Page number, cell reference, paragraph
  userSourceReference?: string;      // User's basis for correction (e.g., "Management confirmed in call")
  validationStatus: 'confirmed_with_source' | 'override_without_source' | 'source_error';
}

export interface ValidationFeedback {
  id: string;
  findingId: string;
  action: 'validate' | 'reject';
  reason?: string;
  analystId: string;
  createdAt: string;
}

export interface FindingValidationStats {
  findingId: string;
  validationCount: number;
  rejectionCount: number;
  totalFeedback: number;
  adjustedConfidence?: number;
}

export interface ResponseEdit {
  id: string;
  messageId: string;
  originalText: string;
  editedText: string;
  editType: 'style' | 'content' | 'factual' | 'formatting';
  analystId: string;
  createdAt: string;
}

export interface EditPattern {
  id: string;
  analystId: string;
  patternType: 'word_replacement' | 'phrase_removal' | 'tone_adjustment' | 'structure_change';
  originalPattern: string;
  replacementPattern: string;
  occurrenceCount: number;
  firstSeen: string;
  lastSeen: string;
  isActive: boolean;
}

export interface CorrectionWithImpact {
  correction: FindingCorrection;
  dependentInsights: {
    id: string;
    type: 'qa_answer' | 'cim_section' | 'insight';
    title: string;
    flaggedForReview: boolean;
  }[];
  // Source error cascade impact (only populated when validationStatus = 'source_error')
  sourceDocumentImpact?: {
    documentId: string;
    documentName: string;
    previousReliabilityStatus: 'trusted' | 'contains_errors' | 'superseded';
    newReliabilityStatus: 'contains_errors';
    totalFindingsFromDocument: number;
    findingsFlaggedForReview: number;
    embeddingRegenerated: boolean;
    neo4jUpdated: boolean;
  };
}

export interface FeedbackAnalysisSummary {
  period: string;
  totalCorrections: number;
  totalValidations: number;
  totalRejections: number;
  topPatterns: EditPattern[];
  suggestedPromptImprovements: string[];
  problematicSources: {
    sourceType: string;
    rejectionRate: number;
    sampleFindings: string[];
  }[];
}
```

### APIs and Interfaces

#### Correction API Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| POST | `/api/projects/[id]/findings/[findingId]/correct` | Correct a finding | `{ correctedValue, correctionType, reason?, userSourceReference?, validationStatus }` | `CorrectionWithImpact` |
| GET | `/api/projects/[id]/findings/[findingId]/source` | Get original source citation | - | `{ sourceDocument, sourceLocation, extractedValue }` |
| POST | `/api/projects/[id]/findings/[findingId]/validate` | Validate a finding | `{ reason? }` | `{ success: boolean, newConfidence: number }` |
| POST | `/api/projects/[id]/findings/[findingId]/reject` | Reject a finding | `{ reason? }` | `{ success: boolean, newConfidence: number }` |
| GET | `/api/projects/[id]/findings/[findingId]/history` | Get correction history | - | `FindingCorrection[]` |
| GET | `/api/projects/[id]/findings/[findingId]/stats` | Get validation stats | - | `FindingValidationStats` |

#### Response Edit API Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| POST | `/api/projects/[id]/responses/[messageId]/edit` | Save response edit | `{ editedText, editType }` | `ResponseEdit` |
| GET | `/api/projects/[id]/responses/[messageId]/history` | Get edit history | - | `ResponseEdit[]` |
| GET | `/api/projects/[id]/patterns` | Get analyst's edit patterns | - | `EditPattern[]` |
| PUT | `/api/projects/[id]/patterns/[patternId]` | Toggle pattern active state | `{ isActive: boolean }` | `EditPattern` |

#### Feedback Analysis API Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| GET | `/api/projects/[id]/feedback/summary` | Get feedback summary | `?period=week\|month\|all` | `FeedbackAnalysisSummary` |
| GET | `/api/projects/[id]/feedback/corrections` | List all corrections | `?page&limit` | `FindingCorrection[]` |
| POST | `/api/projects/[id]/feedback/analyze` | Trigger feedback analysis | - | `{ jobId: string }` |

#### Audit Trail API Endpoints

| Method | Endpoint | Description | Request | Response |
|--------|----------|-------------|---------|----------|
| GET | `/api/projects/[id]/audit/corrections` | Query correction audit | `?startDate&endDate&analystId&findingId` | `FindingCorrection[]` |
| GET | `/api/projects/[id]/audit/export` | Export audit trail | `?format=csv\|json&startDate&endDate` | File blob |

### Workflows and Sequencing

#### Finding Correction via Chat Flow

```
User in chat: "That revenue should be $50M, not $45M"
  ↓
LangChain Agent detects correction intent
  ↓
Agent calls update_knowledge_base tool with correction flag
  ↓
Tool extracts: { findingId, originalValue: "$45M", correctedValue: "$50M" }
  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ SOURCE VALIDATION STEP (Critical)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ Agent retrieves and displays:                                          │
│ • Original source document: "2024_Financial_Model.xlsx"                │
│ • Source location: "Sheet 'Revenue', Cell B14"                         │
│ • Extracted value: "$45M"                                              │
│                                                                         │
│ Agent asks: "I found the original value in 2024_Financial_Model.xlsx   │
│ (Sheet 'Revenue', Cell B14). What is the basis for your correction?"   │
│                                                                         │
│ User response options:                                                  │
│ [A] "The spreadsheet has a typo - check the management presentation"   │
│ [B] "Management confirmed $50M in our call yesterday"                  │
│ [C] "Just accept my correction" (override without source)              │
│ [D] "Show me the source" (displays document preview)                   │
└─────────────────────────────────────────────────────────────────────────┘
  ↓
User provides source reference OR confirms override
  ↓
BEGIN TRANSACTION
  ↓
Insert into finding_corrections table with:
  - original_source_document = "2024_Financial_Model.xlsx"
  - original_source_location = "Sheet 'Revenue', Cell B14"
  - user_source_reference = user's explanation
  - validation_status = 'confirmed_with_source' | 'override_without_source' | 'source_error'
  ↓
Update findings table: text = corrected value, last_corrected_at = NOW()
  ↓
COMMIT TRANSACTION
  ↓
Async: Neo4j query for dependent insights (BASED_ON relationships)
  ↓
For each dependent insight: Set needs_review = true, review_reason = "Source finding corrected"
  ↓
Agent responds: "I've corrected the revenue finding to $50M. The original value ($45M from 2024_Financial_Model.xlsx) has been archived with your note: 'Management confirmed in call'. This correction affects 2 Q&A answers which are now flagged for review."
```

**Source Validation Rationale:**
- Prevents blind acceptance of incorrect corrections
- Creates audit trail showing why correction was made
- Allows analysts to catch their own errors by reviewing original source
- Supports compliance with "trust but verify" principle
- Enables future analysis of correction accuracy (were overrides accurate?)

#### Source Document Error Cascade Flow

When user indicates the **source document itself is wrong** (validation_status = 'source_error'), a cascade of updates is required across all data stores.

**⚠️ This flow is gated by feature flags for safe rollout.**

```
User confirms: "The spreadsheet has a typo - the audited financials say $50M"
  ↓
Correction saved with validation_status = 'source_error'
  ↓
┌─────────────────────────────────────────────────────────────────────────┐
│ FEATURE FLAG CHECK                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│ if (!await getFeatureFlag('sourceErrorCascadeEnabled')) {               │
│   // Treat as simple correction - NO CASCADE                            │
│   // Only update the single finding, log warning                        │
│   console.warn('Source error cascade disabled by feature flag');        │
│   return simpleCorrectionFlow(correction);                              │
│ }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
  ↓ (if flag enabled)
┌─────────────────────────────────────────────────────────────────────────┐
│ CASCADE UPDATE: SOURCE DOCUMENT ERROR                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│ 1. PostgreSQL - Findings Table                                          │
│    ┌─────────────────────────────────────────────────────────────────┐  │
│    │ UPDATE findings SET value = $correctedValue                     │  │
│    │ WHERE id = $findingId;                                          │  │
│    │                                                                 │  │
│    │ -- Flag ALL findings from same document for review              │  │
│    │ UPDATE findings SET needs_review = true,                        │  │
│    │   review_reason = 'Source document contains known errors'       │  │
│    │ WHERE document_id = $sourceDocumentId;                          │  │
│    └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ 2. PostgreSQL - Documents Table                                         │
│    ┌─────────────────────────────────────────────────────────────────┐  │
│    │ UPDATE documents SET                                            │  │
│    │   reliability_status = 'contains_errors',                       │  │
│    │   reliability_notes = CONCAT(reliability_notes,                 │  │
│    │     'Error found: Revenue incorrect. User note: ...')           │  │
│    │ WHERE id = $sourceDocumentId;                                   │  │
│    └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ 3. pgvector - Re-embed Corrected Finding                                │
│    ┌─────────────────────────────────────────────────────────────────┐  │
│    │ -- Generate new embedding for corrected text                    │  │
│    │ embedding = await generateEmbedding(correctedFindingText);      │  │
│    │                                                                 │  │
│    │ UPDATE findings SET embedding = $embedding                      │  │
│    │ WHERE id = $findingId;                                          │  │
│    │                                                                 │  │
│    │ -- Note: Chunk embeddings remain unchanged (raw extraction)     │  │
│    │ -- Finding embedding reflects corrected knowledge               │  │
│    └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
│ 4. Neo4j - Knowledge Graph Updates                                      │
│    ┌─────────────────────────────────────────────────────────────────┐  │
│    │ // Update finding node with corrected value                     │  │
│    │ MATCH (f:Finding {id: $findingId})                              │  │
│    │ SET f.value = $correctedValue,                                  │  │
│    │     f.corrected_at = datetime(),                                │  │
│    │     f.correction_type = 'source_error'                          │  │
│    │                                                                 │  │
│    │ // Mark document as unreliable                                  │  │
│    │ MATCH (d:Document {id: $sourceDocumentId})                      │  │
│    │ SET d.reliability_status = 'contains_errors'                    │  │
│    │                                                                 │  │
│    │ // Create SUPERSEDES relationship for audit trail               │  │
│    │ CREATE (newF:FindingVersion {                                   │  │
│    │   value: $correctedValue,                                       │  │
│    │   corrected_by: $analystId,                                     │  │
│    │   corrected_at: datetime()                                      │  │
│    │ })-[:SUPERSEDES]->(f)                                           │  │
│    │                                                                 │  │
│    │ // Flag all findings from this document                         │  │
│    │ MATCH (d:Document {id: $sourceDocumentId})<-[:EXTRACTED_FROM]-(f2:Finding)  │
│    │ SET f2.needs_review = true,                                     │  │
│    │     f2.review_reason = 'Source document contains known errors'  │  │
│    │                                                                 │  │
│    │ // Propagate to dependent insights                              │  │
│    │ MATCH (f:Finding {id: $findingId})<-[:BASED_ON]-(i:Insight)     │  │
│    │ SET i.needs_review = true                                       │  │
│    └─────────────────────────────────────────────────────────────────┘  │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
  ↓
Agent responds: "I've corrected the revenue to $50M and marked the source
document '2024_Financial_Model.xlsx' as containing errors.

⚠️ 12 other findings from this document are now flagged for review.
Would you like me to show them so you can verify their accuracy?"
```

**Cascade Update Implementation Notes:**
- All updates wrapped in distributed transaction (Supabase + Neo4j)
- If Neo4j unavailable, PostgreSQL updates proceed; Neo4j sync retried via pg-boss
- Document reliability_status values: `trusted` (default), `contains_errors`, `superseded`
- Chunk embeddings are NOT re-generated (they represent raw extraction)
- Finding embeddings ARE re-generated (they represent corrected knowledge)

#### Validation/Rejection Feedback Flow

```
User views finding in Knowledge Explorer
  ↓
User clicks "Validate" or "Reject" button
  ↓
POST /api/projects/[id]/findings/[findingId]/validate (or /reject)
  ↓
Insert into validation_feedback table
  ↓
Query finding_validation_stats view
  ↓
Calculate new confidence:
  base_confidence + (validations * 0.05) - (rejections * 0.10)
  Capped to [0.1, 0.95]
  ↓
Update findings table: confidence = new_confidence
  ↓
If rejection_rate > 50% for source: Flag source for review
  ↓
Return { success: true, newConfidence }
  ↓
UI updates confidence badge, shows toast
```

#### Response Edit Learning Flow

```
User views Q&A answer or CIM section
  ↓
User clicks "Edit Response"
  ↓
Inline edit mode activated
  ↓
User modifies text
  ↓
User clicks "Save"
  ↓
POST /api/projects/[id]/responses/[messageId]/edit
  ↓
Insert into response_edits table
  ↓
Text diff algorithm compares original vs edited
  ↓
For each detected change:
  - Word replacement: "utilize" → "use"
  - Phrase removal: "In conclusion," removed
  - Tone adjustment: Passive → active voice
  ↓
Upsert into edit_patterns table:
  - If pattern exists: increment occurrence_count, update last_seen
  - If new: insert with occurrence_count = 1
  ↓
If occurrence_count >= 3: Mark pattern as significant
  ↓
Return confirmation with detected patterns
```

#### Feedback Analysis Background Job Flow

```
Weekly cron job triggers (Sunday 2am)
  ↓
Query all feedback from past week:
  - finding_corrections
  - validation_feedback
  - response_edits
  ↓
Group corrections by:
  - Document type (Excel, PDF, Word)
  - Domain (Financial, Operational, Legal)
  - Source pattern (table extraction, text extraction)
  ↓
Calculate rejection rates per grouping
  ↓
If rejection_rate > 40%:
  - Flag as systematic issue
  - Generate prompt improvement suggestion
  ↓
Aggregate edit patterns:
  - Top 10 most common patterns
  - Patterns reaching 3+ occurrences this week
  ↓
Store analysis results in feedback_analysis_results table
  ↓
If any HIGH severity issues:
  - Send notification to admin
  - Log alert
  ↓
Generate FeedbackAnalysisSummary for dashboard
```

#### Correction Propagation Flow

```
Finding corrected (via chat or UI)
  ↓
Call correction propagation service
  ↓
Neo4j query:
  MATCH (f:Finding {id: $findingId})<-[:BASED_ON]-(i:Insight)
  RETURN i.id, i.type, i.title
  ↓
For each dependent insight:
  ↓
  Update PostgreSQL:
    - qa_answers: Set needs_review = true if answer references finding
    - cim_sections: Set needs_review = true if section uses finding
    - insights: Set needs_review = true
  ↓
Collect impact summary
  ↓
Return to caller: {
  correction: FindingCorrection,
  dependentInsights: [
    { id, type: 'qa_answer', title: 'Q3 Revenue Question', flaggedForReview: true },
    { id, type: 'cim_section', title: 'Financial Performance', flaggedForReview: true }
  ]
}
  ↓
UI shows: "This correction affects 2 items which are now flagged for review"
  ↓
Optional: User clicks "Regenerate All" to trigger re-analysis with corrected data
```

## Non-Functional Requirements

### Performance

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Correction via chat | < 2s response | User expects immediate confirmation after correction |
| Validation button click | < 500ms | Single row update, should feel instant |
| Confidence recalculation | < 200ms | Simple arithmetic, no external calls |
| Response edit save | < 1s | Text diff + pattern detection is lightweight |
| Correction history load | < 500ms | Indexed query with limit |
| Feedback analysis job | < 5min for 1000 items | Background job, not blocking user |
| Audit export (CSV) | < 30s for 10,000 records | Streaming response for large exports |
| Dependent insight lookup | < 1s | Neo4j graph traversal, indexed |

**Implementation Notes:**
- Optimistic UI updates for validation/rejection buttons
- Correction propagation runs asynchronously after response to user
- Feedback analysis job runs during low-traffic period (Sunday 2am)
- Use database views for pre-computed aggregations

### Security

| Requirement | Implementation | PRD Reference |
|-------------|----------------|---------------|
| Data isolation | RLS on all feedback tables with deal ownership check | NFR-SEC-001 |
| Analyst identity | All feedback entries include analyst_id from auth.uid() | NFR-SEC-002 |
| Immutable audit trail | No UPDATE/DELETE RLS policies on correction tables | NFR-SEC-004 |
| Export authorization | Only deal owners can export audit trail | NFR-SEC-002 |
| Pattern privacy | Edit patterns scoped to individual analyst by default | NFR-SEC-001 |

**RLS Policy Pattern:**
```sql
-- All E7 tables follow nested deal ownership check
finding_id IN (
  SELECT id FROM findings WHERE deal_id IN (
    SELECT id FROM deals WHERE user_id = auth.uid()
  )
)
```

### Reliability/Availability

| Requirement | Implementation |
|-------------|----------------|
| Correction atomicity | Transaction wraps correction insert + findings update |
| Propagation failure isolation | If Neo4j unavailable, correction still succeeds; propagation retried |
| Audit trail durability | Append-only design with no DELETE operations |
| Feedback analysis recovery | Job is idempotent; can be re-run if interrupted |
| Graceful degradation | If pattern detection fails, edit still saved without patterns |

**Error Handling Strategy:**
- Correction API: Transaction rollback on any failure; clear error message
- Validation API: Catch confidence calculation errors; return success with unchanged confidence
- Propagation: Log failures; retry via pg-boss with exponential backoff
- Analysis job: Save partial results; continue processing on recoverable errors

### Observability

| Signal | Implementation |
|--------|----------------|
| Correction created | Log: `feedback.correction.created { findingId, type, analystId }` |
| Validation recorded | Log: `feedback.validation.recorded { findingId, action, newConfidence }` |
| Response edited | Log: `feedback.response.edited { messageId, editType, patternsDetected }` |
| Pattern detected | Log: `feedback.pattern.detected { analystId, patternType, occurrenceCount }` |
| Analysis job completed | Log: `feedback.analysis.completed { period, corrections, validations, issues }` |
| Propagation triggered | Log: `feedback.propagation.triggered { findingId, dependentCount }` |
| Errors | Log with correlation ID: `feedback.error { operation, error, context }` |

**Metrics to Track:**
- Corrections per day/week (volume trend)
- Validation vs rejection ratio (quality indicator)
- Average confidence adjustment magnitude
- Most common edit patterns
- Propagation impact (avg dependent insights per correction)
- Time from correction to propagation complete

## Dependencies and Integrations

### New Package Dependencies

| Package | Version | Purpose | Story |
|---------|---------|---------|-------|
| `diff` | ^7.0.0 | Text diff for detecting edit patterns | E7.3 |
| `csv-stringify` | (existing) | Audit trail CSV export | E7.5 |

### Existing Dependencies Used

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` | Database operations, RLS |
| `neo4j-driver` | Graph queries for dependent insights |
| `@langchain/core` | Agent tool enhancement |
| `zod` | Request/response validation |
| `sonner` | Toast notifications for feedback actions |
| `lucide-react` | Validate/Reject button icons |
| `date-fns` | Date formatting for audit trail |

### Internal Service Dependencies

| Service | Dependency | E7 Usage |
|---------|------------|----------|
| Supabase | Database + Auth | Feedback tables, RLS |
| Neo4j | Graph database | Finding → Insight relationships |
| pg-boss | Job queue | Feedback analysis background job |
| LangChain Agent | Tool framework | Enhanced update_knowledge_base |

### Integration Points

| System | Integration | Direction |
|--------|-------------|-----------|
| Knowledge Explorer (E4) | Validation buttons, correction modal | E7 → E4 |
| Chat Interface (E5) | Correction intent detection, response edit | E5 ↔ E7 |
| Findings Browser (E4) | Confidence badge updates | E7 → E4 |
| Agent Tools (E5) | update_knowledge_base enhancement | E7 → E5 |
| Q&A Module (E8) | Answer needs_review flagging | E7 → E8 |
| CIM Module (E9) | Section needs_review flagging | E7 → E9 |

### Database Table Dependencies

| E7 Table | Depends On | Reason |
|----------|------------|--------|
| `finding_corrections` | `findings` | Foreign key reference |
| `validation_feedback` | `findings` | Foreign key reference |
| `response_edits` | `messages` | Foreign key reference |
| `edit_patterns` | `auth.users` | Analyst ownership |

### Migration Order

1. `00028_create_finding_corrections_table.sql`
2. `00029_create_validation_feedback_table.sql`
3. `00030_create_response_edits_table.sql`
4. `00031_create_edit_patterns_table.sql`
5. `00032_add_needs_review_to_findings.sql`
6. `00033_add_document_reliability_tracking.sql`
7. `00034_create_feature_flags_table.sql`

**Note:** All migrations depend on existing `findings`, `messages`, `conversations`, `documents`, and `audit_logs` tables from E1-E5.

## Acceptance Criteria (Authoritative)

### E7.1: Implement Finding Correction via Chat

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Agent detects correction intent in messages like "The revenue should be $50M, not $45M" | Yes |
| AC2 | Finding is updated in PostgreSQL `findings` table with corrected value | Yes |
| AC3 | Original value stored in `finding_corrections` table with analyst_id and timestamp | Yes |
| AC4 | Agent confirms correction with message including original and new values | Yes |
| AC5 | Related insights are flagged for review (needs_review = true) | Yes |
| AC6 | Agent reports number of affected dependent items in confirmation | Yes |
| AC7 | Multiple corrections in single message are all processed | Yes |
| AC8 | Before accepting correction, agent displays original source document and location | Yes |
| AC9 | Agent asks user for source/basis of correction (e.g., "management call", "different document") | Yes |
| AC10 | User can request "Show Source" to view original document context before confirming | Yes |
| AC11 | Correction record includes validation_status: 'confirmed_with_source', 'override_without_source', or 'source_error' | Yes |
| AC12 | When validation_status = 'source_error', document is marked with reliability_status = 'contains_errors' | Yes |
| AC13 | When validation_status = 'source_error', ALL findings from the source document are flagged for review | Yes |
| AC14 | When validation_status = 'source_error', corrected finding embedding is regenerated in pgvector | Yes |
| AC15 | When validation_status = 'source_error', Neo4j document node and finding nodes are updated | Yes |
| AC16 | Agent reports total number of findings flagged from unreliable document in confirmation | Yes |

### E7.2: Track Validation/Rejection Feedback

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | "Validate" and "Reject" buttons appear on findings in Knowledge Explorer | Yes |
| AC2 | Clicking Validate inserts record in `validation_feedback` with action='validate' | Yes |
| AC3 | Clicking Reject inserts record with action='reject' and optional reason | Yes |
| AC4 | Confidence score increases by 0.05 per validation (capped at 0.95) | Yes |
| AC5 | Confidence score decreases by 0.10 per rejection (floored at 0.1) | Yes |
| AC6 | Sources with >50% rejection rate are flagged for review | Yes |
| AC7 | UI shows updated confidence badge after validation/rejection | Yes |

### E7.3: Enable Response Editing and Learning

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | "Edit Response" button appears on agent messages (Q&A, CIM content) | Yes |
| AC2 | Inline edit mode allows text modification | Yes |
| AC3 | Original and edited text stored in `response_edits` table | Yes |
| AC4 | Text diff detects word replacements (e.g., "utilize" → "use") | Yes |
| AC5 | Patterns with 3+ occurrences stored in `edit_patterns` table | Yes |
| AC6 | Future generations use active patterns in few-shot prompts | Yes |
| AC7 | User can toggle patterns on/off in pattern management UI | Yes |

### E7.4: Build Feedback Incorporation System

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Weekly background job analyzes feedback from all tables | Yes |
| AC2 | Corrections grouped by document type, domain, extraction pattern | Yes |
| AC3 | Systematic issues (>40% rejection rate) flagged for review | Yes |
| AC4 | Prompt improvement suggestions generated for flagged issues | Yes |
| AC5 | Confidence thresholds adjusted based on validation history | Yes |
| AC6 | Basic feedback dashboard shows summary statistics | Yes |
| AC7 | Admin can view and acknowledge flagged issues | Yes |

### E7.5: Maintain Comprehensive Audit Trail

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | All corrections logged with finding_id, original, corrected, analyst, timestamp | Yes |
| AC2 | All validations logged with finding_id, action, analyst, timestamp | Yes |
| AC3 | All response edits logged with message_id, original, edited, analyst, timestamp | Yes |
| AC4 | Audit trail is immutable (no UPDATE/DELETE operations) | Yes |
| AC5 | Audit trail queryable by date range, analyst, finding | Yes |
| AC6 | Export to CSV/JSON with all fields included | Yes |
| AC7 | Finding history view shows complete correction lineage | Yes |

### E7.6: Propagate Corrections to Related Insights

| AC# | Acceptance Criteria | Testable |
|-----|---------------------|----------|
| AC1 | Neo4j query finds all insights connected via BASED_ON relationship | Yes |
| AC2 | Dependent Q&A answers flagged with needs_review = true | Yes |
| AC3 | Dependent CIM sections flagged with needs_review = true | Yes |
| AC4 | User notified of number of dependent items affected | Yes |
| AC5 | Impact summary shows type and title of each affected item | Yes |
| AC6 | "Regenerate All" option triggers re-analysis with corrected data | Yes |
| AC7 | "Needs Review" badge visible on affected items in UI | Yes |

## Traceability Mapping

| AC | Spec Section | Component/API | Test Type |
|----|--------------|---------------|-----------|
| E7.1-AC1 | Workflows | `lib/agent/tools/knowledge-tools.ts` | Integration |
| E7.1-AC2 | Data Models | `lib/services/corrections.ts` | Unit |
| E7.1-AC3 | Data Models | `finding_corrections` table | Integration |
| E7.1-AC4 | Workflows | Agent response formatting | Integration |
| E7.1-AC5 | Workflows | `lib/services/correction-propagation.ts` | Unit |
| E7.1-AC6 | Workflows | Agent response formatting | Integration |
| E7.1-AC7 | Workflows | Multi-correction parsing | Unit |
| E7.1-AC8 | Workflows | Source document retrieval, citation display | Integration |
| E7.1-AC9 | Workflows | Source validation prompt | Integration |
| E7.1-AC10 | Workflows | Show Source document preview | Integration |
| E7.1-AC11 | Data Models | validation_status field in finding_corrections | Unit |
| E7.1-AC12 | Services | `lib/services/source-error-cascade.ts` | Integration |
| E7.1-AC13 | Services | `lib/services/source-error-cascade.ts` | Integration |
| E7.1-AC14 | Services | `lib/services/embeddings.ts` (re-embed) | Integration |
| E7.1-AC15 | Services | `lib/services/source-error-cascade.ts` (Neo4j sync) | Integration |
| E7.1-AC16 | Workflows | Agent response formatting | Integration |
| E7.2-AC1 | Services | `FindingValidationButtons.tsx` | Component |
| E7.2-AC2 | APIs | `POST /findings/[id]/validate` | Integration |
| E7.2-AC3 | APIs | `POST /findings/[id]/reject` | Integration |
| E7.2-AC4-5 | Services | `lib/services/validation-feedback.ts` | Unit |
| E7.2-AC6 | Services | Source rejection rate calculation | Unit |
| E7.2-AC7 | Services | `FindingValidationButtons.tsx` | Component |
| E7.3-AC1 | Services | `ResponseEditMode.tsx` | Component |
| E7.3-AC2 | Services | Inline edit UI | Component |
| E7.3-AC3 | Data Models | `response_edits` table | Integration |
| E7.3-AC4 | Services | `lib/services/response-edits.ts` | Unit |
| E7.3-AC5 | Data Models | `edit_patterns` table | Integration |
| E7.3-AC6 | Services | `lib/services/prompt-enhancement.ts` | Unit |
| E7.3-AC7 | Services | Pattern management UI | Component |
| E7.4-AC1 | Workflows | pg-boss job handler | Integration |
| E7.4-AC2 | Services | `lib/services/feedback-analysis.ts` | Unit |
| E7.4-AC3-4 | Services | Issue detection algorithm | Unit |
| E7.4-AC5 | Services | Confidence threshold adjustment | Unit |
| E7.4-AC6-7 | Services | `FeedbackDashboard.tsx` | Component |
| E7.5-AC1-3 | Data Models | Feedback tables | Integration |
| E7.5-AC4 | Data Models | RLS policies (no DELETE) | Integration |
| E7.5-AC5 | APIs | `GET /audit/corrections` | Integration |
| E7.5-AC6 | APIs | `GET /audit/export` | Integration |
| E7.5-AC7 | Services | `FindingHistoryPanel.tsx` | Component |
| E7.6-AC1 | Services | Neo4j BASED_ON query | Integration |
| E7.6-AC2-3 | Services | `lib/services/correction-propagation.ts` | Unit |
| E7.6-AC4-5 | Workflows | Impact summary generation | Unit |
| E7.6-AC6 | Workflows | Regeneration trigger | Integration |
| E7.6-AC7 | Services | NeedsReviewBadge component | Component |

### Functional Requirements Coverage

| FR | Stories | Status |
|----|---------|--------|
| FR-LEARN-001: Finding Corrections | E7.1, E7.5 | Covered |
| FR-LEARN-002: Confidence Score Learning | E7.2, E7.4 | Covered |
| FR-LEARN-003: Response Improvement | E7.3 | Covered |
| FR-LEARN-004: Feedback Incorporation | E7.4 | Covered |
| FR-COLLAB-002: Finding Capture & Validation | E7.1, E7.2 | Covered |
| FR-KB-004: Cross-Document Analysis | E7.6 | Covered |
| NFR-COMP-001: Data Retention and Audit | E7.5 | Covered |

## Risks, Assumptions, Open Questions

### Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Correction intent misdetection** - Agent incorrectly interprets statement as correction | Medium | Require explicit confirmation for ambiguous corrections; add "undo" capability |
| **Incorrect user corrections** - User provides wrong correction that contaminates knowledge base | High | Source validation flow shows original citation before accepting; require explanation for override; track override accuracy over time |
| **Pattern detection false positives** - System detects coincidental patterns | Low | Require 3+ occurrences; allow users to deactivate patterns |
| **Feedback volume overwhelm** - Too much feedback to process effectively | Low | Prioritize high-confidence corrections; batch analysis weekly |
| **Neo4j dependency for propagation** - Graph unavailability blocks correction flow | Medium | Make propagation async; allow correction to succeed even if propagation fails |
| **Confidence score gaming** - Users spam validate to inflate scores | Low | Cap validation impact; track validation velocity for anomaly detection |
| **Audit trail storage growth** - Append-only tables grow unbounded | Low | Archive old records after retention period; implement partitioning |
| **Source citation unavailable** - Original extraction didn't capture document/location | Medium | Graceful degradation: allow correction without citation but flag as "unverified"; backfill source data where possible |
| **Source error cascade causes mass data corruption** - Incorrect cascade flags too many findings | High | Feature flag `sourceErrorCascadeEnabled` defaults OFF; gradual rollout; audit logging on all cascade operations |
| **Feature flag misconfiguration** - Wrong flag state causes unexpected behavior | Medium | Audit logging on all flag changes; require admin role for flag updates; clear documentation of flag effects |

### Assumptions

| Assumption | Impact if Wrong |
|------------|-----------------|
| Analysts will provide corrections through chat naturally | May need explicit "correct" command syntax |
| 3+ occurrences is sufficient threshold for pattern significance | Threshold may need tuning based on usage |
| Weekly feedback analysis is frequent enough | May need daily analysis for high-volume deals |
| Simple confidence adjustment algorithm is adequate | May need more sophisticated ML-based approach |
| Neo4j BASED_ON relationships accurately capture finding dependencies | May miss some dependencies; need manual review option |
| Users prefer manual pattern management over automatic | May need auto-apply option for trusted patterns |

### Open Questions

| Question | Decision Needed By | Proposed Answer |
|----------|-------------------|-----------------|
| Should corrections require explicit confirmation? | E7.1 implementation | Yes for ambiguous corrections, no for clear ones |
| How to handle conflicting corrections (user A corrects, user B corrects differently)? | E7.1 implementation | Latest wins; maintain full history; flag for review |
| Should pattern learning be per-analyst or shared across team? | E7.3 implementation | Per-analyst in MVP; team-wide opt-in in Phase 2 |
| What threshold triggers "systematic issue" flag? | E7.4 implementation | 40% rejection rate with minimum 10 samples |
| How long to retain audit trail records? | E7.5 implementation | 7 years (M&A compliance standard) |
| Should regeneration be automatic or user-triggered? | E7.6 implementation | User-triggered in MVP; auto-regenerate option in Phase 2 |

## Test Strategy Summary

### Unit Tests

| Module | Test Focus | Coverage Target |
|--------|------------|-----------------|
| `corrections.ts` | Correction processing, validation | 90% |
| `source-error-cascade.ts` | Document flagging, bulk finding updates, embedding regeneration, Neo4j sync | 90% |
| `validation-feedback.ts` | Confidence calculation, threshold capping | 95% |
| `response-edits.ts` | Text diff, pattern detection | 85% |
| `feedback-analysis.ts` | Grouping, issue detection, suggestions | 80% |
| `audit-trail.ts` | Query building, export formatting | 85% |
| `correction-propagation.ts` | Impact calculation, flagging logic | 90% |
| `prompt-enhancement.ts` | Few-shot injection, pattern filtering | 85% |

### Component Tests

| Component | Test Cases |
|-----------|------------|
| `FindingValidationButtons` | Validate click, Reject click, optimistic update, error state |
| `FindingCorrectionModal` | Open/close, form validation, submit, cancel |
| `FindingHistoryPanel` | History display, date filtering, analyst filtering |
| `ResponseEditMode` | Edit toggle, text modification, save, cancel, pattern display |
| `FeedbackDashboard` | Summary loading, chart rendering, issue list |
| `AuditTrailExport` | Format selection, date range, download trigger |
| `NeedsReviewBadge` | Badge visibility, tooltip, click navigation |

### Integration Tests

| Flow | Test Cases |
|------|------------|
| Correction via Chat | Message → Intent detection → DB update → Propagation → Response |
| Source Error Cascade | source_error correction → Document flagged → All findings flagged → Embedding regenerated → Neo4j updated |
| Validation Flow | Button click → API call → Confidence update → UI refresh |
| Response Edit | Edit mode → Modify → Save → Pattern detection → Storage |
| Feedback Analysis | Job trigger → Data aggregation → Issue detection → Report generation |
| Audit Export | Query params → Data fetch → Format → Download |
| Correction Propagation | Finding update → Neo4j query → Flag dependents → Impact summary |

### E2E Tests (Playwright)

| Scenario | Steps |
|----------|-------|
| Correct finding via chat | Open chat → Send correction message → Verify confirmation → Check finding updated |
| Validate finding in Knowledge Explorer | Navigate to finding → Click Validate → Verify confidence badge updated |
| Edit agent response | View Q&A answer → Click Edit → Modify text → Save → Verify stored |
| Export audit trail | Navigate to admin → Select date range → Export CSV → Verify file contents |
| Review needs_review items | Correct finding → Navigate to Q&A → Verify Needs Review badge visible |

### Test Data

- Mock findings with various confidence levels in `__tests__/fixtures/`
- Sample correction scenarios (value, source, text corrections)
- Response edit examples with known patterns
- Feedback analysis test datasets
- Supabase mock utilities from E5/E6 (`__tests__/utils/supabase-mock.ts`)
- Neo4j mock for graph queries

### Test Considerations from E6 Retrospective

Based on E6 learnings:
1. **TypeScript strict mode** - Ensure all test files pass type checking
2. **Mock consistency** - Use shared mock utilities for Supabase
3. **Component isolation** - Test feedback components independently from services
4. **Background job testing** - Use pg-boss test mode for job handler tests
5. **Pattern detection edge cases** - Test with various text diff scenarios
