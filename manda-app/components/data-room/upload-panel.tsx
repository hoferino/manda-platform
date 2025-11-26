/**
 * Upload Panel Component
 * Story: E2.7 - Build Upload Progress Indicators and WebSocket Updates
 * Combined upload zone and progress list for data room integration
 *
 * Features:
 * - Upload zone with drag-drop
 * - Progress list with status
 * - Collapsible panel
 * - Integration with upload processor
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { ChevronDown, ChevronUp, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { UploadZone } from './upload-zone'
import { UploadProgress } from './upload-progress'
import { useUploadStore } from '@/stores/upload-store'
import { useUploadProcessor, storeFileForRetry } from '@/hooks/use-upload-processor'

export interface UploadPanelProps {
  /** Project ID for uploads */
  projectId: string
  /** Target folder path (optional) */
  folderPath?: string | null
  /** Custom className */
  className?: string
  /** Start collapsed */
  defaultCollapsed?: boolean
  /** Callback when upload completes */
  onUploadComplete?: () => void
}

export function UploadPanel({
  projectId,
  folderPath,
  className,
  defaultCollapsed = false,
  onUploadComplete,
}: UploadPanelProps) {
  const [isExpanded, setIsExpanded] = useState(!defaultCollapsed)
  const [showDropZone, setShowDropZone] = useState(true)

  // Initialize upload processor
  useUploadProcessor()

  const uploads = useUploadStore((state) =>
    state.uploads.filter((u) => u.projectId === projectId)
  )
  const addToQueue = useUploadStore((state) => state.addToQueue)

  // Track if we have active uploads
  const hasActiveUploads = uploads.some(
    (u) => u.status === 'queued' || u.status === 'uploading'
  )
  const hasAnyUploads = uploads.length > 0

  // Handle files added to queue
  const handleFilesAdded = useCallback(
    (files: File[]) => {
      // Store files for potential retry
      const items = useUploadStore.getState().uploads.slice(-files.length)
      items.forEach((item, index) => {
        const file = files[index]
        if (file) {
          storeFileForRetry(item.id, file)
        }
      })

      // Auto-expand when files are added
      setIsExpanded(true)
      setShowDropZone(false)
    },
    []
  )

  // Watch for completed uploads
  useEffect(() => {
    const completedCount = uploads.filter((u) => u.status === 'completed').length
    const prevCompletedRef = { current: 0 }

    if (completedCount > prevCompletedRef.current) {
      onUploadComplete?.()
    }
    prevCompletedRef.current = completedCount
  }, [uploads, onUploadComplete])

  // Show drop zone again when all uploads complete
  useEffect(() => {
    if (!hasActiveUploads && hasAnyUploads) {
      const timer = setTimeout(() => {
        setShowDropZone(true)
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [hasActiveUploads, hasAnyUploads])

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with toggle */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <Upload className="h-4 w-4" />
          <span className="font-medium">Upload</span>
          {hasActiveUploads && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
              {uploads.filter((u) => u.status === 'queued' || u.status === 'uploading').length}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        {!isExpanded && hasActiveUploads && (
          <div className="text-xs text-muted-foreground">
            Uploading...
          </div>
        )}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="space-y-3">
          {/* Upload zone */}
          {(showDropZone || !hasAnyUploads) && (
            <UploadZone
              projectId={projectId}
              folderPath={folderPath}
              onFilesAdded={handleFilesAdded}
              compact
            />
          )}

          {/* Progress list */}
          {hasAnyUploads && (
            <UploadProgress
              projectId={projectId}
              compact
            />
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Minimal upload button with dropdown
 * For use in toolbar/header
 */
export function UploadButton({
  projectId,
  folderPath,
  className,
}: {
  projectId: string
  folderPath?: string | null
  className?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const addToQueue = useUploadStore((state) => state.addToQueue)
  const pendingCount = useUploadStore((state) => state.getPendingCount())

  // Initialize processor at this level
  useUploadProcessor()

  const handleFilesAdded = useCallback(
    (files: File[]) => {
      // Store files for retry
      const items = useUploadStore.getState().uploads.slice(-files.length)
      items.forEach((item, index) => {
        const file = files[index]
        if (file) {
          storeFileForRetry(item.id, file)
        }
      })
    },
    []
  )

  return (
    <div className={cn('relative', className)}>
      <Button
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="gap-2"
      >
        <Upload className="h-4 w-4" />
        Upload
        {pendingCount > 0 && (
          <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
            {pendingCount}
          </span>
        )}
      </Button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown panel */}
          <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border bg-background p-4 shadow-lg">
            <UploadZone
              projectId={projectId}
              folderPath={folderPath}
              onFilesAdded={(files) => {
                handleFilesAdded(files)
                // Keep panel open to show progress
              }}
              compact
            />

            <UploadProgress
              projectId={projectId}
              className="mt-3"
              activeOnly
            />
          </div>
        </>
      )}
    </div>
  )
}
