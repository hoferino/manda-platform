'use client'

/**
 * SourceCitationLink Component
 *
 * Clickable source citation link for chat messages.
 * Adapted from knowledge-explorer's SourceAttributionLink for chat context.
 * Story: E5.4 - Implement Source Citation Display in Messages
 * AC: #2 (Clickable Links), #5 (Citation Styling)
 *
 * Features:
 * - Monospace font with subtle background
 * - Document type icon
 * - Hover underline indicating clickability
 * - Opens DocumentPreviewModal on click
 * - ARIA labels for accessibility
 * - Mobile-friendly touch targets
 */

import { useState, useCallback, useMemo, memo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FileText, FileSpreadsheet, FileIcon, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentPreviewModal } from '@/components/knowledge-explorer/shared/DocumentPreviewModal'

export interface SourceCitationLinkProps {
  /** Document ID for viewer integration (optional - enables preview modal) */
  documentId?: string | null
  /** Document filename */
  documentName: string
  /** Location string (e.g., "p.15", "Sheet 'P&L', Cell B15") */
  location: string
  /** Chunk ID for chunk-level navigation */
  chunkId?: string | null
  /** Page number for PDFs */
  pageNumber?: number | null
  /** Sheet name for Excel files */
  sheetName?: string | null
  /** Cell reference for Excel files */
  cellReference?: string | null
  /** Project ID for document access */
  projectId: string
  /** Additional CSS classes */
  className?: string
  /** Whether document is unavailable (fallback mode) */
  isUnavailable?: boolean
}

/**
 * Get the appropriate icon for the document type
 */
function getDocumentIcon(documentName: string) {
  const extension = documentName.split('.').pop()?.toLowerCase()

  if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
    return FileSpreadsheet
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md'].includes(extension || '')) {
    return FileText
  }
  return FileIcon
}

/**
 * Format the display text for the citation
 * Examples:
 * - "financial_model.xlsx, Sheet 'P&L', Cell B15"
 * - "report.pdf, p.15"
 * - "document.docx"
 */
function formatDisplayText({
  documentName,
  location,
}: Pick<SourceCitationLinkProps, 'documentName' | 'location'>): string {
  if (!location) {
    return documentName
  }
  return `${documentName}, ${location}`
}

/**
 * Build full source path for tooltip
 */
function buildFullPath({
  documentName,
  pageNumber,
  sheetName,
  cellReference,
}: Pick<SourceCitationLinkProps, 'documentName' | 'pageNumber' | 'sheetName' | 'cellReference'>): string {
  let path = documentName

  if (sheetName) {
    path += ` > ${sheetName}`
  }

  if (cellReference) {
    path += ` > ${cellReference}`
  }

  if (pageNumber !== null && pageNumber !== undefined) {
    path += ` > Page ${pageNumber}`
  }

  return path
}

export const SourceCitationLink = memo(function SourceCitationLink({
  documentId,
  documentName,
  location,
  chunkId,
  pageNumber,
  sheetName,
  cellReference,
  projectId,
  className,
  isUnavailable = false,
}: SourceCitationLinkProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const Icon = useMemo(() => {
    if (isUnavailable) return AlertCircle
    return getDocumentIcon(documentName)
  }, [documentName, isUnavailable])

  const displayText = useMemo(
    () => formatDisplayText({ documentName, location }),
    [documentName, location]
  )

  const fullPath = useMemo(
    () => buildFullPath({ documentName, pageNumber, sheetName, cellReference }),
    [documentName, pageNumber, sheetName, cellReference]
  )

  const canOpenPreview = !!documentId && !isUnavailable

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canOpenPreview) {
      setIsModalOpen(true)
    }
  }, [canOpenPreview])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && canOpenPreview) {
      e.preventDefault()
      e.stopPropagation()
      setIsModalOpen(true)
    }
  }, [canOpenPreview])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  const content = (
    <span
      role={canOpenPreview ? 'button' : undefined}
      tabIndex={canOpenPreview ? 0 : undefined}
      onClick={canOpenPreview ? handleClick : undefined}
      onKeyDown={canOpenPreview ? handleKeyDown : undefined}
      className={cn(
        // Base styling
        'inline-flex items-center gap-1 text-xs',
        'font-mono rounded px-1.5 py-0.5 mx-0.5',
        // Min touch target for mobile (AC: #8)
        'min-h-[28px]',
        // Interactive states
        canOpenPreview && [
          'bg-muted/80 text-foreground',
          'hover:bg-muted hover:underline',
          'cursor-pointer',
          'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        ],
        // Fallback/unavailable state
        isUnavailable && [
          'bg-muted/50 text-muted-foreground',
          'cursor-default',
        ],
        // Non-clickable state (no documentId)
        !canOpenPreview && !isUnavailable && [
          'bg-muted/80 text-muted-foreground',
          'cursor-default',
        ],
        'transition-colors duration-150',
        className
      )}
      aria-label={canOpenPreview ? `View source: ${fullPath}` : `Source: ${fullPath}`}
      aria-haspopup={canOpenPreview ? 'dialog' : undefined}
      data-testid="source-citation-link"
    >
      <Icon
        className={cn(
          'h-3 w-3 flex-shrink-0',
          isUnavailable && 'text-yellow-500'
        )}
        aria-hidden="true"
      />
      <span className="truncate max-w-[200px] sm:max-w-[300px]">
        {displayText}
      </span>
    </span>
  )

  return (
    <>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md">
            <p className="text-xs font-mono">{fullPath}</p>
            {canOpenPreview && (
              <p className="text-xs text-muted-foreground mt-1">Click to view source</p>
            )}
            {isUnavailable && (
              <p className="text-xs text-yellow-600 mt-1">Document not found</p>
            )}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Document Preview Modal */}
      {documentId && (
        <DocumentPreviewModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          documentId={documentId}
          documentName={documentName}
          chunkId={chunkId ?? null}
          pageNumber={pageNumber ?? null}
          sheetName={sheetName ?? null}
          cellReference={cellReference ?? null}
          projectId={projectId}
        />
      )}
    </>
  )
})
