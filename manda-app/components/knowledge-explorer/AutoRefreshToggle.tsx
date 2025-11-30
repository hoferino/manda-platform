/**
 * AutoRefreshToggle Component
 * Toggle switch for enabling/disabling real-time updates
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #6)
 *
 * Features:
 * - Toggle switch using shadcn/ui Switch component
 * - Shows "Auto-refresh" label with keyboard shortcut hint
 * - Shows paused indicator when OFF with pending update count
 * - Manual "Refresh" button available when auto-refresh is OFF
 * - Accessible with ARIA labels
 */

'use client'

import { forwardRef } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RefreshCw, Pause } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AutoRefreshToggleProps {
  /** Whether auto-refresh is enabled */
  enabled: boolean
  /** Callback when toggle is changed */
  onChange: (enabled: boolean) => void
  /** Number of pending updates (when auto-refresh is off) */
  pendingCount?: number
  /** Callback to apply pending updates */
  onApplyPending?: () => void
  /** Whether currently applying updates */
  isApplying?: boolean
  /** Additional CSS classes */
  className?: string
}

/**
 * AutoRefreshToggle displays a toggle switch for auto-refresh
 * with visual feedback for pending updates when paused
 */
export const AutoRefreshToggle = forwardRef<HTMLDivElement, AutoRefreshToggleProps>(
  function AutoRefreshToggle(
    {
      enabled,
      onChange,
      pendingCount = 0,
      onApplyPending,
      isApplying = false,
      className,
    },
    ref
  ) {
    const hasPending = pendingCount > 0 && !enabled

    return (
      <TooltipProvider>
        <div
          ref={ref}
          className={cn(
            'flex items-center gap-3',
            className
          )}
        >
          {/* Toggle with label */}
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh-toggle"
              checked={enabled}
              onCheckedChange={onChange}
              aria-label={`Auto-refresh ${enabled ? 'enabled' : 'disabled'}`}
            />
            <Label
              htmlFor="auto-refresh-toggle"
              className="text-sm font-medium cursor-pointer"
            >
              Auto-refresh
            </Label>

            {/* Keyboard shortcut hint */}
            <Tooltip>
              <TooltipTrigger asChild>
                <kbd className="hidden sm:inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <span className="text-xs">⌘</span>
                  <span>⇧</span>
                  <span>R</span>
                </kbd>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p className="text-sm">Toggle auto-refresh (Ctrl/Cmd+Shift+R)</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Paused indicator with pending count */}
          {!enabled && (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="gap-1 text-yellow-600 border-yellow-300 bg-yellow-50"
              >
                <Pause className="h-3 w-3" aria-hidden="true" />
                <span>Paused</span>
              </Badge>

              {/* Pending update count badge */}
              {hasPending && (
                <Badge
                  variant="secondary"
                  className="gap-1"
                >
                  {pendingCount} pending
                </Badge>
              )}

              {/* Manual refresh button when paused */}
              {hasPending && onApplyPending && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onApplyPending}
                  disabled={isApplying}
                  className="h-7 gap-1"
                  aria-label={`Apply ${pendingCount} pending updates`}
                >
                  <RefreshCw
                    className={cn(
                      'h-3.5 w-3.5',
                      isApplying && 'animate-spin'
                    )}
                    aria-hidden="true"
                  />
                  <span className="sr-only sm:not-sr-only">Refresh</span>
                </Button>
              )}
            </div>
          )}
        </div>
      </TooltipProvider>
    )
  }
)

/**
 * Compact version for smaller spaces
 */
export function AutoRefreshToggleCompact({
  enabled,
  onChange,
  className,
}: {
  enabled: boolean
  onChange: (enabled: boolean) => void
  className?: string
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-2', className)}>
            <Switch
              id="auto-refresh-compact"
              checked={enabled}
              onCheckedChange={onChange}
              aria-label={`Auto-refresh ${enabled ? 'enabled' : 'disabled'}`}
            />
            {!enabled && (
              <Pause className="h-3 w-3 text-yellow-600" aria-hidden="true" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-sm">
            {enabled ? 'Auto-refresh enabled' : 'Auto-refresh paused'} (⌘⇧R)
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
