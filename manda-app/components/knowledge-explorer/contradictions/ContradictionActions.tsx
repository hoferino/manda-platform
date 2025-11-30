/**
 * ContradictionActions Component
 * Action buttons for resolving contradictions
 * Story: E4.6 - Build Contradictions View (AC: #4, #5, #6, #7)
 *
 * Features:
 * - Accept A button (validates Finding A, rejects Finding B)
 * - Accept B button (validates Finding B, rejects Finding A)
 * - Investigate button (opens note dialog, sets status to investigating)
 * - Add Note button (opens note dialog, sets status to noted)
 * - Loading states during API calls
 * - Shows current resolution status if already resolved
 */

'use client'

import { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Check, X, Search, MessageSquare, Loader2 } from 'lucide-react'
import type { ContradictionStatus } from '@/lib/types/contradictions'
import { cn } from '@/lib/utils'

export interface ContradictionActionsProps {
  status: ContradictionStatus
  onAcceptA: () => Promise<void>
  onAcceptB: () => Promise<void>
  onInvestigate: (note: string) => Promise<void>
  onAddNote: (note: string) => Promise<void>
  isLoading?: boolean
  className?: string
}

/**
 * Note input dialog for Investigate and Add Note actions
 */
function NoteDialog({
  trigger,
  title,
  description,
  actionLabel,
  actionVariant = 'default',
  onSubmit,
  isLoading,
}: {
  trigger: React.ReactNode
  title: string
  description: string
  actionLabel: string
  actionVariant?: 'default' | 'secondary' | 'outline'
  onSubmit: (note: string) => Promise<void>
  isLoading?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!note.trim()) return

    setIsSubmitting(true)
    try {
      await onSubmit(note.trim())
      setNote('')
      setIsOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }, [note, onSubmit])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Submit on Ctrl/Cmd + Enter
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit]
  )

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild disabled={isLoading}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="note">Note</Label>
            <Textarea
              id="note"
              placeholder="Enter your note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={4}
              className="resize-none"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Press Ctrl+Enter to submit
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant={actionVariant}
            onClick={handleSubmit}
            disabled={isSubmitting || !note.trim()}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              actionLabel
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ContradictionActions({
  status,
  onAcceptA,
  onAcceptB,
  onInvestigate,
  onAddNote,
  isLoading = false,
  className,
}: ContradictionActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  // Handle Accept A
  const handleAcceptA = useCallback(async () => {
    setLoadingAction('accept_a')
    try {
      await onAcceptA()
    } finally {
      setLoadingAction(null)
    }
  }, [onAcceptA])

  // Handle Accept B
  const handleAcceptB = useCallback(async () => {
    setLoadingAction('accept_b')
    try {
      await onAcceptB()
    } finally {
      setLoadingAction(null)
    }
  }, [onAcceptB])

  // If already resolved, show resolution status instead of actions
  if (status === 'resolved') {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-green-600', className)}>
        <Check className="h-4 w-4" />
        <span>Resolved</span>
      </div>
    )
  }

  const isDisabled = isLoading || loadingAction !== null

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* Accept A button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAcceptA}
        disabled={isDisabled}
        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        aria-label="Accept Finding A"
      >
        {loadingAction === 'accept_a' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-1.5 h-4 w-4" />
        )}
        Accept A
      </Button>

      {/* Accept B button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleAcceptB}
        disabled={isDisabled}
        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
        aria-label="Accept Finding B"
      >
        {loadingAction === 'accept_b' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-1.5 h-4 w-4" />
        )}
        Accept B
      </Button>

      {/* Investigate button (with note dialog) */}
      <NoteDialog
        trigger={
          <Button
            variant="outline"
            size="sm"
            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
            aria-label="Mark for investigation"
          >
            <Search className="mr-1.5 h-4 w-4" />
            Investigate
          </Button>
        }
        title="Mark for Investigation"
        description="Add a note explaining why this contradiction needs further investigation."
        actionLabel="Mark for Investigation"
        actionVariant="default"
        onSubmit={onInvestigate}
        isLoading={isDisabled}
      />

      {/* Add Note button (with note dialog) */}
      <NoteDialog
        trigger={
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground"
            aria-label="Add a note"
          >
            <MessageSquare className="mr-1.5 h-4 w-4" />
            Add Note
          </Button>
        }
        title="Add Note"
        description="Acknowledge this discrepancy with a note. This won't resolve the contradiction but will mark it as noted."
        actionLabel="Add Note"
        actionVariant="secondary"
        onSubmit={onAddNote}
        isLoading={isDisabled}
      />

      {/* Show status indicator for investigating/noted */}
      {status === 'investigating' && (
        <span className="ml-2 text-xs text-amber-600 flex items-center gap-1">
          <Search className="h-3 w-3" />
          Under investigation
        </span>
      )}
      {status === 'noted' && (
        <span className="ml-2 text-xs text-muted-foreground flex items-center gap-1">
          <MessageSquare className="h-3 w-3" />
          Noted
        </span>
      )}
    </div>
  )
}
