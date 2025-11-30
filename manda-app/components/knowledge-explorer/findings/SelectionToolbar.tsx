/**
 * SelectionToolbar Component
 * Floating toolbar that appears when findings are selected
 * Story: E4.11 - Build Bulk Actions for Finding Management (AC: 3, 4, 5)
 *
 * Features:
 * - Selection count indicator
 * - Clear selection button
 * - Bulk actions dropdown trigger
 * - Animated appearance (slide up)
 * - Keyboard accessible
 * - Screen reader announcements
 */

'use client'

import { useCallback, useEffect, useRef } from 'react'
import { X, CheckCheck, XCircle, MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface SelectionToolbarProps {
  selectedCount: number
  onClearSelection: () => void
  onBulkValidate: () => void
  onBulkReject: () => void
  isProcessing?: boolean
  className?: string
}

export function SelectionToolbar({
  selectedCount,
  onClearSelection,
  onBulkValidate,
  onBulkReject,
  isProcessing = false,
  className,
}: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null)
  const prevCountRef = useRef(selectedCount)

  // Announce selection changes to screen readers
  useEffect(() => {
    if (selectedCount !== prevCountRef.current && selectedCount > 0) {
      // Create a live region announcement
      const announcement = document.createElement('div')
      announcement.setAttribute('role', 'status')
      announcement.setAttribute('aria-live', 'polite')
      announcement.setAttribute('aria-atomic', 'true')
      announcement.className = 'sr-only'
      announcement.textContent = `${selectedCount} finding${selectedCount === 1 ? '' : 's'} selected`
      document.body.appendChild(announcement)

      // Remove after announcement
      setTimeout(() => {
        document.body.removeChild(announcement)
      }, 1000)
    }
    prevCountRef.current = selectedCount
  }, [selectedCount])

  // Don't render if nothing selected
  if (selectedCount === 0) {
    return null
  }

  return (
    <div
      ref={toolbarRef}
      className={cn(
        // Positioning - fixed at bottom
        'fixed bottom-6 left-1/2 -translate-x-1/2 z-50',
        // Styling
        'flex items-center gap-3 px-4 py-3',
        'bg-background border rounded-lg shadow-lg',
        // Animation
        'animate-in slide-in-from-bottom-4 fade-in duration-200',
        className
      )}
      role="toolbar"
      aria-label={`Bulk actions for ${selectedCount} selected finding${selectedCount === 1 ? '' : 's'}`}
    >
      {/* Selection count */}
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="text-primary">{selectedCount}</span>
        <span className="text-muted-foreground">
          {selectedCount === 1 ? 'finding' : 'findings'} selected
        </span>
      </div>

      {/* Divider */}
      <div className="h-6 w-px bg-border" />

      {/* Bulk validate button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-green-600 hover:text-green-700 hover:bg-green-100"
              onClick={onBulkValidate}
              disabled={isProcessing}
              aria-label={`Validate ${selectedCount} selected finding${selectedCount === 1 ? '' : 's'}`}
            >
              <CheckCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Validate</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Validate all selected findings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Bulk reject button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-100"
              onClick={onBulkReject}
              disabled={isProcessing}
              aria-label={`Reject ${selectedCount} selected finding${selectedCount === 1 ? '' : 's'}`}
            >
              <XCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Reject</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reject all selected findings</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Divider */}
      <div className="h-6 w-px bg-border" />

      {/* Clear selection button */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={onClearSelection}
              disabled={isProcessing}
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Clear</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Clear all selections</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
