/**
 * Data Room Page
 * Supports Folders view (E2.2) and Buckets view (E2.3)
 * Story: E2.2 - Build Data Room Folder Structure View
 * Story: E2.3 - Build Data Room Buckets View
 */

import type { Metadata } from 'next'
import { DataRoomWrapper } from './data-room-wrapper'

export const metadata: Metadata = {
  title: 'Data Room - Manda',
  description: 'Document management and organization',
}

interface DataRoomPageProps {
  params: Promise<{ id: string }>
}

export default async function DataRoomPage({ params }: DataRoomPageProps) {
  const { id: projectId } = await params

  return <DataRoomWrapper projectId={projectId} />
}
