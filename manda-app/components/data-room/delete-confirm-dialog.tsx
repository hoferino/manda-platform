/**
 * Delete Confirmation Dialog Component
 * Modal dialog to confirm document deletion
 * Story: E2.6 - Implement Document Actions (View, Download, Delete)
 *
 * Features:
 * - Shows document name and warning message (AC: #4)
 * - Accessible with keyboard and screen reader (AC: #8)
 * - Confirm or cancel deletion
 * - Loading state during deletion
 */

'use client'

import { useState, useCallback } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
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
import type { Document } from '@/lib/api/documents'

export interface DeleteConfirmDialogProps {
  /** Document to be deleted */
  document: Document | null
  /** Whether dialog is open */
  open: boolean
  /** Callback when open state changes */
  onOpenChange: (open: boolean) => void
  /** Callback when deletion is confirmed - receives document and returns promise */
  onConfirm: (document: Document) => Promise<{ success: boolean; error?: string }>
  /** Whether an external delete is in progress */
  isDeleting?: boolean
}

/**
 * Delete Confirmation Dialog
 * Displays a confirmation dialog before deleting a document
 */
export function DeleteConfirmDialog({
  document,
  open,
  onOpenChange,
  onConfirm,
  isDeleting: externalIsDeleting = false,
}: DeleteConfirmDialogProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const loading = isDeleting || externalIsDeleting

  const handleConfirm = useCallback(async () => {
    if (!document) return

    setIsDeleting(true)
    try {
      const result = await onConfirm(document)
      if (result.success) {
        onOpenChange(false)
      }
      // Error handling is done by the parent component
    } finally {
      setIsDeleting(false)
    }
  }, [document, onConfirm, onOpenChange])

  const handleCancel = useCallback(() => {
    if (!loading) {
      onOpenChange(false)
    }
  }, [loading, onOpenChange])

  if (!document) return null

  return (
    <AlertDialog open={open} onOpenChange={loading ? undefined : onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Document
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                Are you sure you want to delete{' '}
                <span className="font-medium text-foreground">
                  &quot;{document.name}&quot;
                </span>
                ?
              </p>
              <p className="text-sm text-muted-foreground">
                This action cannot be undone. The file will be permanently
                removed from storage.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
