/**
 * Delete Folder Dialog
 * Confirmation dialog with option to move or delete documents
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #4)
 */

'use client'

import { useState } from 'react'
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
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

type DocumentAction = 'move-to-root' | 'delete'

interface DeleteFolderDialogProps {
  open: boolean
  folderPath: string
  documentCount: number
  onOpenChange: (open: boolean) => void
  onConfirm: (documentAction: DocumentAction) => void
}

export function DeleteFolderDialog({
  open,
  folderPath,
  documentCount,
  onOpenChange,
  onConfirm,
}: DeleteFolderDialogProps) {
  const [documentAction, setDocumentAction] = useState<DocumentAction>('move-to-root')

  const folderName = folderPath.split('/').pop() || folderPath

  const handleConfirm = () => {
    onConfirm(documentAction)
    setDocumentAction('move-to-root')
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete folder "{folderName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The folder and all its subfolders will
            be removed.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {documentCount > 0 && (
          <div className="py-4">
            <p className="mb-3 text-sm text-muted-foreground">
              This folder contains {documentCount} document
              {documentCount !== 1 ? 's' : ''}. What would you like to do with{' '}
              {documentCount !== 1 ? 'them' : 'it'}?
            </p>

            <RadioGroup
              value={documentAction}
              onValueChange={(value) =>
                setDocumentAction(value as DocumentAction)
              }
              className="gap-3"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="move-to-root" id="move-to-root" />
                <Label htmlFor="move-to-root" className="cursor-pointer">
                  Move documents to root folder
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="delete" id="delete-docs" />
                <Label
                  htmlFor="delete-docs"
                  className="cursor-pointer text-destructive"
                >
                  Delete documents permanently
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Folder
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
