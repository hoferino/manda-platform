/**
 * DocumentPreviewModal Component
 * Modal for previewing document content at source location
 * Story: E4.5 - Implement Source Attribution Links (AC: 2, 8)
 *
 * Features:
 * - Modal using shadcn Dialog
 * - Document header with title, page/sheet, and reference info
 * - Loading state with skeleton
 * - Error state with retry button
 * - Keyboard dismiss (Escape)
 * - On-demand content fetching
 */

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  FileText,
  FileSpreadsheet,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ExcelPreview } from './ExcelPreview'
import { PdfPreview } from './PdfPreview'
import { FallbackPreview } from './FallbackPreview'

export interface ChunkData {
  id: string
  content: string
  chunkType: string
  pageNumber: number | null
  sheetName: string | null
  cellReference: string | null
  metadata: Record<string, unknown>
}

export interface DocumentData {
  id: string
  name: string
  filePath: string
  mimeType: string
  processingStatus: string
  fileSize: number | null
  uploadedAt: string | null
}

export interface ChunkContext {
  previousChunk: { id: string; content: string } | null
  nextChunk: { id: string; content: string } | null
}

export interface ChunkResponse {
  chunk: ChunkData
  document: DocumentData
  context: ChunkContext
}

export interface DocumentPreviewModalProps {
  isOpen: boolean
  onClose: () => void
  documentId: string
  documentName: string
  chunkId: string | null
  pageNumber: number | null
  sheetName: string | null
  cellReference: string | null
  projectId: string
}

type LoadingState = 'idle' | 'loading' | 'success' | 'error'

/**
 * Determine the document type from filename
 */
function getDocumentType(documentName: string): 'excel' | 'pdf' | 'other' {
  const extension = documentName.split('.').pop()?.toLowerCase()

  if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
    return 'excel'
  }
  if (extension === 'pdf') {
    return 'pdf'
  }
  return 'other'
}

/**
 * Get icon for document type
 */
function getDocumentIcon(documentName: string) {
  const type = getDocumentType(documentName)
  return type === 'excel' ? FileSpreadsheet : FileText
}

/**
 * Format the reference info for display
 */
function formatReferenceInfo({
  sheetName,
  cellReference,
  pageNumber,
}: Pick<DocumentPreviewModalProps, 'sheetName' | 'cellReference' | 'pageNumber'>): string | null {
  const parts: string[] = []

  if (sheetName) {
    parts.push(`Sheet: ${sheetName}`)
  }
  if (cellReference) {
    parts.push(`Cell: ${cellReference}`)
  }
  if (pageNumber !== null && pageNumber !== undefined) {
    parts.push(`Page: ${pageNumber}`)
  }

  return parts.length > 0 ? parts.join(' | ') : null
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  documentId,
  documentName,
  chunkId,
  pageNumber,
  sheetName,
  cellReference,
  projectId,
}: DocumentPreviewModalProps) {
  const [loadingState, setLoadingState] = useState<LoadingState>('idle')
  const [data, setData] = useState<ChunkResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const documentType = getDocumentType(documentName)
  const Icon = getDocumentIcon(documentName)
  const referenceInfo = formatReferenceInfo({ sheetName, cellReference, pageNumber })

  // Fetch chunk data when modal opens
  const fetchChunkData = useCallback(async () => {
    if (!chunkId) {
      // No chunk ID - show fallback with document info only
      setLoadingState('success')
      setData(null)
      return
    }

    setLoadingState('loading')
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/chunks/${chunkId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to fetch chunk: ${response.statusText}`)
      }

      const result: ChunkResponse = await response.json()
      setData(result)
      setLoadingState('success')
    } catch (err) {
      console.error('[DocumentPreviewModal] Fetch error:', err)
      setError(err instanceof Error ? err.message : 'Failed to load document preview')
      setLoadingState('error')
    }
  }, [chunkId, projectId])

  // Fetch on open
  useEffect(() => {
    if (isOpen && loadingState === 'idle') {
      fetchChunkData()
    }
  }, [isOpen, loadingState, fetchChunkData])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLoadingState('idle')
      setData(null)
      setError(null)
    }
  }, [isOpen])

  // Handle retry
  const handleRetry = useCallback(() => {
    setLoadingState('idle')
    fetchChunkData()
  }, [fetchChunkData])

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-4xl max-h-[85vh] flex flex-col"
        aria-describedby="document-preview-description"
      >
        {/* Header */}
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="truncate">{documentName}</span>
          </DialogTitle>
          {referenceInfo && (
            <DialogDescription id="document-preview-description" className="text-sm text-muted-foreground font-mono">
              {referenceInfo}
            </DialogDescription>
          )}
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-[300px]">
          {/* Loading state */}
          {loadingState === 'loading' && (
            <div className="space-y-4 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {/* Error state */}
          {loadingState === 'error' && (
            <div className="p-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Failed to load preview</AlertTitle>
                <AlertDescription className="mt-2">
                  {error || 'An unexpected error occurred'}
                </AlertDescription>
              </Alert>
              <div className="mt-4 flex justify-center">
                <Button
                  variant="outline"
                  onClick={handleRetry}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              </div>
            </div>
          )}

          {/* Success state - render appropriate preview */}
          {loadingState === 'success' && (
            <>
              {/* No chunk or no data - show fallback */}
              {(!chunkId || !data) && (
                <FallbackPreview
                  documentId={documentId}
                  documentName={documentName}
                  projectId={projectId}
                  document={data?.document || null}
                />
              )}

              {/* Excel preview */}
              {data && documentType === 'excel' && (
                <ExcelPreview
                  chunk={data.chunk}
                  document={data.document}
                  context={data.context}
                  cellReference={cellReference}
                  sheetName={sheetName}
                />
              )}

              {/* PDF preview */}
              {data && documentType === 'pdf' && (
                <PdfPreview
                  chunk={data.chunk}
                  document={data.document}
                  context={data.context}
                  pageNumber={pageNumber}
                />
              )}

              {/* Other document types - show text content */}
              {data && documentType === 'other' && (
                <div className="p-4">
                  <div className="bg-muted rounded-lg p-4">
                    <pre className="whitespace-pre-wrap text-sm font-mono">
                      {data.chunk.content}
                    </pre>
                  </div>
                  {data.context.previousChunk && (
                    <details className="mt-4">
                      <summary className="text-sm text-muted-foreground cursor-pointer">
                        Previous context
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-sm font-mono text-muted-foreground bg-muted/50 p-3 rounded">
                        {data.context.previousChunk.content}
                      </pre>
                    </details>
                  )}
                  {data.context.nextChunk && (
                    <details className="mt-2">
                      <summary className="text-sm text-muted-foreground cursor-pointer">
                        Next context
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap text-sm font-mono text-muted-foreground bg-muted/50 p-3 rounded">
                        {data.context.nextChunk.content}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
