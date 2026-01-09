/**
 * Benchmark Inspect Command
 *
 * Queries Neo4j to show knowledge graph entities for a deal.
 * Story: E13 Retrospective - Phased Validation System
 *
 * Usage: npm run benchmark inspect [--deal-id <id>]
 */

import {
  getKnowledgeGraphSummary,
  hasGraphData,
  formatEntityCounts,
  formatRelationshipCounts,
  type GraphitiEntity,
} from '../neo4j-inspect'
import { DOCUMENT_TYPE_INFO } from '../doc-mapping'
import type { DocumentType } from '../types'

/**
 * Generate LangSmith filter URL for a deal
 */
function getLangSmithUrl(dealId: string): string {
  const projectName = process.env.LANGSMITH_PROJECT || 'manda-benchmark'
  const filter = encodeURIComponent(`eq(metadata.deal_id, "${dealId}")`)
  return `https://smith.langchain.com/o/anthropic/projects/p/${projectName}?filter=${filter}`
}

/**
 * Format entity for console output
 */
function formatEntity(entity: GraphitiEntity): string {
  return `   - ${entity.name} (${entity.entityType}) - ${entity.createdAt || 'N/A'}`
}

/**
 * Infer which document types have been uploaded based on entities
 */
function inferUploadedDocTypes(entities: GraphitiEntity[]): DocumentType[] {
  const types = new Set<DocumentType>()

  for (const entity of entities) {
    const entityType = (entity.entityType || '').toLowerCase()

    // CIM indicators
    if (
      entityType.includes('company') ||
      entityType.includes('organization') ||
      entityType.includes('person') ||
      entityType.includes('management')
    ) {
      types.add('cim')
    }

    // Financial indicators
    if (
      entityType.includes('financial') ||
      entityType.includes('revenue') ||
      entityType.includes('ebitda') ||
      entityType.includes('metric') ||
      entityType.includes('projection')
    ) {
      types.add('financials')
    }

    // Legal indicators
    if (
      entityType.includes('contract') ||
      entityType.includes('agreement') ||
      entityType.includes('shareholder') ||
      entityType.includes('legal') ||
      entityType.includes('equity')
    ) {
      types.add('legal')
    }

    // Operational indicators
    if (
      entityType.includes('employee') ||
      entityType.includes('customer') ||
      entityType.includes('technology') ||
      entityType.includes('vendor') ||
      entityType.includes('process')
    ) {
      types.add('operational')
    }
  }

  return Array.from(types)
}

/**
 * Construct the composite group_id used by Graphiti
 * Format: org_id_deal_id (matches Python manda-processing convention)
 */
function buildGroupId(dealId: string, orgId?: string): string {
  const organizationId = orgId || process.env.BENCHMARK_ORG_ID || 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
  return `${organizationId}_${dealId}`
}

/**
 * Run the inspect command
 */
