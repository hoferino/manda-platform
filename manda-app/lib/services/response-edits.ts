/**
 * Response Edits Service
 *
 * Service for managing response edits and detecting patterns.
 * Story: E7.3 - Enable Response Editing and Learning
 *
 * Features:
 * - Save response edits with audit trail
 * - Detect patterns using text diff analysis
 * - Upsert patterns with occurrence counting
 * - Get patterns for few-shot prompt enhancement
 */

import { createClient } from '@/lib/supabase/server'
import { getFeatureFlag } from '@/lib/config/feature-flags'
import {
  type ResponseEdit,
  type EditPattern,
  type DetectedPattern,
  type ResponseEditResult,
  type EditType,
  type PatternType,
  type FewShotExample,
  mapDbToResponseEdit,
  mapDbToEditPattern,
} from '@/lib/types/feedback'
import * as Diff from 'diff'

/**
 * Minimum pattern length to consider for learning
 */
const MIN_PATTERN_LENGTH = 3

/**
 * Minimum occurrences for pattern to be included in few-shot
 */
const MIN_PATTERN_OCCURRENCES = 3

/**
 * Maximum number of patterns to include in few-shot prompts
 */
const MAX_FEW_SHOT_PATTERNS = 5

/**
 * Save a response edit and detect patterns
 */
export async function saveResponseEdit(
  messageId: string,
  originalText: string,
  editedText: string,
  editType: EditType,
  analystId: string
): Promise<ResponseEditResult> {
  const supabase = await createClient()

  // Insert the response edit (append-only)
  const { data: editRow, error: editError } = await supabase
    .from('response_edits')
    .insert({
      message_id: messageId,
      original_text: originalText,
      edited_text: editedText,
      edit_type: editType,
      analyst_id: analystId,
    })
    .select()
    .single()

  if (editError) {
    console.error('[response-edits] Error saving edit:', editError)
    throw new Error(`Failed to save response edit: ${editError.message}`)
  }

  const edit = mapDbToResponseEdit(editRow)

  // Check if pattern detection is enabled
  const patternDetectionEnabled = await getFeatureFlag('patternDetectionEnabled')
  if (!patternDetectionEnabled) {
    return {
      success: true,
      edit,
      detectedPatterns: [],
      patternsUpdated: 0,
    }
  }

  // Detect patterns from the diff
  const detectedPatterns = detectPatterns(originalText, editedText)

  // Upsert patterns to database
  let patternsUpdated = 0
  for (const pattern of detectedPatterns) {
    try {
      await upsertPattern(analystId, pattern)
      patternsUpdated++
    } catch (err) {
      console.error('[response-edits] Error upserting pattern:', err)
      // Continue with other patterns even if one fails
    }
  }

  return {
    success: true,
    edit,
    detectedPatterns,
    patternsUpdated,
  }
}

/**
 * Detect patterns from text diff
 * Uses word-level diff to identify replacements
 */
export function detectPatterns(original: string, edited: string): DetectedPattern[] {
  const patterns: DetectedPattern[] = []

  // Use word diff to detect changes
  const diff = Diff.diffWords(original, edited)

  // Look for paired removals and additions (replacements)
  for (let i = 0; i < diff.length - 1; i++) {
    const current = diff[i]
    const next = diff[i + 1]

    // Check for removal followed by addition (word replacement)
    if (current && next && current.removed && next.added) {
      const originalPattern = current.value.trim()
      const replacementPattern = next.value.trim()

      // Only consider patterns of sufficient length
      if (originalPattern.length >= MIN_PATTERN_LENGTH && replacementPattern.length >= MIN_PATTERN_LENGTH) {
        patterns.push({
          patternType: classifyPatternType(originalPattern, replacementPattern),
          originalPattern,
          replacementPattern,
        })
      }
    }

    // Check for removal without replacement (phrase removal)
    if (current && current.removed && (!next || !next.added)) {
      const originalPattern = current.value.trim()
      if (originalPattern.length >= MIN_PATTERN_LENGTH) {
        patterns.push({
          patternType: 'phrase_removal',
          originalPattern,
          replacementPattern: '',
        })
      }
    }
  }

  // Also detect structural changes (paragraph reordering, etc.)
  const structuralPattern = detectStructuralChanges(original, edited)
  if (structuralPattern) {
    patterns.push(structuralPattern)
  }

  return patterns
}

/**
 * Classify the type of pattern based on content
 */
function classifyPatternType(original: string, replacement: string): PatternType {
  // Check for tone adjustments (e.g., "very important" → "important")
  const toneWords = ['very', 'extremely', 'really', 'quite', 'somewhat', 'perhaps', 'maybe', 'definitely']
  const hasRemovedToneWord = toneWords.some(word =>
    original.toLowerCase().includes(word) && !replacement.toLowerCase().includes(word)
  )
  const hasAddedToneWord = toneWords.some(word =>
    replacement.toLowerCase().includes(word) && !original.toLowerCase().includes(word)
  )

  if (hasRemovedToneWord || hasAddedToneWord) {
    return 'tone_adjustment'
  }

  // Default to word replacement
  return 'word_replacement'
}

/**
 * Detect structural changes (paragraph reordering, list restructuring)
 */
