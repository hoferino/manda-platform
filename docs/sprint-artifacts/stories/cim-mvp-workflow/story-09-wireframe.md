# Story 9: Preview Panel - Wireframe Rendering

**Files:** `manda-app/components/cim-builder/PreviewPanel/`
**Completion Promise:** `WIREFRAME_COMPLETE`
**Max Iterations:** 25

---

## Overview

Create a WireframeRenderer component that renders slides with their layouts and components as wireframes. This is the visual preview that shows users what their slides will look like.

## Dependencies

- Story 1 (State Schema) must be complete
- Story 8 (Thumbnails) must be complete

## Tasks

- [ ] 9.1 Create `WireframeRenderer` component
  - Props: layoutType (LayoutType), components (SlideComponent[]), title (string)
  - Determines layout based on layoutType
  - Renders components in their regions

- [ ] 9.2 Create layout renderers
  - `FullLayout` - single component fills slide
  - `TitleOnlyLayout` - centered title (section dividers)
  - `TitleContentLayout` - title top, content below
  - `SplitHorizontalLayout` - left/right 50-50
  - `SplitVerticalLayout` - top/bottom

- [ ] 9.3 Create additional layout renderers
  - `QuadrantLayout` - 2x2 grid
  - `ThirdsHorizontalLayout` - 3 columns
  - `SidebarLeftLayout` - narrow left, wide right
  - `SidebarRightLayout` - wide left, narrow right
  - `HeroWithDetailsLayout` - center focal point with corner details

- [ ] 9.4 Create text component renderers
  - `TitleComponent` - large centered title
  - `SubtitleComponent` - smaller subtitle
  - `TextComponent` - paragraph text
  - `BulletListComponent` - bulleted list
  - `NumberedListComponent` - numbered list

- [ ] 9.5 Create data component renderers
  - `MetricComponent` - big number with label
  - `TableComponent` - data table with headers/rows
  - `ChartPlaceholder` - placeholder for any chart type (bar, line, pie, etc.)

- [ ] 9.6 Create callout and highlight renderers
  - `CalloutComponent` - callout box with optional icon
  - `StatHighlightComponent` - highlighted statistic
  - `KeyTakeawayComponent` - key insight box

- [ ] 9.7 Create process/flow renderers
  - `TimelineComponent` - horizontal or vertical timeline
  - `ProcessStepsComponent` - step 1 → step 2 → step 3
  - `FlowchartPlaceholder` - placeholder for flowcharts

- [ ] 9.8 Style wireframes appropriately
  - Use borders and dashed lines for regions
  - Light gray backgrounds for empty regions
  - Component type labels
  - Actual content where available
  - Professional but clearly "wireframe" aesthetic

- [ ] 9.9 Integrate `WireframeRenderer` into PreviewPanel
  - Replace or enhance existing SlidePreview
  - Handle slides with layoutType
  - Fallback for slides without layoutType

- [ ] 9.10 Run `npm run type-check` - must pass with no errors

## Component Architecture

```
PreviewPanel/
├── PreviewPanel.tsx       (main component with thumbnails)
├── WireframeRenderer.tsx  (determines layout, renders)
├── layouts/
│   ├── FullLayout.tsx
│   ├── TitleOnlyLayout.tsx
│   ├── SplitHorizontalLayout.tsx
│   ├── SplitVerticalLayout.tsx
│   ├── QuadrantLayout.tsx
│   ├── ThirdsLayout.tsx
│   ├── SidebarLayout.tsx
│   └── HeroWithDetailsLayout.tsx
└── components/
    ├── TitleComponent.tsx
    ├── TextComponent.tsx
    ├── BulletListComponent.tsx
    ├── MetricComponent.tsx
    ├── TableComponent.tsx
    ├── ChartPlaceholder.tsx
    ├── CalloutComponent.tsx
    └── TimelineComponent.tsx
```

## WireframeRenderer

