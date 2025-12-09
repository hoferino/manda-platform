/**
 * Q&A Management Page
 * View and edit Q&A items in a collaborative table with conflict resolution
 * Story: E8.2 - Q&A Management UI with Collaborative Editing
 *
 * Features:
 * - Table view with category grouping
 * - Inline editing with optimistic locking
 * - Conflict resolution modal for concurrent edits
 * - Filter controls for category, priority, status
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { QAPageClient } from '@/components/qa/QAPageClient'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'Q&A Management - Manda',
  description: 'Manage questions and answers for client due diligence',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function QAPage({ params }: Props) {
  const { id: projectId } = await params

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Suspense fallback={<QAPageSkeleton />}>
        <QAPageClient projectId={projectId} />
      </Suspense>
    </div>
  )
}

function QAPageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Table skeleton */}
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  )
}
