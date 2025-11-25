/**
 * Document List Component
 * Displays documents in selected folder
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #5, #6)
 */

'use client'

import { useCallback } from 'react'
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Presentation,
  MoreVertical,
  Download,
  Trash2,
  FolderInput,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Document } from '@/lib/api/documents'
import { formatFileSize } from '@/lib/api/documents'

interface DocumentListProps {
  documents: Document[]
  isLoading?: boolean
  onDownload: (document: Document) => void
  onDelete: (document: Document) => void
  onMove: (document: Document) => void
}

export function DocumentList({
  documents,
  isLoading,
  onDownload,
  onDelete,
  onMove,
}: DocumentListProps) {
  const handleDragStart = useCallback((e: React.DragEvent, document: Document) => {
    e.dataTransfer.setData('application/document-id', document.id)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">Loading documents...</div>
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <File className="h-12 w-12 text-muted-foreground/50" />
        <div className="text-sm text-muted-foreground">No documents</div>
        <div className="text-xs text-muted-foreground">
          Drop files here or use the upload button
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col divide-y">
      {/* Header row */}
      <div className="grid grid-cols-[1fr_100px_120px_40px] gap-4 px-4 py-2 text-xs font-medium text-muted-foreground">
        <div>Name</div>
        <div>Size</div>
        <div>Date</div>
        <div></div>
      </div>

      {/* Document rows */}
      {documents.map((doc) => (
        <DocumentRow
          key={doc.id}
          document={doc}
          onDragStart={handleDragStart}
          onDownload={onDownload}
          onDelete={onDelete}
          onMove={onMove}
        />
      ))}
    </div>
  )
}

interface DocumentRowProps {
  document: Document
  onDragStart: (e: React.DragEvent, document: Document) => void
  onDownload: (document: Document) => void
  onDelete: (document: Document) => void
  onMove: (document: Document) => void
}

function DocumentRow({
  document,
  onDragStart,
  onDownload,
  onDelete,
  onMove,
}: DocumentRowProps) {
  const Icon = getFileIcon(document.mimeType)

  return (
    <div
      className="group grid cursor-grab grid-cols-[1fr_100px_120px_40px] items-center gap-4 px-4 py-3 hover:bg-muted/50 active:cursor-grabbing"
      draggable
      onDragStart={(e) => onDragStart(e, document)}
    >
      {/* Name with icon */}
      <div className="flex items-center gap-3 overflow-hidden">
        <Icon className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
        <span className="truncate text-sm">{document.name}</span>
      </div>

      {/* Size */}
      <div className="text-sm text-muted-foreground">
        {formatFileSize(document.size)}
      </div>

      {/* Date */}
      <div className="text-sm text-muted-foreground">
        {formatDate(document.createdAt)}
      </div>

      {/* Actions menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="invisible h-8 w-8 p-0 group-hover:visible"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onDownload(document)}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onMove(document)}>
            <FolderInput className="mr-2 h-4 w-4" />
            Move to...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(document)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

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

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
