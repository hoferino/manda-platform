/**
 * Knowledge Explorer Section Page
 * Semantic search and knowledge graph (placeholder)
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #4, #5)
 */

import type { Metadata } from 'next'
import { Brain } from 'lucide-react'
import { PlaceholderSection } from '@/components/workspace'

export const metadata: Metadata = {
  title: 'Knowledge Explorer - Manda',
  description: 'Semantic search and knowledge graph',
}

export default function KnowledgeExplorerPage() {
  return (
    <PlaceholderSection
      title="Knowledge Explorer"
      description="Explore findings, entities, patterns, and contradictions extracted from your documents using AI-powered analysis."
      epic={3}
      icon={Brain}
    />
  )
}
