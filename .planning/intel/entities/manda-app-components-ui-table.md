---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/table.tsx
type: component
updated: 2026-01-20
status: active
---

# table.tsx

## Purpose

Provides a complete Table component system with semantic HTML elements. Includes container with horizontal scroll, header with bottom borders, body rows with hover and selected states, footer with muted background, and caption positioning.

## Exports

- `Table` - Table element wrapped in scrollable container
- `TableHeader` - thead element with row border styling
- `TableBody` - tbody element with last-row border removal
- `TableFooter` - tfoot element with muted background
- `TableRow` - tr element with hover and selected states
- `TableHead` - th element with medium font weight
- `TableCell` - td element with padding and alignment
- `TableCaption` - caption element with muted text

## Dependencies

- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). Container provides horizontal overflow scrolling for wide tables. Checkbox columns have special alignment adjustments. Uses data-[state=selected] for row selection styling.
