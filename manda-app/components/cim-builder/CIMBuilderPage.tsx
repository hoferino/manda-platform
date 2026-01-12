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
 * Story: CIM MVP Fast Track
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
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { formatComponentReference } from '@/lib/cim/reference-utils'
import type { SlideUpdate, CIMPhase } from '@/lib/agent/cim-mvp'
import type { Slide } from '@/lib/types/cim'

/**
 * Convert MVP agent SlideUpdate to database Slide format
 */
function slideUpdateToSlide(update: SlideUpdate): Slide {
  return {
    id: update.slideId,
    section_id: update.sectionId,
    title: update.title,
    components: update.components.map((c) => ({
      id: c.id,
      type: c.type,
      content: c.content,
      metadata: c.data ? { data: c.data } : undefined,
    })),
    visual_concept: null,
    status: update.status === 'approved' ? 'approved' : 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

interface CIMBuilderPageProps {
  projectId: string
  cimId: string
  initialCIMTitle: string
  // MVP agent props
  useMVPAgent?: boolean
  knowledgePath?: string
}

export function CIMBuilderPage({
  projectId,
  cimId,
  initialCIMTitle,
  useMVPAgent: initialUseMVPAgent = true, // Default to MVP agent for testing
  knowledgePath,
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

  // MVP agent toggle state
  const [useMVPAgent, setUseMVPAgent] = React.useState(initialUseMVPAgent)

  // Real-time slide updates from MVP agent
  const [slideUpdates, setSlideUpdates] = React.useState<Map<string, SlideUpdate>>(new Map())

  // Current CIM phase from MVP agent
  const [currentPhase, setCurrentPhase] = React.useState<CIMPhase>('executive_summary')

  // Handle slide update from MVP agent
  const handleSlideUpdate = React.useCallback((slide: SlideUpdate) => {
    console.log('[CIMBuilderPage] Received slide update:', slide.slideId, slide.title, slide.components.length, 'components')
    setSlideUpdates((prev) => {
      const next = new Map(prev)
      next.set(slide.slideId, slide)
      console.log('[CIMBuilderPage] Total slides now:', next.size)
      return next
    })
    // Also trigger refresh to persist
    refresh()
  }, [refresh])

  // Handle phase change from MVP agent
  const handlePhaseChange = React.useCallback((phase: CIMPhase) => {
    setCurrentPhase(phase)
  }, [])

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

  // Merge database slides with real-time MVP agent slides
  // MVP slides take precedence and are appended if new
  const mergedSlides = React.useMemo(() => {
    if (!useMVPAgent || slideUpdates.size === 0) {
      return cim?.slides || []
    }

    const dbSlides = cim?.slides || []
    const mvpSlides = Array.from(slideUpdates.values()).map(slideUpdateToSlide)

    // Create a map of all slides, with MVP slides overriding DB slides by ID
    const slideMap = new Map<string, Slide>()
    for (const slide of dbSlides) {
      slideMap.set(slide.id, slide)
    }
    for (const slide of mvpSlides) {
      slideMap.set(slide.id, slide)
    }

    // Return slides in order: DB slides first, then new MVP slides
    const result: Slide[] = []
    const addedIds = new Set<string>()

    // Add DB slides (potentially overridden by MVP)
    for (const slide of dbSlides) {
      result.push(slideMap.get(slide.id)!)
      addedIds.add(slide.id)
    }

    // Add new MVP slides not in DB
    for (const slide of mvpSlides) {
      if (!addedIds.has(slide.id)) {
        result.push(slide)
        addedIds.add(slide.id)
      }
    }

    return result
  }, [cim?.slides, slideUpdates, useMVPAgent])

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
      {/* Header with back navigation, MVP toggle, and export button */}
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
            {mergedSlides.length} slides | {cim.outline.length} sections
            {useMVPAgent && ` | Phase: ${currentPhase.replace(/_/g, ' ')}`}
            {useMVPAgent && slideUpdates.size > 0 && ` | ${slideUpdates.size} new`}
          </p>
        </div>
        {/* MVP Agent Toggle */}
        <div className="flex items-center gap-2">
          <Switch
            id="mvp-agent-toggle"
            checked={useMVPAgent}
            onCheckedChange={setUseMVPAgent}
          />
          <Label htmlFor="mvp-agent-toggle" className="text-sm text-muted-foreground">
            MVP Agent
          </Label>
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
              onCIMStateChanged={refresh}
              // MVP agent props
              useMVPAgent={useMVPAgent}
              knowledgePath={knowledgePath}
              onSlideUpdate={handleSlideUpdate}
              onPhaseChange={handlePhaseChange}
            />
          }
          previewPanel={
            <PreviewPanel
              slides={mergedSlides}
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
