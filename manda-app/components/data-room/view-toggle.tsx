/**
 * View Toggle Component
 * Switches between Folder and Buckets views in Data Room
 * Story: E2.4 - Implement View Toggle and User Preference
 *
 * Features:
 * - Toggle button with folder/bucket icons
 * - Saves preference to localStorage per project
 * - Accessible with proper ARIA labels
 * - Responsive design
 */

'use client'

import { useCallback, useEffect, useState } from 'react'
import { Folders, LayoutGrid } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export type DataRoomView = 'folders' | 'buckets'

const STORAGE_KEY_PREFIX = 'dataroom-view-'

interface ViewToggleProps {
  projectId: string
  value: DataRoomView
  onChange: (view: DataRoomView) => void
  className?: string
}

/**
 * Get the localStorage key for a project's view preference
 */
function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`
}

/**
 * Load saved view preference from localStorage
 * Returns 'folders' as default if no preference saved
 */
export function loadViewPreference(projectId: string): DataRoomView {
  if (typeof window === 'undefined') return 'folders'

  try {
    const saved = localStorage.getItem(getStorageKey(projectId))
    if (saved === 'folders' || saved === 'buckets') {
      return saved
    }
  } catch {
    // localStorage may be unavailable (e.g., private browsing)
    console.warn('Unable to access localStorage for view preference')
  }

  return 'folders' // Default to folders view
}

/**
 * Save view preference to localStorage
 */
export function saveViewPreference(projectId: string, view: DataRoomView): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(getStorageKey(projectId), view)
  } catch {
    console.warn('Unable to save view preference to localStorage')
  }
}

/**
 * Hook to manage view preference with localStorage persistence
 */
export function useViewPreference(projectId: string): [DataRoomView, (view: DataRoomView) => void] {
  const [view, setViewState] = useState<DataRoomView>('folders')
  const [isHydrated, setIsHydrated] = useState(false)

  // Load preference on mount (client-side only)
  useEffect(() => {
    const saved = loadViewPreference(projectId)
    setViewState(saved)
    setIsHydrated(true)
  }, [projectId])

  // Save preference when view changes
  const setView = useCallback(
    (newView: DataRoomView) => {
      setViewState(newView)
      saveViewPreference(projectId, newView)
    },
    [projectId]
  )

  return [isHydrated ? view : 'folders', setView]
}

/**
 * ViewToggle component with icons and accessibility
 * Note: Removed Tooltip wrappers as they interfere with TabsTrigger click events
 */
export function ViewToggle({ projectId, value, onChange, className }: ViewToggleProps) {
  const handleValueChange = (newValue: string) => {
    if (newValue === 'folders' || newValue === 'buckets') {
      onChange(newValue)
    }
  }

  return (
    <Tabs
      value={value}
      onValueChange={handleValueChange}
      className={className}
    >
      <TabsList className="h-9">
        <TabsTrigger
          value="folders"
          className="gap-2 px-3"
          aria-label="Switch to folder view"
        >
          <Folders className="h-4 w-4" />
          <span className="hidden sm:inline">Folders</span>
        </TabsTrigger>

        <TabsTrigger
          value="buckets"
          className="gap-2 px-3"
          aria-label="Switch to buckets view"
        >
          <LayoutGrid className="h-4 w-4" />
          <span className="hidden sm:inline">Buckets</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
