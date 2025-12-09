/**
 * Projects Overview Page
 * Server Component for fetching and displaying user projects
 * Story: E1.4 - Build Projects Overview Screen
 */

import { Suspense } from 'react'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getDeals } from '@/lib/api/deals'
import { ProjectsView, ErrorState, ProjectCardSkeletonGrid } from '@/components/projects'
import { SignOutButton } from './sign-out-button'

export const metadata: Metadata = {
  title: 'Projects - Manda',
  description: 'View and manage your M&A projects',
}

async function ProjectsContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: deals, error } = await getDeals()

  if (error) {
    return <ErrorState message={error} />
  }

  return <ProjectsView deals={deals ?? []} />
}

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Page Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-2xl font-bold">Projects</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {user.email}
            </p>
          </div>
          <SignOutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Suspense fallback={<ProjectCardSkeletonGrid />}>
          <ProjectsContent />
        </Suspense>
      </main>
    </div>
  )
}