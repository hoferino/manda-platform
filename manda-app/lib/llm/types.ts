/**
 * LLM Type Definitions and Zod Schemas
 *
 * Zod schemas for structured output validation (TypeScript equivalent of Pydantic v2).
 * Story: E5.1 - Integrate LLM via LangChain (Model-Agnostic)
 *
 * Features:
 * - Structured output schemas for LLM responses
 * - Type-safe response parsing
 * - Error handling for invalid outputs
 */

import { z } from 'zod'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { Runnable } from '@langchain/core/runnables'

/**
 * Common response wrapper schema for all structured outputs
 */
export const BaseResponseSchema = z.object({
  success: z.boolean(),
  timestamp: z.string().datetime().optional(),
})

/**
 * Error response schema
 */
export const ErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
})

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>

/**
 * Finding extraction schema
 * Used when LLM extracts findings from documents
 */
export const FindingSchema = z.object({
  text: z.string().min(10).describe('The finding text'),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  domain: z.string().describe('Domain category (e.g., financial, legal, operational)'),
  sourceLocation: z.string().optional().describe('Location in source document'),
  dateReferenced: z.string().datetime().optional().describe('Date the finding refers to'),
})

export type Finding = z.infer<typeof FindingSchema>

export const FindingsResponseSchema = z.object({
  findings: z.array(FindingSchema),
  totalCount: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1).optional(),
})

export type FindingsResponse = z.infer<typeof FindingsResponseSchema>

/**
 * Chat response schema with source citations
 */
export const SourceCitationSchema = z.object({
  documentId: z.string().uuid(),
  documentName: z.string(),
  location: z.string().describe('Page number, cell reference, or section'),
  textSnippet: z.string().max(500).optional(),
})

export type SourceCitation = z.infer<typeof SourceCitationSchema>

export const ChatResponseSchema = z.object({
  content: z.string().describe('The response content'),
  sources: z.array(SourceCitationSchema).default([]),
  suggestedFollowups: z.array(z.string()).max(5).optional(),
  confidence: z.number().min(0).max(1).optional(),
})

export type ChatResponse = z.infer<typeof ChatResponseSchema>

/**
 * Question-Answer pair schema
 */
export const QAPairSchema = z.object({
  question: z.string().min(10),
  answer: z.string().min(10),
  sources: z.array(SourceCitationSchema).default([]),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
})

export type QAPair = z.infer<typeof QAPairSchema>

export const QAListResponseSchema = z.object({
  questions: z.array(QAPairSchema),
  topic: z.string().optional(),
})

export type QAListResponse = z.infer<typeof QAListResponseSchema>

/**
 * Contradiction detection schema
 */
export const ContradictionSchema = z.object({
  findingA: z.object({
    id: z.string().uuid().optional(),
    text: z.string(),
    source: z.string(),
  }),
  findingB: z.object({
    id: z.string().uuid().optional(),
    text: z.string(),
    source: z.string(),
  }),
  explanation: z.string().describe('Explanation of the contradiction'),
  severity: z.enum(['high', 'medium', 'low']),
  confidence: z.number().min(0).max(1),
})

export type Contradiction = z.infer<typeof ContradictionSchema>

export const ContradictionsResponseSchema = z.object({
  contradictions: z.array(ContradictionSchema),
  totalChecked: z.number().int().nonnegative(),
})

export type ContradictionsResponse = z.infer<typeof ContradictionsResponseSchema>

/**
 * Gap analysis schema
 */
export const GapSchema = z.object({
  category: z.string(),
  description: z.string(),
  priority: z.enum(['high', 'medium', 'low']),
  suggestedAction: z.string().optional(),
})

export type Gap = z.infer<typeof GapSchema>

export const GapsResponseSchema = z.object({
  gaps: z.array(GapSchema),
  coverage: z.record(z.string(), z.number()).optional(),
})

export type GapsResponse = z.infer<typeof GapsResponseSchema>

/**
 * Wrapper function for creating structured output from LLM
 *
 * Uses LangChain's withStructuredOutput for provider-agnostic structured outputs.
 * Different providers may implement this differently:
 * - Anthropic: tool_use with constrained output
 * - OpenAI: function_calling or json_mode
 * - Google: Native JSON mode
 *
 * @example
 * ```typescript
 * const llm = createLLMClient()
 * const structuredLLM = withStructuredOutput(llm, FindingsResponseSchema)
 * const result = await structuredLLM.invoke('Extract findings from...')
 * // result is typed as FindingsResponse
 * ```
 */
export function withStructuredOutput<T extends z.ZodType>(
  llm: BaseChatModel,
  schema: T,
  options?: {
    name?: string
    description?: string
    strict?: boolean
  }
): Runnable<unknown, z.infer<T>> {
  // LangChain's withStructuredOutput method handles provider-specific implementation
  return llm.withStructuredOutput(schema, {
    name: options?.name || schema.description || 'structured_output',
    ...(options?.strict !== undefined && { strict: options.strict }),
  }) as unknown as Runnable<unknown, z.infer<T>>
}

/**
 * Validates a response against a Zod schema with detailed error messages
 *
 * @throws Error with detailed validation message if validation fails
 */
export function validateResponse<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> {
  const result = schema.safeParse(data)

  if (!result.success) {
    const errors = result.error.issues
      .map((e) => `${String(e.path.join('.'))}: ${e.message}`)
      .join('; ')
    throw new Error(`Response validation failed: ${errors}`)
  }

  return result.data
}

/**
 * Safe parsing that returns null instead of throwing
 */
export function safeParseResponse<T extends z.ZodType>(
  schema: T,
  data: unknown
): z.infer<T> | null {
  const result = schema.safeParse(data)
  return result.success ? result.data : null
}

/**
 * Creates a Zod schema description from the schema for prompt engineering
 * Useful for telling the LLM what structure to output
 */
export function describeSchema(schema: z.ZodType): string {
  // This is a simplified version - for complex schemas, consider using
  // zod-to-json-schema for full JSON Schema output
  if (schema instanceof z.ZodObject) {
    const shape = schema.shape
    const fields = Object.entries(shape)
      .map(([key, value]) => {
        const desc = (value as z.ZodType).description || ''
        return `- ${key}: ${desc}`
      })
      .join('\n')
    return `Object with fields:\n${fields}`
  }
  return schema.description || 'Unknown schema'
}

/**
 * Export all schemas for type-safe tool definitions
 */
export const Schemas = {
  Finding: FindingSchema,
  FindingsResponse: FindingsResponseSchema,
  ChatResponse: ChatResponseSchema,
  SourceCitation: SourceCitationSchema,
  QAPair: QAPairSchema,
  QAListResponse: QAListResponseSchema,
  Contradiction: ContradictionSchema,
  ContradictionsResponse: ContradictionsResponseSchema,
  Gap: GapSchema,
  GapsResponse: GapsResponseSchema,
  ErrorResponse: ErrorResponseSchema,
}
