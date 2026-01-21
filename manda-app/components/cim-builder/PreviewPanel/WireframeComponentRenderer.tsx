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
    <h2 className={cn('text-xl font-bold text-foreground py-1', getStyleClasses(style))}>
      {content || 'Untitled'}
    </h2>
  )
}

function SubtitleComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <h3 className={cn('text-base font-semibold text-muted-foreground py-1', getStyleClasses(style))}>
      {content || 'Subtitle'}
    </h3>
  )
}

function HeadingComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <h4 className={cn('text-sm font-semibold text-foreground py-1', getStyleClasses(style))}>
      {content || 'Heading'}
    </h4>
  )
}

function TextComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <p className={cn('text-sm text-foreground/90 leading-relaxed py-1', getStyleClasses(style))}>
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
          <span className="text-foreground/90">{item}</span>
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
          <span className="text-foreground/90">{item}</span>
        </li>
      ))}
    </ol>
  )
}

function QuoteComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <blockquote className={cn('border-l-4 border-gray-300 pl-4 py-2 italic text-sm text-muted-foreground', getStyleClasses(style))}>
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
      <div className="h-20 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
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
      {metricLabel && <div className="text-sm text-muted-foreground mt-1">{metricLabel}</div>}
    </div>
  )
}

function TablePlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
        <Table2 className="h-6 w-6" />
        <span className="text-xs">{content || 'Data Table'}</span>
      </div>
    </div>
  )
}

function GaugePlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
        <Gauge className="h-6 w-6" />
        <span className="text-xs">{content || 'Gauge'}</span>
      </div>
    </div>
  )
}

// ============================================================================
// Process & Flow Components
// ============================================================================

function TimelineComponent({ content, style }: { content: string | string[]; style?: ComponentStyle }) {
  const items = Array.isArray(content) ? content : [content]
  return (
    <div className={cn('flex items-center gap-2 py-2 overflow-x-auto', getStyleClasses(style))}>
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <div className="flex-shrink-0 px-3 py-1.5 bg-gray-100 rounded-full text-xs font-medium">
            {item}
          </div>
          {i < items.length - 1 && (
            <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

function ProcessStepsComponent({ content, style }: { content: string | string[]; style?: ComponentStyle }) {
  const steps = Array.isArray(content) ? content : [content]
  return (
    <div className={cn('space-y-2 py-2', getStyleClasses(style))}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-400 text-white text-xs font-bold flex items-center justify-center">
            {i + 1}
          </div>
          <span className="text-sm text-foreground/90 pt-0.5">{step}</span>
        </div>
      ))}
    </div>
  )
}

function FlowchartPlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
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
      <p className="text-sm text-foreground/90">{content || 'Callout'}</p>
    </div>
  )
}

function StatHighlightComponent({ content, label, style }: { content: string | Record<string, unknown>; label?: string; style?: ComponentStyle }) {
  const value = typeof content === 'string' ? content : (content as Record<string, unknown>)?.value?.toString() || '--'
  return (
    <div className={cn('bg-gray-50 rounded-lg p-4 text-center', getStyleClasses(style))}>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {label && <div className="text-xs text-muted-foreground mt-1 uppercase tracking-wide">{label}</div>}
    </div>
  )
}

function KeyTakeawayComponent({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('bg-gray-50 border border-gray-300 rounded-lg p-3 flex items-start gap-2', getStyleClasses(style))}>
      <Lightbulb className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      <p className="text-sm font-medium text-foreground">{content || 'Key Takeaway'}</p>
    </div>
  )
}

// ============================================================================
// Visual Elements
// ============================================================================

function ImagePlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-20 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
        <Image className="h-8 w-8" />
        <span className="text-xs text-center max-w-[150px] truncate">{content || 'Image'}</span>
      </div>
    </div>
  )
}

function MapPlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
        <MapPin className="h-6 w-6" />
        <span className="text-xs">{content || 'Map'}</span>
      </div>
    </div>
  )
}

function OrgChartPlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
        <Users className="h-6 w-6" />
        <span className="text-xs">{content || 'Org Chart'}</span>
      </div>
    </div>
  )
}

function DiagramPlaceholder({ content, style }: { content: string; style?: ComponentStyle }) {
  return (
    <div className={cn('border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20 p-4', getStyleClasses(style))}>
      <div className="h-16 flex flex-col items-center justify-center gap-2 text-muted-foreground/50">
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
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
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
        return <TablePlaceholder content={content} style={component.style} />
      case 'metric':
      case 'metric_group':
        return <MetricComponent content={component.content as string | Record<string, unknown>} label={component.label} style={component.style} />
      case 'gauge':
      case 'progress_bar':
        return <GaugePlaceholder content={content} style={component.style} />

      // Process & Flow
      case 'timeline':
      case 'milestone_timeline':
        return <TimelineComponent content={component.content as string | string[]} style={component.style} />
      case 'process_steps':
      case 'pipeline':
      case 'funnel':
        return <ProcessStepsComponent content={component.content as string | string[]} style={component.style} />
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
      case 'callout_group':
      case 'annotation':
        return <CalloutComponent content={content} icon={component.icon} style={component.style} />
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
