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
import { Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { KnowledgeReadiness } from '@/lib/agent/cim-mvp'
import { formatComponentReference } from '@/lib/cim/reference-utils'
import type { SlideUpdate, CIMPhase, ComponentType as MVPComponentType, WorkflowProgress, CIMOutline } from '@/lib/agent/cim-mvp'
import type { Slide, ComponentType as LegacyComponentType } from '@/lib/types/cim'

/**
 * Map MVP component types to legacy component types for database storage
 * The MVP agent uses an expanded set of 50+ component types, but the database
 * schema uses a limited set of 7 types. This function maps the expanded types
 * to the closest legacy equivalent.
 */
function mapComponentType(mvpType: MVPComponentType): LegacyComponentType {
  // Direct mappings
  if (mvpType === 'title' || mvpType === 'subtitle' || mvpType === 'text' || mvpType === 'table' || mvpType === 'image') {
    return mvpType as LegacyComponentType
  }

  // List types -> bullet
  if (mvpType === 'bullet_list' || mvpType === 'numbered_list') {
    return 'bullet'
  }

  // Chart types -> chart
  if ([
    'bar_chart', 'horizontal_bar_chart', 'stacked_bar_chart', 'line_chart',
    'area_chart', 'pie_chart', 'waterfall_chart', 'combo_chart', 'scatter_plot',
    'gauge', 'progress_bar', 'sparkline', 'funnel', 'gantt_chart',
    'growth_trajectory', 'revenue_breakdown', 'unit_economics', 'valuation_summary'
  ].includes(mvpType)) {
    return 'chart'
  }

  // Table-like types -> table
  if ([
    'comparison_table', 'financial_table', 'feature_comparison',
    'metric', 'metric_group', 'swot', 'matrix', 'pros_cons'
  ].includes(mvpType)) {
    return 'table'
  }

  // Visual/image types -> image
  if ([
    'image_placeholder', 'logo_grid', 'icon_grid', 'screenshot', 'diagram',
    'map', 'location_list', 'org_chart', 'team_grid', 'hierarchy',
    'timeline', 'milestone_timeline', 'flowchart', 'pipeline', 'process_steps',
    'cycle', 'venn', 'versus', 'pyramid', 'hub_spoke'
  ].includes(mvpType)) {
    return 'image'
  }

  // Text-like types -> text
  if ([
    'heading', 'quote', 'callout', 'callout_group', 'stat_highlight',
    'key_takeaway', 'annotation'
  ].includes(mvpType)) {
    return 'text'
  }

  // Default fallback
  return 'text'
}

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
      type: mapComponentType(c.type),
      content: typeof c.content === 'string' ? c.content : JSON.stringify(c.content),
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
  // Knowledge source props (Story: CIM Knowledge Toggle)
  useJsonKnowledge?: boolean // true = JSON file, false = Graphiti/Neo4j
  knowledgePath?: string // Path to JSON file when in JSON mode
  dealId?: string // Deal ID for Graphiti mode
}

