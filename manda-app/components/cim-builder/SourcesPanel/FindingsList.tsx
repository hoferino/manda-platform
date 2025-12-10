'use client'

/**
 * Findings List - Expandable accordion of deal findings
 *
 * Fetches and displays findings extracted from deal documents.
 * Click a finding to insert reference into chat.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #2 - Sources panel with Findings section
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
import { Loader2, Lightbulb, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Finding {
  id: string
  text: string
  domain: string
  confidence: number
}

interface FindingsListProps {
  projectId: string
  onFindingClick: (id: string, title: string) => void
}

export function FindingsList({ projectId, onFindingClick }: FindingsListProps) {
  const [findings, setFindings] = React.useState<Finding[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch findings on mount
  React.useEffect(() => {
    const fetchFindings = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/projects/${projectId}/findings?limit=50`)
        if (!response.ok) {
          throw new Error('Failed to load findings')
        }

        const data = await response.json()
        setFindings(data.items || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load findings')
      } finally {
        setIsLoading(false)
      }
    }

    fetchFindings()
  }, [projectId])

  // Truncate finding text for display
  const truncateText = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text
    return `${text.slice(0, maxLength - 3)}...`
  }

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value="findings" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-medium">Findings</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {findings.length}
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
          ) : findings.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 px-2 text-center">
              No findings extracted yet
            </p>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {findings.map((finding) => (
                <SourceItem
                  key={finding.id}
                  id={finding.id}
                  title={truncateText(finding.text)}
                  type="finding"
                  subtitle={`${finding.domain} | ${Math.round(finding.confidence * 100)}% confidence`}
                  onClick={(id) => onFindingClick(id, truncateText(finding.text, 50))}
                />
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
