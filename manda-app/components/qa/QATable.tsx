'use client'

/**
 * Q&A Table Component
 * Displays Q&A items grouped by category with collapsible sections
 * Story: E8.2 - Q&A Management UI with Collaborative Editing (AC: 1, 2, 3, 4)
 *
 * Features:
 * - Category grouping with collapsible sections
 * - Inline editing for question, answer, and notes
 * - Priority badges with color coding
 * - Status indicators (pending/answered)
 */

import { useState, useCallback, useMemo } from 'react'
import { ChevronDown, ChevronRight, MessageCircle, Check, Clock } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import {
  QAItem,
  QACategory,
  QA_CATEGORIES,
  getCategoryInfo,
  getPriorityInfo,
  isPending,
} from '@/lib/types/qa'
import { PriorityBadge } from './PriorityBadge'
import { QAInlineEdit } from './QAInlineEdit'

interface QATableProps {
  items: QAItem[]
  isLoading: boolean
  onSave: (itemId: string, changes: Partial<QAItem>) => Promise<void>
  projectId: string
}

export function QATable({ items, isLoading, onSave, projectId }: QATableProps) {
  // Track collapsed categories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())

  // Track which item is being edited
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<'question' | 'answer' | 'comment' | null>(null)

  // Group items by category
  const groupedItems = useMemo(() => {
    const grouped = new Map<QACategory, QAItem[]>()

    // Initialize all categories
    for (const category of QA_CATEGORIES) {
      grouped.set(category, [])
    }

    // Group items
    for (const item of items) {
      const categoryItems = grouped.get(item.category) || []
      categoryItems.push(item)
      grouped.set(item.category, categoryItems)
    }

    return grouped
  }, [items])

  // Toggle category collapse
  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  // Start editing
  const handleStartEdit = useCallback((itemId: string, field: 'question' | 'answer' | 'comment') => {
    setEditingItemId(itemId)
    setEditingField(field)
  }, [])

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setEditingItemId(null)
    setEditingField(null)
  }, [])

  // Save edit
  const handleSaveEdit = useCallback(
    async (itemId: string, value: string) => {
      if (!editingField) return

      await onSave(itemId, {
        [editingField]: value,
        // If saving an answer, also set dateAnswered
        ...(editingField === 'answer' && value.trim()
          ? { dateAnswered: new Date().toISOString() }
          : {}),
      })

      setEditingItemId(null)
      setEditingField(null)
    },
    [editingField, onSave]
  )

  if (isLoading) {
    return <QATableSkeleton />
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <MessageCircle className="h-12 w-12 text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-semibold">No Q&A items yet</h3>
        <p className="mt-2 text-sm text-muted-foreground max-w-md">
          Questions will appear here when identified during document analysis or added manually.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {QA_CATEGORIES.map(category => {
        const categoryItems = groupedItems.get(category) || []
        const isCollapsed = collapsedCategories.has(category)
        const pendingCount = categoryItems.filter(isPending).length
        const categoryInfo = getCategoryInfo(category)

        // Skip empty categories
        if (categoryItems.length === 0) return null

        return (
          <Collapsible
            key={category}
            open={!isCollapsed}
            onOpenChange={() => toggleCategory(category)}
          >
            {/* Category Header */}
            <CollapsibleTrigger asChild>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-lg px-4 py-3 cursor-pointer transition-colors',
                  'bg-muted/50 hover:bg-muted'
                )}
              >
                {isCollapsed ? (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
                <Badge variant="secondary" className={cn('text-xs', categoryInfo.color)}>
                  {categoryInfo.label}
                </Badge>
                <span className="text-sm font-medium">
                  {categoryItems.length} {categoryItems.length === 1 ? 'item' : 'items'}
                </span>
                {pendingCount > 0 && (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    <Clock className="h-3 w-3 mr-1" />
                    {pendingCount} pending
                  </Badge>
                )}
              </div>
            </CollapsibleTrigger>

            {/* Category Table */}
            <CollapsibleContent>
              <div className="mt-2 rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40%]">Question</TableHead>
                      <TableHead className="w-[35%]">Answer</TableHead>
                      <TableHead className="w-[15%]">Notes</TableHead>
                      <TableHead className="w-[10%]">Priority</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryItems.map(item => (
                      <TableRow
                        key={item.id}
                        className={cn(
                          'group',
                          isPending(item) && 'bg-amber-50/30'
                        )}
                      >
                        {/* Question Cell */}
                        <TableCell className="align-top py-3">
                          {editingItemId === item.id && editingField === 'question' ? (
                            <QAInlineEdit
                              value={item.question}
                              onSave={(value) => handleSaveEdit(item.id, value)}
                              onCancel={handleCancelEdit}
                              placeholder="Enter question..."
                              minLength={10}
                              maxLength={2000}
                            />
                          ) : (
                            <div
                              className="cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 min-h-[2rem] flex items-start"
                              onClick={() => handleStartEdit(item.id, 'question')}
                              title="Click to edit"
                            >
                              <span className="text-sm">{item.question}</span>
                            </div>
                          )}
                        </TableCell>

                        {/* Answer Cell */}
                        <TableCell className="align-top py-3">
                          {editingItemId === item.id && editingField === 'answer' ? (
                            <QAInlineEdit
                              value={item.answer || ''}
                              onSave={(value) => handleSaveEdit(item.id, value)}
                              onCancel={handleCancelEdit}
                              placeholder="Enter answer..."
                              maxLength={10000}
                            />
                          ) : (
                            <div
                              className={cn(
                                'cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 min-h-[2rem] flex items-start',
                                !item.answer && 'text-muted-foreground italic'
                              )}
                              onClick={() => handleStartEdit(item.id, 'answer')}
                              title="Click to edit"
                            >
                              {item.answer ? (
                                <>
                                  <Check className="h-4 w-4 text-green-600 mr-2 mt-0.5 flex-shrink-0" />
                                  <span className="text-sm line-clamp-3">{item.answer}</span>
                                </>
                              ) : (
                                <span className="text-sm">No answer yet</span>
                              )}
                            </div>
                          )}
                        </TableCell>

                        {/* Notes/Comment Cell */}
                        <TableCell className="align-top py-3">
                          {editingItemId === item.id && editingField === 'comment' ? (
                            <QAInlineEdit
                              value={item.comment || ''}
                              onSave={(value) => handleSaveEdit(item.id, value)}
                              onCancel={handleCancelEdit}
                              placeholder="Add notes..."
                              maxLength={2000}
                            />
                          ) : (
                            <div
                              className={cn(
                                'cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 min-h-[2rem]',
                                !item.comment && 'text-muted-foreground italic'
                              )}
                              onClick={() => handleStartEdit(item.id, 'comment')}
                              title="Click to edit"
                            >
                              <span className="text-sm line-clamp-2">
                                {item.comment || 'Add notes...'}
                              </span>
                            </div>
                          )}
                        </TableCell>

                        {/* Priority Cell */}
                        <TableCell className="align-top py-3">
                          <PriorityBadge priority={item.priority} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )
      })}
    </div>
  )
}

function QATableSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map(i => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <div className="rounded-lg border">
            <div className="p-4 space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
