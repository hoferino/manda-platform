/**
 * Feedback Analysis Service
 *
 * Analyzes feedback data (corrections, validations, rejections) to generate
 * insights for prompt optimization and confidence threshold adjustments.
 *
 * Story: E7.4 - Build Feedback Incorporation System
 *
 * Features:
 * - Aggregate feedback data per finding
 * - Detect patterns in corrections/rejections
 * - Generate per-domain statistics
 * - Calculate confidence threshold recommendations
 * - Generate prompt improvement suggestions
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/lib/supabase/database.types'
import {
  FeedbackAnalysisSummary,
  FeedbackPattern,
  DomainFeedbackStats,
  AnalysisRecommendation,
  ConfidenceThresholdAdjustment,
  FindingFeedbackAggregate,
  FeedbackAnalysisJobRequest,
  FeedbackAnalysisJobResult,
  PromptImprovementSuggestion,
} from '@/lib/types/feedback'

// Default confidence thresholds per domain - typed as const for TypeScript
const DEFAULT_DOMAIN_THRESHOLD_VALUES = {
  financial: 0.70,
  legal: 0.70,
  operational: 0.60,
  market: 0.55,
  technical: 0.60,
  general: 0.50,
} as const

const DEFAULT_DOMAIN_THRESHOLDS: Record<string, number> = DEFAULT_DOMAIN_THRESHOLD_VALUES

/**
 * Get the default threshold for a domain
 */
function getDefaultDomainThreshold(domain: string): number {
  const d = domain.toLowerCase()
  if (d === 'financial') return DEFAULT_DOMAIN_THRESHOLD_VALUES.financial
  if (d === 'legal') return DEFAULT_DOMAIN_THRESHOLD_VALUES.legal
  if (d === 'operational') return DEFAULT_DOMAIN_THRESHOLD_VALUES.operational
  if (d === 'market') return DEFAULT_DOMAIN_THRESHOLD_VALUES.market
  if (d === 'technical') return DEFAULT_DOMAIN_THRESHOLD_VALUES.technical
  return DEFAULT_DOMAIN_THRESHOLD_VALUES.general
}

// Minimum sample size for statistical significance
const MIN_SAMPLE_SIZE = 10

// Rejection rate threshold for flagging domains
const REJECTION_RATE_THRESHOLD = 0.30

// Correction rate threshold for pattern detection
const CORRECTION_RATE_THRESHOLD = 0.20

/**
 * Get domain threshold, using deal-specific if exists, otherwise default
 */
export async function getDomainThreshold(
  supabase: SupabaseClient<Database>,
  dealId: string,
  domain: string
): Promise<number> {
  const normalizedDomain = domain.toLowerCase()

  // Try to get deal-specific threshold
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          eq: (col: string, val: string) => {
            single: () => Promise<{ data: { threshold: number } | null; error: unknown }>
          }
        }
      }
    }
  })
    .from('confidence_thresholds')
    .select('threshold')
    .eq('deal_id', dealId)
    .eq('domain', normalizedDomain)
    .single()

  if (!error && data) {
    return data.threshold
  }

  // Return default threshold for domain
  return getDefaultDomainThreshold(normalizedDomain)
}

/**
 * Analyze feedback for a deal and generate summary
 */
