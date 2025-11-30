/**
 * FindingsTable Component
 * Data table for displaying findings with sorting, pagination
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #2, #3, #7)
 * Story: E4.5 - Implement Source Attribution Links (AC: 7)
 *
 * Features:
 * - Sortable columns (Confidence, Domain, Created Date)
 * - Truncated finding text with hover to expand
 * - Clickable source document links with preview modal
 * - Domain badge
 * - Confidence indicator
 * - Status badge
 * - Actions column (placeholder for E4.3)
 * - Responsive design
 */

'use client'

import { useCallback, useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  FileText,
  Check,
  X,
  Pencil,
} from 'lucide-react'
import { ConfidenceBadge, DomainTag, StatusBadge, SourceAttributionLink } from '../shared'
import type { Finding, FindingWithSimilarity } from '@/lib/types/findings'
import { cn } from '@/lib/utils'

interface FindingsTableProps {
  findings: Finding[] | FindingWithSimilarity[]
  isLoading?: boolean
  page: number
  totalPages: number
  total: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onPageChange: (page: number) => void
  onSortChange: (sortBy: string, sortOrder: 'asc' | 'desc') => void
  onValidate?: (findingId: string, action: 'confirm' | 'reject') => void
  onEdit?: (finding: Finding) => void
  onRowClick?: (finding: Finding) => void
  showSimilarity?: boolean
  projectId: string
}

/**
 * Similarity score badge for search results
 */
function SimilarityBadge({ similarity }: { similarity: number }) {
  const percent = Math.round(similarity * 100)
  const colorClass =
    percent >= 80
      ? 'bg-green-100 text-green-800'
      : percent >= 60
        ? 'bg-yellow-100 text-yellow-800'
        : 'bg-gray-100 text-gray-800'

  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', colorClass)}
      title={`${percent}% match`}
    >
      {percent}% match
    </span>
  )
}

