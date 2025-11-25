/**
 * Rename Folder Dialog
 * Dialog for renaming folders
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #3)
 */

'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RenameFolderDialogProps {
  open: boolean
  folderPath: string
  onOpenChange: (open: boolean) => void
  onConfirm: (newName: string) => void
}

export function RenameFolderDialog({
  open,
  folderPath,
  onOpenChange,
  onConfirm,
}: RenameFolderDialogProps) {
  const currentName = folderPath.split('/').pop() || folderPath
  const [name, setName] = useState(currentName)
  const [error, setError] = useState<string | null>(null)

  // Reset name when dialog opens with new folder
  useEffect(() => {
    if (open) {
      setName(currentName)
      setError(null)
    }
  }, [open, currentName])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()

    // Validate folder name
    if (!trimmedName) {
      setError('Folder name is required')
      return
    }

    if (trimmedName.includes('/')) {
      setError('Folder name cannot contain "/"')
      return
    }

    if (trimmedName.length > 100) {
      setError('Folder name must be under 100 characters')
      return
    }

    if (trimmedName === currentName) {
      onOpenChange(false)
      return
    }

    onConfirm(trimmedName)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Rename Folder</DialogTitle>
            <DialogDescription>
              Enter a new name for "{currentName}"
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-name">Folder Name</Label>
              <Input
                id="folder-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setError(null)
                }}
                autoFocus
                onFocus={(e) => e.target.select()}
              />
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
