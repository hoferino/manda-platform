/**
 * Data Room Client Component
 * Manages state for folder tree, document list, and CRUD operations
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #1-8)
 * Story: E2.5 - Create Document Metadata Management (enhanced with details panel)
 * Story: E2.7 - Build Upload Progress Indicators (integrated upload panel)
 * Story: E3.6 - Processing Status Tracking and WebSocket Updates (AC: #2, #4)
 * Story: E3.7 - Implement Processing Queue Visibility (AC: #1, #5, #6)
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  FolderTree,
  DocumentList,
  Breadcrumb,
  CreateFolderDialog,
  DeleteFolderDialog,
  RenameFolderDialog,
  DocumentDetails,
  FolderSelectDialog,
  DeleteConfirmDialog,
  UploadButton,
  ProcessingQueue,
  buildFolderTree,
  type FolderNode,
} from '@/components/data-room'
import type { Document } from '@/lib/api/documents'
import type { DocumentCategory } from '@/lib/gcs/client'
import {
  updateDocument,
  deleteDocument,
  downloadDocument,
} from '@/lib/api/documents'
import {
  getFolders,
  createFolder as createFolderApi,
  renameFolder as renameFolderApi,
  deleteFolder as deleteFolderApi,
  type Folder,
} from '@/lib/api/folders'
import { createClient } from '@/lib/supabase/client'
import {
  useDocumentUpdates,
  didProcessingComplete,
  didProcessingFail,
  type DocumentUpdate,
} from '@/lib/hooks'

interface DataRoomClientProps {
  projectId: string
  /** Selected folder path (for context preservation from parent) */
  selectedPath?: string | null
  /** Callback when folder selection changes (for context preservation) */
  onFolderSelect?: (path: string | null) => void
}

