'use client'

/**
 * Wireframe Component Renderer
 *
 * Renders slide components with wireframe styling.
 * Supports all component types from the CIM MVP workflow.
 *
 * Story 9: Preview Panel - Wireframe Rendering
 */

import * as React from 'react'
import { memo, useCallback } from 'react'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  LineChart,
  PieChart,
  TrendingUp,
  Table2,
  Image,
  Quote,
  List,
  ListOrdered,
  Clock,
  GitBranch,
  ArrowRight,
  AlertCircle,
  Lightbulb,
  MapPin,
  Users,
  Layers,
  Target,
  Gauge,
} from 'lucide-react'
import type { SlideComponent, ComponentType, ComponentStyle } from '@/lib/agent/cim-mvp'

// ============================================================================
// Types
// ============================================================================

export interface WireframeComponentRendererProps {
  component: SlideComponent
  slideId: string
  index: number
  onClick?: (componentId: string, content: string) => void
}

// ============================================================================
// ID Generation
// ============================================================================

function generateComponentId(slideId: string, type: ComponentType, index: number): string {
  const slideNum = slideId.replace(/\D/g, '') || '0'
  return `s${slideNum}_${type}${index > 0 ? index : ''}`
}

// ============================================================================
// Style Helpers
// ============================================================================

const emphasisColors: Record<NonNullable<ComponentStyle['emphasis']>, string> = {
  primary: 'border-gray-300 bg-white',
  secondary: 'border-gray-300 bg-white',
  muted: 'border-gray-200 bg-gray-50',
  accent: 'border-gray-300 bg-white',
  success: 'border-gray-300 bg-white',
  warning: 'border-gray-300 bg-white',
  danger: 'border-gray-300 bg-white',
}

const sizeClasses: Record<NonNullable<ComponentStyle['size']>, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
}

function getStyleClasses(style?: ComponentStyle): string {
  const classes: string[] = []
  if (style?.emphasis) classes.push(emphasisColors[style.emphasis])
  if (style?.size) classes.push(sizeClasses[style.size])
  if (style?.alignment === 'center') classes.push('text-center')
  if (style?.alignment === 'right') classes.push('text-right')
  return classes.join(' ')
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
  const handleClick = useCallback(() => {
    onClick?.(componentId, content)
  }, [componentId, content, onClick])

  return (
    <div
      data-component-id={componentId}
      onClick={onClick ? handleClick : undefined}
      className={cn(
        'transition-colors duration-150',
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
// Text Components
// ============================================================================

function TitleComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <h2 className={cn('text-xl font-bold text-gray-900 py-1', getStyleClasses(style))}>
      {content || 'Untitled'}
    </h2>
  )
}

function SubtitleComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <h3 className={cn('text-base font-semibold text-gray-500 py-1', getStyleClasses(style))}>
      {content || 'Subtitle'}
    </h3>
  )
}

function HeadingComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <h4 className={cn('text-sm font-semibold text-gray-900 py-1', getStyleClasses(style))}>
      {content || 'Heading'}
    </h4>
  )
}

function TextComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <p className={cn('text-sm text-gray-800 leading-relaxed py-1', getStyleClasses(style))}>
      {content || 'Text content'}
    </p>
  )
}

function BulletListComponent({ content, style }: { content: string | string[]; style?: ComponentStyle }) {
  const items = Array.isArray(content) ? content : [content]
  return (
    <ul className={cn('space-y-1 py-1', getStyleClasses(style))}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 pl-2 text-sm">
          <span className="text-gray-600 mt-1.5 text-xs">•</span>
          <span className="text-gray-800">{item}</span>
        </li>
      ))}
    </ul>
  )
}

function NumberedListComponent({ content, style }: { content: string | string[]; style?: ComponentStyle }) {
  const items = Array.isArray(content) ? content : [content]
  return (
    <ol className={cn('space-y-1 py-1', getStyleClasses(style))}>
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2 pl-2 text-sm">
          <span className="text-gray-600 font-medium">{i + 1}.</span>
          <span className="text-gray-800">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function QuoteComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <blockquote className={cn('border-l-4 border-gray-300 pl-4 py-2 italic text-sm text-gray-500', getStyleClasses(style))}>
      <Quote className="h-4 w-4 inline-block mr-2 opacity-50" />
      {content || 'Quote'}
    </blockquote>
  )
}

