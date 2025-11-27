/**
 * Custom Hooks
 * Reusable React hooks for the Manda Platform
 */

// E3.6 - Document Realtime Updates
export {
  useDocumentUpdates,
  didProcessingStatusChange,
  didProcessingComplete,
  didProcessingFail,
  type DocumentUpdate,
  type DocumentUpdateType,
  type ConnectionStatus,
  type UseDocumentUpdatesOptions,
} from './useDocumentUpdates'

// E3.7 - Processing Queue
export {
  useProcessingQueue,
  type UseProcessingQueueOptions,
  type UseProcessingQueueResult,
} from './useProcessingQueue'
