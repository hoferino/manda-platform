'use client'

/**
 * CIM Progress Indicator Component
 * Shows workflow phase progress for a CIM
 * Story: E9.2 - CIM List & Entry UI
 * AC: #2 - Progress indicator showing workflow phase progress
 *
 * Features:
 * - Progress bar from 0-100%
 * - Phase description text
 * - Color coding based on progress
 */

import { Progress } from '@/components/ui/progress'
import { WorkflowState, calculateCIMProgress, getWorkflowStateDescription } from '@/lib/types/cim'
import { cn } from '@/lib/utils'

interface CIMProgressIndicatorProps {
  workflowState: WorkflowState
  showLabel?: boolean
  size?: 'sm' | 'md'
}

export function CIMProgressIndicator({
  workflowState,
  showLabel = true,
  size = 'md',
}: CIMProgressIndicatorProps) {
  const progress = calculateCIMProgress(workflowState)
  const description = getWorkflowStateDescription(workflowState)

  // Determine color based on progress
  const getProgressColor = () => {
    if (progress === 100) return 'bg-green-500'
    if (progress >= 50) return 'bg-blue-500'
    if (progress >= 25) return 'bg-amber-500'
    return 'bg-slate-400'
  }

  return (
    <div className="space-y-1.5">
      {showLabel && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{description}</span>
          <span
            className={cn(
              'font-medium',
              progress === 100 ? 'text-green-600' : 'text-muted-foreground'
            )}
          >
            {progress}%
          </span>
        </div>
      )}
      <Progress
        value={progress}
        className={cn('h-2', size === 'sm' && 'h-1.5')}
        indicatorClassName={getProgressColor()}
      />
    </div>
  )
}
