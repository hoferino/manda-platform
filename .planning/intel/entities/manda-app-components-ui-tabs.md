---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/tabs.tsx
type: component
updated: 2026-01-20
status: active
---

# tabs.tsx

## Purpose

Provides an accessible Tabs component system built on Radix UI Tabs primitives. Includes root container, tab list with muted background, trigger buttons with active state styling, and content panels with automatic show/hide based on selection.

## Exports

- `Tabs` - Root component managing selected tab state
- `TabsList` - Container for tab triggers with muted background
- `TabsTrigger` - Individual tab button with active state styling
- `TabsContent` - Content panel that shows when tab is selected

## Dependencies

- @radix-ui/react-tabs - Accessible tabs primitives
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). TabsList has inline-flex with rounded-lg pill shape. Active trigger gets background change with subtle shadow. SVG icons within triggers auto-size to 16px.
