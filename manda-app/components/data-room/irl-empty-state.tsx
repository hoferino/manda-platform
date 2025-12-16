/**
 * IRL Empty State Component
 * Story: E2.8 - Implement IRL Integration with Document Tracking
 * AC: #7 (No IRL State)
 * Fix: TD-010/BUG-002 - Changed from broken link to dialog-based IRL creation
 */

'use client'

import { useState } from 'react'
import { ClipboardList, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { IRLTemplateSelector } from '@/components/irl/IRLTemplateSelector'
import { useIRLTemplates } from '@/components/irl/useIRLTemplates'
import { IRLTemplate } from '@/lib/types/irl'
import { toast } from 'sonner'

export interface IRLEmptyStateProps {
  projectId: string
  onIRLCreated?: () => void
}

export function IRLEmptyState({ projectId, onIRLCreated }: IRLEmptyStateProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const { templates, isLoading, error, refetch } = useIRLTemplates(projectId)

  const handleTemplateSelect = async (template: IRLTemplate | null) => {
    setIsCreating(true)

    try {
      const response = await fetch(`/api/projects/${projectId}/irls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template ? `${template.name} IRL` : 'Custom IRL',
          templateId: template?.id || null,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create IRL')
      }

      const result = await response.json()

      toast.success(
        template
          ? `IRL created from "${template.name}" template with ${result.items?.length || 0} items`
          : 'Blank IRL created successfully'
      )

      setIsOpen(false)
      onIRLCreated?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create IRL')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <ClipboardList className="h-8 w-8 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h4 className="font-semibold text-foreground">No IRL Configured</h4>
        <p className="text-sm text-muted-foreground max-w-[200px]">
          Create an Information Request List to track document collection progress.
        </p>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create IRL
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Information Request List</DialogTitle>
            <DialogDescription>
              Choose a template to get started quickly, or create a blank IRL for full customization.
            </DialogDescription>
          </DialogHeader>

          {isCreating ? (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Creating IRL...</p>
            </div>
          ) : (
            <IRLTemplateSelector
              templates={templates}
              isLoading={isLoading}
              error={error || undefined}
              onSelect={handleTemplateSelect}
              onRetry={refetch}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Help text */}
      <p className="text-xs text-muted-foreground mt-4">
        An IRL helps track which documents you need to collect for due diligence.
      </p>
    </div>
  )
}
