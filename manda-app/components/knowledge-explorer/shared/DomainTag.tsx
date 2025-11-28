/**
 * DomainTag Component
 * Displays finding domain with consistent badge styling
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #2)
 */

'use client'

import { cn } from '@/lib/utils'
import { getDomainInfo, type FindingDomain } from '@/lib/types/findings'
import { Badge } from '@/components/ui/badge'
import {
  DollarSign,
  Settings,
  TrendingUp,
  Scale,
  Cpu,
} from 'lucide-react'

interface DomainTagProps {
  domain: FindingDomain | null
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const DomainIcons: Record<FindingDomain, typeof DollarSign> = {
  financial: DollarSign,
  operational: Settings,
  market: TrendingUp,
  legal: Scale,
  technical: Cpu,
}

const DomainColors: Record<FindingDomain, string> = {
  financial: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-emerald-200',
  operational: 'bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200',
  market: 'bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200',
  legal: 'bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200',
  technical: 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200',
}

export function DomainTag({
  domain,
  showIcon = true,
  size = 'md',
  className,
}: DomainTagProps) {
  if (!domain) {
    return (
      <Badge variant="secondary" className={cn('text-muted-foreground', className)}>
        Unknown
      </Badge>
    )
  }

  const { label } = getDomainInfo(domain)
  const Icon = DomainIcons[domain]
  const colorClass = DomainColors[domain]

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0',
    md: 'text-sm px-2 py-0.5',
    lg: 'text-base px-2.5 py-1',
  }

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-3.5 w-3.5',
    lg: 'h-4 w-4',
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'inline-flex items-center gap-1 font-medium border',
        colorClass,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && Icon && (
        <Icon className={cn(iconSizes[size], 'flex-shrink-0')} aria-hidden="true" />
      )}
      <span>{label}</span>
    </Badge>
  )
}
