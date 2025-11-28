/**
 * Document Card Component
 * Displays document metadata in a compact card format
 * Story: E2.5 - Create Document Metadata Management (AC: #1)
 * Story: E2.6 - Implement Document Actions (View, Download, Delete)
 * Story: E3.6 - Processing Status Tracking (AC: #1)
 *
 * Features:
 * - File type icon based on MIME type
 * - Size formatted as KB/MB/GB
 * - Relative date (e.g., "2 hours ago")
 * - Category badge
 * - Processing status badge with granular status display
 * - Document actions (View, Download, Delete) via DocumentActions component
 */

'use client'

import { useCallback } from 'react'
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Presentation,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { Document } from '@/lib/api/documents'
import { formatFileSize, DOCUMENT_CATEGORIES } from '@/lib/api/documents'
import { DocumentActions } from './document-actions'
import { ProcessingStatusBadge, isProcessingComplete } from './processing-status-badge'

export interface DocumentCardProps {
  document: Document
  onClick?: (document: Document) => void
  onDownload?: (document: Document) => void
  onDelete?: (document: Document) => void
  onMove?: (document: Document) => void
  onRename?: (document: Document) => void
  draggable?: boolean
  onDragStart?: (e: React.DragEvent, document: Document) => void
  className?: string
}

/**
 * Get the file icon component based on MIME type
 */
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File

  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return FileSpreadsheet
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return Presentation
  if (mimeType.includes('image')) return FileImage
  if (mimeType.includes('text')) return FileText

  return File
}

/**
 * Get human-readable category label
 */
function getCategoryLabel(category: string | null): string | null {
  if (!category) return null
  const found = DOCUMENT_CATEGORIES.find((c) => c.value === category)
  return found?.label || category
}

/**
 * Document Card Component
 * Displays document info in a row/card format with actions
 */
export function DocumentCard({
  document,
  onClick,
  onDownload,
  onDelete,
  onMove,
  onRename,
  draggable = true,
  onDragStart,
  className,
}: DocumentCardProps) {
  const Icon = getFileIcon(document.mimeType)
  const categoryLabel = getCategoryLabel(document.category)
  const showProcessingStatus = !isProcessingComplete(document.processingStatus)

  const handleClick = useCallback(() => {
    onClick?.(document)
  }, [document, onClick])

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (onDragStart) {
        e.dataTransfer.setData('application/document-id', document.id)
        e.dataTransfer.effectAllowed = 'move'
        onDragStart(e, document)
      }
    },
    [document, onDragStart]
  )

  // Format date as relative time
  const relativeDate = formatDistanceToNow(new Date(document.createdAt), {
    addSuffix: true,
  })

  return (
    <div
      className={cn(
        'group grid cursor-pointer grid-cols-[1fr_100px_120px_40px] items-center gap-4 px-4 py-3 hover:bg-muted/50',
        draggable && 'cursor-grab active:cursor-grabbing',
        className
      )}
      onClick={handleClick}
      draggable={draggable && !!onDragStart}
      onDragStart={handleDragStart}
      role="button"
      tabIndex={0}
      data-testid="document-item"
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleClick()
        }
      }}
    >
      {/* Name with icon and badges */}
      <div className="flex items-center gap-3 overflow-hidden">
        <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <div className="flex flex-col gap-1 overflow-hidden">
          <span className="truncate text-sm font-medium">{document.name}</span>
          <div className="flex items-center gap-2">
            {/* Category badge */}
            {categoryLabel && (
              <Badge variant="outline" className="text-xs">
                {categoryLabel}
              </Badge>
            )}
            {/* Processing status badge (only show if not complete) */}
            {showProcessingStatus && (
              <ProcessingStatusBadge status={document.processingStatus} size="sm" />
            )}
          </div>
        </div>
      </div>

      {/* Size */}
      <div className="text-sm text-muted-foreground">
        {formatFileSize(document.size)}
      </div>

      {/* Date */}
      <div className="text-sm text-muted-foreground" title={new Date(document.createdAt).toLocaleString()}>
        {relativeDate}
      </div>

      {/* Actions menu - E2.6: Uses DocumentActions with View, Download, Delete */}
      <DocumentActions
        document={document}
        onDownload={onDownload ? () => onDownload(document) : undefined}
        onDelete={onDelete ? () => onDelete(document) : undefined}
        onMove={onMove ? () => onMove(document) : undefined}
        onRename={onRename ? () => onRename(document) : undefined}
      />
    </div>
  )
}

/**
 * Document Card Header Component
 * Header row for document card list
 */
export function DocumentCardHeader() {
  return (
    <div className="grid grid-cols-[1fr_100px_120px_40px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
      <div>Name</div>
      <div>Size</div>
      <div>Date</div>
      <div></div>
    </div>
  )
}
