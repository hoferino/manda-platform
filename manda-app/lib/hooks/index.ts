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

// E4.13 - Knowledge Explorer Realtime Updates
export {
  useFindingsRealtime,
  didFindingStatusChange,
  didFindingGetValidated,
  didFindingGetRejected,
  type FindingUpdate,
  type FindingUpdateType,
  type UseFindingsRealtimeOptions,
} from './useFindingsRealtime'

export {
  useContradictionsRealtime,
  didContradictionStatusChange,
  didContradictionGetResolved,
  isContradictionUnresolved,
  type ContradictionUpdate,
  type ContradictionUpdateType,
  type UseContradictionsRealtimeOptions,
} from './useContradictionsRealtime'

export {
  useKnowledgeExplorerRealtime,
  type RealtimeEvent,
  type AggregateConnectionStatus,
  type UseKnowledgeExplorerRealtimeOptions,
  type UseKnowledgeExplorerRealtimeResult,
} from './useKnowledgeExplorerRealtime'
