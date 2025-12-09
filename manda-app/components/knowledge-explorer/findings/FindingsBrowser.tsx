/**
 * FindingsBrowser Component
 * Container for the Findings tab in Knowledge Explorer
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #2, #4, #5)
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #4, #5, #8)
 * Story: E4.3 - Implement Inline Finding Validation (AC: #1, #2, #3, #4, #8)
 * Story: E4.4 - Build Card View Alternative for Findings (AC: #2, #3, #4, #5, #6)
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: #1, #7, #8)
 * Story: E4.10 - Implement Export Findings to CSV/Excel (AC: #1, #4, #5)
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: #1-11)
 * Story: E8.5 - Finding → Q&A Quick-Add (AC: #1-7)
 *
 * Combines:
 * - FindingSearch for semantic search
 * - FindingFilters for filtering controls
 * - ViewToggle for Table/Card view switching
 * - ExportDropdown for CSV/Excel export
 * - FindingsTable for table data display
 * - FindingsCardGrid for card data display
 * - FindingDetailPanel for slide-out detail view
 * - Data fetching with React state management
 * - Validation with undo support
 * - Inline editing
 * - Bulk selection and actions (E4.11)
 */

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { FindingSearch, EmptySearchResults } from './FindingSearch'
import { FindingFilters } from './FindingFilters'
import { FindingsTable } from './FindingsTable'
import { FindingsCardGrid } from './FindingsCardGrid'
import { FindingDetailPanel } from './FindingDetailPanel'
import { ExportModal } from './ExportModal'
import { InlineEdit } from './InlineEdit'
import { useUndoValidation, type UndoState } from './useUndoValidation'
import { ViewToggle, useViewPreference, type ViewMode } from '../shared'
// E4.11: Bulk action imports
import { useSelectionState } from './useSelectionState'
import { SelectionToolbar } from './SelectionToolbar'
import { BulkConfirmDialog, type BulkAction } from './BulkConfirmDialog'
import { useBulkUndo } from './useBulkUndo'
import { UndoToast } from './UndoToast'
import { getFindings, validateFinding, updateFinding, searchFindings, batchValidateFindings } from '@/lib/api/findings'
import type { ExportFilters, BatchActionResponse } from '@/lib/api/findings'
// E8.5: Q&A quick-add imports
import { AddToQAModal } from './AddToQAModal'
import { checkQAExistenceForFindings } from '@/lib/api/qa'
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
  /** Callback to register refresh function for realtime updates (E4.13) */
  onRegisterRefresh?: (refresh: () => void) => void
}

const DEFAULT_FILTERS: FilterType = {
  sortBy: 'createdAt',
  sortOrder: 'desc',
  page: 1,
  limit: 50,
}

