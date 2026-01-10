/**
 * Agent System v2.0 - Tools Barrel Export
 *
 * Story: 2-1 Implement Supervisor Node with Tool-Calling
 * Story: 4-2 Implement Specialist Tool Definitions
 *
 * Exports specialist tools for the v2 agent system.
 * These tools are bound to the supervisor LLM for routing decisions.
 */

// Specialist Tool Definitions
export {
  // Individual tools
  financialAnalystTool,
  documentResearcherTool,
  kgExpertTool,
  dueDiligenceTool,
  // Combined array
  specialistTools,
  // Constants
  SPECIALIST_TOOL_NAMES,
  // Input schemas (for testing/validation)
  FinancialAnalystInputSchema,
  DocumentResearcherInputSchema,
  KGExpertInputSchema,
  DueDiligenceInputSchema,
  // Types
  type SpecialistResult,
  type SpecialistToolName,
} from './specialist-definitions'
