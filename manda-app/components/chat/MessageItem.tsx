'use client'

/**
 * MessageItem Component
 *
 * Individual message bubble with user/assistant styling.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #2 (Message Bubbles with Streaming)
 *
 * Enhanced in E5.4 with clickable source citations.
 * Story: E5.4 - Implement Source Citation Display in Messages
 * AC: #2, #3, #4, #5, #7
 *
 * Enhanced in E5.7 with confidence badges.
 * Story: E5.7 - Implement Confidence Indicators and Uncertainty Handling
 * AC: #8 (Badge Display in Message Items)
 *
 * Enhanced in E7.3 with response editing.
 * Story: E7.3 - Enable Response Editing and Learning
 * AC: #1 (Edit button for assistant messages)
 */

import { memo, useState, useMemo, useEffect, useCallback } from 'react'
import { User, Bot, Copy, Check, Edit2 } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import type { Message, SourceCitation, MessageConfidence } from '@/lib/types/chat'
import { normalizeMessageRole } from '@/lib/types/chat'
import { cn } from '@/lib/utils'
import { ToolIndicator, TypingIndicator } from './ToolIndicator'
import { CitationRenderer, type DocumentLookup } from './CitationRenderer'
import { SourceCitationLink } from './SourceCitationLink'
import { ConfidenceBadge } from './ConfidenceBadge'
import { ResponseEditMode } from './ResponseEditMode'
import { hasCitations, parseCitations, getUniqueDocumentNames } from '@/lib/utils/citation-parser'
import { findDocumentsByNames } from '@/lib/api/documents'
import type { EditType } from '@/lib/types/feedback'

interface MessageItemProps {
  message: Message
  isStreaming?: boolean
  currentTool?: string | null
  projectId: string
  className?: string
}

/**
 * Parse and render markdown-like content with citation support
 * Enhanced from E5.3 to render clickable citations via CitationRenderer
 */
function renderContent(
  content: string,
  projectId: string,
  documentLookup?: DocumentLookup
): React.ReactNode {
  if (!content) return null

  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g)

  return parts.map((part, index) => {
    if (part.startsWith('```') && part.endsWith('```')) {
      // Code block - no citation parsing inside code
      const code = part.slice(3, -3).replace(/^\w+\n/, '') // Remove language identifier
      return (
        <pre
          key={index}
          className="my-2 overflow-x-auto rounded-md bg-muted p-3 text-sm"
        >
          <code>{code}</code>
        </pre>
      )
    }

    // Regular text - handle basic markdown with citations
    return (
      <span key={index}>
        {part.split('\n').map((line, lineIndex) => {
          // Headers
          if (line.startsWith('### ')) {
            return (
              <h3 key={lineIndex} className="mt-4 mb-2 text-sm font-semibold">
                {renderInlineWithCitations(line.slice(4), projectId, documentLookup)}
              </h3>
            )
          }
          if (line.startsWith('## ')) {
            return (
              <h2 key={lineIndex} className="mt-4 mb-2 text-base font-semibold">
                {renderInlineWithCitations(line.slice(3), projectId, documentLookup)}
              </h2>
            )
          }

          // Bullet points
          if (line.startsWith('- ') || line.startsWith('* ')) {
            return (
              <div key={lineIndex} className="flex gap-2 my-1">
                <span className="text-muted-foreground">•</span>
                <span>{renderInlineWithCitations(line.slice(2), projectId, documentLookup)}</span>
              </div>
            )
          }

          // Numbered lists
          const numberedMatch = line.match(/^(\d+)\. (.+)/)
          if (numberedMatch && numberedMatch[1] && numberedMatch[2]) {
            return (
              <div key={lineIndex} className="flex gap-2 my-1">
                <span className="text-muted-foreground min-w-[1.5rem]">
                  {numberedMatch[1]}.
                </span>
                <span>{renderInlineWithCitations(numberedMatch[2], projectId, documentLookup)}</span>
              </div>
            )
          }

          // Regular paragraph
          if (line.trim()) {
            return (
              <p key={lineIndex} className="my-1">
                {renderInlineWithCitations(line, projectId, documentLookup)}
              </p>
            )
          }

          return <br key={lineIndex} />
        })}
      </span>
    )
  })
}

/**
 * Render inline text with citation support
 * Uses CitationRenderer for text containing citations, plain text otherwise
 */
function renderInlineWithCitations(
  text: string,
  projectId: string,
  documentLookup?: DocumentLookup
): React.ReactNode {
  // Quick check if text has citations
  if (!hasCitations(text)) {
    return text
  }

  return (
    <CitationRenderer
      text={text}
      projectId={projectId}
      documentLookup={documentLookup}
    />
  )
}

/**
 * Source citations section display
 * Renders sources array from message metadata with clickable links
 * Story: E5.4 - AC: #7 (Sources Section Display)
 */
interface SourceCitationsProps {
  sources: SourceCitation[]
  projectId: string
  documentLookup?: DocumentLookup
}

function SourceCitationsSection({ sources, projectId, documentLookup }: SourceCitationsProps) {
  if (!sources || sources.length === 0) return null

  return (
    <div className="mt-3 pt-3 border-t border-border/50">
      <div className="text-xs text-muted-foreground mb-1.5">Sources:</div>
      <div className="flex flex-wrap gap-2">
        {sources.map((source, index) => {
          // Try to resolve document ID from lookup or use provided ID
          const lookup = documentLookup?.[source.documentName]
          const documentId = source.documentId || lookup?.documentId

          return (
            <SourceCitationLink
              key={index}
              documentId={documentId}
              documentName={source.documentName}
              location={source.location}
              chunkId={source.chunkId || lookup?.chunkId}
              pageNumber={source.pageNumber}
              sheetName={source.sheetName}
              cellReference={source.cellReference}
              projectId={projectId}
              isUnavailable={!documentId}
            />
          )
        })}
      </div>
    </div>
  )
}

