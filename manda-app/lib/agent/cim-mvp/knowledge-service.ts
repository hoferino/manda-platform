/**
 * Knowledge Service Abstraction
 *
 * Routes knowledge queries to either the JSON file or Graphiti based on mode.
 * This allows CIM tools to work unchanged while the underlying data source switches.
 *
 * Story: CIM Knowledge Toggle - Story 1
 *
 * Modes:
 * - 'json': Use static JSON knowledge file (dev/testing)
 * - 'graphiti': Use Neo4j/Graphiti live deal data (production)
 */

import {
  loadKnowledge,
  searchKnowledge,
  getFindingsForSection,
  getCompanyMetadata,
  getDataSummary,
} from './knowledge-loader'
import type { KnowledgeFile, Finding } from './types'

// =============================================================================
// Types
// =============================================================================

/**
 * Knowledge source mode
 */
export type KnowledgeMode = 'json' | 'graphiti'

/**
 * Configuration for creating a knowledge service
 */
export interface KnowledgeServiceConfig {
  mode: KnowledgeMode
  // JSON mode
  knowledgePath?: string
  // Graphiti mode
  dealId?: string
  groupId?: string
  // Dynamic query context (E14-S5)
  buyerPersona?: string
  userFocus?: string
}

/**
 * Options for knowledge search
 */
export interface KnowledgeSearchOptions {
  section?: string
  limit?: number
}

/**
 * Result from a knowledge search
 */
export interface KnowledgeSearchResult {
  content: string
  source: string
  section?: string
  relevance?: number
  metadata?: Record<string, unknown>
}

/**
 * Metadata about the knowledge source
 */
export interface KnowledgeMetadata {
  companyName: string
  documentCount: number
  dataSufficiencyScore: number
  lastUpdated?: string
}

/**
 * Readiness assessment for knowledge source
 */
export interface KnowledgeReadiness {
  ready: boolean
  score: number // 0-100
  level: 'good' | 'limited' | 'insufficient'
  details: {
    financialCoverage: number // 0-100
    marketCoverage: number
    companyCoverage: number
    documentCount: number
    findingCount: number
  }
  recommendations: string[]
}

/**
 * Knowledge service interface
 */
export interface IKnowledgeService {
  search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]>
  getSection(sectionPath: string): Promise<KnowledgeSearchResult[]>
  getMetadata(): Promise<KnowledgeMetadata>
  getSummary(): Promise<string>
  checkReadiness(): Promise<KnowledgeReadiness>
  getMode(): KnowledgeMode
  getConfig(): KnowledgeServiceConfig
}

// =============================================================================
// Knowledge Service Implementation
// =============================================================================

/**
 * Knowledge Service
 *
 * Unified interface for querying knowledge from either JSON files or Graphiti.
 * Uses mode-based routing to delegate to the appropriate backend.
 */
export class KnowledgeService implements IKnowledgeService {
  private config: KnowledgeServiceConfig
  private knowledgeCache: KnowledgeFile | null = null

  constructor(config: KnowledgeServiceConfig) {
    this.config = config
  }

  /**
   * Get the current knowledge mode
   */
  getMode(): KnowledgeMode {
    return this.config.mode
  }

  /**
   * Get the service configuration
   */
  getConfig(): KnowledgeServiceConfig {
    return this.config
  }

  /**
   * Search knowledge base for relevant findings
   */
  async search(query: string, options?: KnowledgeSearchOptions): Promise<KnowledgeSearchResult[]> {
    if (this.config.mode === 'graphiti') {
      return this.searchGraphiti(query, options)
    }
    return this.searchJson(query, options)
  }

  /**
   * Get all findings for a specific section
   */
  async getSection(sectionPath: string): Promise<KnowledgeSearchResult[]> {
    if (this.config.mode === 'graphiti') {
      return this.getSectionGraphiti(sectionPath)
    }
    return this.getSectionJson(sectionPath)
  }

  /**
   * Get metadata about the knowledge source
   */
  async getMetadata(): Promise<KnowledgeMetadata> {
    if (this.config.mode === 'graphiti') {
      return this.getMetadataGraphiti()
    }
    return this.getMetadataJson()
  }

