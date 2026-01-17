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
 * Story 4: Fixed to handle non-string content
 */
const TitleRenderer = memo(function TitleRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const content = getContentString(component.content)
  return (
    <ClickableWrapper componentId={componentId} content={content} onClick={onClick}>
      <h2 className="text-xl font-bold text-foreground leading-tight py-1">
        {content || 'Untitled'}
      </h2>
    </ClickableWrapper>
  )
})

/**
 * SubtitleRenderer - Medium semibold text, slightly muted
 * Story 4: Fixed to handle non-string content
 */
const SubtitleRenderer = memo(function SubtitleRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const content = getContentString(component.content)
  return (
    <ClickableWrapper componentId={componentId} content={content} onClick={onClick}>
      <h3 className="text-base font-semibold text-muted-foreground leading-snug py-1">
        {content || 'Subtitle'}
      </h3>
    </ClickableWrapper>
  )
})

/**
 * TextRenderer - Paragraph text with proper line height
 * Story 4: Fixed to handle non-string content (renders JSON prettily)
 */
const TextRenderer = memo(function TextRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const content = getContentString(component.content)
  return (
    <ClickableWrapper componentId={componentId} content={content} onClick={onClick}>
      <p className="text-sm text-foreground/90 leading-relaxed py-1">
        {content || 'Text content'}
      </p>
    </ClickableWrapper>
  )
})

/**
 * BulletRenderer - List item with bullet indicator
 * Story 4: Fixed to handle non-string content
 */
const BulletRenderer = memo(function BulletRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const content = getContentString(component.content)
  return (
    <ClickableWrapper componentId={componentId} content={content} onClick={onClick}>
      <div className="flex items-start gap-2 pl-2 py-1">
        <span className="text-primary mt-1.5 text-xs">•</span>
        <p className="text-sm text-foreground/90 leading-relaxed flex-1">
          {content || 'Bullet point'}
        </p>
      </div>
    </ClickableWrapper>
  )
})

/** Helper function - must be defined before use */
function getContentString(content: unknown): string {
  if (typeof content === 'string') return content
  if (content === null || content === undefined) return ''
  return JSON.stringify(content)
}

/**
 * ChartRenderer - Visual wireframe representation based on chart type
 * Story 4: Fixed to handle non-string content
 */
