"""
Entity management API endpoints for manual entity resolution.
Story: E10.6 - Entity Resolution (AC: #4, #5)

This module provides:
- POST /api/entities/merge - Create IS_DUPLICATE_OF edge between entities
- POST /api/entities/split - Remove IS_DUPLICATE_OF edge
- GET /api/entities/duplicates - Get entities with duplicate relationships

Usage:
    # Merge two entities
    POST /api/entities/merge
    {
        "source_uuid": "entity-to-mark-as-duplicate",
        "target_uuid": "canonical-entity",
        "deal_id": "deal-123"
    }

    # Split previously merged entity
    POST /api/entities/split
    {
        "uuid": "entity-to-split",
        "deal_id": "deal-123"
    }

    # Get all duplicates for a deal
    GET /api/entities/duplicates?deal_id=deal-123&min_confidence=0.5
"""

import structlog
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.graphiti.client import GraphitiClient, GraphitiConnectionError

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/api/entities", tags=["entities"])


# ============================================================
# Request/Response Models
# ============================================================


class MergeRequest(BaseModel):
    """Request body for merging two entities."""

    source_uuid: str = Field(..., description="Entity UUID to mark as duplicate")
    target_uuid: str = Field(..., description="Canonical entity UUID (source is duplicate of this)")
    deal_id: str = Field(..., description="Deal ID for namespace isolation")


class MergeResponse(BaseModel):
    """Response from merge operation."""

    status: str = "merged"
    source_name: str
    target_name: str
    edge_created: bool = True


class SplitRequest(BaseModel):
    """Request body for splitting a merged entity."""

    uuid: str = Field(..., description="Entity UUID to split from its duplicate target")
    deal_id: str = Field(..., description="Deal ID for namespace isolation")


class SplitResponse(BaseModel):
    """Response from split operation."""

    status: str = "split"
    source_name: str
    was_duplicate_of: str


class DuplicateRecord(BaseModel):
    """A single duplicate relationship record."""

    source_uuid: str
    source_name: str
    target_uuid: str
    target_name: str
    confidence: float
    method: str


class DuplicatesResponse(BaseModel):
    """Response containing duplicate relationships for a deal."""

    deal_id: str
    count: int
    duplicates: list[DuplicateRecord]


# ============================================================
# Endpoints
# ============================================================


@router.post("/merge", response_model=MergeResponse)
async def merge_entities(request: MergeRequest) -> MergeResponse:
    """
    Create IS_DUPLICATE_OF edge between two entities.

    Story: E10.6 - Entity Resolution (AC: #4, #5)

    The source entity is marked as a duplicate of the target (canonical) entity.
    This creates an IS_DUPLICATE_OF edge with metadata for audit trail.

    Args:
        request: MergeRequest with source_uuid, target_uuid, deal_id

    Returns:
        MergeResponse with entity names and success status

    Raises:
        HTTPException 404: If either entity not found in deal
        HTTPException 503: If Neo4j connection fails
    """
    try:
        client = await GraphitiClient.get_instance()
        driver = client.driver

        async with driver.session() as session:
            # Verify both entities exist in the specified deal
            verify_result = await session.run(
                """
                MATCH (s:Entity {uuid: $source, group_id: $deal})
                MATCH (t:Entity {uuid: $target, group_id: $deal})
                RETURN s.name as source_name, t.name as target_name
                """,
                source=request.source_uuid,
                target=request.target_uuid,
                deal=request.deal_id,
            )

            record = await verify_result.single()
            if not record:
                logger.warning(
                    "Entity not found for merge",
                    source_uuid=request.source_uuid,
                    target_uuid=request.target_uuid,
                    deal_id=request.deal_id,
                )
                raise HTTPException(
                    status_code=404,
                    detail=f"One or both entities not found in deal {request.deal_id}",
                )

            source_name = record["source_name"]
            target_name = record["target_name"]

            # Create IS_DUPLICATE_OF edge with audit metadata
            await session.run(
                """
                MATCH (s:Entity {uuid: $source})
                MATCH (t:Entity {uuid: $target})
                MERGE (s)-[r:IS_DUPLICATE_OF]->(t)
                SET r.created_at = datetime(),
                    r.method = 'manual',
                    r.confidence = 1.0
                """,
                source=request.source_uuid,
                target=request.target_uuid,
            )

        logger.info(
            "Entities merged",
            source_uuid=request.source_uuid,
            source_name=source_name,
            target_uuid=request.target_uuid,
            target_name=target_name,
            deal_id=request.deal_id,
        )

        return MergeResponse(
            status="merged",
            source_name=source_name,
            target_name=target_name,
            edge_created=True,
        )

    except HTTPException:
        raise
    except GraphitiConnectionError as e:
        logger.error("Neo4j connection error during merge", error=str(e))
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error during merge", error=str(e))
        raise HTTPException(status_code=500, detail=f"Merge failed: {e}")


