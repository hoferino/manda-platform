'use client'

/**
 * Wireframe Renderer
 *
 * Routes slides to appropriate layout components based on layoutType.
 * Renders components in their designated regions.
 *
 * Story 9: Preview Panel - Wireframe Rendering
 */

import * as React from 'react'
import { memo, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  FullLayout,
  TitleOnlyLayout,
  TitleContentLayout,
  SplitHorizontalLayout,
  SplitHorizontalWeightedLayout,
  SplitVerticalLayout,
  QuadrantLayout,
  ThirdsHorizontalLayout,
  ThirdsVerticalLayout,
  SidebarLeftLayout,
  SidebarRightLayout,
  HeroWithDetailsLayout,
  SixGridLayout,
  ComparisonLayout,
} from './layouts'
import { WireframeComponentRenderer } from './WireframeComponentRenderer'
import type { LayoutType, SlideComponent, ComponentPosition } from '@/lib/agent/cim-mvp'

// ============================================================================
// Types
// ============================================================================

export interface WireframeRendererProps {
  layoutType?: LayoutType
  components: SlideComponent[]
  title: string
  slideId: string
  onComponentClick?: (componentId: string, content: string) => void
  className?: string
}

// Region type from ComponentPosition
type Region = ComponentPosition['region']

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get components for a specific region
 */
function getComponentsForRegion(components: SlideComponent[], region: Region): SlideComponent[] {
  return components.filter((c) => c.position?.region === region)
}

/**
 * Render components for a region
 */
function renderComponents(
  components: SlideComponent[],
  slideId: string,
  onComponentClick?: (componentId: string, content: string) => void
): React.ReactNode {
  if (components.length === 0) return null

  return (
    <>
      {components.map((component, index) => (
        <WireframeComponentRenderer
          key={component.id}
          component={component}
          slideId={slideId}
          index={index}
          onClick={onComponentClick}
        />
      ))}
    </>
  )
}

// ============================================================================
// Wireframe Renderer Component
// ============================================================================

