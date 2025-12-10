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

  // Empty state
  if (messages.length === 0) {
    return (
      <div className={cn('flex-1 flex items-center justify-center', className)}>
        <div className="text-center space-y-3 max-w-md px-4">
          <div className="text-4xl">✨</div>
          <h3 className="text-lg font-medium">Start building your CIM</h3>
          <p className="text-sm text-muted-foreground">
            I'll help you create a compelling Confidential Information Memorandum.
            Start by describing your target buyer or the key investment highlights.
          </p>
          <div className="text-xs text-muted-foreground pt-4 space-y-1">
            <p className="font-medium">Try saying:</p>
            <p>"Who is the ideal buyer for this company?"</p>
            <p>"Let's start with the investment thesis"</p>
            <p>"Create an outline for a strategic acquirer"</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative flex-1 flex flex-col', className)}>
      <ScrollArea className="flex-1" onScroll={handleScroll}>
        <div ref={scrollRef} className="px-4 py-4 space-y-4">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1
            const isLastAssistant = isLastMessage && message.role === 'assistant'

            return (
              <MessageItem
                key={message.id}
                message={message}
                isStreaming={isStreaming && isLastAssistant}
                currentTool={isStreaming && isLastAssistant ? currentTool : null}
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
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
