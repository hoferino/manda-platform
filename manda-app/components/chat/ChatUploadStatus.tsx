'use client'

/**
 * ChatUploadStatus Component
 *
 * Displays upload and processing status as system messages in the chat.
 * Story: E5.9 - Implement Document Upload via Chat Interface
 * AC: #4 (Status Updates via Chat Messages)
 * AC: #5 (Post-Processing Notification)
 * AC: #6 (Error Handling)
 *
 * Features:
 * - Upload progress bar during upload
 * - Processing stage indicators: "Parsing...", "Generating embeddings...", "Analyzing..."
 * - Completion message with finding count
 * - Error message with retry action and suggestions
 */

import { memo } from 'react'
import {
  FileUp,
  FileCheck,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ChatUploadItem, ChatUploadStage } from '@/lib/hooks/useChatUpload'

interface ChatUploadStatusProps {
  /** Upload item to display */
  upload: ChatUploadItem
  /** Callback to retry upload (file must be provided externally) */
  onRetry?: () => void
  /** Callback to dismiss the status message */
  onDismiss?: () => void
  /** Additional CSS classes */
  className?: string
}

/** Get stage display info */
function getStageInfo(stage: ChatUploadStage): {
  label: string
  icon: React.ReactNode
  isAnimated: boolean
} {
  switch (stage) {
    case 'uploading':
      return {
        label: 'Uploading',
        icon: <FileUp className="h-4 w-4" />,
        isAnimated: false,
      }
    case 'uploaded':
      return {
        label: 'Queued for processing',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        isAnimated: true,
      }
    case 'parsing':
      return {
        label: 'Parsing document',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        isAnimated: true,
      }
    case 'embedding':
      return {
        label: 'Generating embeddings',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        isAnimated: true,
      }
    case 'analyzing':
      return {
        label: 'Analyzing content',
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        isAnimated: true,
      }
    case 'complete':
      return {
        label: 'Analysis complete',
        icon: <CheckCircle2 className="h-4 w-4 text-green-500" />,
        isAnimated: false,
      }
    case 'failed':
      return {
        label: 'Failed',
        icon: <AlertCircle className="h-4 w-4 text-destructive" />,
        isAnimated: false,
      }
  }
}

/** Get user-friendly error message with suggestion */
function getErrorSuggestion(error: string): string | null {
  const lowerError = error.toLowerCase()

  if (lowerError.includes('size') || lowerError.includes('500mb')) {
    return 'Try uploading a smaller file or splitting the document.'
  }
  if (lowerError.includes('type') || lowerError.includes('format')) {
    return 'Supported formats: PDF, Excel, Word, PowerPoint, Text, CSV, Images.'
  }
  if (lowerError.includes('network') || lowerError.includes('timeout')) {
    return 'Check your internet connection and try again.'
  }
  if (lowerError.includes('parsing') || lowerError.includes('parse')) {
    return 'The document may be corrupted or in an unsupported format.'
  }
  return null
}

