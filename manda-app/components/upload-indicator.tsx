/**
 * Upload Indicator Component
 * Story: E2.7 - Build Upload Progress Indicators and WebSocket Updates
 * Acceptance Criteria: AC8 (Background Upload Tracking)
 *
 * Features:
 * - Shows in header when uploads are in progress
 * - Badge with pending count
 * - Click to expand upload details
 * - Persists across navigation
 */

'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { useUploadStore, getOverallProgress } from '@/stores/upload-store'
import { UploadProgress } from '@/components/data-room/upload-progress'
import { useUploadProcessor } from '@/hooks/use-upload-processor'

export interface UploadIndicatorProps {
  className?: string
}

export function UploadIndicator({ className }: UploadIndicatorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Initialize upload processor at app level
  useUploadProcessor()

  const uploads = useUploadStore((state) => state.uploads)
  const pendingCount = useUploadStore((state) => state.getPendingCount())

  // Calculate stats
  const activeUploads = uploads.filter(
    (u) => u.status === 'queued' || u.status === 'uploading'
  )
  const failedUploads = uploads.filter((u) => u.status === 'failed')
  const overallProgress = getOverallProgress(activeUploads)

  // Close panel when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Don't render if no uploads at all
  if (uploads.length === 0) {
    return null
  }

  // Only show indicator if there are active or failed uploads
  const shouldShow = pendingCount > 0 || failedUploads.length > 0

  if (!shouldShow) {
    return null
  }

  return (
    <div className={cn('relative', className)} ref={panelRef}>
      {/* Indicator button */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'relative gap-2 px-3',
          pendingCount > 0 && 'text-primary',
          failedUploads.length > 0 && pendingCount === 0 && 'text-destructive'
        )}
        onClick={() => setIsOpen(!isOpen)}
        title={`${pendingCount} upload${pendingCount !== 1 ? 's' : ''} in progress`}
      >
        {pendingCount > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}

        {/* Count badge */}
        <span className="tabular-nums">
          {pendingCount > 0 ? pendingCount : failedUploads.length}
        </span>

        {/* Mini progress bar when uploading */}
        {pendingCount > 0 && (
          <div className="hidden items-center gap-1.5 sm:flex">
            <Progress value={overallProgress} className="h-1 w-12" />
            <span className="text-xs tabular-nums">{overallProgress}%</span>
          </div>
        )}

        {/* Dropdown indicator */}
        {isOpen ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}

        {/* Notification dot for failed uploads */}
        {failedUploads.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
        )}
      </Button>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute right-0 top-full z-50 mt-2 w-96 rounded-lg border bg-background shadow-lg',
            'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2'
          )}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-medium">Uploads</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsOpen(false)}
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Upload progress list */}
          <div className="max-h-80 overflow-y-auto">
            <UploadProgress
              className="border-none shadow-none"
              collapsed={isCollapsed}
              onToggleCollapsed={() => setIsCollapsed(!isCollapsed)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
