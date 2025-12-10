'use client'

/**
 * CIM Chat Input - Input area with source reference support
 *
 * Chat input for the CIM Builder conversation panel.
 * Shows source reference badge when a source is selected.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * Updated: E9.9 - Click-to-reference with component refs in input
 */

import * as React from 'react'
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent,
  type ChangeEvent,
} from 'react'
import { Send, Loader2, X, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CIMChatInputProps {
  onSubmit: (message: string) => void
  isLoading?: boolean
  sourceRef?: string
  onSourceRefClear?: () => void
  placeholder?: string
  maxLength?: number
  className?: string
}

export function CIMChatInput({
  onSubmit,
  isLoading = false,
  sourceRef = '',
  onSourceRefClear,
  placeholder = 'Ask the agent...',
  maxLength = 10000,
  className,
}: CIMChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const previousSourceRef = useRef<string>('')

  // Handle input change with auto-resize
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      if (newValue.length <= maxLength) {
        setValue(newValue)
      }

      // Auto-resize textarea
      const textarea = e.target
      textarea.style.height = 'auto'
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
    },
    [maxLength]
  )

  // Handle submit
  const handleSubmit = useCallback(() => {
    const trimmedValue = value.trim()
    if (!trimmedValue || isLoading) return

    onSubmit(trimmedValue)
    setValue('')

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isLoading, onSubmit])

  const isComponentRef = sourceRef?.startsWith('📍')

  const handleClearRef = useCallback(() => {
    if (isComponentRef && sourceRef && value.startsWith(sourceRef)) {
      setValue('')
    }
    onSourceRefClear?.()
  }, [isComponentRef, onSourceRefClear, sourceRef, value])

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

  // Insert component reference into the input when provided (E9.9)
  useEffect(() => {
    if (sourceRef && sourceRef.startsWith('📍') && sourceRef !== previousSourceRef.current) {
      const referenceText = `${sourceRef} `
      setValue(referenceText)

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          const cursorPos = referenceText.length
          textareaRef.current.focus()
          textareaRef.current.setSelectionRange(cursorPos, cursorPos)
        }
      })
    }

    previousSourceRef.current = sourceRef
  }, [sourceRef])

  return (
    <div className={cn('border-t bg-background p-3', className)}>
      {/* Source reference badge */}
      {sourceRef && (
        <div className="mb-2 flex items-center gap-2">
          <Badge
            variant={isComponentRef ? 'default' : 'secondary'}
            className="max-w-full truncate pr-1 flex items-center gap-1"
          >
            {isComponentRef && <MapPin className="h-3 w-3" />}
            <span className="truncate">{sourceRef}</span>
            {onSourceRefClear && (
              <button
                onClick={handleClearRef}
                className="ml-1 hover:bg-muted rounded p-0.5"
                aria-label="Clear source reference"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </Badge>
        </div>
      )}

      <div className="relative flex items-end gap-2">
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className={cn(
              'min-h-[40px] max-h-[150px] resize-none pr-12',
              'focus-visible:ring-1 focus-visible:ring-ring',
              isLoading && 'opacity-50 cursor-not-allowed'
            )}
            aria-label="CIM chat message input"
          />

          <Button
            type="button"
            size="icon"
            onClick={handleSubmit}
            disabled={isLoading || !value.trim()}
            className="absolute right-2 bottom-1.5 h-7 w-7"
            aria-label="Send message"
          >
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Hints */}
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          <kbd className="rounded bg-muted px-1 py-0.5">Enter</kbd> to send
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
  )
}
