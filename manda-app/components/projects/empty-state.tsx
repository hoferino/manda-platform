/**
 * Empty State Component
 * Displayed when user has no projects
 * Story: E1.4 - Build Projects Overview Screen (AC: #4)
 */

import Link from 'next/link'
import { FolderOpen, Plus, Rocket } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function EmptyState() {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 p-8 text-center">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <FolderOpen className="h-10 w-10 text-muted-foreground" />
      </div>

      <h3 className="mt-6 text-xl font-semibold">No projects yet</h3>

      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Create your first project to get started. Track M&A deals, manage documents, and collaborate with your team.
      </p>

      <div className="mt-6 flex items-center gap-4">
        <Button asChild size="lg">
          <Link href="/projects/new">
            <Plus className="mr-2 h-5 w-5" />
            Create Project
          </Link>
        </Button>
      </div>

      <div className="mt-8 flex items-center gap-2 text-xs text-muted-foreground">
        <Rocket className="h-4 w-4" />
        <span>Projects help you organize your M&A due diligence workflow</span>
      </div>
    </div>
  )
}
