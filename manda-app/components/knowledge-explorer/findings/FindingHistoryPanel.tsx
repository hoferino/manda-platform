/**
 * FindingHistoryPanel Component
 * Story: E7.5 - Maintain Comprehensive Audit Trail (AC: #7)
 *
 * Displays complete correction lineage for a finding with:
 * - Timeline of all corrections and validations
 * - Original/corrected values with diff highlighting
 * - Analyst name and timestamp for each entry
 * - validation_status badge for each correction
 * - Expandable details for source validation info
 * - Confidence impact summary
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  History,
  CheckCircle2,
  XCircle,
  Edit3,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  FileText,
  MapPin,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import type {
  FindingHistoryEntry,
  AuditEntry,
  FindingCorrection,
  ValidationFeedback,
  ValidationStatus,
} from '@/lib/types/feedback'

export interface FindingHistoryPanelProps {
  findingId: string | null
  projectId: string
  isOpen: boolean
  onClose: () => void
}

/**
 * Badge color for validation status
 */
function getValidationStatusBadge(status: ValidationStatus) {
  switch (status) {
    case 'confirmed_with_source':
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Source Confirmed
        </Badge>
      )
    case 'override_without_source':
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
          <Edit3 className="h-3 w-3 mr-1" />
          Override
        </Badge>
      )
    case 'source_error':
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Source Error
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="bg-slate-50 text-slate-600">
          Pending
        </Badge>
      )
  }
}

/**
 * Badge for correction type
 */
function getCorrectionTypeBadge(type: string) {
  const colors: Record<string, string> = {
    value: 'bg-blue-50 text-blue-700 border-blue-200',
    source: 'bg-purple-50 text-purple-700 border-purple-200',
    confidence: 'bg-amber-50 text-amber-700 border-amber-200',
    text: 'bg-slate-50 text-slate-600 border-slate-200',
  }

  return (
    <Badge variant="outline" className={cn('text-xs', colors[type] || colors.text)}>
      {type}
    </Badge>
  )
}

/**
 * Timeline entry for a correction
 */
function CorrectionEntry({
  correction,
  isLast,
}: {
  correction: FindingCorrection
  isLast: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasSourceInfo =
    correction.originalSourceDocument ||
    correction.originalSourceLocation ||
    correction.userSourceReference

  return (
    <div className="relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
      )}

      <div className="flex gap-3">
        {/* Timeline dot */}
        <div className="flex-shrink-0 mt-1">
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
            <Edit3 className="h-4 w-4 text-blue-600" />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pb-6">
          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {getCorrectionTypeBadge(correction.correctionType)}
                  {getValidationStatusBadge(correction.validationStatus)}
                </div>

                {/* Value change */}
                <div className="mt-2 p-2 bg-muted rounded-md text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="line-through text-muted-foreground">
                      {correction.originalValue.slice(0, 100)}
                      {correction.originalValue.length > 100 && '...'}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-foreground">
                      {correction.correctedValue.slice(0, 100)}
                      {correction.correctedValue.length > 100 && '...'}
                    </span>
                  </div>
                </div>

                {/* Timestamp and analyst */}
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    title={format(new Date(correction.createdAt), 'PPpp')}
                  >
                    {formatDistanceToNow(new Date(correction.createdAt), {
                      addSuffix: true,
                    })}
                  </span>
                  <span>•</span>
                  <span>Analyst {correction.analystId.slice(0, 8)}...</span>
                </div>

                {/* Reason */}
                {correction.reason && (
                  <p className="mt-1 text-sm text-muted-foreground italic">
                    &quot;{correction.reason}&quot;
                  </p>
                )}
              </div>

              {/* Expand button for source info */}
              {hasSourceInfo && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7 px-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>

            {/* Expandable source info */}
            {hasSourceInfo && (
              <CollapsibleContent className="mt-2">
                <div className="p-3 bg-slate-50 rounded-md text-sm space-y-2">
                  {correction.originalSourceDocument && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Source:</span>
                      <span>{correction.originalSourceDocument}</span>
                    </div>
                  )}
                  {correction.originalSourceLocation && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Location:</span>
                      <span>{correction.originalSourceLocation}</span>
                    </div>
                  )}
                  {correction.userSourceReference && (
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground flex-shrink-0">
                        Reference:
                      </span>
                      <span className="italic">
                        &quot;{correction.userSourceReference}&quot;
                      </span>
                    </div>
                  )}
                </div>
              </CollapsibleContent>
            )}
          </Collapsible>
        </div>
      </div>
    </div>
  )
}

/**
 * Timeline entry for a validation
 */
