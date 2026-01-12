'use client'

/**
 * Layout Components for Wireframe Rendering
 *
 * Provides layout structures for different slide arrangements.
 * Each layout defines regions where components are placed.
 *
 * Story 9: Preview Panel - Wireframe Rendering
 */

import * as React from 'react'
import { cn } from '@/lib/utils'

// ============================================================================
// Types
// ============================================================================

export interface LayoutProps {
  children?: React.ReactNode
  className?: string
}

export interface RegionProps {
  children?: React.ReactNode
  label?: string
  className?: string
  style?: React.CSSProperties
}

// ============================================================================
// Region Placeholder
// ============================================================================

export function RegionPlaceholder({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center h-full min-h-[60px]',
        'text-xs text-muted-foreground/50 uppercase tracking-wide',
        className
      )}
    >
      {label}
    </div>
  )
}

// ============================================================================
// Region Container
// ============================================================================

export function Region({ children, label, className, style }: RegionProps) {
  const hasChildren = React.Children.count(children) > 0

  return (
    <div
      className={cn(
        'border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg',
        'bg-gray-50/50 dark:bg-gray-800/30 p-3',
        'flex flex-col gap-2 overflow-auto',
        className
      )}
      style={style}
    >
      {hasChildren ? children : <RegionPlaceholder label={label || 'Empty'} />}
    </div>
  )
}

// ============================================================================
// Full Layout - Single region fills entire slide
// ============================================================================

export function FullLayout({ children, className }: LayoutProps) {
  return (
    <div className={cn('w-full h-full', className)}>
      <Region label="Content" className="h-full">
        {children}
      </Region>
    </div>
  )
}

// ============================================================================
// Title Only Layout - Centered title for section dividers
// ============================================================================

interface TitleOnlyLayoutProps extends LayoutProps {
  title: string
}

export function TitleOnlyLayout({ title, className }: TitleOnlyLayoutProps) {
  return (
    <div
      className={cn(
        'w-full h-full flex items-center justify-center',
        'bg-gradient-to-br from-muted/50 to-muted',
        className
      )}
    >
      <h2 className="text-2xl font-bold text-center text-foreground px-8">
        {title}
      </h2>
    </div>
  )
}

// ============================================================================
// Title Content Layout - Title at top, content below
// ============================================================================

interface TitleContentLayoutProps extends LayoutProps {
  title: string
}

export function TitleContentLayout({ title, children, className }: TitleContentLayoutProps) {
  return (
    <div className={cn('w-full h-full flex flex-col gap-3', className)}>
      <div className="flex-shrink-0">
        <h2 className="text-xl font-bold text-foreground">{title}</h2>
      </div>
      <Region label="Content" className="flex-1">
        {children}
      </Region>
    </div>
  )
}

// ============================================================================
// Split Horizontal Layout - Left and Right regions (50-50)
// ============================================================================

interface SplitHorizontalLayoutProps extends LayoutProps {
  left?: React.ReactNode
  right?: React.ReactNode
}

export function SplitHorizontalLayout({ left, right, className }: SplitHorizontalLayoutProps) {
  return (
    <div className={cn('w-full h-full flex gap-3', className)}>
      <Region label="Left" className="flex-1">
        {left}
      </Region>
      <Region label="Right" className="flex-1">
        {right}
      </Region>
    </div>
  )
}

// ============================================================================
// Split Horizontal Weighted Layout - Left 1/3, Right 2/3 (or vice versa)
// ============================================================================

interface SplitHorizontalWeightedLayoutProps extends LayoutProps {
  left?: React.ReactNode
  right?: React.ReactNode
  leftWeight?: number
}

export function SplitHorizontalWeightedLayout({
  left,
  right,
  leftWeight = 1,
  className,
}: SplitHorizontalWeightedLayoutProps) {
  const rightWeight = 3 - leftWeight // Assumes total of 3 parts

  return (
    <div className={cn('w-full h-full flex gap-3', className)}>
      <Region label="Left" className={`flex-[${leftWeight}]`} style={{ flex: leftWeight }}>
        {left}
      </Region>
      <Region label="Right" className={`flex-[${rightWeight}]`} style={{ flex: rightWeight }}>
        {right}
      </Region>
    </div>
  )
}

// ============================================================================
// Split Vertical Layout - Top and Bottom regions
// ============================================================================

interface SplitVerticalLayoutProps extends LayoutProps {
  top?: React.ReactNode
  bottom?: React.ReactNode
}

export function SplitVerticalLayout({ top, bottom, className }: SplitVerticalLayoutProps) {
  return (
    <div className={cn('w-full h-full flex flex-col gap-3', className)}>
      <Region label="Top" className="flex-1">
        {top}
      </Region>
      <Region label="Bottom" className="flex-1">
        {bottom}
      </Region>
    </div>
  )
}

// ============================================================================
// Quadrant Layout - 2x2 grid
// ============================================================================

interface QuadrantLayoutProps extends LayoutProps {
  topLeft?: React.ReactNode
  topRight?: React.ReactNode
  bottomLeft?: React.ReactNode
  bottomRight?: React.ReactNode
}

export function QuadrantLayout({
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  className,
}: QuadrantLayoutProps) {
  return (
    <div className={cn('w-full h-full grid grid-cols-2 grid-rows-2 gap-3', className)}>
      <Region label="Top Left">{topLeft}</Region>
      <Region label="Top Right">{topRight}</Region>
      <Region label="Bottom Left">{bottomLeft}</Region>
      <Region label="Bottom Right">{bottomRight}</Region>
    </div>
  )
}