export async function analyzeFeedback(
  supabase: SupabaseClient<Database>,
  request: FeedbackAnalysisJobRequest
): Promise<FeedbackAnalysisJobResult> {
  const startTime = Date.now()
  const jobId = crypto.randomUUID()

  try {
    const periodDays = request.periodDays ?? 7
    const periodEnd = new Date()
    const periodStart = new Date(periodEnd.getTime() - periodDays * 24 * 60 * 60 * 1000)

    // 1. Get all findings for the deal
    const { data: findings, error: findingsError } = await supabase
      .from('findings')
      .select('id, text, domain, document_id, confidence, needs_review, last_corrected_at')
      .eq('deal_id', request.dealId)

    if (findingsError) {
      throw new Error(`Failed to fetch findings: ${findingsError.message}`)
    }

    if (!findings || findings.length === 0) {
      return {
        success: true,
        jobId,
        summary: createEmptySummary(request.dealId, periodStart, periodEnd),
        processingTimeMs: Date.now() - startTime,
      }
    }

    const findingIds = findings.map(f => f.id)

    // 2. Get corrections in period
    const { data: corrections } = await supabase
      .from('finding_corrections')
      .select('id, finding_id, correction_type, created_at')
      .in('finding_id', findingIds)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString())

    // 3. Get validation feedback in period
    const { data: validations } = await (supabase as unknown as {
      from: (table: string) => {
        select: (cols: string) => {
          in: (col: string, vals: string[]) => {
            gte: (col: string, val: string) => {
              lte: (col: string, val: string) => Promise<{
                data: { id: string; finding_id: string; action: string }[] | null
              }>
            }
          }
        }
      }
    })
      .from('validation_feedback')
      .select('id, finding_id, action')
      .in('finding_id', findingIds)
      .gte('created_at', periodStart.toISOString())
      .lte('created_at', periodEnd.toISOString())

    // 4. Calculate domain statistics
    const domainStats = calculateDomainStats(findings, corrections || [], validations || [])

    // 5. Detect patterns (if enabled)
    let patterns: FeedbackPattern[] = []
    if (request.includePatternDetection !== false) {
      patterns = detectPatterns(findings, corrections || [], validations || [], domainStats)
    }

    // 6. Generate recommendations
    const recommendations = generateRecommendations(domainStats, patterns)

    // 7. Calculate confidence adjustments (if enabled)
    let confidenceAdjustments: ConfidenceThresholdAdjustment[] = []
    if (request.includeConfidenceAdjustments !== false) {
      confidenceAdjustments = await calculateConfidenceAdjustments(
        supabase,
        request.dealId,
        domainStats
      )
    }

    const summary: FeedbackAnalysisSummary = {
      dealId: request.dealId,
      analysisDate: new Date().toISOString(),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      totalFindings: findings.length,
      totalCorrections: corrections?.length ?? 0,
      totalValidations: validations?.filter(v => v.action === 'validate').length ?? 0,
      totalRejections: validations?.filter(v => v.action === 'reject').length ?? 0,
      patterns,
      domainStats,
      recommendations,
      confidenceAdjustments,
    }

    // 8. Store the analysis result
    await storeAnalysisResult(supabase, summary, request)

    return {
      success: true,
      jobId,
      summary,
      processingTimeMs: Date.now() - startTime,
    }
  } catch (error) {
    console.error('[feedback-analysis] Error:', error)
    return {
      success: false,
      jobId,
      error: error instanceof Error ? error.message : 'Unknown error',
      processingTimeMs: Date.now() - startTime,
    }
  }
}

/**
 * Calculate per-domain statistics
 */
function calculateDomainStats(
  findings: { id: string; domain: string | null; confidence: number | null }[],
  corrections: { finding_id: string }[],
  validations: { finding_id: string; action: string }[]
): DomainFeedbackStats[] {
  const domainMap = new Map<string, {
    findingIds: Set<string>
    confidences: number[]
    correctionCount: number
    validationCount: number
    rejectionCount: number
  }>()

  // Group findings by domain
  for (const finding of findings) {
    const domain = finding.domain?.toLowerCase() || 'general'
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        findingIds: new Set(),
        confidences: [],
        correctionCount: 0,
        validationCount: 0,
        rejectionCount: 0,
      })
    }
    const stats = domainMap.get(domain)!
    stats.findingIds.add(finding.id)
    if (finding.confidence !== null) {
      stats.confidences.push(finding.confidence)
    }
  }

  // Count corrections per domain
  for (const correction of corrections) {
    for (const [, stats] of domainMap) {
      if (stats.findingIds.has(correction.finding_id)) {
        stats.correctionCount++
        break
      }
    }
  }

  // Count validations/rejections per domain
  for (const validation of validations) {
    for (const [, stats] of domainMap) {
      if (stats.findingIds.has(validation.finding_id)) {
        if (validation.action === 'validate') {
          stats.validationCount++
        } else if (validation.action === 'reject') {
          stats.rejectionCount++
        }
        break
      }
    }
  }

  // Convert to array
  return Array.from(domainMap.entries()).map(([domain, stats]) => {
    const totalFeedback = stats.validationCount + stats.rejectionCount
    return {
      domain,
      findingCount: stats.findingIds.size,
      correctionCount: stats.correctionCount,
      validationCount: stats.validationCount,
      rejectionCount: stats.rejectionCount,
      averageConfidence: stats.confidences.length > 0
        ? stats.confidences.reduce((a, b) => a + b, 0) / stats.confidences.length
        : 0.5,
      rejectionRate: totalFeedback > 0 ? stats.rejectionCount / totalFeedback : 0,
    }
  })
}

