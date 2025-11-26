/**
 * Upload Progress Component
 * Story: E2.7 - Build Upload Progress Indicators and WebSocket Updates
 * Acceptance Criteria: AC3 (Progress Bars), AC4 (Status States), AC5 (Retry), AC6 (Bulk Upload)
 *
 * Features:
 * - Individual progress bars per file (AC3)
 * - Status icons per state (AC4)
 * - Retry functionality (AC5)
 * - Bulk upload list with cancel (AC6)
 */

'use client'

import { memo, useCallback } from 'react'
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  File,
  FileText,
  FileSpreadsheet,
  Image,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  useUploadStore,
  type UploadItem,
  type UploadStatus,
  getOverallProgress,
} from '@/stores/upload-store'
import { formatFileSize } from '@/lib/api/documents'

export interface UploadProgressProps {
  /** Project ID to filter uploads */
  projectId?: string
  /** Custom className */
  className?: string
  /** Show compact version */
  compact?: boolean
  /** Show only active uploads (not completed) */
  activeOnly?: boolean
  /** Whether the panel is collapsed */
  collapsed?: boolean
  /** Toggle collapsed state */
  onToggleCollapsed?: () => void
}

/** Get icon for upload status */
function getStatusIcon(status: UploadStatus, className?: string) {
  switch (status) {
    case 'queued':
      return <Clock className={cn('h-4 w-4 text-muted-foreground', className)} />
    case 'uploading':
      return <Loader2 className={cn('h-4 w-4 animate-spin text-primary', className)} />
    case 'completed':
      return <CheckCircle2 className={cn('h-4 w-4 text-green-500', className)} />
    case 'failed':
      return <XCircle className={cn('h-4 w-4 text-destructive', className)} />
  }
}

/** Get status label */
function getStatusLabel(status: UploadStatus, progress: number): string {
  switch (status) {
    case 'queued':
      return 'Queued'
    case 'uploading':
      return `${progress}%`
    case 'completed':
      return 'Complete'
    case 'failed':
      return 'Failed'
  }
}

/** Get file icon based on MIME type */
function getFileIcon(mimeType: string, className?: string) {
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className={cn('h-4 w-4', className)} />
  }
  if (mimeType.includes('image')) {
    return <Image className={cn('h-4 w-4', className)} />
  }
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word')
  ) {
    return <FileText className={cn('h-4 w-4', className)} />
  }
  return <File className={cn('h-4 w-4', className)} />
}

/** Single upload item row */
const UploadItemRow = memo(function UploadItemRow({
  item,
  onRetry,
  onCancel,
  compact = false,
}: {
  item: UploadItem
  onRetry?: (id: string) => void
  onCancel?: (id: string) => void
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-md border bg-card p-3 transition-colors',
        item.status === 'failed' && 'border-destructive/30 bg-destructive/5',
        item.status === 'completed' && 'border-green-500/30 bg-green-500/5'
      )}
    >
      {/* File icon */}
      <div className="shrink-0">
        {getFileIcon(item.mimeType, 'text-muted-foreground')}
      </div>

      {/* File info and progress */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium">{item.fileName}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {getStatusIcon(item.status)}
            <span
              className={cn(
                'text-xs',
                item.status === 'completed' && 'text-green-500',
                item.status === 'failed' && 'text-destructive',
                item.status === 'uploading' && 'font-medium text-primary',
                item.status === 'queued' && 'text-muted-foreground'
              )}
            >
              {getStatusLabel(item.status, item.progress)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        {(item.status === 'uploading' || item.status === 'queued') && (
          <div className="mt-2">
            <Progress value={item.progress} className="h-1.5" />
          </div>
        )}

        {/* File size and error message */}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {formatFileSize(item.fileSize)}
          </span>
          {item.status === 'failed' && item.error && (
            <span className="text-xs text-destructive">{item.error}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {/* Retry button for failed uploads */}
        {item.status === 'failed' && onRetry && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onRetry(item.id)}
            title="Retry upload"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span className="sr-only">Retry</span>
          </Button>
        )}

        {/* Cancel/remove button */}
        {onCancel && (item.status === 'queued' || item.status === 'failed') && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onCancel(item.id)}
            title="Remove"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Remove</span>
          </Button>
        )}
      </div>
    </div>
  )
})