export function FindingsBrowser({ projectId, documents, onRegisterRefresh }: FindingsBrowserProps) {
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

  // Detail panel state - read from URL parameter for deep linking
  const [selectedFindingId, setSelectedFindingId] = useState<string | null>(
    searchParams.get('findingId')
  )
  const isDetailPanelOpen = selectedFindingId !== null

  // Determine if we're in search mode
  const isSearchMode = searchQuery.trim().length > 0 && searchResults !== null

  // E4.11: Bulk selection state
  const {
    selectedIds,
    selectedIdsArray,
    isSelected,
    toggle: toggleSelection,
    selectAll,
    clearAll: clearSelection,
    count: selectionCount,
    areAllSelected,
    areSomeSelected,
  } = useSelectionState()

  // E4.11: Bulk action confirmation dialog state
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkAction, setBulkAction] = useState<BulkAction>('validate')
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)

  // E4.12: Export modal state
  const [exportModalOpen, setExportModalOpen] = useState(false)

  // E8.5: Q&A quick-add state
  const [qaModalOpen, setQaModalOpen] = useState(false)
  const [qaModalFinding, setQaModalFinding] = useState<Finding | null>(null)
  const [qaItemIdMap, setQaItemIdMap] = useState<Record<string, string | null>>({}) // findingId -> qaItemId

  // Memoize export filters to avoid recreating object on each render
  const exportFilters: ExportFilters = useMemo(() => ({
    documentId: filters.documentId,
    domain: filters.domain,
    findingType: filters.findingType,
    status: filters.status,
    confidenceMin: filters.confidenceMin,
    confidenceMax: filters.confidenceMax,
  }), [
    filters.documentId,
    filters.domain,
    filters.findingType,
    filters.status,
    filters.confidenceMin,
    filters.confidenceMax,
  ])

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

  // E4.11: Bulk undo hook
  const {
    undoState: bulkUndoState,
    canUndo: canBulkUndo,
    remainingTime: bulkUndoRemainingTime,
    isUndoing: isBulkUndoing,
    saveUndoState: saveBulkUndoState,
    performUndo: performBulkUndo,
    clearUndo: clearBulkUndo,
  } = useBulkUndo({
    projectId,
    onUndoComplete: (result) => {
      toast.success(`Undo complete: ${result.summary.succeeded} findings reverted`)
      // Refresh data after undo
      fetchFindings()
    },
    onUndoError: (error) => {
      toast.error(`Undo failed: ${error.message}`)
    },
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

  // E4.13: Register refresh function for realtime updates
  useEffect(() => {
    if (onRegisterRefresh) {
      onRegisterRefresh(fetchFindings)
    }
  }, [onRegisterRefresh, fetchFindings])

  // Handle initial search from URL
  useEffect(() => {
    if (initialSearchQuery && !searchResults) {
      performSearch(initialSearchQuery)
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // E8.5: Handle Add to Q&A button click
  const handleAddToQA = useCallback((finding: Finding) => {
    setQaModalFinding(finding)
    setQaModalOpen(true)
  }, [])

  // E8.5: Handle Q&A item created successfully
  const handleQACreated = useCallback(
    (qaItemId: string) => {
      if (qaModalFinding) {
        // Update the map to show indicator instead of button
        setQaItemIdMap((prev) => ({
          ...prev,
          [qaModalFinding.id]: qaItemId,
        }))
      }
      setQaModalOpen(false)
      setQaModalFinding(null)
    },
    [qaModalFinding]
  )

  // E8.5: Handle Q&A modal close
  const handleQAModalClose = useCallback(() => {
    setQaModalOpen(false)
    setQaModalFinding(null)
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

  // E4.11: Handle selection change for individual finding
  const handleSelectionChange = useCallback(
    (id: string, selected: boolean) => {
      if (selected) {
        selectAll([id])
      } else {
        toggleSelection(id)
      }
    },
    [selectAll, toggleSelection]
  )

  // E4.11: Handle select all on current page
  const handleSelectAllOnPage = useCallback(
    (ids: string[]) => {
      selectAll(ids)
    },
    [selectAll]
  )

  // E4.11: Open bulk action dialog
  const handleOpenBulkDialog = useCallback((action: BulkAction) => {
    setBulkAction(action)
    setBulkDialogOpen(true)
  }, [])

  // E4.11: Close bulk action dialog
  const handleCloseBulkDialog = useCallback(() => {
    setBulkDialogOpen(false)
  }, [])

  // E4.11: Execute bulk action
  const handleBulkAction = useCallback(async () => {
    if (selectedIdsArray.length === 0) return

    setIsBulkProcessing(true)
    const action = bulkAction === 'validate' ? 'confirm' : 'reject'

    // Get the findings from current data (use data/searchResults directly to avoid dependency)
    const currentFindings: Finding[] = isSearchMode
      ? searchResults?.findings || []
      : data?.findings || []
    const affectedFindings = currentFindings.filter((f) => selectedIds.has(f.id))

    try {
      const result = await batchValidateFindings(projectId, action, selectedIdsArray)

      // Save undo state for bulk action
      saveBulkUndoState(affectedFindings, bulkAction)

      // Close dialog and clear selection
      setBulkDialogOpen(false)
      clearSelection()

      // Show success toast
      const successCount = result.summary.succeeded
      const failedCount = result.summary.failed
      const successMsg = `${successCount} finding${successCount === 1 ? '' : 's'} ${bulkAction}d`
      const failedMsg = failedCount > 0 ? ` (${failedCount} failed)` : ''

      toast.success(successMsg + failedMsg)

      // Refresh data to show updated findings
      if (isSearchMode && searchQuery) {
        performSearch(searchQuery)
      } else {
        fetchFindings()
      }
    } catch (error) {
      console.error('Bulk action failed:', error)
      toast.error(error instanceof Error ? error.message : 'Bulk action failed')
    } finally {
      setIsBulkProcessing(false)
    }
  }, [
    selectedIdsArray,
    selectedIds,
    bulkAction,
    data,
    searchResults,
    isSearchMode,
    projectId,
    saveBulkUndoState,
    clearSelection,
    searchQuery,
    performSearch,
    fetchFindings,
  ])

  // Handle opening detail panel with URL update for deep linking
  const handleOpenDetailPanel = useCallback(
    (finding: Finding) => {
      setSelectedFindingId(finding.id)
      // Update URL for deep linking
      const params = new URLSearchParams(searchParams.toString())
      params.set('findingId', finding.id)
      const newUrl = `${pathname}?${params.toString()}`
      router.replace(newUrl, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  // Handle closing detail panel
  const handleCloseDetailPanel = useCallback(() => {
    setSelectedFindingId(null)
    // Remove findingId from URL
    const params = new URLSearchParams(searchParams.toString())
    params.delete('findingId')
    const newUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname
    router.replace(newUrl, { scroll: false })
  }, [pathname, router, searchParams])

  // Handle finding updated from detail panel - update local state
  const handleFindingUpdated = useCallback(
    (updatedFinding: Finding) => {
      const updateFn = (f: Finding): Finding =>
        f.id === updatedFinding.id ? updatedFinding : f

      if (isSearchMode && searchResults) {
        setSearchResults((prev) =>
          prev
            ? {
                ...prev,
                findings: prev.findings.map((f) => updateFn(f) as FindingWithSimilarity),
              }
            : prev
        )
      } else {
        setData((prev) =>
          prev
            ? {
                ...prev,
                findings: prev.findings.map(updateFn),
              }
            : prev
        )
      }
    },
    [isSearchMode, searchResults]
  )

  // Sync URL findingId changes back to state (e.g., browser back/forward)
  useEffect(() => {
    const urlFindingId = searchParams.get('findingId')
    if (urlFindingId !== selectedFindingId) {
      setSelectedFindingId(urlFindingId)
    }
  }, [searchParams, selectedFindingId])

  // Determine which data to display
  const displayFindings: Finding[] = isSearchMode
    ? searchResults?.findings || []
    : data?.findings || []

  const displayTotal = isSearchMode ? searchResults?.total || 0 : data?.total || 0

  // E8.5: Fetch Q&A existence for current findings when data changes
  // Get array of finding IDs for comparison
  const displayFindingIds = useMemo(
    () => displayFindings.map((f) => f.id),
    [displayFindings]
  )

  useEffect(() => {
    if (displayFindingIds.length === 0) {
      setQaItemIdMap({})
      return
    }

    // Batch check Q&A existence
    checkQAExistenceForFindings(projectId, displayFindingIds)
      .then((response) => {
        setQaItemIdMap(response.results)
      })
      .catch((error) => {
        console.error('[FindingsBrowser] Error checking Q&A existence:', error)
        // On error, assume no Q&A items exist
        setQaItemIdMap({})
      })
  }, [projectId, displayFindingIds])

  // E4.11: Calculate if all/some on page are selected
  const pageIds = displayFindings.map((f) => f.id)
  const isAllOnPageSelected = areAllSelected(pageIds)
  const isSomeOnPageSelected = areSomeSelected(pageIds)

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

        {/* View Toggle and Export */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setExportModalOpen(true)}
            disabled={isLoading || isSearching || displayTotal === 0}
            className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
            aria-label={displayTotal === 0 ? 'No findings to export' : `Export ${displayTotal} findings`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Export
          </button>
          <ViewToggle
            value={viewMode}
            onChange={setViewMode}
          />
        </div>
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
              onRowClick={handleOpenDetailPanel}
              showSimilarity={isSearchMode}
              projectId={projectId}
              // E4.11: Selection props
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              onSelectAll={handleSelectAllOnPage}
              isAllSelected={isAllOnPageSelected}
              isSomeSelected={isSomeOnPageSelected}
              // E8.5: Q&A quick-add props
              qaItemIdMap={qaItemIdMap}
              onAddToQA={handleAddToQA}
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
              onCardClick={handleOpenDetailPanel}
              editingFindingId={editingFindingId}
              showSimilarity={isSearchMode}
              projectId={projectId}
              // E4.11: Selection props
              selectedIds={selectedIds}
              onSelectionChange={handleSelectionChange}
              // E8.5: Q&A quick-add props
              qaItemIdMap={qaItemIdMap}
              onAddToQA={handleAddToQA}
            />
          )}
        </>
      )}

      {/* Finding Detail Panel */}
      <FindingDetailPanel
        findingId={selectedFindingId}
        projectId={projectId}
        isOpen={isDetailPanelOpen}
        onClose={handleCloseDetailPanel}
        onFindingUpdated={handleFindingUpdated}
      />

      {/* E4.11: Selection Toolbar (floating) */}
      <SelectionToolbar
        selectedCount={selectionCount}
        onClearSelection={clearSelection}
        onBulkValidate={() => handleOpenBulkDialog('validate')}
        onBulkReject={() => handleOpenBulkDialog('reject')}
        isProcessing={isBulkProcessing}
      />

      {/* E4.11: Bulk Confirmation Dialog */}
      <BulkConfirmDialog
        isOpen={bulkDialogOpen}
        action={bulkAction}
        count={selectionCount}
        isProcessing={isBulkProcessing}
        onConfirm={handleBulkAction}
        onCancel={handleCloseBulkDialog}
      />

      {/* E4.11: Undo Toast (appears after bulk action) */}
      {canBulkUndo && bulkUndoState && (
        <UndoToast
          action={bulkUndoState.action}
          count={bulkUndoState.findingIds.length}
          remainingTime={bulkUndoRemainingTime}
          isUndoing={isBulkUndoing}
          onUndo={performBulkUndo}
          onDismiss={clearBulkUndo}
        />
      )}

      {/* E4.12: Export Modal */}
      <ExportModal
        isOpen={exportModalOpen}
        onOpenChange={setExportModalOpen}
        projectId={projectId}
        filters={exportFilters}
        findingCount={data?.total || 0}
        filteredCount={displayTotal}
        selectedIds={selectedIds}
        searchQuery={isSearchMode ? searchQuery : undefined}
      />

      {/* E8.5: Add to Q&A Modal */}
      {qaModalFinding && (
        <AddToQAModal
          finding={qaModalFinding}
          projectId={projectId}
          isOpen={qaModalOpen}
          onClose={handleQAModalClose}
          onSuccess={handleQACreated}
        />
      )}
    </div>
  )
}
