/**
 * Bucket Card Component
 * Displays a folder-based bucket with document count and status badge
 * Story: E2.3 - Build Data Room Buckets View (AC: #1, #2, #3)
 *
 * Architecture (v2.6): Buckets = top-level folders
 * Cards represent top-level folders, not hardcoded categories
 * 
 * Enhanced: Professional design with larger cards, rich previews, and visual hierarchy
 */

'use client'

import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  FileText,
  FileSpreadsheet,
  File,
  Presentation,
  FileImage,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export interface BucketItem {
  id: string
  name: string
  status: 'uploaded' | 'pending' | 'not_started'
  type: 'document' | 'folder'
  documentId?: string
  documentName?: string
  folderPath?: string
}

export interface BucketCardProps {
  folderName: string
  folderPath: string
  uploadedCount: number
  items?: BucketItem[]
  subfolderCount?: number
  isExpanded?: boolean
  onToggleExpand?: () => void
  onClick?: () => void
}

/**
 * Get file icon based on document name
 */
function getFileIcon(name: string) {
  const lower = name.toLowerCase()
  if (lower.endsWith('.pdf')) return FileText
  if (lower.match(/\.(xlsx?|csv)$/)) return FileSpreadsheet
  if (lower.match(/\.(docx?|txt)$/)) return FileText
  if (lower.match(/\.(pptx?|key)$/)) return Presentation
  if (lower.match(/\.(png|jpe?g|gif|svg|webp)$/)) return FileImage
  return File
}

/**
 * Get status badge based on document count
 */
function getStatusInfo(count: number): {
  label: string
  variant: 'default' | 'secondary' | 'outline'
  className: string
} {
  if (count === 0) {
    return {
      label: 'Empty',
      variant: 'secondary',
      className: 'bg-muted text-muted-foreground border-border',
    }
  }
  return {
    label: `${count} document${count === 1 ? '' : 's'}`,
    variant: 'default',
    className: 'bg-primary/10 text-primary border-primary/20',
  }
}

export function BucketCard({
  folderName,
  folderPath,
  uploadedCount,
  items = [],
  subfolderCount = 0,
  isExpanded = false,
  onToggleExpand,
  onClick,
}: BucketCardProps) {
  const statusInfo = getStatusInfo(uploadedCount)
  const FolderIcon = isExpanded ? FolderOpen : Folder
  
  // Get preview items (documents only, max 6)
  const previewItems = items
    .filter(item => item.type === 'document')
    .slice(0, 6)
  
  const hasMoreItems = items.length > 6

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
        'group relative overflow-hidden cursor-pointer card-hover',
        'border-2 transition-all duration-300',
        isExpanded 
          ? 'ring-2 ring-primary/30 border-primary/40 shadow-lg' 
          : 'border-border hover:border-primary/30 hover:shadow-md'
      )}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-expanded={isExpanded}
    >
      {/* Gradient background accent */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 transition-opacity duration-300",
        "group-hover:opacity-100"
      )} />
      
      <CardHeader className="relative pb-4 space-y-4">
        {/* Header with icon and title */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            {/* Large folder icon with gradient background */}
            <div className={cn(
              "rounded-xl p-3 transition-all duration-300",
              "bg-gradient-to-br from-primary/10 to-primary/5",
              "group-hover:from-primary/15 group-hover:to-primary/10",
              isExpanded && "from-primary/20 to-primary/10"
            )}>
              <FolderIcon className={cn(
                "h-8 w-8 transition-colors duration-300",
                isExpanded ? "text-primary" : "text-primary/70 group-hover:text-primary"
              )} />
            </div>
            
            {/* Title and metadata */}
            <div className="flex-1 min-w-0 space-y-2">
              <h3 className={cn(
                "font-heading font-semibold text-lg leading-tight truncate",
                "transition-colors duration-200",
                isExpanded ? "text-primary" : "text-foreground group-hover:text-primary"
              )}>
                {folderName}
              </h3>
              
              {/* Stats row */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" />
                  {uploadedCount}
                </span>
                {subfolderCount > 0 && (
                  <>
                    <span className="text-border">•</span>
                    <span className="flex items-center gap-1">
                      <Folder className="h-3.5 w-3.5" />
                      {subfolderCount}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          
          {/* Status badge */}
          <Badge 
            className={cn(
              statusInfo.className,
              "shrink-0 font-medium transition-all duration-200"
            )} 
            variant={statusInfo.variant}
          >
            {statusInfo.label}
          </Badge>
        </div>

        {/* Progress indicator for non-empty buckets */}
        {uploadedCount > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Storage</span>
              <span className="font-medium text-foreground">{uploadedCount} files</span>
            </div>
            <Progress 
              value={Math.min((uploadedCount / 50) * 100, 100)} 
              className="h-1.5"
            />
          </div>
        )}
      </CardHeader>

      <CardContent className="relative space-y-4 pt-0">
        {/* Document preview grid */}
        {previewItems.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Recent Documents
            </p>
            
            {/* Grid of document icons */}
            <div className="grid grid-cols-3 gap-2">
              {previewItems.map((item, index) => {
                const Icon = getFileIcon(item.name)
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "flex flex-col items-center gap-1.5 p-2 rounded-lg",
                      "bg-muted/50 hover:bg-muted transition-colors duration-200",
                      "group/item"
                    )}
                    title={item.name}
                  >
                    <Icon className="h-5 w-5 text-muted-foreground group-hover/item:text-foreground transition-colors" />
                    <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                      {item.name.split('.')[0]?.substring(0, 8) || ''}
                    </span>
                  </div>
                )
              })}
            </div>
            
            {/* More items indicator */}
            {hasMoreItems && (
              <p className="text-xs text-muted-foreground text-center pt-1">
                +{items.length - 6} more files
              </p>
            )}
          </div>
        ) : (
          /* Empty state */
          <div className="py-8 text-center space-y-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-muted">
              <Folder className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No documents yet</p>
            <p className="text-xs text-muted-foreground/70">Click to add files</p>
          </div>
        )}

        {/* Expand indicator */}
        {onToggleExpand && (
          <div className={cn(
            "flex items-center justify-center gap-2 pt-2 border-t",
            "text-sm font-medium transition-colors duration-200",
            isExpanded ? "text-primary" : "text-muted-foreground group-hover:text-primary"
          )}>
            <span>{isExpanded ? 'Collapse' : 'View Contents'}</span>
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