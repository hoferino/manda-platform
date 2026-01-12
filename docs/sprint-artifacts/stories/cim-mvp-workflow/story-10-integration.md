# Story 10: Integration & Wiring

**File:** `manda-app/components/cim-builder/CIMBuilderPage.tsx`
**Completion Promise:** `INTEGRATION_COMPLETE`
**Max Iterations:** 20

---

## Overview

Wire up all the new components and state. Connect the useCIMMVPChat hook's new outputs to the SourcesPanel (outline tree) and PreviewPanel (thumbnails + wireframes).

## Dependencies

- All previous stories (1-9) must be complete

## Tasks

- [ ] 10.1 Add state for outline and workflowProgress
  - Get from useCIMMVPChat hook
  - Initialize from cim data if available

- [ ] 10.2 Pass outline data to SourcesPanel
  - Add outline prop
  - Add sectionProgress prop (from workflowProgress)
  - Add currentSectionId prop

- [ ] 10.3 Pass workflowProgress to header/status display
  - Show current workflow stage in header
  - Show section being worked on

- [ ] 10.4 Wire up onOutlineCreated callback
  - Update local outline state
  - Trigger refresh if needed

- [ ] 10.5 Wire up onWorkflowProgress callback
  - Update local workflowProgress state
  - Update header display

- [ ] 10.6 Wire up onSectionStarted callback
  - Update current section indicator
  - Potentially scroll to section in outline tree

- [ ] 10.7 Update slide merging logic for new layout format
  - Handle slides with layoutType
  - Preserve layout information when merging MVP slides with DB slides

- [ ] 10.8 Handle section click in outline tree
  - Navigate to first slide of section
  - Or scroll to section divider slide

- [ ] 10.9 Handle slide click in outline tree
  - Navigate to specific slide in preview

- [ ] 10.10 Run `npm run type-check` - must pass with no errors

- [ ] 10.11 Run `npm run build` - must complete successfully

## Updated CIMBuilderPage

```tsx
export function CIMBuilderPage({
  projectId,
  cimId,
  initialCIMTitle,
  useMVPAgent: initialUseMVPAgent = true,
  knowledgePath,
}: CIMBuilderPageProps) {
  // Existing hook
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

  const [useMVPAgent, setUseMVPAgent] = React.useState(initialUseMVPAgent)
  const [slideUpdates, setSlideUpdates] = React.useState<Map<string, SlideUpdate>>(new Map())
  const [currentPhase, setCurrentPhase] = React.useState<CIMPhase>('executive_summary')

  // NEW: Workflow state
  const [workflowProgress, setWorkflowProgress] = React.useState<WorkflowProgress | null>(null)
  const [cimOutline, setCimOutline] = React.useState<CIMOutline | null>(null)

  // Handle slide update (existing, but update for layoutType)
  const handleSlideUpdate = React.useCallback((slide: SlideUpdate) => {
    setSlideUpdates((prev) => {
      const next = new Map(prev)
      next.set(slide.slideId, slide)
      return next
    })
    refresh()
  }, [refresh])

  // NEW: Handle workflow progress
  const handleWorkflowProgress = React.useCallback((progress: WorkflowProgress) => {
    setWorkflowProgress(progress)
  }, [])

  // NEW: Handle outline created
  const handleOutlineCreated = React.useCallback((outline: CIMOutline) => {
    setCimOutline(outline)
    refresh() // Sync with database
  }, [refresh])

  // NEW: Handle outline updated
  const handleOutlineUpdated = React.useCallback((outline: CIMOutline) => {
    setCimOutline(outline)
    refresh()
  }, [refresh])

  // NEW: Handle section started
  const handleSectionStarted = React.useCallback((sectionId: string, sectionTitle: string) => {
    // Find first slide of this section and navigate to it
    const sectionDividerSlideId = `divider-${sectionId}`
    const slideIndex = mergedSlides.findIndex(s => s.id === sectionDividerSlideId)
    if (slideIndex !== -1) {
      setCurrentSlideIndex(slideIndex)
    }
  }, [mergedSlides, setCurrentSlideIndex])

  // NEW: Handle section click in outline tree
  const handleOutlineSectionClick = React.useCallback((sectionId: string) => {
    const sectionDividerSlideId = `divider-${sectionId}`
    const slideIndex = mergedSlides.findIndex(s => s.id === sectionDividerSlideId)
    if (slideIndex !== -1) {
      setCurrentSlideIndex(slideIndex)
    }
  }, [mergedSlides, setCurrentSlideIndex])

  // NEW: Handle slide click in outline tree
  const handleOutlineSlideClick = React.useCallback((slideId: string) => {
    const slideIndex = mergedSlides.findIndex(s => s.id === slideId)
    if (slideIndex !== -1) {
      setCurrentSlideIndex(slideIndex)
    }
  }, [mergedSlides, setCurrentSlideIndex])

  // Update mergedSlides to handle layoutType
  const mergedSlides = React.useMemo(() => {
    // ... existing logic, but preserve layoutType from slideUpdates
  }, [cim?.slides, slideUpdates, useMVPAgent])

  // ... rest of component

  return (
    <div className="h-full flex flex-col">
      {/* Header with workflow stage display */}
      <div className="flex items-center gap-4 px-4 py-3 border-b bg-background flex-shrink-0">
        {/* ... existing header content ... */}
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold truncate">{cim.title}</h1>
          <p className="text-xs text-muted-foreground">
            {mergedSlides.length} slides | {cim.outline.length} sections
            {useMVPAgent && workflowProgress && ` | Stage: ${workflowProgress.currentStage.replace(/_/g, ' ')}`}
            {useMVPAgent && workflowProgress?.currentSectionId && ` | Section: ${workflowProgress.currentSectionId}`}
          </p>
        </div>
        {/* ... toggle and export ... */}
      </div>

      {/* Main 3-panel layout */}
      <div className="flex-1 overflow-hidden">
        <CIMBuilderLayout
          sourcesPanel={
            <SourcesPanel
              projectId={projectId}
              outline={cim.outline}
              // NEW: Pass outline tree data
              cimOutline={cimOutline}
              sectionProgress={workflowProgress?.sectionProgress}
              currentSectionId={workflowProgress?.currentSectionId}
              onOutlineSectionClick={handleOutlineSectionClick}
              onOutlineSlideClick={handleOutlineSlideClick}
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
              useMVPAgent={useMVPAgent}
              knowledgePath={knowledgePath}
              onSlideUpdate={handleSlideUpdate}
              onPhaseChange={handlePhaseChange}
              // NEW: Pass new callbacks
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
    </div>
  )
}
```

## Acceptance Criteria

1. All new state flows correctly from hook to components
2. Outline tree displays and updates correctly
3. Workflow progress shows in header
4. Section/slide clicks navigate preview
5. Slide merging preserves layoutType
6. `npm run type-check` passes with no errors
7. `npm run build` completes successfully

## Ralph Command

```bash
/ralph-loop "Implement Story 10 from docs/sprint-artifacts/stories/cim-mvp-workflow/story-10-integration.md.

Read the story file for integration specifications.

Update manda-app/components/cim-builder/CIMBuilderPage.tsx to wire everything together.

You may also need to update:
- ConversationPanel to pass new callbacks to useCIMMVPChat
- SourcesPanel props interface

After changes, run 'cd manda-app && npm run type-check'.
Then run 'cd manda-app && npm run build'.

If either fails, fix the errors before proceeding.

Output <promise>INTEGRATION_COMPLETE</promise> when all tasks are done and both type-check AND build pass." --max-iterations 20 --completion-promise "INTEGRATION_COMPLETE"
```
