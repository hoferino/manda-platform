'use client'

/**
 * ToolIndicator Component
 *
 * Shows contextual status when agent is executing tools.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #4 (Tool Execution Indicators)
 */

import { Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { getToolDisplayMessage } from '@/lib/types/chat'
import { cn } from '@/lib/utils'

interface ToolIndicatorProps {
  toolName: string | null
  className?: string
}

/**
 * Tool icons based on tool name
 */
function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    query_knowledge_base: '🔍',
    update_knowledge_base: '📝',
    validate_finding: '✓',
    update_knowledge_graph: '🔗',
    detect_contradictions: '⚡',
    find_gaps: '📊',
    get_document_info: '📄',
    trigger_analysis: '⚙️',
    suggest_questions: '❓',
    add_to_qa: '📋',
    create_irl: '✏️',
  }
  return icons[toolName] || '🔧'
}

export function ToolIndicator({ toolName, className }: ToolIndicatorProps) {
  if (!toolName) return null

  const displayMessage = getToolDisplayMessage(toolName)
  const icon = getToolIcon(toolName)

  return (
    <Badge
      variant="secondary"
      className={cn(
        'inline-flex items-center gap-1.5 py-1 px-2.5',
        'animate-pulse',
        className
      )}
    >
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-normal">{displayMessage}</span>
      <Loader2 className="h-3 w-3 animate-spin" />
    </Badge>
  )
}

/**
 * Typing indicator for when the agent is generating a response
 */
export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 py-2', className)}>
      <div className="flex gap-1">
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
