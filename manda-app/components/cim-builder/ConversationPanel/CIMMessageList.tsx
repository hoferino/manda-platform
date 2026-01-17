'use client'

/**
 * CIM Message List - Scrollable list of CIM conversation messages
 *
 * Adapted from the main chat MessageList component for CIM Builder.
 * Features auto-scroll and user scroll detection.
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #4 - Message history with auto-scroll
 */

import * as React from 'react'
import { useRef, useEffect, useCallback, useState } from 'react'
import { ChevronDown, Sparkles, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import type { ConversationMessage } from '@/lib/types/cim'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface CIMMessageListProps {
  messages: ConversationMessage[]
  isStreaming?: boolean
  currentTool?: string | null
  className?: string
}

export function CIMMessageList({
  messages,
  isStreaming = false,
  currentTool = null,
  className,
}: CIMMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const [showScrollButton, setShowScrollButton] = useState(false)
  const [isUserScrolling, setIsUserScrolling] = useState(false)

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
    setIsUserScrolling(false)
    setShowScrollButton(false)
  }, [])

  // Auto-scroll on new messages (unless user is scrolling)
  useEffect(() => {
    if (!isUserScrolling) {
      scrollToBottom('auto')
    }
  }, [messages, isUserScrolling, scrollToBottom])

  // Auto-scroll during streaming
  useEffect(() => {
    if (isStreaming && !isUserScrolling) {
      scrollToBottom('auto')
    }
  }, [isStreaming, messages, isUserScrolling, scrollToBottom])

  // Handle scroll to detect user scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement
    const isAtBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 100

    if (isAtBottom) {
      setIsUserScrolling(false)
      setShowScrollButton(false)
    } else {
      setIsUserScrolling(true)
      setShowScrollButton(true)
    }
  }, [])

  // Hardcoded intro message for instant display
  const introMessage: ConversationMessage = {
    id: 'intro-message',
    role: 'assistant',
    content: `## Welcome to CIM Builder

I'll help you create a professional **Confidential Information Memorandum** - the key document that presents your company to potential buyers.

### Here's How We'll Work Together

We'll move through 5 collaborative stages:

1. **Buyer Persona** — Who are we writing this for? (Strategic buyer? PE firm? Specific company?)
2. **Hero Concept** — What's the compelling story hook that makes them say "I need to learn more"?
3. **Investment Thesis** — Why should they buy now?
4. **Outline** — What sections will tell this story best?
5. **Build Sections** — Create each slide together, one at a time

**Send a message to get started!**`,
    timestamp: new Date().toISOString(),
  }

  // Always prepend intro message so it stays visible during conversation
  const displayMessages = [introMessage, ...messages]

  return (
    <div className={cn('relative flex-1 flex flex-col min-h-0 overflow-hidden', className)}>
      <ScrollArea className="flex-1 h-full" onScroll={handleScroll}>
        <div ref={scrollRef} className="px-4 py-4 space-y-4">
          {displayMessages.map((message, index) => {
            const isLastMessage = index === displayMessages.length - 1
            const isLastAssistant = isLastMessage && message.role === 'assistant'
            // Don't show streaming indicator for the hardcoded intro
            const showStreaming = isStreaming && isLastAssistant && message.id !== 'intro-message'

            return (
              <MessageItem
                key={message.id}
                message={message}
                isStreaming={showStreaming}
                currentTool={showStreaming ? currentTool : null}
              />
            )
          })}
          <div ref={bottomRef} className="h-px" />
        </div>
      </ScrollArea>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-md"
          onClick={() => scrollToBottom('smooth')}
        >
          <ChevronDown className="h-4 w-4 mr-1" />
          Scroll to bottom
        </Button>
      )}
    </div>
  )
}

// Message Item sub-component
interface MessageItemProps {
  message: ConversationMessage
  isStreaming?: boolean
  currentTool?: string | null
}

function MessageItem({ message, isStreaming, currentTool }: MessageItemProps) {
  const isUser = message.role === 'user'

  return (
    <div
      className={cn(
        'flex gap-3',
        isUser ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          'flex-1 max-w-[80%] rounded-lg px-4 py-3',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-muted'
        )}
      >
        {/* Tool indicator */}
        {currentTool && !isUser && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Using: {currentTool}
          </div>
        )}

        {/* Message text with markdown */}
        <div className={cn(
          'prose prose-sm max-w-none',
          'dark:prose-invert',
          // Headings
          'prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2',
          // Paragraphs
          'prose-p:my-2 prose-p:leading-relaxed',
          // Lists - better spacing and bullets
          'prose-ul:my-2 prose-ul:pl-4 prose-ol:my-2 prose-ol:pl-4',
          'prose-li:my-1 prose-li:marker:text-muted-foreground',
          // Bold text
          'prose-strong:font-semibold prose-strong:text-foreground',
          // Code
          'prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:bg-muted-foreground/20 prose-code:text-sm',
          // First element no top margin
          '[&>*:first-child]:mt-0',
          // User message text color
          isUser && 'prose-p:text-primary-foreground prose-li:text-primary-foreground prose-strong:text-primary-foreground'
        )}>
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Custom heading styles
              h1: ({ children }) => <h1 className="text-lg font-bold border-b pb-1 mb-3">{children}</h1>,
              h2: ({ children }) => <h2 className="text-base font-semibold mt-4 mb-2">{children}</h2>,
              h3: ({ children }) => <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>,
              // Better list rendering
              ul: ({ children }) => <ul className="list-disc space-y-1 pl-4 my-2">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal space-y-1 pl-4 my-2">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              // Inline code
              code: ({ children, className }) => {
                const isBlock = className?.includes('language-')
                if (isBlock) {
                  return <code className={className}>{children}</code>
                }
                return <code className="px-1.5 py-0.5 rounded bg-muted-foreground/20 text-sm font-mono">{children}</code>
              },
              // Paragraphs
              p: ({ children }) => <p className="my-2 leading-relaxed">{children}</p>,
              // Tables
              table: ({ children }) => (
                <div className="my-3 overflow-x-auto">
                  <table className="w-full text-sm border-collapse">{children}</table>
                </div>
              ),
              thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
              th: ({ children }) => <th className="text-left py-1.5 pr-4 font-medium text-muted-foreground">{children}</th>,
              td: ({ children }) => <td className="py-1.5 pr-4">{children}</td>,
              tr: ({ children }) => <tr className="border-b border-border/50 last:border-0">{children}</tr>,
            }}
          >
            {message.content || (isStreaming ? '...' : '')}
          </ReactMarkdown>
        </div>

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex items-center gap-1 mt-2">
            <div className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
        )}

        {/* Timestamp */}
        <p className={cn(
          'text-xs mt-2 opacity-60',
          isUser ? 'text-primary-foreground' : 'text-muted-foreground'
        )}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  )
}
