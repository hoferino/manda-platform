'use client'

/**
 * Q&A Import Modal Component
 *
 * Modal for previewing and confirming Excel import.
 * Story: E8.7 - Excel Import with Pattern Matching
 *
 * Features:
 * - Three-section preview: exact matches, fuzzy matches, new items
 * - AC: #2 - Exact matches shown with auto-merge indication
 * - AC: #3 - Fuzzy matches shown with similarity %, require approval
 * - AC: #4 - New items section with toggle for creating new Q&A items
 * - Progress bar during upload and import
 * - Summary statistics
 */

import { useState, useCallback } from 'react'
import { Loader2, Check, AlertTriangle, Plus, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'
import { uploadQAImportFile, confirmQAImport } from '@/lib/api/qa'
import type {
  QAImportPreview,
  QAExactMatch,
  QAFuzzyMatch,
  ImportedQARow,
  FuzzyMatchDecision,
} from '@/lib/types/qa'

export interface QAImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  file: File | null
  onImportComplete: () => void
}

type ImportStep = 'uploading' | 'preview' | 'confirming' | 'complete'

/**
 * Modal component for Q&A import workflow
 */
export function QAImportModal({
  open,
  onOpenChange,
  projectId,
  file,
  onImportComplete,
}: QAImportModalProps) {
  const [step, setStep] = useState<ImportStep>('uploading')
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<QAImportPreview | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [exactMatchIds, setExactMatchIds] = useState<Set<string>>(new Set())
  const [fuzzyDecisions, setFuzzyDecisions] = useState<Record<string, FuzzyMatchDecision>>({})
  const [importNewItems, setImportNewItems] = useState(false)

  // Reset state when modal opens with new file
  const resetState = useCallback(() => {
    setStep('uploading')
    setProgress(0)
    setPreview(null)
    setError(null)
    setExactMatchIds(new Set())
    setFuzzyDecisions({})
    setImportNewItems(false)
  }, [])

  // Upload file and get preview
  const uploadFile = useCallback(async () => {
    if (!file) return

    resetState()
    setProgress(10)

    try {
      setProgress(30)
      const response = await uploadQAImportFile(projectId, file)
      setProgress(100)

      setPreview(response.preview)

      // Default: select all exact matches
      const allExactIds = new Set(response.preview.exactMatches.map(m => m.existing.id))
      setExactMatchIds(allExactIds)

      // Default: skip all fuzzy matches (user must explicitly accept)
      const defaultFuzzyDecisions: Record<string, FuzzyMatchDecision> = {}
      for (const match of response.preview.fuzzyMatches) {
        defaultFuzzyDecisions[match.existing.id] = 'skip'
      }
      setFuzzyDecisions(defaultFuzzyDecisions)

      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process file')
      setStep('preview') // Show error in preview step
    }
  }, [file, projectId, resetState])

  // Start upload when modal opens with file
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen && file) {
        uploadFile()
      }
      onOpenChange(newOpen)
    },
    [file, uploadFile, onOpenChange]
  )

  // Toggle exact match selection
  const toggleExactMatch = (id: string) => {
    setExactMatchIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // Set fuzzy match decision
  const setFuzzyDecision = (id: string, decision: FuzzyMatchDecision) => {
    setFuzzyDecisions(prev => ({ ...prev, [id]: decision }))
  }

  // Confirm import
  const handleConfirm = async () => {
    if (!preview) return

    setStep('confirming')
    setProgress(0)

    try {
      setProgress(50)

      const response = await confirmQAImport(projectId, preview, {
        exactMatchIds: Array.from(exactMatchIds),
        fuzzyMatchDecisions: fuzzyDecisions,
        importNewItems,
      })

      setProgress(100)
      setStep('complete')

      const { stats } = response.result
      toast.success('Import completed', {
        description: `${stats.exactUpdated} exact, ${stats.fuzzyUpdated} fuzzy, ${stats.newCreated} new items`,
      })

      // Close modal and refresh list
      setTimeout(() => {
        onOpenChange(false)
        onImportComplete()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to confirm import')
      setStep('preview')
      toast.error('Import failed', {
        description: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // Calculate import summary
  const getImportSummary = () => {
    if (!preview) return { total: 0, exact: 0, fuzzy: 0, new: 0 }

    const exact = exactMatchIds.size
    const fuzzy = Object.values(fuzzyDecisions).filter(d => d === 'accept').length
    const newCount = importNewItems ? preview.newItems.length : 0

    return {
      total: exact + fuzzy + newCount,
      exact,
      fuzzy,
      new: newCount,
    }
  }

  const summary = getImportSummary()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Q&A from Excel</DialogTitle>
          <DialogDescription>
            {step === 'uploading' && 'Processing your file...'}
            {step === 'preview' && 'Review matches and confirm import'}
            {step === 'confirming' && 'Importing items...'}
            {step === 'complete' && 'Import complete!'}
          </DialogDescription>
        </DialogHeader>

        {/* Progress bar for uploading/confirming */}
        {(step === 'uploading' || step === 'confirming') && (
          <div className="py-8">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {step === 'uploading' ? 'Analyzing file...' : 'Importing items...'}
            </p>
          </div>
        )}

        {/* Error state */}
        {error && step === 'preview' && (
          <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
            <p className="font-medium">Import Error</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        )}

        {/* Preview content */}
        {step === 'preview' && preview && !error && (
          <div className="flex-1 min-h-0">
            {/* Summary stats */}
            <div className="flex gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-500" />
                <span>{preview.stats.exactCount} exact matches</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                <span>{preview.stats.fuzzyCount} fuzzy matches</span>
              </div>
              <div className="flex items-center gap-2">
                <Plus className="h-4 w-4 text-blue-500" />
                <span>{preview.stats.newCount} new items</span>
              </div>
            </div>

            {/* Tabs for match categories */}
            <Tabs defaultValue="exact" className="flex-1">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="exact">
                  Exact ({preview.stats.exactCount})
                </TabsTrigger>
                <TabsTrigger value="fuzzy">
                  Fuzzy ({preview.stats.fuzzyCount})
                </TabsTrigger>
                <TabsTrigger value="new">
                  New ({preview.stats.newCount})
                </TabsTrigger>
              </TabsList>

              {/* Exact Matches Tab */}
              <TabsContent value="exact" className="mt-4">
                <ScrollArea className="h-[300px]">
                  {preview.exactMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No exact matches found
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {preview.exactMatches.map(match => (
                        <ExactMatchRow
                          key={match.existing.id}
                          match={match}
                          selected={exactMatchIds.has(match.existing.id)}
                          onToggle={() => toggleExactMatch(match.existing.id)}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* Fuzzy Matches Tab - AC: #3 */}
              <TabsContent value="fuzzy" className="mt-4">
                <ScrollArea className="h-[300px]">
                  {preview.fuzzyMatches.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No fuzzy matches found
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {preview.fuzzyMatches.map(match => (
                        <FuzzyMatchRow
                          key={match.existing.id}
                          match={match}
                          decision={fuzzyDecisions[match.existing.id] || 'skip'}
                          onDecisionChange={(d) => setFuzzyDecision(match.existing.id, d)}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              {/* New Items Tab - AC: #4 */}
              <TabsContent value="new" className="mt-4">
                <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
                  <Checkbox
                    id="import-new"
                    checked={importNewItems}
                    onCheckedChange={(checked) => setImportNewItems(!!checked)}
                  />
                  <label htmlFor="import-new" className="text-sm font-medium cursor-pointer">
                    Create new Q&A items for unmatched questions
                  </label>
                </div>
                <ScrollArea className="h-[250px]">
                  {preview.newItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No new items to import
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {preview.newItems.map((item, idx) => (
                        <NewItemRow key={idx} item={item} />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Complete state */}
        {step === 'complete' && (
          <div className="py-8 text-center">
            <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Import Complete!</p>
            <p className="text-sm text-muted-foreground mt-2">
              {summary.total} items have been imported
            </p>
          </div>
        )}

        {/* Footer with actions */}
        {step === 'preview' && preview && !error && (
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <div className="flex-1 text-sm text-muted-foreground">
              {summary.total > 0
                ? `${summary.total} items will be imported (${summary.exact} exact, ${summary.fuzzy} fuzzy, ${summary.new} new)`
                : 'Select items to import'}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={summary.total === 0}>
                Import {summary.total} Items
              </Button>
            </div>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface ExactMatchRowProps {
  match: QAExactMatch
  selected: boolean
  onToggle: () => void
}

function ExactMatchRow({ match, selected, onToggle }: ExactMatchRowProps) {
  const hasAnswer = !!match.imported.answer

  return (
    <div
      className={`p-3 rounded-lg border ${selected ? 'border-green-500 bg-green-50 dark:bg-green-950' : 'border-border'}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={selected}
          onCheckedChange={onToggle}
          disabled={!hasAnswer}
          aria-label={`Select exact match: ${match.existing.question.substring(0, 50)}`}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{match.existing.question}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary" className="text-xs">
              {match.existing.category}
            </Badge>
            <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
              100% match
            </Badge>
          </div>
          {hasAnswer ? (
            <p className="text-xs text-muted-foreground mt-2 truncate">
              Answer: {match.imported.answer?.substring(0, 100)}...
            </p>
          ) : (
            <p className="text-xs text-yellow-600 mt-2">No answer to import</p>
          )}
        </div>
      </div>
    </div>
  )
}

interface FuzzyMatchRowProps {
  match: QAFuzzyMatch
  decision: FuzzyMatchDecision
  onDecisionChange: (decision: FuzzyMatchDecision) => void
}

function FuzzyMatchRow({ match, decision, onDecisionChange }: FuzzyMatchRowProps) {
  const similarityPercent = Math.round(match.similarity * 100)
  const hasAnswer = !!match.imported.answer

  return (
    <div
      className={`p-3 rounded-lg border ${
        decision === 'accept'
          ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950'
          : 'border-border'
      }`}
    >
      <div className="space-y-2">
        {/* Existing question */}
        <div>
          <p className="text-xs text-muted-foreground">Existing:</p>
          <p className="text-sm truncate">{match.existing.question}</p>
        </div>

        {/* Imported question */}
        <div>
          <p className="text-xs text-muted-foreground">Imported:</p>
          <p className="text-sm truncate">{match.imported.question}</p>
        </div>

        {/* Similarity and decision */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {match.existing.category}
            </Badge>
            <Badge
              variant="outline"
              className={`text-xs ${
                similarityPercent >= 95
                  ? 'bg-green-100 text-green-700'
                  : 'bg-yellow-100 text-yellow-700'
              }`}
            >
              {similarityPercent}% similar
            </Badge>
          </div>

          {/* Decision buttons */}
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={decision === 'accept' ? 'default' : 'outline'}
              onClick={() => onDecisionChange('accept')}
              disabled={!hasAnswer}
              className="h-7 px-2 text-xs"
            >
              <Check className="h-3 w-3 mr-1" />
              Accept
            </Button>
            <Button
              size="sm"
              variant={decision === 'skip' ? 'secondary' : 'outline'}
              onClick={() => onDecisionChange('skip')}
              className="h-7 px-2 text-xs"
            >
              <X className="h-3 w-3 mr-1" />
              Skip
            </Button>
          </div>
        </div>

        {hasAnswer ? (
          <p className="text-xs text-muted-foreground truncate">
            Answer: {match.imported.answer?.substring(0, 100)}...
          </p>
        ) : (
          <p className="text-xs text-yellow-600">No answer to import</p>
        )}
      </div>
    </div>
  )
}

interface NewItemRowProps {
  item: ImportedQARow
}

function NewItemRow({ item }: NewItemRowProps) {
  return (
    <div className="p-3 rounded-lg border border-border">
      <p className="text-sm truncate">{item.question}</p>
      <div className="flex items-center gap-2 mt-1">
        {item.category && (
          <Badge variant="secondary" className="text-xs">
            {item.category}
          </Badge>
        )}
        {item.priority && (
          <Badge variant="outline" className="text-xs">
            {item.priority}
          </Badge>
        )}
        <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700">
          New item
        </Badge>
      </div>
      {item.answer && (
        <p className="text-xs text-muted-foreground mt-2 truncate">
          Answer: {item.answer.substring(0, 100)}...
        </p>
      )}
    </div>
  )
}

export default QAImportModal
