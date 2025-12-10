/**
 * CIM Builder Page - 3-Panel Layout
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #1-6 - All acceptance criteria
 *
 * Server component that:
 * - Handles authentication
 * - Verifies CIM exists and user has access
 * - Renders the CIMBuilderPage client component
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CIMBuilderPage } from '@/components/cim-builder/CIMBuilderPage'

export const metadata: Metadata = {
  title: 'CIM Builder - Manda',
  description: 'Create and edit your Confidential Information Memorandum',
}

interface Props {
  params: Promise<{ id: string; cimId: string }>
}

export default async function CIMBuilderEditorPage({ params }: Props) {
  const { id: projectId, cimId } = await params

  // Server-side authentication check
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect('/login')
  }

  // Fetch CIM to verify it exists and user has access
  const { data: cim, error: cimError } = await supabase
    .from('cims')
    .select('id, title, deal_id')
    .eq('id', cimId)
    .eq('deal_id', projectId)
    .single()

  if (cimError || !cim) {
    redirect(`/projects/${projectId}/cim-builder`)
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <CIMBuilderPage
        projectId={projectId}
        cimId={cimId}
        initialCIMTitle={cim.title}
      />
    </div>
  )
}
