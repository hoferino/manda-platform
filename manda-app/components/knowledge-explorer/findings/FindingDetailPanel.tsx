/**
 * FindingDetailPanel Component
 * Slide-out panel for detailed finding view with full context
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 1, 2, 7, 8)
 *
 * Features:
 * - Slide-out Sheet panel from right
 * - Full finding text with metadata badges
 * - Confidence reasoning section
 * - Source attribution with document preview
 * - Related findings list
 * - Validation history timeline
 * - Actions (validate/reject/edit)
 * - Loading skeleton state
 * - Keyboard navigation (Escape to close)
 * - Full accessibility support
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ConfidenceBadge,
  DomainTag,
  StatusBadge,
  SourceAttributionLink,
} from '../shared'
import { FindingActions } from './FindingActions'
import { ConfidenceReasoning } from './ConfidenceReasoning'
import { ValidationHistory } from './ValidationHistory'
import { RelatedFindings, type RelatedFindingWithSimilarity } from './RelatedFindings'
import { InlineEdit } from './InlineEdit'
import { getFindingById, validateFinding, updateFinding } from '@/lib/api/findings'
import type { FindingWithContext, Finding } from '@/lib/types/findings'
import { cn } from '@/lib/utils'
import {
  Calendar,
  User,
  FileText,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'

export interface FindingDetailPanelProps {
  findingId: string | null
  projectId: string
  isOpen: boolean
  onClose: () => void
  onFindingUpdated?: (finding: Finding) => void
}

/**
 * Loading skeleton for the panel
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6" aria-busy="true" aria-label="Loading finding details">
      {/* Header skeleton */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-6 w-24" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>

      <Separator />

      {/* Confidence skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <Separator />

      {/* Source skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>

      <Separator />

      {/* Related findings skeleton */}
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}

/**
 * Error state component
 */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Unable to load finding
      </h3>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Try again
      </Button>
    </div>
  )
}