// Truncated text component with tooltip
function TruncatedText({ text, maxLength = 100 }: { text: string; maxLength?: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const shouldTruncate = text.length > maxLength

  if (!shouldTruncate) {
    return <span>{text}</span>
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="cursor-help"
            onClick={() => setIsExpanded(!isExpanded)}
            onKeyDown={(e) => e.key === 'Enter' && setIsExpanded(!isExpanded)}
            tabIndex={0}
            role="button"
            aria-expanded={isExpanded}
          >
            {isExpanded ? text : `${text.slice(0, maxLength)}...`}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-md">
          <p className="whitespace-pre-wrap">{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Source attribution component - now uses SourceAttributionLink for clickable links
function SourceAttributionCell({
  finding,
  projectId,
}: {
  finding: Finding | FindingWithSimilarity
  projectId: string
}) {
  if (!finding.sourceDocument && !finding.documentId) {
    return <span className="text-muted-foreground">—</span>
  }

  // If we have a documentId, use the clickable SourceAttributionLink
  if (finding.documentId) {
    return (
      <SourceAttributionLink
        documentId={finding.documentId}
        documentName={finding.sourceDocument || 'Unknown document'}
        chunkId={finding.chunkId}
        pageNumber={finding.pageNumber}
        sheetName={null} // Will be fetched from chunk API if needed
        cellReference={null} // Will be fetched from chunk API if needed
        projectId={projectId}
      />
    )
  }

  // Fallback: show plain text if no documentId (e.g., manually created findings)
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
      <span className="truncate max-w-[150px]" title={finding.sourceDocument || undefined}>
        {finding.sourceDocument}
      </span>
      {finding.pageNumber && (
        <span className="text-muted-foreground text-xs">p.{finding.pageNumber}</span>
      )}
    </div>
  )
}

export function FindingsTable({
  findings,
  isLoading = false,
  page,
  totalPages,
  total,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onPageChange,
  onSortChange,
  onValidate,
  onEdit,
  onRowClick,
  showSimilarity = false,
  projectId,
}: FindingsTableProps) {
  // Internal sorting state for tanstack table
  const [sorting, setSorting] = useState<SortingState>([
    { id: sortBy, desc: sortOrder === 'desc' },
  ])

  // Handle sort change
  const handleSortChange = useCallback(
    (columnId: string) => {
      const isCurrentlySorted = sortBy === columnId
      const newOrder = isCurrentlySorted && sortOrder === 'desc' ? 'asc' : 'desc'

      // Map column IDs to API sort fields
      const sortFieldMap: Record<string, string> = {
        confidence: 'confidence',
        domain: 'domain',
        createdAt: 'createdAt',
      }

      const apiSortField = sortFieldMap[columnId] || columnId
      onSortChange(apiSortField, newOrder)
      setSorting([{ id: columnId, desc: newOrder === 'desc' }])
    },
    [sortBy, sortOrder, onSortChange]
  )

  // Column definitions
  const columns: ColumnDef<Finding | FindingWithSimilarity>[] = [
    // Similarity column (only shown in search mode)
    ...(showSimilarity
      ? [
          {
            id: 'similarity',
            header: 'Relevance',
            cell: ({ row }: { row: { original: Finding | FindingWithSimilarity } }) => {
              const finding = row.original as FindingWithSimilarity
              return finding.similarity !== undefined ? (
                <SimilarityBadge similarity={finding.similarity} />
              ) : null
            },
          } satisfies ColumnDef<Finding | FindingWithSimilarity>,
        ]
      : []),
    {
      id: 'text',
      accessorKey: 'text',
      header: 'Finding',
      cell: ({ row }) => (
        <div className="min-w-[200px] max-w-[400px]">
          <TruncatedText text={row.original.text} maxLength={120} />
        </div>
      ),
    },
    {
      id: 'source',
      header: 'Source',
      cell: ({ row }) => (
        <SourceAttributionCell
          finding={row.original}
          projectId={projectId}
        />
      ),
    },
    {
      id: 'domain',
      accessorKey: 'domain',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => handleSortChange('domain')}
        >
          Domain
          {sortBy === 'domain' ? (
            sortOrder === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUp className="ml-2 h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => <DomainTag domain={row.original.domain} size="sm" />,
    },
    {
      id: 'confidence',
      accessorKey: 'confidence',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => handleSortChange('confidence')}
        >
          Confidence
          {sortBy === 'confidence' ? (
            sortOrder === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUp className="ml-2 h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => (
        <ConfidenceBadge confidence={row.original.confidence} size="sm" />
      ),
    },
    {
      id: 'status',
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <StatusBadge status={row.original.status} size="sm" />,
    },
    {
      id: 'createdAt',
      accessorKey: 'createdAt',
      header: ({ column }) => (
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 h-8"
          onClick={() => handleSortChange('createdAt')}
        >
          Date
          {sortBy === 'createdAt' ? (
            sortOrder === 'desc' ? (
              <ArrowDown className="ml-2 h-4 w-4" />
            ) : (
              <ArrowUp className="ml-2 h-4 w-4" />
            )
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      ),
      cell: ({ row }) => {
        const date = new Date(row.original.createdAt)
        return (
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {date.toLocaleDateString()}
          </span>
        )
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onValidate?.(row.original.id, 'confirm')}
                  disabled={row.original.status === 'validated'}
                  aria-label="Validate finding"
                >
                  <Check className="h-4 w-4 text-green-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Validate</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onValidate?.(row.original.id, 'reject')}
                  disabled={row.original.status === 'rejected'}
                  aria-label="Reject finding"
                >
                  <X className="h-4 w-4 text-red-600" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reject</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => onEdit?.(row.original)}
                  aria-label="Edit finding"
                >
                  <Pencil className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      ),
    },
  ]

  // Initialize table
  const table = useReactTable({
    data: findings,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: totalPages,
    state: {
      sorting,
    },
  })

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map((col) => (
                  <TableHead key={col.id}>
                    <Skeleton className="h-4 w-24" />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.id}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    )
  }

  // Empty state
  if (findings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">No findings found</h3>
        <p className="text-muted-foreground mt-1 max-w-sm">
          No findings match your current filters. Try adjusting your filters or upload
          documents to extract findings.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Table */}
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} className="whitespace-nowrap">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  'hover:bg-muted/50',
                  onRowClick && 'cursor-pointer'
                )}
                onClick={() => onRowClick?.(row.original)}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(e) => {
                  if (onRowClick && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onRowClick(row.original)
                  }
                }}
                role={onRowClick ? 'button' : undefined}
                aria-label={onRowClick ? `View details for finding` : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2">
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
    </div>
  )
}
