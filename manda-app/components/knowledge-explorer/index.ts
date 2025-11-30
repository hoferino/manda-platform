/**
 * Knowledge Explorer Components Index
 * Story: E4.1 - Build Knowledge Explorer UI Main Interface
 * Story: E4.13 - Build Real-Time Knowledge Graph Updates
 */

export { KnowledgeExplorerClient } from './KnowledgeExplorerClient'
export { FindingsBrowser, FindingsTable, FindingFilters } from './findings'
export { ConfidenceBadge, DomainTag, StatusBadge } from './shared'

// E4.13 - Realtime components
export {
  ConnectionStatusIndicator,
  ConnectionStatusDot,
  type ConnectionStatusIndicatorProps,
} from './ConnectionStatusIndicator'

export {
  AutoRefreshToggle,
  AutoRefreshToggleCompact,
  type AutoRefreshToggleProps,
} from './AutoRefreshToggle'

export {
  RealtimeToastHandler,
  useRealtimeToasts,
  type RealtimeToastHandlerProps,
} from './RealtimeToastHandler'
