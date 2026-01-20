---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/scroll-area.tsx
type: component
updated: 2026-01-20
status: active
---

# scroll-area.tsx

## Purpose

Provides a custom ScrollArea component built on Radix UI ScrollArea primitives. Offers styled scrollbars that appear on hover/scroll with smooth transitions, replacing native browser scrollbars while maintaining keyboard accessibility.

## Exports

- `ScrollArea` - Container component with viewport, scrollbar, and corner
- `ScrollBar` - Scrollbar component with vertical/horizontal orientation support

## Dependencies

- @radix-ui/react-scroll-area - Accessible scroll area primitives
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). Viewport inherits border-radius from parent. ScrollBar width is 10px with transparent border for spacing. Thumb uses border color for subtle appearance.
