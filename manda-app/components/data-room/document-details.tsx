/**
 * Document Details Panel Component
 * Displays full document metadata in a slide-out sheet
 * Story: E2.5 - Create Document Metadata Management (AC: #2, #3, #4, #5, #6, #7)
 * Story: E3.6 - Processing Status Tracking and WebSocket Updates (AC: #5)
 * Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #4, #5)
 *
 * Features:
 * - All document metadata display
 * - Inline rename with validation
 * - Category dropdown selection
 * - Folder move dialog
 * - Processing status with progress indicator
 * - Structured error display for failed documents (E3.8)
 * - Retry history display (E3.8)
 * - Stage-aware retry button for failed processing
 * - Findings count display
 * - Action buttons (Download, Delete)
 */

'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  FileText,
  FileSpreadsheet,
  FileImage,
  File,
  Presentation,
  Download,
  Trash2,
  FolderInput,
  Edit,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
  Check,
  Folder,
  RefreshCw,
  FileSearch,
  History,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Document, ProcessingError, RetryHistoryEntry } from '@/lib/api/documents'
import {
  formatFileSize,
  DOCUMENT_CATEGORIES,
  updateDocument,
  downloadDocument,
} from '@/lib/api/documents'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import type { DocumentCategory } from '@/lib/gcs/client'
import { ProcessingStatusBadge, isProcessingFailed, getStatusDescription } from './processing-status-badge'
import { ProcessingProgress } from './processing-progress'

export interface DocumentDetailsProps {
  document: Document | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDocumentUpdate?: (document: Document) => void
  onDocumentDelete?: (document: Document) => void
  onMoveToFolder?: (document: Document) => void
  onRetryProcessing?: (document: Document) => void
  folders?: Array<{ path: string; name: string }>
}

/**
 * Get the file icon component based on MIME type
 */
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File

  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) {return FileSpreadsheet}
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) {return Presentation}
  if (mimeType.includes('image')) return FileImage
  if (mimeType.includes('text')) return FileText

  return File
}

/**
 * Validate document name
 */
function validateName(name: string): string | null {
  if (!name.trim()) {
    return 'Name is required'
  }
  if (name.length > 255) {
    return 'Name must be less than 255 characters'
  }
  // Check for invalid characters (basic filesystem-safe check)
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/
  if (invalidChars.test(name)) {
    return 'Name contains invalid characters'
  }
  return null
}

/**
 * Upload status display component
 */
function UploadStatusBadge({ status }: { status: Document['uploadStatus'] }) {
  const statusConfig = {
    uploading: {
      icon: Loader2,
      label: 'Uploading',
      className: 'text-blue-500 animate-spin',
      badgeVariant: 'secondary' as const,
    },
    completed: {
      icon: CheckCircle2,
      label: 'Uploaded',
      className: 'text-green-500',
      badgeVariant: 'secondary' as const,
    },
    failed: {
      icon: AlertCircle,
      label: 'Upload Failed',
      className: 'text-destructive',
      badgeVariant: 'destructive' as const,
    },
    pending: {
      icon: Clock,
      label: 'Pending',
      className: 'text-muted-foreground',
      badgeVariant: 'outline' as const,
    },
  }

  const config = statusConfig[status]
  const Icon = config.icon

  return (
    <Badge variant={config.badgeVariant} className="flex items-center gap-1">
      <Icon className={cn('h-3 w-3', config.className)} />
      {config.label}
    </Badge>
  )
}

/**
 * Document Details Panel
 */
