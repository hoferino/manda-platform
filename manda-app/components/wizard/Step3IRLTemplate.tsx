/**
 * Step 2: IRL Template Selection
 * Allows user to select an IRL template or start with empty project
 * Story: E1.5 - Implement Project Creation Wizard (AC: #4)
 *
 * Note (v2.6): No longer depends on dealType - user selects template directly
 */

'use client'

import { useEffect } from 'react'
import { FileText, Check, FolderOpen, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Special constants for IRL options
export const NO_IRL_TEMPLATE = 'none'
export const UPLOAD_IRL_TEMPLATE = 'upload'

// Default template for new projects
const DEFAULT_TEMPLATE = 'General M&A'

// IRL template configuration
// NOTE: These names MUST match TEMPLATE_NAME_TO_ID in create-deal-with-irl.ts
export const IRL_TEMPLATES = {
  'tech-ma': {
    name: 'Tech M&A',
    sections: [
      'Company Information',
      'Financial Statements (3 years)',
      'Technology Stack & IP',
      'Customer Contracts',
      'Employee Information',
      'Legal & Compliance',
    ],
  },
  industrial: {
    name: 'Industrial',
    sections: [
      'Company Information',
      'Financial Statements',
      'Manufacturing Facilities',
      'Supply Chain Agreements',
      'Environmental Compliance',
      'Safety Records',
    ],
  },
  pharma: {
    name: 'Pharma',
    sections: [
      'Company Information',
      'Financial Statements',
      'Clinical Trial Data',
      'Regulatory Approvals (FDA, EMA)',
      'Patents & IP',
      'R&D Pipeline',
    ],
  },
  financial: {
    name: 'Financial Services',
    sections: [
      'Company Information',
      'Financial Statements',
      'Regulatory Compliance',
      'Risk Management',
      'Customer Data',
      'Technology Systems',
    ],
  },
  custom: {
    name: 'General M&A',
    sections: [
      'Company Information',
      'Financial Statements',
      'Contracts & Agreements',
      'Legal & Compliance',
      'Operations',
      'Strategic Documents',
    ],
  },
} as const

export type IrlTemplateId = keyof typeof IRL_TEMPLATES

type IrlOption = 'template' | 'empty' | 'upload'

interface Step3IRLTemplateProps {
  selectedTemplate: string
  onTemplateChange: (template: string) => void
}

export function Step3IRLTemplate({
  selectedTemplate,
  onTemplateChange,
}: Step3IRLTemplateProps) {
  // Determine which option is selected
  const getSelectedOption = (): IrlOption => {
    if (selectedTemplate === NO_IRL_TEMPLATE) return 'empty'
    if (selectedTemplate === UPLOAD_IRL_TEMPLATE) return 'upload'
    return 'template'
  }
  const selectedOption = getSelectedOption()

  // Auto-select default template when switching to "Use Template" option
  useEffect(() => {
    if (selectedOption === 'template' && !selectedTemplate) {
      onTemplateChange(DEFAULT_TEMPLATE)
    }
  }, [selectedOption, selectedTemplate, onTemplateChange])

  // Get the template data for the selected template
  const templateKey = Object.entries(IRL_TEMPLATES).find(
    ([, template]) => template.name === selectedTemplate
  )?.[0] as IrlTemplateId | undefined

  const template = templateKey
    ? IRL_TEMPLATES[templateKey]
    : IRL_TEMPLATES.custom

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">IRL Template</h2>
        <p className="text-muted-foreground">
          Choose how to set up your Information Request List (IRL) for this project.
        </p>
      </div>

      {/* Option Cards - 3 options */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Use Template Option */}
        <Card
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
            selectedOption === 'template' && 'border-primary ring-2 ring-primary ring-offset-2'
          )}
          onClick={() => {
            if (selectedOption !== 'template') {
              onTemplateChange(DEFAULT_TEMPLATE)
            }
          }}
          role="button"
          tabIndex={0}
          aria-pressed={selectedOption === 'template'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (selectedOption !== 'template') {
                onTemplateChange(DEFAULT_TEMPLATE)
              }
            }
          }}
        >
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg',
                selectedOption === 'template'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <FileText className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Use Template</h3>
              <p className="text-xs text-muted-foreground">
                Start with a pre-built IRL based on your project type
              </p>
            </div>
            {selectedOption === 'template' && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </CardContent>
        </Card>

        {/* Empty Project Option */}
        <Card
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
            selectedOption === 'empty' && 'border-primary ring-2 ring-primary ring-offset-2'
          )}
          onClick={() => onTemplateChange(NO_IRL_TEMPLATE)}
          role="button"
          tabIndex={0}
          aria-pressed={selectedOption === 'empty'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onTemplateChange(NO_IRL_TEMPLATE)
            }
          }}
        >
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg',
                selectedOption === 'empty'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <FolderOpen className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Empty Project</h3>
              <p className="text-xs text-muted-foreground">
                Start with no IRL - build your own structure later
              </p>
            </div>
            {selectedOption === 'empty' && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </CardContent>
        </Card>

        {/* Upload Custom IRL Option */}
        <Card
          className={cn(
            'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
            selectedOption === 'upload' && 'border-primary ring-2 ring-primary ring-offset-2'
          )}
          onClick={() => onTemplateChange(UPLOAD_IRL_TEMPLATE)}
          role="button"
          tabIndex={0}
          aria-pressed={selectedOption === 'upload'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onTemplateChange(UPLOAD_IRL_TEMPLATE)
            }
          }}
        >
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg',
                selectedOption === 'upload'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground'
              )}
            >
              <Upload className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">Upload Custom</h3>
              <p className="text-xs text-muted-foreground">
                Upload your own IRL (Excel/CSV) after project creation
              </p>
            </div>
            {selectedOption === 'upload' && (
              <Check className="h-5 w-5 text-primary" />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Template Preview (only shown when using a template) */}
      {selectedOption === 'template' && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Select Template</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Template Selector - ALWAYS VISIBLE */}
            <div className="space-y-2">
              <Select
                value={selectedTemplate}
                onValueChange={(value) => onTemplateChange(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(IRL_TEMPLATES).map(([key, tmpl]) => (
                    <SelectItem key={key} value={tmpl.name}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Preview Template Sections</h4>
              <ul className="space-y-2 border-l-2 border-muted pl-4">
                {template.sections.map((section, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground"
                  >
                    {section}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload Info (shown when upload is selected) */}
      {selectedOption === 'upload' && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="space-y-1">
              <h3 className="font-medium">Upload after creation</h3>
              <p className="text-sm text-muted-foreground">
                After your project is created, you&apos;ll be able to upload your custom IRL
                in Excel (.xlsx) or CSV format from the project workspace.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <div className="rounded-lg bg-muted/50 p-4">
        <h3 className="mb-2 text-sm font-medium">What Happens Next</h3>
        <p className="text-sm text-muted-foreground">
          {selectedOption === 'empty' && (
            <>
              Your project will be created with an empty data room.
              You can manually create folders and upload documents as needed.
            </>
          )}
          {selectedOption === 'upload' && (
            <>
              Your project will be created and you can upload your custom IRL Excel file.
              The system will parse your Excel file and automatically create folders and checklist items based on your IRL structure.
            </>
          )}
          {selectedOption === 'template' && (
            <>
              Your project will be created with the <strong>{selectedTemplate}</strong> template.
              Folders will be automatically created in your data room matching the template categories,
              and the IRL checklist will be populated with all template items.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
