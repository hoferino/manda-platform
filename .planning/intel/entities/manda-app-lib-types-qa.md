---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/types/qa.ts
type: model
updated: 2026-01-20
status: active
---

# qa.ts

## Purpose

Defines the complete type system for the Q&A Co-Creation Workflow. Q&A items represent questions sent to the CLIENT to answer (not AI-generated answers) when document analysis reveals gaps that cannot be resolved from the knowledge base. Provides types for items, filtering, statistics, Excel import with pattern matching, and optimistic locking support for concurrent edits.

## Exports

- Constants and types: `QA_CATEGORIES`, `QACategory`, `QA_PRIORITIES`, `QAPriority`
- Core types: `QAItem`, `CreateQAItemInput`, `UpdateQAItemInput`, `QAConflictError`, `QAFilters`, `QASummary`
- Helper functions: `isPending`, `isAnswered`, `getQAItemStatus`, `isQAConflictError`, `getCategoryInfo`, `getPriorityInfo`, `calculateQASummary`
- Display config: `QA_CATEGORY_CONFIG`, `QA_PRIORITY_CONFIG`
- Zod schemas: `QACategorySchema`, `QAPrioritySchema`, `CreateQAItemInputSchema`, `UpdateQAItemInputSchema`, `QAFiltersSchema`
- Database mapping: `QAItemDbRow`, `mapDbRowToQAItem`, `mapQAItemToDbInsert`, `mapQAItemToDbUpdate`
- Import types: `ImportedQARow`, `QAExactMatch`, `QAFuzzyMatch`, `QAImportPreview`, `FuzzyMatchDecision`, `ImportConfirmation`, `ImportConfirmationResult`
- Import schemas: `ImportedQARowSchema`, `FuzzyMatchDecisionSchema`, `ImportConfirmationSchema`

## Dependencies

- zod - Schema validation library

## Used By

TBD

## Notes

Status is derived from date_answered (NULL = pending, NOT NULL = answered). Optimistic locking uses updatedAt field to prevent concurrent edit conflicts (returns 409 on stale updates). Excel import supports exact matching, fuzzy matching (>90% Levenshtein similarity), and new item creation.
