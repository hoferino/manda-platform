/**
 * Queue Item Component
 * Individual entry in the processing queue
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #2)
 *
 * Features:
 * - Display document name with file type icon
 * - Show processing stage with ProcessingProgress (reuse from E3.6)
 * - Calculate and display time in queue
 * - Cancel button for queued jobs
 * - Retry button for failed jobs
 */

'use client'

import { useState } from 'react'
import { FileText, FileSpreadsheet, File, X, RefreshCw, Clock, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ProcessingProgress } from './processing-progress'
import type { QueueJob } from '@/lib/api/processing'
import { formatTimeInQueue, formatEstimatedTime } from '@/lib/api/processing'
import type { ProcessingStatus } from '@/lib/api/documents'

export interface QueueItemProps {
  job: QueueJob
  onCancel?: (jobId: string) => Promise<void>
  onRetry?: (documentId: string) => Promise<void>
  className?: string
}

/**
 * Get file type icon based on MIME type
 */
function getFileIcon(fileType: string) {
  if (fileType.includes('pdf')) {
    return FileText
  }
  if (fileType.includes('spreadsheet') || fileType.includes('excel')) {
    return FileSpreadsheet
  }
  return File
}

/**
 * Map queue job status to processing status for ProcessingProgress component
 */
function mapToProcessingStatus(job: QueueJob): ProcessingStatus {
  if (job.status === 'failed') {
    return 'failed'
  }
  if (job.status === 'processing' && job.processingStage) {
    return job.processingStage as ProcessingStatus
  }
  return 'pending'
}

/**
 * Queue Item Component
 * Displays a single job in the processing queue
 */
export function QueueItem({
  job,
  onCancel,
  onRetry,
  className,
}: QueueItemProps) {
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const FileIcon = getFileIcon(job.fileType)
  const processingStatus = mapToProcessingStatus(job)
  const estimatedTime = formatEstimatedTime(job.estimatedCompletion)

  const handleCancel = async () => {
    if (!onCancel) return
    setIsLoading(true)
    try {
      await onCancel(job.id)
    } finally {
      setIsLoading(false)
      setCancelDialogOpen(false)
    }
  }

  const handleRetry = async () => {
    if (!onRetry) return
    setIsLoading(true)
    try {
      await onRetry(job.documentId)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border bg-card p-3',
        job.status === 'failed' && 'border-red-200 bg-red-50/50',
        className
      )}
    >
      {/* File icon */}
      <div className="flex-shrink-0">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            job.status === 'failed' ? 'bg-red-100' : 'bg-muted'
          )}
        >
          <FileIcon
            className={cn(
              'h-5 w-5',
              job.status === 'failed' ? 'text-red-600' : 'text-muted-foreground'
            )}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Document name */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate" title={job.documentName}>
            {job.documentName}
          </span>
          {job.retryCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-xs text-orange-600">
                    <RefreshCw className="h-3 w-3" />
                    {job.retryCount}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Retry attempt #{job.retryCount}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>

        {/* Status and time info */}
        <div className="flex items-center gap-3 mt-1">
          {job.status === 'failed' ? (
            <div className="flex items-center gap-1 text-xs text-red-600">
              <AlertCircle className="h-3 w-3" />
              <span>Failed</span>
              {job.error && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help underline decoration-dotted">
                        (details)
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{job.error}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          ) : (
            <>
              <ProcessingProgress status={processingStatus} compact />
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{formatTimeInQueue(job.timeInQueue)}</span>
              </div>
              {estimatedTime && job.status === 'processing' && (
                <span className="text-xs text-muted-foreground">
                  {estimatedTime}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0">
        {job.status === 'queued' && onCancel && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-red-600"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Cancel job</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {job.status === 'failed' && onRetry && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-blue-600"
                  onClick={handleRetry}
                  disabled={isLoading}
                >
                  <RefreshCw className={cn('h-4 w-4', isLoading && 'animate-spin')} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Retry processing</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Processing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove &quot;{job.documentName}&quot; from the processing queue.
              You can re-upload or retry the document later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Keep in Queue</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'Cancelling...' : 'Cancel Job'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
