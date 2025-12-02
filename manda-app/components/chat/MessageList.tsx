'use client'

/**
 * MessageList Component
 *
 * Scrollable list of chat messages with auto-scroll.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #8 (Auto-Scroll)
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Message } from '@/lib/types/chat'
import { MessageItem } from './MessageItem'
import { cn } from '@/lib/utils'

interface MessageListProps {
  messages: Message[]
  isStreaming?: boolean
  currentTool?: string | null
  projectId: string
  className?: string
}

export function MessageList({
  messages,
  isStreaming = false,
  currentTool = null,
  projectId,
  className,
}: MessageListProps) {
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
          <div className="text-4xl">💬</div>
          <h3 className="text-lg font-medium">Start a conversation</h3>
          <p className="text-sm text-muted-foreground">
            Ask questions about your deal documents and get AI-powered answers
            with source citations.
          </p>
          <div className="text-xs text-muted-foreground pt-4 space-y-1">
            <p className="font-medium">Try asking:</p>
            <p>"What was the revenue last year?"</p>
            <p>"Are there any red flags in the contracts?"</p>
            <p>"Summarize the key financial metrics"</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('relative flex-1 flex flex-col', className)}>
      <ScrollArea className="flex-1" onScroll={handleScroll}>
        <div ref={scrollRef} className="px-4 py-4 space-y-2">
          {messages.map((message, index) => {
            const isLastMessage = index === messages.length - 1
            const isLastAssistantMessage =
              isLastMessage && (message.role === 'assistant' || message.role === 'ai')

            return (
              <MessageItem
                key={message.id}
                message={message}
                isStreaming={isStreaming && isLastAssistantMessage}
                currentTool={isStreaming && isLastAssistantMessage ? currentTool : null}
                projectId={projectId}
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
