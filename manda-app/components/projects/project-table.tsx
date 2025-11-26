/**
 * Project Table Component
 * Displays projects in a table view with sortable columns
 * Story: E1.4 - Build Projects Overview Screen (AC: #3, #7, #8)
 *
 * Note (v2.6): deal_type removed - it didn't drive any downstream behavior
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { MoreHorizontal, ArrowUpDown, Eye, Archive } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Deal } from '@/lib/supabase/types'

interface ProjectTableProps {
  deals: Deal[]
}

type SortKey = 'name' | 'company_name' | 'industry' | 'status' | 'updated_at'
type SortDirection = 'asc' | 'desc'

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'on-hold': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

export function ProjectTable({ deals: initialDeals }: ProjectTableProps) {
  const router = useRouter()
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDirection('asc')
    }
  }

  const sortedDeals = [...initialDeals].sort((a, b) => {
    const aValue = a[sortKey] ?? ''
    const bValue = b[sortKey] ?? ''

    if (sortKey === 'updated_at') {
      const aDate = new Date(aValue).getTime()
      const bDate = new Date(bValue).getTime()
      return sortDirection === 'asc' ? aDate - bDate : bDate - aDate
    }

    const comparison = String(aValue).localeCompare(String(bValue))
    return sortDirection === 'asc' ? comparison : -comparison
  })

  const SortableHeader = ({ column, label }: { column: SortKey; label: string }) => (
    <Button
      variant="ghost"
      onClick={() => handleSort(column)}
      className="-ml-4 h-8 px-2 hover:bg-transparent"
    >
      {label}
      <ArrowUpDown className="ml-2 h-4 w-4" />
    </Button>
  )

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">
              <SortableHeader column="name" label="Project Name" />
            </TableHead>
            <TableHead>
              <SortableHeader column="company_name" label="Company" />
            </TableHead>
            <TableHead className="hidden md:table-cell">
              <SortableHeader column="industry" label="Industry" />
            </TableHead>
            <TableHead>
              <SortableHeader column="status" label="Status" />
            </TableHead>
            <TableHead className="hidden sm:table-cell w-[120px]">Progress</TableHead>
            <TableHead className="hidden md:table-cell">
              <SortableHeader column="updated_at" label="Last Activity" />
            </TableHead>
            <TableHead className="w-[50px]">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedDeals.map((deal) => {
            const status = deal.status ?? 'active'
            const statusClass = statusColors[status] ?? statusColors['active']
            const progress = Math.min(100, Math.max(0, Math.floor(Math.random() * 30 + 10)))
            const lastActivity = formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true })

            return (
              <TableRow
                key={deal.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/projects/${deal.id}/dashboard`)}
              >
                <TableCell className="font-medium">
                  <Link
                    href={`/projects/${deal.id}/dashboard`}
                    className="hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {deal.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {deal.company_name ?? '-'}
                </TableCell>
                <TableCell className="hidden md:table-cell text-muted-foreground">
                  {deal.industry ?? '-'}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`capitalize ${statusClass}`}
                  >
                    {status.replace('-', ' ')}
                  </Badge>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="h-2 w-16" />
                    <span className="text-xs text-muted-foreground w-8">
                      {progress}%
                    </span>
                  </div>
                </TableCell>
                <TableCell
                  className="hidden md:table-cell text-muted-foreground text-sm"
                  title={new Date(deal.updated_at).toLocaleString()}
                >
                  {lastActivity}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/projects/${deal.id}/dashboard`)
                        }}
                      >
                        <Eye className="mr-2 h-4 w-4" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation()
                          // Archive functionality will be implemented in future stories
                        }}
                      >
                        <Archive className="mr-2 h-4 w-4" />
                        Archive
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
