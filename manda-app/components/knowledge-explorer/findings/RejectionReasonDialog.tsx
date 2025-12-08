/**
 * RejectionReasonDialog Component
 * Dialog for entering optional rejection reason
 * Story: E7.2 - Track Validation/Rejection Feedback (AC: 3)
 *
 * Features:
 * - Optional textarea for rejection reason
 * - Submit with or without reason
 * - Cancel button
 * - Keyboard shortcuts (Enter to submit, Escape to cancel)
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

export interface RejectionReasonDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason?: string) => void
}

export function RejectionReasonDialog({
  open,
  onOpenChange,
  onConfirm,
}: RejectionReasonDialogProps) {
  const [reason, setReason] = useState('')

  // Reset reason when dialog opens
  useEffect(() => {
    if (open) {
      setReason('')
    }
  }, [open])

  const handleSubmit = useCallback(() => {
    const trimmedReason = reason.trim()
    onConfirm(trimmedReason || undefined)
    onOpenChange(false)
  }, [reason, onConfirm, onOpenChange])

  const handleCancel = useCallback(() => {
    onOpenChange(false)
  }, [onOpenChange])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" data-testid="rejection-dialog">
        <DialogHeader>
          <DialogTitle>Reject Finding</DialogTitle>
          <DialogDescription>
            Optionally provide a reason for rejecting this finding. This helps improve AI accuracy.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="rejection-reason">Reason (optional)</Label>
            <Textarea
              id="rejection-reason"
              placeholder="e.g., The value is incorrect, the source is outdated..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              className="resize-none"
              data-testid="rejection-reason-input"
            />
            <p className="text-xs text-muted-foreground">
              Press Enter to submit, Shift+Enter for new line
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            data-testid="rejection-cancel-button"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            data-testid="rejection-confirm-button"
          >
            Reject Finding
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
