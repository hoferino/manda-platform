/**
 * UndoToast Component
 * Toast notification with undo button and countdown timer
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 9)
 *
 * Features:
 * - Displays action confirmation
 * - Countdown timer showing remaining undo time
 * - Undo button to revert action
 * - Animated progress bar
 * - Accessible with ARIA attributes
 */

'use client'

import { useEffect, useRef } from 'react'
import { X, Undo2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface UndoToastProps {
  action: 'validate' | 'reject'
  count: number
  remainingTime: number
  totalTime?: number
  isUndoing?: boolean
  onUndo: () => void
  onDismiss: () => void
  className?: string
}

export function UndoToast({
  action,
  count,
  remainingTime,
  totalTime = 5,
  isUndoing = false,
  onUndo,
  onDismiss,
  className,
}: UndoToastProps) {
  const progressRef = useRef<HTMLDivElement>(null)

  // Action label
  const actionLabel = action === 'validate' ? 'validated' : 'rejected'

  // Update progress bar
  useEffect(() => {
    if (progressRef.current) {
      const progress = (remainingTime / totalTime) * 100
      progressRef.current.style.width = `${progress}%`
    }
  }, [remainingTime, totalTime])

  // Don't render if no remaining time
  if (remainingTime <= 0) {
    return null
  }

  return (
    <div
      className={cn(
        // Positioning
        'fixed bottom-20 left-1/2 -translate-x-1/2 z-50',
        // Styling
        'flex items-center gap-3 px-4 py-3 min-w-[300px]',
        'bg-background border rounded-lg shadow-lg',
        // Animation
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
        className
      )}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      {/* Progress bar background */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted rounded-b-lg overflow-hidden">
        <div
          ref={progressRef}
          className={cn(
            'h-full transition-all duration-1000 ease-linear',
            action === 'validate' ? 'bg-green-500' : 'bg-red-500'
          )}
        />
      </div>

      {/* Message */}
      <div className="flex-1 text-sm">
        <span className="font-medium">{count}</span>
        <span className="text-muted-foreground">
          {' '}finding{count === 1 ? '' : 's'} {actionLabel}
        </span>
      </div>

      {/* Undo button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={onUndo}
        disabled={isUndoing}
        aria-label={`Undo ${action} action`}
      >
        {isUndoing ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Undoing...
          </>
        ) : (
          <>
            <Undo2 className="h-4 w-4" />
            Undo ({remainingTime}s)
          </>
        )}
      </Button>

      {/* Dismiss button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={onDismiss}
        disabled={isUndoing}
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
