'use client'

/**
 * IRL Template Preview Modal
 *
 * Displays the full structure of an IRL template with collapsible categories.
 * Story: E6.1 - Build IRL Builder UI with Template Selection (AC7)
 *
 * Features:
 * - Full template structure with collapsible categories
 * - Item details with name, description, priority
 * - "Use This Template" and "Cancel" buttons
 * - Keyboard dismiss with Escape
 */

import { useEffect, useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ChevronDown, ChevronRight, FileText } from 'lucide-react'
import {
  IRLTemplate,
  IRLTemplateCategory,
  IRLTemplateItem,
  getDealTypeInfo,
  getPriorityInfo,
  countTemplateItems,
} from '@/lib/types/irl'
import { cn } from '@/lib/utils'

export interface IRLTemplateModalProps {
  /** The template to preview */
  template: IRLTemplate | null
  /** Whether the modal is open */
  isOpen: boolean
  /** Called when the modal should close */
  onClose: () => void
  /** Called when the user clicks "Use This Template" */
  onUseTemplate: (template: IRLTemplate) => void
}

export function IRLTemplateModal({
  template,
  isOpen,
  onClose,
  onUseTemplate,
}: IRLTemplateModalProps) {
  // Track which categories are expanded
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  // Initialize with all categories expanded
  useEffect(() => {
    if (template && isOpen) {
      setExpandedCategories(new Set(template.categories.map(c => c.name)))
    }
  }, [template, isOpen])

  // Handle keyboard escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    },
    [onClose]
  )

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, handleKeyDown])

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryName)) {
        next.delete(categoryName)
      } else {
        next.add(categoryName)
      }
      return next
    })
  }

  const expandAll = () => {
    if (template) {
      setExpandedCategories(new Set(template.categories.map(c => c.name)))
    }
  }

  const collapseAll = () => {
    setExpandedCategories(new Set())
  }

  if (!template) {
    return null
  }

  const dealTypeInfo = getDealTypeInfo(template.dealType)
  const itemCount = countTemplateItems(template)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col"
        data-testid="irl-template-modal"
      >
        <DialogHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <DialogTitle className="text-xl">{template.name}</DialogTitle>
              <DialogDescription className="mt-1">
                {template.description}
              </DialogDescription>
            </div>
            <Badge className={cn(dealTypeInfo.color, 'text-white shrink-0')}>
              {dealTypeInfo.label}
            </Badge>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                <span>{itemCount} items</span>
              </div>
              <span>{template.categories.length} categories</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={expandAll}
                className="text-xs"
                data-testid="expand-all"
              >
                Expand All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={collapseAll}
                className="text-xs"
                data-testid="collapse-all"
              >
                Collapse All
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6" data-testid="template-content">
          <div className="space-y-3 py-4">
            {template.categories.map((category) => (
              <CategorySection
                key={category.name}
                category={category}
                isExpanded={expandedCategories.has(category.name)}
                onToggle={() => toggleCategory(category.name)}
              />
            ))}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="cancel-button"
          >
            Cancel
          </Button>
          <Button
            onClick={() => onUseTemplate(template)}
            data-testid="use-template-button"
          >
            Use This Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

interface CategorySectionProps {
  category: IRLTemplateCategory
  isExpanded: boolean
  onToggle: () => void
}

function CategorySection({ category, isExpanded, onToggle }: CategorySectionProps) {
  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <button
          className="flex items-center justify-between w-full p-3 rounded-lg border bg-muted/50 hover:bg-muted transition-colors text-left"
          data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="font-medium">{category.name}</span>
          </div>
          <Badge variant="secondary" className="text-xs">
            {category.items.length} items
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 ml-6 space-y-2">
          {category.items.map((item, index) => (
            <ItemRow key={`${category.name}-${index}`} item={item} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface ItemRowProps {
  item: IRLTemplateItem
}

function ItemRow({ item }: ItemRowProps) {
  const priorityInfo = getPriorityInfo(item.priority)

  return (
    <div
      className="flex items-start justify-between gap-3 p-2 rounded border bg-background"
      data-testid="template-item"
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm">{item.name}</div>
        {item.description && (
          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {item.description}
          </div>
        )}
      </div>
      <Badge
        variant="secondary"
        className={cn('text-xs shrink-0', priorityInfo.color)}
        data-testid="priority-badge"
      >
        {priorityInfo.label}
      </Badge>
    </div>
  )
}