export async function runInspect(dealId?: string, orgId?: string): Promise<void> {
  // Get deal ID from argument or environment
  const targetDealId = dealId || process.env.BENCHMARK_DEAL_ID

  if (!targetDealId) {
    console.error('No deal ID specified.')
    console.error('Set BENCHMARK_DEAL_ID or use --deal-id <id>')
    console.error('')
    console.error('Run `npm run benchmark setup` to create a benchmark deal.')
    process.exit(1)
  }

  // Build composite group_id for Neo4j queries
  const groupId = buildGroupId(targetDealId, orgId)

  console.log('=== Knowledge Graph Inspection ===')
  console.log('')
  console.log(`Deal ID: ${targetDealId}`)
  console.log(`Group ID: ${groupId}`)
  console.log('')

  // Check if any data exists
  const hasData = await hasGraphData(groupId)

  if (!hasData) {
    console.log('No knowledge graph data found for this deal.')
    console.log('')
    console.log('This means either:')
    console.log('  1. No documents have been uploaded yet')
    console.log('  2. Document processing is still in progress')
    console.log('  3. The deal ID is incorrect')
    console.log('')
    console.log('Next steps:')
    console.log('  - Upload documents via the UI')
    console.log('  - Wait for processing to complete (check document status in UI)')
    console.log('  - Re-run: npm run benchmark inspect')
    return
  }

  // Get full summary using composite group_id
  const summary = await getKnowledgeGraphSummary(groupId)

  // Entity counts
  console.log('Entity Counts:')
  console.log(formatEntityCounts(summary.entityCounts))
  console.log('')

  // Relationship counts
  console.log('Relationship Counts:')
  console.log(formatRelationshipCounts(summary.relationshipCounts))
  console.log('')

  // Recent entities
  if (summary.recentEntities.length > 0) {
    console.log('Recent Entities:')
    for (const entity of summary.recentEntities) {
      console.log(formatEntity(entity))
    }
    console.log('')
  }

  // Last updated
  if (summary.lastUpdated) {
    console.log(`Last Updated: ${summary.lastUpdated}`)
    console.log('')
  }

  // Infer document types
  const uploadedDocTypes = inferUploadedDocTypes(summary.recentEntities)

  console.log('=== Validation Status ===')
  console.log('')

  const allDocTypes: Array<Exclude<DocumentType, 'any'>> = [
    'cim',
    'financials',
    'legal',
    'operational',
  ]

  for (const docType of allDocTypes) {
    const info = DOCUMENT_TYPE_INFO[docType]
    const isUploaded = uploadedDocTypes.includes(docType)
    const status = isUploaded ? 'Ready' : 'Not detected'
    const icon = isUploaded ? '[x]' : '[ ]'

    console.log(`${icon} ${info.name} (${docType})`)
    if (isUploaded) {
      console.log(`    Status: ${status}`)
      console.log(`    Run: npm run benchmark validate ${docType}`)
    } else {
      console.log(`    Status: ${status}`)
      console.log(`    Upload: ${info.examples[0]}`)
    }
    console.log('')
  }

  // LangSmith link
  console.log('=== LangSmith Traces ===')
  console.log('')
  console.log('View all traces for this deal:')
  console.log(`  ${getLangSmithUrl(targetDealId)}`)
  console.log('')

  // Next steps based on status
  console.log('=== Next Steps ===')
  console.log('')

  if (uploadedDocTypes.length === 0) {
    console.log('1. Upload documents via the UI')
    console.log('2. Wait for processing (check document status)')
    console.log('3. Re-run: npm run benchmark inspect')
  } else if (uploadedDocTypes.length < 4) {
    const missing = allDocTypes.filter((t) => !uploadedDocTypes.includes(t))
    console.log(`Validated: ${uploadedDocTypes.join(', ')}`)
    console.log(`Missing: ${missing.join(', ')}`)
    console.log('')
    console.log('Options:')
    console.log(`  a) Run validation: npm run benchmark validate ${uploadedDocTypes[0]}`)
    console.log(`  b) Upload more docs: ${DOCUMENT_TYPE_INFO[missing[0]].examples[0]}`)
    console.log('  c) Test edge cases: npm run benchmark edge-cases')
  } else {
    console.log('All document types detected!')
    console.log('')
    console.log('1. Run phased validation:')
    for (const docType of allDocTypes) {
      console.log(`   npm run benchmark validate ${docType}`)
    }
    console.log('')
    console.log('2. Test edge cases:')
    console.log('   npm run benchmark edge-cases')
    console.log('')
    console.log('3. Run full benchmark:')
    console.log('   npm run benchmark run')
  }
}

/**
 * Show entity details for a specific type
 */
export async function inspectEntityType(
  dealId: string,
  entityType: string
): Promise<void> {
  console.log(`=== ${entityType} Entities ===`)
  console.log('')

  const summary = await getKnowledgeGraphSummary(dealId)

  const filtered = summary.recentEntities.filter(
    (e) => e.entityType.toLowerCase().includes(entityType.toLowerCase())
  )

  if (filtered.length === 0) {
    console.log(`No ${entityType} entities found.`)
    return
  }

  for (const entity of filtered) {
    console.log(`${entity.name}`)
    console.log(`  Type: ${entity.entityType}`)
    console.log(`  UUID: ${entity.uuid}`)
    console.log(`  Created: ${entity.createdAt}`)
    console.log('')
  }
}
