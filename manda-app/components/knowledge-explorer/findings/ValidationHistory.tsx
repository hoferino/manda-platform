/**
 * ValidationHistory Component
 * Displays timeline of validation events with diff view for edits
 * Story: E4.9 - Implement Finding Detail View with Full Context (AC: 6)
 *
 * Features:
 * - Timeline view of validation events
 * - Diff view for edit events (previous vs new value)
 * - Chronological sorting (newest first)
 * - Relative and absolute timestamps
 * - Empty state handling
 * - Accessible with ARIA attributes
 */

'use client'

import { useMemo } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Check, X, Pencil, Clock, User } from 'lucide-react'
import type { ValidationEvent } from '@/lib/types/findings'
import { cn } from '@/lib/utils'

export interface ValidationHistoryProps {
  history: ValidationEvent[]
  className?: string
}

/**
 * Get icon and styling for action type
 */
function getActionConfig(action: ValidationEvent['action']) {
  switch (action) {
    case 'validated':
      return {
        icon: Check,
        label: 'Validated',
        bgColor: 'bg-green-100',
        iconColor: 'text-green-600',
        borderColor: 'border-green-200',
      }
    case 'rejected':
      return {
        icon: X,
        label: 'Rejected',
        bgColor: 'bg-red-100',
        iconColor: 'text-red-600',
        borderColor: 'border-red-200',
      }
    case 'edited':
      return {
        icon: Pencil,
        label: 'Edited',
        bgColor: 'bg-blue-100',
        iconColor: 'text-blue-600',
        borderColor: 'border-blue-200',
      }
    default:
      return {
        icon: Clock,
        label: action,
        bgColor: 'bg-gray-100',
        iconColor: 'text-gray-600',
        borderColor: 'border-gray-200',
      }
  }
}

/**
 * Format a user ID for display
 * In future, this could lookup user display names
 */
function formatUserId(userId: string): string {
  // For now, show first 8 chars of UUID
  return userId.length > 8 ? `${userId.slice(0, 8)}...` : userId
}

/**
 * Diff view component for showing changes
 */
function DiffView({
  previousValue,
  newValue,
}: {
  previousValue?: string
  newValue?: string
}) {
  if (!previousValue && !newValue) return null

  return (
    <div className="mt-2 space-y-2 text-xs">
      {previousValue && (
        <div className="rounded border border-red-200 bg-red-50 p-2">
          <span className="font-medium text-red-700">Previous:</span>
          <p className="mt-1 text-red-800 line-through whitespace-pre-wrap">
            {previousValue.length > 200
              ? `${previousValue.slice(0, 200)}...`
              : previousValue}
          </p>
        </div>
      )}
      {newValue && (
        <div className="rounded border border-green-200 bg-green-50 p-2">
          <span className="font-medium text-green-700">New:</span>
          <p className="mt-1 text-green-800 whitespace-pre-wrap">
            {newValue.length > 200 ? `${newValue.slice(0, 200)}...` : newValue}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Single timeline item
 */
function TimelineItem({ event }: { event: ValidationEvent }) {
  const config = getActionConfig(event.action)
  const Icon = config.icon
  const eventDate = new Date(event.timestamp)
  const relativeTime = formatDistanceToNow(eventDate, { addSuffix: true })
  const absoluteTime = format(eventDate, 'MMM d, yyyy h:mm a')

  const showDiff = event.action === 'edited' && (event.previousValue || event.newValue)

  return (
    <li className="relative pb-6 last:pb-0">
      {/* Connector line */}
      <span
        className="absolute left-4 top-8 -ml-px h-full w-0.5 bg-muted"
        aria-hidden="true"
      />

      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border',
            config.bgColor,
            config.borderColor
          )}
          aria-hidden="true"
        >
          <Icon className={cn('h-4 w-4', config.iconColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-foreground">
              {config.label}
            </span>
            <time
              dateTime={event.timestamp}
              title={absoluteTime}
              className="text-xs text-muted-foreground whitespace-nowrap"
            >
              {relativeTime}
            </time>
          </div>

          {/* User info */}
          {event.userId && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" aria-hidden="true" />
              <span>by {formatUserId(event.userId)}</span>
            </div>
          )}

          {/* Diff view for edits */}
          {showDiff && (
            <DiffView
              previousValue={event.previousValue}
              newValue={event.newValue}
            />
          )}

          {/* Status change indicator (for validate/reject) */}
          {event.action !== 'edited' && event.previousValue && event.newValue && (
            <p className="mt-1 text-xs text-muted-foreground">
              Status changed from{' '}
              <span className="font-medium">{event.previousValue}</span>
              {' '}to{' '}
              <span className="font-medium">{event.newValue}</span>
            </p>
          )}
        </div>
      </div>
    </li>
  )
}

export function ValidationHistory({ history, className }: ValidationHistoryProps) {
  // Sort by timestamp descending (newest first)
  const sortedHistory = useMemo(() => {
    return [...history].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [history])

  if (history.length === 0) {
    return (
      <div className={cn('py-6 text-center', className)}>
        <Clock className="mx-auto h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
        <p className="mt-2 text-sm text-muted-foreground">
          No validation history
        </p>
        <p className="text-xs text-muted-foreground/70">
          Actions like validating, rejecting, or editing will appear here
        </p>
      </div>
    )
  }

  return (
    <div className={className}>
      <h4 className="mb-4 text-sm font-medium text-foreground flex items-center gap-1.5">
        <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        History
        <span className="ml-1 text-xs text-muted-foreground font-normal">
          ({history.length} {history.length === 1 ? 'event' : 'events'})
        </span>
      </h4>

      <ol
        className="relative"
        role="list"
        aria-label="Validation history timeline"
      >
        {sortedHistory.map((event, index) => (
          <TimelineItem key={`${event.timestamp}-${index}`} event={event} />
        ))}
      </ol>
    </div>
  )
}
