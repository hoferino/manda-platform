/**
 * CIM Builder Page - 3-Panel Layout
 * Placeholder for E9.3 implementation
 * Story: E9.2 - CIM List & Entry UI (placeholder)
 * Story: E9.3 - CIM Builder 3-Panel Layout (actual implementation)
 * AC: #4 - Click CIM card navigates to builder with CIM loaded
 *
 * This page will implement the NotebookLM-inspired 3-panel UI:
 * - Left panel: Sources and context
 * - Center panel: Preview and slides
 * - Right panel: Chat and AI guidance
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Construction } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

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
    <div className="container mx-auto py-6 space-y-6">
      {/* Header with back link */}
      <div className="flex items-center gap-4">
        <Link href={`/projects/${projectId}/cim-builder`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to CIMs
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{cim.title}</h1>
        </div>
      </div>

      {/* Placeholder for E9.3 */}
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <div className="rounded-full bg-muted p-6 mb-6">
            <Construction className="h-12 w-12 text-muted-foreground" />
          </div>

          <h3 className="text-xl font-semibold mb-2">CIM Builder Coming Soon</h3>

          <p className="text-muted-foreground max-w-md mb-6">
            The 3-panel CIM Builder interface will be implemented in Story E9.3. This will
            include the AI-guided workflow for creating compelling investment materials.
          </p>

          <div className="grid grid-cols-3 gap-4 max-w-lg text-sm text-muted-foreground">
            <div className="p-4 border rounded-lg">
              <p className="font-medium text-foreground">Sources Panel</p>
              <p>Upload and reference documents</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="font-medium text-foreground">Preview Panel</p>
              <p>Visualize slides and content</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="font-medium text-foreground">Chat Panel</p>
              <p>AI-guided creation workflow</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
