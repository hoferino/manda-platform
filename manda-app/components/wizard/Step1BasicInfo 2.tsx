/**
 * Step 1: Basic Information
 * Collects project name, company name, and industry
 * Story: E1.5 - Implement Project Creation Wizard (AC: #2, #5)
 */

'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const INDUSTRIES = [
  { value: 'technology', label: 'Technology' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'financial-services', label: 'Financial Services' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'retail', label: 'Retail' },
  { value: 'energy', label: 'Energy' },
  { value: 'real-estate', label: 'Real Estate' },
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

const MAX_NAME_LENGTH = 100

export function Step1BasicInfo({
  projectName,
  companyName,
  industry,
  onProjectNameChange,
  onCompanyNameChange,
  onIndustryChange,
  errors,
}: Step1BasicInfoProps) {
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

        {/* Industry */}
        <div className="space-y-2">
          <Label htmlFor="industry">Industry</Label>
          <Select value={industry} onValueChange={onIndustryChange}>
            <SelectTrigger id="industry">
              <SelectValue placeholder="Select an industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((ind) => (
                <SelectItem key={ind.value} value={ind.value}>
                  {ind.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Select the industry category (optional)
          </p>
        </div>
      </div>
    </div>
  )
}
