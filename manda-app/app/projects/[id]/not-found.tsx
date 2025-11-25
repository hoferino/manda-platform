/**
 * Project Not Found Page
 * Shows 404 error when project doesn't exist or user doesn't have access
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #8)
 */

import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function ProjectNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="flex flex-col items-center gap-6 text-center">
        {/* Icon */}
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
          <FileQuestion className="h-10 w-10 text-muted-foreground" />
        </div>

        {/* Title */}
        <h1 className="text-3xl font-bold">Project Not Found</h1>

        {/* Description */}
        <p className="max-w-md text-muted-foreground">
          The project you&apos;re looking for doesn&apos;t exist or you don&apos;t have
          permission to access it.
        </p>

        {/* Action */}
        <Button asChild>
          <Link href="/projects">Back to Projects</Link>
        </Button>
      </div>
    </div>
  )
}