export function FindingDetailPanel({
  findingId,
  projectId,
  isOpen,
  onClose,
  onFindingUpdated,
}: FindingDetailPanelProps) {
  const router = useRouter()
  const [finding, setFinding] = useState<FindingWithContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)

  // Fetch finding data when panel opens or findingId changes
  const fetchFinding = useCallback(async () => {
    if (!findingId) return

    setIsLoading(true)
    setError(null)

    try {
      const data = await getFindingById(projectId, findingId)
      setFinding(data)
    } catch (err) {
      console.error('Error fetching finding:', err)
      setError(err instanceof Error ? err.message : 'Failed to load finding')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, findingId])

  useEffect(() => {
    if (isOpen && findingId) {
      fetchFinding()
    }
  }, [isOpen, findingId, fetchFinding])

  // Reset state when panel closes
  useEffect(() => {
    if (!isOpen) {
      setFinding(null)
      setError(null)
      setIsEditing(false)
    }
  }, [isOpen])

  // Handle validation action
  const handleValidate = useCallback(
    async (fId: string, action: 'confirm' | 'reject') => {
      if (!finding) return

      try {
        const updatedFinding = await validateFinding(projectId, fId, action)

        // Update local state
        setFinding(prev =>
          prev
            ? {
                ...prev,
                status: updatedFinding.status,
                validationHistory: updatedFinding.validationHistory,
              }
            : prev
        )

        onFindingUpdated?.(updatedFinding)

        toast.success(action === 'confirm' ? 'Finding validated' : 'Finding rejected')
      } catch (err) {
        console.error('Validation error:', err)
        toast.error('Failed to update finding')
      }
    },
    [projectId, finding, onFindingUpdated]
  )

  // Handle edit action
  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  // Handle save edit
  const handleSaveEdit = useCallback(
    async (newText: string) => {
      if (!finding) return

      try {
        const updatedFinding = await updateFinding(projectId, finding.id, {
          text: newText,
        })

        // Update local state
        setFinding(prev =>
          prev
            ? {
                ...prev,
                text: updatedFinding.text,
                validationHistory: updatedFinding.validationHistory,
              }
            : prev
        )

        onFindingUpdated?.(updatedFinding)
        setIsEditing(false)

        toast.success('Finding updated')
      } catch (err) {
        console.error('Edit error:', err)
        toast.error('Failed to update finding')
        throw err
      }
    },
    [projectId, finding, onFindingUpdated]
  )

  // Handle cancel edit
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  // Handle related finding click - navigate to that finding
  const handleSelectRelatedFinding = useCallback(
    (relatedFindingId: string) => {
      // Close current panel and open new one for the related finding
      // This triggers URL update which re-opens panel with new finding
      onClose()

      // Small delay to allow close animation, then update URL
      setTimeout(() => {
        const currentUrl = new URL(window.location.href)
        currentUrl.searchParams.set('findingId', relatedFindingId)
        router.push(currentUrl.pathname + currentUrl.search)
      }, 100)
    },
    [onClose, router]
  )

  // Handle "Open in Data Room" click
  const handleOpenInDataRoom = useCallback(() => {
    if (!finding?.document) return

    router.push(`/projects/${projectId}/data-room?document=${finding.document.id}`)
    onClose()
  }, [finding, projectId, router, onClose])

  // Get confidence reasoning from metadata
  const confidenceReasoning =
    finding?.metadata?.confidence_reasoning as string | null | undefined

  // Format dates
  const createdDate = finding?.createdAt
    ? format(new Date(finding.createdAt), 'MMM d, yyyy h:mm a')
    : null
  const updatedDate = finding?.updatedAt
    ? format(new Date(finding.updatedAt), 'MMM d, yyyy h:mm a')
    : null

  return (
    <Sheet open={isOpen} onOpenChange={open => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl md:max-w-2xl flex flex-col p-0"
        aria-describedby="finding-detail-description"
      >
        {/* Hidden description for screen readers */}
        <p id="finding-detail-description" className="sr-only">
          Detailed view of finding with full context, source attribution, related findings, and validation history
        </p>

        {isLoading && <LoadingSkeleton />}

        {error && <ErrorState error={error} onRetry={fetchFinding} />}

        {!isLoading && !error && finding && (
          <>
            {/* Header */}
            <SheetHeader className="px-6 pt-6 pb-4 space-y-4 border-b">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <DomainTag domain={finding.domain} />
                  {finding.findingType && (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground capitalize">
                      {finding.findingType}
                    </span>
                  )}
                  <StatusBadge status={finding.status} />
                </div>
                <FindingActions
                  findingId={finding.id}
                  status={finding.status}
                  onValidate={handleValidate}
                  onEdit={handleEdit}
                />
              </div>

              <SheetTitle className="text-left">Finding Details</SheetTitle>
            </SheetHeader>

            {/* Scrollable Content */}
            <ScrollArea className="flex-1">
              <div className="space-y-6 p-6">
                {/* Finding Text */}
                <section aria-labelledby="finding-text-heading">
                  <h3 id="finding-text-heading" className="sr-only">
                    Finding Text
                  </h3>
                  {isEditing ? (
                    <InlineEdit
                      value={finding.text}
                      onSave={handleSaveEdit}
                      onCancel={handleCancelEdit}
                      isEditing={true}
                    />
                  ) : (
                    <p className="text-base leading-relaxed text-foreground whitespace-pre-wrap">
                      {finding.text}
                    </p>
                  )}
                </section>

                {/* Metadata Row */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {createdDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      <span>Created {createdDate}</span>
                    </div>
                  )}
                  {updatedDate && updatedDate !== createdDate && (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4" aria-hidden="true" />
                      <span>Updated {updatedDate}</span>
                    </div>
                  )}
                  {finding.userId && (
                    <div className="flex items-center gap-1.5">
                      <User className="h-4 w-4" aria-hidden="true" />
                      <span>User {finding.userId.slice(0, 8)}...</span>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Confidence Reasoning */}
                <section aria-labelledby="confidence-heading">
                  <ConfidenceReasoning
                    confidence={finding.confidence}
                    reasoning={confidenceReasoning}
                  />
                </section>

                <Separator />

                {/* Source Attribution */}
                <section aria-labelledby="source-heading">
                  <h4
                    id="source-heading"
                    className="mb-3 text-sm font-medium text-foreground flex items-center gap-1.5"
                  >
                    <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    Source
                  </h4>

                  {finding.document || finding.sourceDocument ? (
                    <div className="space-y-3">
                      {finding.documentId ? (
                        <SourceAttributionLink
                          documentId={finding.documentId}
                          documentName={finding.document?.name || finding.sourceDocument || 'Unknown document'}
                          chunkId={finding.chunkId}
                          pageNumber={finding.chunk?.pageNumber ?? finding.pageNumber}
                          sheetName={finding.chunk?.sheetName ?? null}
                          cellReference={finding.chunk?.cellReference ?? null}
                          projectId={projectId}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {finding.sourceDocument}
                          {finding.pageNumber && ` (p. ${finding.pageNumber})`}
                        </p>
                      )}

                      {/* Open in Data Room button */}
                      {finding.document && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleOpenInDataRoom}
                          className="mt-2"
                        >
                          <ExternalLink className="h-4 w-4 mr-2" aria-hidden="true" />
                          Open in Data Room
                        </Button>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      No source document linked
                    </p>
                  )}
                </section>

                <Separator />

                {/* Related Findings */}
                <section aria-labelledby="related-findings-heading">
                  <RelatedFindings
                    findings={
                      (finding.relatedFindings || []) as RelatedFindingWithSimilarity[]
                    }
                    onSelectFinding={handleSelectRelatedFinding}
                  />
                </section>

                <Separator />

                {/* Validation History */}
                <section aria-labelledby="history-heading">
                  <ValidationHistory history={finding.validationHistory || []} />
                </section>
              </div>
            </ScrollArea>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
