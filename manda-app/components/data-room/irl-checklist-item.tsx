/**
 * IRL Checklist Item Component
 * Story: E6.5 - Implement IRL-Document Linking and Progress Tracking
 * AC: #2 (Hierarchical Checklist), #3 (Checkbox Toggle), #8 (Persist State)
 */

'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { toast } from 'sonner'
import { toggleIRLItemFulfilled, type IRLItem } from '@/lib/api/irl'

export interface IRLChecklistItemProps {
  item: IRLItem
  /** Called after successful toggle action */
  onToggle?: (itemId: string, fulfilled: boolean) => void
}

export function IRLChecklistItem({
  item,
  onToggle,
}: IRLChecklistItemProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [localFulfilled, setLocalFulfilled] = useState(item.fulfilled)

  // Handle checkbox toggle
  const handleToggle = async () => {
    const newValue = !localFulfilled
    setIsUpdating(true)

    // Optimistic update
    setLocalFulfilled(newValue)

    try {
      const result = await toggleIRLItemFulfilled(item.id, newValue)
      if (result.success) {
        onToggle?.(item.id, newValue)
      } else {
        // Revert on error
        setLocalFulfilled(!newValue)
        toast.error(result.error || 'Failed to update item')
      }
    } catch (error) {
      // Revert on error
      setLocalFulfilled(!newValue)
      console.error('Error toggling IRL item:', error)
      toast.error('Failed to update item')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex items-start gap-2 rounded-md px-2 py-1.5 text-sm',
          'hover:bg-muted/50 transition-colors cursor-pointer',
          localFulfilled && 'bg-green-50/50 dark:bg-green-950/20'
        )}
        onClick={handleToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleToggle()
          }
        }}
      >
        {/* Checkbox */}
        <div className="mt-0.5 flex-shrink-0">
          {isUpdating ? (
            <div className="flex h-4 w-4 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Checkbox
              checked={localFulfilled}
              onCheckedChange={() => handleToggle()}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'h-4 w-4 rounded-sm border-2',
                localFulfilled && 'border-green-500 bg-green-500 data-[state=checked]:bg-green-500'
              )}
              aria-label={`Mark "${item.name}" as ${localFulfilled ? 'unfulfilled' : 'fulfilled'}`}
            />
          )}
        </div>

        {/* Item Content */}
        <div className="flex-1 min-w-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className={cn(
                  'font-medium leading-tight truncate',
                  localFulfilled && 'text-green-700 dark:text-green-400 line-through opacity-70'
                )}
              >
                {item.name}
              </p>
            </TooltipTrigger>
            {item.name.length > 30 && (
              <TooltipContent side="top" className="max-w-xs">
                <p className="text-sm">{item.name}</p>
              </TooltipContent>
            )}
          </Tooltip>

          {/* Description (only show if not fulfilled) */}
          {item.description && !localFulfilled && (
            <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
              {item.description}
            </p>
          )}
        </div>

        {/* Required indicator */}
        {item.required && !localFulfilled && (
          <span className="text-xs text-destructive flex-shrink-0">*</span>
        )}
      </div>
    </TooltipProvider>
  )
}