function ValidationEntry({
  validation,
  isLast,
}: {
  validation: ValidationFeedback
  isLast: boolean
}) {
  const isValidation = validation.action === 'validate'

  return (
    <div className="relative">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 bottom-0 w-0.5 bg-border" />
      )}

      <div className="flex gap-3">
        {/* Timeline dot */}
        <div className="flex-shrink-0 mt-1">
          <div
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center',
              isValidation ? 'bg-green-100' : 'bg-red-100'
            )}
          >
            {isValidation ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-red-600" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 pb-6">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn(
                isValidation
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              )}
            >
              {isValidation ? 'Validated' : 'Rejected'}
            </Badge>
          </div>

          {/* Timestamp and analyst */}
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span
              title={format(new Date(validation.createdAt), 'PPpp')}
            >
              {formatDistanceToNow(new Date(validation.createdAt), {
                addSuffix: true,
              })}
            </span>
            <span>•</span>
            <span>Analyst {validation.analystId.slice(0, 8)}...</span>
          </div>

          {/* Reason for rejection */}
          {validation.reason && (
            <p className="mt-1 text-sm text-muted-foreground italic">
              &quot;{validation.reason}&quot;
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Loading skeleton
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6" aria-busy="true">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>
      <Separator />
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Empty state
 */
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No History
      </h3>
      <p className="text-sm text-muted-foreground">
        This finding has no corrections or validation feedback yet.
      </p>
    </div>
  )
}

/**
 * Error state
 */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <History className="h-12 w-12 text-muted-foreground/50 mb-4" />
      <h3 className="text-lg font-semibold text-foreground mb-2">
        Unable to load history
      </h3>
      <p className="text-sm text-muted-foreground mb-4">{error}</p>
      <Button variant="outline" onClick={onRetry}>
        <RefreshCw className="h-4 w-4 mr-2" />
        Try again
      </Button>
    </div>
  )
}

export function FindingHistoryPanel({
  findingId,
  projectId,
  isOpen,
  onClose,
}: FindingHistoryPanelProps) {
  const [history, setHistory] = useState<FindingHistoryEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch history when panel opens
  const fetchHistory = useCallback(async () => {
    if (!findingId) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/findings/${findingId}/history?full=true`
      )

      if (!response.ok) {
        throw new Error('Failed to load history')
      }

      const data: FindingHistoryEntry = await response.json()
      setHistory(data)
    } catch (err) {
      console.error('Error fetching history:', err)
      setError(err instanceof Error ? err.message : 'Failed to load history')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, findingId])

  useEffect(() => {
    if (isOpen && findingId) {
      fetchHistory()
    }
  }, [isOpen, findingId, fetchHistory])

  // Reset when panel closes
  useEffect(() => {
    if (!isOpen) {
      setHistory(null)
      setError(null)
    }
  }, [isOpen])

  // Calculate totals
  const totalCorrections = history?.corrections.length || 0
  const totalValidations = history?.validations.length || 0
  const confidenceChange = history
    ? history.confidenceImpact.current - history.confidenceImpact.original
    : 0

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg flex flex-col p-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Finding History
          </SheetTitle>
          <SheetDescription>
            Complete audit trail of corrections and validations
          </SheetDescription>
        </SheetHeader>

        {isLoading && <LoadingSkeleton />}

        {error && <ErrorState error={error} onRetry={fetchHistory} />}

        {!isLoading && !error && history && (
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {totalCorrections}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Corrections
                  </div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold text-foreground">
                    {totalValidations}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Validations
                  </div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="flex items-center justify-center gap-1">
                    {confidenceChange > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : confidenceChange < 0 ? (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    ) : null}
                    <span
                      className={cn(
                        'text-2xl font-bold',
                        confidenceChange > 0
                          ? 'text-green-600'
                          : confidenceChange < 0
                          ? 'text-red-600'
                          : 'text-foreground'
                      )}
                    >
                      {confidenceChange > 0 ? '+' : ''}
                      {Math.round(confidenceChange * 100)}%
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Confidence
                  </div>
                </div>
              </div>

              <Separator />

              {/* Timeline */}
              {history.timeline.length === 0 ? (
                <EmptyState />
              ) : (
                <div className="space-y-0">
                  <h4 className="text-sm font-medium text-muted-foreground mb-4">
                    Timeline
                  </h4>
                  {history.timeline.map((entry, index) => {
                    const isLast = index === history.timeline.length - 1

                    if (entry.type === 'correction') {
                      return (
                        <CorrectionEntry
                          key={entry.id}
                          correction={entry.data as FindingCorrection}
                          isLast={isLast}
                        />
                      )
                    }

                    return (
                      <ValidationEntry
                        key={entry.id}
                        validation={entry.data as ValidationFeedback}
                        isLast={isLast}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        {!isLoading && !error && !history && <EmptyState />}
      </SheetContent>
    </Sheet>
  )
}
