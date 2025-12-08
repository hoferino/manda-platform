/**
 * AuditTrailExport Component
 * Story: E7.5 - Maintain Comprehensive Audit Trail (AC: #6)
 *
 * Modal dialog for exporting audit trail data with:
 * - Date range picker (default: last 30 days)
 * - Entry type selection (corrections, validations, edits)
 * - Format toggle (CSV/JSON)
 * - Export button with loading state
 * - Success toast with file name
 */

'use client'

import { useState, useEffect, useCallback } from 'react'
import { format as formatDate, subDays } from 'date-fns'
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
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import {
  Download,
  CalendarIcon,
  FileSpreadsheet,
  FileJson,
  Loader2,
} from 'lucide-react'
import type { AuditEntryType, AuditExportFormat } from '@/lib/types/feedback'

export interface AuditTrailExportProps {
  projectId: string
  isOpen: boolean
  onClose: () => void
}

interface AuditStats {
  totalCorrections: number
  totalValidations: number
  totalEdits: number
  uniqueAnalysts: number
  dateRange: {
    earliest: string | null
    latest: string | null
  }
}

interface DateRange {
  from: Date | null
  to: Date | null
}

export function AuditTrailExport({
  projectId,
  isOpen,
  onClose,
}: AuditTrailExportProps) {
  // Form state
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  })
  const [exportFormat, setExportFormat] = useState<AuditExportFormat>('csv')
  const [selectedTypes, setSelectedTypes] = useState<AuditEntryType[]>([
    'correction',
    'validation',
    'edit',
  ])
  const [analystId, setAnalystId] = useState<string>('')
  const [findingId, setFindingId] = useState<string>('')
  const [includeMetadata, setIncludeMetadata] = useState(true)

  // Loading state
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingStats, setIsLoadingStats] = useState(false)
  const [stats, setStats] = useState<AuditStats | null>(null)

  // Fetch stats when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchStats()
    }
  }, [isOpen, projectId])

  const fetchStats = useCallback(async () => {
    setIsLoadingStats(true)
    try {
      const response = await fetch(
        `/api/projects/${projectId}/audit?stats=true`
      )
      if (response.ok) {
        const data: AuditStats = await response.json()
        setStats(data)

        // Update date range if we have data
        if (data.dateRange.earliest && data.dateRange.latest) {
          setDateRange({
            from: new Date(data.dateRange.earliest),
            to: new Date(data.dateRange.latest),
          })
        }
      }
    } catch (err) {
      console.error('Error fetching audit stats:', err)
    } finally {
      setIsLoadingStats(false)
    }
  }, [projectId])

  // Handle date input change
  const handleDateChange = (field: 'from' | 'to', value: string) => {
    const date = value ? new Date(value) : null
    setDateRange((prev) => ({
      ...prev,
      [field]: date,
    }))
  }

  // Toggle entry type selection
  const toggleType = (type: AuditEntryType) => {
    setSelectedTypes((prev) =>
      prev.includes(type)
        ? prev.filter((t) => t !== type)
        : [...prev, type]
    )
  }

  // Handle export
  const handleExport = async () => {
    if (selectedTypes.length === 0) {
      toast.error('Please select at least one entry type')
      return
    }

    setIsLoading(true)

    try {
      // Build query params
      const params = new URLSearchParams()
      params.set('format', exportFormat)
      params.set('includeMetadata', String(includeMetadata))

      if (dateRange.from) {
        params.set('startDate', dateRange.from.toISOString())
      }
      if (dateRange.to) {
        params.set('endDate', dateRange.to.toISOString())
      }
      if (analystId) {
        params.set('analystId', analystId)
      }
      if (findingId) {
        params.set('findingId', findingId)
      }

      // Add types
      selectedTypes.forEach((type) => params.append('types', type))

      // Fetch export
      const response = await fetch(
        `/api/projects/${projectId}/audit/export?${params.toString()}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Export failed')
      }

      // Get filename from header or generate one
      const contentDisposition = response.headers.get('Content-Disposition')
      const dateStr = formatDate(new Date(), 'yyyy-MM-dd')
      let filename = `audit-trail-${dateStr}.${exportFormat}`

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/)
        if (match && match[1]) {
          filename = match[1]
        }
      }

      // Download file
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      // Get record count from header
      const recordCount = response.headers.get('X-Export-Count')

      toast.success(
        `Exported ${recordCount || 'audit'} records to ${filename}`
      )
      onClose()
    } catch (err) {
      console.error('Export error:', err)
      toast.error(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate estimated record count
  const estimatedCount = stats
    ? (selectedTypes.includes('correction') ? stats.totalCorrections : 0) +
      (selectedTypes.includes('validation') ? stats.totalValidations : 0) +
      (selectedTypes.includes('edit') ? stats.totalEdits : 0)
    : 0

  // Format date for input value
  const formatDateForInput = (date: Date | null): string => {
    if (!date) return ''
    return formatDate(date, 'yyyy-MM-dd')
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Audit Trail
          </DialogTitle>
          <DialogDescription>
            Export corrections, validations, and edits to CSV or JSON format
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Date Range */}
          <div className="space-y-2">
            <Label>Date Range</Label>
            <div className="flex gap-3 items-center">
              <div className="flex-1">
                <Label htmlFor="fromDate" className="sr-only">
                  From Date
                </Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fromDate"
                    type="date"
                    className="pl-9"
                    value={formatDateForInput(dateRange.from)}
                    onChange={(e) => handleDateChange('from', e.target.value)}
                  />
                </div>
              </div>
              <span className="text-muted-foreground">to</span>
              <div className="flex-1">
                <Label htmlFor="toDate" className="sr-only">
                  To Date
                </Label>
                <div className="relative">
                  <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="toDate"
                    type="date"
                    className="pl-9"
                    value={formatDateForInput(dateRange.to)}
                    onChange={(e) => handleDateChange('to', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Entry Types */}
          <div className="space-y-2">
            <Label>Entry Types</Label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedTypes.includes('correction')}
                  onCheckedChange={() => toggleType('correction')}
                />
                <span className="text-sm">
                  Corrections
                  {stats && (
                    <span className="text-muted-foreground ml-1">
                      ({stats.totalCorrections})
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedTypes.includes('validation')}
                  onCheckedChange={() => toggleType('validation')}
                />
                <span className="text-sm">
                  Validations
                  {stats && (
                    <span className="text-muted-foreground ml-1">
                      ({stats.totalValidations})
                    </span>
                  )}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={selectedTypes.includes('edit')}
                  onCheckedChange={() => toggleType('edit')}
                />
                <span className="text-sm">
                  Edits
                  {stats && (
                    <span className="text-muted-foreground ml-1">
                      ({stats.totalEdits})
                    </span>
                  )}
                </span>
              </label>
            </div>
          </div>

          {/* Format Selection */}
          <div className="space-y-2">
            <Label>Export Format</Label>
            <div className="flex gap-4">
              <Button
                type="button"
                variant={exportFormat === 'csv' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setExportFormat('csv')}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                type="button"
                variant={exportFormat === 'json' ? 'default' : 'outline'}
                className="flex-1"
                onClick={() => setExportFormat('json')}
              >
                <FileJson className="h-4 w-4 mr-2" />
                JSON
              </Button>
            </div>
          </div>

          {/* Optional Filters */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="findingId">
                Finding ID (optional)
              </Label>
              <Input
                id="findingId"
                placeholder="Filter by specific finding UUID"
                value={findingId}
                onChange={(e) => setFindingId(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="analystId">
                Analyst ID (optional)
              </Label>
              <Input
                id="analystId"
                placeholder="Filter by analyst UUID"
                value={analystId}
                onChange={(e) => setAnalystId(e.target.value)}
              />
            </div>
          </div>

          {/* Include Metadata */}
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={includeMetadata}
              onCheckedChange={(checked) =>
                setIncludeMetadata(checked === true)
              }
            />
            <span className="text-sm">
              Include export metadata (date, filters)
            </span>
          </label>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {isLoadingStats ? (
              <Loader2 className="h-4 w-4 animate-spin inline mr-1" />
            ) : (
              `~${estimatedCount.toLocaleString()} records`
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleExport}
              disabled={isLoading || selectedTypes.length === 0}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
