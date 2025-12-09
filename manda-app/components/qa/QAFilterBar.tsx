'use client'

/**
 * Q&A Filter Bar Component
 * Filter controls for category, priority, and status
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 2)
 *
 * Features:
 * - Category dropdown filter
 * - Priority dropdown filter
 * - Status toggle (all/pending/answered)
 * - Clear all filters button
 */

import { useCallback } from 'react'
import { X, Filter } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  QAFilters,
  QACategory,
  QAPriority,
  QA_CATEGORIES,
  QA_PRIORITIES,
  getCategoryInfo,
  getPriorityInfo,
} from '@/lib/types/qa'

interface QAFilterBarProps {
  filters: QAFilters
  onFilterChange: (filters: QAFilters) => void
}

export function QAFilterBar({ filters, onFilterChange }: QAFilterBarProps) {
  // Handle category change
  const handleCategoryChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...filters,
        category: value === 'all' ? undefined : (value as QACategory),
      })
    },
    [filters, onFilterChange]
  )

  // Handle priority change
  const handlePriorityChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...filters,
        priority: value === 'all' ? undefined : (value as QAPriority),
      })
    },
    [filters, onFilterChange]
  )

  // Handle status change
  const handleStatusChange = useCallback(
    (value: string) => {
      onFilterChange({
        ...filters,
        status: value === 'all' ? undefined : (value as 'pending' | 'answered'),
      })
    },
    [filters, onFilterChange]
  )

  // Clear all filters
  const handleClearFilters = useCallback(() => {
    onFilterChange({})
  }, [onFilterChange])

  // Check if any filters are active
  const hasActiveFilters = filters.category || filters.priority || filters.status

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Filter className="h-4 w-4" />
        <span>Filters:</span>
      </div>

      {/* Category Filter */}
      <Select
        value={filters.category || 'all'}
        onValueChange={handleCategoryChange}
      >
        <SelectTrigger className="w-[150px] h-9">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {QA_CATEGORIES.map(category => {
            const info = getCategoryInfo(category)
            return (
              <SelectItem key={category} value={category}>
                {info.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      {/* Priority Filter */}
      <Select
        value={filters.priority || 'all'}
        onValueChange={handlePriorityChange}
      >
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Priorities</SelectItem>
          {QA_PRIORITIES.map(priority => {
            const info = getPriorityInfo(priority)
            return (
              <SelectItem key={priority} value={priority}>
                {info.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>

      {/* Status Filter */}
      <Select
        value={filters.status || 'all'}
        onValueChange={handleStatusChange}
      >
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="answered">Answered</SelectItem>
        </SelectContent>
      </Select>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2">
          {filters.category && (
            <Badge variant="secondary" className="gap-1">
              {getCategoryInfo(filters.category).label}
              <button
                onClick={() => handleCategoryChange('all')}
                className="ml-1 hover:text-destructive"
                aria-label="Remove category filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.priority && (
            <Badge variant="secondary" className="gap-1">
              {getPriorityInfo(filters.priority).label}
              <button
                onClick={() => handlePriorityChange('all')}
                className="ml-1 hover:text-destructive"
                aria-label="Remove priority filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1 capitalize">
              {filters.status}
              <button
                onClick={() => handleStatusChange('all')}
                className="ml-1 hover:text-destructive"
                aria-label="Remove status filter"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {/* Clear All */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  )
}
