/**
 * Step 2: IRL Template Selection
 * Allows user to select an IRL template or start with empty project
 * Story: E1.5 - Implement Project Creation Wizard (AC: #4)
 *
 * Note (v2.6): No longer depends on dealType - user selects template directly
 */

'use client'

import { useEffect, useState } from 'react'
import { FileText, Check, FolderOpen, Upload, ChevronDown, ChevronRight, X, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import { getAllTemplates } from '@/lib/services/irl-templates'
import type { IRLTemplate } from '@/lib/services/irl-templates'

// Preview data structure from API
interface PreviewData {
  totalItems: number
  totalCategories: number
  totalSubcategories: number
  categories: string[]
  subcategories: string[]
  warnings: string[]
  structure: CategoryStructure[]
}

interface CategoryStructure {
  name: string
  subcategories: Record<string, SubcategoryStructure>
  items: ItemPreview[]
}

interface SubcategoryStructure {
  name: string
  items: ItemPreview[]
}

interface ItemPreview {
  name: string
  priority: string
}

// Special constants for IRL options
export const NO_IRL_TEMPLATE = 'none'
export const UPLOAD_IRL_TEMPLATE = 'upload'

// Default template for new projects
const DEFAULT_TEMPLATE = 'Tech M&A'

// Load templates from the actual service
const TEMPLATES = getAllTemplates()

export type IrlTemplateId = string

type IrlOption = 'template' | 'empty' | 'upload'

interface Step3IRLTemplateProps {
  selectedTemplate: string
  onTemplateChange: (template: string) => void
  uploadedFile?: File | null
  onFileChange?: (file: File | null) => void
}

export function Step3IRLTemplate({
  selectedTemplate,
  onTemplateChange,
  uploadedFile,
  onFileChange,
}: Step3IRLTemplateProps) {
  // State for expanded sections in preview
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // State for file preview
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)

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
  const template = TEMPLATES.find((t) => t.name === selectedTemplate) || TEMPLATES[0]

  // Fetch preview when file is uploaded
  const fetchPreview = async (file: File) => {
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewData(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/irl/preview', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to preview file')
      }

      if (data.success) {
        setPreviewData(data.preview)
      }
    } catch (error) {
      console.error('Preview error:', error)
      setPreviewError(error instanceof Error ? error.message : 'Failed to preview file')
    } finally {
      setPreviewLoading(false)
    }
  }

  // Effect to fetch preview when file changes
  useEffect(() => {
    if (uploadedFile && selectedOption === 'upload') {
      fetchPreview(uploadedFile)
    } else {
      setPreviewData(null)
      setPreviewError(null)
    }
  }, [uploadedFile, selectedOption])

  // Toggle section expansion
  const toggleSection = (sectionName: string) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(sectionName)) {
        newSet.delete(sectionName)
      } else {
        newSet.add(sectionName)
      }
      return newSet
    })
  }

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
                  {TEMPLATES.map((tmpl) => (
                    <SelectItem key={tmpl.id} value={tmpl.name}>
                      {tmpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preview Section - Expandable Categories with Items */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Preview Template Structure</h4>
              <div className="space-y-2 rounded-md border p-3">
                {template?.categories.map((category, catIndex) => (
                  <div key={catIndex} className="space-y-1">
                    <button
                      type="button"
                      onClick={() => toggleSection(category.name)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/50"
                    >
                      {expandedSections.has(category.name) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {category.name}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {category.items.length} items
                      </span>
                    </button>
                    {expandedSections.has(category.name) && (
                      <ul className="ml-6 space-y-1 border-l-2 border-muted pl-3">
                        {category.items.map((item, itemIndex) => (
                          <li
                            key={itemIndex}
                            className="text-xs text-muted-foreground"
                          >
                            • {item.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload File (shown when upload is selected) */}
      {selectedOption === 'upload' && (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-medium">Upload Your IRL File</h3>
                <p className="text-sm text-muted-foreground">
                  Upload an Excel (.xlsx) or CSV file with your Information Request List.
                  The file will be processed during project creation.
                </p>
              </div>

              {/* File Upload Area */}
              <div
                className={cn(
                  'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
                  uploadedFile
                    ? 'border-green-500 bg-green-50'
                    : 'border-muted-foreground/25 hover:border-muted-foreground/50'
                )}
                onClick={() => document.getElementById('irl-file-upload')?.click()}
              >
                <input
                  id="irl-file-upload"
                  type="file"
                  className="sr-only"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && onFileChange) {
                      onFileChange(file)
                    }
                  }}
                />

                {!uploadedFile ? (
                  <>
                    <Upload className="mb-3 h-10 w-10 text-muted-foreground" />
                    <p className="mb-1 text-sm font-medium">
                      Click to upload Excel or CSV file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Maximum file size: 10MB
                    </p>
                  </>
                ) : (
                  <div className="flex w-full items-center gap-3">
                    <FileText className="h-8 w-8 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium">{uploadedFile.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(uploadedFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (onFileChange) {
                          onFileChange(null)
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Preview Loading State */}
              {previewLoading && (
                <div className="flex items-center justify-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analyzing file structure...</span>
                </div>
              )}

              {/* Preview Error */}
              {previewError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{previewError}</AlertDescription>
                </Alert>
              )}

              {/* Preview Success */}
              {uploadedFile && !previewLoading && !previewError && previewData && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-900 border border-green-200">
                  <p className="font-medium">File parsed successfully</p>
                  <p className="text-xs text-green-700 mt-1">
                    The IRL will be created with {previewData.totalItems} items in {previewData.totalCategories} categories
                    {previewData.totalSubcategories > 0 && ` and ${previewData.totalSubcategories} subcategories`}.
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Preview Structure (shown after successful file upload) */}
      {selectedOption === 'upload' && previewData && !previewLoading && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Detected Structure</CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold">{previewData.totalCategories}</div>
                <div className="text-xs text-muted-foreground">Categories</div>
              </div>
              <div className="rounded-md border bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold">{previewData.totalSubcategories}</div>
                <div className="text-xs text-muted-foreground">Subcategories</div>
              </div>
              <div className="rounded-md border bg-muted/50 p-3 text-center">
                <div className="text-2xl font-bold">{previewData.totalItems}</div>
                <div className="text-xs text-muted-foreground">Items</div>
              </div>
            </div>

            {/* Warnings */}
            {previewData.warnings.length > 0 && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {previewData.warnings.map((warning, idx) => (
                      <div key={idx} className="text-xs">
                        {warning}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Expandable Structure */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium">Preview Structure</h4>
              <div className="space-y-2 rounded-md border p-3 max-h-96 overflow-y-auto">
                {previewData.structure.map((category, catIndex) => (
                  <div key={catIndex} className="space-y-1">
                    {/* Category Level */}
                    <button
                      type="button"
                      onClick={() => toggleSection(`preview-${category.name}`)}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm font-medium hover:bg-muted/50"
                    >
                      {expandedSections.has(`preview-${category.name}`) ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      {category.name}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {category.items.length + Object.values(category.subcategories).reduce((sum, sub) => sum + sub.items.length, 0)} items
                      </span>
                    </button>

                    {/* Expanded Category Content */}
                    {expandedSections.has(`preview-${category.name}`) && (
                      <div className="ml-6 space-y-2 border-l-2 border-muted pl-3">
                        {/* Direct items under category */}
                        {category.items.length > 0 && (
                          <ul className="space-y-1">
                            {category.items.map((item, itemIndex) => (
                              <li
                                key={itemIndex}
                                className="text-xs text-muted-foreground"
                              >
                                • {item.name}
                                {item.priority && (
                                  <span className="ml-2 text-xs font-medium text-blue-600">
                                    [{item.priority}]
                                  </span>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Subcategories */}
                        {Object.values(category.subcategories).map((subcategory, subIndex) => (
                          <div key={subIndex} className="space-y-1">
                            <button
                              type="button"
                              onClick={() => toggleSection(`preview-${category.name}-${subcategory.name}`)}
                              className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left text-xs font-medium hover:bg-muted/50"
                            >
                              {expandedSections.has(`preview-${category.name}-${subcategory.name}`) ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )}
                              {subcategory.name}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {subcategory.items.length} items
                              </span>
                            </button>

                            {/* Subcategory Items */}
                            {expandedSections.has(`preview-${category.name}-${subcategory.name}`) && (
                              <ul className="ml-5 space-y-1 border-l border-muted pl-3">
                                {subcategory.items.map((item, itemIndex) => (
                                  <li
                                    key={itemIndex}
                                    className="text-xs text-muted-foreground"
                                  >
                                    • {item.name}
                                    {item.priority && (
                                      <span className="ml-2 text-xs font-medium text-blue-600">
                                        [{item.priority}]
                                      </span>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
