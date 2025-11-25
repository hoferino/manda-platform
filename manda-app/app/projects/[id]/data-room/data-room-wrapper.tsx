/**
 * Data Room Wrapper Component
 * Provides view switching between Folders and Buckets views
 * Story: E2.3 - Build Data Room Buckets View
 * Note: Full view toggle with persistence is E2.4
 */

'use client'

import { useState } from 'react'
import { Folders, LayoutGrid } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataRoomClient } from './data-room-client'
import { BucketsView } from '@/components/data-room'

type DataRoomView = 'folders' | 'buckets'

interface DataRoomWrapperProps {
  projectId: string
  initialView?: DataRoomView
}

export function DataRoomWrapper({
  projectId,
  initialView = 'folders',
}: DataRoomWrapperProps) {
  const [view, setView] = useState<DataRoomView>(initialView)

  return (
    <div className="flex h-full flex-col">
      {/* View Toggle Header */}
      <div className="flex items-center justify-between border-b bg-background px-6 py-3">
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as DataRoomView)}
        >
          <TabsList>
            <TabsTrigger value="folders" className="gap-2">
              <Folders className="h-4 w-4" />
              Folders
            </TabsTrigger>
            <TabsTrigger value="buckets" className="gap-2">
              <LayoutGrid className="h-4 w-4" />
              Buckets
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* View Content */}
      <div className="flex-1 overflow-hidden">
        {view === 'folders' ? (
          <DataRoomClient projectId={projectId} />
        ) : (
          <BucketsView projectId={projectId} />
        )}
      </div>
    </div>
  )
}
