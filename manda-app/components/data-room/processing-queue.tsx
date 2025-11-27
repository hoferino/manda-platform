/**
 * Processing Queue Component
 * Displays documents currently being processed or queued
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #1, #2, #5)
 *
 * Features:
 * - Collapsible panel showing queue status
 * - Real-time updates via document change subscription
 * - Empty state when no documents are processing
 * - Cancel and retry actions
 */

'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { toast } from 'sonner'
import { QueueItem } from './queue-item'
import { useProcessingQueue, useDocumentUpdates, type DocumentUpdate } from '@/lib/hooks'
import { cancelQueueJob } from '@/lib/api/processing'

export interface ProcessingQueueProps {
  projectId: string
  className?: string
}

/**
 * Processing Queue Panel Component
 * Shows documents in the processing queue with real-time updates
 */
export function ProcessingQueue({ projectId, className }: ProcessingQueueProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  const {
    jobs,
    total,
    isLoading,
    error,
    refetch,
  } = useProcessingQueue(projectId, {
    pollingInterval: 10000, // Poll every 10 seconds as backup
  })

  // Subscribe to document updates for real-time queue changes
  useDocumentUpdates(projectId, {
    onUpdate: useCallback((update: DocumentUpdate) => {
      // Refetch queue when document status changes to processing-related state
      const processingStatuses = ['pending', 'parsing', 'embedding', 'analyzing']
      if (
        update.type === 'UPDATE' &&
        (processingStatuses.includes(update.document.processingStatus) ||
          (update.oldDocument &&
            processingStatuses.includes(update.oldDocument.processingStatus)))
      ) {
        refetch()
      }
      // Also refetch on INSERT (new document uploaded)
      if (update.type === 'INSERT') {
        refetch()
      }
    }, [refetch]),
  })

  // Handle cancel job
  const handleCancel = useCallback(async (jobId: string) => {
    try {
      await cancelQueueJob(jobId, projectId)
      toast.success('Job cancelled')
      await refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel job'
      toast.error(message)
      throw err // Re-throw to let QueueItem know it failed
    }
  }, [projectId, refetch])

  // Handle retry - calls the existing retry endpoint
  const handleRetry = useCallback(async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/retry`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to retry')
      }

      toast.success('Processing restarted')
      await refetch()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to retry processing'
      toast.error(message)
      throw err
    }
  }, [refetch])

  // Don't render if queue is empty and not loading
  if (!isLoading && jobs.length === 0 && !error) {
    return null
  }

  // Get counts by status
  const queuedCount = jobs.filter((j) => j.status === 'queued').length
  const processingCount = jobs.filter((j) => j.status === 'processing').length
  const failedCount = jobs.filter((j) => j.status === 'failed').length

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={setIsExpanded}
      className={cn('rounded-lg border bg-card', className)}
    >
      {/* Header */}
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : error ? (
              <AlertCircle className="h-4 w-4 text-red-500" />
            ) : processingCount > 0 ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            ) : (
              <div className="h-4 w-4 rounded-full bg-muted" />
            )}
            <span className="font-medium text-sm">Processing Queue</span>
            <span className="text-xs text-muted-foreground">
              ({total} {total === 1 ? 'item' : 'items'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Status badges */}
            {processingCount > 0 && (
              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                {processingCount} processing
              </span>
            )}
            {queuedCount > 0 && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                {queuedCount} queued
              </span>
            )}
            {failedCount > 0 && (
              <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                {failedCount} failed
              </span>
            )}

            {/* Expand/collapse icon */}
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
      </CollapsibleTrigger>

      {/* Content */}
      <CollapsibleContent>
        <div className="border-t px-4 py-3">
          {/* Error state */}
          {error && (
            <div className="flex items-center justify-between rounded-lg bg-red-50 p-3 text-red-700">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">Failed to load queue</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetch()}
                className="text-red-700 hover:text-red-800 hover:bg-red-100"
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Retry
              </Button>
            </div>
          )}

          {/* Loading state */}
          {isLoading && jobs.length === 0 && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Job list */}
          {!error && jobs.length > 0 && (
            <div className="space-y-2">
              {jobs.map((job) => (
                <QueueItem
                  key={job.id}
                  job={job}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                />
              ))}
            </div>
          )}

          {/* Empty state after loading */}
          {!isLoading && !error && jobs.length === 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No documents in queue
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
