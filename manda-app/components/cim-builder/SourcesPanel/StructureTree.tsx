'use client'

/**
 * Structure Tree - CIM outline with progress icons
 *
 * Displays the CIM outline sections with:
 * - Progress icons (checkmark=complete, spinner=in-progress, pending=empty)
 * - Click-to-jump functionality to navigate to sections
 * - Flagged section indicators for dependency alerts (E9.11)
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * Story: E9.11 - Dependency Tracking & Consistency Alerts
 * AC: #6 - Structure sidebar with progress icons and click-to-jump
 * AC: E9.11 #3, #5 - Flag affected slides in structure panel
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, Loader2, Circle, ChevronRight, AlertTriangle } from 'lucide-react'
import type { OutlineSection, SectionStatus } from '@/lib/types/cim'

/**
 * Flagged section information for dependency tracking
 */
export interface FlaggedSection {
  sectionId: string
  reason: string  // Why this section is flagged (e.g., "Depends on modified slide 3")
  sourceSlideId?: string  // The slide that caused this flag
}

interface StructureTreeProps {
  outline: OutlineSection[]
  onSectionClick: (sectionId: string) => void
  flaggedSections?: FlaggedSection[]  // E9.11: Sections flagged for review
  onClearFlag?: (sectionId: string) => void  // E9.11: Clear flag for a section
  className?: string
}

const statusIcons: Record<SectionStatus, React.ComponentType<{ className?: string }>> = {
  complete: Check,
  in_progress: Loader2,
  pending: Circle,
}

const statusColors: Record<SectionStatus, string> = {
  complete: 'text-green-500',
  in_progress: 'text-blue-500',
  pending: 'text-muted-foreground',
}

export function StructureTree({
  outline,
  onSectionClick,
  flaggedSections = [],
  onClearFlag,
  className,
}: StructureTreeProps) {
  // Create a lookup for flagged sections
  const flaggedMap = React.useMemo(() => {
    const map = new Map<string, FlaggedSection>()
    flaggedSections.forEach(f => map.set(f.sectionId, f))
    return map
  }, [flaggedSections])

  if (outline.length === 0) {
    return (
      <div className={cn('py-4 text-center', className)}>
        <p className="text-sm text-muted-foreground">
          No outline defined yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a conversation to create your CIM structure.
        </p>
      </div>
    )
  }

  // Sort outline by order
  const sortedOutline = [...outline].sort((a, b) => a.order - b.order)

  return (
    <div className={cn('space-y-1', className)}>
      {sortedOutline.map((section) => {
        const StatusIcon = statusIcons[section.status]
        const flaggedInfo = flaggedMap.get(section.id)
        const isFlagged = !!flaggedInfo

        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left',
              'hover:bg-accent transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'group',
              // E9.11 AC #3: Highlight flagged sections
              isFlagged && 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
            )}
            aria-label={`Go to section: ${section.title}${isFlagged ? ' (Needs Review)' : ''}`}
          >
            {/* Status or Warning Icon */}
            {isFlagged ? (
              <AlertTriangle
                className="h-4 w-4 flex-shrink-0 text-amber-500"
                aria-label="Needs review"
              />
            ) : (
              <StatusIcon
                className={cn(
                  'h-4 w-4 flex-shrink-0',
                  statusColors[section.status],
                  section.status === 'in_progress' && 'animate-spin'
                )}
              />
            )}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-medium truncate',
                isFlagged && 'text-amber-700 dark:text-amber-300'
              )}>
                {section.title}
              </p>
              {/* Show flag reason or section description */}
              {isFlagged ? (
                <p className="text-xs text-amber-600 dark:text-amber-400 truncate">
                  {flaggedInfo.reason}
                </p>
              ) : section.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {section.description}
                </p>
              )}
            </div>
            {/* Clear flag button (AC #5) or navigation chevron */}
            {isFlagged && onClearFlag ? (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onClearFlag(section.id)
                }}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-amber-200 dark:hover:bg-amber-800 transition-colors"
                aria-label="Mark as reviewed"
                title="Mark as reviewed"
              >
                <Check className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </button>
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            )}
          </button>
        )
      })}
    </div>
  )
}
