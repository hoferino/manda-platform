'use client'

/**
 * LLMPromptExportModal - Modal for LLM Prompt Export
 *
 * Provides preview and export functionality for CIM LLM prompts:
 * - Preview textarea showing generated prompt (readonly, scrollable)
 * - Character/word count display
 * - "Copy to Clipboard" button with success toast
 * - "Download as .txt" button
 * - Close button
 *
 * Story: E9.15 - LLM Prompt Export
 * AC: #1 (Export Option Available), #2 (Comprehensive Content), #3 (Structured Format),
 *     #4 (Copy to Clipboard), #5 (Download as Text File)
 */

import * as React from 'react'
import { memo, useState, useCallback, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Copy, Download, CheckCircle, Loader2, FileText } from 'lucide-react'
import type { CIM } from '@/lib/types/cim'
import {
  exportCIMAsLLMPrompt,
  copyToClipboard,
  triggerTextDownload,
} from '@/lib/services/cim-export'

// ============================================================================
// Types
// ============================================================================

export interface LLMPromptExportModalProps {
  cim: CIM
  isOpen: boolean
  onClose: () => void
  onCopySuccess?: () => void
  onDownloadSuccess?: () => void
}

type CopyStatus = 'idle' | 'copying' | 'success' | 'error'
type DownloadStatus = 'idle' | 'downloading' | 'success' | 'error'

// ============================================================================
// Component
// ============================================================================

/**
 * LLMPromptExportModal - Modal for previewing and exporting LLM prompts
 *
 * Features:
 * - Generates structured XML prompt from CIM data (AC #2, #3)
 * - Displays preview with character and word counts
 * - Copy to clipboard with success notification (AC #4)
 * - Download as .txt file (AC #5)
 */
export const LLMPromptExportModal = memo(function LLMPromptExportModal({
  cim,
  isOpen,
  onClose,
  onCopySuccess,
  onDownloadSuccess,
}: LLMPromptExportModalProps) {
  const [copyStatus, setCopyStatus] = useState<CopyStatus>('idle')
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus>('idle')

  // Generate LLM prompt export result
  const exportResult = useMemo(() => {
    if (!isOpen) return null
    return exportCIMAsLLMPrompt(cim)
  }, [cim, isOpen])

  // Calculate word count
  const wordCount = useMemo(() => {
    if (!exportResult) return 0
    return exportResult.prompt
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length
  }, [exportResult])

  // Handle copy to clipboard (AC #4)
  const handleCopy = useCallback(async () => {
    if (!exportResult) return

    setCopyStatus('copying')
    try {
      await copyToClipboard(exportResult.prompt)
      setCopyStatus('success')
      toast.success('Copied to clipboard', {
        description: 'The LLM prompt has been copied to your clipboard.',
      })
      onCopySuccess?.()

      // Reset status after brief success indication
      setTimeout(() => setCopyStatus('idle'), 2000)
    } catch (err) {
      setCopyStatus('error')
      toast.error('Copy failed', {
        description:
          err instanceof Error
            ? err.message
            : 'Could not copy to clipboard. Please try selecting the text manually.',
      })

      // Reset error status
      setTimeout(() => setCopyStatus('idle'), 3000)
    }
  }, [exportResult, onCopySuccess])

  // Handle download as text file (AC #5)
  const handleDownload = useCallback(() => {
    if (!exportResult) return

    setDownloadStatus('downloading')
    try {
      triggerTextDownload(exportResult.prompt, exportResult.filename)
      setDownloadStatus('success')
      toast.success('Download started', {
        description: `File: ${exportResult.filename}`,
      })
      onDownloadSuccess?.()

      // Reset status after brief success indication
      setTimeout(() => setDownloadStatus('idle'), 2000)
    } catch (err) {
      setDownloadStatus('error')
      toast.error('Download failed', {
        description:
          err instanceof Error ? err.message : 'Could not download file. Please try again.',
      })

      // Reset error status
      setTimeout(() => setDownloadStatus('idle'), 3000)
    }
  }, [exportResult, onDownloadSuccess])

  // Render copy button icon based on status
  const renderCopyIcon = () => {
    switch (copyStatus) {
      case 'copying':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Copy className="h-4 w-4" />
    }
  }

  // Render download button icon based on status
  const renderDownloadIcon = () => {
    switch (downloadStatus) {
      case 'downloading':
        return <Loader2 className="h-4 w-4 animate-spin" />
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      default:
        return <Download className="h-4 w-4" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Export LLM Prompt
          </DialogTitle>
          <DialogDescription>
            Export your CIM as a structured prompt for use with external AI tools like ChatGPT,
            Claude, or custom pipelines.
          </DialogDescription>
        </DialogHeader>

        {/* Preview section */}
        <div className="flex-1 min-h-0 flex flex-col gap-2">
          {/* Stats bar */}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>
                <strong>{exportResult?.characterCount.toLocaleString() || 0}</strong> characters
              </span>
              <span>
                <strong>{wordCount.toLocaleString()}</strong> words
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span>
                <strong>{exportResult?.sectionCount || 0}</strong> sections
              </span>
              <span>
                <strong>{exportResult?.slideCount || 0}</strong> slides
              </span>
            </div>
          </div>

          {/* Preview textarea */}
          <Textarea
            value={exportResult?.prompt || ''}
            readOnly
            className="flex-1 min-h-[300px] max-h-[400px] font-mono text-xs resize-none"
            placeholder="Generating prompt..."
            data-testid="llm-prompt-preview"
          />

          {/* Format note */}
          <p className="text-xs text-muted-foreground">
            Format: XML-structured content with sections for metadata, buyer persona, investment
            thesis, outline, and slides with visual specifications.
          </p>
        </div>

        <DialogFooter className="flex-shrink-0 gap-2 sm:gap-2">
          <Button variant="outline" onClick={onClose} data-testid="llm-prompt-close-button">
            Close
          </Button>
          <Button
            variant="outline"
            onClick={handleCopy}
            disabled={!exportResult || copyStatus === 'copying'}
            data-testid="llm-prompt-copy-button"
          >
            {renderCopyIcon()}
            <span className="ml-2">
              {copyStatus === 'copying'
                ? 'Copying...'
                : copyStatus === 'success'
                  ? 'Copied!'
                  : 'Copy to Clipboard'}
            </span>
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!exportResult || downloadStatus === 'downloading'}
            data-testid="llm-prompt-download-button"
          >
            {renderDownloadIcon()}
            <span className="ml-2">
              {downloadStatus === 'downloading'
                ? 'Downloading...'
                : downloadStatus === 'success'
                  ? 'Downloaded!'
                  : 'Download .txt'}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export default LLMPromptExportModal
