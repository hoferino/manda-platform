'use client'

/**
 * Deliverables Client Component
 * Client-side rendering for deliverables with tabs
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 * Story: E6.2 - Implement IRL Creation and Editing
 */

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, List, MessageSquare, Plus, ArrowLeft, Trash2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { IRLTemplateSelector, useIRLTemplates, IRLBuilder } from '@/components/irl'
import { IRLTemplate, IRL } from '@/lib/types/irl'

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

  // IRL list and editing state (E6.2)
  const [irls, setIrls] = useState<IRL[]>([])
  const [irlsLoading, setIrlsLoading] = useState(true)
  const [editingIrlId, setEditingIrlId] = useState<string | null>(null)

  const { templates, isLoading, error: templatesError, refetch } = useIRLTemplates(projectId)

  // Load existing IRLs
  useEffect(() => {
    async function loadIRLs() {
      try {
        setIrlsLoading(true)
        const response = await fetch(`/api/projects/${projectId}/irls`)
        if (response.ok) {
          const data = await response.json()
          setIrls(data.irls || [])
        }
      } catch (err) {
        console.error('Failed to load IRLs:', err)
      } finally {
        setIrlsLoading(false)
      }
    }
    loadIRLs()
  }, [projectId])

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

      // Close dialog and open the IRL builder
      setIsCreating(false)
      setSelectedTemplate(null)
      setIrlTitle('')

      // Add to list and open for editing
      setIrls(prev => [data.irl, ...prev])
      setEditingIrlId(data.irl.id)
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
          {editingIrlId ? (
            // IRL Builder View
            <div className="space-y-4">
              <Button
                variant="ghost"
                onClick={() => setEditingIrlId(null)}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to IRL List
              </Button>
              <IRLBuilder
                projectId={projectId}
                irlId={editingIrlId}
                onError={(error) => console.error('IRL Builder error:', error)}
              />
            </div>
          ) : (
            // IRL List & Create View
            <div className="space-y-6">
              {/* Existing IRLs */}
              {irlsLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ) : irls.length > 0 ? (
                <div className="space-y-4">
                  <h2 className="text-lg font-medium">Your IRLs</h2>
                  <div className="grid gap-4">
                    {irls.map(irl => (
                      <Card
                        key={irl.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setEditingIrlId(irl.id)}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <CardTitle className="text-lg">{irl.title}</CardTitle>
                              <CardDescription>
                                {irl.templateType ? `Template: ${irl.templateType}` : 'Custom IRL'}
                                {' • '}
                                Created {new Date(irl.createdAt).toLocaleDateString()}
                              </CardDescription>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete IRL</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete &ldquo;{irl.title}&rdquo;?
                                    This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    onClick={async (e) => {
                                      e.stopPropagation()
                                      try {
                                        const response = await fetch(
                                          `/api/projects/${projectId}/irls/${irl.id}`,
                                          { method: 'DELETE' }
                                        )
                                        if (response.ok) {
                                          setIrls(prev => prev.filter(i => i.id !== irl.id))
                                        }
                                      } catch (err) {
                                        console.error('Failed to delete IRL:', err)
                                      }
                                    }}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Create New IRL */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-medium">
                      {irls.length > 0 ? 'Create Another IRL' : 'Create New IRL'}
                    </h2>
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
            </div>
          )}
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
