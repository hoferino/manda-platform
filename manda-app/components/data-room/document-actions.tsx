/**
 * Document Actions Component
 * Dropdown menu with document actions: View, Download, Delete
 * Story: E2.6 - Implement Document Actions (View, Download, Delete)
 *
 * Features:
 * - Actions dropdown with keyboard navigation (AC: #1, #8)
 * - View action opens document in new tab (AC: #2)
 * - Download with signed URL (AC: #3)
 * - Delete with confirmation dialog (AC: #4, #5)
 * - Processing state disables destructive actions (AC: #7)
 */

'use client'

import { useState, useCallback } from 'react'
import {
  MoreVertical,
  Eye,
  Download,
  Trash2,
  FolderInput,
  Edit,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { Document } from '@/lib/api/documents'
import { downloadDocument, getDocument } from '@/lib/api/documents'
import { toast } from 'sonner'

export interface DocumentActionsProps {
  document: Document
  onView?: (document: Document) => void
  onDownload?: (document: Document) => void
  onDelete?: (document: Document) => void
  onMove?: (document: Document) => void
  onRename?: (document: Document) => void
  className?: string
  triggerClassName?: string
  /** Show as visible or only on hover */
  alwaysVisible?: boolean
}

/**
 * Check if document is in a state where destructive actions should be disabled
 * E3.6: Updated to use isProcessingInProgress from processing-status-badge
 */
function isProcessingDocument(document: Document): boolean {
  // Check upload status
  if (document.uploadStatus === 'uploading' || document.uploadStatus === 'pending') {
    return true
  }
  // Check processing status (parsing, embedding, analyzing are all "in progress")
  const inProgressStatuses = ['parsing', 'embedding', 'analyzing']
  return inProgressStatuses.includes(document.processingStatus)
}

/**
 * Check if document can be downloaded (upload must be completed)
 */
function canDownload(document: Document): boolean {
  return document.uploadStatus === 'completed'
}

/**
 * Get processing status tooltip message
 * E3.6: Updated for new granular processing statuses
 */
function getProcessingTooltip(document: Document): string | null {
  if (document.uploadStatus === 'uploading') {
    return 'Document is still uploading'
  }
  if (document.uploadStatus === 'pending') {
    return 'Upload is pending'
  }
  // Check for any in-progress processing status
  const inProgressStatuses = ['parsing', 'embedding', 'analyzing']
  if (inProgressStatuses.includes(document.processingStatus)) {
    return 'Document is being processed'
  }
  return null
}

/**
 * Document Actions Dropdown Component
 */
export function DocumentActions({
  document,
  onView,
  onDownload,
  onDelete,
  onMove,
  onRename,
  className,
  triggerClassName,
  alwaysVisible = false,
}: DocumentActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isViewing, setIsViewing] = useState(false)

  const processing = isProcessingDocument(document)
  const downloadable = canDownload(document)
  const processingTooltip = getProcessingTooltip(document)

  // Handle View action - opens document in new tab via signed URL
  const handleView = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsOpen(false)

      if (onView) {
        onView(document)
        return
      }

      // Default behavior: fetch signed URL and open in new tab
      setIsViewing(true)
      try {
        const { document: docWithUrl, error } = await getDocument(document.id)

        if (error || !docWithUrl) {
          toast.error(error || 'Failed to get document URL')
          return
        }

        if (!docWithUrl.downloadUrl) {
          toast.error('Document URL not available')
          return
        }

        // Open in new tab for viewing
        window.open(docWithUrl.downloadUrl, '_blank', 'noopener,noreferrer')
      } catch (err) {
        toast.error('Failed to open document')
      } finally {
        setIsViewing(false)
      }
    },
    [document, onView]
  )

  // Handle Download action
  const handleDownload = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsOpen(false)

      if (onDownload) {
        onDownload(document)
        return
      }

      // Default behavior: download using the API
      setIsDownloading(true)
      try {
        const result = await downloadDocument(document.id)
        if (!result.success) {
          toast.error(result.error || 'Download failed', {
            action: {
              label: 'Retry',
              onClick: () => handleDownload(e),
            },
          })
        }
      } catch (err) {
        toast.error('Download failed', {
          action: {
            label: 'Retry',
            onClick: () => handleDownload(e),
          },
        })
      } finally {
        setIsDownloading(false)
      }
    },
    [document, onDownload]
  )

  // Handle Delete action - triggers confirmation
  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsOpen(false)
      onDelete?.(document)
    },
    [document, onDelete]
  )

  // Handle Move action
  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsOpen(false)
      onMove?.(document)
    },
    [document, onMove]
  )

  // Handle Rename action
  const handleRename = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      setIsOpen(false)
      onRename?.(document)
    },
    [document, onRename]
  )

  return (
    <TooltipProvider>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={
              triggerClassName ||
              `h-8 w-8 p-0 ${alwaysVisible ? '' : 'invisible group-hover:visible'}`
            }
            onClick={(e) => e.stopPropagation()}
            aria-label="Document actions"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className={className || 'w-40'}>
          {/* View */}
          <DropdownMenuItem
            onClick={handleView}
            disabled={!downloadable || isViewing}
          >
            {isViewing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            View
          </DropdownMenuItem>

          {/* Download */}
          <DropdownMenuItem
            onClick={handleDownload}
            disabled={!downloadable || isDownloading}
          >
            {isDownloading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download
          </DropdownMenuItem>

          {/* Rename */}
          {onRename && (
            <DropdownMenuItem onClick={handleRename}>
              <Edit className="mr-2 h-4 w-4" />
              Rename
            </DropdownMenuItem>
          )}

          {/* Move */}
          {onMove && (
            <DropdownMenuItem onClick={handleMove}>
              <FolderInput className="mr-2 h-4 w-4" />
              Move to...
            </DropdownMenuItem>
          )}

          {/* Delete with separator */}
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              {processing ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <DropdownMenuItem
                        disabled
                        className="text-muted-foreground"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="left">
                    <p>{processingTooltip || 'Cannot delete while processing'}</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <DropdownMenuItem
                  onClick={handleDelete}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  )
}
