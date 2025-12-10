'use client'

/**
 * Delete CIM Dialog Component
 * Confirmation dialog for deleting a CIM
 * Story: E9.2 - CIM List & Entry UI
 * AC: #5 - Delete CIM shows confirmation dialog, removes from list after confirmation
 *
 * Features:
 * - AlertDialog for delete confirmation
 * - Shows CIM name being deleted
 * - Loading state during deletion
 */

import { Loader2 } from 'lucide-react'
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

interface DeleteCIMDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  cimTitle: string
  onConfirm: () => Promise<void>
  isLoading: boolean
}

export function DeleteCIMDialog({
  open,
  onOpenChange,
  cimTitle,
  onConfirm,
  isLoading,
}: DeleteCIMDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete CIM</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">&quot;{cimTitle}&quot;</span>? This
            action cannot be undone. All slides, content, and conversation history will be
            permanently removed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete CIM'
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
