/**
 * GapActions Component
 * Action buttons for managing gaps
 * Story: E4.8 - Build Gap Analysis View (AC: #5, #6, #7)
 *
 * Features:
 * - Mark Resolved button
 * - Mark N/A button (with note dialog)
 * - Add to IRL button (for information gaps)
 * - Add Finding button (for information gaps)
 * - Undo button (for resolved gaps)
 * - Loading states during API calls
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Check,
  XCircle,
  Plus,
  FileText,
  Undo2,
  Loader2,
  ListPlus,
} from 'lucide-react'
import type { Gap, GapStatus } from '@/lib/types/gaps'
import { FINDING_DOMAINS, type FindingDomain } from '@/lib/types/findings'
import { createIrlFromGap, createManualFinding } from '@/lib/api/gaps'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export interface GapActionsProps {
  gap: Gap
  projectId: string
  onResolve: (status: GapStatus, note?: string) => Promise<void>
  onUndo: () => Promise<void>
  isLoading?: boolean
  className?: string
}

/**
 * Mark as N/A dialog
 */
function MarkNADialog({
  onSubmit,
  isLoading,
  trigger,
}: {
  onSubmit: (note: string) => Promise<void>
  isLoading?: boolean
  trigger: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      await onSubmit(note.trim())
      setNote('')
      setIsOpen(false)
    } finally {
      setIsSubmitting(false)
    }
  }, [note, onSubmit])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild disabled={isLoading}>
        {trigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Mark as Not Applicable</DialogTitle>
          <DialogDescription>
            Explain why this gap is not applicable to your analysis. This will remove it from the
            active gaps list.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="na-note">Reason (optional)</Label>
            <Textarea
              id="na-note"
              placeholder="Enter reason..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <XCircle className="mr-2 h-4 w-4" />
                Mark as N/A
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Add to IRL dialog
 */
function AddToIRLDialog({
  gap,
  projectId,
  onSuccess,
  isLoading,
}: {
  gap: Gap
  projectId: string
  onSuccess: () => void
  isLoading?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [name, setName] = useState(gap.description.substring(0, 50))
  const [category, setCategory] = useState('Additional Request')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    setIsSubmitting(true)
    try {
      // TODO: Get IRL ID from project context
      // For now, we'll show an info message
      toast.info('IRL integration coming soon')
      setIsOpen(false)
      // await createIrlFromGap(projectId, gap.id, { irlId: 'TODO', name, category })
      // toast.success('Added to IRL checklist')
      // onSuccess()
    } catch (err) {
      console.error('[GapActions] Error adding to IRL:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to add to IRL')
    } finally {
      setIsSubmitting(false)
    }
  }, [name, category, projectId, gap.id, onSuccess])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild disabled={isLoading}>
        <Button
          variant="outline"
          size="sm"
          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
          aria-label="Add to IRL checklist"
        >
          <ListPlus className="mr-1.5 h-4 w-4" />
          Add to IRL
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add to IRL Checklist</DialogTitle>
          <DialogDescription>
            Create a new IRL item from this gap to request the missing information.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="irl-name">Item Name</Label>
            <Input
              id="irl-name"
              placeholder="Enter item name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="irl-category">Category</Label>
            <Input
              id="irl-category"
              placeholder="Category..."
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !name.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Add to IRL
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/**
 * Add Manual Finding dialog
 */
function AddFindingDialog({
  gap,
  projectId,
  onSuccess,
  isLoading,
}: {
  gap: Gap
  projectId: string
  onSuccess: () => void
  isLoading?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [text, setText] = useState('')
  const [domain, setDomain] = useState<FindingDomain>(gap.domain || 'financial')
  const [sourceNotes, setSourceNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = useCallback(async () => {
    if (!text.trim()) return

    setIsSubmitting(true)
    try {
      await createManualFinding(projectId, gap.id, {
        text: text.trim(),
        domain,
        sourceNotes: sourceNotes.trim() || undefined,
      })
      toast.success('Manual finding created')
      setText('')
      setSourceNotes('')
      setIsOpen(false)
      onSuccess()
    } catch (err) {
      console.error('[GapActions] Error creating finding:', err)
      toast.error(err instanceof Error ? err.message : 'Failed to create finding')
    } finally {
      setIsSubmitting(false)
    }
  }, [text, domain, sourceNotes, projectId, gap.id, onSuccess])

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild disabled={isLoading}>
        <Button
          variant="outline"
          size="sm"
          className="text-green-600 hover:text-green-700 hover:bg-green-50"
          aria-label="Add manual finding"
        >
          <FileText className="mr-1.5 h-4 w-4" />
          Add Finding
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add Manual Finding</DialogTitle>
          <DialogDescription>
            Create a finding manually to address this information gap. The gap will be marked as
            resolved.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="finding-text">Finding Text *</Label>
            <Textarea
              id="finding-text"
              placeholder="Enter the finding..."
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="finding-domain">Domain</Label>
            <Select value={domain} onValueChange={(v) => setDomain(v as FindingDomain)}>
              <SelectTrigger id="finding-domain">
                <SelectValue placeholder="Select domain" />
              </SelectTrigger>
              <SelectContent>
                {FINDING_DOMAINS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="source-notes">Source Notes (optional)</Label>
            <Input
              id="source-notes"
              placeholder="Where did this information come from?"
              value={sourceNotes}
              onChange={(e) => setSourceNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || !text.trim()}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create Finding
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function GapActions({
  gap,
  projectId,
  onResolve,
  onUndo,
  isLoading = false,
  className,
}: GapActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null)

  const isResolved = gap.status === 'resolved' || gap.status === 'not_applicable'
  const isInfoGap = gap.category === 'information_gap' || gap.category === 'incomplete_analysis'
  const isDisabled = isLoading || loadingAction !== null

  // Handle Mark Resolved
  const handleResolve = useCallback(async () => {
    setLoadingAction('resolve')
    try {
      await onResolve('resolved')
    } finally {
      setLoadingAction(null)
    }
  }, [onResolve])

  // Handle Mark N/A
  const handleMarkNA = useCallback(
    async (note: string) => {
      setLoadingAction('na')
      try {
        await onResolve('not_applicable', note)
      } finally {
        setLoadingAction(null)
      }
    },
    [onResolve]
  )

  // Handle Undo
  const handleUndo = useCallback(async () => {
    setLoadingAction('undo')
    try {
      await onUndo()
    } finally {
      setLoadingAction(null)
    }
  }, [onUndo])

  // If resolved, show undo button
  if (isResolved) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span className="text-sm text-muted-foreground flex items-center gap-1">
          {gap.status === 'resolved' && (
            <>
              <Check className="h-4 w-4 text-green-600" />
              Resolved
            </>
          )}
          {gap.status === 'not_applicable' && (
            <>
              <XCircle className="h-4 w-4 text-gray-500" />
              Not Applicable
            </>
          )}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          disabled={isDisabled}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Undo resolution"
        >
          {loadingAction === 'undo' ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Undo2 className="mr-1.5 h-4 w-4" />
          )}
          Undo
        </Button>
      </div>
    )
  }

  return (
    <div className={cn('flex items-center gap-2 flex-wrap', className)}>
      {/* Mark Resolved button */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleResolve}
        disabled={isDisabled}
        className="text-green-600 hover:text-green-700 hover:bg-green-50"
        aria-label="Mark as resolved"
      >
        {loadingAction === 'resolve' ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <Check className="mr-1.5 h-4 w-4" />
        )}
        Resolved
      </Button>

      {/* Mark N/A button */}
      <MarkNADialog
        onSubmit={handleMarkNA}
        isLoading={isDisabled}
        trigger={
          <Button
            variant="outline"
            size="sm"
            className="text-gray-600 hover:text-gray-700 hover:bg-gray-100"
            aria-label="Mark as not applicable"
          >
            <XCircle className="mr-1.5 h-4 w-4" />
            N/A
          </Button>
        }
      />

      {/* Info gap specific actions */}
      {isInfoGap && (
        <>
          {/* Add to IRL button */}
          <AddToIRLDialog
            gap={gap}
            projectId={projectId}
            onSuccess={handleResolve}
            isLoading={isDisabled}
          />

          {/* Add Finding button */}
          <AddFindingDialog
            gap={gap}
            projectId={projectId}
            onSuccess={handleResolve}
            isLoading={isDisabled}
          />
        </>
      )}
    </div>
  )
}
