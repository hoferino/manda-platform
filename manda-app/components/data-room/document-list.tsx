/**
 * Document List Component
 * Displays documents in selected folder with click-to-view-details
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #5, #6)
 * Story: E2.5 - Create Document Metadata Management (enhanced with details panel)
 */

'use client'

import { useCallback } from 'react'
import { File } from 'lucide-react'
import type { Document } from '@/lib/api/documents'
import { DocumentCard, DocumentCardHeader } from './document-card'

interface DocumentListProps {
  documents: Document[]
  isLoading?: boolean
  onDocumentClick?: (document: Document) => void
  onDownload: (document: Document) => void
  onDelete: (document: Document) => void
  onMove: (document: Document) => void
  onRename?: (document: Document) => void
}

export function DocumentList({
  documents,
  isLoading,
  onDocumentClick,
  onDownload,
  onDelete,
  onMove,
  onRename,
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
    <div className="flex flex-col divide-y" data-testid="document-list">
      {/* Header row */}
      <DocumentCardHeader />

      {/* Document rows */}
      {documents.map((doc) => (
        <DocumentCard
          key={doc.id}
          document={doc}
          onClick={onDocumentClick}
          onDownload={onDownload}
          onDelete={onDelete}
          onMove={onMove}
          onRename={onRename}
          onDragStart={handleDragStart}
        />
      ))}
    </div>
  )
}
