/**
 * Buckets View Component
 * Folder-based grid view of document buckets with progress indicators
 * Story: E2.3 - Build Data Room Buckets View (AC: #1-6)
 *
 * Architecture (v2.6): Buckets = top-level folders
 * The Buckets view derives its data from folder_path (same source as Folder view)
 * Empty projects have no default buckets - users create their own folder structure
 */

'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Upload, RefreshCw, FolderOpen, FolderPlus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { BucketCard, type BucketItem } from './bucket-card'
import { BucketItemList } from './bucket-item-list'
import { uploadDocument, type Document } from '@/lib/api/documents'
import { getFolders } from '@/lib/api/folders'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

interface BucketsViewProps {
  projectId: string
  onCreateFolder?: () => void
  /** List of expanded bucket IDs (for context preservation from parent) */
  expandedBuckets?: string[]
  /** Callback when bucket expansion changes (for context preservation) */
  onBucketToggle?: (bucketId: string, expanded: boolean) => void
}

interface FolderBucket {
  folderName: string
  folderPath: string
  uploadedCount: number
  documents: Document[]
  items: BucketItem[]
  subfolders: string[]
}

export function BucketsView({
  projectId,
  onCreateFolder,
  expandedBuckets: externalExpandedBuckets,
  onBucketToggle,
}: BucketsViewProps) {
  const [buckets, setBuckets] = useState<FolderBucket[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Use internal state if no external control provided
  const [internalExpandedFolder, setInternalExpandedFolder] = useState<string | null>(null)

  // Determine which expanded folder to use - external (controlled) or internal (uncontrolled)
  // For external, take the first expanded bucket (since this component only shows one at a time)
  const expandedFolder = externalExpandedBuckets !== undefined
    ? (externalExpandedBuckets[0] || null)
    : internalExpandedFolder
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadRef = useRef<{ itemId: string; folderPath: string } | null>(null)

  /**
   * Extract top-level folder from a folder path
   */
  const getTopLevelFolder = (folderPath: string | null): string | null => {
    if (!folderPath) return null
    const parts = folderPath.split('/')
    return parts[0] || null
  }

  /**
   * Load documents and build folder-based buckets
   * Buckets = top-level folders (derived from folder_path AND folders table)
   */
  const loadBuckets = useCallback(async () => {
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
      // Note: category field is deprecated (v2.6), folder_path is the source of truth
      const documents: Document[] = (documentsResult.data || []).map((doc) => ({
        id: doc.id,
        projectId: doc.deal_id,
        name: doc.name,
        size: doc.file_size,
        mimeType: doc.mime_type,
        category: null, // Deprecated - buckets now derived from folderPath
        folderPath: doc.folder_path || null,
        uploadStatus: doc.upload_status as Document['uploadStatus'],
        processingStatus: doc.processing_status as Document['processingStatus'],
        createdAt: doc.created_at,
        updatedAt: doc.updated_at,
      }))

      // Group documents by top-level folder
      const folderMap = new Map<string, Document[]>()
      const subfolderMap = new Map<string, Set<string>>()

      for (const doc of documents) {
        const topLevelFolder = getTopLevelFolder(doc.folderPath)
        if (topLevelFolder) {
          // Add document to its top-level folder bucket
          if (!folderMap.has(topLevelFolder)) {
            folderMap.set(topLevelFolder, [])
            subfolderMap.set(topLevelFolder, new Set())
          }
          folderMap.get(topLevelFolder)!.push(doc)

          // Track subfolders (nested paths under this top-level folder)
          if (doc.folderPath && doc.folderPath.includes('/')) {
            const subfolder = doc.folderPath.substring(topLevelFolder.length + 1)
            if (subfolder) {
              const firstSubfolder = subfolder.split('/')[0]
              if (firstSubfolder) {
                subfolderMap.get(topLevelFolder)!.add(firstSubfolder)
              }
            }
          }
        }
      }

      // Add empty folders from database (folders without documents)
      // Only add root-level folders (buckets) that don't have any documents yet
      for (const folder of foldersResult.folders) {
        const topLevelFolder = getTopLevelFolder(folder.path)
        if (topLevelFolder && !folderMap.has(topLevelFolder)) {
          // This is a root folder with no documents - add it as an empty bucket
          folderMap.set(topLevelFolder, [])
          subfolderMap.set(topLevelFolder, new Set())
        }
        // Track subfolders from database too
        if (folder.path.includes('/')) {
          const rootFolder = folder.path.split('/')[0]
          if (rootFolder && subfolderMap.has(rootFolder)) {
            const subfolder = folder.path.substring(rootFolder.length + 1).split('/')[0]
            if (subfolder) {
              subfolderMap.get(rootFolder)!.add(subfolder)
            }
          }
        }
      }

      // Build buckets from unique top-level folders
      const folderBuckets: FolderBucket[] = Array.from(folderMap.entries())
        .map(([folderName, folderDocs]) => {
          const subfolders = Array.from(subfolderMap.get(folderName) || [])

          // Build items list: subfolders first, then documents
          const items: BucketItem[] = [
            // Add subfolders as items
            ...subfolders.map((subfolder) => ({
              id: `folder-${folderName}/${subfolder}`,
              name: subfolder,
              status: 'uploaded' as const,
              type: 'folder' as const,
              folderPath: `${folderName}/${subfolder}`,
            })),
            // Add documents as items
            ...folderDocs.map((doc, index) => ({
              id: `doc-${folderName}-${index}`,
              name: doc.name,
              status: 'uploaded' as const,
              type: 'document' as const,
              documentId: doc.id,
              documentName: doc.name,
            })),
          ]

          return {
            folderName,
            folderPath: folderName,
            uploadedCount: folderDocs.length,
            documents: folderDocs,
            items,
            subfolders,
          }
        })
        .sort((a, b) => a.folderName.localeCompare(b.folderName))

      setBuckets(folderBuckets)
    } catch (error) {
      console.error('Error loading buckets:', error)
      toast.error('Failed to load document folders')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  // Initial load
  useEffect(() => {
    loadBuckets()
  }, [loadBuckets])

  /**
   * Handle bucket card click - toggle expansion
   */
  const handleToggleExpand = useCallback((folderPath: string) => {
    const isExpanding = expandedFolder !== folderPath

    // Update internal state
    setInternalExpandedFolder((prev) => (prev === folderPath ? null : folderPath))

    // Notify parent if callback provided
    if (onBucketToggle) {
      onBucketToggle(folderPath, isExpanding)
    }
  }, [expandedFolder, onBucketToggle])

  /**
   * Handle upload for a specific item in a folder
   */
  const handleUploadItem = useCallback((itemId: string, folderPath: string) => {
    pendingUploadRef.current = { itemId, folderPath }
    fileInputRef.current?.click()
  }, [])

  /**
   * Handle file selection
   */
  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !pendingUploadRef.current) return

      const { itemId, folderPath } = pendingUploadRef.current
      setUploadingItemId(itemId)

      try {
        const result = await uploadDocument(file, {
          projectId,
          folderPath, // Use folderPath instead of category
        })

        if (result.success) {
          toast.success(`Uploaded "${file.name}"`)
          await loadBuckets() // Refresh to show updated documents
        } else {
          toast.error(result.error || 'Upload failed')
        }
      } catch (error) {
        console.error('Upload error:', error)
        toast.error('Failed to upload file')
      } finally {
        setUploadingItemId(null)
        pendingUploadRef.current = null
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    },
    [projectId, loadBuckets]
  )

  /**
   * Handle bulk upload for a folder
   */
  const handleBulkUpload = useCallback((folderPath: string) => {
    pendingUploadRef.current = { itemId: 'bulk', folderPath }
    fileInputRef.current?.click()
  }, [])

  // Get the expanded bucket
  const expandedBucket = buckets.find((b) => b.folderPath === expandedFolder)

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading folders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col" data-testid="buckets-view">
      {/* Action bar - Enhanced */}
      <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/30">
        <div className="flex items-center gap-3">
          {onCreateFolder && (
            <Button 
              onClick={onCreateFolder}
              className="font-medium shadow-sm"
            >
              <FolderPlus className="mr-2 h-4 w-4" />
              New Bucket
            </Button>
          )}
          <div className="text-sm text-muted-foreground">
            {buckets.length} {buckets.length === 1 ? 'bucket' : 'buckets'}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadBuckets} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Buckets grid - Enhanced with better spacing */}
        <div
          className={cn(
            'flex-1 overflow-auto p-8 custom-scrollbar transition-all duration-300',
            expandedFolder && 'w-1/2'
          )}
        >
          {buckets.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
              <div className="rounded-full bg-muted p-6">
                <FolderOpen className="h-16 w-16 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="font-heading text-xl font-semibold">No buckets yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Create your first bucket to start organizing documents by category or project phase
                </p>
              </div>
              {onCreateFolder && (
                <Button onClick={onCreateFolder} size="lg" className="mt-2">
                  <Plus className="mr-2 h-5 w-5" />
                  Create First Bucket
                </Button>
              )}
            </div>
          ) : (
            <div
              className={cn(
                'grid gap-6',
                expandedFolder
                  ? 'grid-cols-1 xl:grid-cols-2'
                  : 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4'
              )}
            >
              {buckets.map((bucket) => (
                <BucketCard
                  key={bucket.folderPath}
                  folderName={bucket.folderName}
                  folderPath={bucket.folderPath}
                  uploadedCount={bucket.uploadedCount}
                  items={bucket.items}
                  subfolderCount={bucket.subfolders.length}
                  isExpanded={expandedFolder === bucket.folderPath}
                  onToggleExpand={() => handleToggleExpand(bucket.folderPath)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Expanded item list panel - Enhanced */}
        {expandedFolder && expandedBucket && (
          <div className="w-1/2 border-l bg-muted/20 slide-in">
            <BucketItemList
              folderName={expandedBucket.folderName}
              folderPath={expandedBucket.folderPath}
              items={expandedBucket.items}
              uploadedCount={expandedBucket.uploadedCount}
              uploadingItemId={uploadingItemId}
              onUploadItem={(itemId) => handleUploadItem(itemId, expandedBucket.folderPath)}
              onBulkUpload={() => handleBulkUpload(expandedBucket.folderPath)}
              onClose={() => {
                if (onBucketToggle && expandedFolder) {
                  onBucketToggle(expandedFolder, false)
                }
                setInternalExpandedFolder(null)
              }}
            />
          </div>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
        accept="*/*"
      />
    </div>
  )
}
