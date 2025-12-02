'use client'

/**
 * ChatInterface Component
 *
 * Main container for the chat interface.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * Story: E5.5 - Quick Actions and Suggested Follow-ups
 * Story: E5.9 - Document Upload via Chat Interface
 * AC: #1 (Chat Page UI), #10 (Responsive Design)
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Menu, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useConversations } from '@/lib/hooks/useConversations'
import { useChat } from '@/lib/hooks/useChat'
import { useChatUpload } from '@/lib/hooks/useChatUpload'
import { useQuickActionAvailability, getAvailabilityMap } from '@/lib/hooks/useQuickActionAvailability'
import { ConversationSidebar, MobileConversationSidebar } from './ConversationSidebar'
import { MessageList } from './MessageList'
import { ChatInput } from './ChatInput'
import { QuickActions } from './QuickActions'
import { FollowUpSuggestions } from './FollowUpSuggestions'
import { ChatDropZone } from './ChatDropZone'
import { ChatUploadStatusList } from './ChatUploadStatus'
import { cn } from '@/lib/utils'

interface ChatInterfaceProps {
  projectId: string
  className?: string
}

export function ChatInterface({ projectId, className }: ChatInterfaceProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Get initial conversation ID from URL
  const initialConversationId = searchParams.get('conversation')

  // Conversation management
  const {
    conversations,
    currentConversationId,
    isLoading: conversationsLoading,
    error: conversationsError,
    selectConversation,
    createNewConversation,
    deleteConversation,
    updateConversationTitle,
    refreshConversations,
  } = useConversations({
    projectId,
    initialConversationId: initialConversationId || undefined,
  })

  // Chat state
  const {
    messages,
    isLoading: messagesLoading,
    isStreaming,
    error: chatError,
    currentTool,
    contextMessageCount,
    suggestedFollowups,
    sendMessage,
    retryLastMessage,
    clearError,
    clearSuggestions,
    loadConversation,
  } = useChat({
    projectId,
    conversationId: currentConversationId,
    onConversationCreated: (id) => {
      // Refresh conversations list when a new one is created
      refreshConversations()
    },
  })

  // Quick action availability
  const quickActionAvailability = useQuickActionAvailability({ projectId })

  // Chat upload state (E5.9)
  const {
    uploads,
    uploadFiles,
    dismissUpload,
    isUploading,
  } = useChatUpload(projectId, {
    conversationId: currentConversationId,
  })

  // Input ref for populating with follow-up suggestions
  const inputValueRef = useRef<string>('')
  const [inputValue, setInputValue] = useState('')

  // Handle follow-up suggestion selection
  const handleFollowUpSelect = useCallback((suggestion: string) => {
    setInputValue(suggestion)
  }, [])

  // Sync URL with current conversation
  useEffect(() => {
    const currentParam = searchParams.get('conversation')
    if (currentConversationId !== currentParam) {
      const url = new URL(window.location.href)
      if (currentConversationId) {
        url.searchParams.set('conversation', currentConversationId)
      } else {
        url.searchParams.delete('conversation')
      }
      router.replace(url.pathname + url.search, { scroll: false })
    }
  }, [currentConversationId, searchParams, router])

  // Handle new conversation
  const handleNewConversation = useCallback(async () => {
    selectConversation(null)
    // Don't create conversation in DB until first message is sent
  }, [selectConversation])

  // Handle conversation selection
  const handleSelectConversation = useCallback(
    (id: string | null) => {
      selectConversation(id)
      if (id) {
        loadConversation(id)
      }
    },
    [selectConversation, loadConversation]
  )

  // Handle message submit
  const handleSendMessage = useCallback(
    async (content: string) => {
      // Clear input value after sending
      setInputValue('')
      // If no conversation selected, create one first
      if (!currentConversationId) {
        const conversation = await createNewConversation(
          content.length > 50 ? content.substring(0, 47) + '...' : content
        )
        // The useChat hook will pick up the new conversation ID
      }
      await sendMessage(content)
    },
    [currentConversationId, createNewConversation, sendMessage]
  )

  // Handle quick action
  const handleQuickAction = useCallback(
    (prompt: string) => {
      handleSendMessage(prompt)
    },
    [handleSendMessage]
  )

  // Combined error
  const error = conversationsError || chatError

  return (
    <ChatDropZone
      projectId={projectId}
      onFilesDropped={uploadFiles}
      className={cn('flex h-[calc(100vh-4rem)] relative', className)}
    >
      {/* Desktop sidebar */}
      <ConversationSidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        isLoading={conversationsLoading}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={deleteConversation}
        onRename={updateConversationTitle}
      />

      {/* Mobile sidebar */}
      <MobileConversationSidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        isLoading={conversationsLoading}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={deleteConversation}
        onRename={updateConversationTitle}
        open={mobileMenuOpen}
        onOpenChange={setMobileMenuOpen}
      />

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header with menu button */}
        <div className="lg:hidden flex items-center gap-2 p-2 border-b">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <span className="text-sm font-medium truncate">
            {currentConversationId
              ? conversations.find((c) => c.id === currentConversationId)?.title ||
                'Conversation'
              : 'New conversation'}
          </span>
        </div>

        {/* Error alert */}
        {error && (
          <Alert variant="destructive" className="m-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>{error.message}</span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearError}
                >
                  Dismiss
                </Button>
                {chatError && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={retryLastMessage}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry
                  </Button>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Context indicator */}
        {messages.length > 0 && (
          <div className="px-4 py-2 text-xs text-muted-foreground border-b bg-muted/30">
            Context includes {contextMessageCount} messages
            {isStreaming && currentTool && (
              <span className="ml-2 text-primary">• Processing...</span>
            )}
          </div>
        )}

        {/* Message list */}
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          currentTool={currentTool}
          projectId={projectId}
          className="flex-1"
        />

        {/* Upload status messages (E5.9 AC: #4, #5, #6) */}
        {uploads.length > 0 && (
          <div className="px-4 py-2 max-w-3xl mx-auto w-full">
            <ChatUploadStatusList
              uploads={uploads}
              onDismiss={dismissUpload}
            />
          </div>
        )}

        {/* Follow-up suggestions (after latest assistant message) */}
        <FollowUpSuggestions
          suggestions={suggestedFollowups}
          onSelect={handleFollowUpSelect}
          isVisible={!isStreaming && suggestedFollowups.length > 0}
        />

        {/* Quick actions */}
        <QuickActions
          onAction={handleQuickAction}
          isLoading={isStreaming}
          availability={getAvailabilityMap(quickActionAvailability)}
        />

        {/* Input area with upload button (E5.9 AC: #1) */}
        <ChatInput
          onSubmit={handleSendMessage}
          isDisabled={messagesLoading}
          isLoading={isStreaming}
          initialValue={inputValue}
          onValueChange={setInputValue}
          onFilesSelected={uploadFiles}
          isUploading={isUploading}
        />
      </div>
    </ChatDropZone>
  )
}
