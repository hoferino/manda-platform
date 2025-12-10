'use client'

/**
 * Structure Tree - CIM outline with progress icons
 *
 * Displays the CIM outline sections with:
 * - Progress icons (checkmark=complete, spinner=in-progress, pending=empty)
 * - Click-to-jump functionality to navigate to sections
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #6 - Structure sidebar with progress icons and click-to-jump
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Check, Loader2, Circle, ChevronRight } from 'lucide-react'
import type { OutlineSection, SectionStatus } from '@/lib/types/cim'

interface StructureTreeProps {
  outline: OutlineSection[]
  onSectionClick: (sectionId: string) => void
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
  className,
}: StructureTreeProps) {
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

        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={cn(
              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left',
              'hover:bg-accent transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
              'group'
            )}
            aria-label={`Go to section: ${section.title}`}
          >
            <StatusIcon
              className={cn(
                'h-4 w-4 flex-shrink-0',
                statusColors[section.status],
                section.status === 'in_progress' && 'animate-spin'
              )}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{section.title}</p>
              {section.description && (
                <p className="text-xs text-muted-foreground truncate">
                  {section.description}
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </button>
        )
      })}
    </div>
  )
}
