# Story 8: Preview Panel - Slide Thumbnails

**File:** `manda-app/components/cim-builder/PreviewPanel/PreviewPanel.tsx`
**Completion Promise:** `THUMBNAILS_COMPLETE`
**Max Iterations:** 15

---

## Overview

Add a horizontal scrollable thumbnail strip at the top of the PreviewPanel. Users can see all slides at a glance and click to navigate.

## Dependencies

- Story 1 (State Schema) must be complete

## Tasks

- [ ] 8.1 Add horizontal scrollable container at top of PreviewPanel
  - Fixed height (e.g., 80-100px)
  - Horizontal scroll with overflow-x-auto
  - Flexbox row layout

- [ ] 8.2 Create `SlideThumbnail` component
  - Props: slide (Slide), isSelected (boolean), onClick
  - Mini preview of slide (simplified)
  - Fixed aspect ratio (16:9 or similar)

- [ ] 8.3 Render thumbnail for each slide
  - Map over slides array
  - Pass selection state

- [ ] 8.4 Highlight currently selected slide
  - Border or background color change
  - Scale or shadow effect

- [ ] 8.5 Add click handler to select slide
  - Call onIndexChange with slide index
  - Scroll selected slide into view

- [ ] 8.6 Style section divider thumbnails differently
  - Detect by layoutType === 'title-only'
  - Show section title prominently
  - Different background color (e.g., muted)

- [ ] 8.7 Run `npm run type-check` - must pass with no errors

## Component Structure

```tsx
// In PreviewPanel.tsx
interface PreviewPanelProps {
  slides: Slide[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onComponentSelect?: (componentId: string, content: string) => void
}

export function PreviewPanel({
  slides,
  currentIndex,
  onIndexChange,
  onComponentSelect
}: PreviewPanelProps) {
  const thumbnailsRef = useRef<HTMLDivElement>(null)

  // Scroll selected thumbnail into view
  useEffect(() => {
    const container = thumbnailsRef.current
    if (container) {
      const selectedThumb = container.children[currentIndex] as HTMLElement
      if (selectedThumb) {
        selectedThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
      }
    }
  }, [currentIndex])

  return (
    <div className="flex flex-col h-full">
      {/* Thumbnail strip */}
      <div
        ref={thumbnailsRef}
        className="flex gap-2 p-2 overflow-x-auto border-b bg-muted/30 flex-shrink-0"
      >
        {slides.map((slide, index) => (
          <SlideThumbnail
            key={slide.id}
            slide={slide}
            isSelected={index === currentIndex}
            onClick={() => onIndexChange(index)}
          />
        ))}
        {slides.length === 0 && (
          <div className="text-sm text-muted-foreground p-4">
            No slides yet
          </div>
        )}
      </div>

      {/* Main preview area */}
      <div className="flex-1 overflow-auto p-4">
        {slides[currentIndex] ? (
          <SlidePreview
            slide={slides[currentIndex]}
            onComponentSelect={onComponentSelect}
          />
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  )
}
```

## SlideThumbnail Component

```tsx
interface SlideThumbnailProps {
  slide: Slide
  isSelected: boolean
  onClick: () => void
}

function SlideThumbnail({ slide, isSelected, onClick }: SlideThumbnailProps) {
  const isSectionDivider = slide.components?.some(
    c => c.type === 'title' && slide.components.length === 1
  ) || (slide as any).layoutType === 'title-only'

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-shrink-0 w-24 h-16 rounded border-2 overflow-hidden transition-all",
        "hover:scale-105",
        isSelected
          ? "border-primary ring-2 ring-primary/30"
          : "border-border hover:border-primary/50",
        isSectionDivider && "bg-muted"
      )}
    >
      <div className="w-full h-full p-1 flex items-center justify-center">
        {isSectionDivider ? (
          <span className="text-[8px] font-semibold text-center truncate px-1">
            {slide.title}
          </span>
        ) : (
          <div className="w-full h-full bg-background rounded-sm flex flex-col p-0.5">
            <div className="text-[6px] font-medium truncate">{slide.title}</div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[8px] text-muted-foreground">
                {slide.components?.length || 0} items
              </span>
            </div>
          </div>
        )}
      </div>
    </button>
  )
}
```

## Styling

- Thumbnail container: `flex gap-2 p-2 overflow-x-auto border-b bg-muted/30`
- Thumbnail size: `w-24 h-16` (approximately 16:10 ratio)
- Selected state: `border-primary ring-2 ring-primary/30`
- Hover state: `hover:scale-105 hover:border-primary/50`
- Section divider: `bg-muted` background

## Acceptance Criteria

1. Horizontal thumbnail strip renders at top of PreviewPanel
2. Thumbnails are clickable and update currentIndex
3. Selected thumbnail is visually highlighted
4. Section dividers have distinct styling
5. Scrolls selected thumbnail into view
6. Empty state handled gracefully
7. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 8 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-08-thumbnails.md.

Read the story file for component specifications.

Add thumbnail strip to manda-app/components/cim-builder/PreviewPanel/PreviewPanel.tsx.

After changes, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>THUMBNAILS_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 15 --completion-promise "THUMBNAILS_COMPLETE"
```
