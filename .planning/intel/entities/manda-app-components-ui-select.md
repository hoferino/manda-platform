---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/select.tsx
type: component
updated: 2026-01-20
status: active
---

# select.tsx

## Purpose

Provides a complete Select component system built on Radix UI Select primitives. Includes trigger with size variants, scrollable content with viewport, items with check indicators, groups with labels, separators, and scroll buttons for overflow navigation.

## Exports

- `Select` - Root component managing selection state
- `SelectTrigger` - Trigger button with chevron icon, supports sm/default sizes
- `SelectValue` - Value display within trigger
- `SelectContent` - Dropdown content with scroll buttons
- `SelectItem` - Individual option with check indicator
- `SelectGroup` - Group container for related items
- `SelectLabel` - Label for item groups
- `SelectSeparator` - Visual divider between groups
- `SelectScrollUpButton` - Top scroll navigation
- `SelectScrollDownButton` - Bottom scroll navigation

## Dependencies

- @radix-ui/react-select - Accessible select primitives
- lucide-react - CheckIcon, ChevronDownIcon, ChevronUpIcon
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). Uses popper positioning by default with directional slide animations. Content max-height uses Radix CSS variable for available space. Trigger supports data-size attribute for size variants.
