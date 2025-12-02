/**
 * Deliverables Section Page
 * CIM, Q&A, and IRL outputs
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 *
 * This page provides tabs for different deliverable types:
 * - IRL: Information Request Lists with template selection
 * - CIM: Company Information Memorandum (placeholder)
 * - Q&A: Question & Answer lists (placeholder)
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { DeliverablesClient } from './deliverables-client'

export const metadata: Metadata = {
  title: 'Deliverables - Manda',
  description: 'CIM, Q&A, and IRL outputs',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function DeliverablesPage({ params }: Props) {
  const { id: projectId } = await params

  return (
    <Suspense fallback={<DeliverablesLoading />}>
      <DeliverablesClient projectId={projectId} />
    </Suspense>
  )
}

function DeliverablesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-8 w-48 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded mt-2" />
        </div>
      </div>
      <div className="h-10 w-48 bg-muted animate-pulse rounded" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  )
}
