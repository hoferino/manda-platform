/**
 * FindingValidationButtons Component
 * Validate and Reject buttons with feedback tracking
 * Story: E7.2 - Track Validation/Rejection Feedback (AC: 1, 7)
 *
 * Features:
 * - Validate button with checkmark icon
 * - Reject button with X icon and optional reason dialog
 * - Optimistic UI update on button click
 * - Loading states during API call
 * - Error handling with toast notification
 * - Confidence badge update after validation/rejection
 */

'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { RejectionReasonDialog } from './RejectionReasonDialog'
import type { FindingStatus } from '@/lib/types/findings'

export interface FindingValidationButtonsProps {
  findingId: string
  status: FindingStatus
  confidence: number | null
  onConfidenceChange?: (findingId: string, newConfidence: number, previousConfidence: number) => void
  onStatusChange?: (findingId: string, newStatus: FindingStatus) => void
  disabled?: boolean
  className?: string
  projectId: string
}

export function FindingValidationButtons({
  findingId,
  status,
  confidence,
  onConfidenceChange,
  onStatusChange,
  disabled = false,
  className,
  projectId,
}: FindingValidationButtonsProps) {
  const [loadingAction, setLoadingAction] = useState<'validate' | 'reject' | null>(null)
  const [showRejectDialog, setShowRejectDialog] = useState(false)

  // Optimistic state for immediate UI feedback
  const [optimisticStatus, setOptimisticStatus] = useState<FindingStatus | null>(null)

  const currentStatus = optimisticStatus ?? status

  const handleValidate = useCallback(async () => {
    if (loadingAction || disabled || currentStatus === 'validated') return

    setLoadingAction('validate')
    setOptimisticStatus('validated')

    try {
      const response = await fetch(
        `/api/projects/${projectId}/findings/${findingId}/validate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'confirm' }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to validate finding')
      }

      const data = await response.json()

      // Notify parent of confidence change
      if (onConfidenceChange && data.newConfidence !== undefined) {
        onConfidenceChange(findingId, data.newConfidence, data.previousConfidence ?? confidence ?? 0.5)
      }

      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange(findingId, 'validated')
      }

      toast.success('Finding validated', {
        description: `Confidence updated to ${(data.newConfidence * 100).toFixed(0)}%`,
      })
    } catch (error) {
      console.error('[FindingValidationButtons] Validate error:', error)
      // Rollback optimistic update
      setOptimisticStatus(null)
      toast.error('Failed to validate finding')
    } finally {
      setLoadingAction(null)
    }
  }, [findingId, projectId, loadingAction, disabled, currentStatus, confidence, onConfidenceChange, onStatusChange])

  const handleRejectClick = useCallback(() => {
    if (loadingAction || disabled || currentStatus === 'rejected') return
    setShowRejectDialog(true)
  }, [loadingAction, disabled, currentStatus])

  const handleRejectConfirm = useCallback(async (reason?: string) => {
    setShowRejectDialog(false)
    setLoadingAction('reject')
    setOptimisticStatus('rejected')

    try {
      const response = await fetch(
        `/api/projects/${projectId}/findings/${findingId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        }
      )

      if (!response.ok) {
        throw new Error('Failed to reject finding')
      }

      const data = await response.json()

      // Notify parent of confidence change
      if (onConfidenceChange && data.newConfidence !== undefined) {
        onConfidenceChange(findingId, data.newConfidence, data.previousConfidence ?? confidence ?? 0.5)
      }

      // Notify parent of status change
      if (onStatusChange) {
        onStatusChange(findingId, 'rejected')
      }

      const message = data.sourceFlagged
        ? 'Finding rejected - source flagged for review'
        : 'Finding rejected'

      toast.success(message, {
        description: `Confidence updated to ${(data.newConfidence * 100).toFixed(0)}%`,
      })
    } catch (error) {
      console.error('[FindingValidationButtons] Reject error:', error)
      // Rollback optimistic update
      setOptimisticStatus(null)
      toast.error('Failed to reject finding')
    } finally {
      setLoadingAction(null)
    }
  }, [findingId, projectId, confidence, onConfidenceChange, onStatusChange])

  const isValidated = currentStatus === 'validated'
  const isRejected = currentStatus === 'rejected'
  const isLoading = loadingAction !== null

  return (
    <>
      <div className={cn('flex items-center gap-1', className)} role="group" aria-label="Finding validation actions">
        {/* Validate Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 transition-colors',
                  isValidated && 'bg-green-100 hover:bg-green-200'
                )}
                onClick={handleValidate}
                disabled={disabled || isValidated || isLoading}
                aria-label={isValidated ? 'Finding validated' : 'Validate finding'}
                aria-pressed={isValidated}
                data-testid="validate-button"
              >
                {loadingAction === 'validate' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check
                    className={cn(
                      'h-4 w-4',
                      isValidated ? 'text-green-700' : 'text-green-600 hover:text-green-700'
                    )}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isValidated ? 'Validated' : 'Validate'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Reject Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-8 w-8 transition-colors',
                  isRejected && 'bg-red-100 hover:bg-red-200'
                )}
                onClick={handleRejectClick}
                disabled={disabled || isRejected || isLoading}
                aria-label={isRejected ? 'Finding rejected' : 'Reject finding'}
                aria-pressed={isRejected}
                data-testid="reject-button"
              >
                {loadingAction === 'reject' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <X
                    className={cn(
                      'h-4 w-4',
                      isRejected ? 'text-red-700' : 'text-red-600 hover:text-red-700'
                    )}
                  />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {isRejected ? 'Rejected' : 'Reject'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Rejection Reason Dialog */}
      <RejectionReasonDialog
        open={showRejectDialog}
        onOpenChange={setShowRejectDialog}
        onConfirm={handleRejectConfirm}
      />
    </>
  )
}
