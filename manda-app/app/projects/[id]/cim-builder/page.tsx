/**
 * CIM Builder List Page
 * Entry point for managing CIMs (Confidential Information Memorandums) for a deal
 * Story: E9.2 - CIM List & Entry UI
 * AC: #1 - CIM list view accessible at /projects/[id]/cim-builder
 *
 * Features:
 * - Lists all CIMs for a project
 * - Create, open, and delete CIMs
 * - Progress indicators for each CIM
 * - Empty state with helpful messaging
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CIMListPage } from '@/components/cim-builder/CIMListPage'
import { Skeleton } from '@/components/ui/skeleton'

export const metadata: Metadata = {
  title: 'CIM Builder - Manda',
  description: 'Create and manage Confidential Information Memorandums',
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function CIMBuilderPage({ params }: Props) {
  const { id: projectId } = await params

  // Server-side authentication check (AC: #1 - redirect to login if unauthenticated)
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Verify user has access to this project
  const { data: project, error: projectError } = await supabase
    .from('deals')
    .select('id, name')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    redirect('/projects')
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Suspense fallback={<CIMListSkeleton />}>
        <CIMListPage projectId={projectId} projectName={project.name} />
      </Suspense>
    </div>
  )
}

function CIMListSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-96" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Cards grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    </div>
  )
}
