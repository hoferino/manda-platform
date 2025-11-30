/**
 * KnowledgeExplorerClient Component
 * Main client component for Knowledge Explorer with tab navigation
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #1)
 * Story: E4.6 - Build Contradictions View (AC: #1)
 * Story: E4.8 - Build Gap Analysis View (AC: #1)
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates (AC: #1-8)
 *
 * Features:
 * - Tab navigation: Findings, Contradictions, Gap Analysis
 * - Findings Browser as default view
 * - Contradictions View for resolving conflicts
 * - Gap Analysis View for identifying missing information
 * - Real-time updates via Supabase Realtime subscriptions
 * - Connection status indicator
 * - Auto-refresh toggle with keyboard shortcut
 * - Toast notifications for new findings/contradictions
 */

'use client'

import { useState, useCallback, useRef } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { FindingsBrowser } from './findings'
import { ContradictionsView } from './contradictions'
import { GapAnalysisView } from './gaps'
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator'
import { AutoRefreshToggle } from './AutoRefreshToggle'
import { useRealtimeToasts } from './RealtimeToastHandler'
import { useKnowledgeExplorerRealtime } from '@/lib/hooks'
import type { FindingUpdate } from '@/lib/hooks/useFindingsRealtime'
import type { ContradictionUpdate } from '@/lib/hooks/useContradictionsRealtime'
import { FileText, AlertTriangle, HelpCircle } from 'lucide-react'

interface KnowledgeExplorerClientProps {
  projectId: string
  documents: { id: string; name: string }[]
  findingsCount?: number
  contradictionsCount?: number
  gapsCount?: number
}

type TabValue = 'findings' | 'contradictions' | 'gaps'

export function KnowledgeExplorerClient({
  projectId,
  documents,
  findingsCount = 0,
  contradictionsCount = 0,
  gapsCount = 0,
}: KnowledgeExplorerClientProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('findings')

  // Track realtime count updates (offset from initial server counts)
  const [findingsCountOffset, setFindingsCountOffset] = useState(0)
  const [contradictionsCountOffset, setContradictionsCountOffset] = useState(0)

  // Refs for callbacks passed to child components
  const findingsBrowserRefreshRef = useRef<(() => void) | null>(null)
  const contradictionsViewRefreshRef = useRef<(() => void) | null>(null)

  // Toast handler hook
  const {
    handleFindingUpdate: showFindingToast,
    handleContradictionUpdate: showContradictionToast,
  } = useRealtimeToasts({
    projectId,
    enabled: true,
  })

  // Handle finding update from realtime
  const handleFindingUpdate = useCallback(
    (update: FindingUpdate) => {
      // Update count offset
      if (update.type === 'INSERT') {
        setFindingsCountOffset((prev) => prev + 1)
      } else if (update.type === 'DELETE') {
        setFindingsCountOffset((prev) => prev - 1)
      }

      // Show toast notification
      showFindingToast(update)

      // Trigger refresh in FindingsBrowser
      findingsBrowserRefreshRef.current?.()
    },
    [showFindingToast]
  )

  // Handle contradiction update from realtime
  const handleContradictionUpdate = useCallback(
    (update: ContradictionUpdate) => {
      // Update count offset
      if (update.type === 'INSERT') {
        setContradictionsCountOffset((prev) => prev + 1)
      } else if (update.type === 'DELETE') {
        setContradictionsCountOffset((prev) => prev - 1)
      }

      // Show toast notification
      showContradictionToast(update)

      // Trigger refresh in ContradictionsView
      contradictionsViewRefreshRef.current?.()
    },
    [showContradictionToast]
  )

  // Use composite realtime hook
  const {
    status,
    autoRefresh,
    setAutoRefresh,
    reconnect,
    pendingUpdateCount,
    applyPendingUpdates,
  } = useKnowledgeExplorerRealtime(projectId, {
    onFindingsUpdate: handleFindingUpdate,
    onContradictionsUpdate: handleContradictionUpdate,
  })

  // Calculate display counts (initial + realtime offset)
  const displayFindingsCount = Math.max(0, findingsCount + findingsCountOffset)
  const displayContradictionsCount = Math.max(0, contradictionsCount + contradictionsCountOffset)

  // Register refresh callbacks for child components
  const registerFindingsRefresh = useCallback((refresh: () => void) => {
    findingsBrowserRefreshRef.current = refresh
  }, [])

  const registerContradictionsRefresh = useCallback((refresh: () => void) => {
    contradictionsViewRefreshRef.current = refresh
  }, [])

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        className="flex flex-col h-full"
      >
        {/* Tab Navigation with Realtime Controls */}
        <div className="border-b bg-background px-6 py-2">
          <div className="flex items-center justify-between gap-4">
            {/* Tab Triggers */}
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="findings" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Findings</span>
                {displayFindingsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {displayFindingsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="contradictions" className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                <span>Contradictions</span>
                {displayContradictionsCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                    {displayContradictionsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="gaps" className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4" />
                <span>Gap Analysis</span>
                {gapsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {gapsCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* Realtime Controls */}
            <div className="flex items-center gap-3 flex-shrink-0">
              <AutoRefreshToggle
                enabled={autoRefresh}
                onChange={setAutoRefresh}
                pendingCount={pendingUpdateCount}
                onApplyPending={applyPendingUpdates}
              />
              <ConnectionStatusIndicator
                status={status}
                onReconnect={reconnect}
              />
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="findings" className="h-full m-0">
            <FindingsBrowser
              projectId={projectId}
              documents={documents}
              onRegisterRefresh={registerFindingsRefresh}
            />
          </TabsContent>

          <TabsContent value="contradictions" className="h-full m-0 p-6">
            <ContradictionsView
              projectId={projectId}
              onRegisterRefresh={registerContradictionsRefresh}
            />
          </TabsContent>

          <TabsContent value="gaps" className="h-full m-0 p-6">
            <GapAnalysisView projectId={projectId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
