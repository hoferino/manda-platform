/**
 * Prompt Enhancement Service
 *
 * Enhances system prompts with learned edit patterns for few-shot learning.
 * Story: E7.3 - Enable Response Editing and Learning
 * AC: #3, #4 (Pattern learning, Few-shot integration)
 *
 * Integration points:
 * - Called by agent executor before generating responses
 * - Uses active patterns with 3+ occurrences
 * - Formats patterns as natural language instructions
 */

import { getActivePatterns, formatPatternsAsPromptInstructions } from './response-edits'
import { getFeatureFlag } from '@/lib/config/feature-flags'
import type { FewShotExample, PatternType } from '@/lib/types/feedback'

/**
 * Result of prompt enhancement
 */
export interface PromptEnhancementResult {
  enhancedSystemPrompt: string
  patternsApplied: number
  patternTypes: PatternType[]
}

/**
 * Enhance a system prompt with learned patterns from an analyst
 *
 * @param baseSystemPrompt - Original system prompt
 * @param analystId - User ID to fetch patterns for
 * @returns Enhanced system prompt with pattern instructions
 */
export async function enhancePromptWithPatterns(
  baseSystemPrompt: string,
  analystId: string
): Promise<PromptEnhancementResult> {
  // Check if pattern detection is enabled
  const patternDetectionEnabled = await getFeatureFlag('patternDetectionEnabled')

  if (!patternDetectionEnabled) {
    return {
      enhancedSystemPrompt: baseSystemPrompt,
      patternsApplied: 0,
      patternTypes: [],
    }
  }

  try {
    // Fetch active patterns for this analyst
    const patterns = await getActivePatterns(analystId)

    if (patterns.length === 0) {
      return {
        enhancedSystemPrompt: baseSystemPrompt,
        patternsApplied: 0,
        patternTypes: [],
      }
    }

    // Convert patterns to few-shot examples
    const fewShotExamples: FewShotExample[] = patterns.map((p) => ({
      original: p.originalPattern,
      preferred: p.replacementPattern,
      patternType: p.patternType,
    }))

    // Format patterns as instructions
    const patternInstructions = formatPatternsAsPromptInstructions(fewShotExamples)

    // Combine with base prompt
    const enhancedPrompt = `${baseSystemPrompt}

## User Preferences (Learned from Edit History)
${patternInstructions}`

    // Extract unique pattern types
    const patternTypes = [...new Set(patterns.map((p) => p.patternType))]

    return {
      enhancedSystemPrompt: enhancedPrompt,
      patternsApplied: patterns.length,
      patternTypes,
    }
  } catch (error) {
    console.error('[prompt-enhancement] Error enhancing prompt:', error)
    // On error, return original prompt
    return {
      enhancedSystemPrompt: baseSystemPrompt,
      patternsApplied: 0,
      patternTypes: [],
    }
  }
}

/**
 * Build inline few-shot examples for system prompt
 * Alternative format that includes before/after examples
 */
export function buildFewShotExamplesBlock(examples: FewShotExample[]): string {
  if (examples.length === 0) {
    return ''
  }

  const lines = [
    '<user_preferences>',
    'The user prefers responses that follow these patterns:',
    '',
  ]

  for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]
    if (!ex) continue

    lines.push(`Example ${i + 1} (${ex.patternType}):`)

    if (ex.patternType === 'phrase_removal') {
      lines.push(`  - Avoid: "${ex.original}"`)
    } else {
      lines.push(`  - Instead of: "${ex.original}"`)
      lines.push(`  - Prefer: "${ex.preferred}"`)
    }
    lines.push('')
  }

  lines.push('</user_preferences>')

  return lines.join('\n')
}

/**
 * Get summary of enhancement for logging/debugging
 */
export function getEnhancementSummary(result: PromptEnhancementResult): string {
  if (result.patternsApplied === 0) {
    return 'No patterns applied'
  }

  const typeList = result.patternTypes.join(', ')
  return `Applied ${result.patternsApplied} patterns (types: ${typeList})`
}
