/**
 * Data Room Components
 * Story: E2.2 - Build Data Room Folder Structure View
 * Story: E2.3 - Build Data Room Buckets View
 * Story: E2.4 - Implement View Toggle and User Preference
 */

// E2.2 - Folder Structure View Components
export { FolderTree, buildFolderTree, type FolderNode } from './folder-tree'
export { DocumentList } from './document-list'
export { Breadcrumb } from './breadcrumb'
export { CreateFolderDialog } from './create-folder-dialog'
export { DeleteFolderDialog } from './delete-folder-dialog'
export { RenameFolderDialog } from './rename-folder-dialog'

// E2.3 - Buckets View Components
export { BucketCard, type BucketItem, type BucketCardProps } from './bucket-card'
export { BucketItemList } from './bucket-item-list'
export { BucketsView } from './buckets-view'

// E2.4 - View Toggle Component
export {
  ViewToggle,
  useViewPreference,
  loadViewPreference,
  saveViewPreference,
  type DataRoomView,
} from './view-toggle'

// E2.5 - Document Metadata Management
export { DocumentCard, DocumentCardHeader, type DocumentCardProps } from './document-card'
export { DocumentDetails, type DocumentDetailsProps } from './document-details'
export { FolderSelectDialog, type FolderSelectDialogProps } from './folder-select-dialog'

// E2.6 - Document Actions (View, Download, Delete)
export { DocumentActions, type DocumentActionsProps } from './document-actions'
export { DeleteConfirmDialog, type DeleteConfirmDialogProps } from './delete-confirm-dialog'

// E2.7 - Upload Progress Indicators
export { UploadZone, type UploadZoneProps } from './upload-zone'
export { UploadProgress, UploadProgressBadge, type UploadProgressProps } from './upload-progress'
export { UploadPanel, UploadButton, type UploadPanelProps } from './upload-panel'

// E2.8 - IRL Integration with Document Tracking
export { IRLChecklistPanel, type IRLChecklistPanelProps } from './irl-checklist-panel'
export { IRLChecklistItem, type IRLChecklistItemProps } from './irl-checklist-item'
export { IRLEmptyState, type IRLEmptyStateProps } from './irl-empty-state'

// E3.6 - Processing Status Tracking and WebSocket Updates
export {
  ProcessingStatusBadge,
  isProcessingInProgress,
  isProcessingComplete,
  isProcessingFailed,
  getStatusDescription,
  type ProcessingStatusBadgeProps,
} from './processing-status-badge'
export {
  ProcessingProgress,
  getCurrentStageLabel,
  getProcessingProgressPercent,
  type ProcessingProgressProps,
} from './processing-progress'

// E3.7 - Processing Queue Visibility
export { ProcessingQueue, type ProcessingQueueProps } from './processing-queue'
export { QueueItem, type QueueItemProps } from './queue-item'
