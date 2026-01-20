---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/utils.ts
type: util
updated: 2026-01-20
status: active
---

# utils.ts

## Purpose

Provides the foundational CSS class name utility function used throughout the application. Combines clsx for conditional class composition with tailwind-merge to intelligently merge Tailwind CSS classes, preventing style conflicts when multiple classes target the same CSS property.

## Exports

- `cn(...inputs: ClassValue[]): string` - Combines and merges CSS class names, handling Tailwind conflicts

## Dependencies

- clsx - Conditional class name composition
- tailwind-merge - Intelligent Tailwind CSS class merging

## Used By

TBD

## Notes

This is one of the most imported utilities in the codebase. Used by virtually all UI components for dynamic class composition.
