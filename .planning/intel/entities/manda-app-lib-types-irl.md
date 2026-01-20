---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/types/irl.ts
type: model
updated: 2026-01-20
status: active
---

# irl.ts

## Purpose

Defines the complete type system for the Information Request List (IRL) workflow. Provides types for IRL templates loaded from JSON, database entities (IRL, IRLItem, Folder), progress tracking, display configuration, and Zod validation schemas. Enables systematic document request tracking and data room folder management during M&A due diligence.

## Exports

- Constants and types: `IRL_DEAL_TYPES`, `IRLDealType`, `IRL_PRIORITIES`, `IRLPriority`, `IRL_ITEM_STATUSES`, `IRLItemStatus`
- Template types: `IRLTemplateItem`, `IRLTemplateCategory`, `IRLTemplate`
- Database types: `IRL`, `IRLItem`, `Folder`
- Progress types: `IRLProgress`, `IRLFulfilledProgress`, `IRLProgressByCategory`, `IRLFulfilledProgressWithCategories`
- Display config: `IRL_DEAL_TYPE_CONFIG`, `IRL_PRIORITY_CONFIG`, `IRL_STATUS_CONFIG`
- Helper functions: `calculateIRLProgress`, `calculateIRLFulfilledProgress`, `calculateIRLProgressByCategory`, `calculateIRLFulfilledProgressWithCategories`, `getDealTypeInfo`, `getPriorityInfo`, `getStatusInfo`, `countTemplateItems`
- Zod schemas: `IRLTemplateItemSchema`, `IRLTemplateCategorySchema`, `IRLTemplateSchema`, `CreateIRLRequestSchema`, `UpdateIRLRequestSchema`, `CreateIRLItemRequestSchema`, `UpdateIRLItemRequestSchema`, `UpdateIRLItemStatusRequestSchema`, `UpdateIRLItemFulfilledRequestSchema`, `ReorderIRLItemsRequestSchema`, `AddCategoryRequestSchema`, `RenameCategoryRequestSchema`
- Request types: `CreateIRLRequest`, `UpdateIRLRequest`, `CreateIRLItemRequest`, `UpdateIRLItemRequest`, `UpdateIRLItemStatusRequest`, `UpdateIRLItemFulfilledRequest`, `ReorderIRLItemsRequest`, `AddCategoryRequest`, `RenameCategoryRequest`
- Response types: `IRLWithItems`, `TemplatesResponse`, `IRLsResponse`, `CreateIRLResponse`

## Dependencies

- zod - Schema validation library

## Used By

TBD

## Notes

Supports two progress tracking modes: legacy status-based (not_started, pending, received, complete) and binary fulfilled-based for manual checklists. Templates define standard document request categories by deal type.
