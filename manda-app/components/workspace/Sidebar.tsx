/**
 * Sidebar Navigation Component
 * Shows 5 workspace sections with active state highlighting
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #3, #6)
 */

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { WORKSPACE_NAV_ITEMS } from '@/lib/workspace-navigation'
import { useSidebarStore } from './sidebar-store'

interface SidebarProps {
  projectId: string
}

export function Sidebar({ projectId }: SidebarProps) {
  const pathname = usePathname()
  const { isOpen, close } = useSidebarStore()

  const isActive = (itemPath: string) => {
    return pathname === `/projects/${projectId}/${itemPath}`
  }

  const handleNavClick = () => {
    // Close sidebar on mobile when clicking a nav item
    if (window.innerWidth < 1024) {
      close()
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-16 z-50 flex h-[calc(100vh-4rem)] w-[240px] flex-col border-r bg-background transition-transform duration-200 lg:static lg:z-0 lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Mobile Close Button */}
        <div className="flex items-center justify-end p-2 lg:hidden">
          <Button variant="ghost" size="icon" onClick={close}>
            <X className="h-5 w-5" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1 p-4" role="navigation" aria-label="Project navigation">
          {WORKSPACE_NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)

            return (
              <Link
                key={item.id}
                href={`/projects/${projectId}/${item.path}`}
                onClick={handleNavClick}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