const ChartRenderer = memo(function ChartRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const chartType = (component.metadata?.chartType as ChartType) || 'bar'
  const contentStr = getContentString(component.content)
  const dataDescription = (component.metadata?.dataDescription as string) || contentStr

  return (
    <ClickableWrapper
      componentId={componentId}
      content={contentStr}
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
 * Story 4: Fixed to handle non-string content
 */
const ImageRenderer = memo(function ImageRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  const contentStr = getContentString(component.content)
  const description = contentStr || 'Image placeholder'

  return (
    <ClickableWrapper
      componentId={componentId}
      content={contentStr}
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
 * TableRenderer - Wireframe grid with rows/columns from metadata or data
 * Story 4: Enhanced to parse and display actual table data
 */
const TableRenderer = memo(function TableRenderer({
  component,
  componentId,
  onClick,
}: TypeRendererProps) {
  // Try to parse actual table data
  const tableData = parseTableData(component)
  const contentStr = getContentString(component.content)

  if (tableData && tableData.rows.length > 0) {
    return (
      <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick} className="py-2">
        <div className="border border-muted-foreground/20 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            {tableData.headers && tableData.headers.length > 0 && (
              <thead className="bg-muted/50">
                <tr>
                  {tableData.headers.map((header, idx) => (
                    <th key={idx} className="px-3 py-2 text-left font-medium text-foreground border-b border-muted-foreground/20">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {tableData.rows.map((row, rowIdx) => (
                <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                  {row.map((cell, cellIdx) => (
                    <td key={cellIdx} className="px-3 py-2 text-foreground/90 border-b border-muted-foreground/10">
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ClickableWrapper>
    )
  }

  // Fallback to wireframe
  const rows = Math.min((component.metadata?.rows as number) || 3, 6)
  const columns = Math.min((component.metadata?.columns as number) || 3, 5)

  return (
    <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick} className="py-2">
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-3">
        <div className="overflow-hidden rounded border border-muted-foreground/20">
          <div className="grid bg-muted/50" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIdx) => (
              <div key={`header-${colIdx}`} className="h-6 border-r border-b border-muted-foreground/20 last:border-r-0" />
            ))}
          </div>
          {Array.from({ length: rows - 1 }).map((_, rowIdx) => (
            <div key={`row-${rowIdx}`} className="grid" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
              {Array.from({ length: columns }).map((_, colIdx) => (
                <div key={`cell-${rowIdx}-${colIdx}`} className="h-5 border-r border-b border-muted-foreground/20 last:border-r-0 last:border-b-0" />
              ))}
            </div>
          ))}
        </div>
        {contentStr && <p className="text-xs text-muted-foreground text-center mt-2 italic">{contentStr}</p>}
      </div>
    </ClickableWrapper>
  )
})

// ============================================================================
// Story 4: Additional Component Renderers for CIM MVP
// These handle the expanded component types from the agent tools
// ============================================================================

/** Parse table data from component */
function parseTableData(component: SlideComponent): { headers?: string[]; rows: string[][] } | null {
  try {
    const data = component.metadata?.data || component.content
    if (!data) return null

    let parsed = data
    if (typeof parsed === 'string') {
      parsed = JSON.parse(parsed)
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      if (Array.isArray(parsed[0])) {
        return { headers: parsed[0].map(String), rows: parsed.slice(1).map((r: unknown[]) => r.map(String)) }
      }
      // Array of objects
      if (typeof parsed[0] === 'object' && parsed[0] !== null) {
        const keys = Object.keys(parsed[0])
        return {
          headers: keys,
          rows: parsed.map((obj: Record<string, unknown>) => keys.map(k => String(obj[k] ?? '')))
        }
      }
    }
  } catch { /* ignore */ }
  return null
}

/**
 * MetricRenderer - Styled metric badges with label/value
 * Handles: metric, metric_group, stat_highlight types
 */
const MetricRenderer = memo(function MetricRenderer({ component, componentId, onClick }: TypeRendererProps) {
  const metrics = parseMetricData(component)
  const contentStr = getContentString(component.content)

  if (metrics.length === 0) {
    return (
      <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick}>
        <div className="px-4 py-3 bg-primary/5 rounded-lg border border-primary/20">
          <span className="text-lg font-bold text-foreground">{contentStr || 'Metric'}</span>
        </div>
      </ClickableWrapper>
    )
  }

  return (
    <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick}>
      <div className="flex flex-wrap gap-3">
        {metrics.map((metric, idx) => (
          <div key={idx} className={cn('px-4 py-3 rounded-lg border', getMetricStyle(component.metadata?.emphasis as string))}>
            {metric.label && <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{metric.label}</p>}
            <p className={cn('font-bold text-foreground', component.metadata?.size === 'xl' ? 'text-3xl' : component.metadata?.size === 'lg' ? 'text-2xl' : 'text-xl')}>
              {metric.value}
            </p>
            {metric.subtext && <p className="text-xs text-muted-foreground mt-1">{metric.subtext}</p>}
          </div>
        ))}
      </div>
    </ClickableWrapper>
  )
})

function parseMetricData(component: SlideComponent): Array<{ label?: string; value: string; subtext?: string }> {
  const metrics: Array<{ label?: string; value: string; subtext?: string }> = []
  try {
    let data = component.content
    if (typeof data === 'string') {
      try { data = JSON.parse(data) } catch { return [{ value: data }] }
    }
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'object' && item !== null && 'value' in item) {
          metrics.push({ label: (item as Record<string, unknown>).label as string, value: String((item as Record<string, unknown>).value), subtext: ((item as Record<string, unknown>).subtext || (item as Record<string, unknown>).description) as string })
        } else if (typeof item === 'string') {
          metrics.push({ value: item })
        }
      }
    } else if (typeof data === 'object' && data !== null && 'value' in data) {
      metrics.push({ label: (data as Record<string, unknown>).label as string, value: String((data as Record<string, unknown>).value), subtext: ((data as Record<string, unknown>).subtext || (data as Record<string, unknown>).description) as string })
    }
  } catch { /* ignore */ }
  return metrics
}

function getMetricStyle(emphasis?: string): string {
  switch (emphasis) {
    case 'success': return 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
    case 'warning': return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
    case 'danger': return 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
    case 'accent': return 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
    case 'primary': return 'bg-primary/10 border-primary/30'
    default: return 'bg-muted/50 border-muted-foreground/20'
  }
}

/** BulletListRenderer - Multiple bullet points from array content */
const BulletListRenderer = memo(function BulletListRenderer({ component, componentId, onClick }: TypeRendererProps) {
  const items = parseListItems(component.content)
  return (
    <ClickableWrapper componentId={componentId} content={getContentString(component.content)} onClick={onClick}>
      <ul className="space-y-1.5 pl-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-primary mt-1.5 text-xs">•</span>
            <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </ClickableWrapper>
  )
})

/** NumberedListRenderer */
const NumberedListRenderer = memo(function NumberedListRenderer({ component, componentId, onClick }: TypeRendererProps) {
  const items = parseListItems(component.content)
  return (
    <ClickableWrapper componentId={componentId} content={getContentString(component.content)} onClick={onClick}>
      <ol className="space-y-1.5 pl-2">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2">
            <span className="text-muted-foreground font-medium text-sm min-w-[1.5rem]">{idx + 1}.</span>
            <span className="text-sm text-foreground/90 leading-relaxed">{item}</span>
          </li>
        ))}
      </ol>
    </ClickableWrapper>
  )
})