export function DocumentDetails({
  document,
  open,
  onOpenChange,
  onDocumentUpdate,
  onDocumentDelete,
  onMoveToFolder,
  onRetryProcessing,
}: DocumentDetailsProps) {
  // Rename state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Category state
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isSavingCategory, setIsSavingCategory] = useState(false)

  // E3.6: Retry processing state
  const [isRetrying, setIsRetrying] = useState(false)

  // E3.8: Retry history display state
  const [showRetryHistory, setShowRetryHistory] = useState(false)

  // Reset state when document changes
  useEffect(() => {
    if (document) {
      setEditName(document.name)
      setSelectedCategory(document.category || '')
      setIsEditing(false)
      setNameError(null)
    }
  }, [document])

  // Handle rename
  const handleStartEditing = useCallback(() => {
    if (document) {
      setEditName(document.name)
      setIsEditing(true)
      setNameError(null)
    }
  }, [document])

  const handleCancelEditing = useCallback(() => {
    setIsEditing(false)
    setEditName(document?.name || '')
    setNameError(null)
  }, [document])

  const handleSaveRename = useCallback(async () => {
    if (!document) return

    const error = validateName(editName)
    if (error) {
      setNameError(error)
      return
    }

    if (editName === document.name) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    try {
      const result = await updateDocument(document.id, { name: editName.trim() })
      if (result.success) {
        toast.success('Document renamed')
        setIsEditing(false)
        onDocumentUpdate?.({
          ...document,
          name: editName.trim(),
          updatedAt: new Date().toISOString(),
        })
      } else {
        toast.error(result.error || 'Failed to rename document')
      }
    } catch (err) {
      toast.error('Failed to rename document')
    } finally {
      setIsSaving(false)
    }
  }, [document, editName, onDocumentUpdate])

  // Handle category change
  const handleCategoryChange = useCallback(
    async (value: string) => {
      if (!document) return

      const newCategory = value === 'none' ? null : (value as DocumentCategory)
      if (newCategory === document.category) return

      setIsSavingCategory(true)
      const previousCategory = selectedCategory
      setSelectedCategory(value)

      try {
        const result = await updateDocument(document.id, {
          category: newCategory as DocumentCategory,
        })
        if (result.success) {
          toast.success('Category updated')
          onDocumentUpdate?.({
            ...document,
            category: newCategory,
            updatedAt: new Date().toISOString(),
          })
        } else {
          setSelectedCategory(previousCategory)
          toast.error(result.error || 'Failed to update category')
        }
      } catch (err) {
        setSelectedCategory(previousCategory)
        toast.error('Failed to update category')
      } finally {
        setIsSavingCategory(false)
      }
    },
    [document, selectedCategory, onDocumentUpdate]
  )

  // Handle download
  const handleDownload = useCallback(async () => {
    if (!document) return
    const result = await downloadDocument(document.id)
    if (!result.success) {
      toast.error(result.error || 'Download failed')
    }
  }, [document])

  // Handle delete
  const handleDelete = useCallback(() => {
    if (document) {
      onDocumentDelete?.(document)
    }
  }, [document, onDocumentDelete])

  // Handle move
  const handleMove = useCallback(() => {
    if (document) {
      onMoveToFolder?.(document)
    }
  }, [document, onMoveToFolder])

  // E3.6: Handle retry processing
  const handleRetryProcessing = useCallback(async () => {
    if (!document || !onRetryProcessing) return

    setIsRetrying(true)
    try {
      // Call the retry API
      const response = await fetch(`/api/documents/${document.id}/retry`, {
        method: 'POST',
      })

      const data = await response.json()

      if (response.ok && data.success) {
        toast.success('Processing restarted')
        // Update the document status locally to pending
        onDocumentUpdate?.({
          ...document,
          processingStatus: 'pending',
          processingError: null,
        })
      } else {
        toast.error(data.error || 'Failed to retry processing')
      }
    } catch (error) {
      toast.error('Failed to retry processing')
    } finally {
      setIsRetrying(false)
    }
  }, [document, onRetryProcessing, onDocumentUpdate])

  if (!document) return null

  const Icon = getFileIcon(document.mimeType)
  const relativeDate = formatDistanceToNow(new Date(document.createdAt), {
    addSuffix: true,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2">
              <Icon className="h-6 w-6 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => {
                      setEditName(e.target.value)
                      setNameError(null)
                    }}
                    className={cn(nameError && 'border-destructive')}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSaveRename()
                      } else if (e.key === 'Escape') {
                        handleCancelEditing()
                      }
                    }}
                  />
                  {nameError && (
                    <p className="text-xs text-destructive">{nameError}</p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={handleSaveRename}
                      disabled={isSaving}
                    >
                      {isSaving ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="mr-1 h-3 w-3" />
                      )}
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelEditing}
                      disabled={isSaving}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <SheetTitle className="truncate text-left">
                    {document.name}
                  </SheetTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleStartEditing}
                  >
                    <Edit className="h-3 w-3" />
                    <span className="sr-only">Rename</span>
                  </Button>
                </div>
              )}
              <SheetDescription className="text-left">
                Document details and metadata
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Metadata section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">File Information</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Size</span>
                <span>{formatFileSize(document.size)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="truncate ml-4 text-right">
                  {document.mimeType || 'Unknown'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Uploaded</span>
                <span title={new Date(document.createdAt).toLocaleString()}>
                  {relativeDate}
                </span>
              </div>
              {document.updatedAt && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last modified</span>
                  <span
                    title={new Date(document.updatedAt).toLocaleString()}
                  >
                    {formatDistanceToNow(new Date(document.updatedAt), {
                      addSuffix: true,
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Status</h3>
            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Upload status</span>
                <UploadStatusBadge status={document.uploadStatus} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Processing status</span>
                <ProcessingStatusBadge status={document.processingStatus} size="md" />
              </div>
            </div>

            {/* E3.6: Processing progress indicator */}
            <div className="pt-2">
              <ProcessingProgress status={document.processingStatus} />
              <p className="mt-2 text-xs text-muted-foreground">
                {getStatusDescription(document.processingStatus)}
              </p>
            </div>

            {/* E3.8: Enhanced error message for failed processing */}
            {isProcessingFailed(document.processingStatus) && document.processingError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    {typeof document.processingError === 'object' ? (
                      // E3.8: Structured error display
                      <>
                        <p className="font-medium">
                          {(document.processingError as ProcessingError).user_message || 'Processing Error'}
                        </p>
                        {(document.processingError as ProcessingError).guidance && (
                          <p className="mt-1 text-xs opacity-80">
                            {(document.processingError as ProcessingError).guidance}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-900 px-1.5 py-0.5">
                            Stage: {(document.processingError as ProcessingError).stage || 'unknown'}
                          </span>
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded px-1.5 py-0.5",
                            (document.processingError as ProcessingError).category === 'transient'
                              ? "bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300"
                              : "bg-red-100 dark:bg-red-900"
                          )}>
                            {(document.processingError as ProcessingError).category === 'transient' ? 'Temporary' : 'Permanent'}
                          </span>
                          {(document.processingError as ProcessingError).retry_count > 0 && (
                            <span className="inline-flex items-center gap-1 rounded bg-red-100 dark:bg-red-900 px-1.5 py-0.5">
                              Attempts: {(document.processingError as ProcessingError).retry_count}
                            </span>
                          )}
                        </div>
                      </>
                    ) : (
                      // Legacy string error display
                      <>
                        <p className="font-medium">Processing Error</p>
                        <p className="mt-1 text-xs break-words">{document.processingError as string}</p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* E3.8: Retry history display */}
            {document.retryHistory && document.retryHistory.length > 0 && (
              <Collapsible open={showRetryHistory} onOpenChange={setShowRetryHistory}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Retry History ({document.retryHistory.length})
                    </span>
                    {showRetryHistory ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <div className="space-y-2 rounded-md border p-2">
                    {document.retryHistory.map((entry: RetryHistoryEntry, index: number) => (
                      <div
                        key={`${entry.timestamp}-${index}`}
                        className="flex flex-col gap-1 border-b last:border-0 pb-2 last:pb-0 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Attempt {entry.attempt}</span>
                          <span className="text-muted-foreground">
                            {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {entry.stage}
                          </Badge>
                          <span className="truncate">{entry.error_type}</span>
                        </div>
                        <p className="text-muted-foreground truncate">{entry.message}</p>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* E3.8: Enhanced retry button with stage-aware messaging */}
            {isProcessingFailed(document.processingStatus) && (
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryProcessing}
                  disabled={isRetrying}
                  className="w-full"
                >
                  {isRetrying ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {document.lastCompletedStage
                    ? `Resume from ${document.lastCompletedStage}`
                    : 'Retry Processing'}
                </Button>
                {document.lastCompletedStage && (
                  <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <Info className="h-3 w-3" />
                    Will skip completed stages
                  </p>
                )}
              </div>
            )}

            {/* E3.6: Findings count for completed analysis */}
            {document.processingStatus === 'complete' && document.findingsCount !== null && (
              <div className="flex items-center justify-between rounded-md bg-green-50 p-3 text-sm text-green-700">
                <div className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4" />
                  <span>Analysis Complete</span>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  {document.findingsCount} {document.findingsCount === 1 ? 'finding' : 'findings'}
                </Badge>
              </div>
            )}
          </div>

          {/* Organization section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Organization</h3>
            <div className="space-y-3">
              {/* Category */}
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="category" className="text-muted-foreground">
                  Category
                </Label>
                <Select
                  value={selectedCategory || 'none'}
                  onValueChange={handleCategoryChange}
                  disabled={isSavingCategory}
                >
                  <SelectTrigger id="category" className="w-[180px]">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Folder path */}
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Folder</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-normal">
                    <Folder className="mr-1 h-3 w-3" />
                    {document.folderPath || 'Root'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={handleMove}
                  >
                    <FolderInput className="h-3 w-3" />
                    <span className="sr-only">Move to folder</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Download URL info */}
          {document.downloadUrl && document.downloadUrlExpiresIn && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium">Download</h3>
              <p className="text-xs text-muted-foreground">
                Download link expires in {Math.ceil(document.downloadUrlExpiresIn / 60)} minutes
              </p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button onClick={handleDownload} className="flex-1">
              <Download className="mr-2 h-4 w-4" />
              Download
            </Button>
            <Button
              variant="outline"
              onClick={handleMove}
            >
              <FolderInput className="mr-2 h-4 w-4" />
              Move
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
