'use client'

/**
 * IRL Template Selector Component
 *
 * Main component for selecting IRL templates or creating a blank IRL.
 * Story: E6.1 - Build IRL Builder UI with Template Selection
 *
 * Features:
 * - Template grid with IRLTemplateCard components
 * - "Custom (Blank)" card option
 * - Template preview modal
 * - Responsive grid (1 col mobile, 2 tablet, 3 desktop)
 * - Loading states and error handling
 */

import { useState, useCallback } from 'react'
import { IRLTemplateCard, BlankIRLCard } from './IRLTemplateCard'
import { IRLTemplateModal } from './IRLTemplateModal'
import { IRLTemplate } from '@/lib/types/irl'
import { Skeleton } from '@/components/ui/skeleton'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface IRLTemplateSelectorProps {
  /** Available templates */
  templates: IRLTemplate[]
  /** Whether templates are loading */
  isLoading?: boolean
  /** Error message if loading failed */
  error?: string
  /** Called when a template is selected (or null for blank) */
  onSelect: (template: IRLTemplate | null) => void
  /** Called to retry loading on error */
  onRetry?: () => void
  /** Additional class names */
  className?: string
}

export function IRLTemplateSelector({
  templates,
  isLoading = false,
  error,
  onSelect,
  onRetry,
  className,
}: IRLTemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<IRLTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<IRLTemplate | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isBlankSelected, setIsBlankSelected] = useState(false)

  const handleTemplateClick = useCallback((template: IRLTemplate) => {
    setSelectedTemplate(template)
    setIsBlankSelected(false)
  }, [])

  const handleBlankClick = useCallback(() => {
    setSelectedTemplate(null)
    setIsBlankSelected(true)
  }, [])

  const handlePreviewClick = useCallback((template: IRLTemplate) => {
    setPreviewTemplate(template)
    setIsModalOpen(true)
  }, [])

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false)
    setPreviewTemplate(null)
  }, [])

  const handleUseTemplate = useCallback(
    (template: IRLTemplate) => {
      setSelectedTemplate(template)
      setIsBlankSelected(false)
      setIsModalOpen(false)
      onSelect(template)
    },
    [onSelect]
  )

  const handleConfirmSelection = useCallback(() => {
    if (isBlankSelected) {
      onSelect(null)
    } else if (selectedTemplate) {
      onSelect(selectedTemplate)
    }
  }, [isBlankSelected, selectedTemplate, onSelect])

  // Loading state
  if (isLoading) {
    return (
      <div className={cn('space-y-6', className)}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <TemplateSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-center',
          className
        )}
      >
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h3 className="text-lg font-medium mb-2">Failed to load templates</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        {onRetry && (
          <Button onClick={onRetry} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Template Grid - Responsive: 1 col mobile, 2 tablet, 3 desktop (AC10) */}
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        data-testid="template-grid"
      >
        {/* Blank IRL Card */}
        <BlankIRLCard
          onSelect={handleBlankClick}
          isSelected={isBlankSelected}
        />

        {/* Template Cards */}
        {templates.map((template) => (
          <IRLTemplateCard
            key={template.id}
            template={template}
            onSelect={handleTemplateClick}
            onPreview={handlePreviewClick}
            isSelected={selectedTemplate?.id === template.id}
          />
        ))}
      </div>

      {/* Selection Actions */}
      {(selectedTemplate || isBlankSelected) && (
        <div
          className="flex justify-end gap-2 pt-4 border-t"
          data-testid="selection-actions"
        >
          <Button
            variant="outline"
            onClick={() => {
              setSelectedTemplate(null)
              setIsBlankSelected(false)
            }}
          >
            Clear Selection
          </Button>
          <Button onClick={handleConfirmSelection}>
            {isBlankSelected
              ? 'Create Blank IRL'
              : `Use ${selectedTemplate?.name} Template`}
          </Button>
        </div>
      )}

      {/* Preview Modal */}
      <IRLTemplateModal
        template={previewTemplate}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onUseTemplate={handleUseTemplate}
      />
    </div>
  )
}

/**
 * Skeleton for loading state
 */
function TemplateSkeleton() {
  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div className="flex justify-between">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
        <Skeleton className="h-6 w-16" />
      </div>
      <div className="flex justify-between items-center pt-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-20" />
      </div>
    </div>
  )
}

export default IRLTemplateSelector