/** Format file size for display */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const ChatUploadStatus = memo(function ChatUploadStatus({
  upload,
  onRetry,
  onDismiss,
  className,
}: ChatUploadStatusProps) {
  const stageInfo = getStageInfo(upload.stage)
  const errorSuggestion = upload.error ? getErrorSuggestion(upload.error) : null

  const isComplete = upload.stage === 'complete'
  const isFailed = upload.stage === 'failed'
  const isUploading = upload.stage === 'uploading'
  const isProcessing =
    upload.stage === 'uploaded' ||
    upload.stage === 'parsing' ||
    upload.stage === 'embedding' ||
    upload.stage === 'analyzing'

  return (
    <div
      className={cn(
        'group flex gap-3 py-3 px-4 rounded-lg border',
        isComplete && 'bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800',
        isFailed && 'bg-destructive/5 border-destructive/30',
        !isComplete && !isFailed && 'bg-muted/50 border-border',
        className
      )}
      role="status"
      aria-live="polite"
      data-testid="chat-upload-status"
    >
      {/* File icon */}
      <div className="flex-shrink-0 mt-0.5">
        {isComplete ? (
          <FileCheck className="h-5 w-5 text-green-500" />
        ) : isFailed ? (
          <AlertCircle className="h-5 w-5 text-destructive" />
        ) : (
          <FileUp className="h-5 w-5 text-muted-foreground" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* File name */}
        <div className="flex items-center gap-2">
          <span className="font-medium truncate text-sm">{upload.fileName}</span>
          <span className="text-xs text-muted-foreground flex-shrink-0">
            ({formatFileSize(upload.fileSize)})
          </span>
        </div>

        {/* Status message */}
        <div className="mt-1 flex items-center gap-2 text-sm">
          {stageInfo.icon}
          <span
            className={cn(
              isFailed && 'text-destructive',
              isComplete && 'text-green-600 dark:text-green-400'
            )}
          >
            {stageInfo.label}
            {upload.stage === 'uploading' && ` (${upload.uploadProgress}%)`}
            {isComplete &&
              upload.findingsCount !== undefined &&
              ` - ${upload.findingsCount} findings extracted`}
          </span>
        </div>

        {/* Upload progress bar */}
        {isUploading && (
          <div className="mt-2">
            <Progress
              value={upload.uploadProgress}
              className="h-1.5"
              aria-label={`Upload progress: ${upload.uploadProgress}%`}
            />
          </div>
        )}

        {/* Processing stages indicator */}
        {isProcessing && (
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <span
              className={cn(
                'px-1.5 py-0.5 rounded',
                upload.stage === 'uploaded' ||
                  upload.stage === 'parsing' ||
                  upload.stage === 'embedding' ||
                  upload.stage === 'analyzing'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted'
              )}
            >
              Parse
            </span>
            <span className="text-border">→</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded',
                upload.stage === 'embedding' || upload.stage === 'analyzing'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted'
              )}
            >
              Embed
            </span>
            <span className="text-border">→</span>
            <span
              className={cn(
                'px-1.5 py-0.5 rounded',
                upload.stage === 'analyzing'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted'
              )}
            >
              Analyze
            </span>
          </div>
        )}

        {/* Error message with suggestion */}
        {isFailed && upload.error && (
          <div className="mt-2 text-sm text-destructive">
            <p>{upload.error}</p>
            {errorSuggestion && (
              <p className="mt-1 text-xs text-muted-foreground">{errorSuggestion}</p>
            )}
          </div>
        )}

        {/* Actions for failed uploads */}
        {isFailed && (
          <div className="mt-2 flex gap-2">
            {onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={onRetry}
                className="h-7 text-xs"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDismiss}
                className="h-7 text-xs"
              >
                Dismiss
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Dismiss button (for completed/failed) */}
      {(isComplete || isFailed) && onDismiss && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDismiss}
          className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
})

/**
 * ChatUploadStatusList Component
 *
 * Renders a list of upload status items for the chat interface.
 */
interface ChatUploadStatusListProps {
  /** List of uploads to display */
  uploads: ChatUploadItem[]
  /** Callback to retry an upload */
  onRetry?: (uploadId: string) => void
  /** Callback to dismiss an upload */
  onDismiss?: (uploadId: string) => void
  /** Additional CSS classes */
  className?: string
}

export function ChatUploadStatusList({
  uploads,
  onRetry,
  onDismiss,
  className,
}: ChatUploadStatusListProps) {
  if (uploads.length === 0) return null

  return (
    <div className={cn('space-y-2', className)} data-testid="chat-upload-status-list">
      {uploads.map((upload) => (
        <ChatUploadStatus
          key={upload.id}
          upload={upload}
          onRetry={onRetry ? () => onRetry(upload.id) : undefined}
          onDismiss={onDismiss ? () => onDismiss(upload.id) : undefined}
        />
      ))}
    </div>
  )
}
