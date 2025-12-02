'use client'

/**
 * Deliverables Client Component
 * Client-side rendering for deliverables with tabs
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 */

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, List, MessageSquare, Plus } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { IRLTemplateSelector, useIRLTemplates } from '@/components/irl'
import { IRLTemplate } from '@/lib/types/irl'

interface DeliverablesClientProps {
  projectId: string
}

export function DeliverablesClient({ projectId }: DeliverablesClientProps) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('irl')
  const [isCreating, setIsCreating] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<IRLTemplate | null>(null)
  const [irlTitle, setIrlTitle] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { templates, isLoading, error: templatesError, refetch } = useIRLTemplates(projectId)

  const handleTemplateSelect = useCallback((template: IRLTemplate | null) => {
    setSelectedTemplate(template)
    setIsCreating(true)
    // Pre-fill title based on template
    if (template) {
      setIrlTitle(`${template.name} - Due Diligence`)
    } else {
      setIrlTitle('Custom IRL')
    }
  }, [])

  const handleCreateIRL = useCallback(async () => {
    if (!irlTitle.trim()) {
      setError('Please enter a title for the IRL')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/irls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: irlTitle,
          templateId: selectedTemplate?.id,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create IRL')
      }

      const data = await response.json()

      // Close dialog and redirect to IRL builder (future story)
      setIsCreating(false)
      setSelectedTemplate(null)
      setIrlTitle('')

      // For now, just show success - IRL builder will be in E6.2
      // router.push(`/projects/${projectId}/irls/${data.irl.id}`)
      alert(`IRL "${data.irl.title}" created successfully!`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create IRL')
    } finally {
      setIsSubmitting(false)
    }
  }, [projectId, irlTitle, selectedTemplate, router])

  const handleCancelCreate = useCallback(() => {
    setIsCreating(false)
    setSelectedTemplate(null)
    setIrlTitle('')
    setError(null)
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Deliverables</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage deal deliverables including IRLs, CIMs, and Q&A lists.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="irl" className="gap-2">
            <List className="h-4 w-4" />
            Information Request List
          </TabsTrigger>
          <TabsTrigger value="cim" className="gap-2" disabled>
            <FileText className="h-4 w-4" />
            CIM
            <span className="text-xs text-muted-foreground">(Coming Soon)</span>
          </TabsTrigger>
          <TabsTrigger value="qa" className="gap-2" disabled>
            <MessageSquare className="h-4 w-4" />
            Q&A
            <span className="text-xs text-muted-foreground">(Coming Soon)</span>
          </TabsTrigger>
        </TabsList>

        {/* IRL Tab Content */}
        <TabsContent value="irl" className="mt-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-medium">Create New IRL</h2>
                <p className="text-sm text-muted-foreground">
                  Select a template to get started quickly, or create a blank IRL.
                </p>
              </div>
            </div>

            <IRLTemplateSelector
              templates={templates}
              isLoading={isLoading}
              error={templatesError || undefined}
              onSelect={handleTemplateSelect}
              onRetry={refetch}
            />
          </div>
        </TabsContent>

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

      {/* Create IRL Dialog */}
      <Dialog open={isCreating} onOpenChange={(open) => !open && handleCancelCreate()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? `Create IRL from ${selectedTemplate.name}` : 'Create Custom IRL'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate
                ? `This will create an IRL with ${selectedTemplate.categories.length} categories and pre-populated items.`
                : 'Create a blank IRL and add your own categories and items.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="irl-title">IRL Title</Label>
              <Input
                id="irl-title"
                value={irlTitle}
                onChange={(e) => setIrlTitle(e.target.value)}
                placeholder="Enter a name for this IRL"
                autoFocus
              />
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelCreate} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleCreateIRL} disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create IRL'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
