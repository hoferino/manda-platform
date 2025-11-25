/**
 * Projects View Component
 * Client-side component for filtering, searching, and view toggling
 * Story: E1.4 - Build Projects Overview Screen (AC: #2, #3, #5, #6)
 */

'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, LayoutGrid, List, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ProjectCard } from './project-card'
import { ProjectTable } from './project-table'
import { EmptyState } from './empty-state'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { Deal } from '@/lib/supabase/types'

interface ProjectsViewProps {
  deals: Deal[]
}

type FilterStatus = 'all' | 'active' | 'on-hold' | 'archived'
type ViewMode = 'grid' | 'table'

const VIEW_PREFERENCE_KEY = 'manda-projects-view'

export function ProjectsView({ deals }: ProjectsViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedQuery = useDebouncedValue(searchQuery, 300)

  // Restore view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem(VIEW_PREFERENCE_KEY)
    if (savedView === 'grid' || savedView === 'table') {
      setViewMode(savedView)
    }
  }, [])

  // Save view preference to localStorage
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode)
    localStorage.setItem(VIEW_PREFERENCE_KEY, mode)
  }

  // Calculate filter counts
  const filterCounts = useMemo(() => {
    const counts = {
      all: deals.length,
      active: 0,
      'on-hold': 0,
      archived: 0,
    }

    for (const deal of deals) {
      const status = (deal.status ?? 'active') as FilterStatus
      if (status in counts) {
        counts[status]++
      }
    }

    return counts
  }, [deals])

  // Filter deals by status
  const filteredByStatus = useMemo(() => {
    if (filter === 'all') return deals
    return deals.filter((deal) => (deal.status ?? 'active') === filter)
  }, [deals, filter])

  // Filter deals by search query
  const filteredDeals = useMemo(() => {
    if (!debouncedQuery.trim()) return filteredByStatus

    const query = debouncedQuery.toLowerCase()
    return filteredByStatus.filter(
      (deal) =>
        deal.name.toLowerCase().includes(query) ||
        deal.company_name?.toLowerCase().includes(query)
    )
  }, [filteredByStatus, debouncedQuery])

  // Show empty state if user has no projects at all
  if (deals.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="space-y-6">
      {/* Header with search, filters, and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Clear search</span>
            </button>
          )}
        </div>

        {/* View Toggle and New Project Button */}
        <div className="flex items-center gap-3">
          <Tabs value={viewMode} onValueChange={(v) => handleViewChange(v as ViewMode)}>
            <TabsList className="grid w-[120px] grid-cols-2">
              <TabsTrigger value="grid" className="px-3">
                <LayoutGrid className="h-4 w-4" />
                <span className="sr-only">Grid view</span>
              </TabsTrigger>
              <TabsTrigger value="table" className="px-3">
                <List className="h-4 w-4" />
                <span className="sr-only">Table view</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button asChild>
            <Link href="/projects/new">
              <Plus className="mr-2 h-4 w-4" />
              New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        <FilterButton
          label="All"
          count={filterCounts.all}
          active={filter === 'all'}
          onClick={() => setFilter('all')}
        />
        <FilterButton
          label="Active"
          count={filterCounts.active}
          active={filter === 'active'}
          onClick={() => setFilter('active')}
        />
        <FilterButton
          label="On Hold"
          count={filterCounts['on-hold']}
          active={filter === 'on-hold'}
          onClick={() => setFilter('on-hold')}
        />
        <FilterButton
          label="Archived"
          count={filterCounts.archived}
          active={filter === 'archived'}
          onClick={() => setFilter('archived')}
        />
      </div>

      {/* Results */}
      {filteredDeals.length === 0 ? (
        <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            {debouncedQuery
              ? `No projects found matching "${debouncedQuery}"`
              : 'No projects match the selected filter'}
          </p>
          {(debouncedQuery || filter !== 'all') && (
            <Button
              variant="link"
              onClick={() => {
                setSearchQuery('')
                setFilter('all')
              }}
              className="mt-2"
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredDeals.map((deal) => (
            <ProjectCard key={deal.id} deal={deal} />
          ))}
        </div>
      ) : (
        <ProjectTable deals={filteredDeals} />
      )}
    </div>
  )
}

interface FilterButtonProps {
  label: string
  count: number
  active: boolean
  onClick: () => void
}

function FilterButton({ label, count, active, onClick }: FilterButtonProps) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      onClick={onClick}
      className="gap-2"
    >
      {label}
      <Badge
        variant={active ? 'secondary' : 'outline'}
        className={`ml-1 ${active ? 'bg-primary-foreground/20 text-primary-foreground' : ''}`}
      >
        {count}
      </Badge>
    </Button>
  )
}