function parseListItems(content: unknown): string[] {
  if (Array.isArray(content)) return content.map(item => typeof item === 'string' ? item : JSON.stringify(item))
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) return parsed.map(item => typeof item === 'string' ? item : JSON.stringify(item))
    } catch {
      if (content.includes('\n')) return content.split('\n').filter(Boolean)
      return [content]
    }
  }
  return []
}

/** TimelineRenderer - Timeline/milestone visualization */
const TimelineRenderer = memo(function TimelineRenderer({ component, componentId, onClick }: TypeRendererProps) {
  const events = parseTimelineEvents(component)
  const contentStr = getContentString(component.content)

  if (events.length === 0) {
    return (
      <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick}>
        <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4">
          <div className="h-16 flex items-center justify-center">
            <div className="flex items-center gap-4">
              {[1, 2, 3, 4].map(i => (
                <React.Fragment key={i}>
                  <div className="w-4 h-4 rounded-full bg-primary/30 border-2 border-primary/50" />
                  {i < 4 && <div className="w-12 h-0.5 bg-muted-foreground/20" />}
                </React.Fragment>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center italic mt-2">{contentStr || 'Timeline'}</p>
        </div>
      </ClickableWrapper>
    )
  }

  return (
    <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick}>
      <div className="relative pl-6 border-l-2 border-primary/30 space-y-4 py-2">
        {events.map((event, idx) => (
          <div key={idx} className="relative">
            <div className="absolute -left-[1.65rem] w-3 h-3 rounded-full bg-primary border-2 border-background" />
            <div className="pl-2">
              {event.date && <p className="text-xs text-muted-foreground uppercase tracking-wide">{event.date}</p>}
              <p className="text-sm font-medium text-foreground">{event.title}</p>
              {event.description && <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>}
            </div>
          </div>
        ))}
      </div>
    </ClickableWrapper>
  )
})

function parseTimelineEvents(component: SlideComponent): Array<{ date?: string; title: string; description?: string }> {
  const events: Array<{ date?: string; title: string; description?: string }> = []
  try {
    let data = component.content
    if (typeof data === 'string') data = JSON.parse(data)
    if (Array.isArray(data)) {
      for (const item of data) {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>
          events.push({ date: obj.date as string, title: (obj.title || obj.event || obj.milestone || String(obj.value || '')) as string, description: (obj.description || obj.details) as string })
        } else if (typeof item === 'string') {
          events.push({ title: item })
        }
      }
    }
  } catch { /* ignore */ }
  return events
}

