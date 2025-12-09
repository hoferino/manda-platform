'use client'

/**
 * Q&A Inline Edit Component
 * Inline text editing for Q&A fields with validation
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 3, 4)
 *
 * Features:
 * - Auto-focus on mount
 * - Enter to save, Escape to cancel
 * - Character count and validation
 * - Loading state during save
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { Check, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface QAInlineEditProps {
  value: string
  onSave: (value: string) => Promise<void>
  onCancel: () => void
  placeholder?: string
  minLength?: number
  maxLength?: number
  className?: string
}

export function QAInlineEdit({
  value,
  onSave,
  onCancel,
  placeholder = 'Enter text...',
  minLength = 0,
  maxLength = 2000,
  className,
}: QAInlineEditProps) {
  const [editValue, setEditValue] = useState(value)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [])

  // Validate input
  const validate = useCallback(
    (text: string): string | null => {
      const trimmed = text.trim()
      if (minLength > 0 && trimmed.length < minLength) {
        return `Must be at least ${minLength} characters`
      }
      if (trimmed.length > maxLength) {
        return `Must be ${maxLength} characters or less`
      }
      return null
    },
    [minLength, maxLength]
  )

  // Handle save
  const handleSave = useCallback(async () => {
    const trimmedValue = editValue.trim()

    // Validate
    const validationError = validate(trimmedValue)
    if (validationError) {
      setError(validationError)
      return
    }

    // No change - just cancel
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
      setIsSaving(false)
    }
  }, [editValue, value, validate, onSave, onCancel])

  // Handle cancel
  const handleCancel = useCallback(() => {
    setEditValue(value)
    setError(null)
    onCancel()
  }, [value, onCancel])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Enter without Shift saves
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

  // Handle click outside
  const handleBlur = useCallback(
    (e: React.FocusEvent) => {
      // Check if the new focus target is within our component
      const relatedTarget = e.relatedTarget as Node
      const currentTarget = e.currentTarget as Node

      if (!currentTarget.contains(relatedTarget)) {
        // Focus left the component - save if there are changes, otherwise cancel
        if (editValue.trim() !== value.trim()) {
          handleSave()
        } else {
          handleCancel()
        }
      }
    },
    [editValue, value, handleSave, handleCancel]
  )

  return (
    <div className={cn('space-y-2', className)} onBlur={handleBlur}>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={editValue}
          onChange={(e) => {
            setEditValue(e.target.value)
            setError(null)
          }}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          maxLength={maxLength + 100} // Allow slight overflow for warning
          rows={2}
          placeholder={placeholder}
          className={cn(
            'resize-none text-sm pr-4',
            error && 'border-destructive focus-visible:ring-destructive'
          )}
          aria-label="Edit text"
          aria-invalid={!!error}
          aria-describedby={error ? 'qa-edit-error' : undefined}
        />
        {/* Character count */}
        <span
          className={cn(
            'absolute bottom-2 right-2 text-xs',
            editValue.length > maxLength ? 'text-destructive' : 'text-muted-foreground'
          )}
        >
          {editValue.length}/{maxLength}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <p id="qa-edit-error" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="default"
          onClick={handleSave}
          disabled={isSaving || (minLength > 0 && editValue.trim().length < minLength)}
          className="h-7 px-2 text-xs"
          aria-label="Save"
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          disabled={isSaving}
          aria-label="Cancel"
          className="h-7 px-2 text-xs"
        >
          <X className="h-3 w-3" />
        </Button>
        <span className="text-xs text-muted-foreground">
          Enter to save
        </span>
      </div>
    </div>
  )
}