export function UploadProgress({
  projectId,
  className,
  compact = false,
  activeOnly = false,
  collapsed = false,
  onToggleCollapsed,
}: UploadProgressProps) {
  const uploads = useUploadStore((state) => state.uploads)
  const removeUpload = useUploadStore((state) => state.removeUpload)
  const clearCompleted = useUploadStore((state) => state.clearCompleted)

  // Filter uploads
  let filteredUploads = projectId
    ? uploads.filter((u) => u.projectId === projectId)
    : uploads

  if (activeOnly) {
    filteredUploads = filteredUploads.filter(
      (u) => u.status !== 'completed'
    )
  }

  // Sort: uploading first, then queued, then failed, then completed
  const sortedUploads = [...filteredUploads].sort((a, b) => {
    const order: Record<UploadStatus, number> = {
      uploading: 0,
      queued: 1,
      failed: 2,
      completed: 3,
    }
    return order[a.status] - order[b.status]
  })

  // Calculate stats
  const pendingCount = filteredUploads.filter(
    (u) => u.status === 'queued' || u.status === 'uploading'
  ).length
  const completedCount = filteredUploads.filter(
    (u) => u.status === 'completed'
  ).length
  const failedCount = filteredUploads.filter((u) => u.status === 'failed').length
  const overallProgress = getOverallProgress(
    filteredUploads.filter((u) => u.status !== 'completed')
  )

  const handleRetry = useCallback(
    (id: string) => {
      // Note: Retry requires the original File object
      // This will be handled by the upload processor hook
      console.log('Retry requested for:', id)
    },
    []
  )

  const handleCancel = useCallback(
    (id: string) => {
      removeUpload(id)
    },
    [removeUpload]
  )

  // Don't render if no uploads
  if (sortedUploads.length === 0) {
    return null
  }

  return (
    <div className={cn('rounded-lg border bg-background shadow-sm', className)}>
      {/* Header */}
      <div
        className={cn(
          'flex items-center justify-between border-b px-4 py-3',
          onToggleCollapsed && 'cursor-pointer hover:bg-muted/50'
        )}
        onClick={onToggleCollapsed}
        role={onToggleCollapsed ? 'button' : undefined}
        tabIndex={onToggleCollapsed ? 0 : undefined}
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium">
            Uploads
            {pendingCount > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                ({pendingCount} in progress)
              </span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Overall progress when collapsed */}
          {collapsed && pendingCount > 0 && (
            <div className="flex items-center gap-2">
              <Progress value={overallProgress} className="h-1.5 w-20" />
              <span className="text-xs text-muted-foreground">
                {overallProgress}%
              </span>
            </div>
          )}

          {/* Stats badges */}
          {!collapsed && (
            <div className="flex items-center gap-1.5 text-xs">
              {completedCount > 0 && (
                <span className="flex items-center gap-1 text-green-500">
                  <CheckCircle2 className="h-3 w-3" />
                  {completedCount}
                </span>
              )}
              {failedCount > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <XCircle className="h-3 w-3" />
                  {failedCount}
                </span>
              )}
            </div>
          )}

          {/* Clear completed button */}
          {!collapsed && completedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation()
                clearCompleted()
              }}
            >
              Clear completed
            </Button>
          )}

          {/* Collapse toggle */}
          {onToggleCollapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation()
                onToggleCollapsed()
              }}
            >
              {collapsed ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Upload list */}
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto p-3">
          <div className="space-y-2">
            {sortedUploads.map((item) => (
              <UploadItemRow
                key={item.id}
                item={item}
                onRetry={handleRetry}
                onCancel={handleCancel}
                compact={compact}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/** Compact upload progress indicator (for header/navbar) */
export function UploadProgressBadge({
  className,
  onClick,
}: {
  className?: string
  onClick?: () => void
}) {
  const pendingCount = useUploadStore((state) => state.getPendingCount())
  const uploads = useUploadStore((state) => state.uploads)
  const activeUploads = uploads.filter(
    (u) => u.status === 'queued' || u.status === 'uploading'
  )
  const overallProgress = getOverallProgress(activeUploads)

  if (pendingCount === 0) {
    return null
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20',
        className
      )}
      title={`${pendingCount} upload${pendingCount > 1 ? 's' : ''} in progress`}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{pendingCount}</span>
      <Progress value={overallProgress} className="h-1.5 w-12" />
    </button>
  )
}
