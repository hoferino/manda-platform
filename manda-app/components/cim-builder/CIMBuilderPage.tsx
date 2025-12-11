'use client'

/**
 * CIM Builder Page - Main Orchestration Component
 *
 * Coordinates the 3-panel CIM Builder interface:
 * - Sources Panel: Documents, Findings, Q&A from deal + CIM Structure
 * - Conversation Panel: Chat with AI agent
 * - Preview Panel: Slide preview with navigation
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #1-6 - All acceptance criteria
 */

import * as React from 'react'
import { CIMBuilderLayout } from './CIMBuilderLayout'
import { SourcesPanel } from './SourcesPanel/SourcesPanel'
import { ConversationPanel } from './ConversationPanel/ConversationPanel'
import { PreviewPanel } from './PreviewPanel/PreviewPanel'
import { ExportButton } from './ExportButton'
import { useCIMBuilder } from '@/lib/hooks/useCIMBuilder'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatComponentReference } from '@/lib/cim/reference-utils'

interface CIMBuilderPageProps {
  projectId: string
  cimId: string
  initialCIMTitle: string
}

export function CIMBuilderPage({
  projectId,
  cimId,
  initialCIMTitle,
}: CIMBuilderPageProps) {
  const {
    cim,
    isLoading,
    error,
    sourceRef,
    setSourceRef,
    currentSlideIndex,
    setCurrentSlideIndex,
    addMessage,
    updateOutline,
    refresh,
  } = useCIMBuilder(projectId, cimId)

  // Handle inserting source reference into chat input
  const handleSourceClick = React.useCallback(
    (type: 'document' | 'finding' | 'qa', id: string, title: string) => {
      const emoji = type === 'document' ? '📄' : type === 'finding' ? '💡' : '❓'
      const prefix = type === 'document' ? 'doc' : type === 'finding' ? 'finding' : 'qa'
      const truncatedTitle = title.length > 50 ? `${title.slice(0, 47)}...` : title
      const reference = `${emoji} [${prefix}:${id}] "${truncatedTitle}"`
      setSourceRef(reference)
    },
    [setSourceRef]
  )

  // Handle section click in structure tree
  const handleSectionClick = React.useCallback(
    (sectionId: string) => {
      if (!cim?.outline) return
      const section = cim.outline.find((s) => s.id === sectionId)
      if (section && section.slide_ids.length > 0) {
        // Find the first slide of this section
        const firstSlideId = section.slide_ids[0]
        const slideIndex = cim.slides.findIndex((s) => s.id === firstSlideId)
        if (slideIndex !== -1) {
          setCurrentSlideIndex(slideIndex)
        }
      }
    },
    [cim, setCurrentSlideIndex]
  )

  // Handle component click in preview (E9.9)
  const handleComponentSelect = React.useCallback(
    (componentId: string, content: string) => {
      const reference = formatComponentReference(componentId, content)
      setSourceRef(reference)
    },
    [setSourceRef]
  )

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <p className="text-destructive">Failed to load CIM: {error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={refresh}>
            Try Again
          </Button>
          <Link href={`/projects/${projectId}/cim-builder`}>
            <Button variant="ghost">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to CIMs
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (isLoading || !cim) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-muted-foreground">Loading CIM Builder...</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header with back navigation and export button */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-background flex-shrink-0">
        <Link href={`/projects/${projectId}/cim-builder`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{cim.title}</h1>
          <p className="text-xs text-muted-foreground">
            {cim.slides.length} slides | {cim.outline.length} sections
          </p>
        </div>
        {/* Export Button - E9.14: Wireframe PowerPoint Export */}
        <ExportButton cim={cim} />
      </div>

      {/* Main 3-panel layout */}
      <div className="flex-1 overflow-hidden">
        <CIMBuilderLayout
          sourcesPanel={
            <SourcesPanel
              projectId={projectId}
              outline={cim.outline}
              onSourceClick={handleSourceClick}
              onSectionClick={handleSectionClick}
            />
          }
          conversationPanel={
            <ConversationPanel
              projectId={projectId}
              cimId={cimId}
              conversationHistory={cim.conversationHistory}
              sourceRef={sourceRef}
              onSourceRefClear={() => setSourceRef('')}
              onMessageSent={addMessage}
              onCIMStateChanged={refresh} // Refresh CIM state after tool updates (AC #7)
            />
          }
          previewPanel={
            <PreviewPanel
              slides={cim.slides}
              currentIndex={currentSlideIndex}
              onIndexChange={setCurrentSlideIndex}
              onComponentSelect={handleComponentSelect}
            />
          }
        />
      </div>
    </div>
  )
}
