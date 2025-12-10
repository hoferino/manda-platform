'use client'

/**
 * CIM Builder Layout - 3-Panel Responsive Container
 *
 * NotebookLM-inspired layout with:
 * - Sources panel (left, 300px min)
 * - Conversation panel (center, grows)
 * - Preview panel (right, 400px min)
 *
 * Story: E9.3 - CIM Builder 3-Panel Layout
 * AC: #1 - Three-Panel Responsive Layout
 *
 * Responsive Breakpoints:
 * - Desktop (>1200px): 3-panel side-by-side
 * - Tablet (768-1200px): Sources collapses to sidebar
 * - Mobile (<768px): Tab navigation between panels
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import {
  FileText,
  MessageSquare,
  Presentation,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'

interface CIMBuilderLayoutProps {
  sourcesPanel: React.ReactNode
  conversationPanel: React.ReactNode
  previewPanel: React.ReactNode
  className?: string
}

export function CIMBuilderLayout({
  sourcesPanel,
  conversationPanel,
  previewPanel,
  className,
}: CIMBuilderLayoutProps) {
  const [isSourcesCollapsed, setIsSourcesCollapsed] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<'sources' | 'conversation' | 'preview'>('conversation')

  return (
    <div className={cn('h-full', className)}>
      {/* Desktop Layout (>1200px) - 3-panel resizable */}
      <div className="hidden xl:block h-full">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Sources Panel */}
          <ResizablePanel
            defaultSize={20}
            minSize={15}
            maxSize={30}
            collapsible
            collapsedSize={4}
            onCollapse={() => setIsSourcesCollapsed(true)}
            onExpand={() => setIsSourcesCollapsed(false)}
            className={cn(
              'transition-all duration-300',
              isSourcesCollapsed && 'min-w-[50px]'
            )}
          >
            <div className="h-full flex flex-col border-r bg-muted/30">
              {isSourcesCollapsed ? (
                <div className="flex flex-col items-center py-4 gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSourcesCollapsed(false)}
                    aria-label="Expand sources panel"
                  >
                    <PanelLeftOpen className="h-4 w-4" />
                  </Button>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </div>
              ) : (
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between px-4 py-3 border-b">
                    <h2 className="font-semibold text-sm">Sources & Structure</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsSourcesCollapsed(true)}
                      aria-label="Collapse sources panel"
                    >
                      <PanelLeftClose className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {sourcesPanel}
                  </div>
                </div>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Conversation Panel */}
          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="h-full flex flex-col border-r">
              <div className="px-4 py-3 border-b">
                <h2 className="font-semibold text-sm">Conversation</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                {conversationPanel}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Preview Panel */}
          <ResizablePanel defaultSize={35} minSize={25}>
            <div className="h-full flex flex-col">
              <div className="px-4 py-3 border-b">
                <h2 className="font-semibold text-sm">Preview</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                {previewPanel}
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Tablet Layout (768-1200px) - Conversation + Preview with collapsible Sources sidebar */}
      <div className="hidden md:block xl:hidden h-full">
        <div className="flex h-full">
          {/* Collapsible Sources Sheet */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="fixed left-4 top-20 z-40"
                aria-label="Open sources panel"
              >
                <FileText className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] p-0">
              <div className="h-full flex flex-col">
                <div className="px-4 py-3 border-b">
                  <h2 className="font-semibold text-sm">Sources & Structure</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  {sourcesPanel}
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Main content - stacked Conversation and Preview */}
          <div className="flex-1 flex flex-col">
            <ResizablePanelGroup direction="vertical" className="h-full">
              <ResizablePanel defaultSize={60} minSize={30}>
                <div className="h-full flex flex-col">
                  <div className="px-4 py-3 border-b">
                    <h2 className="font-semibold text-sm">Conversation</h2>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {conversationPanel}
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={40} minSize={20}>
                <div className="h-full flex flex-col border-t">
                  <div className="px-4 py-3 border-b">
                    <h2 className="font-semibold text-sm">Preview</h2>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {previewPanel}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </div>
      </div>

      {/* Mobile Layout (<768px) - Tab navigation */}
      <div className="md:hidden h-full">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="h-full flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-3 flex-shrink-0">
            <TabsTrigger value="sources" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Sources</span>
            </TabsTrigger>
            <TabsTrigger value="conversation" className="gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-2">
              <Presentation className="h-4 w-4" />
              <span className="hidden sm:inline">Preview</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sources" className="flex-1 overflow-hidden mt-0">
            <div className="h-full overflow-auto">
              {sourcesPanel}
            </div>
          </TabsContent>

          <TabsContent value="conversation" className="flex-1 overflow-hidden mt-0">
            <div className="h-full overflow-hidden">
              {conversationPanel}
            </div>
          </TabsContent>

          <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
            <div className="h-full overflow-auto">
              {previewPanel}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
