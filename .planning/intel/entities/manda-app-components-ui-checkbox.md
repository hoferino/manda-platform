---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/checkbox.tsx
type: component
updated: 2026-01-20
status: active
---

# checkbox.tsx

## Purpose

Provides an accessible Checkbox component built on Radix UI Checkbox primitive. Supports checked, unchecked, and indeterminate states with check icon indicator, focus ring, and form validation integration via aria-invalid.

## Exports

- `Checkbox` - React checkbox component with check indicator

## Dependencies

- @radix-ui/react-checkbox - Accessible checkbox primitive
- lucide-react - CheckIcon for indicator
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). Uses peer class for label association styling. Checked state changes background to primary color. Slight rounded corners (4px) for modern look. Size is 16x16px with 14px icon.