/**
 * Detect patterns in feedback data
 */
function detectPatterns(
  findings: { id: string; domain: string | null }[],
  corrections: { finding_id: string; correction_type: string }[],
  validations: { finding_id: string; action: string }[],
  domainStats: DomainFeedbackStats[]
): FeedbackPattern[] {
  const patterns: FeedbackPattern[] = []

  // Pattern 1: Domain bias (high rejection rate in specific domain)
  for (const stats of domainStats) {
    if (stats.findingCount >= MIN_SAMPLE_SIZE && stats.rejectionRate > REJECTION_RATE_THRESHOLD) {
      patterns.push({
        patternType: 'domain_bias',
        description: `High rejection rate in ${stats.domain} domain (${(stats.rejectionRate * 100).toFixed(0)}%)`,
        affectedCount: stats.rejectionCount,
        severity: stats.rejectionRate > 0.5 ? 'high' : stats.rejectionRate > 0.3 ? 'medium' : 'low',
        recommendation: `Review extraction prompts for ${stats.domain} domain. Consider adjusting confidence thresholds.`,
        examples: [],
      })
    }
  }

  // Pattern 2: Confidence drift (many corrections but low rejection)
  for (const stats of domainStats) {
    if (stats.findingCount >= MIN_SAMPLE_SIZE) {
      const correctionRate = stats.correctionCount / stats.findingCount
      if (correctionRate > CORRECTION_RATE_THRESHOLD && stats.rejectionRate < 0.1) {
        patterns.push({
          patternType: 'confidence_drift',
          description: `High correction rate in ${stats.domain} (${(correctionRate * 100).toFixed(0)}%) but low rejection`,
          affectedCount: stats.correctionCount,
          severity: correctionRate > 0.4 ? 'high' : 'medium',
          recommendation: `Findings are being refined rather than rejected. Consider improving initial extraction precision.`,
          examples: [],
        })
      }
    }
  }

  // Pattern 3: Source quality (group corrections by correction_type)
  const correctionsByType = new Map<string, number>()
  for (const correction of corrections) {
    const count = correctionsByType.get(correction.correction_type) || 0
    correctionsByType.set(correction.correction_type, count + 1)
  }

  for (const [type, count] of correctionsByType) {
    if (count >= 5 && type === 'source') {
      patterns.push({
        patternType: 'source_quality',
        description: `Multiple source corrections detected (${count} occurrences)`,
        affectedCount: count,
        severity: count > 20 ? 'high' : count > 10 ? 'medium' : 'low',
        recommendation: `Review source document quality. Some documents may have extraction issues.`,
        examples: [],
      })
    }
  }

  // Pattern 4: Extraction errors (value corrections)
  const valueCorrectionCount = correctionsByType.get('value') || 0
  if (valueCorrectionCount >= 10) {
    patterns.push({
      patternType: 'extraction_error',
      description: `Systematic value extraction errors (${valueCorrectionCount} corrections)`,
      affectedCount: valueCorrectionCount,
      severity: valueCorrectionCount > 30 ? 'high' : valueCorrectionCount > 15 ? 'medium' : 'low',
      recommendation: `Review LLM extraction prompts. Values are being misextracted systematically.`,
      examples: [],
    })
  }

  return patterns
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  domainStats: DomainFeedbackStats[],
  patterns: FeedbackPattern[]
): AnalysisRecommendation[] {
  const recommendations: AnalysisRecommendation[] = []

  // Recommend threshold adjustments for high-rejection domains
  for (const stats of domainStats) {
    if (stats.rejectionRate > REJECTION_RATE_THRESHOLD && stats.findingCount >= MIN_SAMPLE_SIZE) {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'threshold_adjustment',
        priority: stats.rejectionRate > 0.5 ? 'high' : 'medium',
        title: `Adjust ${stats.domain} confidence threshold`,
        description: `${stats.domain} has ${(stats.rejectionRate * 100).toFixed(0)}% rejection rate. Consider raising the confidence threshold.`,
        actionable: true,
        autoApplicable: true,
      })
    }
  }

  // Recommend prompt improvements for extraction errors
  for (const pattern of patterns) {
    if (pattern.patternType === 'extraction_error' && pattern.severity !== 'low') {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'prompt_improvement',
        priority: pattern.severity,
        title: 'Review extraction prompts',
        description: pattern.recommendation,
        actionable: true,
        autoApplicable: false,
      })
    }

    if (pattern.patternType === 'source_quality') {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'source_review',
        priority: pattern.severity,
        title: 'Review source documents',
        description: pattern.recommendation,
        actionable: true,
        autoApplicable: false,
      })
    }

    if (pattern.patternType === 'domain_bias') {
      recommendations.push({
        id: crypto.randomUUID(),
        type: 'domain_focus',
        priority: pattern.severity,
        title: `Focus on ${pattern.description.split(' ')[4]} domain`,
        description: pattern.recommendation,
        actionable: true,
        autoApplicable: false,
      })
    }
  }

  return recommendations
}

