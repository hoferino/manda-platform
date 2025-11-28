/**
 * FindingActions Component
 * Action buttons for validating, rejecting, and editing findings
 * Story: E4.3 - Implement Inline Finding Validation (AC: 1, 2, 7)
 *
 * Features:
 * - Confirm button with green checkmark
 * - Reject button with red X
 * - Edit button with pencil icon
 * - Loading states for each action
 * - Visual feedback for current status (validated=green, rejected=red, pending=neutral)
 * - Accessible: ARIA labels, keyboard navigation, focus management
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
import { Check, X, Pencil, Loader2 } from 'lucide-react'
import type { FindingStatus } from '@/lib/types/findings'
import { cn } from '@/lib/utils'

export interface FindingActionsProps {
  findingId: string
  status: FindingStatus
  onValidate: (findingId: string, action: 'confirm' | 'reject') => Promise<void>
  onEdit: (findingId: string) => void
  disabled?: boolean
  className?: string
}

export function FindingActions({
  findingId,
  status,
  onValidate,
  onEdit,
  disabled = false,
  className,
}: FindingActionsProps) {
  // Track loading state for each action independently
  const [loadingAction, setLoadingAction] = useState<'confirm' | 'reject' | null>(null)

  // Handle confirm action
  const handleConfirm = useCallback(async () => {
    if (loadingAction || disabled || status === 'validated') return
    setLoadingAction('confirm')
    try {
      await onValidate(findingId, 'confirm')
    } finally {
      setLoadingAction(null)
    }
  }, [findingId, onValidate, loadingAction, disabled, status])

  // Handle reject action
  const handleReject = useCallback(async () => {
    if (loadingAction || disabled || status === 'rejected') return
    setLoadingAction('reject')
    try {
      await onValidate(findingId, 'reject')
    } finally {
      setLoadingAction(null)
    }
  }, [findingId, onValidate, loadingAction, disabled, status])

  // Handle edit action
  const handleEdit = useCallback(() => {
    if (loadingAction || disabled) return
    onEdit(findingId)
  }, [findingId, onEdit, loadingAction, disabled])

  // Determine button states based on current status
  const isValidated = status === 'validated'
  const isRejected = status === 'rejected'
  const isLoading = loadingAction !== null

  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label="Finding actions">
      {/* Confirm Button */}
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
              onClick={handleConfirm}
              disabled={disabled || isValidated || isLoading}
              aria-label={isValidated ? 'Finding validated' : 'Validate finding'}
              aria-pressed={isValidated}
            >
              {loadingAction === 'confirm' ? (
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
              onClick={handleReject}
              disabled={disabled || isRejected || isLoading}
              aria-label={isRejected ? 'Finding rejected' : 'Reject finding'}
              aria-pressed={isRejected}
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

      {/* Edit Button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleEdit}
              disabled={disabled || isLoading}
              aria-label="Edit finding"
            >
              <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
