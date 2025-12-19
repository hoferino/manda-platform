/**
 * Usage tracking types for E12 observability.
 * Story: E12.1 - Usage Tracking Database Schema
 */

import { z } from 'zod'

// ============================================================
// LLM Usage Types
// ============================================================

export const LLM_PROVIDERS = ['google-gla', 'anthropic', 'voyage', 'openai'] as const
export type LLMProvider = typeof LLM_PROVIDERS[number]

export const LLM_FEATURES = [
  'chat',
  'document_analysis',
  'extraction',
  'embeddings',
  'reranking',
  'contradiction_detection',
  'qa_ingestion',
] as const
export type LLMFeature = typeof LLM_FEATURES[number]

export const CreateLlmUsageSchema = z.object({
  dealId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  provider: z.enum(LLM_PROVIDERS),
  model: z.string().min(1),
  feature: z.enum(LLM_FEATURES),
  inputTokens: z.number().int().min(0),
  outputTokens: z.number().int().min(0),
  costUsd: z.number().min(0),
  latencyMs: z.number().int().min(0).optional(),
})

export type CreateLlmUsageInput = z.infer<typeof CreateLlmUsageSchema>

// ============================================================
// Feature Usage Types
// ============================================================

export const FEATURE_NAMES = [
  'upload_document',
  'chat',
  'search',
  'qa_response',
  'cim_generation',
  'irl_generation',
  'document_processing',
  'knowledge_retrieval',
] as const
export type FeatureName = typeof FEATURE_NAMES[number]

export const FEATURE_STATUSES = ['success', 'error', 'timeout'] as const
export type FeatureStatus = typeof FEATURE_STATUSES[number]

export const CreateFeatureUsageSchema = z.object({
  dealId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  featureName: z.enum(FEATURE_NAMES),
  status: z.enum(FEATURE_STATUSES),
  durationMs: z.number().int().min(0).optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export type CreateFeatureUsageInput = z.infer<typeof CreateFeatureUsageSchema>

// ============================================================
// Query Types (for E12.3 dashboard)
// ============================================================

export interface DailyCost {
  date: string
  costUsd: number
  tokens: number
}

export interface FeatureCost {
  feature: string
  costUsd: number
  callCount: number
}

export interface ProviderCost {
  provider: string
  costUsd: number
  callCount: number
}

export interface DealCostSummary {
  dealId: string
  dealName: string
  totalCostUsd: number
  conversationCount: number
  documentCount: number
}
