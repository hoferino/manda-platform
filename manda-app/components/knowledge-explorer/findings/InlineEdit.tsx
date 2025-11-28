/**
 * InlineEdit Component
 * Inline text editor for editing finding text
 * Story: E4.3 - Implement Inline Finding Validation (AC: 3)
 *
 * Features:
 * - Inline editable text field replacing display text
 * - Save/Cancel buttons
 * - Keyboard shortcuts: Enter saves, Escape cancels
 * - Focus management when entering/exiting edit mode
 * - Validation: text cannot be empty
 */

'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface InlineEditProps {
  value: string
  onSave: (newValue: string) => Promise<void>
  onCancel: () => void
  isEditing: boolean
  className?: string
  maxLength?: number
}

export function InlineEdit({
  value,
  onSave,
  onCancel,
  isEditing,
  className,
  maxLength = 2000,
}: InlineEditProps) {
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      // Select all text for easy replacement
      textareaRef.current.select()
    }
  }, [isEditing])

  // Reset edit value when value prop changes
  useEffect(() => {
    setEditValue(value)
    setError(null)
  }, [value])

  // Handle save
  const handleSave = useCallback(async () => {
    // Validate
    const trimmedValue = editValue.trim()
    if (!trimmedValue) {
      setError('Finding text cannot be empty')
      return
    }

    // No change, just cancel
    if (trimmedValue === value.trim()) {
      onCancel()
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(trimmedValue)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setIsSaving(false)
    }
  }, [editValue, value, onSave, onCancel])

  // Handle cancel
  const handleCancel = useCallback(() => {
    setEditValue(value)
    setError(null)
    onCancel()
  }, [value, onCancel])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter without shift saves (shift+enter adds newline)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSave()
      }
      // Escape cancels
      if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  if (!isEditing) {
    return null
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
            setEditValue(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          maxLength={maxLength}
          rows={3}
          className={cn(
            'resize-none pr-4',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
          placeholder="Enter finding text..."
          aria-label="Edit finding text"
          aria-invalid={!!error}
          aria-describedby={error ? 'edit-error' : undefined}
        />
        {/* Character count */}
        <span className="absolute bottom-2 right-2 text-xs text-muted-foreground">
          {editValue.length}/{maxLength}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <p id="edit-error" className="text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !editValue.trim()}
          aria-label="Save changes"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="mr-1 h-3 w-3" />
              Save
            </>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleCancel}
          disabled={isSaving}
          aria-label="Cancel editing"
        >
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">
          Enter to save, Esc to cancel
        </span>
      </div>
    </div>
  )
}
