/**
 * Bucket Item List Component
 * Displays the expanded list of documents within a folder-based bucket
 * Story: E2.3 - Build Data Room Buckets View (AC: #4, #5, #6)
 *
 * Architecture (v2.6): Buckets = top-level folders
 * Shows documents within a top-level folder and its subfolders
 */

'use client'

import {
  X,
  Upload,
  FileText,
  Check,
  Loader2,
  Folder,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { BucketItem } from './bucket-card'

interface BucketItemListProps {
  folderName: string
  folderPath: string
  items: BucketItem[]
  uploadedCount: number
  uploadingItemId: string | null
  onUploadItem: (itemId: string) => void
  onBulkUpload: () => void
  onClose: () => void
}

export function BucketItemList({
  folderName,
  folderPath,
  items,
  uploadedCount,
  uploadingItemId,
  onUploadItem,
  onBulkUpload,
  onClose,
}: BucketItemListProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Folder className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">{folderName}</h2>
            <p className="text-sm text-muted-foreground">
              {uploadedCount} document{uploadedCount === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </Button>
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
              <p className="font-medium">No documents in this bucket</p>
              <p className="mb-4 text-sm text-muted-foreground">
                Upload your first document to this folder
              </p>
              <Button size="sm" onClick={onBulkUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Upload Document
              </Button>
            </div>
          ) : (
            items.map((item) => {
              const isUploading = uploadingItemId === item.id

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-green-100">
                      <FileText className="h-4 w-4 text-green-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{item.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-700"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Uploaded
                    </Badge>
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
