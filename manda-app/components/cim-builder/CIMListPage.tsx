'use client'

/**
 * CIM List Page Client Component
 * Main list view for managing CIMs
 * Story: E9.2 - CIM List & Entry UI
 * AC: #2 - CIM cards display name, last updated timestamp, and progress indicator
 *
 * Features:
 * - Displays grid of CIM cards
 * - Create new CIM button
 * - Empty state when no CIMs exist
 * - Loading and error states
 */

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CIMCard } from './CIMCard'
import { CIMEmptyState } from './CIMEmptyState'
import { CreateCIMDialog } from './CreateCIMDialog'
import { DeleteCIMDialog } from './DeleteCIMDialog'
import { useCIMs } from '@/lib/hooks/useCIMs'
import { useState } from 'react'
import { CIMListItem } from '@/lib/types/cim'

interface CIMListPageProps {
  projectId: string
  projectName: string
}

export function CIMListPage({ projectId, projectName }: CIMListPageProps) {
  const { items, isLoading, error, refresh, createCIM, deleteCIM, isCreating, isDeleting } =
    useCIMs(projectId)

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CIMListItem | null>(null)

  const handleCreateCIM = async (title: string) => {
    await createCIM(title)
    setIsCreateDialogOpen(false)
  }

  const handleDeleteCIM = async () => {
    if (!deleteTarget) return
    await deleteCIM(deleteTarget.id)
    setDeleteTarget(null)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
          <div className="h-10 w-40 bg-muted animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Header
          projectName={projectName}
          onCreateClick={() => setIsCreateDialogOpen(true)}
        />
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" className="mt-4" onClick={refresh}>
            Try Again
          </Button>
        </div>
      </div>
    )
  }

  const isEmpty = items.length === 0

  return (
    <div className="space-y-6">
      <Header
        projectName={projectName}
        onCreateClick={() => setIsCreateDialogOpen(true)}
        showCreateButton={!isEmpty}
      />

      {isEmpty ? (
        <CIMEmptyState onCreateClick={() => setIsCreateDialogOpen(true)} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((cim) => (
            <CIMCard
              key={cim.id}
              cim={cim}
              projectId={projectId}
              onDelete={() => setDeleteTarget(cim)}
            />
          ))}
        </div>
      )}

      <CreateCIMDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSubmit={handleCreateCIM}
        isLoading={isCreating}
      />

      <DeleteCIMDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        cimTitle={deleteTarget?.title ?? ''}
        onConfirm={handleDeleteCIM}
        isLoading={isDeleting}
      />
    </div>
  )
}

interface HeaderProps {
  projectName: string
  onCreateClick: () => void
  showCreateButton?: boolean
}

function Header({ projectName, onCreateClick, showCreateButton = true }: HeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">CIM Builder</h1>
        <p className="text-muted-foreground">
          Create and manage Confidential Information Memorandums for {projectName}
        </p>
      </div>
      {showCreateButton && (
        <Button onClick={onCreateClick}>
          <Plus className="mr-2 h-4 w-4" />
          Create New CIM
        </Button>
      )}
    </div>
  )
}
