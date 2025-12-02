'use client'

/**
 * IRL Template Card Component
 *
 * Displays an IRL template as a card with name, description, and item count.
 * Story: E6.1 - Build IRL Builder UI with Template Selection (AC6)
 *
 * Features:
 * - Template name and description
 * - Deal type badge
 * - Total item count
 * - Hover state with preview action
 * - Click handler for selection
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IRLTemplate, getDealTypeInfo, countTemplateItems } from '@/lib/types/irl'
import { cn } from '@/lib/utils'

export interface IRLTemplateCardProps {
  /** The template to display */
  template: IRLTemplate
  /** Called when the card is clicked to select this template */
  onSelect?: (template: IRLTemplate) => void
  /** Called when the preview button is clicked */
  onPreview?: (template: IRLTemplate) => void
  /** Whether this template is currently selected */
  isSelected?: boolean
  /** Additional class names */
  className?: string
}

export function IRLTemplateCard({
  template,
  onSelect,
  onPreview,
  isSelected = false,
  className,
}: IRLTemplateCardProps) {
  const dealTypeInfo = getDealTypeInfo(template.dealType)
  const itemCount = countTemplateItems(template)
  const categoryCount = template.categories.length

  const handleClick = () => {
    onSelect?.(template)
  }

  const handlePreviewClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    onPreview?.(template)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.(template)
    }
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50',
        isSelected && 'ring-2 ring-primary border-primary',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label={`Select ${template.name} template with ${itemCount} items`}
      data-testid={`irl-template-card-${template.id}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate" title={template.name}>
              {template.name}
            </CardTitle>
            <CardDescription className="mt-1 line-clamp-2">
              {template.description}
            </CardDescription>
          </div>
          <Badge
            variant="secondary"
            className={cn('shrink-0', dealTypeInfo.color, 'text-white')}
          >
            {dealTypeInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <FileText className="h-4 w-4" />
              <span data-testid="item-count">{itemCount} items</span>
            </div>
            <div className="text-muted-foreground/60">
              {categoryCount} categories
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePreviewClick}
            className="gap-1.5 text-muted-foreground hover:text-foreground"
            aria-label={`Preview ${template.name} template`}
            data-testid="preview-button"
          >
            <Eye className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

/**
 * Blank/Custom IRL Card
 *
 * Special card for creating a blank IRL without a template
 */
export interface BlankIRLCardProps {
  /** Called when the blank card is selected */
  onSelect?: () => void
  /** Whether this option is currently selected */
  isSelected?: boolean
  /** Additional class names */
  className?: string
}

export function BlankIRLCard({
  onSelect,
  isSelected = false,
  className,
}: BlankIRLCardProps) {
  const handleClick = () => {
    onSelect?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect?.()
    }
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary/50 border-dashed',
        isSelected && 'ring-2 ring-primary border-primary border-solid',
        className
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-pressed={isSelected}
      aria-label="Create blank IRL"
      data-testid="blank-irl-card"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg">Custom (Blank)</CardTitle>
            <CardDescription className="mt-1">
              Start with an empty IRL and add your own categories and items
            </CardDescription>
          </div>
          <Badge variant="outline" className="shrink-0">
            Custom
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            <span>0 items</span>
          </div>
          <div className="text-muted-foreground/60">
            Build from scratch
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