/**
 * Calculate confidence threshold adjustments
 */
async function calculateConfidenceAdjustments(
  supabase: SupabaseClient<Database>,
  dealId: string,
  domainStats: DomainFeedbackStats[]
): Promise<ConfidenceThresholdAdjustment[]> {
  const adjustments: ConfidenceThresholdAdjustment[] = []

  for (const stats of domainStats) {
    if (stats.findingCount < MIN_SAMPLE_SIZE) {
      continue // Not enough data for reliable adjustment
    }

    const currentThreshold = await getDomainThreshold(supabase, dealId, stats.domain)

    // Calculate recommended threshold based on rejection rate
    // If rejection rate is high, raise threshold
    // If rejection rate is low and validations are high, could lower threshold
    let recommendedThreshold = currentThreshold

    if (stats.rejectionRate > 0.4) {
      // High rejection - raise threshold significantly
      recommendedThreshold = Math.min(0.95, currentThreshold + 0.15)
    } else if (stats.rejectionRate > 0.25) {
      // Moderate rejection - raise threshold moderately
      recommendedThreshold = Math.min(0.90, currentThreshold + 0.10)
    } else if (stats.rejectionRate < 0.05 && stats.validationCount > stats.findingCount * 0.5) {
      // Very low rejection, high validation - could lower threshold
      recommendedThreshold = Math.max(0.40, currentThreshold - 0.05)
    }

    // Only recommend if there's a meaningful change
    if (Math.abs(recommendedThreshold - currentThreshold) >= 0.05) {
      adjustments.push({
        domain: stats.domain,
        currentThreshold,
        recommendedThreshold: Math.round(recommendedThreshold * 100) / 100,
        reason: stats.rejectionRate > 0.25
          ? `High rejection rate (${(stats.rejectionRate * 100).toFixed(0)}%) suggests threshold should be raised`
          : `Low rejection rate with high validation suggests threshold could be lowered`,
        basedOnSampleSize: stats.findingCount,
        statisticalConfidence: calculateStatisticalConfidence(stats.findingCount, stats.rejectionRate),
      })
    }
  }

  return adjustments
}

/**
 * Calculate statistical confidence in a rate estimate
 * Uses simple confidence interval width approach
 */
