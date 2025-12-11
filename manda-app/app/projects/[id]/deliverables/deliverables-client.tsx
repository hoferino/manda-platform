'use client'

/**
 * Deliverables Client Component
 * Client-side rendering for deliverables with tabs
 *
 * Note: IRL management moved to Data Room checklist sidebar.
 * IRL template selection happens during project creation wizard (Step 2).
 */

import { useState } from 'react'
import { FileText, MessageSquare } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface DeliverablesClientProps {
  projectId: string
}

export function DeliverablesClient({ projectId }: DeliverablesClientProps) {
  const [activeTab, setActiveTab] = useState('qa')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliverables</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage deal deliverables including CIMs and Q&A lists.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            💡 <strong>Note:</strong> IRL (Information Request List) is now managed in the Data Room checklist sidebar.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cim" className="gap-2" disabled>
            <FileText className="h-4 w-4" />
            CIM
            <span className="text-xs text-muted-foreground">(Coming Soon)</span>
          </TabsTrigger>
          <TabsTrigger value="qa" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Q&A
          </TabsTrigger>
        </TabsList>

        {/* CIM Tab Content (Placeholder) */}
        <TabsContent value="cim" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            CIM generation coming in a future release.
          </div>
        </TabsContent>

        {/* Q&A Tab Content (Placeholder) */}
        <TabsContent value="qa" className="mt-6">
          <div className="text-center py-12 text-muted-foreground">
            Q&A management coming in a future release.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
