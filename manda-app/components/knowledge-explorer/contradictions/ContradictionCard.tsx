/**
 * ContradictionCard Component
 * Side-by-side comparison of two conflicting findings
 * Story: E4.6 - Build Contradictions View (AC: #3)
 *
 * Features:
 * - Side-by-side layout with Finding A vs Finding B
 * - Each finding shows text, domain, confidence, source attribution
 * - Expand/collapse for long text
 * - Visual differentiation (A/B labels with colors)
 * - Confidence badges and domain tags
 * - Source attribution links (reuse from e4-5)
 * - Resolution status display
 */

'use client'

import { useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ConfidenceBadge, DomainTag, SourceAttributionLink } from '../shared'
import { ContradictionActions } from './ContradictionActions'
import { ChevronDown, ChevronUp, AlertTriangle, Clock, MessageSquare } from 'lucide-react'
import type { ContradictionWithFindings } from '@/lib/types/contradictions'
import type { Finding } from '@/lib/types/findings'
import { getContradictionStatusInfo } from '@/lib/types/contradictions'
import { cn } from '@/lib/utils'

const MAX_TEXT_LENGTH = 150

export interface ContradictionCardProps {
  contradiction: ContradictionWithFindings
  onResolve: (
    contradictionId: string,
    action: 'accept_a' | 'accept_b' | 'investigate' | 'noted',
    note?: string
  ) => Promise<void>
  projectId: string
  className?: string
}

/**
 * Single finding panel within the contradiction card
 */
function FindingPanel({
  finding,
  label,
  labelColor,
  projectId,
  isExpanded,
  onToggleExpand,
}: {
  finding: Finding
  label: string
  labelColor: string
  projectId: string
  isExpanded: boolean
  onToggleExpand: () => void
}) {
  const shouldTruncate = finding.text.length > MAX_TEXT_LENGTH
  const displayText =
    !shouldTruncate || isExpanded ? finding.text : `${finding.text.slice(0, MAX_TEXT_LENGTH)}...`

  return (
    <div className="flex-1 p-4 border rounded-lg bg-background">
      {/* Label badge */}
      <div className="flex items-center justify-between mb-3">
        <Badge
          variant="outline"
          className={cn('font-semibold', labelColor)}
          aria-label={`Finding ${label}`}
        >
          {label}
        </Badge>
        <ConfidenceBadge confidence={finding.confidence} size="sm" showPercentage />
      </div>

      {/* Domain tag */}
      <div className="mb-3">
        <DomainTag domain={finding.domain} size="sm" />
      </div>

      {/* Finding text */}
      <div className="mb-3">
        <p className="text-sm leading-relaxed">{displayText}</p>

        {shouldTruncate && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              onToggleExpand()
            }}
            aria-label={isExpanded ? 'Show less' : 'Show more'}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="mr-1 h-3 w-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="mr-1 h-3 w-3" />
                Show more
              </>
            )}
          </Button>
        )}
      </div>

      {/* Source attribution */}
      {finding.documentId && (
        <div className="pt-3 border-t">
          <SourceAttributionLink
            documentId={finding.documentId}
            documentName={finding.sourceDocument || 'Unknown document'}
            chunkId={finding.chunkId}
            pageNumber={finding.pageNumber}
            sheetName={null}
            cellReference={null}
            projectId={projectId}
          />
        </div>
      )}
    </div>
  )
}

export function ContradictionCard({
  contradiction,
  onResolve,
  projectId,
  className,
}: ContradictionCardProps) {
  const [expandedA, setExpandedA] = useState(false)
  const [expandedB, setExpandedB] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const statusInfo = getContradictionStatusInfo(contradiction.status)
  const detectedDate = formatDistanceToNow(new Date(contradiction.detectedAt), { addSuffix: true })

  // Handle resolution action
  const handleResolve = useCallback(
    async (
      action: 'accept_a' | 'accept_b' | 'investigate' | 'noted',
      note?: string
    ) => {
      setIsLoading(true)
      try {
        await onResolve(contradiction.id, action, note)
      } finally {
        setIsLoading(false)
      }
    },
    [contradiction.id, onResolve]
  )

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        'hover:shadow-md',
        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
        className
      )}
      role="article"
      aria-label={`Contradiction between two findings, detected ${detectedDate}`}
    >
      {/* Header with status and confidence */}
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-500" aria-hidden="true" />
            <span className="font-medium text-sm">Contradiction Detected</span>
            <Badge
              variant="secondary"
              className={cn('text-xs', statusInfo.color, statusInfo.bgColor)}
            >
              {statusInfo.label}
            </Badge>
          </div>

          {contradiction.confidence !== null && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Detection confidence:</span>
              <ConfidenceBadge confidence={contradiction.confidence} size="sm" showPercentage />
            </div>
          )}
        </div>

        {/* Detection date */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
          <Clock className="h-3 w-3" aria-hidden="true" />
          <span>Detected {detectedDate}</span>
        </div>
      </CardHeader>

      {/* Side-by-side findings comparison */}
      <CardContent className="px-4 py-3">
        <div className="flex gap-4">
          {/* Finding A */}
          <FindingPanel
            finding={contradiction.findingA}
            label="A"
            labelColor="text-blue-600 border-blue-600"
            projectId={projectId}
            isExpanded={expandedA}
            onToggleExpand={() => setExpandedA((prev) => !prev)}
          />

          {/* VS separator */}
          <div className="flex items-center justify-center px-2">
            <div className="flex flex-col items-center gap-1">
              <div className="w-px h-8 bg-border" />
              <span className="text-xs font-semibold text-muted-foreground">VS</span>
              <div className="w-px h-8 bg-border" />
            </div>
          </div>

          {/* Finding B */}
          <FindingPanel
            finding={contradiction.findingB}
            label="B"
            labelColor="text-purple-600 border-purple-600"
            projectId={projectId}
            isExpanded={expandedB}
            onToggleExpand={() => setExpandedB((prev) => !prev)}
          />
        </div>

        {/* Resolution note (if exists) */}
        {contradiction.resolutionNote && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium mb-1">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Note
            </div>
            <p className="text-sm text-muted-foreground">{contradiction.resolutionNote}</p>
          </div>
        )}
      </CardContent>

      {/* Footer with actions */}
      <CardFooter className="px-4 py-3 border-t">
        <ContradictionActions
          status={contradiction.status}
          onAcceptA={() => handleResolve('accept_a')}
          onAcceptB={() => handleResolve('accept_b')}
          onInvestigate={(note) => handleResolve('investigate', note)}
          onAddNote={(note) => handleResolve('noted', note)}
          isLoading={isLoading}
        />
      </CardFooter>
    </Card>
  )
}
