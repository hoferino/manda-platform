/**
 * ExportModal Component
 * Full-featured export modal with format, field, and scope selection
 * Story: E4.12 - Implement Export Findings Feature (Advanced) (AC: 1, 2, 3, 7, 10)
 *
 * Features:
 * - Export format selection (CSV, Excel, Report)
 * - Field selection checkboxes with Select All/Deselect All
 * - Export scope (All/Filtered/Selected)
 * - Progress indicator for large exports (>500 findings)
 * - Export history with re-download
 * - Keyboard accessible (Escape, Tab, Enter)
 * - ARIA dialog pattern
 */

'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileOutput,
  Loader2,
  X,
  Clock,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ExportFilters } from '@/lib/api/findings'

// Export format types
export type ExportFormat = 'csv' | 'xlsx' | 'report'

// Export scope types
export type ExportScope = 'all' | 'filtered' | 'selected'

// Available export fields
export const EXPORT_FIELDS = [
  { key: 'text', label: 'Finding Text', default: true },
  { key: 'sourceDocument', label: 'Source Document', default: true },
  { key: 'pageReference', label: 'Page/Cell', default: true },
  { key: 'domain', label: 'Domain', default: true },
  { key: 'findingType', label: 'Type', default: true },
  { key: 'confidence', label: 'Confidence', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'createdAt', label: 'Created Date', default: true },
] as const

export type ExportField = (typeof EXPORT_FIELDS)[number]['key']

// Export history item
export interface ExportHistoryItem {
  id: string
  filename: string
  format: ExportFormat
  count: number
  date: Date
  blobUrl: string
  expiresAt: Date
}

// Format configuration
const FORMAT_CONFIG: Record<
  ExportFormat,
  {
    label: string
    description: string
    icon: React.ComponentType<{ className?: string }>
  }
> = {
  csv: {
    label: 'CSV',
    description: 'Plain text, opens in any spreadsheet app',
    icon: FileText,
  },
  xlsx: {
    label: 'Excel',
    description: 'Formatted with colors, freeze pane, auto-fit columns',
    icon: FileSpreadsheet,
  },
  report: {
    label: 'Report',
    description: 'Formatted HTML grouped by domain with statistics',
    icon: FileOutput,
  },
}

// Maximum findings per export
const MAX_EXPORT_FINDINGS = 5000

// Background processing threshold
const BACKGROUND_THRESHOLD = 500

// Export history expiry (1 hour)
const HISTORY_EXPIRY_MS = 60 * 60 * 1000

// Local storage key for export history
const HISTORY_STORAGE_KEY = 'manda-export-history'

export interface ExportModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName?: string
  filters: ExportFilters
  findingCount: number
  filteredCount: number
  selectedIds: Set<string>
  searchQuery?: string
}

