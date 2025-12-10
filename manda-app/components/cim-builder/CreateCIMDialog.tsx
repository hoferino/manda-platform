'use client'

/**
 * Create CIM Dialog Component
 * Name input dialog for creating a new CIM
 * Story: E9.2 - CIM List & Entry UI
 * AC: #3 - "Create New CIM" button opens name input dialog
 *
 * Features:
 * - Name input field with validation
 * - Loading state during creation
 * - Error handling with toast notifications
 */

import { useState, useEffect } from 'react'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Validation schema (AC: #3 - 3-100 characters, required)
const cimNameSchema = z
  .string()
  .min(3, 'CIM name must be at least 3 characters')
  .max(100, 'CIM name must be 100 characters or less')

interface CreateCIMDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (title: string) => Promise<void>
  isLoading: boolean
}

export function CreateCIMDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateCIMDialogProps) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setName('')
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validate name
    const result = cimNameSchema.safeParse(name.trim())
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid name')
      return
    }

    setError(null)
    await onSubmit(result.data)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value)
    if (error) {
      setError(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New CIM</DialogTitle>
            <DialogDescription>
              Give your Confidential Information Memorandum a name. You can change this later.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="cim-name">CIM Name</Label>
              <Input
                id="cim-name"
                placeholder="e.g., Q4 2024 Investment Opportunity"
                value={name}
                onChange={handleNameChange}
                disabled={isLoading}
                aria-describedby={error ? 'cim-name-error' : undefined}
                autoFocus
              />
              {error && (
                <p id="cim-name-error" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || name.trim().length === 0}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create CIM'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
