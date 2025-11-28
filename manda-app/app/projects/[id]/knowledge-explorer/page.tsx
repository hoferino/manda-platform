/**
 * Knowledge Explorer Page
 * Browse and explore findings, contradictions, and gaps
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #1, #5)
 */

import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { KnowledgeExplorerClient } from '@/components/knowledge-explorer'

export const metadata: Metadata = {
  title: 'Knowledge Explorer - Manda',
  description: 'Browse and explore extracted findings, contradictions, and gaps',
}

interface KnowledgeExplorerPageProps {
  params: Promise<{ id: string }>
}

async function getProjectData(projectId: string) {
  const supabase = await createClient()

  // Fetch documents for filter dropdown
  const { data: documents } = await supabase
    .from('documents')
    .select('id, name')
    .eq('deal_id', projectId)
    .order('name')

  // Get findings count
  const { count: findingsCount } = await supabase
    .from('findings')
    .select('id', { count: 'exact', head: true })
    .eq('deal_id', projectId)

  return {
    documents: documents || [],
    findingsCount: findingsCount || 0,
    contradictionsCount: 0, // Placeholder for E4.6
    gapsCount: 0, // Placeholder for E4.8
  }
}

export default async function KnowledgeExplorerPage({
  params,
}: KnowledgeExplorerPageProps) {
  const { id: projectId } = await params

  const { documents, findingsCount, contradictionsCount, gapsCount } =
    await getProjectData(projectId)

  return (
    <div className="flex h-full flex-col">
      <KnowledgeExplorerClient
        projectId={projectId}
        documents={documents}
        findingsCount={findingsCount}
        contradictionsCount={contradictionsCount}
        gapsCount={gapsCount}
      />
    </div>
  )
}
