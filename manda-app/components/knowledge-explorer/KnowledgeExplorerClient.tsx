/**
 * KnowledgeExplorerClient Component
 * Main client component for Knowledge Explorer with tab navigation
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #1)
 * Story: E4.6 - Build Contradictions View (AC: #1)
 * Story: E4.8 - Build Gap Analysis View (AC: #1)
 *
 * Features:
 * - Tab navigation: Findings, Contradictions, Gap Analysis
 * - Findings Browser as default view
 * - Contradictions View for resolving conflicts
 * - Gap Analysis View for identifying missing information
 */

'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { FindingsBrowser } from './findings'
import { ContradictionsView } from './contradictions'
import { GapAnalysisView } from './gaps'
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

  return (
    <div className="flex flex-col h-full">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as TabValue)}
        className="flex flex-col h-full"
      >
        {/* Tab Navigation */}
        <div className="border-b bg-background px-6 py-2">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="findings" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Findings</span>
              {findingsCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {findingsCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="contradictions" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              <span>Contradictions</span>
              {contradictionsCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-xs">
                  {contradictionsCount}
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
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto">
          <TabsContent value="findings" className="h-full m-0">
            <FindingsBrowser projectId={projectId} documents={documents} />
          </TabsContent>

          <TabsContent value="contradictions" className="h-full m-0 p-6">
            <ContradictionsView projectId={projectId} />
          </TabsContent>

          <TabsContent value="gaps" className="h-full m-0 p-6">
            <GapAnalysisView projectId={projectId} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