  /**
   * Get a summary of available data
   */
  async getSummary(): Promise<string> {
    if (this.config.mode === 'graphiti') {
      return this.getSummaryGraphiti()
    }
    return this.getSummaryJson()
  }

  /**
   * Check readiness of knowledge source
   */
  async checkReadiness(): Promise<KnowledgeReadiness> {
    if (this.config.mode === 'graphiti') {
      return this.checkGraphitiReadiness()
    }
    return this.checkJsonReadiness()
  }

  // ===========================================================================
  // JSON Mode Implementations (wrap existing knowledge-loader.ts)
  // ===========================================================================

  private async ensureJsonLoaded(): Promise<KnowledgeFile> {
    if (!this.knowledgeCache) {
      this.knowledgeCache = await loadKnowledge(this.config.knowledgePath)
    }
    return this.knowledgeCache
  }

  private async searchJson(
    query: string,
    options?: KnowledgeSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    // Ensure knowledge is loaded
    await this.ensureJsonLoaded()

    const results = searchKnowledge(query, options?.section)
    const limit = options?.limit ?? 10

    return results.slice(0, limit).map((r) => ({
      content: r.content,
      source: r.source,
      section: r.section,
    }))
  }

  private async getSectionJson(sectionPath: string): Promise<KnowledgeSearchResult[]> {
    // Ensure knowledge is loaded
    await this.ensureJsonLoaded()

    const findings = getFindingsForSection(sectionPath)

    return findings.map((f: Finding) => ({
      content: f.content,
      source: `${f.source.document}, ${f.source.location}`,
      metadata: {
        id: f.id,
        confidence: f.confidence,
        category: f.category,
      },
    }))
  }

  private async getMetadataJson(): Promise<KnowledgeMetadata> {
    const knowledge = await this.ensureJsonLoaded()
    const metadata = getCompanyMetadata()

    return {
      companyName: metadata?.company_name || knowledge.metadata.company_name,
      documentCount: metadata?.documents.length || knowledge.metadata.documents.length,
      dataSufficiencyScore: metadata?.data_sufficiency_score || knowledge.metadata.data_sufficiency_score,
      lastUpdated: metadata?.analyzed_at || knowledge.metadata.analyzed_at,
    }
  }

  private async getSummaryJson(): Promise<string> {
    // Ensure knowledge is loaded
    await this.ensureJsonLoaded()
    return getDataSummary()
  }

  private async checkJsonReadiness(): Promise<KnowledgeReadiness> {
    try {
      const knowledge = await this.ensureJsonLoaded()
      const metadata = knowledge.metadata

      // JSON mode is always "ready" since it's a static file
      // But we can still calculate coverage metrics
      const financialFindings = getFindingsForSection('financial_performance')
      const marketFindings = getFindingsForSection('market_opportunity')
      const companyFindings = getFindingsForSection('company_overview')

      const financialCoverage = Math.min(100, financialFindings.length * 20)
      const marketCoverage = Math.min(100, marketFindings.length * 20)
      const companyCoverage = Math.min(100, companyFindings.length * 20)
      const findingCount = financialFindings.length + marketFindings.length + companyFindings.length

      return {
        ready: true,
        score: metadata.data_sufficiency_score,
        level: metadata.data_sufficiency_score >= 60 ? 'good' :
               metadata.data_sufficiency_score >= 30 ? 'limited' : 'insufficient',
        details: {
          financialCoverage,
          marketCoverage,
          companyCoverage,
          documentCount: metadata.documents.length,
          findingCount,
        },
        recommendations: [],
      }
    } catch (error) {
      // JSON file not found
      return {
        ready: false,
        score: 0,
        level: 'insufficient',
        details: {
          financialCoverage: 0,
          marketCoverage: 0,
          companyCoverage: 0,
          documentCount: 0,
          findingCount: 0,
        },
        recommendations: ['Knowledge file not found. Please run manda-analyze first.'],
      }
    }
  }

  // ===========================================================================
  // Graphiti Mode Implementations (delegated to graphiti-knowledge.ts)
  // ===========================================================================

