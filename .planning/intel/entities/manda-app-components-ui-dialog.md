---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/dialog.tsx
type: component
updated: 2026-01-20
status: active
---

# dialog.tsx

## Purpose

Provides an accessible modal dialog component built on Radix UI Dialog primitives. Includes all dialog parts (trigger, portal, overlay, content, header, footer, title, description, close) with animations, backdrop blur, and responsive sizing. Supports optional close button visibility.

## Exports

- `Dialog` - Root component managing open/closed state
- `DialogTrigger` - Trigger element for opening dialog
- `DialogPortal` - Portal container for overlay and content
- `DialogClose` - Close button/trigger
- `DialogOverlay` - Semi-transparent backdrop with animations
- `DialogContent` - Modal content container with close button option
- `DialogHeader` - Header section for title and description
- `DialogFooter` - Footer section with responsive button layout
- `DialogTitle` - Accessible title element
- `DialogDescription` - Accessible description element

## Dependencies

- @radix-ui/react-dialog - Accessible dialog primitives
- lucide-react - XIcon for close button
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). DialogContent accepts showCloseButton prop to toggle built-in close button. Uses animate-in/animate-out for enter/exit transitions. Fixed positioning with translate for centering. Max-width responsive: full width mobile, 32rem desktop.