export function CIMBuilderPage({
  projectId,
  cimId,
  initialCIMTitle,
  // Story: CIM Knowledge Toggle - renamed from useJsonKnowledge
  useJsonKnowledge: initialUseJsonKnowledge = true, // Default to JSON for safety
  knowledgePath,
  dealId,
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
    updateSlides,
    refresh,
  } = useCIMBuilder(projectId, cimId)

  // Story: CIM Knowledge Toggle - knowledge source selection
  // Toggle ON = JSON knowledge (dev/testing), Toggle OFF = Graphiti/Neo4j (production)
  // Environment variable NEXT_PUBLIC_CIM_DEFAULT_JSON_MODE controls production default (AC #6)
  const envDefaultJsonMode = process.env.NEXT_PUBLIC_CIM_DEFAULT_JSON_MODE !== 'false'
  const [useJsonKnowledge, setUseJsonKnowledge] = React.useState(initialUseJsonKnowledge ?? envDefaultJsonMode)

  // Real-time slide updates from MVP agent
  const [slideUpdates, setSlideUpdates] = React.useState<Map<string, SlideUpdate>>(new Map())

  // Current CIM phase from MVP agent
  const [currentPhase, setCurrentPhase] = React.useState<CIMPhase>('executive_summary')

  // Story 10: Workflow state from MVP agent
  const [workflowProgress, setWorkflowProgress] = React.useState<WorkflowProgress | null>(null)
  const [cimOutline, setCimOutline] = React.useState<CIMOutline | null>(null)

  // Story: CIM Knowledge Toggle - readiness check state
  const [knowledgeReadiness, setKnowledgeReadiness] = React.useState<KnowledgeReadiness | null>(null)
  const [showReadinessWarning, setShowReadinessWarning] = React.useState(false)
  const [isCheckingReadiness, setIsCheckingReadiness] = React.useState(false)

  // Handle slide update from MVP agent - persist to database
  const handleSlideUpdate = React.useCallback((slide: SlideUpdate) => {
    console.log('[CIMBuilderPage] Received slide update:', slide.slideId, slide.title, slide.components.length, 'components')

    // Update local state for immediate display
    setSlideUpdates((prev) => {
      const next = new Map(prev)
      next.set(slide.slideId, slide)
      console.log('[CIMBuilderPage] Total slides now:', next.size)
      return next
    })

    // Convert to DB format and persist
    const dbSlide = slideUpdateToSlide(slide)
    const existingSlides = cim?.slides || []

    // Merge: update existing slide or append new one
    const slideIndex = existingSlides.findIndex(s => s.id === dbSlide.id)
    let updatedSlides: Slide[]
    if (slideIndex >= 0) {
      updatedSlides = [...existingSlides]
      updatedSlides[slideIndex] = dbSlide
    } else {
      updatedSlides = [...existingSlides, dbSlide]
    }

    // Persist to database
    updateSlides(updatedSlides)
    console.log('[CIMBuilderPage] Persisted slide to database:', slide.slideId)
  }, [cim?.slides, updateSlides])

  // Handle phase change from MVP agent
  const handlePhaseChange = React.useCallback((phase: CIMPhase) => {
    setCurrentPhase(phase)
  }, [])

  // Story 10: Handle workflow progress updates
  const handleWorkflowProgress = React.useCallback((progress: WorkflowProgress) => {
    setWorkflowProgress(progress)
  }, [])

  // Story 10: Handle outline created
  const handleOutlineCreated = React.useCallback((outline: CIMOutline) => {
    setCimOutline(outline)
    refresh() // Sync with database
  }, [refresh])

  // Story 10: Handle outline updated
  const handleOutlineUpdated = React.useCallback((outline: CIMOutline) => {
    setCimOutline(outline)
    refresh()
  }, [refresh])

  // Story 10: Handle section started (auto-navigate to section)
  const handleSectionStarted = React.useCallback((sectionId: string, _sectionTitle: string) => {
    // Update workflow progress with current section
    setWorkflowProgress((prev) =>
      prev
        ? {
            ...prev,
            currentSectionId: sectionId,
          }
        : null
    )
  }, [])

  // Story: CIM Knowledge Toggle - handle toggle change with readiness check
  const handleKnowledgeModeToggle = React.useCallback(async (useJson: boolean) => {
    // If switching to JSON mode, just do it
    if (useJson) {
      setUseJsonKnowledge(true)
      return
    }

    // If switching to Graphiti mode, check readiness first
    setIsCheckingReadiness(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/cims/knowledge-readiness`)
      if (!response.ok) {
        console.error('[CIMBuilderPage] Readiness check failed:', response.status)
        // Allow switch but don't show readiness
        setUseJsonKnowledge(false)
        return
      }

      const readiness = await response.json() as KnowledgeReadiness
      setKnowledgeReadiness(readiness)

      if (readiness.level === 'insufficient') {
        // Show warning dialog
        setShowReadinessWarning(true)
      } else {
        // Good enough, switch immediately
        setUseJsonKnowledge(false)
      }
    } catch (error) {
      console.error('[CIMBuilderPage] Readiness check error:', error)
      // Allow switch on error
      setUseJsonKnowledge(false)
    } finally {
      setIsCheckingReadiness(false)
    }
  }, [projectId])

  // Handle confirming switch despite warning
  const handleConfirmGraphitiSwitch = React.useCallback(() => {
    setUseJsonKnowledge(false)
    setShowReadinessWarning(false)
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
    if (!useJsonKnowledge || slideUpdates.size === 0) {
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
  }, [cim?.slides, slideUpdates, useJsonKnowledge])

  // Story 10: Handle section click in outline tree (navigate to first slide of section)
  const handleOutlineSectionClick = React.useCallback(
    (sectionId: string) => {
      // Try to find a slide in mergedSlides that belongs to this section
      const slideIndex = mergedSlides.findIndex((s) => s.section_id === sectionId)
      if (slideIndex !== -1) {
        setCurrentSlideIndex(slideIndex)
      }
    },
    [mergedSlides, setCurrentSlideIndex]
  )

  // Story 10: Handle slide click in outline tree (navigate to specific slide)
  const handleOutlineSlideClick = React.useCallback(
    (slideId: string) => {
      const slideIndex = mergedSlides.findIndex((s) => s.id === slideId)
      if (slideIndex !== -1) {
        setCurrentSlideIndex(slideIndex)
      }
    },
    [mergedSlides, setCurrentSlideIndex]
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
            {useJsonKnowledge && workflowProgress && ` | Stage: ${workflowProgress.currentStage.replace(/_/g, ' ')}`}
            {useJsonKnowledge && workflowProgress?.currentSectionId && ` | Section: ${workflowProgress.currentSectionId}`}
            {useJsonKnowledge && !workflowProgress && ` | Phase: ${currentPhase.replace(/_/g, ' ')}`}
            {useJsonKnowledge && slideUpdates.size > 0 && ` | ${slideUpdates.size} new`}
          </p>
        </div>
        {/* Knowledge Source Toggle (Story: CIM Knowledge Toggle) */}
        <div className="flex items-center gap-2">
          <Switch
            id="knowledge-mode-toggle"
            checked={useJsonKnowledge}
            onCheckedChange={handleKnowledgeModeToggle}
            disabled={isCheckingReadiness}
          />
          <Label htmlFor="knowledge-mode-toggle" className="text-sm text-muted-foreground">
            {isCheckingReadiness ? 'Checking...' : useJsonKnowledge ? 'Dev Mode (JSON)' : 'Live Data (Neo4j)'}
          </Label>
          {/* Readiness badge for Graphiti mode */}
          {!useJsonKnowledge && knowledgeReadiness && (
            <Badge
              variant={
                knowledgeReadiness.level === 'good' ? 'default' :
                knowledgeReadiness.level === 'limited' ? 'secondary' : 'destructive'
              }
              className="text-xs"
            >
              {knowledgeReadiness.score}% ready
            </Badge>
          )}
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
              // Story 10: Pass outline tree data
              cimOutline={cimOutline}
              sectionProgress={workflowProgress?.sectionProgress}
              currentSectionId={workflowProgress?.currentSectionId}
              onSlideClick={handleOutlineSlideClick}
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
              // Knowledge source props (Story: CIM Knowledge Toggle)
              knowledgeMode={useJsonKnowledge ? 'json' : 'graphiti'}
              knowledgePath={knowledgePath}
              dealId={dealId || projectId}
              onSlideUpdate={handleSlideUpdate}
              onPhaseChange={handlePhaseChange}
              // Story 10: New workflow callbacks
              onWorkflowProgress={handleWorkflowProgress}
              onOutlineCreated={handleOutlineCreated}
              onOutlineUpdated={handleOutlineUpdated}
              onSectionStarted={handleSectionStarted}
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

      {/* Story: CIM Knowledge Toggle - Readiness Warning Dialog */}
      <AlertDialog open={showReadinessWarning} onOpenChange={setShowReadinessWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Limited Data Coverage
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                The knowledge graph has limited data for this deal.
                The AI may not have enough information to create a complete CIM.
              </p>
              {knowledgeReadiness && (
                <div className="bg-muted p-3 rounded-md text-sm space-y-2">
                  <div className="font-medium">Coverage Details:</div>
                  <ul className="space-y-1">
                    <li>Financial data: {knowledgeReadiness.details.financialCoverage}%</li>
                    <li>Market data: {knowledgeReadiness.details.marketCoverage}%</li>
                    <li>Company data: {knowledgeReadiness.details.companyCoverage}%</li>
                    <li>Documents indexed: {knowledgeReadiness.details.documentCount}</li>
                  </ul>
                  {knowledgeReadiness.recommendations.length > 0 && (
                    <>
                      <div className="font-medium mt-2">Recommendations:</div>
                      <ul className="list-disc list-inside">
                        {knowledgeReadiness.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in Dev Mode</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmGraphitiSwitch}>
              Use Live Data Anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
