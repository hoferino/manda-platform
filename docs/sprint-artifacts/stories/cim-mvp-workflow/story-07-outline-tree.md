# Story 7: CIM Structure Panel (Outline Tree)

**File:** `manda-app/components/cim-builder/SourcesPanel/SourcesPanel.tsx`
**Completion Promise:** `OUTLINE_TREE_COMPLETE`
**Max Iterations:** 20

---

## Overview

Add an OutlineTree component to the SourcesPanel that displays the CIM outline as a collapsible tree with sections and slides. Show progress indicators for each section.

## Dependencies

- Story 1 (State Schema) must be complete
- Story 6 (UI Hook) must be complete

## Tasks

- [ ] 7.1 Create `OutlineTree` component
  - Props: outline (CIMOutline | null), sectionProgress (Record<string, SectionProgress>), onSectionClick, onSlideClick
  - Renders collapsible tree structure

- [ ] 7.2 Display sections as top-level tree items
  - Show section title
  - Collapsible to show/hide slides
  - Click handler for section selection

- [ ] 7.3 Display slides under each section
  - Show slide title
  - Indent under parent section
  - Click handler for slide selection

- [ ] 7.4 Add progress indicators
  - Per section: pending (gray), content_development (yellow), building_slides (blue), complete (green)
  - Use icons or colored dots
  - Show check mark for complete sections

- [ ] 7.5 Handle empty state
  - When outline is null, show placeholder: "No outline yet. Complete the outline stage to see the CIM structure."
  - Style appropriately

- [ ] 7.6 Wire up to parent SourcesPanel
  - Add outline and sectionProgress props to SourcesPanel
  - Add OutlineTree to the panel (perhaps in a new tab or section)
  - Handle click callbacks

- [ ] 7.7 Style the tree component
  - Use existing Tailwind classes
  - Match design of existing SourcesPanel tabs
  - Ensure good contrast and readability

- [ ] 7.8 Run `npm run type-check` - must pass with no errors

## Component Structure

```tsx
// OutlineTree.tsx
interface OutlineTreeProps {
  outline: CIMOutline | null
  sectionProgress?: Record<string, SectionProgress>
  currentSectionId?: string
  currentSlideId?: string
  onSectionClick?: (sectionId: string) => void
  onSlideClick?: (slideId: string) => void
}

export function OutlineTree({
  outline,
  sectionProgress = {},
  currentSectionId,
  currentSlideId,
  onSectionClick,
  onSlideClick
}: OutlineTreeProps) {
  if (!outline) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>No outline yet.</p>
        <p className="text-sm">Complete the outline stage to see the CIM structure.</p>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {outline.sections.map((section) => {
        const progress = sectionProgress[section.id]
        const isCurrentSection = section.id === currentSectionId

        return (
          <SectionItem
            key={section.id}
            section={section}
            progress={progress}
            isCurrentSection={isCurrentSection}
            currentSlideId={currentSlideId}
            onSectionClick={onSectionClick}
            onSlideClick={onSlideClick}
          />
        )
      })}
    </div>
  )
}
```

## Progress Indicator Styling

```tsx
function getProgressIndicator(status?: string) {
  switch (status) {
    case 'complete':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'building_slides':
      return <div className="h-3 w-3 rounded-full bg-blue-500" />
    case 'content_development':
      return <div className="h-3 w-3 rounded-full bg-yellow-500" />
    default: // pending
      return <div className="h-3 w-3 rounded-full bg-gray-300" />
  }
}
```

## Section Item Component

```tsx
function SectionItem({
  section,
  progress,
  isCurrentSection,
  currentSlideId,
  onSectionClick,
  onSlideClick
}: {
  section: CIMSection
  progress?: SectionProgress
  isCurrentSection: boolean
  currentSlideId?: string
  onSectionClick?: (id: string) => void
  onSlideClick?: (id: string) => void
}) {
  const [isExpanded, setIsExpanded] = useState(isCurrentSection)

  return (
    <div>
      {/* Section header */}
      <button
        className={cn(
          "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-left text-sm",
          isCurrentSection ? "bg-accent" : "hover:bg-muted"
        )}
        onClick={() => {
          setIsExpanded(!isExpanded)
          onSectionClick?.(section.id)
        }}
      >
        <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
        {getProgressIndicator(progress?.status)}
        <span className="truncate">{section.title}</span>
      </button>

      {/* Slides (when expanded) */}
      {isExpanded && progress?.slides && progress.slides.length > 0 && (
        <div className="ml-6 mt-1 space-y-1">
          {progress.slides.map((slide) => (
            <button
              key={slide.slideId}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1 rounded text-left text-xs",
                slide.slideId === currentSlideId ? "bg-accent" : "hover:bg-muted"
              )}
              onClick={() => onSlideClick?.(slide.slideId)}
            >
              {slide.visualApproved ? (
                <CheckCircle className="h-3 w-3 text-green-500" />
              ) : slide.contentApproved ? (
                <div className="h-2 w-2 rounded-full bg-blue-500" />
              ) : (
                <div className="h-2 w-2 rounded-full bg-gray-300" />
              )}
              <span className="truncate">Slide {slide.slideId.split('-').pop()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Acceptance Criteria

1. OutlineTree component renders sections and slides
2. Progress indicators show correct status
3. Empty state handled gracefully
4. Click handlers work for navigation
5. Component integrates into SourcesPanel
6. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 7 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-07-outline-tree.md.

Read the story file for component specifications.

Create OutlineTree component and integrate into SourcesPanel.

Work in manda-app/components/cim-builder/SourcesPanel/.

Import types from @/lib/agent/cim-mvp as needed.

After changes, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>OUTLINE_TREE_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 20 --completion-promise "OUTLINE_TREE_COMPLETE"
```
