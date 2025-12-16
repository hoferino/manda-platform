/**
 * Step 1: Basic Information
 * Collects project name, company name, and industry
 * Story: E1.5 - Implement Project Creation Wizard (AC: #2, #5)
 * Fix: TD-011.1 - Added searchable combobox for industry dropdown
 *
 * Note (v2.6): deal_type removed - it didn't drive any downstream behavior
 */

'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export const INDUSTRIES = [
  { value: 'technology', label: 'Technology & Software' },
  { value: 'saas', label: 'SaaS & Cloud' },
  { value: 'fintech', label: 'Fintech' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'pharma-biotech', label: 'Pharma & Biotech' },
  { value: 'medical-devices', label: 'Medical Devices' },
  { value: 'financial-services', label: 'Financial Services' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'industrial', label: 'Industrial & Manufacturing' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'aerospace-defense', label: 'Aerospace & Defense' },
  { value: 'retail', label: 'Retail & E-commerce' },
  { value: 'consumer-goods', label: 'Consumer Goods' },
  { value: 'food-beverage', label: 'Food & Beverage' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'oil-gas', label: 'Oil & Gas' },
  { value: 'renewables', label: 'Renewables & Clean Tech' },
  { value: 'real-estate', label: 'Real Estate' },
  { value: 'construction', label: 'Construction & Infrastructure' },
  { value: 'media-entertainment', label: 'Media & Entertainment' },
  { value: 'telecom', label: 'Telecommunications' },
  { value: 'logistics', label: 'Logistics & Transportation' },
  { value: 'professional-services', label: 'Professional Services' },
  { value: 'education', label: 'Education & EdTech' },
  { value: 'agriculture', label: 'Agriculture & AgTech' },
  { value: 'hospitality', label: 'Hospitality & Travel' },
  { value: 'other', label: 'Other' },
] as const

interface Step1BasicInfoProps {
  projectName: string
  companyName: string
  industry: string
  onProjectNameChange: (value: string) => void
  onCompanyNameChange: (value: string) => void
  onIndustryChange: (value: string) => void
  errors?: {
    projectName?: string
    companyName?: string
  }
}

const MAX_NAME_LENGTH = 200

export function Step1BasicInfo({
  projectName,
  companyName,
  industry,
  onProjectNameChange,
  onCompanyNameChange,
  onIndustryChange,
  errors,
}: Step1BasicInfoProps) {
  const [industryOpen, setIndustryOpen] = useState(false)

  const handleProjectNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length <= MAX_NAME_LENGTH) {
      onProjectNameChange(value)
    }
  }

  const handleCompanyNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    if (value.length <= MAX_NAME_LENGTH) {
      onCompanyNameChange(value)
    }
  }

  const selectedIndustry = INDUSTRIES.find((ind) => ind.value === industry)

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Basic Information</h2>
        <p className="text-muted-foreground">
          Enter the basic details for your new project.
        </p>
      </div>

      <div className="space-y-4">
        {/* Project Name */}
        <div className="space-y-2">
          <Label htmlFor="projectName">
            Project Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="projectName"
            value={projectName}
            onChange={handleProjectNameChange}
            placeholder="e.g., Acme Corp Acquisition - Q1 2025"
            aria-invalid={!!errors?.projectName}
            aria-describedby={errors?.projectName ? 'projectName-error' : undefined}
          />
          <div className="flex items-center justify-between text-xs">
            {errors?.projectName ? (
              <p id="projectName-error" className="text-destructive">
                {errors.projectName}
              </p>
            ) : (
              <p className="text-muted-foreground">
                Give your project a descriptive name
              </p>
            )}
            <span className="text-muted-foreground">
              {projectName.length}/{MAX_NAME_LENGTH}
            </span>
          </div>
        </div>

        {/* Company Name */}
        <div className="space-y-2">
          <Label htmlFor="companyName">Company Name</Label>
          <Input
            id="companyName"
            value={companyName}
            onChange={handleCompanyNameChange}
            placeholder="e.g., Acme Corporation"
            aria-invalid={!!errors?.companyName}
            aria-describedby={errors?.companyName ? 'companyName-error' : undefined}
          />
          <div className="flex items-center justify-between text-xs">
            {errors?.companyName ? (
              <p id="companyName-error" className="text-destructive">
                {errors.companyName}
              </p>
            ) : (
              <p className="text-muted-foreground">
                The target company for this deal (optional)
              </p>
            )}
            <span className="text-muted-foreground">
              {companyName.length}/{MAX_NAME_LENGTH}
            </span>
          </div>
        </div>

        {/* Industry - Searchable Combobox (TD-011.1 fix) */}
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Popover open={industryOpen} onOpenChange={setIndustryOpen}>
            <PopoverTrigger asChild>
              <Button
                id="industry"
                variant="outline"
                role="combobox"
                aria-expanded={industryOpen}
                className="w-full justify-between font-normal"
              >
                {selectedIndustry?.label || "Select an industry..."}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search industries..." />
                <CommandList>
                  <CommandEmpty>No industry found.</CommandEmpty>
                  <CommandGroup>
                    {INDUSTRIES.map((ind) => (
                      <CommandItem
                        key={ind.value}
                        value={ind.label}
                        onSelect={() => {
                          onIndustryChange(ind.value)
                          setIndustryOpen(false)
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            industry === ind.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {ind.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            Type to search or select from the list (optional)
          </p>
        </div>
      </div>
    </div>
  )
}