function calculateStatisticalConfidence(sampleSize: number, rate: number): number {
  // Larger sample = higher confidence
  // More extreme rates (close to 0 or 1) with large samples = higher confidence
  const sampleConfidence = Math.min(1, sampleSize / 100) // Max out at 100 samples
  const rateExtremity = Math.abs(rate - 0.5) * 2 // How far from 50/50

  return Math.round((sampleConfidence * 0.7 + rateExtremity * sampleConfidence * 0.3) * 100) / 100
}

/**
 * Store analysis result in database
 */
async function storeAnalysisResult(
  supabase: SupabaseClient<Database>,
  summary: FeedbackAnalysisSummary,
  request: FeedbackAnalysisJobRequest
): Promise<void> {
  const { error } = await (supabase as unknown as {
    from: (table: string) => {
      upsert: (data: unknown, opts: { onConflict: string }) => Promise<{ error: unknown }>
    }
  })
    .from('feedback_analytics')
    .upsert({
      deal_id: summary.dealId,
      analysis_date: new Date().toISOString().split('T')[0],
      period_start: summary.periodStart,
      period_end: summary.periodEnd,
      analysis_type: request.analysisType,
      summary_json: summary,
      total_findings: summary.totalFindings,
      total_corrections: summary.totalCorrections,
      total_validations: summary.totalValidations,
      total_rejections: summary.totalRejections,
      pattern_count: summary.patterns.length,
      recommendation_count: summary.recommendations.length,
      trigger_type: 'manual',
    }, { onConflict: 'deal_id,analysis_date' })

  if (error) {
    console.error('[feedback-analysis] Failed to store result:', error)
  }
}

/**
 * Create empty summary for deals with no findings
 */
function createEmptySummary(
  dealId: string,
  periodStart: Date,
  periodEnd: Date
): FeedbackAnalysisSummary {
  return {
    dealId,
    analysisDate: new Date().toISOString(),
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    totalFindings: 0,
    totalCorrections: 0,
    totalValidations: 0,
    totalRejections: 0,
    patterns: [],
    domainStats: [],
    recommendations: [],
    confidenceAdjustments: [],
  }
}

/**
 * Get latest analysis for a deal
 */
export async function getLatestAnalysis(
  supabase: SupabaseClient<Database>,
  dealId: string
): Promise<FeedbackAnalysisSummary | null> {
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => {
              single: () => Promise<{ data: { summary_json: unknown } | null; error: unknown }>
            }
          }
        }
      }
    }
  })
    .from('feedback_analytics')
    .select('summary_json')
    .eq('deal_id', dealId)
    .order('analysis_date', { ascending: false })
    .limit(1)
    .single()

  if (error || !data) {
    return null
  }

  return data.summary_json as FeedbackAnalysisSummary
}

/**
 * Get analysis history for a deal
 */
export async function getAnalysisHistory(
  supabase: SupabaseClient<Database>,
  dealId: string,
  limit: number = 10
): Promise<FeedbackAnalysisSummary[]> {
  const { data, error } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: { ascending: boolean }) => {
            limit: (n: number) => Promise<{ data: { summary_json: unknown }[] | null; error: unknown }>
          }
        }
      }
    }
  })
    .from('feedback_analytics')
    .select('summary_json')
    .eq('deal_id', dealId)
    .order('analysis_date', { ascending: false })
    .limit(limit)

  if (error || !data) {
    return []
  }

  return data.map(row => row.summary_json as FeedbackAnalysisSummary)
}

/**
 * Generate prompt improvement suggestions from corrections
 */
