'use client'

/**
 * IRL Builder Component
 *
 * Main component for viewing and editing an IRL with drag-and-drop.
 * Story: E6.2 - Implement IRL Creation and Editing
 *
 * Features:
 * - Display IRL title and progress
 * - Add/edit/delete categories and items
 * - Drag-and-drop reordering within and across categories
 * - Optimistic updates with loading states
 */

import { useState, useCallback } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Plus, Loader2, Pencil, Check, X, AlertCircle, FolderPlus, CheckCircle2 } from 'lucide-react'
import { IRLCategory } from './IRLCategory'
import { IRLItem } from './IRLItem'
import { useIRLBuilder } from './useIRLBuilder'
import { IRLItem as IRLItemType, getStatusInfo } from '@/lib/types/irl'
import { generateFoldersFromIRL, FolderGenerationResult } from '@/lib/api/irl'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export interface IRLBuilderProps {
  /** Project ID */
  projectId: string
  /** IRL ID to load and edit */
  irlId: string
  /** Called when there's an error */
  onError?: (error: string) => void
  /** Additional class names */
  className?: string
}

export function IRLBuilder({
  projectId,
  irlId,
  onError,
  className,
}: IRLBuilderProps) {
  const {
    irl,
    items,
    itemsByCategory,
    categories,
    progress,
    isLoading,
    isSaving,
    error,
    updateTitle,
    addCategory,
    renameCategory,
    deleteCategory,
    addItem,
    updateItem,
    deleteItem,
    reorderItems,
  } = useIRLBuilder({ projectId, irlId, onError })

  // Local state for UI
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState('')
  const [newCategoryDialogOpen, setNewCategoryDialogOpen] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newItemDialogOpen, setNewItemDialogOpen] = useState(false)
  const [newItemCategory, setNewItemCategory] = useState('')
  const [newItemName, setNewItemName] = useState('')
  const [activeId, setActiveId] = useState<string | null>(null)

  // Folder generation state
  const [isGeneratingFolders, setIsGeneratingFolders] = useState(false)
  const [folderResult, setFolderResult] = useState<FolderGenerationResult | null>(null)
  const [folderDialogOpen, setFolderDialogOpen] = useState(false)

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Find the active item for the overlay
  const activeItem = activeId ? items.find(item => item.id === activeId) : null

  // DnD handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }, [])

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Handle cross-category drags here if needed
    // The droppable areas are set up in IRLCategory
  }, [])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    // If dropping on a category droppable
    if (typeof overId === 'string' && overId.startsWith('category-')) {
      const targetCategory = overId.replace('category-', '')
      const activeItem = items.find(item => item.id === activeId)

      if (activeItem && activeItem.category !== targetCategory) {
        // Move to new category at the end
        const targetItems = itemsByCategory[targetCategory] || []
        const newSortOrder = targetItems.length > 0
          ? Math.max(...targetItems.map(i => i.sortOrder)) + 1
          : 0

        await reorderItems([{ id: activeId, sortOrder: newSortOrder, category: targetCategory }])
      }
      return
    }

    // If dropping on another item
    const activeItem = items.find(item => item.id === activeId)
    const overItem = items.find(item => item.id === overId)

    if (!activeItem || !overItem) return

    // Same category reorder
    if (activeItem.category === overItem.category) {
      const categoryItems = itemsByCategory[activeItem.category] || []
      const oldIndex = categoryItems.findIndex(i => i.id === activeId)
      const newIndex = categoryItems.findIndex(i => i.id === overId)

      if (oldIndex !== newIndex) {
        const reordered = arrayMove(categoryItems, oldIndex, newIndex)
        const updates = reordered.map((item, index) => ({
          id: item.id,
          sortOrder: index,
        }))
        await reorderItems(updates)
      }
    } else {
      // Cross-category drop
      const targetCategory = overItem.category
      const targetItems = itemsByCategory[targetCategory] || []
      const overIndex = targetItems.findIndex(i => i.id === overId)

      await reorderItems([{
        id: activeId,
        sortOrder: overIndex,
        category: targetCategory,
      }])
    }
  }, [items, itemsByCategory, reorderItems])

  // Title editing
  const handleStartEditTitle = () => {
    setTitleValue(irl?.title || '')
    setIsEditingTitle(true)
  }

  const handleSaveTitle = async () => {
    if (titleValue.trim()) {
      await updateTitle(titleValue.trim())
    }
    setIsEditingTitle(false)
  }

  const handleCancelTitle = () => {
    setTitleValue('')
    setIsEditingTitle(false)
  }

  // Add category
  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      await addCategory(newCategoryName.trim())
      setNewCategoryName('')
      setNewCategoryDialogOpen(false)
    }
  }

  // Add item
  const handleOpenAddItem = (category: string) => {
    setNewItemCategory(category)
    setNewItemName('')
    setNewItemDialogOpen(true)
  }

  const handleAddItem = async () => {
    if (newItemName.trim() && newItemCategory) {
      await addItem(newItemCategory, {
        itemName: newItemName.trim(),
        priority: 'medium',
      })
      setNewItemName('')
      setNewItemDialogOpen(false)
    }
  }

  // Generate folders from IRL
  const handleGenerateFolders = async () => {
    if (!irlId || categories.length === 0) return

    setIsGeneratingFolders(true)
    setFolderResult(null)

    try {
      const { result, error: folderError } = await generateFoldersFromIRL(projectId, irlId)

      if (folderError) {
        onError?.(folderError)
        return
      }

      if (result) {
        setFolderResult(result)
        setFolderDialogOpen(true)
      }
    } finally {
      setIsGeneratingFolders(false)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <Card className={cn('w-full', className)}>
        <CardHeader>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Error state
  if (error && !irl) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!irl) {
    return null
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <Card className={cn('w-full', className)}>
        <CardHeader>
          {/* Title */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {isEditingTitle ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={titleValue}
                    onChange={e => setTitleValue(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSaveTitle()
                      if (e.key === 'Escape') handleCancelTitle()
                    }}
                    className="text-xl font-semibold"
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" onClick={handleSaveTitle}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={handleCancelTitle}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <CardTitle className="text-xl">{irl.title}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-50"
                    onClick={handleStartEditTitle}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <CardDescription className="mt-1">
                {categories.length} categories, {items.length} items
                {irl.templateType && ` • Template: ${irl.templateType}`}
              </CardDescription>
            </div>

            <div className="flex items-center gap-4">
              {/* Generate Folders Button */}
              {categories.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateFolders}
                      disabled={isGeneratingFolders || isSaving}
                    >
                      {isGeneratingFolders ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <FolderPlus className="h-4 w-4 mr-2" />
                      )}
                      Generate Folders
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Create Data Room folders from IRL categories</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Progress */}
              {progress && (
                <div className="w-32 text-right">
                  <div className="text-sm font-medium mb-1">
                    {progress.complete}/{progress.total} Complete
                  </div>
                  <Progress value={progress.percentComplete} className="h-2" />
                </div>
              )}
            </div>
          </div>

          {/* Error banner */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status legend */}
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground pb-2 border-b">
            {(['not_started', 'pending', 'received', 'complete'] as const).map(status => {
              const info = getStatusInfo(status)
              const count = items.filter(i => i.status === status).length
              return (
                <div key={status} className="flex items-center gap-1">
                  <span className={info.color}>{info.icon}</span>
                  <span>{info.label}</span>
                  <span className="text-muted-foreground/60">({count})</span>
                </div>
              )
            })}
          </div>

          {/* Categories */}
          <div className="space-y-4">
            {categories.map(category => (
              <IRLCategory
                key={category}
                name={category}
                items={itemsByCategory[category] || []}
                onRename={renameCategory}
                onDelete={deleteCategory}
                onAddItem={handleOpenAddItem}
                onUpdateItem={updateItem}
                onDeleteItem={deleteItem}
                isSaving={isSaving}
                isDragDisabled={false}
              />
            ))}
          </div>

          {/* Empty state */}
          {categories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground mb-4">
                No categories yet. Add a category to get started.
              </p>
              <Button onClick={() => setNewCategoryDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Category
              </Button>
            </div>
          )}

          {/* Add category button */}
          {categories.length > 0 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setNewCategoryDialogOpen(true)}
              disabled={isSaving}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          )}

          {/* Saving indicator */}
          {isSaving && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Drag overlay */}
      <DragOverlay>
        {activeItem && (
          <div className="opacity-80">
            <IRLItem
              item={activeItem}
              isDragDisabled
              className="shadow-lg"
            />
          </div>
        )}
      </DragOverlay>

      {/* New Category Dialog */}
      <Dialog open={newCategoryDialogOpen} onOpenChange={setNewCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Category</DialogTitle>
            <DialogDescription>
              Enter a name for the new category.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddCategory()
            }}
            placeholder="e.g., Financial Documents"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewCategoryDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddCategory} disabled={!newCategoryName.trim()}>
              Add Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Item Dialog */}
      <Dialog open={newItemDialogOpen} onOpenChange={setNewItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Item</DialogTitle>
            <DialogDescription>
              Add a new item to &ldquo;{newItemCategory}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newItemName}
            onChange={e => setNewItemName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAddItem()
            }}
            placeholder="e.g., Audited Financial Statements"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewItemDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddItem} disabled={!newItemName.trim()}>
              Add Item
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Generation Result Dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={setFolderDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Data Room Folders Generated
            </DialogTitle>
            <DialogDescription>
              Folder structure created from IRL categories.
            </DialogDescription>
          </DialogHeader>

          {folderResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-green-600">{folderResult.created}</span>
                  <span className="text-muted-foreground">created</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-yellow-600">{folderResult.skipped}</span>
                  <span className="text-muted-foreground">already existed</span>
                </div>
              </div>

              {/* Folder tree preview */}
              {folderResult.tree.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 max-h-64 overflow-auto">
                  <div className="text-sm font-medium mb-2">Folder Structure:</div>
                  <div className="space-y-1">
                    {folderResult.tree.map(node => (
                      <div key={node.id}>
                        <div className="flex items-center gap-2 text-sm">
                          <FolderPlus className="h-4 w-4 text-muted-foreground" />
                          <span>{node.name}</span>
                        </div>
                        {Array.isArray(node.children) && node.children.length > 0 && (
                          <div className="ml-6 mt-1 space-y-1">
                            {(node.children as Array<{ id: string; name: string }>).map(child => (
                              <div key={child.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <FolderPlus className="h-3 w-3" />
                                <span>{child.name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {folderResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside">
                      {folderResult.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setFolderDialogOpen(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DndContext>
  )
}
