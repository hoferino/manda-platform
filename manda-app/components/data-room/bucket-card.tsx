/**
 * Bucket Card Component
 * Displays a category bucket with progress indicator and status badge
 * Story: E2.3 - Build Data Room Buckets View (AC: #1, #2, #3)
 */

'use client'

import { useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Briefcase,
  Scale,
  TrendingUp,
  Cog,
  Receipt,
  Users,
  Monitor,
  Leaf,
  Shield,
  FileSignature,
  Building,
  FileCheck,
  Lightbulb,
  Home,
  MoreHorizontal,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { DocumentCategory } from '@/lib/gcs/client'

export interface BucketItem {
  id: string
  name: string
  status: 'uploaded' | 'pending' | 'not_started'
  documentId?: string
  documentName?: string
}

export interface BucketCardProps {
  category: DocumentCategory
  label: string
  uploadedCount: number
  expectedCount: number
  items?: BucketItem[]
  isExpanded?: boolean
  onToggleExpand?: () => void
  onUploadItem?: (itemId: string) => void
  onClick?: () => void
}

/**
 * Get icon component for a category
 */
function getCategoryIcon(category: DocumentCategory) {
  const iconMap: Record<DocumentCategory, React.ElementType> = {
    financial: TrendingUp,
    legal: Scale,
    commercial: Briefcase,
    operational: Cog,
    tax: Receipt,
    hr: Users,
    it: Monitor,
    environmental: Leaf,
    regulatory: Shield,
    contracts: FileSignature,
    corporate: Building,
    insurance: FileCheck,
    intellectual_property: Lightbulb,
    real_estate: Home,
    other: MoreHorizontal,
  }
  return iconMap[category] || FileText
}

/**
 * Calculate progress percentage
 */
function calculateProgress(uploaded: number, expected: number): number {
  if (expected === 0) return uploaded > 0 ? 100 : 0
  return Math.min(Math.round((uploaded / expected) * 100), 100)
}

/**
 * Get status badge based on progress
 */
function getStatusBadge(progress: number): {
  label: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
  className: string
} {
  if (progress === 0) {
    return {
      label: 'Not Started',
      variant: 'secondary',
      className: 'bg-gray-100 text-gray-600 hover:bg-gray-100',
    }
  }
  if (progress >= 100) {
    return {
      label: 'Completed',
      variant: 'default',
      className: 'bg-green-100 text-green-700 hover:bg-green-100',
    }
  }
  return {
    label: 'In Progress',
    variant: 'default',
    className: 'bg-amber-100 text-amber-700 hover:bg-amber-100',
  }
}

/**
 * Get progress bar color based on progress
 */
function getProgressColor(progress: number): string {
  if (progress === 0) return 'bg-gray-300'
  if (progress >= 100) return 'bg-green-500'
  return 'bg-amber-500'
}

export function BucketCard({
  category,
  label,
  uploadedCount,
  expectedCount,
  items = [],
  isExpanded = false,
  onToggleExpand,
  onUploadItem,
  onClick,
}: BucketCardProps) {
  const progress = calculateProgress(uploadedCount, expectedCount)
  const statusBadge = getStatusBadge(progress)
  const Icon = getCategoryIcon(category)

  const handleClick = () => {
    if (onToggleExpand) {
      onToggleExpand()
    }
    if (onClick) {
      onClick()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleClick()
    }
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isExpanded && 'ring-2 ring-primary/20'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-medium">{label}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {uploadedCount}/{expectedCount} documents
              </p>
            </div>
          </div>
          <Badge className={statusBadge.className} variant={statusBadge.variant}>
            {statusBadge.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{progress}%</span>
          </div>
          <div className="relative h-2 w-full overflow-hidden rounded-full bg-primary/20">
            <div
              className={cn(
                'h-full transition-all duration-300',
                getProgressColor(progress)
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Expand indicator */}
        {onToggleExpand && (
          <div className="flex items-center justify-center pt-1 text-muted-foreground">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
