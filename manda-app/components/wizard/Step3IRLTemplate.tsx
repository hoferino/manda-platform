/**
 * Step 3: IRL Template Selection
 * Auto-suggests IRL template based on project type with preview
 * Story: E1.5 - Implement Project Creation Wizard (AC: #4)
 */

'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Check, FolderOpen, Upload } from 'lucide-react'
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

// IRL template configuration based on project type
export const IRL_TEMPLATES = {
  'tech-ma': {
    name: 'Tech M&A Standard IRL',
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
    name: 'Industrial M&A IRL',
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
    name: 'Pharma M&A IRL',
    sections: [
      'Company Information',
      'Financial Statements',
      'Clinical Trial Data',
      'Regulatory Approvals (FDA, EMA)',
      'Patents & IP',
      'R&D Pipeline',
    ],
  },
  custom: {
    name: 'General M&A IRL',
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

// Get default template based on deal type
export function getDefaultTemplate(dealType: string): string {
  const templates: Record<string, string> = {
    'tech-ma': 'Tech M&A Standard IRL',
    industrial: 'Industrial M&A IRL',
    pharma: 'Pharma M&A IRL',
    custom: 'General M&A IRL',
  }
  return templates[dealType] || 'General M&A IRL'
}

type IrlOption = 'template' | 'empty' | 'upload'

interface Step3IRLTemplateProps {
  dealType: string
  selectedTemplate: string
  onTemplateChange: (template: string) => void
}

export function Step3IRLTemplate({
  dealType,
  selectedTemplate,
  onTemplateChange,
}: Step3IRLTemplateProps) {
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false)
  const [showTemplateSelect, setShowTemplateSelect] = useState(false)

  // Determine which option is selected
  const getSelectedOption = (): IrlOption => {
    if (selectedTemplate === NO_IRL_TEMPLATE) return 'empty'
    if (selectedTemplate === UPLOAD_IRL_TEMPLATE) return 'upload'
    return 'template'
  }
  const selectedOption = getSelectedOption()

  // Get the template data for the selected template
  const templateKey = Object.entries(IRL_TEMPLATES).find(
    ([, template]) => template.name === selectedTemplate
  )?.[0] as IrlTemplateId | undefined

  const template = templateKey
    ? IRL_TEMPLATES[templateKey]
    : IRL_TEMPLATES[dealType as IrlTemplateId] || IRL_TEMPLATES.custom

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
              onTemplateChange(getDefaultTemplate(dealType))
            }
          }}
          role="button"
          tabIndex={0}
          aria-pressed={selectedOption === 'template'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              if (selectedOption !== 'template') {
                onTemplateChange(getDefaultTemplate(dealType))
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
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">{selectedTemplate}</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowTemplateSelect(!showTemplateSelect)}
              >
                Change Template
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Template Selector */}
            {showTemplateSelect && (
              <div className="space-y-2 border-b pb-4">
                <Select
                  value={selectedTemplate}
                  onValueChange={(value) => {
                    onTemplateChange(value)
                    setShowTemplateSelect(false)
                  }}
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
            )}

            {/* Preview Section */}
            <div>
              <Button
                variant="ghost"
                className="w-full justify-between px-0 hover:bg-transparent"
                onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
              >
                <span className="text-sm font-medium">Preview Template Sections</span>
                {isPreviewExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>

              <div
                className={cn(
                  'overflow-hidden transition-all duration-200',
                  isPreviewExpanded ? 'mt-3 max-h-96' : 'max-h-0'
                )}
              >
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
        <h3 className="mb-2 text-sm font-medium">Ready to Create</h3>
        <p className="text-sm text-muted-foreground">
          {selectedOption === 'empty' && (
            <>
              Click &quot;Create Project&quot; to create an empty project with no IRL.
              You can build your IRL structure manually later.
            </>
          )}
          {selectedOption === 'upload' && (
            <>
              Click &quot;Create Project&quot; to create your project. You&apos;ll be
              prompted to upload your custom IRL file in the project workspace.
            </>
          )}
          {selectedOption === 'template' && (
            <>
              Click &quot;Create Project&quot; to set up your project with the{' '}
              <strong>{selectedTemplate}</strong>. You can customize the IRL
              structure after creation.
            </>
          )}
        </p>
      </div>
    </div>
  )
}
