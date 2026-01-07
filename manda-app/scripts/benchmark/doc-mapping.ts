/**
 * Document Type Mapping
 *
 * Maps benchmark queries to required document types for phased validation.
 * Story: E13 Retrospective - Phased Validation System
 */

import type { BenchmarkQuery, DocumentType, QueryCategory } from './types'

/**
 * Document type descriptions for user guidance
 */
export const DOCUMENT_TYPE_INFO: Record<
  Exclude<DocumentType, 'any'>,
  {
    name: string
    description: string
    examples: string[]
    expectedEntities: string[]
  }
> = {
  cim: {
    name: 'Confidential Information Memorandum',
    description: 'Company overview, executive summary, management team, business model',
    examples: ['CIM.pdf', 'Company Overview.docx', 'Management Presentation.pptx'],
    expectedEntities: ['Company', 'Person', 'Finding'],
  },
  financials: {
    name: 'Financial Documents',
    description: 'Historical financials, projections, financial model, audit reports',
    examples: ['Financial Model.xlsx', 'Audited Financials 2024.pdf', 'P&L Summary.xlsx'],
    expectedEntities: ['FinancialMetric', 'Company'],
  },
  legal: {
    name: 'Legal Documents',
    description: 'Cap table, shareholder agreements, contracts, IP documentation',
    examples: ['Cap Table.xlsx', 'Shareholder Agreement.pdf', 'Customer Contracts/'],
    expectedEntities: ['Company', 'Person', 'Risk'],
  },
  operational: {
    name: 'Operational Documents',
    description: 'Org charts, tech stack, customer lists, employee data',
    examples: ['Org Chart.pdf', 'Tech Stack Overview.docx', 'Customer List.xlsx'],
    expectedEntities: ['Person', 'Company', 'Finding'],
  },
}

/**
 * Category to document type mapping
 * Maps query categories to their typical required document types
 */
export const CATEGORY_DOC_MAPPING: Record<QueryCategory, DocumentType[]> = {
  greeting: ['any'],
  meta: ['any'],
  financial: ['financials', 'cim'],
  operational: ['operational', 'cim'],
  legal: ['legal'],
  technical: ['operational', 'cim'],
}

/**
 * Filter queries by available document types
 *
 * @param queries - All benchmark queries
 * @param availableDocTypes - Document types that have been uploaded
 * @returns Queries that can be answered with available documents
 */
export function filterQueriesByDocType(
  queries: BenchmarkQuery[],
  availableDocTypes: DocumentType[]
): BenchmarkQuery[] {
  return queries.filter((query) => {
    // If query has explicit requiredDocTypes, check those
    if (query.requiredDocTypes && query.requiredDocTypes.length > 0) {
      // At least one required doc type must be available
      return query.requiredDocTypes.some(
        (docType) => availableDocTypes.includes(docType) || docType === 'any'
      )
    }

    // Fall back to category-based mapping
    const mappedDocTypes = CATEGORY_DOC_MAPPING[query.category]
    return mappedDocTypes.some(
      (docType) => availableDocTypes.includes(docType) || docType === 'any'
    )
  })
}

/**
 * Get queries for a specific document type validation phase
 *
 * @param queries - All benchmark queries
 * @param docType - Document type being validated
 * @returns Queries that require this document type
 */
export function getQueriesForDocType(
  queries: BenchmarkQuery[],
  docType: DocumentType
): BenchmarkQuery[] {
  if (docType === 'any') {
    // Return queries that don't require specific documents
    return queries.filter((query) => {
      if (query.requiredDocTypes) {
        return query.requiredDocTypes.includes('any')
      }
      return query.category === 'greeting' || query.category === 'meta'
    })
  }

  return queries.filter((query) => {
    if (query.requiredDocTypes && query.requiredDocTypes.length > 0) {
      return query.requiredDocTypes.includes(docType)
    }
    // Fall back to category mapping
    return CATEGORY_DOC_MAPPING[query.category].includes(docType)
  })
}

/**
 * Infer required document types from query content
 * Used for auto-tagging existing queries
 *
 * @param query - Query text
 * @param category - Query category
 * @returns Inferred document types
 */