function detectStructuralChanges(original: string, edited: string): DetectedPattern | null {
  // Split by lines/paragraphs
  const originalLines = original.split(/\n+/).filter(l => l.trim())
  const editedLines = edited.split(/\n+/).filter(l => l.trim())

  // If line count changed significantly, might be structural
  if (Math.abs(originalLines.length - editedLines.length) >= 2) {
    return {
      patternType: 'structure_change',
      originalPattern: `${originalLines.length} paragraphs/items`,
      replacementPattern: `${editedLines.length} paragraphs/items`,
    }
  }

  // Check for reordering - same content, different order
  const normalizedOriginal = originalLines.map(l => l.trim().toLowerCase()).sort()
  const normalizedEdited = editedLines.map(l => l.trim().toLowerCase()).sort()

  if (
    normalizedOriginal.length === normalizedEdited.length &&
    normalizedOriginal.every((line, i) => line === normalizedEdited[i]) &&
    originalLines.some((line, i) => line !== editedLines[i])
  ) {
    return {
      patternType: 'structure_change',
      originalPattern: 'content_order',
      replacementPattern: 'reordered',
    }
  }

  return null
}

/**
 * Upsert a pattern - increment count if exists, create if new
 */
async function upsertPattern(analystId: string, pattern: DetectedPattern): Promise<void> {
  const supabase = await createClient()

  // Try to find existing pattern
  const { data: existingPattern, error: findError } = await supabase
    .from('edit_patterns')
    .select()
    .eq('analyst_id', analystId)
    .eq('pattern_type', pattern.patternType)
    .eq('original_pattern', pattern.originalPattern)
    .single()

  if (findError && findError.code !== 'PGRST116') {
    // PGRST116 is "no rows found" - expected for new patterns
    console.error('[response-edits] Error finding pattern:', findError)
    throw findError
  }

  if (existingPattern) {
    // Update existing pattern
    const { error: updateError } = await supabase
      .from('edit_patterns')
      .update({
        replacement_pattern: pattern.replacementPattern,
        occurrence_count: (existingPattern.occurrence_count ?? 0) + 1,
        last_seen: new Date().toISOString(),
      })
      .eq('id', existingPattern.id)

    if (updateError) {
      console.error('[response-edits] Error updating pattern:', updateError)
      throw updateError
    }
  } else {
    // Insert new pattern
    const { error: insertError } = await supabase
      .from('edit_patterns')
      .insert({
        analyst_id: analystId,
        pattern_type: pattern.patternType,
        original_pattern: pattern.originalPattern,
        replacement_pattern: pattern.replacementPattern,
        occurrence_count: 1,
        is_active: true,
      })

    if (insertError) {
      console.error('[response-edits] Error inserting pattern:', insertError)
      throw insertError
    }
  }
}

/**
 * Get patterns for an analyst
 */
export async function getPatterns(analystId: string): Promise<EditPattern[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('edit_patterns')
    .select()
    .eq('analyst_id', analystId)
    .order('occurrence_count', { ascending: false })

  if (error) {
    console.error('[response-edits] Error fetching patterns:', error)
    throw new Error(`Failed to fetch patterns: ${error.message}`)
  }

  return (data || []).map(mapDbToEditPattern)
}

/**
 * Get active patterns with minimum occurrence count for few-shot
 */
export async function getActivePatterns(
  analystId: string,
  minOccurrences: number = MIN_PATTERN_OCCURRENCES
): Promise<EditPattern[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('edit_patterns')
    .select()
    .eq('analyst_id', analystId)
    .eq('is_active', true)
    .gte('occurrence_count', minOccurrences)
    .order('occurrence_count', { ascending: false })
    .limit(MAX_FEW_SHOT_PATTERNS)

  if (error) {
    console.error('[response-edits] Error fetching active patterns:', error)
    throw new Error(`Failed to fetch active patterns: ${error.message}`)
  }

  return (data || []).map(mapDbToEditPattern)
}

/**
 * Toggle pattern active state
 */
export async function togglePatternActive(patternId: string, isActive: boolean): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('edit_patterns')
    .update({ is_active: isActive })
    .eq('id', patternId)

  if (error) {
    console.error('[response-edits] Error toggling pattern:', error)
    throw new Error(`Failed to toggle pattern: ${error.message}`)
  }
}

/**
 * Delete a pattern
 */
export async function deletePattern(patternId: string): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase
    .from('edit_patterns')
    .delete()
    .eq('id', patternId)

  if (error) {
    console.error('[response-edits] Error deleting pattern:', error)
    throw new Error(`Failed to delete pattern: ${error.message}`)
  }
}

/**
 * Get edit history for a message
 */
export async function getEditHistory(messageId: string): Promise<ResponseEdit[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('response_edits')
    .select()
    .eq('message_id', messageId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[response-edits] Error fetching edit history:', error)
    throw new Error(`Failed to fetch edit history: ${error.message}`)
  }

  return (data || []).map(mapDbToResponseEdit)
}

/**
 * Convert active patterns to few-shot examples for prompt enhancement
 */
export async function getPatternsAsFewShot(analystId: string): Promise<FewShotExample[]> {
  const patterns = await getActivePatterns(analystId)

  return patterns.map(pattern => ({
    original: pattern.originalPattern,
    preferred: pattern.replacementPattern,
    patternType: pattern.patternType,
  }))
}

/**
 * Format patterns as prompt instructions
 * Used for injecting into system prompt
 */
export function formatPatternsAsPromptInstructions(patterns: FewShotExample[]): string {
  if (patterns.length === 0) {
    return ''
  }

  const lines = ['When generating responses, apply these learned preferences:']

  for (const pattern of patterns) {
    switch (pattern.patternType) {
      case 'word_replacement':
        lines.push(`- Use "${pattern.preferred}" instead of "${pattern.original}"`)
        break
      case 'phrase_removal':
        lines.push(`- Avoid phrases like: "${pattern.original}"`)
        break
      case 'tone_adjustment':
        lines.push(`- Adjust tone: "${pattern.original}" → "${pattern.preferred}"`)
        break
      case 'structure_change':
        lines.push(`- Structure preference: ${pattern.preferred}`)
        break
    }
  }

  return lines.join('\n')
}