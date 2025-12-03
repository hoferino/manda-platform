'use client'

/**
 * IRL Category Component
 *
 * Renders a collapsible category section with its items.
 * Story: E6.2 - Implement IRL Creation and Editing
 *
 * Features:
 * - Collapsible section header
 * - Inline category name editing
 * - Add item button
 * - Delete category action
 * - Drag-and-drop container for items
 */

import { useState, useRef, useEffect } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
} from 'lucide-react'
import { IRLItem } from './IRLItem'
import { IRLCategoryProgress } from './IRLCategoryProgress'
import { IRLItem as IRLItemType, IRLPriority, IRLItemStatus, IRLProgressByCategory } from '@/lib/types/irl'
import { cn } from '@/lib/utils'

export interface IRLCategoryProps {
  /** Category name */
  name: string
  /** Items in this category */
  items: IRLItemType[]
  /** Progress data for this category (fulfilled-based) */
  progress?: IRLProgressByCategory
  /** Called when category is renamed */
  onRename?: (oldName: string, newName: string) => void
  /** Called when category is deleted */
  onDelete?: (name: string) => void
  /** Called when an item is added */
  onAddItem?: (category: string) => void
  /** Called when an item is updated */
  onUpdateItem?: (itemId: string, updates: { itemName?: string; priority?: IRLPriority; status?: IRLItemStatus }) => void
  /** Called when an item is deleted */
  onDeleteItem?: (itemId: string) => void
  /** Whether the category is initially expanded */
  defaultOpen?: boolean
  /** Whether saving is in progress */
  isSaving?: boolean
  /** Whether drag-and-drop is disabled */
  isDragDisabled?: boolean
  /** Additional class names */
  className?: string
}

export function IRLCategory({
  name,
  items,
  progress,
  onRename,
  onDelete,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  defaultOpen = true,
  isSaving = false,
  isDragDisabled = false,
  className,
}: IRLCategoryProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  // Droppable for receiving items from other categories
  const { setNodeRef, isOver } = useDroppable({
    id: `category-${name}`,
    data: { category: name },
  })

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  // Reset edit value when name changes
  useEffect(() => {
    setEditValue(name)
  }, [name])

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
    setEditValue(name)
  }

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== name) {
      onRename?.(name, editValue.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditValue(name)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleAddItem = (e: React.MouseEvent) => {
    e.stopPropagation()
    onAddItem?.(name)
    // Ensure category is open when adding
    setIsOpen(true)
  }

  const handleDelete = () => {
    onDelete?.(name)
  }

  const itemIds = items.map(item => item.id)

  return (
    <div
      className={cn(
        'border rounded-lg overflow-hidden',
        isOver && 'ring-2 ring-primary',
        className
      )}
      data-testid={`irl-category-${name.replace(/\s+/g, '-').toLowerCase()}`}
    >
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Category header */}
        <div className="flex items-center gap-2 p-3 bg-muted/50 border-b">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
              {isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </CollapsibleTrigger>

          {/* Category name (editable) */}
          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleSaveEdit}
                  className="h-7"
                  onClick={e => e.stopPropagation()}
                  data-testid="category-name-input"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={e => {
                    e.stopPropagation()
                    handleSaveEdit()
                  }}
                  aria-label="Save"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={e => {
                    e.stopPropagation()
                    handleCancelEdit()
                  }}
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <CollapsibleTrigger asChild>
                  <button className="text-left flex-1 truncate font-medium">
                    {name}
                  </button>
                </CollapsibleTrigger>
                {/* Category progress indicator - show fulfilled progress if available, otherwise item count */}
                {progress ? (
                  <IRLCategoryProgress
                    fulfilled={progress.fulfilled}
                    total={progress.total}
                    percentComplete={progress.percentComplete}
                    variant="bar"
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {items.length} item{items.length !== 1 ? 's' : ''}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-50 hover:opacity-100"
                  onClick={handleStartEdit}
                  aria-label="Edit category name"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1"
              onClick={handleAddItem}
              disabled={isSaving}
            >
              <Plus className="h-3 w-3" />
              <span className="hidden sm:inline text-xs">Add Item</span>
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  disabled={isSaving}
                  aria-label="Delete category"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Category</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete &ldquo;{name}&rdquo;? This will also delete
                    all {items.length} item{items.length !== 1 ? 's' : ''} in this category.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Category items */}
        <CollapsibleContent>
          <div ref={setNodeRef} className="p-2 space-y-2 min-h-[50px]">
            {items.length > 0 ? (
              <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
                {items.map(item => (
                  <IRLItem
                    key={item.id}
                    item={item}
                    onUpdate={onUpdateItem}
                    onDelete={onDeleteItem}
                    isSaving={isSaving}
                    isDragDisabled={isDragDisabled}
                  />
                ))}
              </SortableContext>
            ) : (
              <div className="flex items-center justify-center h-16 text-sm text-muted-foreground border-2 border-dashed rounded-md">
                No items yet. Click &ldquo;Add Item&rdquo; to get started.
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
