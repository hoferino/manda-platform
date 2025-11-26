/**
 * Top Navigation Bar Component
 * Shows project name, breadcrumb, and actions menu
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #2, #9, #11)
 * Story: E2.7 - Build Upload Progress Indicators (AC: #8 - Background Upload Tracking)
 */

'use client'

import Link from 'next/link'
import { ArrowLeft, Menu, MoreVertical, Archive, Settings, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { useSidebarStore } from './sidebar-store'
import { UploadIndicator } from '@/components/upload-indicator'
import type { Deal } from '@/lib/supabase/types'

interface TopNavProps {
  project: Deal
}

export function TopNav({ project }: TopNavProps) {
  const { toggle } = useSidebarStore()

  const handleArchive = () => {
    toast.info('Archive feature coming soon')
  }

  const handleSettings = () => {
    toast.info('Settings feature coming soon')
  }

  const handleDelete = () => {
    toast.info('Delete feature coming soon')
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:px-6">
      {/* Left Section: Menu, Breadcrumb, Project Name */}
      <div className="flex items-center gap-3">
        {/* Mobile Menu Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={toggle}
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Breadcrumb */}
        <Link
          href="/projects"
          className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Projects</span>
        </Link>

        {/* Separator */}
        <span className="text-muted-foreground/50">/</span>

        {/* Project Info */}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">{project.name}</h1>
          {project.company_name && (
            <p className="truncate text-xs text-muted-foreground">
              {project.company_name}
            </p>
          )}
        </div>
      </div>

      {/* Right Section: Actions */}
      <div className="flex items-center gap-2">
        {/* E2.7: Upload Indicator - shows background upload progress */}
        <UploadIndicator />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Project actions">
              <MoreVertical className="h-5 w-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleSettings}>
              <Settings className="mr-2 h-4 w-4" />
              Project Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive}>
              <Archive className="mr-2 h-4 w-4" />
              Archive Project
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Project
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
