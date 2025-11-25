/**
 * Data Room Section Page
 * Document management and organization (placeholder)
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #4, #5)
 */

import type { Metadata } from 'next'
import { Folder } from 'lucide-react'
import { PlaceholderSection } from '@/components/workspace'

export const metadata: Metadata = {
  title: 'Data Room - Manda',
  description: 'Document management and organization',
}

export default function DataRoomPage() {
  return (
    <PlaceholderSection
      title="Data Room"
      description="Upload, organize, and manage due diligence documents. View files by folder structure or categorized buckets."
      epic={2}
      icon={Folder}
    />
  )
}
