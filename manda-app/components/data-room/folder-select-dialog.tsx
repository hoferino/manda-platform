/**
 * Folder Select Dialog Component
 * Allows selecting a folder to move a document to
 * Story: E2.5 - Create Document Metadata Management (AC: #5)
 *
 * Features:
 * - Tree view of available folders
 * - Select any folder or root
 * - Visual indication of current folder
 * - Confirm/cancel actions
 */

'use client'

import { useState, useCallback } from 'react'
import {
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  Home,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { FolderNode } from './folder-tree'

export interface FolderSelectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: FolderNode[]
  currentPath: string | null
  documentName: string
  onSelect: (path: string | null) => void
  isLoading?: boolean
}

/**
 * Folder tree item for selection
 */
function FolderTreeItem({
  folder,
  level = 0,
  selectedPath,
  currentPath,
  onSelect,
}: {
  folder: FolderNode
  level?: number
  selectedPath: string | null
  currentPath: string | null
  onSelect: (path: string | null) => void
}) {
  const [isExpanded, setIsExpanded] = useState(true)
  const hasChildren = folder.children.length > 0
  const isSelected = selectedPath === folder.path
  const isCurrent = currentPath === folder.path

  return (
    <div>
      <div
        className={cn(
          'flex items-center gap-1 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted',
          isSelected && 'bg-primary/10 text-primary',
          isCurrent && !isSelected && 'text-muted-foreground'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={() => onSelect(folder.path)}
      >
        {/* Expand/collapse button */}
        {hasChildren ? (
          <button
            type="button"
            className="h-4 w-4 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Folder icon */}
        {isExpanded && hasChildren ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
        )}

        {/* Folder name */}
        <span className="truncate text-sm">{folder.name}</span>

        {/* Current indicator */}
        {isCurrent && (
          <span className="ml-auto text-xs text-muted-foreground">(current)</span>
        )}
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderTreeItem
              key={child.id}
              folder={child}
              level={level + 1}
              selectedPath={selectedPath}
              currentPath={currentPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Folder Select Dialog
 */
export function FolderSelectDialog({
  open,
  onOpenChange,
  folders,
  currentPath,
  documentName,
  onSelect,
  isLoading = false,
}: FolderSelectDialogProps) {
  const [selectedPath, setSelectedPath] = useState<string | null>(currentPath)

  // Reset selection when dialog opens
  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (newOpen) {
        setSelectedPath(currentPath)
      }
      onOpenChange(newOpen)
    },
    [currentPath, onOpenChange]
  )

  const handleConfirm = useCallback(() => {
    onSelect(selectedPath)
    onOpenChange(false)
  }, [selectedPath, onSelect, onOpenChange])

  const isRootSelected = selectedPath === null
  const hasChanges = selectedPath !== currentPath

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Move to Folder</DialogTitle>
          <DialogDescription>
            Select a destination folder for &quot;{documentName}&quot;
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[300px] rounded-md border p-2">
          {/* Root folder option */}
          <div
            className={cn(
              'flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer hover:bg-muted',
              isRootSelected && 'bg-primary/10 text-primary',
              currentPath === null && !isRootSelected && 'text-muted-foreground'
            )}
            onClick={() => setSelectedPath(null)}
          >
            <Home className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
            <span className="text-sm font-medium">Root (No folder)</span>
            {currentPath === null && (
              <span className="ml-auto text-xs text-muted-foreground">(current)</span>
            )}
          </div>

          {/* Folder tree */}
          {folders.length > 0 ? (
            <div className="mt-1">
              {folders.map((folder) => (
                <FolderTreeItem
                  key={folder.id}
                  folder={folder}
                  selectedPath={selectedPath}
                  currentPath={currentPath}
                  onSelect={setSelectedPath}
                />
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center h-20 text-sm text-muted-foreground">
              No folders available
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || !hasChanges}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Move Here
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