export function ExportModal({
  isOpen,
  onOpenChange,
  projectId,
  projectName = 'Project',
  filters,
  findingCount,
  filteredCount,
  selectedIds,
  searchQuery,
}: ExportModalProps) {
  // Form state
  const [format, setFormat] = useState<ExportFormat>('xlsx')
  const [selectedFields, setSelectedFields] = useState<Set<ExportField>>(
    new Set(EXPORT_FIELDS.filter((f) => f.default).map((f) => f.key))
  )
  const [scope, setScope] = useState<ExportScope>(() => {
    // Default scope based on context
    if (selectedIds.size > 0) return 'selected'
    const hasFilters =
      filters.documentId ||
      (filters.domain && filters.domain.length > 0) ||
      (filters.status && filters.status.length > 0) ||
      filters.confidenceMin !== undefined ||
      filters.confidenceMax !== undefined ||
      searchQuery
    return hasFilters ? 'filtered' : 'all'
  })
  const [includeFilterCriteria, setIncludeFilterCriteria] = useState(true)

  // Export state
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [exportAbortController, setExportAbortController] =
    useState<AbortController | null>(null)

  // History state
  const [history, setHistory] = useState<ExportHistoryItem[]>([])
  const [showHistory, setShowHistory] = useState(false)

  // Calculate counts for each scope
  const scopeCounts = useMemo(
    () => ({
      all: findingCount,
      filtered: filteredCount,
      selected: selectedIds.size,
    }),
    [findingCount, filteredCount, selectedIds.size]
  )

  // Get count for current scope
  const currentCount = scopeCounts[scope]

  // Determine if we need background processing
  const needsBackgroundProcessing = currentCount > BACKGROUND_THRESHOLD

  // Can export (at least one field selected)
  const canExport = selectedFields.size > 0 && currentCount > 0

  // Load history from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_STORAGE_KEY)
      if (stored) {
        const items: ExportHistoryItem[] = JSON.parse(stored)
        // Filter out expired items
        const now = Date.now()
        const validItems = items.filter(
          (item) => new Date(item.expiresAt).getTime() > now
        )
        setHistory(validItems)
        // Save back filtered list
        if (validItems.length !== items.length) {
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(validItems))
        }
      }
    } catch {
      console.error('Failed to load export history')
    }
  }, [])

  // Handle field toggle
  const toggleField = useCallback((field: ExportField) => {
    setSelectedFields((prev) => {
      const next = new Set(prev)
      if (next.has(field)) {
        next.delete(field)
      } else {
        next.add(field)
      }
      return next
    })
  }, [])

  // Select all fields
  const selectAllFields = useCallback(() => {
    setSelectedFields(new Set(EXPORT_FIELDS.map((f) => f.key)))
  }, [])

  // Deselect all fields
  const deselectAllFields = useCallback(() => {
    setSelectedFields(new Set())
  }, [])

  // Get ordered fields array
  const orderedFields = useMemo(() => {
    return EXPORT_FIELDS.filter((f) => selectedFields.has(f.key)).map(
      (f) => f.key
    )
  }, [selectedFields])

  // Build filter criteria string for display
  const filterCriteriaString = useMemo(() => {
    const parts: string[] = []

    if (filters.documentId) {
      parts.push(`Document: ${filters.documentId}`)
    }
    if (filters.domain && filters.domain.length > 0) {
      parts.push(`Domain: ${filters.domain.join(', ')}`)
    }
    if (filters.findingType && filters.findingType.length > 0) {
      parts.push(`Type: ${filters.findingType.join(', ')}`)
    }
    if (filters.status && filters.status.length > 0) {
      parts.push(`Status: ${filters.status.join(', ')}`)
    }
    if (filters.confidenceMin !== undefined) {
      parts.push(`Confidence >= ${Math.round(filters.confidenceMin * 100)}%`)
    }
    if (filters.confidenceMax !== undefined) {
      parts.push(`Confidence <= ${Math.round(filters.confidenceMax * 100)}%`)
    }
    if (searchQuery) {
      parts.push(`Search: "${searchQuery}"`)
    }

    return parts.length > 0 ? parts.join(', ') : 'No filters applied'
  }, [filters, searchQuery])

  // Save export to history
  const saveToHistory = useCallback(
    (
      filename: string,
      exportFormat: ExportFormat,
      count: number,
      blobUrl: string
    ) => {
      const newItem: ExportHistoryItem = {
        id: crypto.randomUUID(),
        filename,
        format: exportFormat,
        count,
        date: new Date(),
        blobUrl,
        expiresAt: new Date(Date.now() + HISTORY_EXPIRY_MS),
      }

      setHistory((prev) => {
        // Keep only last 5 items
        const updated = [newItem, ...prev].slice(0, 5)
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated))
        return updated
      })
    },
    []
  )

  // Clear history
  const clearHistory = useCallback(() => {
    // Revoke all blob URLs
    history.forEach((item) => {
      try {
        URL.revokeObjectURL(item.blobUrl)
      } catch {
        // Ignore errors
      }
    })
    setHistory([])
    localStorage.removeItem(HISTORY_STORAGE_KEY)
  }, [history])

  // Re-download from history
  const downloadFromHistory = useCallback((item: ExportHistoryItem) => {
    const link = document.createElement('a')
    link.href = item.blobUrl
    link.download = item.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    toast.success(`Downloaded ${item.filename}`)
  }, [])

  // Handle export
  const handleExport = useCallback(async () => {
    if (!canExport) return

    setIsExporting(true)
    setExportProgress(0)

    const controller = new AbortController()
    setExportAbortController(controller)

    try {
      // Build request body
      const body = {
        format,
        fields: orderedFields,
        scope,
        findingIds: scope === 'selected' ? Array.from(selectedIds) : undefined,
        includeFilterCriteria,
        filters,
        searchQuery,
      }

      // Simulate progress for large exports
      let progressInterval: ReturnType<typeof setInterval> | undefined
      if (needsBackgroundProcessing) {
        progressInterval = setInterval(() => {
          setExportProgress((prev) => Math.min(prev + 5, 90))
        }, 200)
      }

      const response = await fetch(
        `/api/projects/${projectId}/findings/export`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      )

      if (progressInterval) {
        clearInterval(progressInterval)
      }

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      setExportProgress(100)

      // Get metadata from headers
      const filename =
        response.headers.get('X-Export-Filename') ||
        `findings-export.${format === 'report' ? 'html' : format}`
      const count = parseInt(response.headers.get('X-Export-Count') || '0', 10)

      // Get blob and create download URL
      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)

      // Save to history
      saveToHistory(filename, format, count, blobUrl)

      // Trigger download
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Show success toast
      toast.success(`Exported ${count} findings to ${filename}`, {
        description:
          count >= MAX_EXPORT_FINDINGS
            ? `Note: Export limited to first ${MAX_EXPORT_FINDINGS} findings`
            : undefined,
      })

      // Close modal
      onOpenChange(false)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('Export cancelled')
      } else {
        console.error('Export failed:', error)
        toast.error('Export failed', {
          description:
            error instanceof Error ? error.message : 'Please try again',
        })
      }
    } finally {
      setIsExporting(false)
      setExportProgress(0)
      setExportAbortController(null)
    }
  }, [
    canExport,
    format,
    orderedFields,
    scope,
    selectedIds,
    includeFilterCriteria,
    filters,
    searchQuery,
    needsBackgroundProcessing,
    projectId,
    saveToHistory,
    onOpenChange,
  ])

  // Handle cancel export
  const handleCancelExport = useCallback(() => {
    if (exportAbortController) {
      exportAbortController.abort()
    }
  }, [exportAbortController])

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedFields(
        new Set(EXPORT_FIELDS.filter((f) => f.default).map((f) => f.key))
      )
      // Set default scope based on context
      if (selectedIds.size > 0) {
        setScope('selected')
      } else {
        const hasFilters =
          filters.documentId ||
          (filters.domain && filters.domain.length > 0) ||
          (filters.status && filters.status.length > 0) ||
          filters.confidenceMin !== undefined ||
          filters.confidenceMax !== undefined ||
          searchQuery
        setScope(hasFilters ? 'filtered' : 'all')
      }
      setShowHistory(false)
    }
  }, [isOpen, selectedIds.size, filters, searchQuery])

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        aria-describedby="export-modal-description"
      >
        <DialogHeader>
          <DialogTitle>Export Findings</DialogTitle>
          <DialogDescription id="export-modal-description">
            Export findings from {projectName} to CSV, Excel, or Report format.
          </DialogDescription>
        </DialogHeader>

        {/* Progress Indicator (only during export) */}
        {isExporting && (
          <div className="space-y-2" role="status" aria-live="polite">
            <div className="flex items-center justify-between text-sm">
              <span>Exporting...</span>
              <span>{exportProgress}%</span>
            </div>
            <Progress value={exportProgress} className="h-2" />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelExport}
              className="w-full"
            >
              <X className="mr-2 h-4 w-4" />
              Cancel Export
            </Button>
          </div>
        )}

        {/* Main Form (hidden during export) */}
        {!isExporting && (
          <div className="space-y-6">
            {/* Format Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Format</Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(FORMAT_CONFIG) as ExportFormat[]).map((f) => {
                  const config = FORMAT_CONFIG[f]
                  const Icon = config.icon
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={cn(
                        'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-colors',
                        format === f
                          ? 'border-primary bg-primary/5'
                          : 'border-muted hover:border-muted-foreground/25'
                      )}
                      aria-pressed={format === f}
                    >
                      <Icon className="h-6 w-6" />
                      <span className="text-sm font-medium">{config.label}</span>
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                {FORMAT_CONFIG[format].description}
              </p>
            </div>

            <Separator />

            {/* Field Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Fields</Label>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={selectAllFields}
                    className="h-7 text-xs"
                  >
                    Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={deselectAllFields}
                    className="h-7 text-xs"
                  >
                    Deselect All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {EXPORT_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`field-${field.key}`}
                      checked={selectedFields.has(field.key)}
                      onCheckedChange={() => toggleField(field.key)}
                    />
                    <Label
                      htmlFor={`field-${field.key}`}
                      className="text-sm cursor-pointer"
                    >
                      {field.label}
                    </Label>
                  </div>
                ))}
              </div>
              {selectedFields.size === 0 && (
                <p className="text-xs text-destructive">
                  At least one field must be selected
                </p>
              )}
            </div>

            <Separator />

            {/* Scope Selection */}
            <fieldset className="space-y-3">
              <legend className="text-base font-medium">Export Scope</legend>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as ExportScope)}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="scope-all" />
                  <Label htmlFor="scope-all" className="cursor-pointer">
                    Export All ({scopeCounts.all.toLocaleString()} findings)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filtered" id="scope-filtered" />
                  <Label htmlFor="scope-filtered" className="cursor-pointer">
                    Export Filtered ({scopeCounts.filtered.toLocaleString()}{' '}
                    findings)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="selected"
                    id="scope-selected"
                    disabled={scopeCounts.selected === 0}
                  />
                  <Label
                    htmlFor="scope-selected"
                    className={cn(
                      'cursor-pointer',
                      scopeCounts.selected === 0 && 'text-muted-foreground'
                    )}
                  >
                    Export Selected ({scopeCounts.selected.toLocaleString()}{' '}
                    findings)
                    {scopeCounts.selected === 0 && (
                      <span className="ml-2 text-xs">(no selection)</span>
                    )}
                  </Label>
                </div>
              </RadioGroup>
            </fieldset>

            {/* Include Filter Criteria Option */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-filter-criteria"
                checked={includeFilterCriteria}
                onCheckedChange={(checked) =>
                  setIncludeFilterCriteria(checked === true)
                }
              />
              <Label
                htmlFor="include-filter-criteria"
                className="text-sm cursor-pointer"
              >
                Include filter criteria in export
              </Label>
            </div>
            {includeFilterCriteria && (
              <p className="text-xs text-muted-foreground pl-6">
                {filterCriteriaString}
              </p>
            )}

            {/* Warning for large exports */}
            {currentCount > MAX_EXPORT_FINDINGS && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-sm text-yellow-700 dark:text-yellow-400">
                Only the first {MAX_EXPORT_FINDINGS.toLocaleString()} findings
                will be exported.
              </div>
            )}

            {/* Export History */}
            {history.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="flex items-center gap-2 text-sm font-medium hover:underline"
                  >
                    <Clock className="h-4 w-4" />
                    Recent Exports ({history.length})
                  </button>
                  {showHistory && (
                    <div className="space-y-2">
                      {history.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm"
                        >
                          <div>
                            <div className="font-medium">{item.filename}</div>
                            <div className="text-xs text-muted-foreground">
                              {item.count} findings •{' '}
                              {new Date(item.date).toLocaleString()}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => downloadFromHistory(item)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="w-full text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear History
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!canExport || isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export {currentCount.toLocaleString()} Findings
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
