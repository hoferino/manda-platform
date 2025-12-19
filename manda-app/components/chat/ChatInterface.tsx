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
import { Menu, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
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
    backgroundStreamConversationId,
    error: chatError,
    currentTool,
    contextMessageCount,
    suggestedFollowups,
    sendMessage,
    retryLastMessage,
    clearError,
    clearSuggestions,
    loadConversation,
    prepareForNewConversation,
  } = useChat({
    projectId,
    conversationId: currentConversationId,
    // Note: onConversationCreated is not used - conversation is created by ChatInterface directly
  })

  // Get the title of the conversation with a background stream
  const backgroundStreamConversationTitle = backgroundStreamConversationId
    ? conversations.find((c) => c.id === backgroundStreamConversationId)?.title || 'a conversation'
    : null

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
  // Use window.history.replaceState instead of router.replace to avoid
  // triggering a soft navigation that could interrupt streaming state
  useEffect(() => {
    const currentParam = searchParams.get('conversation')
    if (currentConversationId !== currentParam) {
      const url = new URL(window.location.href)
      if (currentConversationId) {
        url.searchParams.set('conversation', currentConversationId)
      } else {
        url.searchParams.delete('conversation')
      }
      // Use native history API to update URL without navigation
      window.history.replaceState(null, '', url.pathname + url.search)
    }
  }, [currentConversationId, searchParams])

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
      // If no conversation selected, create one first and pass ID directly
      // to avoid race condition with React state propagation
      if (!currentConversationId) {
        // Prevent the conversationId change from triggering a message reload
        console.log('[ChatInterface] Preparing for new conversation')
        prepareForNewConversation()
        const conversation = await createNewConversation(
          content.length > 50 ? content.substring(0, 47) + '...' : content
        )
        console.log('[ChatInterface] Created conversation:', conversation.id)
        // Pass the new conversation ID directly to bypass state propagation delay
        await sendMessage(content, conversation.id)
      } else {
        await sendMessage(content)
      }
    },
    [currentConversationId, createNewConversation, sendMessage, prepareForNewConversation]
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

        {/* Background stream indicator */}
        {backgroundStreamConversationId && (
          <div className="px-4 py-2 text-xs bg-primary/10 border-b flex items-center gap-2">
            <Loader2 className="h-3 w-3 animate-spin text-primary" />
            <span className="text-primary">
              Processing response in "{backgroundStreamConversationTitle}"...
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-6 text-xs"
              onClick={() => handleSelectConversation(backgroundStreamConversationId)}
            >
              Go to conversation
            </Button>
          </div>
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
