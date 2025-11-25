/**
 * Step 2: Project Type Selection
 * Allows user to select the M&A project type
 * Story: E1.5 - Implement Project Creation Wizard (AC: #3)
 */

'use client'

import { Laptop, Factory, Pill, Settings, Info } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export const PROJECT_TYPES = [
  {
    id: 'tech-ma',
    name: 'Tech M&A',
    icon: Laptop,
    description: 'Technology companies, software, SaaS, digital platforms',
    tooltip: 'Includes IRL sections for IP, tech stack, SaaS metrics, and customer contracts',
  },
  {
    id: 'industrial',
    name: 'Industrial',
    icon: Factory,
    description: 'Manufacturing, logistics, infrastructure, heavy industry',
    tooltip: 'Includes IRL sections for facilities, supply chain, environmental compliance, and safety',
  },
  {
    id: 'pharma',
    name: 'Pharma',
    icon: Pill,
    description: 'Pharmaceuticals, biotech, healthcare, medical devices',
    tooltip: 'Includes IRL sections for clinical trials, FDA approvals, patents, and R&D pipeline',
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: Settings,
    description: 'General M&A with customizable templates',
    tooltip: 'Flexible structure suitable for any deal type - customize after creation',
  },
] as const

export type ProjectTypeId = (typeof PROJECT_TYPES)[number]['id']

interface Step2ProjectTypeProps {
  selectedType: string
  onTypeSelect: (typeId: string) => void
}

export function Step2ProjectType({
  selectedType,
  onTypeSelect,
}: Step2ProjectTypeProps) {
  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Project Type</h2>
          <p className="text-muted-foreground">
            Select the type of M&A project. This helps us suggest the right IRL template.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {PROJECT_TYPES.map((type) => {
            const Icon = type.icon
            const isSelected = selectedType === type.id

            return (
              <Card
                key={type.id}
                className={cn(
                  'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
                  isSelected && 'border-primary ring-2 ring-primary ring-offset-2'
                )}
                onClick={() => onTypeSelect(type.id)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onTypeSelect(type.id)
                  }
                }}
              >
                <CardContent className="flex items-start gap-4 p-6">
                  <div
                    className={cn(
                      'flex h-12 w-12 shrink-0 items-center justify-center rounded-lg',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{type.name}</h3>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Info className="h-4 w-4" />
                            <span className="sr-only">More info about {type.name}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[250px]">
                          <p>{type.tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {type.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
