---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/badge.tsx
type: component
updated: 2026-01-20
status: active
---

# badge.tsx

## Purpose

Provides the Badge component for displaying status indicators, labels, and tags. Uses class-variance-authority for variant management with support for default, secondary, destructive, and outline styles. Implements accessible patterns with Radix UI Slot support for polymorphic rendering.

## Exports

- `Badge` - React component with variant prop, supports asChild for composition
- `badgeVariants` - CVA function for generating badge class names outside the component

## Dependencies

- @radix-ui/react-slot - Slot component for asChild composition pattern
- class-variance-authority - CVA for variant-based styling
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Uses data-slot="badge" for styling hooks. Styled as rounded-full pill shape with consistent sizing across variants. Supports SVG icons with automatic sizing.
