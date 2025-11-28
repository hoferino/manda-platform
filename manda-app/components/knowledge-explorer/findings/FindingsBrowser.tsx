/**
 * FindingsBrowser Component
 * Container for the Findings tab in Knowledge Explorer
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #2, #4, #5)
 * Story: E4.2 - Implement Semantic Search for Findings (AC: #4, #5, #8)
 *
 * Combines:
 * - FindingSearch for semantic search
 * - FindingFilters for filtering controls
 * - FindingsTable for data display
 * - Data fetching with React state management
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { FindingSearch, EmptySearchResults } from './FindingSearch'
import { FindingFilters } from './FindingFilters'
import { FindingsTable } from './FindingsTable'
import { getFindings, validateFinding, searchFindings } from '@/lib/api/findings'
import type {
  Finding,
  FindingFilters as FilterType,
  FindingsResponse,
  SearchResponse,
  FindingWithSimilarity,
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

  // State
  const [filters, setFilters] = useState<FilterType>(DEFAULT_FILTERS)
  const [data, setData] = useState<FindingsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Search state
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery)
  const [searchResults, setSearchResults] = useState<SearchResponse | null>(null)
  const [isSearching, setIsSearching] = useState(false)

  // Determine if we're in search mode
  const isSearchMode = searchQuery.trim().length > 0 && searchResults !== null

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

  // Handle validation action
  const handleValidate = useCallback(
    async (findingId: string, action: 'confirm' | 'reject') => {
      try {
        await validateFinding(projectId, findingId, action)

        const newStatus = action === 'confirm' ? 'validated' : 'rejected'

        // Optimistic update for both search results and regular data
        if (isSearchMode && searchResults) {
          setSearchResults((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              findings: prev.findings.map((f) =>
                f.id === findingId ? { ...f, status: newStatus } : f
              ) as FindingWithSimilarity[],
            }
          })
        } else {
          setData((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              findings: prev.findings.map((f) =>
                f.id === findingId ? { ...f, status: newStatus } : f
              ) as Finding[],
            }
          })
        }

        toast.success(action === 'confirm' ? 'Finding validated' : 'Finding rejected')
      } catch (err) {
        console.error('Validation error:', err)
        toast.error('Failed to update finding')
        // Refetch to restore correct state
        if (isSearchMode) {
          performSearch(searchQuery)
        } else {
          fetchFindings()
        }
      }
    },
    [projectId, fetchFindings, isSearchMode, searchResults, searchQuery, performSearch]
  )

  // Handle edit action (placeholder for E4.3)
  const handleEdit = useCallback((finding: Finding) => {
    toast.info('Edit functionality coming in E4.3')
  }, [])

  // Determine which data to display
  const displayFindings: Finding[] = isSearchMode
    ? (searchResults?.findings || [])
    : (data?.findings || [])

  const displayTotal = isSearchMode
    ? (searchResults?.total || 0)
    : (data?.total || 0)

  // Calculate pagination (only for non-search mode)
  const totalPages = isSearchMode ? 1 : (data ? Math.ceil(data.total / (filters.limit || 50)) : 1)

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

      {/* Filters */}
      <FindingFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        documents={documents}
        isLoading={isLoading || isSearching}
        totalCount={isSearchMode ? (searchResults?.total || 0) : (data?.total || 0)}
        filteredCount={displayFindings.length}
        isSearchMode={isSearchMode}
        onClearAll={isSearchMode ? handleClearSearch : undefined}
      />

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Empty search results */}
      {showEmptySearchResults && (
        <EmptySearchResults query={searchQuery} onClear={handleClearSearch} />
      )}

      {/* Table */}
      {!showEmptySearchResults && (
        <FindingsTable
          findings={displayFindings}
          isLoading={isLoading || isSearching}
          page={isSearchMode ? 1 : (filters.page || 1)}
          totalPages={totalPages}
          total={displayTotal}
          sortBy={filters.sortBy}
          sortOrder={filters.sortOrder}
          onPageChange={handlePageChange}
          onSortChange={handleSortChange}
          onValidate={handleValidate}
          onEdit={handleEdit}
          showSimilarity={isSearchMode}
        />
      )}
    </div>
  )
}
