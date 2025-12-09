/**
 * QAExistsIndicator Component
 * Badge/link indicator showing a Q&A item exists for a finding
 * Story: E8.5 - Finding → Q&A Quick-Add (AC: #6, #7)
 *
 * Features:
 * - Purple/violet badge matching Q&A color theme
 * - Link icon with clickable navigation to Q&A page
 * - Tooltip on hover showing "View Q&A item"
 * - Navigates to Q&A page with ?itemId={qaItemId} query param
 */

'use client'

import Link from 'next/link'
import { MessageSquare, ExternalLink } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface QAExistsIndicatorProps {
  /** The Q&A item ID to link to */
  qaItemId: string
  /** The project ID for building the URL */
  projectId: string
  /** Optional size variant */
  size?: 'sm' | 'default'
  /** Optional additional className */
  className?: string
}

export function QAExistsIndicator({
  qaItemId,
  projectId,
  size = 'default',
  className,
}: QAExistsIndicatorProps) {
  const qaUrl = `/projects/${projectId}/qa?itemId=${qaItemId}`

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    default: 'px-2 py-1 text-sm gap-1.5',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    default: 'h-3.5 w-3.5',
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={qaUrl}
            className={cn(
              'inline-flex items-center rounded-full',
              'bg-violet-100 text-violet-700 hover:bg-violet-200',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2',
              sizeClasses[size],
              className
            )}
            onClick={(e) => e.stopPropagation()} // Prevent row/card click
            aria-label="View Q&A item"
          >
            <MessageSquare className={cn(iconSizes[size], 'fill-current')} aria-hidden="true" />
            <span>Q&A</span>
            <ExternalLink className={cn(iconSizes[size], 'opacity-60')} aria-hidden="true" />
          </Link>
        </TooltipTrigger>
        <TooltipContent>
          <p>View Q&A item</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
