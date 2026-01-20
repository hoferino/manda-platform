---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/label.tsx
type: component
updated: 2026-01-20
status: active
---

# label.tsx

## Purpose

Provides an accessible Label component built on Radix UI Label primitive. Associates with form controls and handles disabled states via peer and group selectors.

## Exports

- `Label` - React label component with accessible association support

## Dependencies

- @radix-ui/react-label - Accessible label primitive
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). Uses group-data-[disabled=true] and peer-disabled selectors to inherit disabled styling from associated form controls. Flex layout with gap for inline icon support.
