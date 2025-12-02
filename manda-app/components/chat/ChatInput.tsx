'use client'

/**
 * ChatInput Component
 *
 * Input area for typing and submitting chat messages.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * Story: E5.5 - Quick Actions and Suggested Follow-ups (AC: #6)
 * AC: #2 (Message Submission), #5 (Input Handling)
 */

import { useState, useRef, useCallback, useEffect, type KeyboardEvent, type ChangeEvent } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSubmit: (message: string) => void
  isDisabled?: boolean
  isLoading?: boolean
  placeholder?: string
  maxLength?: number
  className?: string
  /** Initial value to populate the input (e.g., from follow-up suggestion) */
  initialValue?: string
  /** Callback when value changes (for controlled mode) */
  onValueChange?: (value: string) => void
}

export function ChatInput({
  onSubmit,
  isDisabled = false,
  isLoading = false,
  placeholder = 'Ask a question about your deal...',
  maxLength = 10000,
  className,
  initialValue = '',
  onValueChange,
}: ChatInputProps) {
  const [value, setValue] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Sync with external initialValue changes (e.g., from follow-up suggestions)
  useEffect(() => {
    if (initialValue !== value) {
      setValue(initialValue)
      // Focus and move cursor to end when value is set externally
      if (initialValue && textareaRef.current) {
        textareaRef.current.focus()
        // Auto-resize textarea for the new content
        textareaRef.current.style.height = 'auto'
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
      }
    }
  }, [initialValue])

  // Handle input change with auto-resize
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      if (newValue.length <= maxLength) {
        setValue(newValue)
        onValueChange?.(newValue)
      }

      // Auto-resize textarea
      const textarea = e.target
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`
    },
    [maxLength, onValueChange]
  )

  // Handle submit
  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim()
    if (!trimmedValue || isDisabled || isLoading) return

    onSubmit(trimmedValue)
    setValue('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isDisabled, isLoading, onSubmit])

  // Handle keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Enter (without Shift)
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSubmit()
      }

      // Submit on Cmd/Ctrl+Enter
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  const disabled = isDisabled || isLoading

  return (
    <div className={cn('border-t bg-background p-4', className)}>
      <div className="mx-auto max-w-3xl">
        <div className="relative flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              'min-h-[44px] max-h-[200px] resize-none pr-12',
              'focus-visible:ring-1 focus-visible:ring-ring',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="Chat message input"
          />

          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={disabled || !value.trim()}
            className="absolute right-2 bottom-2 h-8 w-8"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Character count and hints */}
        <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Press <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> to send,{' '}
            <kbd className="rounded bg-muted px-1 py-0.5">Shift+Enter</kbd> for new line
          </span>
          <span
            className={cn(
              value.length > maxLength * 0.9 && 'text-amber-500',
              value.length >= maxLength && 'text-destructive'
            )}
          >
            {value.length.toLocaleString()}/{maxLength.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
