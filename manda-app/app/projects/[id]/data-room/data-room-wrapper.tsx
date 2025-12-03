/**
 * Data Room Wrapper Component
 * Provides view switching between Folders and Buckets views with preference persistence
 * Story: E2.3 - Build Data Room Buckets View
 * Story: E2.4 - Implement View Toggle and User Preference
 * Story: E6.5 - IRL-Document Linking and Progress Tracking
 *
 * Features:
 * - View toggle (Folders/Buckets) with localStorage persistence
 * - Per-project preference storage
 * - Context preservation when switching views
 * - IRL Checklist panel integration (E6.5)
 * - Responsive design
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import { DataRoomClient } from './data-room-client'
import {
  BucketsView,
  ViewToggle,
  useViewPreference,
  IRLChecklistPanel,
  CreateFolderDialog,
  type DataRoomView,
} from '@/components/data-room'
import { createFolder } from '@/lib/api/folders'
import { toast } from 'sonner'

interface DataRoomWrapperProps {
  projectId: string
}

/**
 * State to preserve context when switching views
 */
interface ViewContext {
  folders: {
    selectedPath: string | null
    scrollTop: number
  }
  buckets: {
    expandedBuckets: string[]
    scrollTop: number
  }
}

export function DataRoomWrapper({ projectId }: DataRoomWrapperProps) {
  // Use the hook for localStorage persistence (AC4, AC5)
  const [view, setView] = useViewPreference(projectId)

  // Context preservation state (AC6)
  const [context, setContext] = useState<ViewContext>({
    folders: { selectedPath: null, scrollTop: 0 },
    buckets: { expandedBuckets: [], scrollTop: 0 },
  })

  // Create folder dialog state (for Buckets view)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Refs for scroll containers
  const foldersScrollRef = useRef<HTMLDivElement>(null)
  const bucketsScrollRef = useRef<HTMLDivElement>(null)

  // Handle view change with context preservation
  const handleViewChange = useCallback(
    (newView: DataRoomView) => {
      // Save current view's scroll position before switching
      if (view === 'folders' && foldersScrollRef.current) {
        setContext((prev) => ({
          ...prev,
          folders: {
            ...prev.folders,
            scrollTop: foldersScrollRef.current?.scrollTop ?? 0,
          },
        }))
      } else if (view === 'buckets' && bucketsScrollRef.current) {
        setContext((prev) => ({
          ...prev,
          buckets: {
            ...prev.buckets,
            scrollTop: bucketsScrollRef.current?.scrollTop ?? 0,
          },
        }))
      }

      setView(newView)
    },
    [view, setView]
  )

  // Callback to update selected folder path (for context preservation)
  const handleFolderSelect = useCallback((path: string | null) => {
    setContext((prev) => ({
      ...prev,
      folders: { ...prev.folders, selectedPath: path },
    }))
  }, [])

  // Callback to track expanded buckets (for context preservation)
  const handleBucketToggle = useCallback((bucketId: string, expanded: boolean) => {
    setContext((prev) => ({
      ...prev,
      buckets: {
        ...prev.buckets,
        expandedBuckets: expanded
          ? [...prev.buckets.expandedBuckets, bucketId]
          : prev.buckets.expandedBuckets.filter((id) => id !== bucketId),
      },
    }))
  }, [])

  // Handle create folder/bucket from Buckets view
  const handleCreateBucket = useCallback(() => {
    setCreateFolderOpen(true)
  }, [])

  // Handle create folder confirmation
  const handleCreateFolderConfirm = useCallback(
    async (name: string) => {
      try {
        const result = await createFolder(projectId, name, null) // null parent = root level bucket
        if (result.error) {
          toast.error(result.error)
          return
        }
        toast.success(`Created bucket "${name}"`)
        setCreateFolderOpen(false)
        // Trigger refresh by incrementing key
        setRefreshKey((k) => k + 1)
      } catch (error) {
        console.error('Error creating bucket:', error)
        toast.error('Failed to create bucket')
      }
    },
    [projectId]
  )

  return (
    <div className="flex h-full flex-col">
      {/* View Toggle Header (AC1) */}
      <div className="flex items-center justify-between border-b bg-background px-4 py-3 sm:px-6">
        <ViewToggle
          projectId={projectId}
          value={view}
          onChange={handleViewChange}
        />
      </div>

      {/* Main Content with IRL Panel (E6.5) */}
      <div className="flex flex-1 overflow-hidden">
        {/* View Content (AC2, AC3) */}
        <div className="flex-1 overflow-hidden">
          {view === 'folders' ? (
            <div
              ref={foldersScrollRef}
              className="h-full overflow-auto"
            >
              <DataRoomClient
                projectId={projectId}
                selectedPath={context.folders.selectedPath}
                onFolderSelect={handleFolderSelect}
              />
            </div>
          ) : (
            <div
              ref={bucketsScrollRef}
              className="h-full overflow-auto"
            >
              <BucketsView
                key={refreshKey}
                projectId={projectId}
                expandedBuckets={context.buckets.expandedBuckets}
                onBucketToggle={handleBucketToggle}
                onCreateFolder={handleCreateBucket}
              />
            </div>
          )}
        </div>

        {/* IRL Checklist Panel (E6.5 - AC1, AC6, AC7) */}
        <IRLChecklistPanel projectId={projectId} />
      </div>

      {/* Create Bucket Dialog */}
      <CreateFolderDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        onConfirm={handleCreateFolderConfirm}
        parentPath={null}
      />
    </div>
  )
}
