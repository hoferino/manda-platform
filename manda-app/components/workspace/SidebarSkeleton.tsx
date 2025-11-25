/**
 * Sidebar Skeleton Component
 * Shows loading state for sidebar navigation
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #10)
 */

import { Skeleton } from '@/components/ui/skeleton'

export function SidebarSkeleton() {
  return (
    <aside className="hidden h-[calc(100vh-4rem)] w-[240px] flex-col border-r bg-background lg:flex">
      <div className="space-y-1 p-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5">
            <Skeleton className="h-5 w-5 shrink-0" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </aside>
  )
}