/** CalloutRenderer - Highlighted callout boxes */
const CalloutRenderer = memo(function CalloutRenderer({ component, componentId, onClick }: TypeRendererProps) {
  const contentStr = getContentString(component.content)
  const componentType = component.type as string
  const label = component.metadata?.label as string | undefined
  return (
    <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick}>
      <div className={cn('px-4 py-3 rounded-lg border-l-4', componentType === 'key_takeaway' ? 'bg-amber-50 border-amber-500 dark:bg-amber-900/20' : componentType === 'stat_highlight' ? 'bg-blue-50 border-blue-500 dark:bg-blue-900/20' : 'bg-muted border-primary')}>
        {label && <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">{label}</p>}
        <p className="text-sm text-foreground leading-relaxed">{contentStr}</p>
      </div>
    </ClickableWrapper>
  )
})

/** HeadingRenderer */
const HeadingRenderer = memo(function HeadingRenderer({ component, componentId, onClick }: TypeRendererProps) {
  return (
    <ClickableWrapper componentId={componentId} content={getContentString(component.content)} onClick={onClick}>
      <h3 className="text-lg font-semibold text-foreground py-1">{getContentString(component.content) || 'Heading'}</h3>
    </ClickableWrapper>
  )
})

/** QuoteRenderer */
const QuoteRenderer = memo(function QuoteRenderer({ component, componentId, onClick }: TypeRendererProps) {
  return (
    <ClickableWrapper componentId={componentId} content={getContentString(component.content)} onClick={onClick}>
      <blockquote className="border-l-4 border-primary/50 pl-4 py-2 italic text-foreground/80">
        &ldquo;{getContentString(component.content) || 'Quote'}&rdquo;
      </blockquote>
    </ClickableWrapper>
  )
})

/** GenericChartRenderer - For bar_chart, line_chart, pie_chart, etc. */
const GenericChartRenderer = memo(function GenericChartRenderer({ component, componentId, onClick }: TypeRendererProps) {
  const chartTypeMap: Record<string, ChartType> = {
    bar_chart: 'bar', horizontal_bar_chart: 'bar', stacked_bar_chart: 'bar',
    line_chart: 'line', area_chart: 'area', pie_chart: 'pie',
    waterfall_chart: 'bar', combo_chart: 'bar', scatter_plot: 'line',
  }
  const chartType = chartTypeMap[component.type] || 'bar'
  const contentStr = getContentString(component.content)

  return (
    <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick} className="py-2">
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4">
        <div className="h-24 flex items-center justify-center">
          <ChartWireframe type={chartType} />
        </div>
        {contentStr && <p className="text-xs text-muted-foreground text-center mt-2 italic">{contentStr}</p>}
      </div>
    </ClickableWrapper>
  )
})

/** ProcessRenderer - For flowchart, funnel, pipeline, process_steps, cycle */
const ProcessRenderer = memo(function ProcessRenderer({ component, componentId, onClick }: TypeRendererProps) {
  const contentStr = getContentString(component.content)
  const steps = parseListItems(component.content)

  if (steps.length > 0 && steps.length <= 6) {
    return (
      <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick}>
        <div className="flex items-center justify-center gap-2 py-3">
          {steps.map((step, idx) => (
            <React.Fragment key={idx}>
              <div className="px-3 py-2 bg-primary/10 border border-primary/30 rounded text-xs font-medium text-foreground text-center min-w-[60px]">
                {step.length > 20 ? step.substring(0, 20) + '...' : step}
              </div>
              {idx < steps.length - 1 && <span className="text-muted-foreground">→</span>}
            </React.Fragment>
          ))}
        </div>
      </ClickableWrapper>
    )
  }

  return (
    <ClickableWrapper componentId={componentId} content={contentStr} onClick={onClick}>
      <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4">
        <div className="flex items-center justify-center gap-3">
          {[1, 2, 3, 4].map(i => (
            <React.Fragment key={i}>
              <div className="w-10 h-10 rounded bg-primary/20 border border-primary/30" />
              {i < 4 && <span className="text-muted-foreground">→</span>}
            </React.Fragment>
          ))}
        </div>
        {contentStr && <p className="text-xs text-muted-foreground text-center mt-2 italic">{contentStr}</p>}
      </div>
    </ClickableWrapper>
  )
})