@router.post("/split", response_model=SplitResponse)
async def split_entity(request: SplitRequest) -> SplitResponse:
    """
    Remove IS_DUPLICATE_OF edge from an entity.

    Story: E10.6 - Entity Resolution (AC: #4, #5)

    Reverses a previous merge by removing the IS_DUPLICATE_OF edge.
    This is useful when automatic or manual resolution was incorrect.

    Args:
        request: SplitRequest with uuid, deal_id

    Returns:
        SplitResponse with entity names and status

    Raises:
        HTTPException 404: If no duplicate relationship found
        HTTPException 503: If Neo4j connection fails
    """
    try:
        client = await GraphitiClient.get_instance()
        driver = client.driver

        async with driver.session() as session:
            # Find and delete the IS_DUPLICATE_OF edge
            result = await session.run(
                """
                MATCH (s:Entity {uuid: $uuid, group_id: $deal})-[r:IS_DUPLICATE_OF]->(t)
                DELETE r
                RETURN s.name as source_name, t.name as target_name, t.uuid as target_uuid
                """,
                uuid=request.uuid,
                deal=request.deal_id,
            )

            record = await result.single()
            if not record:
                logger.warning(
                    "No duplicate relationship found for split",
                    uuid=request.uuid,
                    deal_id=request.deal_id,
                )
                raise HTTPException(
                    status_code=404,
                    detail=f"No duplicate relationship found for entity {request.uuid}",
                )

            source_name = record["source_name"]
            target_name = record["target_name"]

        logger.info(
            "Entity split",
            uuid=request.uuid,
            source_name=source_name,
            was_duplicate_of=target_name,
            deal_id=request.deal_id,
        )

        return SplitResponse(
            status="split",
            source_name=source_name,
            was_duplicate_of=target_name,
        )

    except HTTPException:
        raise
    except GraphitiConnectionError as e:
        logger.error("Neo4j connection error during split", error=str(e))
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error during split", error=str(e))
        raise HTTPException(status_code=500, detail=f"Split failed: {e}")


