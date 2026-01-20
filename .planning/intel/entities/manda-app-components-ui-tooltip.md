---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/components/ui/tooltip.tsx
type: component
updated: 2026-01-20
status: active
---

# tooltip.tsx

## Purpose

Provides an accessible tooltip component built on Radix UI Tooltip primitives. Includes provider, root, trigger, and content parts with animated entrance/exit, directional slide animations, and a customizable arrow. Sets default delay to 0 for immediate display.

## Exports

- `TooltipProvider` - Context provider with configurable delay
- `Tooltip` - Root component wrapping provider and primitive
- `TooltipTrigger` - Trigger element for showing tooltip
- `TooltipContent` - Tooltip content with arrow and animations

## Dependencies

- @radix-ui/react-tooltip - Accessible tooltip primitives
- [[manda-app-lib-utils]] - cn utility for class merging

## Used By

TBD

## Notes

Client component ("use client"). Default delayDuration is 0ms for immediate display. TooltipContent includes built-in arrow with rotation and rounded corners. Animations vary by placement side using data-[side=*] selectors.
