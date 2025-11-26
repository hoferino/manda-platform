/**
 * IRL Checklist Panel Component
 * Story: E2.8 - Implement IRL Integration with Document Tracking
 * AC: #1 (Panel Display), #6 (Collapsible Panel)
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, ClipboardList, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { IRLChecklistItem } from './irl-checklist-item'
import { IRLEmptyState } from './irl-empty-state'
import {
  getProjectIRL,
  groupItemsByCategory,
  type IRL,
  type IRLCategory,
  type IRLItem,
} from '@/lib/api/irl'

const COLLAPSE_STORAGE_KEY = 'manda-irl-panel-collapsed'

export interface IRLChecklistPanelProps {
  projectId: string
  /** Called when user uploads a file from the checklist */
  onUploadForItem?: (item: IRLItem) => void
  /** Called when IRL data is refreshed */
  onRefresh?: () => void
}

export function IRLChecklistPanel({
  projectId,
  onUploadForItem,
  onRefresh,
}: IRLChecklistPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [irl, setIRL] = useState<IRL | null>(null)
  const [categories, setCategories] = useState<IRLCategory[]>([])
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  // Load collapse state from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    if (stored === 'true') {
      setIsCollapsed(true)
    }
  }, [])

  // Save collapse state to localStorage
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const newValue = !prev
      localStorage.setItem(COLLAPSE_STORAGE_KEY, String(newValue))
      return newValue
    })
  }, [])

  // Load IRL data
  const loadIRL = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getProjectIRL(projectId)
      if (result.error) {
        setError(result.error)
        setIRL(null)
        setCategories([])
      } else {
        setIRL(result.irl)
        if (result.irl) {
          const grouped = groupItemsByCategory(result.irl.items)
          setCategories(grouped)
          // Expand all categories by default
          setExpandedCategories(new Set(grouped.map((c) => c.name)))
        } else {
          setCategories([])
        }
      }
    } catch (err) {
      console.error('Error loading IRL:', err)
      setError('Failed to load IRL checklist')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    loadIRL()
  }, [loadIRL])

  // Handle category expand/collapse
  const toggleCategory = useCallback((categoryName: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(categoryName)) {
        next.delete(categoryName)
      } else {
        next.add(categoryName)
      }
      return next
    })
  }, [])

  // Refresh handler
  const handleRefresh = useCallback(async () => {
    await loadIRL()
    onRefresh?.()
  }, [loadIRL, onRefresh])

  // Calculate overall progress
  const totalItems = irl?.items.length ?? 0
  const completedItems = irl?.items.filter((item) => item.documentId !== null).length ?? 0
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  // Collapsed view
  if (isCollapsed) {
    return (
      <div className="flex h-full w-10 flex-col items-center border-l bg-muted/30 py-4">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleCollapse}
          aria-label="Expand IRL Checklist"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="mt-4 flex flex-1 flex-col items-center">
          <ClipboardList className="h-5 w-5 text-muted-foreground" />
          <div
            className="mt-2 flex h-24 w-2 flex-col items-center justify-end rounded-full bg-muted"
            title={`${progressPercent}% complete`}
          >
            <div
              className="w-full rounded-full bg-primary transition-all"
              style={{ height: `${progressPercent}%` }}
            />
          </div>
          <span className="mt-2 text-xs font-medium text-muted-foreground">
            {completedItems}/{totalItems}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full w-80 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">IRL Checklist</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleCollapse}
          aria-label="Collapse IRL Checklist"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Retry
          </Button>
        </div>
      ) : !irl ? (
        <IRLEmptyState projectId={projectId} />
      ) : (
        <>
          {/* Progress Section */}
          <div className="border-b px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {completedItems}/{totalItems} ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} className="mt-2 h-2" />
          </div>

          {/* Items List */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              {categories.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground">
                  No items in this IRL
                </p>
              ) : (
                <div className="space-y-4">
                  {categories.map((category) => (
                    <IRLChecklistCategory
                      key={category.name}
                      category={category}
                      isExpanded={expandedCategories.has(category.name)}
                      onToggle={() => toggleCategory(category.name)}
                      onUploadForItem={onUploadForItem}
                      onRefresh={handleRefresh}
                    />
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  )
}

/**
 * Category group with expand/collapse
 */
interface IRLChecklistCategoryProps {
  category: IRLCategory
  isExpanded: boolean
  onToggle: () => void
  onUploadForItem?: (item: IRLItem) => void
  onRefresh?: () => void
}

function IRLChecklistCategory({
  category,
  isExpanded,
  onToggle,
  onUploadForItem,
  onRefresh,
}: IRLChecklistCategoryProps) {
  return (
    <div className="rounded-lg border bg-muted/20">
      {/* Category Header */}
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between px-3 py-2 text-left',
          'hover:bg-muted/50 transition-colors',
          isExpanded && 'border-b'
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronRight className="h-4 w-4 rotate-90 transition-transform" />
          ) : (
            <ChevronRight className="h-4 w-4 transition-transform" />
          )}
          <span className="font-medium text-sm">{category.name}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {category.completedCount}/{category.totalCount}
        </span>
      </button>

      {/* Category Items */}
      {isExpanded && (
        <div className="p-2 space-y-1">
          {category.items.map((item) => (
            <IRLChecklistItem
              key={item.id}
              item={item}
              onUpload={() => onUploadForItem?.(item)}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  )
}
