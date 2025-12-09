'use client'

/**
 * Conflict Resolution Modal
 * Displays concurrent edit conflict with Keep Mine/Keep Theirs/Merge options
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 5, 6)
 *
 * Features:
 * - Side-by-side comparison of conflicting versions
 * - Keep Mine - overwrites with local changes
 * - Keep Theirs - accepts server version
 * - Merge - combines changes with manual editing
 */

import { useState, useCallback } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, GitMerge, Check } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { QAItem } from '@/lib/types/qa'

interface ConflictResolutionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  yourVersion: Partial<QAItem>
  theirVersion: QAItem
  onKeepMine: () => void
  onKeepTheirs: () => void
  onMerge: (merged: Partial<QAItem>) => void
}

export function ConflictResolutionModal({
  open,
  onOpenChange,
  yourVersion,
  theirVersion,
  onKeepMine,
  onKeepTheirs,
  onMerge,
}: ConflictResolutionModalProps) {
  const [activeTab, setActiveTab] = useState<'compare' | 'merge'>('compare')
  const [mergedQuestion, setMergedQuestion] = useState(
    yourVersion.question ?? theirVersion.question ?? ''
  )
  const [mergedAnswer, setMergedAnswer] = useState(
    yourVersion.answer ?? theirVersion.answer ?? ''
  )
  const [mergedComment, setMergedComment] = useState(
    yourVersion.comment ?? theirVersion.comment ?? ''
  )

  // Handle merge submission
  const handleMerge = useCallback(() => {
    onMerge({
      question: mergedQuestion !== theirVersion.question ? mergedQuestion : undefined,
      answer: mergedAnswer !== theirVersion.answer ? mergedAnswer : undefined,
      comment: mergedComment !== theirVersion.comment ? mergedComment : undefined,
    })
  }, [mergedQuestion, mergedAnswer, mergedComment, theirVersion, onMerge])

  // Check which fields have conflicts
  const hasQuestionConflict =
    yourVersion.question !== undefined &&
    yourVersion.question !== theirVersion.question
  const hasAnswerConflict =
    yourVersion.answer !== undefined &&
    yourVersion.answer !== theirVersion.answer
  const hasCommentConflict =
    yourVersion.comment !== undefined &&
    yourVersion.comment !== theirVersion.comment

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Concurrent Edit Conflict
          </DialogTitle>
          <DialogDescription>
            Someone else has modified this item while you were editing.
            Choose how to resolve the conflict.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'compare' | 'merge')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="compare">Compare Versions</TabsTrigger>
            <TabsTrigger value="merge">Merge Manually</TabsTrigger>
          </TabsList>

          {/* Compare Tab */}
          <TabsContent value="compare" className="space-y-4 mt-4">
            {/* Question Comparison */}
            {hasQuestionConflict && (
              <ConflictField
                label="Question"
                yourValue={yourVersion.question!}
                theirValue={theirVersion.question}
              />
            )}

            {/* Answer Comparison */}
            {hasAnswerConflict && (
              <ConflictField
                label="Answer"
                yourValue={yourVersion.answer ?? '(empty)'}
                theirValue={theirVersion.answer ?? '(empty)'}
              />
            )}

            {/* Comment Comparison */}
            {hasCommentConflict && (
              <ConflictField
                label="Notes"
                yourValue={yourVersion.comment ?? '(empty)'}
                theirValue={theirVersion.comment ?? '(empty)'}
              />
            )}

            {/* Quick actions */}
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                onClick={onKeepTheirs}
                className="flex items-center gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                Keep Their Version
              </Button>
              <Button
                variant="default"
                onClick={onKeepMine}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Keep My Version
              </Button>
            </div>
          </TabsContent>

          {/* Merge Tab */}
          <TabsContent value="merge" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Edit the fields below to create a merged version combining both changes.
            </p>

            {/* Question */}
            {hasQuestionConflict && (
              <div className="space-y-2">
                <Label htmlFor="merge-question">Question</Label>
                <Textarea
                  id="merge-question"
                  value={mergedQuestion}
                  onChange={(e) => setMergedQuestion(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMergedQuestion(yourVersion.question!)}
                    className="text-xs"
                  >
                    Use Mine
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMergedQuestion(theirVersion.question)}
                    className="text-xs"
                  >
                    Use Theirs
                  </Button>
                </div>
              </div>
            )}

            {/* Answer */}
            {hasAnswerConflict && (
              <div className="space-y-2">
                <Label htmlFor="merge-answer">Answer</Label>
                <Textarea
                  id="merge-answer"
                  value={mergedAnswer}
                  onChange={(e) => setMergedAnswer(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMergedAnswer(yourVersion.answer ?? '')}
                    className="text-xs"
                  >
                    Use Mine
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMergedAnswer(theirVersion.answer ?? '')}
                    className="text-xs"
                  >
                    Use Theirs
                  </Button>
                </div>
              </div>
            )}

            {/* Comment */}
            {hasCommentConflict && (
              <div className="space-y-2">
                <Label htmlFor="merge-comment">Notes</Label>
                <Textarea
                  id="merge-comment"
                  value={mergedComment}
                  onChange={(e) => setMergedComment(e.target.value)}
                  rows={2}
                  className="resize-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMergedComment(yourVersion.comment ?? '')}
                    className="text-xs"
                  >
                    Use Mine
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMergedComment(theirVersion.comment ?? '')}
                    className="text-xs"
                  >
                    Use Theirs
                  </Button>
                </div>
              </div>
            )}

            {/* Merge action */}
            <div className="flex justify-center pt-4">
              <Button onClick={handleMerge} className="flex items-center gap-2">
                <GitMerge className="h-4 w-4" />
                Save Merged Version
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Last updated by another user at{' '}
            {new Date(theirVersion.updatedAt).toLocaleString()}
          </p>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Helper component for side-by-side field comparison
interface ConflictFieldProps {
  label: string
  yourValue: string
  theirValue: string
}

function ConflictField({ label, yourValue, theirValue }: ConflictFieldProps) {
  return (
    <div className="rounded-lg border p-4">
      <Label className="text-sm font-medium mb-2 block">{label}</Label>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
            Your Version
          </Badge>
          <div className="text-sm bg-muted/50 rounded p-2 min-h-[60px]">
            {yourValue}
          </div>
        </div>
        <div className="space-y-1">
          <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
            Their Version
          </Badge>
          <div className="text-sm bg-muted/50 rounded p-2 min-h-[60px]">
            {theirValue}
          </div>
        </div>
      </div>
    </div>
  )
}
