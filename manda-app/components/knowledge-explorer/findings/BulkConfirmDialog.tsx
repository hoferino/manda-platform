/**
 * BulkConfirmDialog Component
 * Confirmation dialog for bulk actions on findings
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 5, 6)
 *
 * Features:
 * - Clear action description
 * - Count of affected findings
 * - Warning about irreversibility (with undo note)
 * - Cancel and confirm buttons
 * - Loading state during action
 * - Focus trap for accessibility
 */

'use client'

import { useRef, useEffect } from 'react'
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
import { Button } from '@/components/ui/button'
import { Loader2, AlertTriangle, CheckCheck, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type BulkAction = 'validate' | 'reject'

export interface BulkConfirmDialogProps {
  isOpen: boolean
  action: BulkAction
  count: number
  isProcessing?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const ACTION_CONFIG = {
  validate: {
    title: 'Validate findings',
    description: (count: number) =>
      `Are you sure you want to validate ${count} finding${count === 1 ? '' : 's'}? This will mark them as confirmed and slightly increase their confidence score.`,
    icon: CheckCheck,
    iconClass: 'text-green-600',
    confirmText: 'Validate',
    confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
  },
  reject: {
    title: 'Reject findings',
    description: (count: number) =>
      `Are you sure you want to reject ${count} finding${count === 1 ? '' : 's'}? This will mark them as rejected.`,
    icon: XCircle,
    iconClass: 'text-red-600',
    confirmText: 'Reject',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
  },
}

export function BulkConfirmDialog({
  isOpen,
  action,
  count,
  isProcessing = false,
  onConfirm,
  onCancel,
}: BulkConfirmDialogProps) {
  const config = ACTION_CONFIG[action]
  const Icon = config.icon
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Focus cancel button when dialog opens (for accessibility)
  useEffect(() => {
    if (isOpen && cancelRef.current) {
      cancelRef.current.focus()
    }
  }, [isOpen])

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-full bg-muted', config.iconClass)}>
              <Icon className="h-5 w-5" />
            </div>
            <AlertDialogTitle>{config.title}</AlertDialogTitle>
          </div>
          <AlertDialogDescription className="mt-4">
            {config.description(count)}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Undo information */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-md text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-muted-foreground">
            You can undo this action within 5 seconds after completion.
          </p>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef} disabled={isProcessing}>
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={onConfirm}
            disabled={isProcessing}
            className={cn(config.confirmClass)}
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {config.confirmText} {count} finding{count === 1 ? '' : 's'}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
