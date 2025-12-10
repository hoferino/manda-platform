'use client'

/**
 * QA List - Expandable accordion of deal Q&A items
 *
 * Fetches and displays Q&A items for the deal.
 * Click a Q&A item to insert reference into chat.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #2 - Sources panel with Q&A section
 * AC: #3 - Click-to-reference functionality
 */

import * as React from 'react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { SourceItem } from './SourceItem'
import { Loader2, HelpCircle, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface QAItem {
  id: string
  question: string
  answer: string | null
  category: string
  priority: 'high' | 'medium' | 'low'
}

interface QAListProps {
  projectId: string
  onQAClick: (id: string, title: string) => void
}

export function QAList({ projectId, onQAClick }: QAListProps) {
  const [qaItems, setQAItems] = React.useState<QAItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch Q&A items on mount
  React.useEffect(() => {
    const fetchQAItems = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/projects/${projectId}/qa`)
        if (!response.ok) {
          throw new Error('Failed to load Q&A items')
        }

        const data = await response.json()
        setQAItems(data.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Q&A items')
      } finally {
        setIsLoading(false)
      }
    }

    fetchQAItems()
  }, [projectId])

  // Truncate question text for display
  const truncateText = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 3)}...`
  }

  // Count answered items
  const answeredCount = qaItems.filter((item) => item.answer).length

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="qa" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium">Q&A</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {answeredCount}/{qaItems.length}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-1 pb-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 py-4 px-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          ) : qaItems.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 px-2 text-center">
              No Q&A items yet
            </p>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {qaItems.map((item) => (
                <SourceItem
                  key={item.id}
                  id={item.id}
                  title={truncateText(item.question)}
                  type="qa"
                  subtitle={`${item.category} | ${item.answer ? 'Answered' : 'Pending'}`}
                  onClick={(id) => onQAClick(id, truncateText(item.question, 50))}
                />
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
