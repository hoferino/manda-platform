/**
 * Sidebar State Store (Zustand)
 * Manages open/closed state for mobile sidebar
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #7)
 */

import { create } from 'zustand'

interface SidebarStore {
  isOpen: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

export const useSidebarStore = create<SidebarStore>((set) => ({
  isOpen: false,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}))
