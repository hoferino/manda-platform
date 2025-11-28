/**
 * Folder Tree Component
 * Hierarchical folder navigation for Data Room
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #1, #7)
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Plus,
  MoreVertical,
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
}: FolderTreeProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [dragOverPath, setDragOverPath] = useState<string | null>(null)

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

  return (
    <div className="flex h-full flex-col" data-testid="folder-tree">
      {/* Header with New Folder button */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Folders</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
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
          'flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-muted/50',
          selectedPath === null && 'bg-muted',
          dragOverPath === '' && 'ring-2 ring-primary ring-inset'
        )}
        onClick={() => onSelectFolder(null)}
        onDragOver={(e) => handleDragOver(e, '')}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, null)}
      >
        <Folder className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm">All Documents</span>
      </div>

      {/* Folder tree */}
      <div className="flex-1 overflow-auto">
        {folders.map((folder) => (
          <FolderTreeNode
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
          'group flex cursor-pointer items-center gap-1 py-1.5 pr-2 hover:bg-muted/50',
          isSelected && 'bg-muted',
          isDragOver && 'ring-2 ring-primary ring-inset'
        )}
        style={{ paddingLeft: `${(level + 1) * 12 + 8}px` }}
        onClick={() => onSelect(folder.path)}
        onDragOver={(e) => onDragOver(e, folder.path)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, folder.path)}
      >
        {/* Expand/collapse toggle */}
        <button
          className={cn(
            'flex h-5 w-5 items-center justify-center rounded hover:bg-muted',
            !hasChildren && 'invisible'
          )}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(folder.path)
          }}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          )}
        </button>

        {/* Folder icon */}
        {isExpanded && hasChildren ? (
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 text-muted-foreground" />
        )}

        {/* Folder name */}
        <span className="flex-1 truncate text-sm">{folder.name}</span>

        {/* Document count badge */}
        {folder.documentCount !== undefined && folder.documentCount > 0 && (
          <span className="text-xs text-muted-foreground">
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
