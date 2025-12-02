'use client'

/**
 * QuickActions Component
 *
 * Displays quick action buttons for common chat operations.
 * Story: E5.5 - Implement Quick Actions and Suggested Follow-ups
 * AC: #1 (Buttons Visible), #3 (Loading States), #4 (Disabled States)
 */

import { Loader2, Search, MessageSquare, FileText, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

/**
 * Quick action configuration
 */
export interface QuickAction {
  id: string
  label: string
  icon: LucideIcon
  prompt: string
  toolName: string
  requiresDocuments?: boolean
  requiresFindings?: boolean
  requiresIRL?: boolean
}

/**
 * Availability status for a quick action
 */
export interface QuickActionAvailability {
  enabled: boolean
  reason?: string
}

/**
 * Quick action definitions
 * Maps to P3 intent patterns from agent-behavior-spec.md
 */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'find-contradictions',
    label: 'Find Contradictions',
    icon: AlertTriangle,
    prompt: 'Please scan for any contradictions or conflicting information in the documents.',
    toolName: 'detect_contradictions',
    requiresDocuments: true,
  },
  {
    id: 'generate-qa',
    label: 'Generate Q&A',
    icon: MessageSquare,
    prompt: 'Generate Q&A suggestions based on the current deal context.',
    toolName: 'suggest_questions',
    requiresDocuments: true,
  },
  {
    id: 'summarize-findings',
    label: 'Summarize Findings',
    icon: FileText,
    prompt: 'Please summarize the key findings from the uploaded documents.',
    toolName: 'query_knowledge_base',
    requiresFindings: true,
  },
  {
    id: 'identify-gaps',
    label: 'Identify Gaps',
    icon: Search,
    prompt: 'What information gaps exist against the IRL checklist?',
    toolName: 'find_gaps',
    requiresDocuments: true,
  },
]

interface QuickActionsProps {
  onAction: (prompt: string) => void
  isLoading?: boolean
  availability?: Record<string, QuickActionAvailability>
  className?: string
}

export function QuickActions({
  onAction,
  isLoading = false,
  availability = {},
  className,
}: QuickActionsProps) {
  return (
    <TooltipProvider>
      <div
        className={cn(
          'flex flex-wrap gap-2 px-4 py-3 border-t bg-muted/30',
          className
        )}
        role="toolbar"
        aria-label="Quick actions"
      >
        {QUICK_ACTIONS.map((action) => {
          const actionAvailability = availability[action.id]
          const isDisabled = isLoading || (actionAvailability && !actionAvailability.enabled)
          const disabledReason = actionAvailability?.reason

          return (
            <Tooltip key={action.id}>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onAction(action.prompt)}
                    disabled={isDisabled}
                    className={cn(
                      'h-9 gap-2',
                      isDisabled && 'opacity-50 cursor-not-allowed'
                    )}
                    data-testid={`quick-action-${action.id}`}
                    aria-label={action.label}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <action.icon className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">{action.label}</span>
                  </Button>
                </span>
              </TooltipTrigger>
              {isDisabled && disabledReason && (
                <TooltipContent>
                  <p>{disabledReason}</p>
                </TooltipContent>
              )}
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}
