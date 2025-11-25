/**
 * Top Navigation Skeleton Component
 * Shows loading state for top nav
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #10)
 */

import { Skeleton } from '@/components/ui/skeleton'

export function TopNavSkeleton() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle Placeholder */}
        <Skeleton className="h-9 w-9 lg:hidden" />

        {/* Breadcrumb */}
        <Skeleton className="h-4 w-16" />

        {/* Separator */}
        <span className="text-muted-foreground/50">/</span>

        {/* Project Name */}
        <div className="space-y-1">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      <Skeleton className="h-9 w-9" />
    </header>
  )
}