// ============================================================================
// Data Visualization Components
// ============================================================================

function ChartPlaceholder({ type, label, style }: { type: string; label?: string; style?: ComponentStyle }) {
  const iconMap: Record<string, React.ReactNode> = {
    bar_chart: <BarChart3 className="h-8 w-8" />,
    horizontal_bar_chart: <BarChart3 className="h-8 w-8 rotate-90" />,
    stacked_bar_chart: <BarChart3 className="h-8 w-8" />,
    line_chart: <LineChart className="h-8 w-8" />,
    area_chart: <TrendingUp className="h-8 w-8" />,
    pie_chart: <PieChart className="h-8 w-8" />,
    waterfall_chart: <BarChart3 className="h-8 w-8" />,
    combo_chart: <LineChart className="h-8 w-8" />,
    scatter_plot: <Target className="h-8 w-8" />,
  }

  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-20 flex flex-col items-center justify-center gap-2 text-gray-400">
        {iconMap[type] || <BarChart3 className="h-8 w-8" />}
        <span className="text-xs uppercase tracking-wide">{label || type.replace(/_/g, ' ')}</span>
      </div>
    </div>
  )
}

function MetricComponent({ content, label, style }: { content: string | Record<string, unknown>; label?: string; style?: ComponentStyle }) {
  const value = typeof content === 'string' ? content : (content as Record<string, unknown>)?.value?.toString() || '--'
  const metricLabel = label || (typeof content === 'object' ? (content as Record<string, unknown>)?.label?.toString() : undefined)

  return (
    <div className={cn('text-center py-3', getStyleClasses(style))}>
      <div className="text-3xl font-bold text-gray-900">{value}</div>
      {metricLabel && <div className="text-sm text-gray-500 mt-1">{metricLabel}</div>}
    </div>
  )
}

/**
 * Metric Group Component - renders a list of label/value pairs
 * Handles content as: array of {label, content/value} objects, or JSON string
 */
