---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/alert-dialog.tsx
type: component
updated: 2026-01-20
status: active
---

# alert-dialog.tsx

## Purpose

Provides an accessible AlertDialog component for confirmation prompts and destructive action warnings built on Radix UI AlertDialog primitives. Requires explicit user action to dismiss (no click-outside-to-close). Includes action and cancel buttons with button variant styling.

## Exports

- `AlertDialog` - Root component managing open state
- `AlertDialogTrigger` - Trigger element for opening dialog
- `AlertDialogPortal` - Portal container for overlay and content
- `AlertDialogOverlay` - Semi-transparent backdrop with animations
- `AlertDialogContent` - Modal content container centered on screen
- `AlertDialogHeader` - Header section for title and description
- `AlertDialogFooter` - Footer with responsive button layout
- `AlertDialogTitle` - Accessible title element
- `AlertDialogDescription` - Accessible description element
- `AlertDialogAction` - Primary action button with default button styling
- `AlertDialogCancel` - Cancel button with outline button styling

## Dependencies

- @radix-ui/react-alert-dialog - Accessible alert dialog primitives
- [[manda-app-components-ui-button]] - buttonVariants for action/cancel styling
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). Unlike Dialog, AlertDialog cannot be dismissed by clicking outside or pressing Escape - requires explicit action. Ideal for confirming destructive operations.
