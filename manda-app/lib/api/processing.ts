/**
 * Processing Queue API Client
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #3, #4)
 *
 * Client-side functions for interacting with the processing queue API.
 */

/**
 * Queue job status
 */
export type QueueJobStatus = 'queued' | 'processing' | 'failed'

/**
 * Processing stage during job execution
 */
export type ProcessingStage = 'parsing' | 'embedding' | 'analyzing' | null

/**
 * Individual job in the processing queue
 */
export interface QueueJob {
  id: string
  documentId: string
  documentName: string
  fileType: string
  status: QueueJobStatus
  processingStage: ProcessingStage
  createdAt: string
  startedAt: string | null
  timeInQueue: number // seconds
  estimatedCompletion: string | null
  retryCount: number
  error: string | null
}

/**
 * Response from queue listing endpoint
 */
export interface QueueResponse {
  jobs: QueueJob[]
  total: number
  hasMore: boolean
}

/**
 * Response from cancel endpoint
 */
export interface CancelResponse {
  success: boolean
  message: string
}

/**
 * Fetch processing queue jobs for a project
 */
export async function fetchQueueJobs(
  projectId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<QueueResponse> {
  const { limit = 20, offset = 0 } = options

  const params = new URLSearchParams({
    projectId,
    limit: limit.toString(),
    offset: offset.toString(),
  })

  const response = await fetch(`/api/processing/queue?${params}`)

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to fetch queue')
  }

  return response.json()
}

/**
 * Cancel a queued job
 */
export async function cancelQueueJob(
  jobId: string,
  projectId: string
): Promise<CancelResponse> {
  const params = new URLSearchParams({ projectId })

  const response = await fetch(`/api/processing/queue/${jobId}?${params}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.error || 'Failed to cancel job')
  }

  return response.json()
}

/**
 * Format time in queue as human-readable string
 */
export function formatTimeInQueue(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`
}

/**
 * Get estimated time remaining as human-readable string
 */
export function formatEstimatedTime(estimatedCompletion: string | null): string | null {
  if (!estimatedCompletion) return null

  const estimated = new Date(estimatedCompletion)
  const now = new Date()
  const diffMs = estimated.getTime() - now.getTime()

  if (diffMs <= 0) return 'Almost done'

  const diffSeconds = Math.floor(diffMs / 1000)
  return `~${formatTimeInQueue(diffSeconds)} remaining`
}
