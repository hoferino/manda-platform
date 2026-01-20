---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/card.tsx
type: component
updated: 2026-01-20
status: active
---

# card.tsx

## Purpose

Provides a composable Card component system for content containers. Includes Card, CardHeader, CardTitle, CardDescription, CardAction, CardContent, and CardFooter subcomponents that work together with consistent spacing, borders, and shadows. Uses CSS grid in header for flexible action button placement.

## Exports

- `Card` - Container component with rounded borders and shadow
- `CardHeader` - Header section with grid layout for title and actions
- `CardTitle` - Title element with semibold styling
- `CardDescription` - Muted description text
- `CardAction` - Positioned slot for action buttons in header
- `CardContent` - Main content area with horizontal padding
- `CardFooter` - Footer section for actions and metadata

## Dependencies

- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Uses data-slot attributes for external styling hooks. CardHeader uses CSS @container queries for responsive layouts. Border-b and border-t classes on children trigger conditional padding via sibling selectors.
