/**
 * Shared Knowledge Explorer Components
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface (AC: #7)
 * Story: E4.4 - Build Card View Alternative for Findings
 * Story: E4.5 - Implement Source Attribution Links
 */

export { ConfidenceBadge } from './ConfidenceBadge'
export { DomainTag } from './DomainTag'
export { StatusBadge } from './StatusBadge'
export { ViewToggle, useViewPreference, type ViewMode } from './ViewToggle'
export { SourceAttributionLink, type SourceAttributionLinkProps } from './SourceAttributionLink'
export {
  DocumentPreviewModal,
  type DocumentPreviewModalProps,
  type ChunkData,
  type DocumentData,
  type ChunkContext,
  type ChunkResponse,
} from './DocumentPreviewModal'
export { ExcelPreview, type ExcelPreviewProps } from './ExcelPreview'
export { PdfPreview, type PdfPreviewProps } from './PdfPreview'
export { FallbackPreview, type FallbackPreviewProps } from './FallbackPreview'
