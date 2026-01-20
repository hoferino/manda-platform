---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/types/feedback.ts
type: model
updated: 2026-01-20
status: active
---

# feedback.ts

## Purpose

Defines the complete type system for the Learning Loop feedback mechanisms. Covers finding corrections with source validation, validation/rejection feedback, response edits with pattern detection, feedback analysis and aggregation, confidence threshold adjustments, and audit trail exports. Enables the platform to learn from analyst corrections and improve extraction accuracy over time.

## Exports

- Correction types: `ValidationStatus`, `CorrectionType`, `FindingCorrection`, `CreateCorrectionRequest`, `DependentInsight`, `SourceDocumentImpact`, `CorrectionWithImpact`, `SourceCitation`, `OriginalSourceResult`, `CorrectionHistoryEntry`, `PropagationResult`, `SourceErrorCascadeResult`, `AgentCorrectionRequest`, `AgentCorrectionResponse`, `ParsedCorrectionIntent`
- Validation types: `ValidationAction`, `ValidationFeedback`, `RecordValidationRequest`, `FindingValidationStats`, `ValidationFeedbackResult`, `SourceRejectionInfo`, `ValidationApiResponse`, `ValidationStatsApiResponse`
- Edit types: `EditType`, `PatternType`, `ResponseEdit`, `SaveResponseEditRequest`, `EditPattern`, `DetectedPattern`, `ResponseEditResult`, `TogglePatternRequest`, `FewShotExample`
- Analysis types: `FindingFeedbackAggregate`, `FeedbackPattern`, `FeedbackAnalysisSummary`, `DomainFeedbackStats`, `AnalysisRecommendation`, `ConfidenceThresholdAdjustment`, `FeedbackAnalysisJobRequest`, `FeedbackAnalysisJobResult`, `PromptImprovementSuggestion`, `FeedbackAnalyticsRecord`, `ConfidenceThresholdRecord`, `AnalysisJobStatus`
- Audit types: `AuditEntryType`, `AuditQueryParams`, `AuditEntry`, `FindingHistoryEntry`, `AuditExportFormat`, `AuditExportOptions`, `AuditExportResult`, `AuditExportJSON`, `PaginatedAuditResult`, `AUDIT_CSV_HEADERS`
- Database mappers: `mapDbToFindingCorrection`, `mapCorrectionToDbInsert`, `mapDbToResponseEdit`, `mapDbToEditPattern`, `mapDbToFeedbackAnalyticsRecord`, `mapDbToConfidenceThresholdRecord`, `auditEntryToCsvRow`

## Dependencies

- [[manda-app-lib-supabase-database-types]] - Database row types

## Used By

TBD

## Notes

Supports source error cascade when corrections indicate document-level extraction issues. Pattern detection enables automatic style learning from response edits. Audit trail exportable to CSV/JSON with full metadata.
