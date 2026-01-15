'use client'

/**
 * Conversation Panel - Center panel of CIM Builder
 *
 * Chat interface for conversing with the CIM agent.
 * Features:
 * - Message history display
 * - Auto-scroll on new messages
 * - Source reference support in input
 * - MVP agent support with SSE streaming
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * Story: CIM MVP Fast Track
 * AC: #4 - Conversation panel with message history and auto-scroll
 */

import * as React from 'react'
import { CIMMessageList } from './CIMMessageList'
import { CIMChatInput } from './CIMChatInput'
import type { ConversationMessage } from '@/lib/types/cim'
import { useCIMChat } from '@/lib/hooks/useCIMChat'
import { useCIMMVPChat } from '@/lib/hooks/useCIMMVPChat'
import type { SlideUpdate, CIMPhase, WorkflowProgress, CIMOutline, KnowledgeMode } from '@/lib/agent/cim-mvp'

interface ConversationPanelProps {
  projectId: string
  cimId: string
  conversationHistory: ConversationMessage[]
  sourceRef: string
  onSourceRefClear: () => void
  onMessageSent: (message: ConversationMessage) => void
  onCIMStateChanged?: () => void // Callback to refresh CIM state after tool updates (AC #7)
  // Knowledge source props (Story: CIM Knowledge Toggle)
  knowledgeMode?: KnowledgeMode // 'json' | 'graphiti'
  knowledgePath?: string // Path to knowledge.json (required if mode === 'json')
  dealId?: string // Deal ID for Graphiti mode
  onSlideUpdate?: (slide: SlideUpdate) => void // Callback for real-time slide updates
  onPhaseChange?: (phase: CIMPhase) => void // Callback for phase navigation
  // Story 10: New workflow callbacks
  onWorkflowProgress?: (progress: WorkflowProgress) => void
  onOutlineCreated?: (outline: CIMOutline) => void
  onOutlineUpdated?: (outline: CIMOutline) => void
  onSectionStarted?: (sectionId: string, sectionTitle: string) => void
}

// Separate component for MVP agent to avoid hook conflicts
function MVPConversationPanel({
  projectId,
  cimId,
  conversationHistory,
  sourceRef,
  onSourceRefClear,
  onMessageSent,
  onCIMStateChanged,
  // Story: CIM Knowledge Toggle
  knowledgeMode = 'json',
  knowledgePath,
  dealId,
  onSlideUpdate,
  onPhaseChange,
  // Story 10: New workflow callbacks
  onWorkflowProgress,
  onOutlineCreated,
  onOutlineUpdated,
  onSectionStarted,
}: ConversationPanelProps) {
  const { messages, isStreaming, currentTool, sendMessage } = useCIMMVPChat({
    projectId,
    cimId,
    initialMessages: conversationHistory,
    // Story: CIM Knowledge Toggle
    knowledgeMode,
    knowledgePath,
    dealId,
    onMessageComplete: onMessageSent,
    onSlideUpdate,
    onPhaseChange,
    onCIMStateChanged,
    // Story 10: New workflow callbacks
    onWorkflowProgress,
    onOutlineCreated,
    onOutlineUpdated,
    onSectionStarted,
  })

  // Debug log for message changes
  React.useEffect(() => {
    console.log('[MVPConversationPanel] messages updated:', messages.length)
  }, [messages])

  const handleSend = React.useCallback(
    async (content: string) => {
      const alreadyPrefixed = sourceRef && content.trimStart().startsWith(sourceRef)
      const fullContent = sourceRef && !alreadyPrefixed ? `${sourceRef}\n\n${content}` : content
      await sendMessage(fullContent)
      onSourceRefClear()
    },
    [sourceRef, sendMessage, onSourceRefClear]
  )

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <CIMMessageList
        messages={messages}
        isStreaming={isStreaming}
        currentTool={currentTool}
        className="flex-1 min-h-0"
      />
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

// Separate component for standard agent
function StandardConversationPanel({
  projectId,
  cimId,
  conversationHistory,
  sourceRef,
  onSourceRefClear,
  onMessageSent,
  onCIMStateChanged,
}: Omit<ConversationPanelProps, 'useMVPAgent' | 'knowledgePath' | 'onSlideUpdate' | 'onPhaseChange'>) {
  const { messages, isStreaming, currentTool, sendMessage } = useCIMChat({
    projectId,
    cimId,
    initialMessages: conversationHistory,
    onMessageComplete: onMessageSent,
    onCIMStateChanged,
  })

  const handleSend = React.useCallback(
    async (content: string) => {
      const alreadyPrefixed = sourceRef && content.trimStart().startsWith(sourceRef)
      const fullContent = sourceRef && !alreadyPrefixed ? `${sourceRef}\n\n${content}` : content
      await sendMessage(fullContent)
      onSourceRefClear()
    },
    [sourceRef, sendMessage, onSourceRefClear]
  )

  return (
    <div className="h-full flex flex-col min-h-0 overflow-hidden">
      <CIMMessageList
        messages={messages}
        isStreaming={isStreaming}
        currentTool={currentTool}
        className="flex-1 min-h-0"
      />
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

export function ConversationPanel({
  projectId,
  cimId,
  conversationHistory,
  sourceRef,
  onSourceRefClear,
  onMessageSent,
  onCIMStateChanged,
  // Story: CIM Knowledge Toggle - always use MVP agent, just with different knowledge sources
  knowledgeMode = 'json',
  knowledgePath,
  dealId,
  onSlideUpdate,
  onPhaseChange,
  // Story 10: New workflow callbacks
  onWorkflowProgress,
  onOutlineCreated,
  onOutlineUpdated,
  onSectionStarted,
}: ConversationPanelProps) {
  // Always use MVPConversationPanel - it supports both JSON and Graphiti knowledge modes
  return (
    <MVPConversationPanel
      projectId={projectId}
      cimId={cimId}
      conversationHistory={conversationHistory}
      sourceRef={sourceRef}
      onSourceRefClear={onSourceRefClear}
      onMessageSent={onMessageSent}
      onCIMStateChanged={onCIMStateChanged}
      // Story: CIM Knowledge Toggle
      knowledgeMode={knowledgeMode}
      knowledgePath={knowledgePath}
      dealId={dealId}
      onSlideUpdate={onSlideUpdate}
      onPhaseChange={onPhaseChange}
      // Story 10: New workflow callbacks
      onWorkflowProgress={onWorkflowProgress}
      onOutlineCreated={onOutlineCreated}
      onOutlineUpdated={onOutlineUpdated}
      onSectionStarted={onSectionStarted}
    />
  )
}