// ============================================================================
// Thirds Horizontal Layout - 3 equal columns
// ============================================================================

interface ThirdsHorizontalLayoutProps extends LayoutProps {
  left?: React.ReactNode
  center?: React.ReactNode
  right?: React.ReactNode
}

export function ThirdsHorizontalLayout({
  left,
  center,
  right,
  className,
}: ThirdsHorizontalLayoutProps) {
  return (
    <div className={cn('w-full h-full grid grid-cols-3 gap-3', className)}>
      <Region label="Left">{left}</Region>
      <Region label="Center">{center}</Region>
      <Region label="Right">{right}</Region>
    </div>
  )
}

// ============================================================================
// Thirds Vertical Layout - 3 equal rows
// ============================================================================

interface ThirdsVerticalLayoutProps extends LayoutProps {
  top?: React.ReactNode
  middle?: React.ReactNode
  bottom?: React.ReactNode
}

export function ThirdsVerticalLayout({
  top,
  middle,
  bottom,
  className,
}: ThirdsVerticalLayoutProps) {
  return (
    <div className={cn('w-full h-full grid grid-rows-3 gap-3', className)}>
      <Region label="Top">{top}</Region>
      <Region label="Middle">{middle}</Region>
      <Region label="Bottom">{bottom}</Region>
    </div>
  )
}

// ============================================================================
// Sidebar Left Layout - Narrow left, wide right
// ============================================================================

interface SidebarLeftLayoutProps extends LayoutProps {
  sidebar?: React.ReactNode
  main?: React.ReactNode
}

export function SidebarLeftLayout({ sidebar, main, className }: SidebarLeftLayoutProps) {
  return (
    <div className={cn('w-full h-full flex gap-3', className)}>
      <Region label="Sidebar" className="w-1/4 min-w-[100px]">
        {sidebar}
      </Region>
      <Region label="Main" className="flex-1">
        {main}
      </Region>
    </div>
  )
}

// ============================================================================
// Sidebar Right Layout - Wide left, narrow right
// ============================================================================

interface SidebarRightLayoutProps extends LayoutProps {
  main?: React.ReactNode
  sidebar?: React.ReactNode
}

export function SidebarRightLayout({ main, sidebar, className }: SidebarRightLayoutProps) {
  return (
    <div className={cn('w-full h-full flex gap-3', className)}>
      <Region label="Main" className="flex-1">
        {main}
      </Region>
      <Region label="Sidebar" className="w-1/4 min-w-[100px]">
        {sidebar}
      </Region>
    </div>
  )
}

// ============================================================================
// Hero With Details Layout - Large center, small corners
// ============================================================================

interface HeroWithDetailsLayoutProps extends LayoutProps {
  center?: React.ReactNode
  topLeft?: React.ReactNode
  topRight?: React.ReactNode
  bottomLeft?: React.ReactNode
  bottomRight?: React.ReactNode
}

export function HeroWithDetailsLayout({
  center,
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  className,
}: HeroWithDetailsLayoutProps) {
  return (
    <div className={cn('w-full h-full grid grid-cols-4 grid-rows-3 gap-2', className)}>
      {/* Top row: corners + center spans */}
      <Region label="Top Left" className="col-span-1 row-span-1">
        {topLeft}
      </Region>
      <div className="col-span-2 row-span-1" /> {/* Empty for center below */}
      <Region label="Top Right" className="col-span-1 row-span-1">
        {topRight}
      </Region>

      {/* Center row: spans full width in middle */}
      <Region label="Center" className="col-span-4 row-span-1">
        {center}
      </Region>

      {/* Bottom row: corners */}
      <Region label="Bottom Left" className="col-span-1 row-span-1">
        {bottomLeft}
      </Region>
      <div className="col-span-2 row-span-1" /> {/* Empty for symmetry */}
      <Region label="Bottom Right" className="col-span-1 row-span-1">
        {bottomRight}
      </Region>
    </div>
  )
}

// ============================================================================
// Six Grid Layout - 2x3 or 3x2 grid
// ============================================================================

interface SixGridLayoutProps extends LayoutProps {
  cells?: React.ReactNode[]
}

export function SixGridLayout({ cells = [], className }: SixGridLayoutProps) {
  const cellLabels = ['Cell 1', 'Cell 2', 'Cell 3', 'Cell 4', 'Cell 5', 'Cell 6']

  return (
    <div className={cn('w-full h-full grid grid-cols-3 grid-rows-2 gap-2', className)}>
      {cellLabels.map((label, index) => (
        <Region key={index} label={label}>
          {cells[index]}
        </Region>
      ))}
    </div>
  )
}

// ============================================================================
// Comparison Layout - Two columns with headers for comparison
// ============================================================================

interface ComparisonLayoutProps extends LayoutProps {
  leftHeader?: string
  rightHeader?: string
  left?: React.ReactNode
  right?: React.ReactNode
}

export function ComparisonLayout({
  leftHeader = 'Option A',
  rightHeader = 'Option B',
  left,
  right,
  className,
}: ComparisonLayoutProps) {
  return (
    <div className={cn('w-full h-full flex flex-col gap-2', className)}>
      <div className="flex gap-3">
        <div className="flex-1 text-center font-semibold text-sm text-muted-foreground">
          {leftHeader}
        </div>
        <div className="flex-1 text-center font-semibold text-sm text-muted-foreground">
          {rightHeader}
        </div>
      </div>
      <div className="flex-1 flex gap-3">
        <Region label="Left" className="flex-1">
          {left}
        </Region>
        <Region label="Right" className="flex-1">
          {right}
        </Region>
      </div>
    </div>
  )
}
