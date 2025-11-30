/**
 * ConnectionStatusIndicator Component
 * Displays realtime connection status as a small colored dot
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #8)
 *
 * Features:
 * - Status dot with color coding (green=connected, yellow=connecting, red=disconnected)
 * - Tooltip with full status message
 * - Click-to-reconnect functionality when disconnected
 * - Accessible with ARIA labels
 */

'use client'

import { forwardRef } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AggregateConnectionStatus } from '@/lib/hooks/useKnowledgeExplorerRealtime'

export interface ConnectionStatusIndicatorProps {
  /** Current connection status */
  status: AggregateConnectionStatus
  /** Callback when clicked (for reconnect) */
  onReconnect?: () => void
  /** Optional error message */
  errorMessage?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Get status configuration (color, label, tooltip)
 */
function getStatusConfig(status: AggregateConnectionStatus, errorMessage?: string) {
  switch (status) {
    case 'connected':
      return {
        color: 'bg-green-500',
        pulseColor: 'bg-green-400',
        label: 'Connected',
        tooltip: 'Real-time updates: Connected',
        showPulse: false,
        clickable: false,
      }
    case 'connecting':
      return {
        color: 'bg-yellow-500',
        pulseColor: 'bg-yellow-400',
        label: 'Connecting',
        tooltip: 'Connecting to real-time updates...',
        showPulse: true,
        clickable: false,
      }
    case 'partial':
      return {
        color: 'bg-yellow-500',
        pulseColor: 'bg-yellow-400',
        label: 'Partial',
        tooltip: 'Real-time updates: Partially connected (some subscriptions may be disconnected)',
        showPulse: false,
        clickable: true,
      }
    case 'disconnected':
      return {
        color: 'bg-red-500',
        pulseColor: 'bg-red-400',
        label: 'Disconnected',
        tooltip: 'Disconnected - click to reconnect',
        showPulse: false,
        clickable: true,
      }
    case 'error':
      return {
        color: 'bg-red-500',
        pulseColor: 'bg-red-400',
        label: 'Error',
        tooltip: errorMessage
          ? `Connection error: ${errorMessage}. Click to reconnect.`
          : 'Connection error - click to reconnect',
        showPulse: false,
        clickable: true,
      }
    default:
      return {
        color: 'bg-gray-500',
        pulseColor: 'bg-gray-400',
        label: 'Unknown',
        tooltip: 'Connection status unknown',
        showPulse: false,
        clickable: false,
      }
  }
}

/**
 * ConnectionStatusIndicator displays a small status dot with tooltip
 */
export const ConnectionStatusIndicator = forwardRef<
  HTMLButtonElement,
  ConnectionStatusIndicatorProps
>(function ConnectionStatusIndicator(
  { status, onReconnect, errorMessage, className },
  ref
) {
  const config = getStatusConfig(status, errorMessage)

  const handleClick = () => {
    if (config.clickable && onReconnect) {
      onReconnect()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && config.clickable && onReconnect) {
      e.preventDefault()
      onReconnect()
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={ref}
            type="button"
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            disabled={!config.clickable}
            className={cn(
              'relative inline-flex items-center justify-center',
              'h-6 w-6 rounded-full',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              config.clickable
                ? 'cursor-pointer hover:opacity-80'
                : 'cursor-default',
              className
            )}
            aria-label={`Real-time connection: ${config.label}${config.clickable ? ' - click to reconnect' : ''}`}
          >
            {/* Pulse animation for connecting state */}
            {config.showPulse && (
              <span
                className={cn(
                  'absolute inline-flex h-3 w-3 rounded-full opacity-75 animate-ping',
                  config.pulseColor
                )}
                aria-hidden="true"
              />
            )}
            {/* Status dot */}
            <span
              className={cn(
                'relative inline-flex h-3 w-3 rounded-full',
                config.color
              )}
              aria-hidden="true"
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[250px]">
          <p className="text-sm">{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})

/**
 * Compact version of the status indicator (just the dot, no wrapper)
 */
export function ConnectionStatusDot({
  status,
  size = 'sm',
  className,
}: {
  status: AggregateConnectionStatus
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const config = getStatusConfig(status)

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3',
  }

  return (
    <span
      data-testid="status-dot"
      className={cn(
        'inline-flex rounded-full',
        sizeClasses[size],
        config.color,
        config.showPulse && 'animate-pulse',
        className
      )}
      aria-label={`Connection: ${config.label}`}
      role="status"
    />
  )
}
