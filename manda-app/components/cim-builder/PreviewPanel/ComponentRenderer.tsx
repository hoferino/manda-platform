'use client'

/**
 * ComponentRenderer - Type-specific rendering for slide components
 *
 * Dispatches to type-specific renderers based on component type.
 * Features:
 * - Stable ID generation for click-to-reference (E9.9)
 * - Wireframe styling with muted colors and dashed borders
 * - Click handler support for component selection
 * - Visual representation of charts, images, and tables
 *
 * Story: E9.8 - Wireframe Preview Renderer
 * AC: #1 (Component Rendering), #2 (Stable Component IDs), #3 (Wireframe Styling)
 */

import * as React from 'react'
import { memo } from 'react'
import { cn } from '@/lib/utils'
import { Image } from 'lucide-react'
import type { SlideComponent, ComponentType, ChartType } from '@/lib/types/cim'

// ============================================================================
// Types
// ============================================================================

export interface ComponentRendererProps {
  component: SlideComponent
  slideId: string
  index: number
  onClick?: (componentId: string, content: string) => void
}

interface TypeRendererProps {
  component: SlideComponent
  componentId: string
  onClick?: (componentId: string, content: string) => void
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generate stable component ID for click-to-reference
 * Format: s{slideNum}_{type}{index}
 * Examples: s1_title, s3_bullet1, s3_bullet2, s5_chart1
 */
export function generateComponentId(slideId: string, type: ComponentType, index: number): string {
  // Extract slide number from slideId (e.g., "slide-3" -> "3", or UUID -> hash to number)
  const slideNum = slideId.replace(/\D/g, '') || '0'
  return `s${slideNum}_${type}${index > 0 ? index : ''}`
}

// ============================================================================
// Clickable Wrapper
// ============================================================================

interface ClickableWrapperProps {
  componentId: string
  content: string
  onClick?: (componentId: string, content: string) => void
  children: React.ReactNode
  className?: string
}

const ClickableWrapper = memo(function ClickableWrapper({
  componentId,
  content,
  onClick,
  children,
  className,
}: ClickableWrapperProps) {
  const handleClick = React.useCallback(() => {
    onClick?.(componentId, content)
  }, [componentId, content, onClick])

  return (
    <div
      data-component-id={componentId}
      data-testid={`component-${componentId}`}
      onClick={onClick ? handleClick : undefined}
      className={cn(
        'min-h-[32px] transition-colors duration-150',
        onClick && [
          'cursor-pointer',
          'hover:bg-primary/5 hover:outline hover:outline-1 hover:outline-primary/30',
          'active:bg-primary/10',
          'rounded',
        ],
        className
      )}
    >
      {children}
    </div>
  )
})

// ============================================================================
// Type-Specific Renderers
// ============================================================================

/**
 * TitleRenderer - Large bold text for slide titles
 */
const TitleRenderer = memo(function TitleRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  return (
    <ClickableWrapper componentId={componentId} content={component.content} onClick={onClick}>
      <h2 className="text-xl font-bold text-foreground leading-tight py-1">
        {component.content || 'Untitled'}
      </h2>
    </ClickableWrapper>
  )
})

/**
 * SubtitleRenderer - Medium semibold text, slightly muted
 */
const SubtitleRenderer = memo(function SubtitleRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  return (
    <ClickableWrapper componentId={componentId} content={component.content} onClick={onClick}>
      <h3 className="text-base font-semibold text-muted-foreground leading-snug py-1">
        {component.content || 'Subtitle'}
      </h3>
    </ClickableWrapper>
  )
})

/**
 * TextRenderer - Paragraph text with proper line height
 */
const TextRenderer = memo(function TextRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  return (
    <ClickableWrapper componentId={componentId} content={component.content} onClick={onClick}>
      <p className="text-sm text-foreground/90 leading-relaxed py-1">
        {component.content || 'Text content'}
      </p>
    </ClickableWrapper>
  )
})

/**
 * BulletRenderer - List item with bullet indicator
 */
