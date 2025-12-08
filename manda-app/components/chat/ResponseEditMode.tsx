'use client'

/**
 * ResponseEditMode Component
 *
 * Inline editing mode for agent responses with real-time diff preview.
 * Story: E7.3 - Enable Response Editing and Learning
 * AC: #1, #2 (Edit mode, Diff highlight)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Check, AlertCircle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { EditType } from '@/lib/types/feedback'
import * as Diff from 'diff'

interface ResponseEditModeProps {
  originalText: string
  messageId: string
  projectId: string
  onSave: (editedText: string, editType: EditType) => Promise<void>
  onCancel: () => void
  className?: string
}

/**
 * Parse diff to generate highlighted segments
 */
function generateDiffSegments(original: string, edited: string) {
  const diff = Diff.diffWords(original, edited)

  return diff.map((part, index) => ({
    key: index,
    value: part.value,
    added: part.added ?? false,
    removed: part.removed ?? false,
  }))
}

export function ResponseEditMode({
  originalText,
  messageId,
  projectId,
  onSave,
  onCancel,
  className,
}: ResponseEditModeProps) {
  const [editedText, setEditedText] = useState(originalText)
  const [editType, setEditType] = useState<EditType>('style')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Generate diff segments for preview
  const diffSegments = generateDiffSegments(originalText, editedText)
  const hasChanges = editedText !== originalText

  const handleSave = useCallback(async () => {
    if (!hasChanges) {
      onCancel()
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      await onSave(editedText, editType)
    } catch (err) {
      console.error('[ResponseEditMode] Error saving edit:', err)
      setError(err instanceof Error ? err.message : 'Failed to save edit')
      setIsSaving(false)
    }
  }, [editedText, editType, hasChanges, onSave, onCancel])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
      // Ctrl/Cmd + Enter to save
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      }
    },
    [onCancel, handleSave]
  )

  return (
    <div className={cn('space-y-4 p-4 border rounded-lg bg-muted/50', className)}>
      {/* Edit Type Selector */}
      <div className="flex items-center gap-4">
        <Label htmlFor="edit-type" className="text-sm font-medium">
          Edit type:
        </Label>
        <Select value={editType} onValueChange={(v) => setEditType(v as EditType)}>
          <SelectTrigger id="edit-type" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="style">Style/Wording</SelectItem>
            <SelectItem value="content">Content</SelectItem>
            <SelectItem value="factual">Factual Fix</SelectItem>
            <SelectItem value="formatting">Formatting</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Edit Textarea */}
      <div className="space-y-2">
        <Label htmlFor="edit-text" className="text-sm font-medium">
          Edit response:
        </Label>
        <Textarea
          ref={textareaRef}
          id="edit-text"
          value={editedText}
          onChange={(e) => setEditedText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={8}
          className="font-mono text-sm resize-y min-h-[150px]"
          placeholder="Edit the response text..."
          data-testid="edit-textarea"
        />
        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Esc</kbd> to cancel,{' '}
          <kbd className="px-1 py-0.5 bg-muted rounded text-xs">Ctrl+Enter</kbd> to save
        </p>
      </div>

      {/* Diff Preview */}
      {hasChanges && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">Changes preview:</Label>
          <div
            className="p-3 border rounded-md bg-background text-sm leading-relaxed max-h-[200px] overflow-y-auto"
            data-testid="diff-preview"
          >
            {diffSegments.map((segment) => (
              <span
                key={segment.key}
                className={cn(
                  segment.removed && 'bg-red-100 dark:bg-red-900/30 line-through text-red-700 dark:text-red-400',
                  segment.added && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                )}
              >
                {segment.value}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={isSaving}
          data-testid="cancel-edit-button"
        >
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={isSaving || !hasChanges}
          data-testid="save-edit-button"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Check className="h-4 w-4 mr-1" />
              Save Edit
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
