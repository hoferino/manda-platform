/**
 * FindingsCardGrid Component
 * Container for displaying findings as cards in a responsive grid
 * Story: E4.4 - Build Card View Alternative for Findings (AC: 3, 4, 6, 7)
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 2)
 * Story: E8.5 - Finding → Q&A Quick-Add (AC: #1, #6, #7)
 *
 * Features:
 * - Responsive CSS Grid layout (1 col mobile, 2 col tablet, 3 col desktop)
 * - Loading skeleton cards
 * - Empty state component
 * - Pagination matching table behavior
 * - Virtual scrolling for large datasets (>100 findings)
 * - Selection state for bulk actions (E4.11)
 * - Q&A quick-add integration (E8.5)
 */

'use client'

import { useCallback, useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
} from 'lucide-react'
import { FindingCard } from './FindingCard'
import type { Finding, FindingWithSimilarity } from '@/lib/types/findings'
import { cn } from '@/lib/utils'

// Threshold for enabling virtual scrolling
const VIRTUAL_SCROLL_THRESHOLD = 100

export interface FindingsCardGridProps {
  findings: Finding[] | FindingWithSimilarity[]
  isLoading?: boolean
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
  onValidate: (findingId: string, action: 'confirm' | 'reject') => Promise<void>
  onEdit: (finding: Finding) => void
  onSaveEdit: (newText: string) => Promise<void>
  onCancelEdit: () => void
  onCardClick?: (finding: Finding) => void
  editingFindingId?: string | null
  showSimilarity?: boolean
  className?: string
  projectId: string
  // Selection props for bulk actions (E4.11)
  selectedIds?: Set<string>
  onSelectionChange?: (id: string, selected: boolean) => void
  // Q&A Quick-Add props (E8.5)
  qaItemIdMap?: Record<string, string | null>
  onAddToQA?: (finding: Finding) => void
}

/**
 * Skeleton card for loading state
 */
function SkeletonCard() {
  return (
    <Card className="animate-pulse">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="px-4 py-2">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-2" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
      <CardFooter className="px-4 py-3 border-t flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <div className="flex items-center gap-1">
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </CardFooter>
    </Card>
  )
}

/**
 * Empty state component
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <FileText className="h-12 w-12 text-muted-foreground mb-4" aria-hidden="true" />
      <h3 className="text-lg font-semibold">No findings found</h3>
      <p className="text-muted-foreground mt-1 max-w-sm">
        No findings match your current filters. Try adjusting your filters or upload
        documents to extract findings.
      </p>
    </div>
  )
}

/**
 * Pagination component matching table style
 */
function Pagination({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number
  totalPages: number
  total: number
  onPageChange: (page: number) => void
}) {
  return (
    <div className="flex items-center justify-between px-2 mt-6">
      <div className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} findings)
      </div>
      <div className="flex items-center space-x-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          aria-label="Go to first page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          aria-label="Go to previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          aria-label="Go to next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          aria-label="Go to last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

/**
 * Virtual card grid for large datasets
 * Uses react-virtual for efficient rendering
 */
function VirtualCardGrid({
  findings,
  onValidate,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onCardClick,
  editingFindingId,
  showSimilarity,
  projectId,
  selectedIds,
  onSelectionChange,
  qaItemIdMap,
  onAddToQA,
}: {
  findings: Finding[] | FindingWithSimilarity[]
  onValidate: (findingId: string, action: 'confirm' | 'reject') => Promise<void>
  onEdit: (finding: Finding) => void
  onSaveEdit: (newText: string) => Promise<void>
  onCancelEdit: () => void
  onCardClick?: (finding: Finding) => void
  editingFindingId?: string | null
  showSimilarity?: boolean
  projectId: string
  selectedIds?: Set<string>
  onSelectionChange?: (id: string, selected: boolean) => void
  qaItemIdMap?: Record<string, string | null>
  onAddToQA?: (finding: Finding) => void
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  // Calculate columns based on container width
  // This is a simplified approach - in production you might use ResizeObserver
  const columns = 3 // Default to 3 columns for desktop
  const rowCount = Math.ceil(findings.length / columns)

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 280, // Estimated card height
    overscan: 3,
  })

  return (
    <div
      ref={parentRef}
      className="h-[600px] overflow-auto rounded-lg border"
      role="region"
      aria-label="Findings grid with virtual scrolling"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const startIndex = virtualRow.index * columns
          const rowFindings = findings.slice(startIndex, startIndex + columns)

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {rowFindings.map((finding) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    onValidate={onValidate}
                    onEdit={onEdit}
                    onSaveEdit={onSaveEdit}
                    onCancelEdit={onCancelEdit}
                    onCardClick={onCardClick}
                    isEditing={editingFindingId === finding.id}
                    showSimilarity={showSimilarity}
                    projectId={projectId}
                    isSelected={selectedIds?.has(finding.id)}
                    onSelectionChange={onSelectionChange}
                    qaItemId={qaItemIdMap?.[finding.id]}
                    onAddToQA={onAddToQA}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function FindingsCardGrid({
  findings,
  isLoading = false,
  page,
  totalPages,
  total,
  onPageChange,
  onValidate,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onCardClick,
  editingFindingId,
  showSimilarity = false,
  className,
  projectId,
  // Selection props for bulk actions (E4.11)
  selectedIds,
  onSelectionChange,
  // Q&A Quick-Add props (E8.5)
  qaItemIdMap,
  onAddToQA,
}: FindingsCardGridProps) {
  // Determine if we should use virtual scrolling
  const useVirtualScroll = findings.length > VIRTUAL_SCROLL_THRESHOLD

  // Loading state with skeleton cards
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          aria-busy="true"
          aria-label="Loading findings"
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Empty state
  if (findings.length === 0) {
    return <EmptyState />
  }

  // Virtual scrolling for large datasets
  if (useVirtualScroll) {
    return (
      <div className={cn('space-y-4', className)}>
        <VirtualCardGrid
          findings={findings}
          onValidate={onValidate}
          onEdit={onEdit}
          onSaveEdit={onSaveEdit}
          onCancelEdit={onCancelEdit}
          onCardClick={onCardClick}
          editingFindingId={editingFindingId}
          showSimilarity={showSimilarity}
          projectId={projectId}
          selectedIds={selectedIds}
          onSelectionChange={onSelectionChange}
          qaItemIdMap={qaItemIdMap}
          onAddToQA={onAddToQA}
        />
        <Pagination
          page={page}
          totalPages={totalPages}
          total={total}
          onPageChange={onPageChange}
        />
      </div>
    )
  }

  // Regular grid for smaller datasets
  return (
    <div className={cn('space-y-4', className)}>
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        role="region"
        aria-label={`Findings grid showing ${findings.length} of ${total} findings`}
      >
        {findings.map((finding) => (
          <FindingCard
            key={finding.id}
            finding={finding}
            onValidate={onValidate}
            onEdit={onEdit}
            onSaveEdit={onSaveEdit}
            onCancelEdit={onCancelEdit}
            onCardClick={onCardClick}
            isEditing={editingFindingId === finding.id}
            showSimilarity={showSimilarity}
            projectId={projectId}
            isSelected={selectedIds?.has(finding.id)}
            onSelectionChange={onSelectionChange}
            qaItemId={qaItemIdMap?.[finding.id]}
            onAddToQA={onAddToQA}
          />
        ))}
      </div>
      <Pagination
        page={page}
        totalPages={totalPages}
        total={total}
        onPageChange={onPageChange}
      />
    </div>
  )
}
