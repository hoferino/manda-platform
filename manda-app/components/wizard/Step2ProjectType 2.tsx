/**
 * Step 2: Project Type Selection
 * Allows user to select the M&A project type
 * Story: E1.5 - Implement Project Creation Wizard (AC: #3)
 */

'use client'

import { Laptop, Factory, Pill, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export const PROJECT_TYPES = [
  {
    id: 'tech-ma',
    name: 'Tech M&A',
    icon: Laptop,
    description: 'Technology companies, software, SaaS, digital platforms',
  },
  {
    id: 'industrial',
    name: 'Industrial',
    icon: Factory,
    description: 'Manufacturing, logistics, infrastructure, heavy industry',
  },
  {
    id: 'pharma',
    name: 'Pharma',
    icon: Pill,
    description: 'Pharmaceuticals, biotech, healthcare, medical devices',
  },
  {
    id: 'custom',
    name: 'Custom',
    icon: Settings,
    description: 'General M&A with customizable templates',
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
                <div className="space-y-1">
                  <h3 className="font-semibold">{type.name}</h3>
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
  )
}
