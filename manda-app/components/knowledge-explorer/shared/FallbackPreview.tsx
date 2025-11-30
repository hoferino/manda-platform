/**
 * FallbackPreview Component
 * Fallback UI when document preview is not available
 * Story: E4.5 - Implement Source Attribution Links (AC: 5)
 *
 * Features:
 * - "Preview not available" message
 * - Download link using GCS signed URL
 * - Document metadata display (name, size, upload date)
 * - Handle documents with processing_status != 'completed'
 */

'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  FileIcon,
  Download,
  AlertCircle,
  Clock,
  FileQuestion,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DocumentData } from './DocumentPreviewModal'

export interface FallbackPreviewProps {
  documentId: string
  documentName: string
  projectId: string
  document: DocumentData | null
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return 'Unknown size'

  const units = ['B', 'KB', 'MB', 'GB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`
}

/**
 * Format date for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Unknown date'

  try {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return 'Unknown date'
  }
}

/**
 * Get status display info
 */
function getStatusInfo(status: string): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  icon: typeof Clock
} {
  switch (status) {
    case 'completed':
      return { label: 'Processed', variant: 'default', icon: FileIcon }
    case 'processing':
      return { label: 'Processing', variant: 'secondary', icon: Clock }
    case 'pending':
      return { label: 'Pending', variant: 'outline', icon: Clock }
    case 'failed':
      return { label: 'Failed', variant: 'destructive', icon: AlertCircle }
    default:
      return { label: status, variant: 'outline', icon: FileQuestion }
  }
}

export function FallbackPreview({
  documentId,
  documentName,
  projectId,
  document,
}: FallbackPreviewProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const processingStatus = document?.processingStatus || 'unknown'
  const statusInfo = getStatusInfo(processingStatus)
  const StatusIcon = statusInfo.icon

  // Handle download
  const handleDownload = useCallback(async () => {
    setIsDownloading(true)
    setDownloadError(null)

    try {
      // Get signed download URL from API
      const response = await fetch(
        `/api/projects/${projectId}/documents/${documentId}/download`
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to get download URL')
      }

      const { url } = await response.json()

      // Trigger download
      const link = window.document.createElement('a')
      link.href = url
      link.download = documentName
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      window.document.body.appendChild(link)
      link.click()
      window.document.body.removeChild(link)
    } catch (err) {
      console.error('[FallbackPreview] Download error:', err)
      setDownloadError(err instanceof Error ? err.message : 'Failed to download')
    } finally {
      setIsDownloading(false)
    }
  }, [documentId, documentName, projectId])

  return (
    <div className="p-6 space-y-6">
      {/* Main message */}
      <Alert>
        <FileQuestion className="h-4 w-4" />
        <AlertTitle>Document preview not available</AlertTitle>
        <AlertDescription>
          {processingStatus === 'completed'
            ? 'The document content could not be displayed. You can download the original file instead.'
            : processingStatus === 'processing'
              ? 'This document is currently being processed. Preview will be available once processing completes.'
              : processingStatus === 'pending'
                ? 'This document is queued for processing. Preview will be available after processing.'
                : processingStatus === 'failed'
                  ? 'Document processing failed. You can still download the original file.'
                  : 'Document preview is not available for this file type or status.'}
        </AlertDescription>
      </Alert>

      {/* Document metadata */}
      <div className="bg-muted rounded-lg p-4 space-y-3">
        <div className="flex items-start gap-3">
          <FileIcon className="h-10 w-10 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-medium truncate" title={documentName}>
              {documentName}
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {document?.fileSize !== null && document?.fileSize !== undefined && (
                <span>{formatFileSize(document.fileSize)}</span>
              )}
              {document?.uploadedAt && (
                <>
                  <span className="text-muted-foreground/50">•</span>
                  <span>Uploaded {formatDate(document.uploadedAt)}</span>
                </>
              )}
            </div>
          </div>
          <Badge variant={statusInfo.variant} className="flex-shrink-0 gap-1">
            <StatusIcon className="h-3 w-3" />
            {statusInfo.label}
          </Badge>
        </div>
      </div>

      {/* Download section */}
      <div className="flex flex-col items-center gap-3">
        <Button
          onClick={handleDownload}
          disabled={isDownloading}
          variant="outline"
          size="lg"
          className="gap-2"
        >
          {isDownloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing download...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download original file
            </>
          )}
        </Button>

        {downloadError && (
          <p className="text-sm text-destructive">{downloadError}</p>
        )}

        <p className="text-xs text-muted-foreground text-center max-w-md">
          Download the original file to view its complete contents.
          {document?.mimeType && (
            <span className="block mt-1 font-mono">{document.mimeType}</span>
          )}
        </p>
      </div>
    </div>
  )
}
