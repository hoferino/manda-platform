/**
 * Agent Utilities
 *
 * Barrel export for agent utility functions.
 * Story: E8.4 - Conversational Q&A Suggestion Flow
 */

// Q&A Category Inference
export {
  inferQACategoryFromQuery,
  getAllMatchingCategories,
  queryMatchesCategory,
  QA_CATEGORY_KEYWORDS,
} from './qa-category'

// Q&A Question Drafting
export {
  draftQAQuestion,
  enhanceQuestion,
  suggestTimePeriod,
  type DraftQuestionOptions,
  type DraftedQuestion,
} from './qa-question'