export const MessageItem = memo(function MessageItem({
  message,
  isStreaming = false,
  currentTool = null,
  projectId,
  className,
}: MessageItemProps) {
  const [copied, setCopied] = useState(false)
  const [documentLookup, setDocumentLookup] = useState<DocumentLookup>({})
  const [isEditing, setIsEditing] = useState(false)
  const [displayContent, setDisplayContent] = useState(message.content)

  const role = normalizeMessageRole(message.role)
  const isUser = role === 'user'
  const isAssistant = role === 'assistant'

  // Extract unique document names from content and sources for lookup
  const documentNamesToLookup = useMemo(() => {
    const names = new Set<string>()

    // From inline citations in content
    if (message.content && hasCitations(message.content)) {
      const { citations } = parseCitations(message.content)
      for (const c of citations) {
        names.add(c.documentName)
      }
    }

    // From sources array
    if (message.sources) {
      for (const s of message.sources) {
        if (!s.documentId) {
          names.add(s.documentName)
        }
      }
    }

    return Array.from(names)
  }, [message.content, message.sources])

  // Resolve document names to IDs
  const resolveDocuments = useCallback(async () => {
    if (documentNamesToLookup.length === 0 || !projectId) {
      return
    }

    try {
      const results = await findDocumentsByNames(projectId, documentNamesToLookup)
      const lookup: DocumentLookup = {}

      for (const [name, result] of results) {
        lookup[name] = {
          documentId: result.documentId,
          chunkId: result.chunkId,
        }
      }

      setDocumentLookup(lookup)
    } catch (error) {
      console.error('Error resolving document names:', error)
    }
  }, [documentNamesToLookup, projectId])

  // Resolve documents when message changes (but not during streaming)
  useEffect(() => {
    if (!isStreaming && documentNamesToLookup.length > 0) {
      resolveDocuments()
    }
  }, [isStreaming, documentNamesToLookup.length, resolveDocuments])

  // Sync display content when message changes
  useEffect(() => {
    setDisplayContent(message.content)
  }, [message.content])

  // Copy message content
  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Handle save from edit mode (E7.3)
  const handleSaveEdit = useCallback(async (editedText: string, editType: EditType) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/messages/${message.id}/edits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalText: message.content,
          editedText,
          editType,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save edit')
      }

      // Update display content with edited text
      setDisplayContent(editedText)
      setIsEditing(false)
    } catch (err) {
      // Re-throw to let ResponseEditMode handle the error display
      throw err
    }
  }, [projectId, message.id, message.content])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
  }, [])

  return (
    <div
      className={cn(
        'group flex gap-3 py-4',
        isUser && 'flex-row-reverse',
        className
      )}
      data-testid="message-item"
    >
      {/* Avatar */}
      <Avatar className={cn('h-8 w-8', isUser && 'bg-primary')}>
        <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-muted')}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      {/* Message content */}
      <div
        className={cn(
          'flex-1 space-y-1',
          isUser && 'flex flex-col items-end'
        )}
      >
        <div
          className={cn(
            'rounded-lg px-4 py-2.5 max-w-[85%]',
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted',
            isStreaming && isAssistant && 'animate-pulse'
          )}
        >
          {/* Message text or edit mode (E7.3) */}
          {isEditing && isAssistant ? (
            <ResponseEditMode
              originalText={message.content}
              messageId={message.id}
              projectId={projectId}
              onSave={handleSaveEdit}
              onCancel={handleCancelEdit}
            />
          ) : (
            <div className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none">
              {displayContent ? (
                renderContent(displayContent, projectId, documentLookup)
              ) : isStreaming ? (
                <TypingIndicator />
              ) : null}
            </div>
          )}

          {/* Tool indicator (while streaming) */}
          {isStreaming && currentTool && (
            <div className="mt-2">
              <ToolIndicator toolName={currentTool} />
            </div>
          )}

          {/* Source citations section */}
          {isAssistant && message.sources && message.sources.length > 0 && (
            <SourceCitationsSection
              sources={message.sources}
              projectId={projectId}
              documentLookup={documentLookup}
            />
          )}

          {/* Confidence badge (E5.7) */}
          {isAssistant && message.confidence && !isStreaming && (
            <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence:</span>
              <ConfidenceBadge
                level={message.confidence.level}
                confidence={message.confidence.score}
                size="sm"
              />
            </div>
          )}
        </div>

        {/* Actions and timestamp */}
        <div
          className={cn(
            'flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity',
            isUser && 'flex-row-reverse'
          )}
        >
          <TooltipProvider>
            {/* Copy button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3 w-3 text-green-500" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{copied ? 'Copied!' : 'Copy message'}</p>
              </TooltipContent>
            </Tooltip>

            {/* Edit button - only for assistant messages, not during streaming (E7.3) */}
            {isAssistant && !isStreaming && !isEditing && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => setIsEditing(true)}
                    data-testid="edit-message-button"
                  >
                    <Edit2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Edit response</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>

          <span className="text-xs text-muted-foreground">
            {new Date(message.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>
      </div>
    </div>
  )
})
