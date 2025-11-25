/**
 * Create Folder Dialog
 * Modal for creating new folders
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #2)
 */

'use client'

import { useState } from 'react'
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

interface CreateFolderDialogProps {
  open: boolean
  parentPath: string | null
  onOpenChange: (open: boolean) => void
  onConfirm: (name: string) => void
}

export function CreateFolderDialog({
  open,
  parentPath,
  onOpenChange,
  onConfirm,
}: CreateFolderDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

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

    onConfirm(trimmedName)
    setName('')
    setError(null)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setName('')
      setError(null)
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Folder</DialogTitle>
            <DialogDescription>
              {parentPath
                ? `Create a new folder inside "${parentPath}"`
                : 'Create a new root folder'}
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
                placeholder="Enter folder name"
                autoFocus
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
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