@router.get("/duplicates", response_model=DuplicatesResponse)
async def get_duplicates(
    deal_id: str = Query(..., description="Deal ID to get duplicates for"),
    min_confidence: float = Query(0.5, ge=0.0, le=1.0, description="Minimum confidence threshold"),
) -> DuplicatesResponse:
    """
    Get entities with IS_DUPLICATE_OF relationships for a deal.

    Story: E10.6 - Entity Resolution (AC: #4, #5)

    Returns all duplicate relationships within a deal, filtered by
    minimum confidence threshold. Useful for auditing resolution decisions.

    Args:
        deal_id: Deal ID to query
        min_confidence: Minimum confidence score (default 0.5)

    Returns:
        DuplicatesResponse with list of duplicate relationships

    Raises:
        HTTPException 503: If Neo4j connection fails
    """
    try:
        client = await GraphitiClient.get_instance()
        driver = client.driver

        async with driver.session() as session:
            result = await session.run(
                """
                MATCH (s:Entity {group_id: $deal})-[r:IS_DUPLICATE_OF]->(t)
                WHERE r.confidence >= $min_conf OR r.confidence IS NULL
                RETURN
                    s.uuid as source_uuid,
                    s.name as source_name,
                    t.uuid as target_uuid,
                    t.name as target_name,
                    coalesce(r.confidence, 1.0) as confidence,
                    coalesce(r.method, 'automatic') as method
                ORDER BY r.confidence DESC
                """,
                deal=deal_id,
                min_conf=min_confidence,
            )

            records = await result.data()

        duplicates = [
            DuplicateRecord(
                source_uuid=r["source_uuid"],
                source_name=r["source_name"],
                target_uuid=r["target_uuid"],
                target_name=r["target_name"],
                confidence=r["confidence"],
                method=r["method"],
            )
            for r in records
        ]

        logger.info(
            "Retrieved duplicates",
            deal_id=deal_id,
            min_confidence=min_confidence,
            count=len(duplicates),
        )

        return DuplicatesResponse(
            deal_id=deal_id,
            count=len(duplicates),
            duplicates=duplicates,
        )

    except GraphitiConnectionError as e:
        logger.error("Neo4j connection error getting duplicates", error=str(e))
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error getting duplicates", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get duplicates: {e}")


@router.get("/resolution-history/{entity_uuid}", response_model=list[DuplicateRecord])
async def get_resolution_history(
    entity_uuid: str,
    deal_id: str = Query(..., description="Deal ID for namespace isolation"),
) -> list[DuplicateRecord]:
    """
    Get resolution history for a specific entity.

    Story: E10.6 - Entity Resolution (AC: #5)

    Returns all IS_DUPLICATE_OF relationships where the entity is
    either the source or target, providing a complete audit trail.

    Args:
        entity_uuid: Entity UUID to get history for
        deal_id: Deal ID for namespace isolation

    Returns:
        List of DuplicateRecord showing resolution history

    Raises:
        HTTPException 503: If Neo4j connection fails
    """
    try:
        client = await GraphitiClient.get_instance()
        driver = client.driver

        async with driver.session() as session:
            # Get edges where entity is source (marked as duplicate)
            outgoing = await session.run(
                """
                MATCH (s:Entity {uuid: $uuid, group_id: $deal})-[r:IS_DUPLICATE_OF]->(t)
                RETURN
                    s.uuid as source_uuid,
                    s.name as source_name,
                    t.uuid as target_uuid,
                    t.name as target_name,
                    coalesce(r.confidence, 1.0) as confidence,
                    coalesce(r.method, 'automatic') as method
                """,
                uuid=entity_uuid,
                deal=deal_id,
            )
            outgoing_records = await outgoing.data()

            # Get edges where entity is target (has duplicates pointing to it)
            incoming = await session.run(
                """
                MATCH (s)-[r:IS_DUPLICATE_OF]->(t:Entity {uuid: $uuid, group_id: $deal})
                RETURN
                    s.uuid as source_uuid,
                    s.name as source_name,
                    t.uuid as target_uuid,
                    t.name as target_name,
                    coalesce(r.confidence, 1.0) as confidence,
                    coalesce(r.method, 'automatic') as method
                """,
                uuid=entity_uuid,
                deal=deal_id,
            )
            incoming_records = await incoming.data()

        all_records = outgoing_records + incoming_records
        history = [
            DuplicateRecord(
                source_uuid=r["source_uuid"],
                source_name=r["source_name"],
                target_uuid=r["target_uuid"],
                target_name=r["target_name"],
                confidence=r["confidence"],
                method=r["method"],
            )
            for r in all_records
        ]

        logger.info(
            "Retrieved resolution history",
            entity_uuid=entity_uuid,
            deal_id=deal_id,
            record_count=len(history),
        )

        return history

    except GraphitiConnectionError as e:
        logger.error("Neo4j connection error getting resolution history", error=str(e))
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error("Unexpected error getting resolution history", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to get resolution history: {e}")
