---
path: /Users/maxhofer/Documents/Business/Dev/M&A_Agent/manda_platform/manda-platform/manda-app/lib/neo4j/index.ts
type: module
updated: 2026-01-20
status: active
---

# index.ts

## Purpose

Barrel export for the Neo4j graph database module. Provides client connection management, type definitions for nodes and relationships, schema initialization, and CRUD operations for the knowledge graph. Supports the M&A due diligence domain model with Deal, Document, Finding, and Insight nodes connected by semantic relationships.

## Exports

- Client: `getNeo4jDriver`, `getSession`, `closeNeo4jDriver`, `verifyNeo4jConnection`, `executeRead`, `executeWrite`
- Type constants: `NODE_LABELS`, `RELATIONSHIP_TYPES`
- Node types: `NodeLabel`, `RelationshipType`, `DealNode`, `DocumentNode`, `FindingNode`, `InsightNode`
- Relationship types: `ExtractedFromRel`, `ContradictsRel`, `SupersedesRel`, `SupportsRel`, `PatternDetectedRel`, `BasedOnRel`, `BelongsToRel`
- Schema: `initializeNeo4jSchema`, `getNeo4jSchemaStatus`, `dropNeo4jSchema`
- Operations: `createNode`, `getNodeById`, `updateNode`, `deleteNode`, `findNodesByProperty`, `createRelationship`, `deleteRelationship`, `getRelatedNodes`, `createDealNode`, `createDocumentNode`, `createFindingNode`, `createContradiction`, `createSupport`, `getFindingsWithSources`, `getContradictions`, `getFindingsByTimePeriod`

## Dependencies

- [[manda-app-lib-neo4j-client]] - Neo4j driver management
- [[manda-app-lib-neo4j-types]] - Type definitions
- [[manda-app-lib-neo4j-schema]] - Schema management
- [[manda-app-lib-neo4j-operations]] - CRUD operations

## Used By

TBD

## Notes

Relationship types include SUPPORTS, CONTRADICTS, SUPERSEDES for finding relationships, plus EXTRACTED_FROM, PATTERN_DETECTED, BASED_ON for document and insight lineage. Multi-tenant isolation uses group_id namespacing.
