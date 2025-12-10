'use client'

/**
 * CIM Card Component
 * Displays a single CIM in a card format
 * Story: E9.2 - CIM List & Entry UI
 * AC: #2 - CIM cards display: name, last updated timestamp, and progress indicator
 * AC: #4 - Click CIM card navigates to builder
 * AC: #5 - Delete CIM with kebab menu
 *
 * Features:
 * - Card display with title, progress, and timestamp
 * - Click to navigate to CIM builder
 * - Kebab menu with delete option
 * - Progress indicator showing workflow phase
 */

import { useRouter } from 'next/navigation'
import { formatDistanceToNow } from 'date-fns'
import { MoreVertical, Trash2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CIMProgressIndicator } from './CIMProgressIndicator'
import { CIMListItem } from '@/lib/types/cim'

interface CIMCardProps {
  cim: CIMListItem
  projectId: string
  onDelete: () => void
}

export function CIMCard({ cim, projectId, onDelete }: CIMCardProps) {
  const router = useRouter()

  const handleCardClick = () => {
    // AC: #4 - Navigate to builder with CIM loaded
    router.push(`/projects/${projectId}/cim-builder/${cim.id}`)
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    onDelete()
  }

  const formattedDate = formatDistanceToNow(new Date(cim.updatedAt), {
    addSuffix: true,
  })

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors group"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          handleCardClick()
        }
      }}
      aria-label={`Open CIM: ${cim.title}`}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1 flex-1 min-w-0">
          <h3 className="font-semibold leading-none tracking-tight truncate" title={cim.title}>
            {cim.title}
          </h3>
          <p className="text-sm text-muted-foreground">Updated {formattedDate}</p>
        </div>

        {/* Kebab menu - AC: #5 */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
              onClick={(e) => e.stopPropagation()}
              aria-label="CIM options"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={handleDeleteClick}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>

      <CardContent>
        {/* AC: #2 - Progress indicator */}
        <CIMProgressIndicator workflowState={cim.workflowState} />

        {cim.slideCount > 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            {cim.slideCount} {cim.slideCount === 1 ? 'slide' : 'slides'}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
