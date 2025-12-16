/**
 * Folder Tree Component
 * Hierarchical folder navigation for Data Room
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #1, #7)
 * Fix: TD-011.2 - Added drag-and-drop folder reordering with @dnd-kit
 */

'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
  GripVertical,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export interface FolderNode {
  id: string
  name: string
  path: string
  children: FolderNode[]
  documentCount?: number
  sortOrder?: number
}

interface FolderTreeProps {
  projectId: string
  folders: FolderNode[]
  selectedPath: string | null
  onSelectFolder: (path: string | null) => void
  onCreateFolder: (parentPath: string | null) => void
  onRenameFolder: (path: string) => void
  onDeleteFolder: (path: string) => void
  onDropDocument?: (documentId: string, targetPath: string | null) => void
  onReorderFolders?: (folders: Array<{ id: string; sort_order: number }>) => void
}

const STORAGE_KEY_PREFIX = 'manda-folder-expand-'

export function FolderTree({
  projectId,
  folders,
  selectedPath,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDropDocument,
  onReorderFolders,
}: FolderTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)
  const [localFolders, setLocalFolders] = useState<FolderNode[]>(folders)

  // Sync local folders with prop
  useEffect(() => {
    setLocalFolders(folders)
  }, [folders])

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before starting drag
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Get folder IDs for sortable context (root level only for now)
  const folderIds = useMemo(() => localFolders.map(f => f.id), [localFolders])

  // Load expand state from localStorage (AC #7)
  useEffect(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`
    const saved = localStorage.getItem(storageKey)
    if (saved) {
      try {
        const paths = JSON.parse(saved) as string[]
        setExpandedPaths(new Set(paths))
      } catch {
        // Invalid JSON, ignore
      }
    }
  }, [projectId])

  // Save expand state to localStorage (AC #7)
  useEffect(() => {
    const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`
    localStorage.setItem(storageKey, JSON.stringify([...expandedPaths]))
  }, [expandedPaths, projectId])

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, path: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPath(path)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverPath(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent, targetPath: string | null) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOverPath(null)

    const documentId = e.dataTransfer.getData('application/document-id')
    if (documentId && onDropDocument) {
      onDropDocument(documentId, targetPath)
    }
  }, [onDropDocument])

  // Handle folder reorder via drag-and-drop
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setLocalFolders((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)

        const newItems = arrayMove(items, oldIndex, newIndex)

        // Build reorder payload with new sort_order values
        if (onReorderFolders) {
          const reorderPayload = newItems.map((folder, index) => ({
            id: folder.id,
            sort_order: index,
          }))
          onReorderFolders(reorderPayload)
        }

        return newItems
      })
    }
  }, [onReorderFolders])

  return (
    <div className="flex h-full flex-col bg-muted/20" data-testid="folder-tree">
      {/* Header with New Folder button */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background">
        <span className="text-sm font-semibold font-heading">Folders</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
          onClick={() => onCreateFolder(null)}
          title="New Folder"
          data-testid="create-folder-button"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Root folder (All Documents) */}
      <div
        className={cn(
          'flex cursor-pointer items-center gap-2.5 px-4 py-2.5 mx-2 my-1 rounded-lg smooth-transition',
          'hover:bg-accent',
          selectedPath === null && 'bg-primary/10 text-primary font-medium',
          dragOverPath === '' && 'ring-2 ring-primary ring-inset'
        )}
        onClick={() => onSelectFolder(null)}
        onDragOver={(e) => handleDragOver(e, '')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <Folder className={cn(
          "h-4 w-4 smooth-transition",
          selectedPath === null ? "text-primary" : "text-muted-foreground"
        )} />
        <span className="text-sm">All Documents</span>
      </div>

      {/* Folder tree with drag-and-drop reordering */}
      <div className="flex-1 overflow-auto custom-scrollbar px-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={folderIds} strategy={verticalListSortingStrategy}>
            {localFolders.map((folder) => (
              <SortableFolderTreeNode
                key={folder.id}
                folder={folder}
                level={0}
                selectedPath={selectedPath}
                expandedPaths={expandedPaths}
                dragOverPath={dragOverPath}
                onSelect={onSelectFolder}
                onToggleExpand={toggleExpand}
                onCreateFolder={onCreateFolder}
                onRenameFolder={onRenameFolder}
                onDeleteFolder={onDeleteFolder}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}

interface FolderTreeNodeProps {
  folder: FolderNode
  level: number
  selectedPath: string | null
  expandedPaths: Set<string>
  dragOverPath: string | null
  onSelect: (path: string | null) => void
  onToggleExpand: (path: string) => void
  onCreateFolder: (parentPath: string | null) => void
  onRenameFolder: (path: string) => void
  onDeleteFolder: (path: string) => void
  onDragOver: (e: React.DragEvent, path: string | null) => void
  onDragLeave: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, targetPath: string | null) => void
}

/**
 * Sortable wrapper for FolderTreeNode (TD-011.2)
 * Enables drag-and-drop reordering at root level
 */
function SortableFolderTreeNode(props: FolderTreeNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.folder.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const { folder, level, selectedPath, expandedPaths, dragOverPath, onSelect, onToggleExpand, onCreateFolder, onRenameFolder, onDeleteFolder, onDragOver, onDragLeave, onDrop } = props
  const hasChildren = folder.children.length > 0
  const isExpanded = expandedPaths.has(folder.path)
  const isSelected = selectedPath === folder.path
  const isDragOverFolder = dragOverPath === folder.path

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 py-2 px-2 my-0.5 rounded-lg smooth-transition',
          'hover:bg-accent',
          isSelected && 'bg-primary/10 text-primary font-medium',
          isDragOverFolder && 'ring-2 ring-primary ring-inset',
          isDragging && 'z-50'
        )}
        style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        onClick={() => onSelect(folder.path)}
        onDragOver={(e) => onDragOver(e, folder.path)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, folder.path)}
      >
        {/* Drag handle (only at root level) */}
        {level === 0 && (
          <button
            className="flex h-5 w-5 items-center justify-center rounded cursor-grab active:cursor-grabbing hover:bg-primary/10 smooth-transition touch-none"
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

        {/* Expand/collapse toggle */}
        <button
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded hover:bg-primary/10 smooth-transition',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(folder.path)
          }}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          )}
        </button>

        {/* Folder icon */}
        {isExpanded && hasChildren ? (
          <FolderOpen className={cn(
            "h-4 w-4 smooth-transition",
            isSelected ? "text-primary" : "text-muted-foreground"
          )} />
        ) : (
          <Folder className={cn(
            "h-4 w-4 smooth-transition",
            isSelected ? "text-primary" : "text-muted-foreground"
          )} />
        )}

        {/* Folder name */}
        <span className="flex-1 truncate text-sm">{folder.name}</span>

        {/* Document count badge */}
        {folder.documentCount !== undefined && folder.documentCount > 0 && (
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded-full smooth-transition",
            isSelected
              ? "bg-primary/20 text-primary font-medium"
              : "bg-muted text-muted-foreground"
          )}>
            {folder.documentCount}
          </span>
        )}

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="invisible flex h-5 w-5 items-center justify-center rounded hover:bg-muted group-hover:visible"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onCreateFolder(folder.path)}>
              <Plus className="mr-2 h-4 w-4" />
              New Subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRenameFolder(folder.path)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteFolder(folder.path)}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children (not sortable - uses original FolderTreeNode) */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              dragOverPath={dragOverPath}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function FolderTreeNode({
  folder,
  level,
  selectedPath,
  expandedPaths,
  dragOverPath,
  onSelect,
  onToggleExpand,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onDragOver,
  onDragLeave,
  onDrop,
}: FolderTreeNodeProps) {
  const hasChildren = folder.children.length > 0
  const isExpanded = expandedPaths.has(folder.path)
  const isSelected = selectedPath === folder.path
  const isDragOver = dragOverPath === folder.path

  return (
    <div>
      <div
        className={cn(
          'group flex cursor-pointer items-center gap-1.5 py-2 px-2 my-0.5 rounded-lg smooth-transition',
          'hover:bg-accent',
          isSelected && 'bg-primary/10 text-primary font-medium',
          isDragOver && 'ring-2 ring-primary ring-inset'
        )}
        style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
        onClick={() => onSelect(folder.path)}
        onDragOver={(e) => onDragOver(e, folder.path)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, folder.path)}
      >
        {/* Expand/collapse toggle */}
        <button
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded hover:bg-primary/10 smooth-transition',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(folder.path)
          }}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )
          )}
        </button>

        {/* Folder icon */}
        {isExpanded && hasChildren ? (
          <FolderOpen className={cn(
            "h-4 w-4 smooth-transition",
            isSelected ? "text-primary" : "text-muted-foreground"
          )} />
        ) : (
          <Folder className={cn(
            "h-4 w-4 smooth-transition",
            isSelected ? "text-primary" : "text-muted-foreground"
          )} />
        )}

        {/* Folder name */}
        <span className="flex-1 truncate text-sm">{folder.name}</span>

        {/* Document count badge */}
        {folder.documentCount !== undefined && folder.documentCount > 0 && (
          <span className={cn(
            "text-xs px-1.5 py-0.5 rounded-full smooth-transition",
            isSelected 
              ? "bg-primary/20 text-primary font-medium" 
              : "bg-muted text-muted-foreground"
          )}>
            {folder.documentCount}
          </span>
        )}

        {/* Context menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="invisible flex h-5 w-5 items-center justify-center rounded hover:bg-muted group-hover:visible"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => onCreateFolder(folder.path)}>
              <Plus className="mr-2 h-4 w-4" />
              New Subfolder
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRenameFolder(folder.path)}>
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteFolder(folder.path)}
              className="text-destructive focus:text-destructive"
            >
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              dragOverPath={dragOverPath}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDeleteFolder={onDeleteFolder}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Build folder tree from flat list of folder paths
 */
export function buildFolderTree(paths: string[]): FolderNode[] {
  const root: FolderNode[] = []
  const pathMap = new Map<string, FolderNode>()

  // Sort paths to ensure parents are processed before children
  const sortedPaths = [...new Set(paths)].sort()

  for (const path of sortedPaths) {
    const parts = path.split('/')
    let currentPath = ''
    let parent: FolderNode[] = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (!part) continue

      currentPath = currentPath ? `${currentPath}/${part}` : part

      let node = pathMap.get(currentPath)
      if (!node) {
        node = {
          id: currentPath,
          name: part,
          path: currentPath,
          children: [],
        }
        pathMap.set(currentPath, node)
        parent.push(node)
      }
      parent = node.children
    }
  }

  return root
}
