/**
 * Bucket Item List Component
 * Displays the expanded list of items within a category bucket
 * Story: E2.3 - Build Data Room Buckets View (AC: #4, #5, #6)
 */

'use client'

import {
  X,
  Upload,
  FileText,
  Check,
  Clock,
  Circle,
  Loader2,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { DocumentCategory } from '@/lib/gcs/client'
import type { BucketItem } from './bucket-card'

interface BucketItemListProps {
  category: DocumentCategory
  label: string
  items: BucketItem[]
  uploadedCount: number
  expectedCount: number
  uploadingItemId: string | null
  onUploadItem: (itemId: string) => void
  onBulkUpload: () => void
  onClose: () => void
}

/**
 * Get status icon and color for an item
 */
function getStatusDisplay(status: BucketItem['status']) {
  switch (status) {
    case 'uploaded':
      return {
        icon: Check,
        color: 'text-green-600',
        bgColor: 'bg-green-100',
        label: 'Uploaded',
      }
    case 'pending':
      return {
        icon: Clock,
        color: 'text-amber-600',
        bgColor: 'bg-amber-100',
        label: 'Pending',
      }
    case 'not_started':
    default:
      return {
        icon: Circle,
        color: 'text-gray-400',
        bgColor: 'bg-gray-100',
        label: 'Not Started',
      }
  }
}

export function BucketItemList({
  category,
  label,
  items,
  uploadedCount,
  expectedCount,
  uploadingItemId,
  onUploadItem,
  onBulkUpload,
  onClose,
}: BucketItemListProps) {
  const progress = expectedCount > 0
    ? Math.min(Math.round((uploadedCount / expectedCount) * 100), 100)
    : (uploadedCount > 0 ? 100 : 0)

  // Count items by status
  const uploadedItems = items.filter((i) => i.status === 'uploaded').length
  const pendingItems = items.filter((i) => i.status === 'pending').length
  const notStartedItems = items.filter((i) => i.status === 'not_started').length

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="font-semibold">{label}</h2>
          <p className="text-sm text-muted-foreground">
            {uploadedCount}/{expectedCount} documents uploaded
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
      </div>

      {/* Progress summary */}
      <div className="border-b px-4 py-3">
        <div className="mb-2 flex justify-between text-sm">
          <span>Progress</span>
          <span className="font-medium">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />

        <div className="mt-3 flex gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span>{uploadedItems} uploaded</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-amber-500" />
            <span>{pendingItems} pending</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-gray-300" />
            <span>{notStartedItems} not started</span>
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="border-b px-4 py-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkUpload}
          className="w-full"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Items list */}
      <ScrollArea className="flex-1">
        <div className="divide-y">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <FileText className="mb-2 h-8 w-8 text-muted-foreground" />
              <p className="font-medium">No documents uploaded</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Upload your first document to this category
              </p>
              <Button size="sm" onClick={onBulkUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </div>
          ) : (
            items.map((item) => {
              const statusDisplay = getStatusDisplay(item.status)
              const StatusIcon = statusDisplay.icon
              const isUploading = uploadingItemId === item.id

              return (
                <div
                  key={item.id}
                  className={cn(
                    'flex items-center justify-between px-4 py-3',
                    item.status === 'uploaded' && 'bg-green-50/50'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                        statusDisplay.bgColor
                      )}
                    >
                      <StatusIcon className={cn('h-4 w-4', statusDisplay.color)} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                      {item.documentName && (
                        <p className="truncate text-xs text-muted-foreground">
                          {item.documentName}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    {item.status === 'uploaded' ? (
                      <Badge
                        variant="secondary"
                        className="bg-green-100 text-green-700"
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Uploaded
                      </Badge>
                    ) : isUploading ? (
                      <Button variant="outline" size="sm" disabled>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Uploading...
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          onUploadItem(item.id)
                        }}
                      >
                        <Upload className="mr-2 h-3 w-3" />
                        Upload
                      </Button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
