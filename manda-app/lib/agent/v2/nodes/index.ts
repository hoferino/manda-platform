/**
 * Agent System v2.0 - Node Barrel Exports
 *
 * Story: 1-2 Create Base StateGraph Structure (AC: #2, #3)
 *
 * Barrel exports for all graph nodes.
 * Import from '@/lib/agent/v2' - never use deep path imports.
 *
 * @example
 * ```typescript
 * import { supervisorNode, cimPhaseRouterNode } from '@/lib/agent/v2'
 * ```
 */

// Core nodes
export { supervisorNode } from './supervisor'

// CIM workflow nodes
export { cimPhaseRouterNode } from './cim'

// Future node exports:
// Specialists (Story 4.x):
// export { financialAnalystNode } from './specialists/financial-analyst'
// export { documentResearcherNode } from './specialists/document-researcher'
// export { kgExpertNode } from './specialists/kg-expert'

// Retrieval (Story 3.x):
// export { retrievalNode } from './retrieval'

// Approval (Story 5.x):
// export { approvalNode } from './approval'