export function DataRoomClient({
  projectId,
  selectedPath: externalSelectedPath,
  onFolderSelect,
}: DataRoomClientProps) {
  // Use internal state if no external control provided
  const [internalSelectedPath, setInternalSelectedPath] = useState<string | null>(null)

  // Determine which path to use - external (controlled) or internal (uncontrolled)
  const selectedPath = externalSelectedPath !== undefined ? externalSelectedPath : internalSelectedPath

  // Handle path changes - notify parent if callback provided
  const setSelectedPath = (path: string | null) => {
    if (onFolderSelect) {
      onFolderSelect(path)
    }
    setInternalSelectedPath(path)
  }
  const [documents, setDocuments] = useState<Document[]>([])
  const [allDocuments, setAllDocuments] = useState<Document[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [dbFolders, setDbFolders] = useState<Folder[]>([]) // Folders from database
  const [isLoading, setIsLoading] = useState(true)

  // Dialog states
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [createFolderParent, setCreateFolderParent] = useState<string | null>(null)
  const [renameFolderOpen, setRenameFolderOpen] = useState(false)
  const [renameFolderPath, setRenameFolderPath] = useState<string>('')
  const [deleteFolderOpen, setDeleteFolderOpen] = useState(false)
  const [deleteFolderPath, setDeleteFolderPath] = useState<string>('')
  const [deleteFolderDocCount, setDeleteFolderDocCount] = useState(0)

  // E2.5: Document details and folder select states
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [folderSelectOpen, setFolderSelectOpen] = useState(false)
  const [folderSelectDocument, setFolderSelectDocument] = useState<Document | null>(null)
  const [isFolderSelectLoading, setIsFolderSelectLoading] = useState(false)

  // E2.6: Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null)

  // E3.6: Handle realtime document updates
  const handleRealtimeUpdate = useCallback(
    (update: DocumentUpdate) => {
      if (update.type === 'INSERT') {
        // Add new document to the list
        setAllDocuments((prev) => {
          // Check if already exists (avoid duplicates)
          if (prev.some((d) => d.id === update.document.id)) {
            return prev
          }
          return [update.document, ...prev]
        })
      } else if (update.type === 'UPDATE') {
        // Update existing document
        setAllDocuments((prev) =>
          prev.map((d) => (d.id === update.document.id ? update.document : d))
        )
        // Update selected document if it's the one being updated
        if (selectedDocument?.id === update.document.id) {
          setSelectedDocument(update.document)
        }

        // Show toast notifications for processing status changes (AC: #4)
        if (didProcessingComplete(update.oldDocument, update.document)) {
          toast.success(`Document "${update.document.name}" processed successfully`, {
            action: {
              label: 'View',
              onClick: () => {
                setSelectedDocument(update.document)
                setDetailsOpen(true)
              },
            },
          })
        } else if (didProcessingFail(update.oldDocument, update.document)) {
          toast.error(`Document "${update.document.name}" processing failed`, {
            action: {
              label: 'View',
              onClick: () => {
                setSelectedDocument(update.document)
                setDetailsOpen(true)
              },
            },
          })
        }
      } else if (update.type === 'DELETE') {
        // Remove document from list
        setAllDocuments((prev) => prev.filter((d) => d.id !== update.document.id))
        // Close details panel if deleted document was selected
        if (selectedDocument?.id === update.document.id) {
          setDetailsOpen(false)
          setSelectedDocument(null)
        }
      }
    },
    [selectedDocument]
  )

  // E3.6: Subscribe to realtime updates
  const { status: realtimeStatus, reconnect: reconnectRealtime } = useDocumentUpdates(
    projectId,
    {
      onUpdate: handleRealtimeUpdate,
      onConnectionChange: (status) => {
        if (status === 'error') {
          toast.error('Realtime connection lost', {
            action: {
              label: 'Reconnect',
              onClick: reconnectRealtime,
            },
          })
        }
      },
    }
  )

  // Load documents and folders from Supabase
  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()

      // Load documents and folders in parallel
      const [documentsResult, foldersResult] = await Promise.all([
        supabase
          .from('documents')
          .select('*')
          .eq('deal_id', projectId)
          .order('created_at', { ascending: false }),
        getFolders(projectId),
      ])

      if (documentsResult.error) {
        console.error('Error loading documents:', documentsResult.error)
        toast.error('Failed to load documents')
        return
      }

      // Transform to Document type
      // E3.6: Map all processing status fields including error and findings count
      // Note: processing_error and findings_count may not exist in schema yet
      const docs: Document[] = (documentsResult.data || []).map((doc) => ({
        id: doc.id,
        projectId: doc.deal_id,
        name: doc.name,
        size: doc.file_size,
        mimeType: doc.mime_type,
        category: (doc.category as DocumentCategory) || null,
        folderPath: doc.folder_path || null,
        uploadStatus: doc.upload_status as Document['uploadStatus'],
        processingStatus: doc.processing_status as Document['processingStatus'],
        processingError: (doc as Record<string, unknown>).processing_error as string | null || null,
        findingsCount: (doc as Record<string, unknown>).findings_count as number | null || null,
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))

      setAllDocuments(docs)

      // Store database folders
      if (foldersResult.folders) {
        setDbFolders(foldersResult.folders)
      }

      // Merge folder paths from documents AND from database
      const docFolderPaths = docs
        .map((d) => d.folderPath)
        .filter((p): p is string => p !== null)
      const dbFolderPaths = foldersResult.folders.map((f) => f.path)

      // Combine unique paths
      const allFolderPaths = [...new Set([...docFolderPaths, ...dbFolderPaths])]
      const tree = buildFolderTree(allFolderPaths)

      // Add document counts to folders
      addDocumentCounts(tree, docs)
      setFolders(tree)
    } catch (error) {
      console.error('Error loading documents:', error)
      toast.error('Failed to load documents')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // Filter documents by selected folder
  useEffect(() => {
    if (selectedPath === null) {
      // Show all documents at root level (no folder) or all documents
      setDocuments(allDocuments)
    } else {
      // Show documents in selected folder and subfolders
      setDocuments(
        allDocuments.filter(
          (d) =>
            d.folderPath === selectedPath ||
            d.folderPath?.startsWith(`${selectedPath}/`)
        )
      )
    }
  }, [selectedPath, allDocuments])

  // Handle folder selection
  const handleSelectFolder = useCallback((path: string | null) => {
    setSelectedPath(path)
  }, [])

  // Handle create folder
  const handleCreateFolder = useCallback((parentPath: string | null) => {
    setCreateFolderParent(parentPath)
    setCreateFolderOpen(true)
  }, [])

  const handleCreateFolderConfirm = useCallback(
    async (name: string) => {
      try {
        // Create folder in database via API
        const result = await createFolderApi(projectId, name, createFolderParent)

        if (result.error || !result.folder) {
          toast.error(result.error || 'Failed to create folder')
          return
        }

        const newPath = result.folder.path

        // Add to database folders list
        setDbFolders((prev) => [...prev, result.folder!])

        // Update the folder tree
        setFolders((prev) => {
          const newNode: FolderNode = {
            id: newPath,
            name,
            path: newPath,
            children: [],
            documentCount: 0,
          }

          if (!createFolderParent) {
            // Add to root
            return [...prev, newNode].sort((a, b) => a.name.localeCompare(b.name))
          }

          // Add to parent folder
          const addToParent = (nodes: FolderNode[]): FolderNode[] => {
            return nodes.map((node) => {
              if (node.path === createFolderParent) {
                return {
                  ...node,
                  children: [...node.children, newNode].sort((a, b) =>
                    a.name.localeCompare(b.name)
                  ),
                }
              }
              if (node.children.length > 0) {
                return { ...node, children: addToParent(node.children) }
              }
              return node
            })
          }
          return addToParent(prev)
        })

        setCreateFolderOpen(false)
        toast.success(`Created folder "${name}"`)
      } catch (error) {
        console.error('Error creating folder:', error)
        toast.error('Failed to create folder')
      }
    },
    [projectId, createFolderParent]
  )

  // Handle rename folder
  const handleRenameFolder = useCallback((path: string) => {
    setRenameFolderPath(path)
    setRenameFolderOpen(true)
  }, [])

  const handleRenameFolderConfirm = useCallback(
    async (newName: string) => {
      const oldPath = renameFolderPath
      const parts = oldPath.split('/')
      parts[parts.length - 1] = newName
      const newPath = parts.join('/')

      // Find the folder in database
      const dbFolder = dbFolders.find((f) => f.path === oldPath)

      try {
        // Update folder in database if it exists
        if (dbFolder) {
          const result = await renameFolderApi(projectId, dbFolder.id, newName)
          if (result.error) {
            toast.error(result.error)
            return
          }
          // Update dbFolders state
          setDbFolders((prev) =>
            prev.map((f) => {
              if (f.path === oldPath) {
                return { ...f, name: newName, path: newPath }
              }
              if (f.path.startsWith(`${oldPath}/`)) {
                return {
                  ...f,
                  path: f.path.replace(oldPath, newPath),
                  parentPath: f.parentPath?.replace(oldPath, newPath) || null,
                }
              }
              return f
            })
          )
        }

        // Update all documents with old path prefix
        const docsToUpdate = allDocuments.filter(
          (d) =>
            d.folderPath === oldPath || d.folderPath?.startsWith(`${oldPath}/`)
        )

        // Update documents in database
        for (const doc of docsToUpdate) {
          const updatedPath = doc.folderPath!.replace(oldPath, newPath)
          const result = await updateDocument(doc.id, { folderPath: updatedPath })
          if (!result.success) {
            throw new Error(result.error || 'Failed to update document')
          }
        }

        // Update local state
        setAllDocuments((prev) =>
          prev.map((doc) => {
            if (
              doc.folderPath === oldPath ||
              doc.folderPath?.startsWith(`${oldPath}/`)
            ) {
              return {
                ...doc,
                folderPath: doc.folderPath!.replace(oldPath, newPath),
              }
            }
            return doc
          })
        )

        // Update folder tree
        const updateFolderPath = (nodes: FolderNode[]): FolderNode[] => {
          return nodes.map((node) => {
            if (node.path === oldPath) {
              return {
                ...node,
                name: newName,
                path: newPath,
                id: newPath,
                children: updateFolderPath(node.children),
              }
            }
            if (node.path.startsWith(`${oldPath}/`)) {
              const updatedPath = node.path.replace(oldPath, newPath)
              return {
                ...node,
                path: updatedPath,
                id: updatedPath,
                children: updateFolderPath(node.children),
              }
            }
            if (node.children.length > 0) {
              return { ...node, children: updateFolderPath(node.children) }
            }
            return node
          })
        }
        setFolders((prev) => updateFolderPath(prev))

        // Update selected path if it was renamed
        if (
          selectedPath === oldPath ||
          selectedPath?.startsWith(`${oldPath}/`)
        ) {
          setSelectedPath(selectedPath.replace(oldPath, newPath))
        }

        setRenameFolderOpen(false)
        toast.success(`Renamed to "${newName}"`)
      } catch (error) {
        console.error('Error renaming folder:', error)
        toast.error('Failed to rename folder')
      }
    },
    [projectId, renameFolderPath, allDocuments, dbFolders, selectedPath]
  )

  // Handle delete folder
  const handleDeleteFolder = useCallback(
    (path: string) => {
      const docCount = allDocuments.filter(
        (d) => d.folderPath === path || d.folderPath?.startsWith(`${path}/`)
      ).length
      setDeleteFolderPath(path)
      setDeleteFolderDocCount(docCount)
      setDeleteFolderOpen(true)
    },
    [allDocuments]
  )

  const handleDeleteFolderConfirm = useCallback(
    async (documentAction: 'move-to-root' | 'delete') => {
      const path = deleteFolderPath
      const docsInFolder = allDocuments.filter(
        (d) => d.folderPath === path || d.folderPath?.startsWith(`${path}/`)
      )

      // Find the folder in database
      const dbFolder = dbFolders.find((f) => f.path === path)

      try {
        if (documentAction === 'delete') {
          // Delete all documents in folder
          for (const doc of docsInFolder) {
            const result = await deleteDocument(doc.id)
            if (!result.success) {
              throw new Error(result.error || 'Failed to delete document')
            }
          }
          setAllDocuments((prev) =>
            prev.filter(
              (d) =>
                d.folderPath !== path && !d.folderPath?.startsWith(`${path}/`)
            )
          )
        } else {
          // Move documents to root
          for (const doc of docsInFolder) {
            const result = await updateDocument(doc.id, { folderPath: null })
            if (!result.success) {
              throw new Error(result.error || 'Failed to move document')
            }
          }
          setAllDocuments((prev) =>
            prev.map((doc) => {
              if (
                doc.folderPath === path ||
                doc.folderPath?.startsWith(`${path}/`)
              ) {
                return { ...doc, folderPath: null }
              }
              return doc
            })
          )
        }

        // Delete folder from database if it exists
        if (dbFolder) {
          const result = await deleteFolderApi(projectId, dbFolder.id)
          if (!result.success) {
            console.error('Failed to delete folder from database:', result.error)
            // Continue anyway - folder tree will be cleaned up
          }
          // Remove from dbFolders state
          setDbFolders((prev) =>
            prev.filter(
              (f) => f.path !== path && !f.path.startsWith(`${path}/`)
            )
          )
        }

        // Remove folder from tree
        const removeFolder = (nodes: FolderNode[]): FolderNode[] => {
          return nodes
            .filter((node) => node.path !== path)
            .map((node) => ({
              ...node,
              children: removeFolder(node.children),
            }))
        }
        setFolders((prev) => removeFolder(prev))

        // Clear selection if deleted folder was selected
        if (selectedPath === path || selectedPath?.startsWith(`${path}/`)) {
          setSelectedPath(null)
        }

        setDeleteFolderOpen(false)
        toast.success(
          documentAction === 'delete'
            ? 'Folder and documents deleted'
            : 'Folder deleted, documents moved to root'
        )
      } catch (error) {
        console.error('Error deleting folder:', error)
        toast.error('Failed to delete folder')
      }
    },
    [projectId, deleteFolderPath, allDocuments, dbFolders, selectedPath]
  )

  // Handle document drag-and-drop
  const handleDropDocument = useCallback(
    async (documentId: string, targetPath: string | null) => {
      const doc = allDocuments.find((d) => d.id === documentId)
      if (!doc || doc.folderPath === targetPath) return

      try {
        const result = await updateDocument(documentId, { folderPath: targetPath })
        if (!result.success) {
          throw new Error(result.error || 'Failed to move document')
        }

        // Update local state
        setAllDocuments((prev) =>
          prev.map((d) =>
            d.id === documentId ? { ...d, folderPath: targetPath } : d
          )
        )

        toast.success(
          targetPath ? `Moved to "${targetPath}"` : 'Moved to root folder'
        )
      } catch (error) {
        console.error('Error moving document:', error)
        toast.error('Failed to move document')
      }
    },
    [allDocuments]
  )

  // Handle document actions
  const handleDownload = useCallback(async (doc: Document) => {
    await downloadDocument(doc.id)
  }, [])

  // E2.6: Open delete confirmation dialog
  const handleDeleteRequest = useCallback((doc: Document) => {
    setDocumentToDelete(doc)
    setDeleteConfirmOpen(true)
  }, [])

  // E2.6: Execute delete with optimistic update and rollback on error
  const handleDeleteConfirm = useCallback(
    async (doc: Document): Promise<{ success: boolean; error?: string }> => {
      // Store current state for potential rollback
      const previousDocuments = allDocuments

      // Optimistic update - remove immediately from UI
      setAllDocuments((prev) => prev.filter((d) => d.id !== doc.id))

      // Close details panel if deleted document was selected
      if (selectedDocument?.id === doc.id) {
        setDetailsOpen(false)
        setSelectedDocument(null)
      }

      try {
        const result = await deleteDocument(doc.id)

        if (!result.success) {
          // Rollback on error
          setAllDocuments(previousDocuments)
          toast.error(result.error || 'Failed to delete document', {
            action: {
              label: 'Retry',
              onClick: () => handleDeleteRequest(doc),
            },
          })
          return { success: false, error: result.error }
        }

        toast.success(`Deleted "${doc.name}"`)
        return { success: true }
      } catch (error) {
        // Rollback on error
        setAllDocuments(previousDocuments)
        const errorMessage = error instanceof Error ? error.message : 'Failed to delete document'
        toast.error(errorMessage, {
          action: {
            label: 'Retry',
            onClick: () => handleDeleteRequest(doc),
          },
        })
        return { success: false, error: errorMessage }
      }
    },
    [allDocuments, selectedDocument]
  )

  // Legacy handler for backward compatibility (used by folder delete)
  const handleDelete = useCallback(
    async (doc: Document) => {
      await handleDeleteConfirm(doc)
    },
    [handleDeleteConfirm]
  )

  // E2.5: Handle opening document details
  const handleDocumentClick = useCallback((doc: Document) => {
    setSelectedDocument(doc)
    setDetailsOpen(true)
  }, [])

  // E2.5: Handle document update from details panel
  const handleDocumentUpdate = useCallback((updatedDoc: Document) => {
    setAllDocuments((prev) =>
      prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d))
    )
    setSelectedDocument(updatedDoc)
  }, [])

  // E2.5: Handle opening folder select from details panel
  const handleMoveToFolder = useCallback((doc: Document) => {
    setFolderSelectDocument(doc)
    setFolderSelectOpen(true)
  }, [])

  // E2.5: Handle folder selection for document move
  const handleFolderSelect = useCallback(
    async (path: string | null) => {
      if (!folderSelectDocument) return

      setIsFolderSelectLoading(true)
      try {
        const result = await updateDocument(folderSelectDocument.id, { folderPath: path })
        if (result.success) {
          // Update local state
          setAllDocuments((prev) =>
            prev.map((d) =>
              d.id === folderSelectDocument.id ? { ...d, folderPath: path } : d
            )
          )
          // Update selected document if it's the one being moved
          if (selectedDocument?.id === folderSelectDocument.id) {
            setSelectedDocument({ ...selectedDocument, folderPath: path })
          }
          toast.success(
            path ? `Moved to "${path}"` : 'Moved to root folder'
          )
        } else {
          toast.error(result.error || 'Failed to move document')
        }
      } catch (error) {
        console.error('Error moving document:', error)
        toast.error('Failed to move document')
      } finally {
        setIsFolderSelectLoading(false)
        setFolderSelectOpen(false)
        setFolderSelectDocument(null)
      }
    },
    [folderSelectDocument, selectedDocument]
  )

  const handleMove = useCallback(
    (doc: Document) => {
      // E2.5: Use the new folder select dialog
      setFolderSelectDocument(doc)
      setFolderSelectOpen(true)
    },
    []
  )

  return (
    <div className="flex h-full flex-col">
      {/* Action bar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        {/* E3.6: Realtime connection status indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {realtimeStatus === 'connected' ? (
            <>
              <Wifi className="h-4 w-4 text-green-500" />
              <span className="hidden sm:inline">Live updates</span>
            </>
          ) : realtimeStatus === 'connecting' ? (
            <>
              <Wifi className="h-4 w-4 animate-pulse text-yellow-500" />
              <span className="hidden sm:inline">Connecting...</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-500" />
              <Button
                variant="ghost"
                size="sm"
                className="h-auto p-0 text-red-500 hover:text-red-600"
                onClick={reconnectRealtime}
              >
                Reconnect
              </Button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDocuments}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {/* E2.7: Integrated Upload Button with progress tracking */}
          <UploadButton
            projectId={projectId}
            folderPath={selectedPath}
          />
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel: Folder tree */}
        <div className="w-64 flex-shrink-0 border-r bg-muted/30">
          <FolderTree
            projectId={projectId}
            folders={folders}
            selectedPath={selectedPath}
            onSelectFolder={handleSelectFolder}
            onCreateFolder={handleCreateFolder}
            onRenameFolder={handleRenameFolder}
            onDeleteFolder={handleDeleteFolder}
            onDropDocument={handleDropDocument}
          />
        </div>

        {/* Right panel: Document list */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Breadcrumb */}
          <div className="border-b px-4 py-2">
            <Breadcrumb
              folderPath={selectedPath}
              onNavigate={handleSelectFolder}
            />
          </div>

          {/* E3.7: Processing Queue Panel */}
          <div className="px-4 pt-4">
            <ProcessingQueue projectId={projectId} />
          </div>

          {/* Document list */}
          <div className="flex-1 overflow-auto">
            <DocumentList
              documents={documents}
              isLoading={isLoading}
              onDocumentClick={handleDocumentClick}
              onDownload={handleDownload}
              onDelete={handleDeleteRequest}
              onMove={handleMove}
            />
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <CreateFolderDialog
        open={createFolderOpen}
        parentPath={createFolderParent}
        onOpenChange={setCreateFolderOpen}
        onConfirm={handleCreateFolderConfirm}
      />

      <RenameFolderDialog
        open={renameFolderOpen}
        folderPath={renameFolderPath}
        onOpenChange={setRenameFolderOpen}
        onConfirm={handleRenameFolderConfirm}
      />

      <DeleteFolderDialog
        open={deleteFolderOpen}
        folderPath={deleteFolderPath}
        documentCount={deleteFolderDocCount}
        onOpenChange={setDeleteFolderOpen}
        onConfirm={handleDeleteFolderConfirm}
      />

      {/* E2.5: Document Details Panel */}
      <DocumentDetails
        document={selectedDocument}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onDocumentUpdate={handleDocumentUpdate}
        onDocumentDelete={handleDeleteRequest}
        onMoveToFolder={handleMoveToFolder}
      />

      {/* E2.5: Folder Select Dialog */}
      <FolderSelectDialog
        open={folderSelectOpen}
        onOpenChange={setFolderSelectOpen}
        folders={folders}
        currentPath={folderSelectDocument?.folderPath || null}
        documentName={folderSelectDocument?.name || ''}
        onSelect={handleFolderSelect}
        isLoading={isFolderSelectLoading}
      />

      {/* E2.6: Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        document={documentToDelete}
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  )
}

/**
 * Add document counts to folder tree nodes
 */
function addDocumentCounts(nodes: FolderNode[], documents: Document[]): void {
  for (const node of nodes) {
    node.documentCount = documents.filter(
      (d) =>
        d.folderPath === node.path || d.folderPath?.startsWith(`${node.path}/`)
    ).length
    if (node.children.length > 0) {
      addDocumentCounts(node.children, documents)
    }
  }
}
