/**
 * Project Card Component
 * Displays a single project/deal in card view
 * Story: E1.4 - Build Projects Overview Screen (AC: #2, #7, #8)
 *
 * Note (v2.6): deal_type removed - it didn't drive any downstream behavior
 */

'use client'

import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import { Building2, Clock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Deal } from '@/lib/supabase/types'

interface ProjectCardProps {
  deal: Deal
}

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  'on-hold': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  archived: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
}

export function ProjectCard({ deal }: ProjectCardProps) {
  const status = deal.status ?? 'active'
  const statusClass = statusColors[status] ?? statusColors['active']

  // For MVP, progress is simulated (0-100 based on created/updated difference)
  // In future, this will be calculated from actual project completion metrics
  const progress = Math.min(100, Math.max(0, Math.floor(Math.random() * 30 + 10)))

  const lastActivity = formatDistanceToNow(new Date(deal.updated_at), { addSuffix: true })

  return (
    <Link href={`/projects/${deal.id}/dashboard`}>
      <Card className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="line-clamp-1 text-lg group-hover:text-primary transition-colors">
              {deal.name}
            </CardTitle>
            <Badge
              variant="secondary"
              className={`shrink-0 capitalize ${statusClass}`}
            >
              {status.replace('-', ' ')}
            </Badge>
          </div>
          {deal.company_name && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" />
              <span className="line-clamp-1">{deal.company_name}</span>
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {deal.industry && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline" className="text-xs">
                {deal.industry}
              </Badge>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span title={new Date(deal.updated_at).toLocaleString()}>
              {lastActivity}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
