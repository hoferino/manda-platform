/**
 * SourceAttributionLink Component
 * Clickable source attribution links for findings
 * Story: E4.5 - Implement Source Attribution Links (AC: 1, 6)
 *
 * Features:
 * - Formatted link text: "document.xlsx, Sheet 'P&L', Cell B15"
 * - Monospace font with hover highlighting
 * - Tooltip with full source path
 * - Click handler to open DocumentPreviewModal
 * - ARIA labels for accessibility
 */

'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { FileText, FileSpreadsheet, FileIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DocumentPreviewModal } from './DocumentPreviewModal'

export interface SourceAttributionLinkProps {
  documentId: string
  documentName: string
  chunkId: string | null
  pageNumber: number | null
  sheetName: string | null
  cellReference: string | null
  projectId: string
  className?: string
}

/**
 * Get the appropriate icon for the document type
 */
function getDocumentIcon(documentName: string) {
  const extension = documentName.split('.').pop()?.toLowerCase()

  if (['xlsx', 'xls', 'csv'].includes(extension || '')) {
    return FileSpreadsheet
  }
  if (['pdf', 'doc', 'docx', 'txt'].includes(extension || '')) {
    return FileText
  }
  return FileIcon
}

/**
 * Format the source reference string
 * Examples:
 * - "financial_model.xlsx, Sheet 'P&L', Cell B15"
 * - "report.pdf, p.15"
 * - "document.docx"
 */
function formatSourceReference({
  documentName,
  pageNumber,
  sheetName,
  cellReference,
}: Pick<SourceAttributionLinkProps, 'documentName' | 'pageNumber' | 'sheetName' | 'cellReference'>): string {
  const parts: string[] = [documentName]

  if (sheetName) {
    parts.push(`Sheet '${sheetName}'`)
  }

  if (cellReference) {
    parts.push(`Cell ${cellReference}`)
  } else if (pageNumber !== null && pageNumber !== undefined) {
    parts.push(`p.${pageNumber}`)
  }

  return parts.join(', ')
}

/**
 * Build the full source path for tooltip
 */
function buildFullSourcePath({
  documentName,
  pageNumber,
  sheetName,
  cellReference,
}: Pick<SourceAttributionLinkProps, 'documentName' | 'pageNumber' | 'sheetName' | 'cellReference'>): string {
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

export function SourceAttributionLink({
  documentId,
  documentName,
  chunkId,
  pageNumber,
  sheetName,
  cellReference,
  projectId,
  className,
}: SourceAttributionLinkProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const Icon = useMemo(() => getDocumentIcon(documentName), [documentName])

  const displayText = useMemo(
    () => formatSourceReference({ documentName, pageNumber, sheetName, cellReference }),
    [documentName, pageNumber, sheetName, cellReference]
  )

  const fullPath = useMemo(
    () => buildFullSourcePath({ documentName, pageNumber, sheetName, cellReference }),
    [documentName, pageNumber, sheetName, cellReference]
  )

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsModalOpen(true)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      setIsModalOpen(true)
    }
  }, [])

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false)
  }, [])

  return (
    <>
      <TooltipProvider>
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleClick}
              onKeyDown={handleKeyDown}
              className={cn(
                'inline-flex items-center gap-1.5 text-sm',
                'font-mono text-muted-foreground',
                'hover:text-foreground hover:underline',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-sm',
                'transition-colors duration-150',
                'cursor-pointer',
                className
              )}
              aria-label={`View source: ${fullPath}`}
              aria-haspopup="dialog"
            >
              <Icon
                className="h-3.5 w-3.5 flex-shrink-0"
                aria-hidden="true"
              />
              <span className="truncate max-w-[250px]">{displayText}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-md">
            <p className="text-xs font-mono">{fullPath}</p>
            <p className="text-xs text-muted-foreground mt-1">Click to view source</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DocumentPreviewModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        documentId={documentId}
        documentName={documentName}
        chunkId={chunkId}
        pageNumber={pageNumber}
        sheetName={sheetName}
        cellReference={cellReference}
        projectId={projectId}
      />
    </>
  )
}
