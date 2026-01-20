---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/types/gaps.ts
type: model
updated: 2026-01-20
status: active
---

# gaps.ts

## Purpose

Defines types for the Knowledge Explorer gap analysis system. Gaps identify missing information in due diligence: IRL items not received, information gaps from domain coverage analysis, and incomplete analysis areas. Gaps are computed at runtime from IRL items and findings coverage, not stored in a dedicated database table.

## Exports

- Type aliases: `GapCategory`, `GapPriority`, `GapStatus`
- Interfaces: `Gap`, `IRLGap`, `InformationGap`, `GapFilters`, `GapsResponse`, `GapResolution`, `AddToIRLRequest`, `ManualFindingRequest`
- Display config: `GAP_CATEGORIES`, `GAP_PRIORITIES`, `GAP_STATUSES`
- Filter options: `GAP_CATEGORY_FILTER_OPTIONS`, `GAP_STATUS_FILTER_OPTIONS`, `GAP_PRIORITY_FILTER_OPTIONS`, `GAP_SORT_OPTIONS`
- Helper functions: `getGapCategoryInfo`, `getGapPriorityInfo`, `getGapStatusInfo`, `sortGapsByPriority`, `sortGapsByCategory`, `filterGaps`
- Constants: `PRIORITY_ORDER`

## Dependencies

- [[manda-app-lib-types-findings]] - FindingDomain type
- [[manda-app-lib-api-irl]] - IRLItem type

## Used By

TBD

## Notes

Three gap categories: irl_missing (documents requested but not received), information_gap (missing data points from analysis), incomplete_analysis (domains with sparse findings). Gaps can be resolved, marked N/A, or converted to IRL items or manual findings.
