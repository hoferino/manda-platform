---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/dropdown-menu.tsx
type: component
updated: 2026-01-20
status: active
---

# dropdown-menu.tsx

## Purpose

Provides a complete DropdownMenu component system built on Radix UI DropdownMenu primitives. Supports regular items, checkbox items, radio groups, nested submenus, labels, separators, keyboard shortcuts, and destructive variants with full keyboard navigation.

## Exports

- `DropdownMenu` - Root component managing open state
- `DropdownMenuTrigger` - Trigger element for opening menu
- `DropdownMenuPortal` - Portal container for content
- `DropdownMenuContent` - Main content container with animations
- `DropdownMenuGroup` - Group container for related items
- `DropdownMenuItem` - Standard menu item with inset and destructive variants
- `DropdownMenuCheckboxItem` - Checkbox item with check indicator
- `DropdownMenuRadioGroup` - Container for radio items
- `DropdownMenuRadioItem` - Radio item with circle indicator
- `DropdownMenuLabel` - Section label with inset support
- `DropdownMenuSeparator` - Visual divider
- `DropdownMenuShortcut` - Keyboard shortcut display
- `DropdownMenuSub` - Nested submenu container
- `DropdownMenuSubTrigger` - Submenu trigger with chevron
- `DropdownMenuSubContent` - Submenu content

## Dependencies

- @radix-ui/react-dropdown-menu - Accessible dropdown primitives
- lucide-react - CheckIcon, ChevronRightIcon, CircleIcon
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). Supports destructive variant via data-[variant=destructive]. Inset items have left padding for alignment with checkbox/radio items. Submenu content uses shadow-lg for depth hierarchy.
