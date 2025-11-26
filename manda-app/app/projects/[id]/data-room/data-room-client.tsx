/**
 * Data Room Client Component
 * Manages state for folder tree, document list, and CRUD operations
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #1-8)
 * Story: E2.5 - Create Document Metadata Management (enhanced with details panel)
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Upload, RefreshCw } from 'lucide-react'
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
import { createClient } from '@/lib/supabase/client'

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

  // Load documents from Supabase
  const loadDocuments = useCallback(async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('deal_id', projectId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading documents:', error)
        toast.error('Failed to load documents')
        return
      }

      // Transform to Document type
      const docs: Document[] = (data || []).map((doc) => ({
        id: doc.id,
        projectId: doc.deal_id,
        name: doc.name,
        size: doc.file_size,
        mimeType: doc.mime_type,
        category: (doc.category as DocumentCategory) || null,
        folderPath: doc.folder_path || null,
        uploadStatus: doc.upload_status as Document['uploadStatus'],
        processingStatus: doc.processing_status as Document['processingStatus'],
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))

      setAllDocuments(docs)

      // Extract unique folder paths and build tree
      const folderPaths = docs
        .map((d) => d.folderPath)
        .filter((p): p is string => p !== null)
      const tree = buildFolderTree(folderPaths)

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
      const newPath = createFolderParent ? `${createFolderParent}/${name}` : name

      // Create a placeholder document to establish the folder
      // (folders are virtual - derived from document folder_path values)
      // For now, we just add the folder to the tree locally
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
    },
    [createFolderParent]
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

      // Update all documents with old path prefix
      const docsToUpdate = allDocuments.filter(
        (d) =>
          d.folderPath === oldPath || d.folderPath?.startsWith(`${oldPath}/`)
      )

      try {
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
    [renameFolderPath, allDocuments, selectedPath]
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
    [deleteFolderPath, allDocuments, selectedPath]
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

  const handleDelete = useCallback(
    async (doc: Document) => {
      try {
        const result = await deleteDocument(doc.id)
        if (!result.success) {
          throw new Error(result.error || 'Failed to delete document')
        }

        setAllDocuments((prev) => prev.filter((d) => d.id !== doc.id))
        toast.success(`Deleted "${doc.name}"`)
      } catch (error) {
        console.error('Error deleting document:', error)
        toast.error('Failed to delete document')
      }
    },
    []
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
      <div className="flex items-center justify-end border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadDocuments}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button size="sm">
            <Upload className="mr-2 h-4 w-4" />
            Upload
          </Button>
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

          {/* Document list */}
          <div className="flex-1 overflow-auto">
            <DocumentList
              documents={documents}
              isLoading={isLoading}
              onDocumentClick={handleDocumentClick}
              onDownload={handleDownload}
              onDelete={handleDelete}
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
        onDocumentDelete={handleDelete}
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