const BulletRenderer = memo(function BulletRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  return (
    <ClickableWrapper componentId={componentId} content={component.content} onClick={onClick}>
      <div className="flex items-start gap-2 pl-2 py-1">
        <span className="text-primary mt-1.5 text-xs">•</span>
        <p className="text-sm text-foreground/90 leading-relaxed flex-1">
          {component.content || 'Bullet point'}
        </p>
      </div>
    </ClickableWrapper>
  )
})

/**
 * ChartRenderer - Visual wireframe representation based on chart type
 */
const ChartRenderer = memo(function ChartRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const chartType = (component.metadata?.chartType as ChartType) || 'bar'
  const dataDescription = (component.metadata?.dataDescription as string) || component.content

  return (
    <ClickableWrapper
      componentId={componentId}
      content={component.content}
      onClick={onClick}
      className="py-2"
    >
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4">
        <div className="h-24 flex items-center justify-center">
          <ChartWireframe type={chartType} />
        </div>
        {dataDescription && (
          <p className="text-xs text-muted-foreground text-center mt-2 italic">{dataDescription}</p>
        )}
      </div>
    </ClickableWrapper>
  )
})

/**
 * ChartWireframe - SVG wireframe for different chart types
 */
function ChartWireframe({ type }: { type: ChartType }) {
  switch (type) {
    case 'bar':
      return (
        <svg viewBox="0 0 100 60" className="w-full h-full max-w-[120px]" aria-label="Bar chart">
          <rect x="10" y="30" width="12" height="30" fill="currentColor" opacity="0.3" rx="1" />
          <rect x="28" y="15" width="12" height="45" fill="currentColor" opacity="0.4" rx="1" />
          <rect x="46" y="25" width="12" height="35" fill="currentColor" opacity="0.35" rx="1" />
          <rect x="64" y="10" width="12" height="50" fill="currentColor" opacity="0.45" rx="1" />
          <rect x="82" y="20" width="12" height="40" fill="currentColor" opacity="0.38" rx="1" />
        </svg>
      )
    case 'line':
      return (
        <svg viewBox="0 0 100 60" className="w-full h-full max-w-[120px]" aria-label="Line chart">
          <polyline
            points="5,50 25,35 45,40 65,20 85,30 95,15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.5"
          />
          <circle cx="5" cy="50" r="3" fill="currentColor" opacity="0.4" />
          <circle cx="25" cy="35" r="3" fill="currentColor" opacity="0.4" />
          <circle cx="45" cy="40" r="3" fill="currentColor" opacity="0.4" />
          <circle cx="65" cy="20" r="3" fill="currentColor" opacity="0.4" />
          <circle cx="85" cy="30" r="3" fill="currentColor" opacity="0.4" />
          <circle cx="95" cy="15" r="3" fill="currentColor" opacity="0.4" />
        </svg>
      )
    case 'pie':
      return (
        <svg viewBox="0 0 60 60" className="w-full h-full max-w-[80px]" aria-label="Pie chart">
          <circle cx="30" cy="30" r="28" fill="currentColor" opacity="0.2" />
          <path d="M30,30 L30,2 A28,28 0 0,1 58,30 Z" fill="currentColor" opacity="0.4" />
          <path d="M30,30 L58,30 A28,28 0 0,1 30,58 Z" fill="currentColor" opacity="0.3" />
          <path d="M30,30 L30,58 A28,28 0 0,1 2,30 Z" fill="currentColor" opacity="0.35" />
        </svg>
      )
    case 'area':
      return (
        <svg viewBox="0 0 100 60" className="w-full h-full max-w-[120px]" aria-label="Area chart">
          <defs>
            <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.4" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0.1" />
            </linearGradient>
          </defs>
          <path
            d="M0,60 L0,45 Q25,35 50,40 Q75,45 100,25 L100,60 Z"
            fill="url(#areaGradient)"
          />
          <path
            d="M0,45 Q25,35 50,40 Q75,45 100,25"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            opacity="0.5"
          />
        </svg>
      )
    case 'table':
      // For table type in chart metadata, show a small table icon
      return (
        <svg viewBox="0 0 60 50" className="w-full h-full max-w-[80px]" aria-label="Table">
          <rect x="2" y="2" width="56" height="46" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3" rx="2" />
          <line x1="2" y1="14" x2="58" y2="14" stroke="currentColor" strokeWidth="1" opacity="0.3" />
          <line x1="20" y1="2" x2="20" y2="48" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <line x1="40" y1="2" x2="40" y2="48" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <line x1="2" y1="26" x2="58" y2="26" stroke="currentColor" strokeWidth="1" opacity="0.2" />
          <line x1="2" y1="38" x2="58" y2="38" stroke="currentColor" strokeWidth="1" opacity="0.2" />
        </svg>
      )
    default:
      return (
        <div className="text-muted-foreground text-xs">[Chart]</div>
      )
  }
}

