'use client'

/**
 * Documents List - Expandable accordion of deal documents
 *
 * Fetches and displays documents from the deal's data room.
 * Click a document to insert reference into chat.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #2 - Sources panel with Documents section
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
import { Loader2, FileText, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface Document {
  id: string
  name: string
  folder_path: string | null
  processing_status: string
}

interface DocumentsListProps {
  projectId: string
  onDocumentClick: (id: string, title: string) => void
}

export function DocumentsList({ projectId, onDocumentClick }: DocumentsListProps) {
  const [documents, setDocuments] = React.useState<Document[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  // Fetch documents on mount
  React.useEffect(() => {
    const fetchDocuments = async () => {
      try {
        setIsLoading(true)
        setError(null)

        const response = await fetch(`/api/projects/${projectId}/documents`)
        if (!response.ok) {
          throw new Error('Failed to load documents')
        }

        const data = await response.json()
        setDocuments(data.documents || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents')
      } finally {
        setIsLoading(false)
      }
    }

    fetchDocuments()
  }, [projectId])

  return (
    <Accordion type="single" collapsible defaultValue="documents">
      <AccordionItem value="documents" className="border rounded-md">
        <AccordionTrigger className="px-3 py-2 hover:no-underline">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-500" />
            <span className="text-sm font-medium">Documents</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {documents.length}
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
          ) : documents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 px-2 text-center">
              No documents uploaded yet
            </p>
          ) : (
            <div className="max-h-[200px] overflow-y-auto">
              {documents.map((doc) => (
                <SourceItem
                  key={doc.id}
                  id={doc.id}
                  title={doc.name}
                  type="document"
                  subtitle={doc.folder_path || 'Root'}
                  onClick={onDocumentClick}
                />
              ))}
            </div>
          )}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
