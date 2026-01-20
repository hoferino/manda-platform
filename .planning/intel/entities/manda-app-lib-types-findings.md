---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/types/findings.ts
type: model
updated: 2026-01-20
status: active
---

# findings.ts

## Purpose

Defines the complete type system for Knowledge Explorer findings. Findings are extracted data points from due diligence documents, categorized by domain (financial, operational, market, legal, technical) and type (metric, fact, risk, opportunity, contradiction). Supports validation workflow, confidence scoring, and search with similarity scoring.

## Exports

- Type aliases: `FindingDomain`, `FindingType`, `FindingStatus`
- Interfaces: `ValidationEvent`, `Finding`, `FindingWithContext`, `FindingFilters`, `FindingStats`, `FindingsResponse`, `FindingWithSimilarity`, `SearchResponse`, `SearchFilters`
- Display config: `FINDING_DOMAINS`, `FINDING_TYPES`, `FINDING_STATUSES`, `CONFIDENCE_LEVELS`
- Helper functions: `getConfidenceLevel`, `getDomainInfo`, `getTypeInfo`, `getStatusInfo`

## Dependencies

- [[manda-app-lib-supabase-database-types]] - Database enum types

## Used By

TBD

## Notes

FindingDomain and FindingType are derived from database enums for type safety. Findings have a validation workflow (pending, validated, rejected) with an audit trail of ValidationEvents. Confidence levels map numeric scores to high/medium/low for display. Review flags support correction propagation from E7.6.