export async function generatePromptImprovements(
  supabase: SupabaseClient<Database>,
  dealId: string,
  analysisId?: string
): Promise<PromptImprovementSuggestion[]> {
  // Get corrections grouped by correction_type and patterns
  const { data: corrections } = await supabase
    .from('finding_corrections')
    .select(`
      id,
      finding_id,
      correction_type,
      original_value,
      corrected_value,
      reason,
      findings!inner (
        domain,
        deal_id
      )
    `)
    .eq('findings.deal_id', dealId)
    .order('created_at', { ascending: false })
    .limit(100)

  if (!corrections || corrections.length === 0) {
    return []
  }

  // Group corrections by domain and type to identify patterns
  const groupedCorrections = new Map<string, typeof corrections>()

  for (const correction of corrections) {
    const finding = correction.findings as { domain: string } | null
    const key = `${finding?.domain || 'general'}-${correction.correction_type}`
    if (!groupedCorrections.has(key)) {
      groupedCorrections.set(key, [])
    }
    groupedCorrections.get(key)!.push(correction)
  }

  const suggestions: PromptImprovementSuggestion[] = []

  for (const [key, group] of groupedCorrections) {
    if (group.length < 3) continue // Need multiple corrections to suggest improvement

    const [domain, correctionType] = key.split('-')

    // Analyze correction patterns
    const correctionPattern = analyzeCorrections(group)

    if (correctionPattern) {
      suggestions.push({
        id: crypto.randomUUID(),
        domain: domain === 'general' ? undefined : domain,
        correctionPattern: correctionPattern.pattern,
        suggestedImprovement: correctionPattern.suggestion,
        basedOnCorrections: group.length,
        confidence: Math.min(0.95, group.length / 20), // More corrections = higher confidence
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Store suggestions in database
  for (const suggestion of suggestions) {
    await (supabase as unknown as {
      from: (table: string) => {
        insert: (data: unknown) => Promise<{ error: unknown }>
      }
    })
      .from('prompt_improvements')
      .insert({
        deal_id: dealId,
        domain: suggestion.domain,
        correction_pattern: suggestion.correctionPattern,
        suggested_improvement: suggestion.suggestedImprovement,
        based_on_corrections: suggestion.basedOnCorrections,
        confidence: suggestion.confidence,
        analysis_id: analysisId,
        status: 'pending',
      })
  }

  return suggestions
}

/**
 * Analyze a group of corrections to identify the pattern
 */
function analyzeCorrections(
  corrections: { original_value: string; corrected_value: string; correction_type: string }[]
): { pattern: string; suggestion: string } | null {
  if (corrections.length === 0) return null

  // Simple pattern detection - look for common prefixes/suffixes in corrections
  const correctionType = corrections[0]!.correction_type

  if (correctionType === 'value') {
    // Check for numeric formatting issues
    const numericCorrections = corrections.filter(c =>
      /[\d,.\s]+/.test(c.original_value) && /[\d,.\s]+/.test(c.corrected_value)
    )
    if (numericCorrections.length > corrections.length * 0.5) {
      return {
        pattern: 'Numeric value extraction errors',
        suggestion: 'Add explicit instructions to extract numeric values with consistent formatting. Specify currency symbols, thousands separators, and decimal precision.',
      }
    }

    // Check for date formatting issues
    const dateCorrections = corrections.filter(c =>
      /\d{1,4}[-/.]\d{1,2}[-/.]\d{1,4}/.test(c.original_value)
    )
    if (dateCorrections.length > corrections.length * 0.3) {
      return {
        pattern: 'Date extraction format inconsistency',
        suggestion: 'Standardize date extraction format (e.g., YYYY-MM-DD). Add explicit date format instructions to extraction prompt.',
      }
    }
  }

  if (correctionType === 'text') {
    // Check for truncation issues
    const lengthChanges = corrections.filter(c =>
      c.corrected_value.length > c.original_value.length * 1.5
    )
    if (lengthChanges.length > corrections.length * 0.4) {
      return {
        pattern: 'Text truncation during extraction',
        suggestion: 'Increase context window for text extraction. Ensure complete sentences/paragraphs are captured.',
      }
    }
  }

  if (correctionType === 'source') {
    return {
      pattern: 'Source attribution errors',
      suggestion: 'Improve source tracking in extraction prompt. Ensure page numbers and document references are accurately captured.',
    }
  }

  // Default pattern for sufficient corrections
  if (corrections.length >= 5) {
    return {
      pattern: `Multiple ${correctionType} corrections`,
      suggestion: `Review extraction logic for ${correctionType} fields. ${corrections.length} corrections suggest systematic issues.`,
    }
  }

  return null
}