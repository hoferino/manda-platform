/**
 * Breadcrumb Navigation Component
 * Shows folder path with clickable segments
 * Story: E2.2 - Build Data Room Folder Structure View (AC: #8)
 */

'use client'

import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BreadcrumbProps {
  folderPath: string | null
  onNavigate: (path: string | null) => void
}

export function Breadcrumb({ folderPath, onNavigate }: BreadcrumbProps) {
  const segments = folderPath ? folderPath.split('/').filter(Boolean) : []

  return (
    <nav className="flex items-center gap-1 text-sm">
      {/* Root / Home */}
      <button
        className={cn(
          'flex items-center gap-1 rounded px-2 py-1 hover:bg-muted',
          !folderPath && 'font-medium'
        )}
        onClick={() => onNavigate(null)}
      >
        <Home className="h-4 w-4" />
        <span>All Documents</span>
      </button>

      {/* Path segments */}
      {segments.map((segment, index) => {
        const path = segments.slice(0, index + 1).join('/')
        const isLast = index === segments.length - 1

        return (
          <div key={path} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button
              className={cn(
                'rounded px-2 py-1 hover:bg-muted',
                isLast && 'font-medium'
              )}
              onClick={() => onNavigate(path)}
            >
              {segment}
            </button>
          </div>
        )
      })}
    </nav>
  )
}
