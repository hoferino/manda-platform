/**
 * Dashboard Section Page
 * Project overview and metrics (placeholder)
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #4, #5)
 */

import type { Metadata } from 'next'
import { Home } from 'lucide-react'
import { PlaceholderSection } from '@/components/workspace'

export const metadata: Metadata = {
  title: 'Dashboard - Manda',
  description: 'Project overview and metrics',
}

export default function DashboardPage() {
  return (
    <PlaceholderSection
      title="Dashboard"
      description="Project overview and metrics will appear here. Track deal progress, document status, and key findings at a glance."
      epic={2}
      icon={Home}
    />
  )
}
