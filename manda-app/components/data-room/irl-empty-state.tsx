/**
 * IRL Empty State Component
 * Story: E2.8 - Implement IRL Integration with Document Tracking
 * AC: #7 (No IRL State)
 */

'use client'

import { ClipboardList, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export interface IRLEmptyStateProps {
  projectId: string
}

export function IRLEmptyState({ projectId }: IRLEmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-foreground">No IRL Configured</h4>
        <p className="text-sm text-muted-foreground max-w-[200px]">
          Create an Information Request List to track document collection progress.
        </p>
      </div>

      {/* Link to IRL creation (Epic 6 feature - for now just a placeholder) */}
      <Button variant="outline" size="sm" asChild>
        <Link href={`/projects/${projectId}/irl`}>
          <Plus className="mr-2 h-4 w-4" />
          Create IRL
        </Link>
      </Button>

      {/* Help text */}
      <p className="text-xs text-muted-foreground mt-4">
        An IRL helps track which documents you need to collect for due diligence.
      </p>
    </div>
  )
}
