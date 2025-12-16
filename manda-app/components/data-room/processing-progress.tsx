/**
 * Processing Progress Component
 * Shows visual pipeline stages for document processing
 * Story: E3.6 - Create Processing Status Tracking and WebSocket Updates (AC: #3)
 * Fix: TD-011.3 - Improved formatting with properly aligned stages and labels
 *
 * Features:
 * - Visual stages: Upload → Parse → Embed → Analyze → Complete
 * - Current stage highlighted
 * - Completed stages checked
 * - Supports compact and expanded views
 */

'use client'

import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ProcessingStatus } from '@/lib/api/documents'

export interface ProcessingProgressProps {
  status: ProcessingStatus
  className?: string
  /** Compact mode shows only icons */
  compact?: boolean
}

/**
 * Pipeline stage definition
 */
interface PipelineStage {
  id: string
  label: string
  statuses: ProcessingStatus[]
}

/**
 * Processing pipeline stages in order
 * Each stage maps to one or more processing statuses
 */
const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'upload',
    label: 'Upload',
    statuses: ['pending'],
  },
  {
    id: 'parse',
    label: 'Parse',
    statuses: ['parsing', 'parsed'],
  },
  {
    id: 'embed',
    label: 'Embed',
    statuses: ['embedding'],
  },
  {
    id: 'analyze',
    label: 'Analyze',
    statuses: ['analyzing', 'analyzed'],
  },
  {
    id: 'complete',
    label: 'Complete',
    statuses: ['complete'],
  },
]

/**
 * Get the current stage index based on processing status
 */
function getCurrentStageIndex(status: ProcessingStatus): number {
  // Failed statuses don't advance the stage
  if (status === 'failed' || status === 'analysis_failed') {
    // Return the stage where failure occurred
    if (status === 'analysis_failed') {
      return 3 // Analyze stage
    }
    return -1 // Unknown failure point
  }

  for (let i = 0; i < PIPELINE_STAGES.length; i++) {
    const stage = PIPELINE_STAGES[i]
    if (stage && stage.statuses.includes(status)) {
      return i
    }
  }
  return -1
}

/**
 * Check if a stage is currently active (in progress)
 */
function isStageActive(status: ProcessingStatus, stage: PipelineStage): boolean {
  const activeStatuses: ProcessingStatus[] = ['parsing', 'embedding', 'analyzing']
  return stage.statuses.some(
    (s) => s === status && activeStatuses.includes(s)
  )
}

/**
 * Check if a status indicates failure
 */
function isFailed(status: ProcessingStatus): boolean {
  return status === 'failed' || status === 'analysis_failed'
}

/**
 * Processing Progress Component
 * Displays processing pipeline with visual progress indication
 */
export function ProcessingProgress({
  status,
  className,
  compact = false,
}: ProcessingProgressProps) {
  const currentStageIndex = getCurrentStageIndex(status)
  const failed = isFailed(status)

  // Compact mode: inline icons only
  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {PIPELINE_STAGES.map((stage, index) => {
          const isCompleted = index < currentStageIndex
          const isCurrent = index === currentStageIndex
          const isActive = isStageActive(status, stage)
          const isCurrentFailed = isCurrent && failed

          return (
            <div key={stage.id} className="flex items-center">
              <div
                className={cn(
                  'flex h-5 w-5 items-center justify-center rounded-full',
                  isCompleted && 'bg-green-100 text-green-600',
                  isCurrent && !isCurrentFailed && 'bg-blue-100 text-blue-600',
                  isCurrentFailed && 'bg-red-100 text-red-600',
                  !isCompleted && !isCurrent && 'bg-gray-100 text-gray-400'
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Circle className="h-3 w-3" />
                )}
              </div>
              {index < PIPELINE_STAGES.length - 1 && (
                <div
                  className={cn(
                    'mx-0.5 h-0.5 w-3',
                    index < currentStageIndex ? 'bg-green-300' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  // Full mode: stages with labels and progress bar
  return (
    <div className={cn('space-y-2', className)}>
      {/* Progress bar */}
      <div className="relative h-2 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            failed ? 'bg-red-500' : 'bg-green-500'
          )}
          style={{ width: `${getProcessingProgressPercent(status)}%` }}
        />
      </div>

      {/* Stage indicators row */}
      <div className="flex items-start justify-between">
        {PIPELINE_STAGES.map((stage, index) => {
          const isCompleted = index < currentStageIndex
          const isCurrent = index === currentStageIndex
          const isActive = isStageActive(status, stage)
          const isCurrentFailed = isCurrent && failed

          return (
            <div key={stage.id} className="flex flex-col items-center gap-1 min-w-0">
              {/* Stage icon */}
              <div
                className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full',
                  isCompleted && 'bg-green-100 text-green-600',
                  isCurrent && !isCurrentFailed && 'bg-blue-100 text-blue-600',
                  isCurrentFailed && 'bg-red-100 text-red-600',
                  !isCompleted && !isCurrent && 'bg-gray-100 text-gray-400'
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isActive ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </div>
              {/* Stage label */}
              <span
                className={cn(
                  'text-[10px] leading-tight text-center',
                  isCompleted && 'text-green-600',
                  isCurrent && !isCurrentFailed && 'font-medium text-blue-600',
                  isCurrentFailed && 'font-medium text-red-600',
                  !isCompleted && !isCurrent && 'text-gray-400'
                )}
              >
                {stage.label}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Get the current stage label for display
 */
export function getCurrentStageLabel(status: ProcessingStatus): string {
  if (status === 'failed') return 'Failed'
  if (status === 'analysis_failed') return 'Analysis Failed'

  const index = getCurrentStageIndex(status)
  if (index >= 0 && PIPELINE_STAGES[index]) {
    const stage = PIPELINE_STAGES[index]
    // Show "Parsing..." for active states
    if (['parsing', 'embedding', 'analyzing'].includes(status)) {
      return `${stage.label}...`
    }
    return stage.label
  }
  return 'Unknown'
}

/**
 * Get completion percentage for progress display
 */
export function getProcessingProgressPercent(status: ProcessingStatus): number {
  const statusProgress: Record<ProcessingStatus, number> = {
    pending: 0,
    parsing: 20,
    parsed: 30,
    embedding: 50,
    embedded: 60,
    analyzing: 70,
    analyzed: 85,
    complete: 100,
    failed: 0,
    embedding_failed: 50,
    analysis_failed: 70,
  }
  return statusProgress[status] ?? 0
}
