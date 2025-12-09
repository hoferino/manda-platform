/**
 * AddToQAModal Component
 * Modal for adding a finding to the Q&A list with pre-drafted question
 * Story: E8.5 - Finding → Q&A Quick-Add (AC: #2, #3, #4, #5)
 *
 * Features:
 * - Pre-populated question field based on finding text
 * - Pre-selected category based on finding's domain
 * - Priority dropdown (default: medium)
 * - Editable question textarea with validation (10-2000 chars)
 * - Submit button with loading state
 * - Success toast with link to Q&A page
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Loader2, MessageSquarePlus, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { createQAItem } from '@/lib/api/qa'
import {
  mapDomainToQACategory,
  generateQuestionFromFinding,
  suggestQAPriority,
} from '@/lib/utils/finding-qa-mapping'
import {
  QA_CATEGORIES,
  QA_PRIORITIES,
  QA_CATEGORY_CONFIG,
  QA_PRIORITY_CONFIG,
  type QACategory,
  type QAPriority,
} from '@/lib/types/qa'
import type { Finding } from '@/lib/types/findings'

export interface AddToQAModalProps {
  /** The finding to create a Q&A item from */
  finding: Finding
  /** Project ID for the API call */
  projectId: string
  /** Whether the modal is open */
  isOpen: boolean
  /** Callback when modal is closed */
  onClose: () => void
  /** Callback when Q&A item is successfully created */
  onSuccess: (qaItemId: string) => void
}

/**
 * Character count indicator with validation styling
 */
function CharCount({ count, min, max }: { count: number; min: number; max: number }) {
  const isValid = count >= min && count <= max
  const isNearMax = count > max * 0.9

  return (
    <span
      className={`text-xs ${
        !isValid ? 'text-red-500' : isNearMax ? 'text-amber-500' : 'text-muted-foreground'
      }`}
      aria-live="polite"
    >
      {count}/{max}
      {count < min && ` (min ${min})`}
    </span>
  )
}

export function AddToQAModal({
  finding,
  projectId,
  isOpen,
  onClose,
  onSuccess,
}: AddToQAModalProps) {
  // Initialize state with pre-populated values from finding
  const [question, setQuestion] = useState('')
  const [category, setCategory] = useState<QACategory>('Operations')
  const [priority, setPriority] = useState<QAPriority>('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Character limits for question field
  const MIN_CHARS = 10
  const MAX_CHARS = 2000

  // Initialize form when modal opens with new finding
  useEffect(() => {
    if (isOpen && finding) {
      setQuestion(generateQuestionFromFinding(finding))
      setCategory(mapDomainToQACategory(finding.domain))
      setPriority(suggestQAPriority(finding))
    }
  }, [isOpen, finding])

  // Validation
  const isQuestionValid = question.length >= MIN_CHARS && question.length <= MAX_CHARS
  const canSubmit = isQuestionValid && !isSubmitting

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return

    setIsSubmitting(true)
    try {
      const qaItem = await createQAItem(projectId, {
        question,
        category,
        priority,
        sourceFindingId: finding.id,
      })

      // Show success toast with link to Q&A page
      toast.success(
        <div className="flex items-center gap-2">
          <span>Added to Q&A list</span>
          <a
            href={`/projects/${projectId}/qa?itemId=${qaItem.id}`}
            className="inline-flex items-center gap-1 text-primary hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            View
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>,
        { duration: 5000 }
      )

      onSuccess(qaItem.id)
      onClose()
    } catch (error) {
      console.error('[AddToQAModal] Error creating Q&A item:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to add to Q&A list')
    } finally {
      setIsSubmitting(false)
    }
  }, [canSubmit, question, category, priority, finding.id, projectId, onSuccess, onClose])

  // Handle close (reset form)
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        onClose()
      }
    },
    [onClose]
  )

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5 text-violet-600" />
            Add to Q&A List
          </DialogTitle>
          <DialogDescription>
            Create a Q&A item to ask the client about this finding. The question will be sent to the
            client for clarification.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Question textarea */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="qa-question">Question *</Label>
              <CharCount count={question.length} min={MIN_CHARS} max={MAX_CHARS} />
            </div>
            <Textarea
              id="qa-question"
              placeholder="Enter the question for the client..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={5}
              className="resize-none"
              aria-describedby="question-hint"
              aria-invalid={question.length > 0 && !isQuestionValid}
            />
            <p id="question-hint" className="text-xs text-muted-foreground">
              The question should be specific and professional. It will be sent to the client.
            </p>
          </div>

          {/* Category and Priority row */}
          <div className="grid grid-cols-2 gap-4">
            {/* Category select */}
            <div className="grid gap-2">
              <Label htmlFor="qa-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as QACategory)}>
                <SelectTrigger id="qa-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {QA_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${QA_CATEGORY_CONFIG[cat].color.split(' ')[0]}`}
                        />
                        {QA_CATEGORY_CONFIG[cat].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority select */}
            <div className="grid gap-2">
              <Label htmlFor="qa-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as QAPriority)}>
                <SelectTrigger id="qa-priority">
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  {QA_PRIORITIES.map((pri) => (
                    <SelectItem key={pri} value={pri}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${QA_PRIORITY_CONFIG[pri].color.split(' ')[0]}`}
                        />
                        {QA_PRIORITY_CONFIG[pri].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Finding source info */}
          <div className="rounded-md bg-muted/50 p-3 text-sm">
            <p className="font-medium text-muted-foreground mb-1">Source Finding</p>
            <p className="text-foreground line-clamp-2" title={finding.text}>
              {finding.text}
            </p>
            {finding.sourceDocument && (
              <p className="text-xs text-muted-foreground mt-1">
                From: {finding.sourceDocument}
                {finding.pageNumber && ` (p. ${finding.pageNumber})`}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-violet-600 hover:bg-violet-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Add to Q&A
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
