'use client'

/**
 * FollowUpSuggestions Component
 *
 * Displays contextual follow-up question suggestions after agent responses.
 * Story: E5.5 - Implement Quick Actions and Suggested Follow-ups
 * AC: #5 (Suggestions Generated), #6 (Click Populates Input), #8 (Responsive)
 */

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FollowUpSuggestionsProps {
  suggestions: string[]
  onSelect: (suggestion: string) => void
  isVisible: boolean
  className?: string
}

export function FollowUpSuggestions({
  suggestions,
  onSelect,
  isVisible,
  className,
}: FollowUpSuggestionsProps) {
  if (!isVisible || suggestions.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'px-4 py-3 animate-in fade-in slide-in-from-bottom-2 duration-300',
        className
      )}
      role="region"
      aria-label="Suggested follow-up questions"
    >
      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        <span>Suggested follow-ups</span>
      </div>
      <div
        className={cn(
          'flex gap-2 overflow-x-auto pb-1',
          // Hide scrollbar on desktop, show on mobile
          'scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent',
          'md:flex-wrap md:overflow-visible'
        )}
      >
        {suggestions.map((suggestion, index) => (
          <Button
            key={index}
            variant="outline"
            size="sm"
            onClick={() => onSelect(suggestion)}
            className={cn(
              'h-auto min-h-[36px] px-3 py-2 text-left whitespace-normal',
              'text-sm font-normal text-muted-foreground',
              'hover:text-foreground hover:bg-muted/50',
              'flex-shrink-0 md:flex-shrink',
              'max-w-[280px] md:max-w-none'
            )}
            data-testid={`follow-up-suggestion-${index}`}
            aria-label={`Suggested question: ${suggestion}`}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  )
}
