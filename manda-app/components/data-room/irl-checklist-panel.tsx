/**
 * IRL Checklist Panel Component
 * Story: E6.5 - Implement IRL-Document Linking and Progress Tracking
 * AC: #1 (Panel Display), #4 (Progress Bar), #6 (Collapsible Panel), #7 (Filter)
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ClipboardList, Filter } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
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
const FILTER_STORAGE_KEY = 'manda-irl-panel-filter-unfulfilled'

export interface IRLChecklistPanelProps {
  projectId: string
  /** Called when IRL data is refreshed */
  onRefresh?: () => void
}

export function IRLChecklistPanel({
  projectId,
  onRefresh,
}: IRLChecklistPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [irl, setIRL] = useState<IRL | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [showUnfulfilledOnly, setShowUnfulfilledOnly] = useState(false)

  // Load collapse and filter state from localStorage
  useEffect(() => {
    const collapsed = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    if (collapsed === 'true') {
      setIsCollapsed(true)
    }
    const filter = localStorage.getItem(FILTER_STORAGE_KEY)
    if (filter === 'true') {
      setShowUnfulfilledOnly(true)
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

  // Toggle unfulfilled filter
  const toggleFilter = useCallback(() => {
    setShowUnfulfilledOnly((prev) => {
      const newValue = !prev
      localStorage.setItem(FILTER_STORAGE_KEY, String(newValue))
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
      } else {
        setIRL(result.irl)
        if (result.irl) {
          const grouped = groupItemsByCategory(result.irl.items)
          // Expand all categories by default
          setExpandedCategories(new Set(grouped.map((c) => c.name)))
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

  // Handle item toggle - update local state optimistically
  const handleItemToggle = useCallback((itemId: string, fulfilled: boolean) => {
    setIRL((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        items: prev.items.map((item) =>
          item.id === itemId ? { ...item, fulfilled } : item
        ),
      }
    })
  }, [])

  // Calculate categories with filtering
  const categories = useMemo(() => {
    if (!irl) return []

    let items = irl.items
    if (showUnfulfilledOnly) {
      items = items.filter((item) => !item.fulfilled)
    }

    return groupItemsByCategory(items)
  }, [irl, showUnfulfilledOnly])

  // Calculate overall progress (always from all items, not filtered)
  const totalItems = irl?.items.length ?? 0
  const completedItems = irl?.items.filter((item) => item.fulfilled).length ?? 0
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
              className={cn(
                "w-full rounded-full transition-all",
                progressPercent === 100 ? "bg-green-500" : "bg-primary"
              )}
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
    <TooltipProvider>
      <div className="flex h-full w-80 flex-col border-l bg-background">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">IRL Checklist</h3>
          </div>
          <div className="flex items-center gap-1">
            {/* Filter Toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  size="sm"
                  pressed={showUnfulfilledOnly}
                  onPressedChange={toggleFilter}
                  aria-label="Show unfulfilled items only"
                  className="h-8 w-8 p-0"
                >
                  <Filter className={cn(
                    "h-4 w-4",
                    showUnfulfilledOnly && "text-primary"
                  )} />
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>
                {showUnfulfilledOnly ? 'Show all items' : 'Show unfulfilled only'}
              </TooltipContent>
            </Tooltip>

            {/* Collapse Button */}
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
                <span className={cn(
                  "font-medium",
                  progressPercent === 100 && "text-green-600 dark:text-green-400"
                )}>
                  {completedItems}/{totalItems} ({progressPercent}%)
                </span>
              </div>
              <Progress
                value={progressPercent}
                className={cn(
                  "mt-2 h-2",
                  progressPercent === 100 && "[&>div]:bg-green-500"
                )}
              />
            </div>

            {/* Items List */}
            <ScrollArea className="flex-1">
              <div className="p-4">
                {categories.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground">
                    {showUnfulfilledOnly
                      ? 'All items are fulfilled!'
                      : 'No items in this IRL'}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {categories.map((category) => (
                      <IRLChecklistCategory
                        key={category.name}
                        category={category}
                        isExpanded={expandedCategories.has(category.name)}
                        onToggle={() => toggleCategory(category.name)}
                        onItemToggle={handleItemToggle}
                      />
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </div>
    </TooltipProvider>
  )
}

/**
 * Category group with expand/collapse
 */
interface IRLChecklistCategoryProps {
  category: IRLCategory
  isExpanded: boolean
  onToggle: () => void
  onItemToggle?: (itemId: string, fulfilled: boolean) => void
}

function IRLChecklistCategory({
  category,
  isExpanded,
  onToggle,
  onItemToggle,
}: IRLChecklistCategoryProps) {
  const allFulfilled = category.completedCount === category.totalCount && category.totalCount > 0

  return (
    <div className={cn(
      "rounded-lg border bg-muted/20",
      allFulfilled && "border-green-200 dark:border-green-800/50 bg-green-50/30 dark:bg-green-950/20"
    )}>
      {/* Category Header */}
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between px-3 py-2 text-left',
          'hover:bg-muted/50 transition-colors rounded-t-lg',
          isExpanded && 'border-b'
        )}
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <ChevronRight className={cn(
            "h-4 w-4 transition-transform",
            isExpanded && "rotate-90"
          )} />
          <span className={cn(
            "font-medium text-sm",
            allFulfilled && "text-green-700 dark:text-green-400"
          )}>{category.name}</span>
        </div>
        <span className={cn(
          "text-xs",
          allFulfilled
            ? "text-green-600 dark:text-green-400 font-medium"
            : "text-muted-foreground"
        )}>
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
              onToggle={onItemToggle}
            />
          ))}
        </div>
      )}
    </div>
  )
}
