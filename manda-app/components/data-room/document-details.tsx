/**
 * Document Details Panel Component
 * Displays full document metadata in a slide-out sheet
 * Story: E2.5 - Create Document Metadata Management (AC: #2, #3, #4, #5, #6, #7)
 *
 * Features:
 * - All document metadata display
 * - Inline rename with validation
 * - Category dropdown selection
 * - Folder move dialog
 * - Processing status with spinner
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
import type { Document } from '@/lib/api/documents'
import {
  formatFileSize,
  DOCUMENT_CATEGORIES,
  updateDocument,
  downloadDocument,
} from '@/lib/api/documents'
import type { DocumentCategory } from '@/lib/gcs/client'

export interface DocumentDetailsProps {
  document: Document | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDocumentUpdate?: (document: Document) => void
  onDocumentDelete?: (document: Document) => void
  onMoveToFolder?: (document: Document) => void
  folders?: Array<{ path: string; name: string }>
}

/**
 * Get the file icon component based on MIME type
 */
function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File

  if (mimeType.includes('pdf')) return FileText
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel'))
    return FileSpreadsheet
  if (mimeType.includes('word') || mimeType.includes('document')) return FileText
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint'))
    return Presentation
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
 * Processing status display component
 */
function ProcessingStatusBadge({
  status,
}: {
  status: Document['processingStatus']
}) {
  const statusConfig = {
    processing: {
      icon: Loader2,
      label: 'Processing',
      className: 'text-blue-500 animate-spin',
      badgeVariant: 'secondary' as const,
    },
    completed: {
      icon: CheckCircle2,
      label: 'Completed',
      className: 'text-green-500',
      badgeVariant: 'secondary' as const,
    },
    failed: {
      icon: AlertCircle,
      label: 'Failed',
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
}: DocumentDetailsProps) {
  // Rename state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Category state
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [isSavingCategory, setIsSavingCategory] = useState(false)

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
                <ProcessingStatusBadge status={document.processingStatus} />
              </div>
            </div>
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
