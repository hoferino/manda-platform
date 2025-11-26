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