// ============================================================================
// Main ComponentRenderer
// ============================================================================

/**
 * ComponentRenderer - Dispatches to type-specific renderers
 * Story 4: Extended to support all CIM MVP component types
 */
export const ComponentRenderer = memo(function ComponentRenderer({
  component,
  slideId,
  index,
  onClick,
}: ComponentRendererProps) {
  // Cast type to string for the switch since tools use extended types
  const componentType = component.type as string
  const componentId = generateComponentId(slideId, component.type, index)

  const rendererProps: TypeRendererProps = {
    component,
    componentId,
    onClick,
  }

  switch (componentType) {
    // Text types
    case 'title':
      return <TitleRenderer {...rendererProps} />
    case 'subtitle':
      return <SubtitleRenderer {...rendererProps} />
    case 'heading':
      return <HeadingRenderer {...rendererProps} />
    case 'text':
      return <TextRenderer {...rendererProps} />
    case 'bullet':
      return <BulletRenderer {...rendererProps} />
    case 'bullet_list':
      return <BulletListRenderer {...rendererProps} />
    case 'numbered_list':
      return <NumberedListRenderer {...rendererProps} />
    case 'quote':
      return <QuoteRenderer {...rendererProps} />

    // Chart types
    case 'chart':
      return <ChartRenderer {...rendererProps} />
    case 'bar_chart':
    case 'horizontal_bar_chart':
    case 'stacked_bar_chart':
    case 'line_chart':
    case 'area_chart':
    case 'pie_chart':
    case 'waterfall_chart':
    case 'combo_chart':
    case 'scatter_plot':
    case 'sparkline':
      return <GenericChartRenderer {...rendererProps} />

    // Data display types
    case 'metric':
    case 'metric_group':
    case 'gauge':
    case 'progress_bar':
    case 'stat_highlight':
      return <MetricRenderer {...rendererProps} />
    case 'table':
    case 'comparison_table':
    case 'financial_table':
      return <TableRenderer {...rendererProps} />

    // Process/timeline types
    case 'timeline':
    case 'milestone_timeline':
    case 'gantt_chart':
      return <TimelineRenderer {...rendererProps} />
    case 'flowchart':
    case 'funnel':
    case 'pipeline':
    case 'process_steps':
    case 'cycle':
      return <ProcessRenderer {...rendererProps} />

    // Image types
    case 'image':
    case 'image_placeholder':
    case 'logo_grid':
    case 'icon_grid':
    case 'screenshot':
    case 'diagram':
      return <ImageRenderer {...rendererProps} />

    // Callout types
    case 'callout':
    case 'callout_group':
    case 'key_takeaway':
    case 'annotation':
      return <CalloutRenderer {...rendererProps} />

    // Organizational types (render as table/process for now)
    case 'org_chart':
    case 'team_grid':
    case 'hierarchy':
      return <ProcessRenderer {...rendererProps} />

    // Comparison types (render as table for now)
    case 'swot':
    case 'matrix':
    case 'venn':
    case 'versus':
    case 'pros_cons':
    case 'feature_comparison':
      return <TableRenderer {...rendererProps} />

    // Geographic types (render as image for now)
    case 'map':
    case 'location_list':
      return <ImageRenderer {...rendererProps} />

    // Financial types (render as metric/table)
    case 'revenue_breakdown':
    case 'unit_economics':
    case 'growth_trajectory':
    case 'valuation_summary':
      return <MetricRenderer {...rendererProps} />

    default:
      // Fallback: try to render intelligently based on content
      if (Array.isArray(component.content)) {
        // Array content → try bullet list
        return <BulletListRenderer {...rendererProps} />
      }
      if (typeof component.content === 'string') {
        let isMetricJson = false
        try {
          const parsed = JSON.parse(component.content)
          isMetricJson = Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === 'object' && 'value' in parsed[0]
        } catch { /* not JSON */ }
        if (isMetricJson) {
          return <MetricRenderer {...rendererProps} />
        }
      }
      // Ultimate fallback: text renderer
      return <TextRenderer {...rendererProps} />
  }
})

export default ComponentRenderer