  private async searchGraphiti(
    query: string,
    options?: KnowledgeSearchOptions
  ): Promise<KnowledgeSearchResult[]> {
    const { dealId } = this.config
    if (!dealId) {
      throw new Error('dealId required for Graphiti mode')
    }

    // Dynamic import to avoid circular dependencies
    const { searchGraphiti } = await import('./graphiti-knowledge')
    return searchGraphiti(query, dealId, options)
  }

  private async getSectionGraphiti(sectionPath: string): Promise<KnowledgeSearchResult[]> {
    const { dealId, buyerPersona, userFocus } = this.config
    if (!dealId) {
      throw new Error('dealId required for Graphiti mode')
    }

    const { getSectionGraphiti } = await import('./graphiti-knowledge')
    return getSectionGraphiti(sectionPath, dealId, {
      buyerPersona,
      userFocus,
    })
  }

  private async getMetadataGraphiti(): Promise<KnowledgeMetadata> {
    const { dealId } = this.config
    if (!dealId) {
      throw new Error('dealId required for Graphiti mode')
    }

    const { getMetadataGraphiti } = await import('./graphiti-knowledge')
    return getMetadataGraphiti(dealId)
  }

  private async getSummaryGraphiti(): Promise<string> {
    const metadata = await this.getMetadataGraphiti()
    return `**Company:** ${metadata.companyName}\n**Documents:** ${metadata.documentCount}\n**Data Coverage:** ${metadata.dataSufficiencyScore}%`
  }

  private async checkGraphitiReadiness(): Promise<KnowledgeReadiness> {
    const { dealId } = this.config
    if (!dealId) {
      return {
        ready: false,
        score: 0,
        level: 'insufficient',
        details: {
          financialCoverage: 0,
          marketCoverage: 0,
          companyCoverage: 0,
          documentCount: 0,
          findingCount: 0,
        },
        recommendations: ['Deal ID is required for Graphiti mode.'],
      }
    }

    try {
      // Probe for data coverage by section
      const financialResults = await this.search('revenue profit EBITDA', { limit: 5 })
      const marketResults = await this.search('market competition industry', { limit: 5 })
      const companyResults = await this.search('company team history', { limit: 5 })

      const financialCoverage = Math.min(100, financialResults.length * 20)
      const marketCoverage = Math.min(100, marketResults.length * 20)
      const companyCoverage = Math.min(100, companyResults.length * 20)
      const findingCount = financialResults.length + marketResults.length + companyResults.length

      const score = Math.round((financialCoverage + marketCoverage + companyCoverage) / 3)
      const level = score >= 60 ? 'good' : score >= 30 ? 'limited' : 'insufficient'
      const ready = score >= 30 // Allow with warning at 30%+

      const recommendations: string[] = []
      if (financialCoverage < 40) recommendations.push('Upload financial statements')
      if (marketCoverage < 40) recommendations.push('Upload market research or pitch deck')
      if (companyCoverage < 40) recommendations.push('Upload company overview or team bios')

      return {
        ready,
        score,
        level,
        details: {
          financialCoverage,
          marketCoverage,
          companyCoverage,
          documentCount: findingCount, // Approximation
          findingCount,
        },
        recommendations,
      }
    } catch (error) {
      console.error('[KnowledgeService] Graphiti readiness check failed:', error)
      return {
        ready: false,
        score: 0,
        level: 'insufficient',
        details: {
          financialCoverage: 0,
          marketCoverage: 0,
          companyCoverage: 0,
          documentCount: 0,
          findingCount: 0,
        },
        recommendations: ['Unable to connect to knowledge graph. Please try again later.'],
      }
    }
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a knowledge service instance
 *
 * @param config - Configuration for the knowledge service
 * @returns KnowledgeService instance
 *
 * @example
 * ```typescript
 * // JSON mode (dev/testing)
 * const jsonService = createKnowledgeService({
 *   mode: 'json',
 *   knowledgePath: '/data/test-company/knowledge.json',
 * })
 *
 * // Graphiti mode (production)
 * const graphitiService = createKnowledgeService({
 *   mode: 'graphiti',
 *   dealId: 'deal-123',
 *   groupId: 'project-456',
 * })
 * ```
 */
export function createKnowledgeService(config: KnowledgeServiceConfig): IKnowledgeService {
  return new KnowledgeService(config)
}
