'use client'

/**
 * IRL Item Component
 *
 * Renders a single IRL item with edit capabilities.
 * Story: E6.2 - Implement IRL Creation and Editing
 *
 * Features:
 * - Display item name, priority, status
 * - Inline editing of name
 * - Priority and status dropdowns
 * - Delete action
 * - Drag handle for reordering
 */

import { useState, useRef, useEffect } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  GripVertical,
  Trash2,
  ChevronDown,
  Pencil,
  Check,
  X,
} from 'lucide-react'
import {
  IRLItem as IRLItemType,
  IRLPriority,
  IRLItemStatus,
  IRL_PRIORITIES,
  IRL_ITEM_STATUSES,
  getPriorityInfo,
  getStatusInfo,
} from '@/lib/types/irl'
import { cn } from '@/lib/utils'

export interface IRLItemProps {
  /** The IRL item to display */
  item: IRLItemType
  /** Called when item is updated */
  onUpdate?: (itemId: string, updates: { itemName?: string; priority?: IRLPriority; status?: IRLItemStatus; notes?: string }) => void
  /** Called when item is deleted */
  onDelete?: (itemId: string) => void
  /** Whether the item is being saved */
  isSaving?: boolean
  /** Whether drag-and-drop is enabled */
  isDragDisabled?: boolean
  /** Additional class names */
  className?: string
}

export function IRLItem({
  item,
  onUpdate,
  onDelete,
  isSaving = false,
  isDragDisabled = false,
  className,
}: IRLItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(item.itemName)
  const inputRef = useRef<HTMLInputElement>(null)

  // Drag and drop setup
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    disabled: isDragDisabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Reset edit value when item changes
  useEffect(() => {
    setEditValue(item.itemName)
  }, [item.itemName])

  const handleStartEdit = () => {
    setIsEditing(true)
    setEditValue(item.itemName)
  }

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== item.itemName) {
      onUpdate?.(item.id, { itemName: editValue.trim() })
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditValue(item.itemName)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handlePriorityChange = (priority: IRLPriority) => {
    onUpdate?.(item.id, { priority })
  }

  const handleStatusChange = (status: IRLItemStatus) => {
    onUpdate?.(item.id, { status })
  }

  const handleDelete = () => {
    onDelete?.(item.id)
  }

  const priorityInfo = getPriorityInfo(item.priority)
  const statusInfo = getStatusInfo(item.status)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 p-3 rounded-md border bg-card',
        'hover:bg-muted/50 transition-colors',
        isDragging && 'opacity-50 shadow-lg',
        isSaving && 'opacity-70',
        className
      )}
      data-testid={`irl-item-${item.id}`}
    >
      {/* Drag handle */}
      {!isDragDisabled && (
        <button
          className="cursor-grab text-muted-foreground hover:text-foreground touch-none"
          {...attributes}
          {...listeners}
          aria-label="Drag to reorder"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}

      {/* Item name (editable) */}
      <div className="flex-1 min-w-0">
        {isEditing ? (
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveEdit}
              className="h-8"
              data-testid="item-name-input"
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleSaveEdit}
              aria-label="Save"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={handleCancelEdit}
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <button
            className="flex items-center gap-2 text-left w-full group"
            onClick={handleStartEdit}
            aria-label={`Edit ${item.itemName}`}
          >
            <span className="truncate">{item.itemName}</span>
            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 shrink-0" />
          </button>
        )}
        {item.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {item.description}
          </p>
        )}
      </div>

      {/* Priority dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 px-2"
            disabled={isSaving}
          >
            <Badge
              variant="secondary"
              className={cn('text-xs', priorityInfo.color)}
            >
              {priorityInfo.label}
            </Badge>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {IRL_PRIORITIES.map(priority => {
            const info = getPriorityInfo(priority)
            return (
              <DropdownMenuItem
                key={priority}
                onClick={() => handlePriorityChange(priority)}
                className={cn(item.priority === priority && 'font-medium')}
              >
                <Badge variant="secondary" className={cn('mr-2 text-xs', info.color)}>
                  {info.label}
                </Badge>
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-7 px-2"
            disabled={isSaving}
          >
            <span className={cn('text-lg', statusInfo.color)}>{statusInfo.icon}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {IRL_ITEM_STATUSES.map(status => {
            const info = getStatusInfo(status)
            return (
              <DropdownMenuItem
                key={status}
                onClick={() => handleStatusChange(status)}
                className={cn(item.status === status && 'font-medium')}
              >
                <span className={cn('mr-2', info.color)}>{info.icon}</span>
                {info.label}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={isSaving}
        aria-label="Delete item"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
