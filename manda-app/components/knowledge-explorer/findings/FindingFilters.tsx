/**
 * FindingFilters Component
 * Filter controls for the Findings Browser
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #4)
 *
 * Features:
 * - Filter by document
 * - Filter by domain (multi-select)
 * - Filter by confidence range
 * - Filter by status
 * - Active filter badges with remove
 * - Clear all filters button
 */

'use client'

import { useCallback } from 'react'
import { X, Filter, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  FINDING_DOMAINS,
  FINDING_STATUSES,
  type FindingDomain,
  type FindingStatus,
  type FindingFilters as FilterType,
} from '@/lib/types/findings'

interface Document {
  id: string
  name: string
}

interface FindingFiltersProps {
  filters: FilterType
  onFiltersChange: (filters: FilterType) => void
  documents: Document[]
  isLoading?: boolean
  totalCount?: number
  filteredCount?: number
  isSearchMode?: boolean
  onClearAll?: () => void
}

const CONFIDENCE_PRESETS = [
  { label: 'All', value: null },
  { label: 'High (>80%)', min: 0.8, max: 1 },
  { label: 'Medium (60-80%)', min: 0.6, max: 0.8 },
  { label: 'Low (<60%)', min: 0, max: 0.6 },
]

export function FindingFilters({
  filters,
  onFiltersChange,
  documents,
  isLoading = false,
  totalCount = 0,
  filteredCount = 0,
  isSearchMode = false,
  onClearAll: externalClearAll,
}: FindingFiltersProps) {
  // Handle domain filter changes
  const handleDomainChange = useCallback(
    (domain: FindingDomain, checked: boolean) => {
      const currentDomains = filters.domain || []
      const newDomains = checked
        ? [...currentDomains, domain]
        : currentDomains.filter((d) => d !== domain)
      onFiltersChange({
        ...filters,
        domain: newDomains.length > 0 ? newDomains : undefined,
        page: 1,
      })
    },
    [filters, onFiltersChange]
  )

  // Handle status filter changes
  const handleStatusChange = useCallback(
    (status: FindingStatus, checked: boolean) => {
      const currentStatuses = filters.status || []
      const newStatuses = checked
        ? [...currentStatuses, status]
        : currentStatuses.filter((s) => s !== status)
      onFiltersChange({
        ...filters,
        status: newStatuses.length > 0 ? newStatuses : undefined,
        page: 1,
      })
    },
    [filters, onFiltersChange]
  )

  // Handle document filter change
  const handleDocumentChange = useCallback(
    (documentId: string) => {
      onFiltersChange({
        ...filters,
        documentId: documentId === 'all' ? undefined : documentId,
        page: 1,
      })
    },
    [filters, onFiltersChange]
  )

  // Handle confidence preset change
  const handleConfidencePresetChange = useCallback(
    (preset: (typeof CONFIDENCE_PRESETS)[number]) => {
      onFiltersChange({
        ...filters,
        confidenceMin: preset.min ?? undefined,
        confidenceMax: preset.max ?? undefined,
        page: 1,
      })
    },
    [filters, onFiltersChange]
  )

  // Clear all filters
  const handleClearAll = useCallback(() => {
    // If in search mode and external clear handler provided, use it
    if (isSearchMode && externalClearAll) {
      externalClearAll()
    } else {
      onFiltersChange({
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        limit: filters.limit,
        page: 1,
      })
    }
  }, [filters.sortBy, filters.sortOrder, filters.limit, onFiltersChange, isSearchMode, externalClearAll])

  // Remove individual filter
  const removeFilter = useCallback(
    (type: 'document' | 'domain' | 'status' | 'confidence', value?: string) => {
      const newFilters = { ...filters, page: 1 }

      switch (type) {
        case 'document':
          newFilters.documentId = undefined
          break
        case 'domain':
          if (value) {
            newFilters.domain = filters.domain?.filter((d) => d !== value)
            if (newFilters.domain?.length === 0) newFilters.domain = undefined
          }
          break
        case 'status':
          if (value) {
            newFilters.status = filters.status?.filter((s) => s !== value)
            if (newFilters.status?.length === 0) newFilters.status = undefined
          }
          break
        case 'confidence':
          newFilters.confidenceMin = undefined
          newFilters.confidenceMax = undefined
          break
      }

      onFiltersChange(newFilters)
    },
    [filters, onFiltersChange]
  )

  // Calculate active filters
  const hasActiveFilters =
    filters.documentId ||
    (filters.domain && filters.domain.length > 0) ||
    (filters.status && filters.status.length > 0) ||
    filters.confidenceMin !== undefined ||
    filters.confidenceMax !== undefined

  // Get current confidence preset label
  const getCurrentConfidenceLabel = () => {
    if (filters.confidenceMin === undefined && filters.confidenceMax === undefined) {
      return 'All'
    }
    const preset = CONFIDENCE_PRESETS.find(
      (p) => p.min === filters.confidenceMin && p.max === filters.confidenceMax
    )
    return preset?.label || 'Custom'
  }

  return (
    <div className="space-y-4">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span>
            Showing {filteredCount} of {totalCount} findings
          </span>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="h-8 px-2 text-xs"
          >
            Clear all filters
          </Button>
        )}
      </div>

      {/* Active Filter Badges */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2" role="list" aria-label="Active filters">
          {filters.documentId && (
            <Badge
              variant="secondary"
              className="gap-1 pr-1"
              role="listitem"
            >
              Document: {documents.find((d) => d.id === filters.documentId)?.name || 'Unknown'}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('document')}
                aria-label="Remove document filter"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}

          {filters.domain?.map((domain) => (
            <Badge
              key={domain}
              variant="secondary"
              className="gap-1 pr-1"
              role="listitem"
            >
              {FINDING_DOMAINS.find((d) => d.value === domain)?.label || domain}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('domain', domain)}
                aria-label={`Remove ${domain} filter`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {filters.status?.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="gap-1 pr-1"
              role="listitem"
            >
              {FINDING_STATUSES.find((s) => s.value === status)?.label || status}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('status', status)}
                aria-label={`Remove ${status} filter`}
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}

          {(filters.confidenceMin !== undefined || filters.confidenceMax !== undefined) && (
            <Badge
              variant="secondary"
              className="gap-1 pr-1"
              role="listitem"
            >
              Confidence: {getCurrentConfidenceLabel()}
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-transparent"
                onClick={() => removeFilter('confidence')}
                aria-label="Remove confidence filter"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}

      {/* Filter Controls */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Document Filter */}
        <div className="space-y-2">
          <Label htmlFor="document-filter" className="text-sm font-medium">
            Document
          </Label>
          <Select
            value={filters.documentId || 'all'}
            onValueChange={handleDocumentChange}
            disabled={isLoading}
          >
            <SelectTrigger id="document-filter" className="w-full">
              <SelectValue placeholder="All documents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All documents</SelectItem>
              {documents.map((doc) => (
                <SelectItem key={doc.id} value={doc.id}>
                  {doc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Confidence Filter */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Confidence</Label>
          <Select
            value={getCurrentConfidenceLabel()}
            onValueChange={(label) => {
              const preset = CONFIDENCE_PRESETS.find((p) => p.label === label)
              if (preset) handleConfidencePresetChange(preset)
            }}
            disabled={isLoading}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONFIDENCE_PRESETS.map((preset) => (
                <SelectItem key={preset.label} value={preset.label}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Domain Filter */}
        <Collapsible className="space-y-2">
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled={isLoading}
            >
              <span className="text-sm font-medium">
                Domain {filters.domain && filters.domain.length > 0 && `(${filters.domain.length})`}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {FINDING_DOMAINS.map(({ value, label }) => (
              <div key={value} className="flex items-center space-x-2">
                <Checkbox
                  id={`domain-${value}`}
                  checked={filters.domain?.includes(value) || false}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    handleDomainChange(value, checked === true)
                  }
                  disabled={isLoading}
                />
                <Label
                  htmlFor={`domain-${value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>

        {/* Status Filter */}
        <Collapsible className="space-y-2">
          <CollapsibleTrigger asChild>
            <Button
              variant="outline"
              className="w-full justify-between"
              disabled={isLoading}
            >
              <span className="text-sm font-medium">
                Status {filters.status && filters.status.length > 0 && `(${filters.status.length})`}
              </span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-2 pt-2">
            {FINDING_STATUSES.map(({ value, label }) => (
              <div key={value} className="flex items-center space-x-2">
                <Checkbox
                  id={`status-${value}`}
                  checked={filters.status?.includes(value) || false}
                  onCheckedChange={(checked: boolean | 'indeterminate') =>
                    handleStatusChange(value, checked === true)
                  }
                  disabled={isLoading}
                />
                <Label
                  htmlFor={`status-${value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {label}
                </Label>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  )
}
