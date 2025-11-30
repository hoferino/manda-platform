/**
 * FindingsBrowser Component
 * Container for the Findings tab in Knowledge Explorer
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #2, #4, #5)
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #4, #5, #8)
 * Story: E4.3 - Implement Inline Finding Validation (AC: #1, #2, #3, #4, #8)
 * Story: E4.4 - Build Card View Alternative for Findings (AC: #2, #3, #4, #5, #6)
 *
 * Combines:
 * - FindingSearch for semantic search
 * - FindingFilters for filtering controls
 * - ViewToggle for Table/Card view switching
 * - FindingsTable for table data display
 * - FindingsCardGrid for card data display
 * - Data fetching with React state management
 * - Validation with undo support
 * - Inline editing
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { FindingSearch, EmptySearchResults } from './FindingSearch'
import { FindingFilters } from './FindingFilters'
import { FindingsTable } from './FindingsTable'
import { FindingsCardGrid } from './FindingsCardGrid'
import { InlineEdit } from './InlineEdit'
import { useUndoValidation, type UndoState } from './useUndoValidation'
import { ViewToggle, useViewPreference, type ViewMode } from '../shared'
import { getFindings, validateFinding, updateFinding, searchFindings } from '@/lib/api/findings'
import type {
  Finding,
  FindingFilters as FilterType,
  FindingsResponse,
  SearchResponse,
  FindingWithSimilarity,
  FindingStatus,
} from '@/lib/types/findings'

interface FindingsBrowserProps {
  projectId: string
  documents: { id: string; name: string }[]
}

const DEFAULT_FILTERS: FilterType = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  limit: 50,
}

export function FindingsBrowser({ projectId, documents }: FindingsBrowserProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Initialize search query from URL
  const initialSearchQuery = searchParams.get('q') || ''

  // View mode state with localStorage persistence
  const [viewMode, setViewMode] = useViewPreference('table')

  // State
  const [filters, setFilters] = useState<FilterType>(DEFAULT_FILTERS)
  const [data, setData] = useState<FindingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // Edit state
  const [editingFindingId, setEditingFindingId] = useState<string | null>(null)
  const [editingFinding, setEditingFinding] = useState<Finding | null>(null)

  // Determine if we're in search mode
  const isSearchMode = searchQuery.trim().length > 0 && searchResults !== null

  // Undo handler
  const handleUndo = useCallback(
    async (undoState: UndoState) => {
      try {
        // Revert to previous state via API
        await updateFinding(projectId, undoState.findingId, {
          status: undoState.previousStatus,
          confidence: undoState.previousConfidence ?? undefined,
          ...(undoState.previousText !== undefined ? { text: undoState.previousText } : {}),
        })

        // Update local state
        const revertFinding = (f: Finding): Finding =>
          f.id === undoState.findingId
            ? {
                ...f,
                status: undoState.previousStatus,
                confidence: undoState.previousConfidence,
                ...(undoState.previousText !== undefined ? { text: undoState.previousText } : {}),
              }
            : f

        if (isSearchMode && searchResults) {
          setSearchResults((prev) =>
            prev
              ? {
                  ...prev,
                  findings: prev.findings.map((f) => revertFinding(f) as FindingWithSimilarity),
                }
              : prev
          )
        } else {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  findings: prev.findings.map(revertFinding),
                }
              : prev
          )
        }

        toast.success('Action undone')
      } catch (err) {
        console.error('Undo failed:', err)
        toast.error('Failed to undo action')
        throw err
      }
    },
    [projectId, isSearchMode, searchResults]
  )

  // Use undo hook
  const { saveUndoState, performUndo, clearUndo } = useUndoValidation({
    timeout: 5000, // 5 seconds
    onUndo: handleUndo,
  })

  // Update URL when search query changes
  const updateSearchUrl = useCallback(
    (query: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (query.trim()) {
        params.set('q', query)
      } else {
        params.delete('q')
      }
      const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
      router.replace(newUrl, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  // Fetch findings when filters change (non-search mode)
  const fetchFindings = useCallback(async () => {
    if (isSearchMode) return // Don't fetch if in search mode

    setIsLoading(true)
    setError(null)

    try {
      const response = await getFindings(projectId, filters)
      setData(response)
    } catch (err) {
      console.error('Error fetching findings:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch findings')
      toast.error('Failed to load findings')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, filters, isSearchMode])

  // Perform search
  const performSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults(null)
        return
      }

      setIsSearching(true)
      setError(null)

      try {
        // Build search filters from current filters
        const searchFilters = {
          documentId: filters.documentId,
          domain: filters.domain,
          status: filters.status,
          confidenceMin: filters.confidenceMin,
          confidenceMax: filters.confidenceMax,
        }

        const response = await searchFindings(projectId, query, searchFilters)
        setSearchResults(response)
        updateSearchUrl(query)
      } catch (err) {
        console.error('Search error:', err)
        setError(err instanceof Error ? err.message : 'Search failed')
        toast.error('Search failed. Please try again.')
      } finally {
        setIsSearching(false)
      }
    },
    [projectId, filters, updateSearchUrl]
  )

  // Initial fetch and refetch on filter change
  useEffect(() => {
    if (!isSearchMode) {
      fetchFindings()
    }
  }, [fetchFindings, isSearchMode])

  // Handle initial search from URL
  useEffect(() => {
    if (initialSearchQuery && !searchResults) {
      performSearch(initialSearchQuery)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle search query change
  const handleSearchQueryChange = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  // Handle search execution
  const handleSearch = useCallback(
    (query: string) => {
      performSearch(query)
    },
    [performSearch]
  )

  // Handle search clear
  const handleClearSearch = useCallback(() => {
    setSearchQuery('')
    setSearchResults(null)
    updateSearchUrl('')
    // Refetch normal findings
    fetchFindings()
  }, [fetchFindings, updateSearchUrl])

  // Handle filter changes
  const handleFiltersChange = useCallback(
    (newFilters: FilterType) => {
      setFilters(newFilters)
      // If in search mode, re-run search with new filters
      if (searchQuery.trim()) {
        // Debounce handled by search component, just update filters
        // Search will re-run when user triggers it
      }
    },
    [searchQuery]
  )

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }))
  }, [])

  // Handle sort change
  const handleSortChange = useCallback((sortBy: string, sortOrder: 'asc' | 'desc') => {
    setFilters((prev) => ({
      ...prev,
      sortBy: sortBy as FilterType['sortBy'],
      sortOrder,
      page: 1,
    }))
  }, [])

  // Get finding by ID from current data
  const getFindingById = useCallback(
    (findingId: string): Finding | undefined => {
      if (isSearchMode && searchResults) {
        return searchResults.findings.find((f) => f.id === findingId)
      }
      return data?.findings.find((f) => f.id === findingId)
    },
    [isSearchMode, searchResults, data]
  )

  // Handle validation action with optimistic update and undo
  const handleValidate = useCallback(
    async (findingId: string, action: 'confirm' | 'reject') => {
      // Clear any existing undo state (new action performed)
      clearUndo()

      const finding = getFindingById(findingId)
      if (!finding) {
        toast.error('Finding not found')
        return
      }

      const previousStatus = finding.status
      const previousConfidence = finding.confidence
      const newStatus: FindingStatus = action === 'confirm' ? 'validated' : 'rejected'
      const newConfidence =
        action === 'confirm' ? Math.min(1, (finding.confidence || 0.5) + 0.05) : finding.confidence

      // Optimistic update
      const updateFindingOptimistic = (f: Finding): Finding =>
        f.id === findingId ? { ...f, status: newStatus, confidence: newConfidence } : f

      if (isSearchMode && searchResults) {
        setSearchResults((prev) =>
          prev
            ? {
                ...prev,
                findings: prev.findings.map(
                  (f) => updateFindingOptimistic(f) as FindingWithSimilarity
                ),
              }
            : prev
        )
      } else {
        setData((prev) =>
          prev
            ? {
                ...prev,
                findings: prev.findings.map(updateFindingOptimistic),
              }
            : prev
        )
      }

      try {
        await validateFinding(projectId, findingId, action)

        // Save undo state after successful API call
        saveUndoState(
          { ...finding, status: previousStatus, confidence: previousConfidence },
          action === 'confirm' ? 'validate' : 'reject'
        )

        // Show success toast with undo option
        toast.success(action === 'confirm' ? 'Finding validated' : 'Finding rejected', {
          action: {
            label: 'Undo',
            onClick: () => performUndo(),
          },
          duration: 5000,
        })
      } catch (err) {
        console.error('Validation error:', err)
        toast.error('Failed to update finding')

        // Revert optimistic update on error
        const revertFinding = (f: Finding): Finding =>
          f.id === findingId ? { ...f, status: previousStatus, confidence: previousConfidence } : f

        if (isSearchMode && searchResults) {
          setSearchResults((prev) =>
            prev
              ? {
                  ...prev,
                  findings: prev.findings.map((f) => revertFinding(f) as FindingWithSimilarity),
                }
              : prev
          )
        } else {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  findings: prev.findings.map(revertFinding),
                }
              : prev
          )
        }
      }
    },
    [
      projectId,
      getFindingById,
      isSearchMode,
      searchResults,
      saveUndoState,
      performUndo,
      clearUndo,
    ]
  )

  // Handle edit action - open inline edit mode
  const handleEdit = useCallback((finding: Finding) => {
    setEditingFindingId(finding.id)
    setEditingFinding(finding)
  }, [])

  // Handle save edit
  const handleSaveEdit = useCallback(
    async (newText: string) => {
      if (!editingFinding) return

      const previousText = editingFinding.text

      // Optimistic update
      const updateFindingText = (f: Finding): Finding =>
        f.id === editingFinding.id ? { ...f, text: newText } : f

      if (isSearchMode && searchResults) {
        setSearchResults((prev) =>
          prev
            ? {
                ...prev,
                findings: prev.findings.map((f) => updateFindingText(f) as FindingWithSimilarity),
              }
            : prev
        )
      } else {
        setData((prev) =>
          prev
            ? {
                ...prev,
                findings: prev.findings.map(updateFindingText),
              }
            : prev
        )
      }

      try {
        await updateFinding(projectId, editingFinding.id, { text: newText })

        // Save undo state
        saveUndoState(editingFinding, 'edit', previousText)

        // Close edit mode
        setEditingFindingId(null)
        setEditingFinding(null)

        // Show success toast with undo option
        toast.success('Finding updated', {
          action: {
            label: 'Undo',
            onClick: () => performUndo(),
          },
          duration: 5000,
        })
      } catch (err) {
        console.error('Edit error:', err)
        toast.error('Failed to update finding')

        // Revert optimistic update
        const revertFinding = (f: Finding): Finding =>
          f.id === editingFinding.id ? { ...f, text: previousText } : f

        if (isSearchMode && searchResults) {
          setSearchResults((prev) =>
            prev
              ? {
                  ...prev,
                  findings: prev.findings.map((f) => revertFinding(f) as FindingWithSimilarity),
                }
              : prev
          )
        } else {
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  findings: prev.findings.map(revertFinding),
                }
              : prev
          )
        }

        throw err // Re-throw to let InlineEdit handle the error
      }
    },
    [projectId, editingFinding, isSearchMode, searchResults, saveUndoState, performUndo]
  )

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setEditingFindingId(null)
    setEditingFinding(null)
  }, [])

  // Determine which data to display
  const displayFindings: Finding[] = isSearchMode
    ? searchResults?.findings || []
    : data?.findings || []

  const displayTotal = isSearchMode ? searchResults?.total || 0 : data?.total || 0

  // Calculate pagination (only for non-search mode)
  const totalPages = isSearchMode ? 1 : data ? Math.ceil(data.total / (filters.limit || 50)) : 1

  // Show empty search results
  const showEmptySearchResults = isSearchMode && !isSearching && displayFindings.length === 0

  return (
    <div className="space-y-6 p-6">
      {/* Search */}
      <FindingSearch
        value={searchQuery}
        onChange={handleSearchQueryChange}
        onSearch={handleSearch}
        onClear={handleClearSearch}
        isSearching={isSearching}
        resultCount={isSearchMode ? searchResults?.total : undefined}
        searchTime={isSearchMode ? searchResults?.searchTime : undefined}
      />

      {/* Filters and View Toggle Row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <FindingFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          documents={documents}
          isLoading={isLoading || isSearching}
          totalCount={isSearchMode ? searchResults?.total || 0 : data?.total || 0}
          filteredCount={displayFindings.length}
          isSearchMode={isSearchMode}
          onClearAll={isSearchMode ? handleClearSearch : undefined}
        />

        {/* View Toggle */}
        <ViewToggle
          value={viewMode}
          onChange={setViewMode}
          className="flex-shrink-0"
        />
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Inline Edit Panel - only shown in table view */}
      {viewMode === 'table' && editingFinding && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="mb-2 text-sm font-medium">Editing Finding</div>
          <InlineEdit
            value={editingFinding.text}
            onSave={handleSaveEdit}
            onCancel={handleCancelEdit}
            isEditing={true}
          />
        </div>
      )}

      {/* Empty search results */}
      {showEmptySearchResults && (
        <EmptySearchResults query={searchQuery} onClear={handleClearSearch} />
      )}

      {/* Content View - Table or Cards */}
      {!showEmptySearchResults && (
        <>
          {viewMode === 'table' ? (
            <FindingsTable
              findings={displayFindings}
              isLoading={isLoading || isSearching}
              page={isSearchMode ? 1 : filters.page || 1}
              totalPages={totalPages}
              total={displayTotal}
              sortBy={filters.sortBy}
              sortOrder={filters.sortOrder}
              onPageChange={handlePageChange}
              onSortChange={handleSortChange}
              onValidate={handleValidate}
              onEdit={handleEdit}
              showSimilarity={isSearchMode}
              projectId={projectId}
            />
          ) : (
            <FindingsCardGrid
              findings={displayFindings}
              isLoading={isLoading || isSearching}
              page={isSearchMode ? 1 : filters.page || 1}
              totalPages={totalPages}
              total={displayTotal}
              onPageChange={handlePageChange}
              onValidate={handleValidate}
              onEdit={handleEdit}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={handleCancelEdit}
              editingFindingId={editingFindingId}
              showSimilarity={isSearchMode}
              projectId={projectId}
            />
          )}
        </>
      )}
    </div>
  )
}