function MetricGroupComponent({ content, style }: { content: unknown; style?: ComponentStyle }) {
  // Parse content - it might be a JSON string, array, or already parsed
  let metrics: Array<{ label: string; content?: string; value?: string }> = []

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        metrics = parsed
      }
    } catch {
      // Not JSON, treat as single metric
      metrics = [{ label: 'Value', content: content }]
    }
  } else if (Array.isArray(content)) {
    metrics = content as Array<{ label: string; content?: string; value?: string }>
  }

  if (metrics.length === 0) {
    return (
      <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
        <div className="h-16 flex items-center justify-center text-gray-400 text-xs">
          No metrics data
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2 py-2', getStyleClasses(style))}>
      {metrics.map((metric, i) => (
        <div key={i} className="flex justify-between items-baseline gap-4 px-2 py-1.5 bg-gray-50 rounded">
          <span className="text-sm text-gray-500">{metric.label}</span>
          <span className="text-sm font-semibold text-gray-900">{metric.content || metric.value || '--'}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Data Table Component - renders actual table data instead of placeholder
 * Handles content as: array of {label, content/value} objects, or JSON string
 */
function DataTableComponent({ content, style }: { content: unknown; style?: ComponentStyle }) {
  // Parse content - it might be a JSON string, array, or already parsed
  let rows: Array<Record<string, unknown>> = []

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        rows = parsed
      }
    } catch {
      // Not JSON, show placeholder
    }
  } else if (Array.isArray(content)) {
    rows = content as Array<Record<string, unknown>>
  }

  if (rows.length === 0) {
    return (
      <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
        <div className="h-16 flex flex-col items-center justify-center gap-2 text-gray-400">
          <Table2 className="h-6 w-6" />
          <span className="text-xs">Data Table</span>
        </div>
      </div>
    )
  }

  // Render as key-value pairs (common format for CIM data)
  return (
    <div className={cn('border border-gray-200 rounded-lg overflow-hidden', getStyleClasses(style))}>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => {
            // Handle {label, content} format
            const label = row.label?.toString() || row.key?.toString() || `Row ${i + 1}`
            const value = row.content?.toString() || row.value?.toString() || '--'
            return (
              <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                <td className="px-3 py-2 text-gray-500 font-medium border-r border-gray-200 w-1/3">{label}</td>
                <td className="px-3 py-2 text-gray-900">{value}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function TablePlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-gray-400">
        <Table2 className="h-6 w-6" />
        <span className="text-xs">{content || 'Data Table'}</span>
      </div>
    </div>
  )
}

function GaugePlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-gray-400">
        <Gauge className="h-6 w-6" />
        <span className="text-xs">{content || 'Gauge'}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Process & Flow Components
// ============================================================================

/**
 * Timeline Component - renders horizontal timeline with milestones
 * Handles content as:
 * - string: single item
 * - string[]: array of labels
 * - {year, milestone, description}[]: milestone objects (from CIM agent)
 * - JSON string of the above
 */
function TimelineComponent({ content, style }: { content: unknown; style?: ComponentStyle }) {
  // Parse content - might be JSON string, array of strings, or array of milestone objects
  interface MilestoneItem {
    year?: string | number
    milestone?: string
    description?: string
  }

  let items: Array<string | MilestoneItem> = []

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        items = parsed
      } else {
        items = [content]
      }
    } catch {
      // Not JSON, treat as single string item
      items = [content]
    }
  } else if (Array.isArray(content)) {
    items = content
  }

  if (items.length === 0) {
    return (
      <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
        <div className="h-12 flex items-center justify-center text-gray-400 text-xs">
          <Clock className="h-4 w-4 mr-2" />
          No timeline data
        </div>
      </div>
    )
  }

  // Check if items are milestone objects (have year/milestone properties)
  const isMilestoneFormat = items.length > 0 && typeof items[0] === 'object' && items[0] !== null && ('year' in items[0] || 'milestone' in items[0])

  if (isMilestoneFormat) {
    // Render vertical milestone timeline for objects
    const milestones = items as MilestoneItem[]
    return (
      <div className={cn('space-y-3 py-2', getStyleClasses(style))}>
        {milestones.map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            {/* Year badge */}
            <div className="flex-shrink-0 w-14 px-2 py-1 bg-gray-200 rounded text-xs font-semibold text-center">
              {item.year || '—'}
            </div>
            {/* Milestone content */}
            <div className="flex-1 min-w-0">
              {item.milestone && (
                <div className="text-sm font-medium text-gray-900">{item.milestone}</div>
              )}
              {item.description && (
                <div className="text-xs text-gray-500 mt-0.5">{item.description}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Render horizontal timeline for simple strings
  const stringItems = items as string[]
  return (
    <div className={cn('flex items-center gap-2 py-2 overflow-x-auto', getStyleClasses(style))}>
      {stringItems.map((item, i) => (
        <React.Fragment key={i}>
          <div className="flex-shrink-0 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium">
            {String(item)}
          </div>
          {i < stringItems.length - 1 && (
            <ArrowRight className="h-4 w-4 text-gray-500 flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

/**
 * Process Steps Component - renders numbered steps
 * Handles content as:
 * - string: single step
 * - string[]: array of step labels
 * - {title, description}[] or {step, description}[]: step objects
 * - JSON string of the above
 */
function ProcessStepsComponent({ content, style }: { content: unknown; style?: ComponentStyle }) {
  interface StepItem {
    title?: string
    step?: string
    name?: string
    description?: string
  }

  let steps: Array<string | StepItem> = []

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        steps = parsed
      } else {
        steps = [content]
      }
    } catch {
      steps = [content]
    }
  } else if (Array.isArray(content)) {
    steps = content
  }

  if (steps.length === 0) {
    return (
      <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
        <div className="h-12 flex items-center justify-center text-gray-400 text-xs">
          No process steps
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2 py-2', getStyleClasses(style))}>
      {steps.map((step, i) => {
        // Handle both string and object formats
        const isObject = typeof step === 'object' && step !== null
        const title = isObject ? ((step as StepItem).title || (step as StepItem).step || (step as StepItem).name || '') : String(step)
        const description = isObject ? (step as StepItem).description : undefined

        return (
          <div key={i} className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold flex items-center justify-center">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <span className="text-sm text-gray-800">{title}</span>
              {description && (
                <p className="text-xs text-gray-500 mt-0.5">{description}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function FlowchartPlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-gray-400">
        <GitBranch className="h-6 w-6" />
        <span className="text-xs">{content || 'Flowchart'}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Callout & Highlight Components
// ============================================================================

function CalloutComponent({ content, icon, style }: { content: string; icon?: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-l-4 border-gray-300 bg-gray-50 rounded-r-lg p-3 flex items-start gap-2', getStyleClasses(style))}>
      <AlertCircle className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-gray-800">{content || 'Callout'}</p>
    </div>
  )
}

/**
 * Callout Group Component - renders multiple callouts with icons
 * Handles content as: array of {icon, content} objects, or JSON string
 */
function CalloutGroupComponent({ content, style }: { content: unknown; style?: ComponentStyle }) {
  // Parse content - it might be a JSON string, array, or already parsed
  let callouts: Array<{ icon?: string; content: string }> = []

  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content)
      if (Array.isArray(parsed)) {
        callouts = parsed
      } else {
        // Single callout as string
        callouts = [{ content: content }]
      }
    } catch {
      // Not JSON, treat as single callout
      callouts = [{ content: content }]
    }
  } else if (Array.isArray(content)) {
    callouts = content as Array<{ icon?: string; content: string }>
  }

  if (callouts.length === 0) {
    return (
      <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
        <div className="h-16 flex items-center justify-center text-gray-400 text-xs">
          No callouts
        </div>
      </div>
    )
  }

  // Map icon names to Lucide icons
  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'shield':
        return <AlertCircle className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      case 'trending-up':
        return <TrendingUp className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      case 'target':
        return <Target className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      case 'lightbulb':
        return <Lightbulb className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      case 'users':
        return <Users className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
    }
  }

  return (
    <div className={cn('space-y-2', getStyleClasses(style))}>
      {callouts.map((callout, i) => (
        <div key={i} className="border-l-4 border-gray-300 bg-gray-50 rounded-r-lg p-3 flex items-start gap-2">
          {getIcon(callout.icon)}
          <p className="text-sm text-gray-800">{callout.content || 'Callout'}</p>
        </div>
      ))}
    </div>
  )
}

function StatHighlightComponent({ content, label, style }: { content: string | Record<string, unknown>; label?: string; style?: ComponentStyle }) {
  const value = typeof content === 'string' ? content : (content as Record<string, unknown>)?.value?.toString() || '--'
  return (
    <div className={cn('bg-gray-50 rounded-lg p-4 text-center', getStyleClasses(style))}>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {label && <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{label}</div>}
    </div>
  )
}

function KeyTakeawayComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('bg-gray-50 border border-gray-300 rounded-lg p-3 flex items-start gap-2', getStyleClasses(style))}>
      <Lightbulb className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium text-gray-900">{content || 'Key Takeaway'}</p>
    </div>
  )
}

// ============================================================================
// Visual Elements
// ============================================================================

function ImagePlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-20 flex flex-col items-center justify-center gap-2 text-gray-400">
        <Image className="h-8 w-8" />
        <span className="text-xs text-center max-w-[150px] truncate">{content || 'Image'}</span>
      </div>
    </div>
  )
}

function MapPlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-gray-400">
        <MapPin className="h-6 w-6" />
        <span className="text-xs">{content || 'Map'}</span>
      </div>
    </div>
  )
}

function OrgChartPlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-gray-400">
        <Users className="h-6 w-6" />
        <span className="text-xs">{content || 'Org Chart'}</span>
      </div>
    </div>
  )
}

function DiagramPlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-gray-400">
        <Layers className="h-6 w-6" />
        <span className="text-xs">{content || 'Diagram'}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Generic Fallback
// ============================================================================

function GenericPlaceholder({ type, content, style }: { type: string; content?: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border border-dashed border-muted-foreground/30 rounded bg-muted/10 p-2', getStyleClasses(style))}>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        <span className="uppercase tracking-wide opacity-50">[{type.replace(/_/g, ' ')}]</span>
        {content && <span className="truncate">{content}</span>}
      </div>
    </div>
  )
}

// ============================================================================
// Main Component Renderer
// ============================================================================

export const WireframeComponentRenderer = memo(function WireframeComponentRenderer({
  component,
  slideId,
  index,
  onClick,
}: WireframeComponentRendererProps) {
  const componentId = generateComponentId(slideId, component.type, index)
  const content = typeof component.content === 'string' ? component.content : ''
  const contentArray = Array.isArray(component.content) ? component.content : [content]

  const renderContent = () => {
    switch (component.type) {
      // Text components
      case 'title':
        return <TitleComponent content={content} style={component.style} />
      case 'subtitle':
        return <SubtitleComponent content={content} style={component.style} />
      case 'heading':
        return <HeadingComponent content={content} style={component.style} />
      case 'text':
        return <TextComponent content={content} style={component.style} />
      case 'bullet_list':
        return <BulletListComponent content={component.content as string | string[]} style={component.style} />
      case 'numbered_list':
        return <NumberedListComponent content={component.content as string | string[]} style={component.style} />
      case 'quote':
        return <QuoteComponent content={content} style={component.style} />

      // Charts
      case 'bar_chart':
      case 'horizontal_bar_chart':
      case 'stacked_bar_chart':
      case 'line_chart':
      case 'area_chart':
      case 'pie_chart':
      case 'waterfall_chart':
      case 'combo_chart':
      case 'scatter_plot':
        return <ChartPlaceholder type={component.type} label={component.label} style={component.style} />

      // Data
      case 'table':
      case 'comparison_table':
      case 'financial_table':
        // Use DataTableComponent for actual data rendering
        return <DataTableComponent content={component.content} style={component.style} />
      case 'metric':
        return <MetricComponent content={component.content as string | Record<string, unknown>} label={component.label} style={component.style} />
      case 'metric_group':
        // Use MetricGroupComponent for array of metrics
        return <MetricGroupComponent content={component.content} style={component.style} />
      case 'gauge':
      case 'progress_bar':
        return <GaugePlaceholder content={content} style={component.style} />

      // Process & Flow
      case 'timeline':
      case 'milestone_timeline':
        return <TimelineComponent content={component.content} style={component.style} />
      case 'process_steps':
      case 'pipeline':
      case 'funnel':
        return <ProcessStepsComponent content={component.content} style={component.style} />
      case 'flowchart':
      case 'cycle':
      case 'gantt_chart':
        return <FlowchartPlaceholder content={content} style={component.style} />

      // Organizational
      case 'org_chart':
      case 'team_grid':
      case 'hierarchy':
        return <OrgChartPlaceholder content={content} style={component.style} />

      // Comparison & Analysis
      case 'swot':
      case 'matrix':
      case 'venn':
      case 'versus':
      case 'pros_cons':
      case 'feature_comparison':
        return <DiagramPlaceholder content={content || component.type.replace(/_/g, ' ')} style={component.style} />

      // Geographic
      case 'map':
      case 'location_list':
        return <MapPlaceholder content={content} style={component.style} />

      // Visual elements
      case 'image':
      case 'image_placeholder':
      case 'logo_grid':
      case 'icon_grid':
      case 'screenshot':
        return <ImagePlaceholder content={content} style={component.style} />
      case 'diagram':
        return <DiagramPlaceholder content={content} style={component.style} />

      // Callouts & Highlights
      case 'callout':
      case 'annotation':
        return <CalloutComponent content={content} icon={component.icon} style={component.style} />
      case 'callout_group':
        // Use CalloutGroupComponent for array of callouts
        return <CalloutGroupComponent content={component.content} style={component.style} />
      case 'stat_highlight':
        return <StatHighlightComponent content={component.content as string | Record<string, unknown>} label={component.label} style={component.style} />
      case 'key_takeaway':
        return <KeyTakeawayComponent content={content} style={component.style} />

      // Financial specific
      case 'revenue_breakdown':
      case 'unit_economics':
      case 'growth_trajectory':
      case 'valuation_summary':
        return <ChartPlaceholder type={component.type} label={component.label || component.type.replace(/_/g, ' ')} style={component.style} />

      // Fallback
      default:
        return <GenericPlaceholder type={component.type} content={content} style={component.style} />
    }
  }

  return (
    <ClickableWrapper
      componentId={componentId}
      content={content}
      onClick={onClick}
    >
      {renderContent()}
    </ClickableWrapper>
  )
})

export default WireframeComponentRenderer
