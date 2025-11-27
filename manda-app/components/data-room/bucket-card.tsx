/**
 * Bucket Card Component
 * Displays a folder-based bucket with document count and status badge
 * Story: E2.3 - Build Data Room Buckets View (AC: #1, #2, #3)
 *
 * Architecture (v2.6): Buckets = top-level folders
 * Cards represent top-level folders, not hardcoded categories
 */

'use client'

import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface BucketItem {
  id: string
  name: string
  status: 'uploaded' | 'pending' | 'not_started'
  type: 'document' | 'folder'
  documentId?: string
  documentName?: string
  folderPath?: string
}

export interface BucketCardProps {
  folderName: string
  folderPath: string
  uploadedCount: number
  items?: BucketItem[]
  subfolderCount?: number
  isExpanded?: boolean
  onToggleExpand?: () => void
  onClick?: () => void
}

/**
 * Get status badge based on document count
 */
function getStatusBadge(count: number): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
} {
  if (count === 0) {
    return {
      label: 'Empty',
      variant: 'secondary',
      className: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
    }
  }
  return {
    label: `${count} doc${count === 1 ? '' : 's'}`,
    variant: 'default',
    className: 'bg-blue-100 text-blue-700 hover:bg-blue-100',
  }
}

export function BucketCard({
  folderName,
  folderPath,
  uploadedCount,
  items = [],
  subfolderCount = 0,
  isExpanded = false,
  onToggleExpand,
  onClick,
}: BucketCardProps) {
  const statusBadge = getStatusBadge(uploadedCount)
  const Icon = isExpanded ? FolderOpen : Folder

  const handleClick = () => {
    if (onToggleExpand) {
      onToggleExpand()
    }
    if (onClick) {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isExpanded && 'ring-2 ring-primary/20'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">{folderName}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {uploadedCount} document{uploadedCount === 1 ? '' : 's'}
                {subfolderCount > 0 && ` · ${subfolderCount} subfolder${subfolderCount === 1 ? '' : 's'}`}
              </p>
            </div>
          </div>
          <Badge className={statusBadge.className} variant={statusBadge.variant}>
            {statusBadge.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Document preview list */}
        {items.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Recent documents</p>
            <ul className="text-sm text-muted-foreground">
              {items.slice(0, 3).map((item) => (
                <li key={item.id} className="truncate">
                  • {item.name}
                </li>
              ))}
              {items.length > 3 && (
                <li className="text-xs italic">+{items.length - 3} more</li>
              )}
            </ul>
          </div>
        )}

        {/* Empty state */}
        {items.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No documents yet</p>
        )}

        {/* Expand indicator */}
        {onToggleExpand && (
          <div className="flex items-center justify-center pt-1 text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
