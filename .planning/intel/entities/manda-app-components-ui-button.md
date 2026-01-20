---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/button.tsx
type: component
updated: 2026-01-20
status: active
---

# button.tsx

## Purpose

Provides the core Button component for the design system using class-variance-authority for variant management. Supports multiple visual variants (default, destructive, outline, secondary, ghost, link) and sizes (default, sm, lg, icon variants). Implements accessible button patterns with Radix UI Slot support for composition.

## Exports

- `Button` - React component with variant and size props, supports asChild for composition
- `buttonVariants` - CVA function for generating button class names outside the component

## Dependencies

- @radix-ui/react-slot - Slot component for asChild composition pattern
- class-variance-authority - CVA for variant-based styling
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Uses data-slot="button" for styling hooks. Implements focus-visible states and aria-invalid styling for form integration.
