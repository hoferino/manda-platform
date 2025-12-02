'use client'

/**
 * ConversationSidebar Component
 *
 * Sidebar with conversation history list.
 * Story: E5.3 - Build Chat Interface with Conversation History
 * AC: #3 (Conversation History Sidebar), #5 (Collapsible)
 */

import { useState, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import {
  Plus,
  MessageSquare,
  Trash2,
  PanelLeftClose,
  PanelLeft,
  MoreVertical,
  Edit2,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import type { Conversation } from '@/lib/types/chat'
import { cn } from '@/lib/utils'

interface ConversationSidebarProps {
  conversations: Conversation[]
  currentConversationId: string | null
  isLoading?: boolean
  onSelect: (id: string | null) => void
  onNew: () => void
  onDelete: (id: string) => Promise<void>
  onRename: (id: string, title: string) => Promise<void>
  className?: string
}

/**
 * Individual conversation item
 */
function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
  onRename,
}: {
  conversation: Conversation
  isActive: boolean
  onSelect: () => void
  onDelete: () => Promise<void>
  onRename: (title: string) => Promise<void>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(conversation.title || '')
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const handleRename = async () => {
    if (editValue.trim() && editValue !== conversation.title) {
      await onRename(editValue.trim())
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      await onDelete()
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename()
    } else if (e.key === 'Escape') {
      setIsEditing(false)
      setEditValue(conversation.title || '')
    }
  }

  return (
    <>
      <div
        className={cn(
          'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors',
          isActive
            ? 'bg-accent text-accent-foreground'
            : 'hover:bg-accent/50'
        )}
        onClick={() => !isEditing && onSelect()}
      >
        <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />

        {isEditing ? (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={handleKeyDown}
            className="h-6 px-1 py-0 text-sm"
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div className="flex-1 min-w-0">
            <div className="truncate font-medium">
              {conversation.title || 'New conversation'}
            </div>
            <div className="text-xs text-muted-foreground truncate">
              {formatDistanceToNow(new Date(conversation.updatedAt), { addSuffix: true })}
              {conversation.messageCount !== undefined && (
                <> · {conversation.messageCount} messages</>
              )}
            </div>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation()
                setIsEditing(true)
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={(e) => {
                e.stopPropagation()
                setShowDeleteDialog(true)
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this conversation and all its messages.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * Sidebar content (used in both desktop sidebar and mobile sheet)
 */
function SidebarContent({
  conversations,
  currentConversationId,
  isLoading,
  onSelect,
  onNew,
  onDelete,
  onRename,
}: ConversationSidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b">
        <Button onClick={onNew} className="w-full" variant="outline">
          <Plus className="h-4 w-4 mr-2" />
          New conversation
        </Button>
      </div>

      {/* Conversation list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No conversations yet
            </div>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem
                key={conversation.id}
                conversation={conversation}
                isActive={conversation.id === currentConversationId}
                onSelect={() => onSelect(conversation.id)}
                onDelete={() => onDelete(conversation.id)}
                onRename={(title) => onRename(conversation.id, title)}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

/**
 * Desktop sidebar
 */
export function ConversationSidebar(props: ConversationSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  return (
    <div
      className={cn(
        'border-r bg-muted/30 transition-all duration-300 hidden lg:flex flex-col',
        isCollapsed ? 'w-0' : 'w-[280px]',
        props.className
      )}
    >
      {!isCollapsed && <SidebarContent {...props} />}

      {/* Collapse button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          'absolute top-4 h-8 w-8 z-10',
          isCollapsed ? 'left-2' : 'left-[252px]'
        )}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        {isCollapsed ? (
          <PanelLeft className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

/**
 * Mobile sidebar (sheet/drawer)
 */
export function MobileConversationSidebar(
  props: ConversationSidebarProps & { open?: boolean; onOpenChange?: (open: boolean) => void }
) {
  const { open, onOpenChange, ...sidebarProps } = props

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SidebarContent
          {...sidebarProps}
          onSelect={(id) => {
            sidebarProps.onSelect(id)
            onOpenChange?.(false)
          }}
          onNew={() => {
            sidebarProps.onNew()
            onOpenChange?.(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
