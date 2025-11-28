/**
 * FindingSearch Component
 * Search input for semantic search of findings
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #1, #5, #6)
 *
 * Features:
 * - Debounced search input (300ms)
 * - Search icon and clear (X) button
 * - Enter key triggers immediate search
 * - Escape key clears search
 * - Loading spinner during search
 * - Empty state message for no results
 */

'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Search, X, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FindingSearchProps {
  value: string
  onChange: (query: string) => void
  onSearch: (query: string) => void
  onClear: () => void
  isSearching?: boolean
  resultCount?: number
  searchTime?: number
  placeholder?: string
  disabled?: boolean
  className?: string
}

// Debounce delay in milliseconds
const DEBOUNCE_DELAY = 300

export function FindingSearch({
  value,
  onChange,
  onSearch,
  onClear,
  isSearching = false,
  resultCount,
  searchTime,
  placeholder = "Search findings (e.g., 'revenue growth Q3')",
  disabled = false,
  className,
}: FindingSearchProps) {
  const [localValue, setLocalValue] = useState(value)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync local value with external value
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  // Handle input change with debounce
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)
      onChange(newValue)

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new debounce timer
      if (newValue.trim()) {
        debounceTimerRef.current = setTimeout(() => {
          onSearch(newValue.trim())
        }, DEBOUNCE_DELAY)
      }
    },
    [onChange, onSearch]
  )

  // Handle Enter key for immediate search
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && localValue.trim()) {
        // Cancel pending debounce
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        onSearch(localValue.trim())
      } else if (e.key === 'Escape') {
        // Clear search on Escape
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current)
        }
        handleClear()
      }
    },
    [localValue, onSearch]
  )

  // Handle clear button click
  const handleClear = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    setLocalValue('')
    onChange('')
    onClear()
    // Focus input after clear
    inputRef.current?.focus()
  }, [onChange, onClear])

  const showClearButton = localValue.length > 0 || value.length > 0
  const showResultInfo = resultCount !== undefined && value.trim().length > 0

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        {/* Search Icon */}
        <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : (
            <Search className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {/* Search Input */}
        <Input
          ref={inputRef}
          type="text"
          value={localValue}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isSearching}
          className="pl-10 pr-10"
          aria-label="Search findings"
          data-testid="finding-search-input"
        />

        {/* Clear Button */}
        {showClearButton && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClear}
            disabled={disabled || isSearching}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0 hover:bg-muted"
            aria-label="Clear search"
            data-testid="finding-search-clear"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Search Results Info */}
      {showResultInfo && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="secondary" className="font-normal" data-testid="search-results-badge">
            Search Results
          </Badge>
          <span>
            Showing {resultCount} {resultCount === 1 ? 'result' : 'results'}
            {searchTime !== undefined && ` (${searchTime}ms)`}
          </span>
        </div>
      )}
    </div>
  )
}

/**
 * Empty search results component
 */
export function EmptySearchResults({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <div
      className="flex flex-col items-center justify-center py-12 text-center"
      data-testid="empty-search-results"
    >
      <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-medium mb-2">No findings match your search</h3>
      <p className="text-muted-foreground mb-4 max-w-md">
        No results found for &quot;{query}&quot;. Try different keywords or check the spelling.
      </p>
      <Button variant="outline" onClick={onClear}>
        Clear search and view all findings
      </Button>
    </div>
  )
}