export const WireframeRenderer = memo(function WireframeRenderer({
  layoutType = 'title-content',
  components,
  title,
  slideId,
  onComponentClick,
  className,
}: WireframeRendererProps) {
  // Memoize region groupings
  const regionComponents = useMemo(() => {
    return {
      full: getComponentsForRegion(components, 'full'),
      left: getComponentsForRegion(components, 'left'),
      right: getComponentsForRegion(components, 'right'),
      top: getComponentsForRegion(components, 'top'),
      bottom: getComponentsForRegion(components, 'bottom'),
      center: getComponentsForRegion(components, 'center'),
      topLeft: getComponentsForRegion(components, 'top-left'),
      topRight: getComponentsForRegion(components, 'top-right'),
      bottomLeft: getComponentsForRegion(components, 'bottom-left'),
      bottomRight: getComponentsForRegion(components, 'bottom-right'),
    }
  }, [components])

  // Components without a position go to default region based on layout
  // Filter out title/subtitle components that duplicate the slide title (shown in layout header)
  const unpositionedComponents = useMemo(() => {
    return components.filter((c) => {
      if (c.position?.region) return false
      // Check if this is a duplicate title
      if (c.type === 'title' || c.type === 'subtitle') {
        const content = typeof c.content === 'string' ? c.content : ''
        if (content === title || content.trim() === title.trim()) return false
      }
      return true
    })
  }, [components, title])

  // All body components (excluding duplicate title/subtitle)
  const bodyComponents = useMemo(() => {
    return components.filter((c) => {
      if (c.type === 'title' || c.type === 'subtitle') {
        const content = typeof c.content === 'string' ? c.content : ''
        if (content === title || content.trim() === title.trim()) return false
      }
      return true
    })
  }, [components, title])

  // Render helper
  const render = (comps: SlideComponent[]) => renderComponents(comps, slideId, onComponentClick)

  // Route to appropriate layout
  switch (layoutType) {
    case 'title-only':
      return (
        <div className={cn('w-full h-full', className)}>
          <TitleOnlyLayout title={title} />
        </div>
      )

    case 'full':
      return (
        <div className={cn('w-full h-full', className)}>
          <FullLayout>
            {render([...regionComponents.full, ...unpositionedComponents])}
          </FullLayout>
        </div>
      )

    case 'split-horizontal':
      return (
        <div className={cn('w-full h-full flex flex-col gap-2', className)}>
          {/* Title header */}
          <div className="flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
          </div>
          {/* Split content */}
          <div className="flex-1 min-h-0">
            <SplitHorizontalLayout
              left={render(regionComponents.left.length > 0 ? regionComponents.left : unpositionedComponents.slice(0, Math.ceil(unpositionedComponents.length / 2)))}
              right={render(regionComponents.right.length > 0 ? regionComponents.right : unpositionedComponents.slice(Math.ceil(unpositionedComponents.length / 2)))}
            />
          </div>
        </div>
      )

    case 'split-horizontal-weighted':
      return (
        <div className={cn('w-full h-full flex flex-col gap-2', className)}>
          {/* Title header */}
          <div className="flex-shrink-0">
            <h2 className="text-lg font-bold text-gray-900 leading-tight">{title}</h2>
          </div>
          {/* Weighted split content */}
          <div className="flex-1 min-h-0">
            <SplitHorizontalWeightedLayout
              left={render(regionComponents.left.length > 0 ? regionComponents.left : unpositionedComponents.slice(0, 1))}
              right={render(regionComponents.right.length > 0 ? regionComponents.right : unpositionedComponents.slice(1).filter(c => {
                // Exclude footer-like text from right panel
                const content = typeof c.content === 'string' ? c.content.toLowerCase() : ''
                return !content.startsWith('sources:') && !content.startsWith('source:')
              }))}
              leftWeight={1}
            />
          </div>
          {/* Footer for sources/citations */}
          {regionComponents.bottom.length > 0 && (
            <div className="flex-shrink-0 pt-2 border-t border-gray-200 text-xs text-muted-foreground">
              {render(regionComponents.bottom)}
            </div>
          )}
        </div>
      )

    case 'split-vertical':
      return (
        <div className={cn('w-full h-full', className)}>
          <SplitVerticalLayout
            top={render(regionComponents.top.length > 0 ? regionComponents.top : unpositionedComponents.slice(0, Math.ceil(unpositionedComponents.length / 2)))}
            bottom={render(regionComponents.bottom.length > 0 ? regionComponents.bottom : unpositionedComponents.slice(Math.ceil(unpositionedComponents.length / 2)))}
          />
        </div>
      )

    case 'quadrant':
      return (
        <div className={cn('w-full h-full', className)}>
          <QuadrantLayout
            topLeft={render(regionComponents.topLeft)}
            topRight={render(regionComponents.topRight)}
            bottomLeft={render(regionComponents.bottomLeft)}
            bottomRight={render(regionComponents.bottomRight)}
          />
        </div>
      )

    case 'thirds-horizontal':
      return (
        <div className={cn('w-full h-full', className)}>
          <ThirdsHorizontalLayout
            left={render(regionComponents.left)}
            center={render(regionComponents.center.length > 0 ? regionComponents.center : unpositionedComponents)}
            right={render(regionComponents.right)}
          />
        </div>
      )

    case 'thirds-vertical':
      return (
        <div className={cn('w-full h-full', className)}>
          <ThirdsVerticalLayout
            top={render(regionComponents.top)}
            middle={render(regionComponents.center.length > 0 ? regionComponents.center : unpositionedComponents)}
            bottom={render(regionComponents.bottom)}
          />
        </div>
      )

    case 'sidebar-left':
      return (
        <div className={cn('w-full h-full', className)}>
          <SidebarLeftLayout
            sidebar={render(regionComponents.left)}
            main={render(regionComponents.right.length > 0 ? regionComponents.right : unpositionedComponents)}
          />
        </div>
      )

    case 'sidebar-right':
      return (
        <div className={cn('w-full h-full', className)}>
          <SidebarRightLayout
            main={render(regionComponents.left.length > 0 ? regionComponents.left : unpositionedComponents)}
            sidebar={render(regionComponents.right)}
          />
        </div>
      )

    case 'hero-with-details':
      return (
        <div className={cn('w-full h-full', className)}>
          <HeroWithDetailsLayout
            center={render(regionComponents.center.length > 0 ? regionComponents.center : unpositionedComponents)}
            topLeft={render(regionComponents.topLeft)}
            topRight={render(regionComponents.topRight)}
            bottomLeft={render(regionComponents.bottomLeft)}
            bottomRight={render(regionComponents.bottomRight)}
          />
        </div>
      )

    case 'six-grid':
      // Distribute unpositioned components across 6 cells
      const cells: React.ReactNode[] = []
      const allComps = [...regionComponents.topLeft, ...regionComponents.topRight, ...regionComponents.center, ...regionComponents.bottomLeft, ...regionComponents.bottomRight, ...unpositionedComponents]
      for (let i = 0; i < 6; i++) {
        const cellComps = allComps.slice(i, i + 1) // One component per cell
        cells.push(render(cellComps))
      }
      return (
        <div className={cn('w-full h-full', className)}>
          <SixGridLayout cells={cells} />
        </div>
      )

    case 'comparison':
      return (
        <div className={cn('w-full h-full', className)}>
          <ComparisonLayout
            left={render(regionComponents.left)}
            right={render(regionComponents.right)}
          />
        </div>
      )

    case 'pyramid':
    case 'hub-spoke':
      // Fallback to title-content for complex layouts not yet implemented
      return (
        <div className={cn('w-full h-full', className)}>
          <TitleContentLayout title={title}>
            {render(unpositionedComponents.length > 0 ? unpositionedComponents : components)}
          </TitleContentLayout>
        </div>
      )

    case 'title-content':
    default:
      // Default layout: title at top, all content below (excluding title/subtitle components)
      return (
        <div className={cn('w-full h-full', className)}>
          <TitleContentLayout title={title}>
            {render(unpositionedComponents.length > 0 ? unpositionedComponents : bodyComponents)}
          </TitleContentLayout>
        </div>
      )
  }
})

export default WireframeRenderer
