'use client'

/**
 * Sources Panel - Left panel of CIM Builder
 *
 * Contains expandable sections for:
 * - Documents from the deal
 * - Findings extracted from documents
 * - Q&A items for the deal
 * - Structure tree showing CIM outline
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #2 - Sources panel with expandable sections
 * AC: #3 - Click-to-reference functionality
 * AC: #6 - Structure sidebar with progress icons
 */

import * as React from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { DocumentsList } from './DocumentsList'
import { FindingsList } from './FindingsList'
import { QAList } from './QAList'
import { StructureTree } from './StructureTree'
import { OutlineTree } from './OutlineTree'
import type { OutlineSection } from '@/lib/types/cim'
import type { CIMOutline, SectionProgress } from '@/lib/agent/cim-mvp'

interface SourcesPanelProps {
  projectId: string
  outline: OutlineSection[]
  onSourceClick: (type: 'document' | 'finding' | 'qa', id: string, title: string) => void
  onSectionClick: (sectionId: string) => void
  // Story 7: New props for CIM MVP workflow outline
  cimOutline?: CIMOutline | null
  sectionProgress?: Record<string, SectionProgress>
  currentSectionId?: string
  currentSlideId?: string
  onSlideClick?: (slideId: string) => void
}

export function SourcesPanel({
  projectId,
  outline,
  onSourceClick,
  onSectionClick,
  // Story 7: New props for CIM MVP workflow outline
  cimOutline,
  sectionProgress,
  currentSectionId,
  currentSlideId,
  onSlideClick,
}: SourcesPanelProps) {
  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        {/* Structure Section */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            CIM Structure
          </h3>
          {/* Story 7: Use OutlineTree for CIM MVP workflow, fallback to StructureTree */}
          {cimOutline ? (
            <OutlineTree
              outline={cimOutline}
              sectionProgress={sectionProgress}
              currentSectionId={currentSectionId}
              currentSlideId={currentSlideId}
              onSectionClick={onSectionClick}
              onSlideClick={onSlideClick}
            />
          ) : (
            <StructureTree
              outline={outline}
              onSectionClick={onSectionClick}
            />
          )}
        </section>

        <Separator />

        {/* Sources Sections */}
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Deal Sources
          </h3>
          <div className="space-y-2">
            <DocumentsList
              projectId={projectId}
              onDocumentClick={(id, title) => onSourceClick('document', id, title)}
            />
            <FindingsList
              projectId={projectId}
              onFindingClick={(id, title) => onSourceClick('finding', id, title)}
            />
            <QAList
              projectId={projectId}
              onQAClick={(id, title) => onSourceClick('qa', id, title)}
            />
          </div>
        </section>
      </div>
    </ScrollArea>
  )
}
