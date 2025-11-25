/**
 * Project Workspace Layout
 * Shared layout for all project sections with top nav and sidebar
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #1, #7)
 * Story: E1.9 - Adds audit logging for project access (AC: #4)
 */

import { Suspense, type ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getDealById } from '@/lib/api/deals'
import { TopNav, Sidebar, TopNavSkeleton, SidebarSkeleton } from '@/components/workspace'
import { createClient } from '@/lib/supabase/server'
import { createAuditLog, AUDIT_EVENT_TYPES } from '@/lib/audit'

interface ProjectLayoutProps {
  children: ReactNode
  params: Promise<{ id: string }>
}

async function ProjectLayoutContent({
  children,
  projectId,
}: {
  children: ReactNode
  projectId: string
}) {
  const { data: project, error } = await getDealById(projectId)

  // If project not found or RLS blocks access, show 404
  // (RLS returns null if user doesn't have access)
  if (error || !project) {
    // Log access denied attempt
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const headersList = await headers()
    const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] ||
      headersList.get('x-real-ip') || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    if (user) {
      await createAuditLog({
        event_type: AUDIT_EVENT_TYPES.ACCESS_DENIED,
        user_id: user.id,
        ip_address: ipAddress,
        user_agent: userAgent,
        metadata: {
          attempted_resource_id: projectId,
          attempted_resource_type: 'project',
          reason: error || 'Project not found or access denied',
        },
        success: false,
      })
    }
    notFound()
  }

  // Log successful project access
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const headersList = await headers()
  const ipAddress = headersList.get('x-forwarded-for')?.split(',')[0] ||
    headersList.get('x-real-ip') || 'unknown'
  const userAgent = headersList.get('user-agent') || 'unknown'

  if (user) {
    // Fire-and-forget - don't await to avoid blocking render
    createAuditLog({
      event_type: AUDIT_EVENT_TYPES.PROJECT_ACCESSED,
      user_id: user.id,
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        project_id: project.id,
        project_name: project.name,
        access_type: 'view',
      },
      success: true,
    })
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Top Navigation */}
      <TopNav project={project} />

      {/* Main Layout: Sidebar + Content */}
      <div className="flex flex-1">
        {/* Sidebar */}
        <Sidebar projectId={projectId} />

        {/* Main Content Area */}
        <main className="flex-1 overflow-auto lg:ml-0">
          {children}
        </main>
      </div>
    </div>
  )
}

export default async function ProjectLayout({ children, params }: ProjectLayoutProps) {
  const { id } = await params

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen flex-col bg-background">
          <TopNavSkeleton />
          <div className="flex flex-1">
            <SidebarSkeleton />
            <main className="flex-1 overflow-auto" />
          </div>
        </div>
      }
    >
      <ProjectLayoutContent projectId={id}>{children}</ProjectLayoutContent>
    </Suspense>
  )
}
