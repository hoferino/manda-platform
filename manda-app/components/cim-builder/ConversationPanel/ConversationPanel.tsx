'use client'

/**
 * Conversation Panel - Center panel of CIM Builder
 *
 * Chat interface for conversing with the CIM agent.
 * Features:
 * - Message history display
 * - Auto-scroll on new messages
 * - Source reference support in input
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #4 - Conversation panel with message history and auto-scroll
 */

import * as React from 'react'
import { CIMMessageList } from './CIMMessageList'
import { CIMChatInput } from './CIMChatInput'
import type { ConversationMessage } from '@/lib/types/cim'
import { useCIMChat } from '@/lib/hooks/useCIMChat'

interface ConversationPanelProps {
  projectId: string
  cimId: string
  conversationHistory: ConversationMessage[]
  sourceRef: string
  onSourceRefClear: () => void
  onMessageSent: (message: ConversationMessage) => void
  onCIMStateChanged?: () => void // Callback to refresh CIM state after tool updates (AC #7)
}

export function ConversationPanel({
  projectId,
  cimId,
  conversationHistory,
  sourceRef,
  onSourceRefClear,
  onMessageSent,
  onCIMStateChanged,
}: ConversationPanelProps) {
  const {
    messages,
    isStreaming,
    currentTool,
    sendMessage,
  } = useCIMChat({
    projectId,
    cimId,
    initialMessages: conversationHistory,
    onMessageComplete: onMessageSent,
    onCIMStateChanged,
  })

  // Handle sending message with source reference
  const handleSend = React.useCallback(
    async (content: string) => {
      // Prepend source reference if present
      const alreadyPrefixed = sourceRef && content.trimStart().startsWith(sourceRef)
      const fullContent = sourceRef && !alreadyPrefixed ? `${sourceRef}\n\n${content}` : content
      await sendMessage(fullContent)
      onSourceRefClear()
    },
    [sourceRef, sendMessage, onSourceRefClear]
  )

  return (
    <div className="h-full flex flex-col">
      {/* Message list */}
      <CIMMessageList
        messages={messages}
        isStreaming={isStreaming}
        currentTool={currentTool}
        className="flex-1"
      />

      {/* Chat input */}
      <CIMChatInput
        onSubmit={handleSend}
        isLoading={isStreaming}
        sourceRef={sourceRef}
        onSourceRefClear={onSourceRefClear}
        placeholder="Ask the agent to help build your CIM..."
      />
    </div>
  )
}