export function inferDocTypes(query: string, category: QueryCategory): DocumentType[] {
  const lowerQuery = query.toLowerCase()

  // Greeting/meta queries don't need documents
  if (category === 'greeting' || category === 'meta') {
    return ['any']
  }

  const docTypes: DocumentType[] = []

  // Financial indicators
  const financialPatterns = [
    'revenue',
    'ebitda',
    'profit',
    'margin',
    'financial',
    'earnings',
    'cash flow',
    'balance sheet',
    'income statement',
    'projection',
    'forecast',
    'budget',
    'q1',
    'q2',
    'q3',
    'q4',
    'fy20',
    'fy21',
    'fy22',
    'fy23',
    'fy24',
    '2020',
    '2021',
    '2022',
    '2023',
    '2024',
    'growth rate',
    'arr',
    'mrr',
    'ltv',
    'cac',
    'burn rate',
    'runway',
  ]
  if (financialPatterns.some((p) => lowerQuery.includes(p))) {
    docTypes.push('financials')
  }

  // CIM indicators (company overview, management)
  const cimPatterns = [
    'company',
    'business model',
    'management',
    'ceo',
    'founder',
    'team',
    'history',
    'mission',
    'vision',
    'strategy',
    'market',
    'competitive',
    'overview',
    'summary',
    'describe',
    'what does',
    'who is',
    'tell me about',
  ]
  if (cimPatterns.some((p) => lowerQuery.includes(p))) {
    docTypes.push('cim')
  }

  // Legal indicators
  const legalPatterns = [
    'cap table',
    'shareholder',
    'equity',
    'ownership',
    'investor',
    'contract',
    'agreement',
    'legal',
    'ip',
    'patent',
    'trademark',
    'liability',
    'compliance',
    'regulatory',
    'terms',
    'vesting',
    'option pool',
  ]
  if (legalPatterns.some((p) => lowerQuery.includes(p))) {
    docTypes.push('legal')
  }

  // Operational indicators
  const operationalPatterns = [
    'employee',
    'headcount',
    'org chart',
    'organization',
    'technology',
    'tech stack',
    'infrastructure',
    'customer',
    'client',
    'vendor',
    'supplier',
    'process',
    'operations',
    'department',
    'team size',
  ]
  if (operationalPatterns.some((p) => lowerQuery.includes(p))) {
    docTypes.push('operational')
  }

  // Default to category-based mapping if no patterns matched
  if (docTypes.length === 0) {
    return CATEGORY_DOC_MAPPING[category]
  }

  return docTypes
}

/**
 * Generate upload checklist for benchmark setup
 *
 * @returns Formatted checklist string
 */
export function generateUploadChecklist(): string {
  const lines: string[] = [
    '=== Benchmark Document Upload Checklist ===',
    '',
    'Upload documents in this order for phased validation:',
    '',
  ]

  const docTypes: Array<Exclude<DocumentType, 'any'>> = [
    'cim',
    'financials',
    'legal',
    'operational',
  ]

  docTypes.forEach((docType, index) => {
    const info = DOCUMENT_TYPE_INFO[docType]
    lines.push(`${index + 1}. ${info.name} (${docType})`)
    lines.push(`   ${info.description}`)
    lines.push(`   Examples: ${info.examples.join(', ')}`)
    lines.push(`   Expected entities: ${info.expectedEntities.join(', ')}`)
    lines.push('')
    lines.push(`   After upload: npm run benchmark validate ${docType}`)
    lines.push('')
  })

  lines.push('After all documents:')
  lines.push('  npm run benchmark edge-cases')
  lines.push('  npm run benchmark run')

  return lines.join('\n')
}

/**
 * Get validation phase summary
 *
 * @param docType - Document type being validated
 * @param queryCount - Number of queries for this phase
 * @returns Summary for console output
 */
export function getPhaseInfo(
  docType: DocumentType,
  queryCount: number
): { title: string; description: string } {
  if (docType === 'any') {
    return {
      title: 'Base Validation (No Documents Required)',
      description: `Testing ${queryCount} greeting and meta queries`,
    }
  }

  const info = DOCUMENT_TYPE_INFO[docType]
  return {
    title: `${info.name} Validation`,
    description: `Testing ${queryCount} queries requiring ${docType} content`,
  }
}