/**
 * ImageRenderer - Placeholder box with image icon
 */
const ImageRenderer = memo(function ImageRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const description = component.content || 'Image placeholder'

  return (
    <ClickableWrapper
      componentId={componentId}
      content={component.content}
      onClick={onClick}
      className="py-2"
    >
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4">
        <div className="h-28 flex flex-col items-center justify-center gap-2">
          <Image className="h-8 w-8 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground text-center italic max-w-[200px] line-clamp-2">
            {description}
          </p>
        </div>
      </div>
    </ClickableWrapper>
  )
})

/**
 * TableRenderer - Wireframe grid with rows/columns from metadata
 */
const TableRenderer = memo(function TableRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const rows = Math.min((component.metadata?.rows as number) || 3, 6)
  const columns = Math.min((component.metadata?.columns as number) || 3, 5)
  const description = component.content || 'Data table'

  return (
    <ClickableWrapper
      componentId={componentId}
      content={component.content}
      onClick={onClick}
      className="py-2"
    >
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-3">
        {/* Table wireframe grid */}
        <div className="overflow-hidden rounded border border-muted-foreground/20">
          {/* Header row */}
          <div
            className="grid bg-muted/50"
            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
          >
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div
                key={`header-${colIdx}`}
                className="h-6 border-r border-b border-muted-foreground/20 last:border-r-0"
              />
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: rows - 1 }).map((_, rowIdx) => (
            <div
              key={`row-${rowIdx}`}
              className="grid"
              style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
            >
              {Array.from({ length: columns }).map((_, colIdx) => (
                <div
                  key={`cell-${rowIdx}-${colIdx}`}
                  className="h-5 border-r border-b border-muted-foreground/20 last:border-r-0 last:border-b-0"
                />
              ))}
            </div>
          ))}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground text-center mt-2 italic">{description}</p>
        )}
      </div>
    </ClickableWrapper>
  )
})

// ============================================================================
// Main ComponentRenderer
// ============================================================================

/**
 * ComponentRenderer - Dispatches to type-specific renderers
 */
export const ComponentRenderer = memo(function ComponentRenderer({
  component,
  slideId,
  index,
  onClick,
}: ComponentRendererProps) {
  const componentId = generateComponentId(slideId, component.type, index)

  const rendererProps: TypeRendererProps = {
    component,
    componentId,
    onClick,
  }

  switch (component.type) {
    case 'title':
      return <TitleRenderer {...rendererProps} />
    case 'subtitle':
      return <SubtitleRenderer {...rendererProps} />
    case 'text':
      return <TextRenderer {...rendererProps} />
    case 'bullet':
      return <BulletRenderer {...rendererProps} />
    case 'chart':
      return <ChartRenderer {...rendererProps} />
    case 'image':
      return <ImageRenderer {...rendererProps} />
    case 'table':
      return <TableRenderer {...rendererProps} />
    default:
      // Fallback for unknown types
      return <TextRenderer {...rendererProps} />
  }
})

export default ComponentRenderer