```tsx
interface WireframeRendererProps {
  layoutType: LayoutType
  components: SlideComponent[]
  title: string
}

export function WireframeRenderer({ layoutType, components, title }: WireframeRendererProps) {
  // Get components by region
  const getComponentsForRegion = (region: string) =>
    components.filter(c => c.position?.region === region)

  switch (layoutType) {
    case 'title-only':
      return <TitleOnlyLayout title={title} />

    case 'full':
      return <FullLayout components={components} />

    case 'split-horizontal':
      return (
        <SplitHorizontalLayout
          left={getComponentsForRegion('left')}
          right={getComponentsForRegion('right')}
        />
      )

    case 'quadrant':
      return (
        <QuadrantLayout
          topLeft={getComponentsForRegion('top-left')}
          topRight={getComponentsForRegion('top-right')}
          bottomLeft={getComponentsForRegion('bottom-left')}
          bottomRight={getComponentsForRegion('bottom-right')}
        />
      )

    case 'hero-with-details':
      return (
        <HeroWithDetailsLayout
          center={getComponentsForRegion('center')}
          topLeft={getComponentsForRegion('top-left')}
          topRight={getComponentsForRegion('top-right')}
          bottomLeft={getComponentsForRegion('bottom-left')}
          bottomRight={getComponentsForRegion('bottom-right')}
        />
      )

    // ... other layouts

    default:
      return <TitleContentLayout title={title} components={components} />
  }
}
```

## Layout Example: SplitHorizontalLayout

```tsx
interface SplitHorizontalLayoutProps {
  left: SlideComponent[]
  right: SlideComponent[]
}

export function SplitHorizontalLayout({ left, right }: SplitHorizontalLayoutProps) {
  return (
    <div className="w-full h-full flex gap-2">
      <div className="flex-1 border-2 border-dashed border-gray-300 rounded p-2 flex flex-col gap-2">
        {left.length > 0 ? (
          left.map(c => <ComponentRenderer key={c.id} component={c} />)
        ) : (
          <RegionPlaceholder label="Left Region" />
        )}
      </div>
      <div className="flex-1 border-2 border-dashed border-gray-300 rounded p-2 flex flex-col gap-2">
        {right.length > 0 ? (
          right.map(c => <ComponentRenderer key={c.id} component={c} />)
        ) : (
          <RegionPlaceholder label="Right Region" />
        )}
      </div>
    </div>
  )
}
```

## Component Renderer

```tsx
export function ComponentRenderer({ component }: { component: SlideComponent }) {
  switch (component.type) {
    case 'title':
      return <TitleComponent content={component.content as string} style={component.style} />

    case 'text':
      return <TextComponent content={component.content as string} style={component.style} />

    case 'bullet_list':
      return <BulletListComponent items={component.content as string[]} style={component.style} />

    case 'metric':
      return <MetricComponent content={component.content} style={component.style} />

    case 'table':
      return <TableComponent content={component.content} style={component.style} />

    case 'callout':
      return <CalloutComponent content={component.content as string} icon={component.icon} style={component.style} />

    // Charts get placeholders
    case 'bar_chart':
    case 'line_chart':
    case 'pie_chart':
    case 'waterfall_chart':
      return <ChartPlaceholder type={component.type} style={component.style} />

    // Timeline
    case 'timeline':
    case 'milestone_timeline':
      return <TimelineComponent content={component.content} style={component.style} />

    // Fallback
    default:
      return <GenericPlaceholder type={component.type} />
  }
}
```

## Wireframe Styling

```css
/* Wireframe aesthetic */
.wireframe-region {
  @apply border-2 border-dashed border-gray-300 rounded bg-gray-50;
}

.wireframe-component {
  @apply border border-gray-200 rounded bg-white p-2;
}

.wireframe-label {
  @apply text-xs text-gray-400 uppercase tracking-wide;
}

.wireframe-placeholder {
  @apply flex items-center justify-center text-gray-400 bg-gray-100 rounded;
}
```

## Acceptance Criteria

1. WireframeRenderer correctly routes to layout components
2. All layout types render with correct region placement
3. Component renderers display content appropriately
4. Chart types show placeholders with type labels
5. Wireframe styling is clean and professional
6. Integration with PreviewPanel works
7. Fallback handling for unknown layouts/components
8. `npm run type-check` passes with no errors

## Ralph Command

```bash
/ralph-loop "Implement Story 9 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-09-wireframe.md.

Read the story file for component architecture and specifications.

Create wireframe rendering components in manda-app/components/cim-builder/PreviewPanel/.

You may create new files for layouts and components as needed.

After changes, run 'cd manda-app && npm run type-check'.

If type-check fails, fix the errors before proceeding.

Output <promise>WIREFRAME_COMPLETE</promise> when all tasks are done and type-check passes." --max-iterations 25 --completion-promise "WIREFRAME_COMPLETE"
```
