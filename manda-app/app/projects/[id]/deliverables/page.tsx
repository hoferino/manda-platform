/**
 * Deliverables Section Page
 * CIM, Q&A, and IRL outputs (placeholder)
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #4, #5)
 */

import type { Metadata } from 'next'
import { FileText } from 'lucide-react'
import { PlaceholderSection } from '@/components/workspace'

export const metadata: Metadata = {
  title: 'Deliverables - Manda',
  description: 'CIM, Q&A, and IRL outputs',
}

export default function DeliverablesPage() {
  return (
    <PlaceholderSection
      title="Deliverables"
      description="Create and manage deal deliverables including Company Information Memorandums (CIM), Q&A lists, and Information Request Lists (IRL)."
      epic={9}
      icon={FileText}
    />
  )
}
