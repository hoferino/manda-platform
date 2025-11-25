/**
 * Placeholder Section Component
 * Shows "Coming Soon" content for workspace sections
 * Story: E1.6 - Build Project Workspace Shell with Navigation (AC: #5)
 */

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { LucideIcon } from 'lucide-react'

interface PlaceholderSectionProps {
  title: string
  description: string
  epic: number
  icon: LucideIcon
}

export function PlaceholderSection({
  title,
  description,
  epic,
  icon: Icon,
}: PlaceholderSectionProps) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          {/* Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Icon className="h-8 w-8 text-muted-foreground" />
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold">{title}</h2>

          {/* Description */}
          <p className="text-muted-foreground">{description}</p>

          {/* Coming Soon Badge */}
          <Badge variant="secondary" className="mt-2">
            Coming in Epic {epic}
          </Badge>
        </CardContent>
      </Card>
    </div>
  )
}
