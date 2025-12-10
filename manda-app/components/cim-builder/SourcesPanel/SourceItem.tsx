'use client'

/**
 * Source Item - Reusable component for source list items
 *
 * Displays a source item (document, finding, or Q&A) with click action
 * to insert reference into chat input.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #3 - Click-to-reference functionality
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { FileText, Lightbulb, HelpCircle, Plus } from 'lucide-react'

interface SourceItemProps {
  id: string
  title: string
  type: 'document' | 'finding' | 'qa'
  subtitle?: string
  onClick: (id: string, title: string) => void
  className?: string
}

const typeIcons = {
  document: FileText,
  finding: Lightbulb,
  qa: HelpCircle,
}

const typeColors = {
  document: 'text-blue-500',
  finding: 'text-amber-500',
  qa: 'text-purple-500',
}

export function SourceItem({
  id,
  title,
  type,
  subtitle,
  onClick,
  className,
}: SourceItemProps) {
  const Icon = typeIcons[type]

  return (
    <button
      onClick={() => onClick(id, title)}
      className={cn(
        'w-full flex items-start gap-2 p-2 rounded-md text-left',
        'hover:bg-accent transition-colors',
        'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
        'group',
        className
      )}
      aria-label={`Add ${type} reference: ${title}`}
    >
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', typeColors[type])} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      <Plus className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
    </button>
  )
}
