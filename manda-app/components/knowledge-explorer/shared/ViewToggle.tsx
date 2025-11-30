/**
 * ViewToggle Component
 * Toggle between Table and Card view modes
 * Story: E4.4 - Build Card View Alternative for Findings (AC: 2)
 *
 * Features:
 * - Table/Card icons toggle
 * - Persists view preference to localStorage
 * - Keyboard shortcut: Ctrl/Cmd + Shift + V
 * - Accessible toggle with ARIA labels
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { LayoutGrid, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ViewMode = 'table' | 'card'

const STORAGE_KEY = 'findings-view-preference'

export interface ViewToggleProps {
  value: ViewMode
  onChange: (mode: ViewMode) => void
  className?: string
}

/**
 * Hook to persist view mode preference to localStorage
 */
export function useViewPreference(defaultMode: ViewMode = 'table'): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setModeState] = useState<ViewMode>(defaultMode)

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'table' || stored === 'card') {
        setModeState(stored)
      }
    }
  }, [])

  // Save to localStorage on change
  const setMode = useCallback((newMode: ViewMode) => {
    setModeState(newMode)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, newMode)
    }
  }, [])

  return [mode, setMode]
}

export function ViewToggle({ value, onChange, className }: ViewToggleProps) {
  // Handle keyboard shortcut (Ctrl/Cmd + Shift + V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0
      const modifierKey = isMac ? e.metaKey : e.ctrlKey

      if (modifierKey && e.shiftKey && e.key.toLowerCase() === 'v') {
        e.preventDefault()
        onChange(value === 'table' ? 'card' : 'table')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [value, onChange])

  const isTable = value === 'table'
  const isCard = value === 'card'

  return (
    <div
      className={cn('inline-flex items-center rounded-lg border bg-muted p-1', className)}
      role="group"
      aria-label="View mode toggle"
    >
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3 transition-colors',
                isTable && 'bg-background shadow-sm'
              )}
              onClick={() => onChange('table')}
              aria-pressed={isTable}
              aria-label="Table view"
            >
              <Table2 className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Table view</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Table view</p>
            <p className="text-xs text-muted-foreground">⌘⇧V to toggle</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 px-3 transition-colors',
                isCard && 'bg-background shadow-sm'
              )}
              onClick={() => onChange('card')}
              aria-pressed={isCard}
              aria-label="Card view"
            >
              <LayoutGrid className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Card view</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Card view</p>
            <p className="text-xs text-muted-foreground">⌘⇧V to toggle</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  )
}
