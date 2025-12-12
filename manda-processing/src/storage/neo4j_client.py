"""
Neo4j client for knowledge graph operations.
Story: E4.15 - Sync Findings to Neo4j Knowledge Graph (AC: #1, #3, #4)

This module provides Neo4j driver singleton and node creation functions:
- Singleton driver pattern with connection pooling
- Finding node creation (MERGE for idempotency)
- Document node creation (MERGE for idempotency)
- Relationship creation (EXTRACTED_FROM)
- Error handling for connection failures
"""

import structlog
from neo4j import GraphDatabase, Driver, Session
from typing import Optional

from src.config import get_settings

logger = structlog.get_logger(__name__)

# Global singleton driver instance
_driver: Optional[Driver] = None


class Neo4jConnectionError(Exception):
    """Raised when Neo4j connection fails."""
    pass


def get_neo4j_driver() -> Driver:
    """
    Get or create Neo4j driver singleton.

    Returns:
        Driver: Neo4j driver instance with connection pooling

    Raises:
        Neo4jConnectionError: If connection fails

    Note:
        Uses singleton pattern - one driver per application.
        Connection pool size set to 10 for 5 worker threads.
    """
    global _driver

    if _driver is None:
        settings = get_settings()

        # Validate required settings
        if not settings.neo4j_uri:
            raise Neo4jConnectionError("NEO4J_URI environment variable not set")

        if not settings.neo4j_password:
            raise Neo4jConnectionError("NEO4J_PASSWORD environment variable not set")

        try:
            _driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
                max_connection_pool_size=10,  # 10 connections for 5 worker threads
            )

            # Test connection
            _driver.verify_connectivity()

            logger.info(
                "Neo4j driver initialized",
                uri=settings.neo4j_uri,
                user=settings.neo4j_user,
            )

        except Exception as e:
            logger.error("Failed to initialize Neo4j driver", error=str(e))
            raise Neo4jConnectionError(f"Failed to connect to Neo4j: {e}") from e

    return _driver


async def close_neo4j_driver() -> None:
    """Close the Neo4j driver singleton.

    Called during application shutdown to cleanup connections.
    """
    global _driver
    if _driver:
        _driver.close()
        _driver = None
        logger.info("Neo4j driver closed")


def create_finding_node(
    finding_id: str,
    content: str,
    finding_type: str,
    confidence: float,
    domain: str,
    date_referenced: Optional[str],
    date_extracted: str,
    user_id: str,
    project_id: str,
) -> None:
    """
    Create or update a Finding node in Neo4j.

    Args:
        finding_id: UUID of the finding
        content: Finding text content
        finding_type: Type (metric, fact, risk, opportunity, contradiction)
        confidence: Confidence score 0-1
        domain: Domain (financial, operational, market, legal, technical)
        date_referenced: Optional date referenced in finding (ISO format)
        date_extracted: Date finding was extracted (ISO format)
        user_id: User UUID for multi-tenancy
        project_id: Project/deal UUID for multi-tenancy

    Raises:
        Neo4jConnectionError: If write fails

    Note:
        Uses MERGE for idempotency - safe to call multiple times.
    """
    driver = get_neo4j_driver()

    try:
        with driver.session() as session:
            session.run(
                """
                MERGE (f:Finding {id: $id})
                SET f.content = $content,
                    f.type = $type,
                    f.confidence = $confidence,
                    f.domain = $domain,
                    f.date_referenced = $date_referenced,
                    f.date_extracted = $date_extracted,
                    f.user_id = $user_id,
                    f.project_id = $project_id
                """,
                id=finding_id,
                content=content,
                type=finding_type,
                confidence=confidence,
                domain=domain,
                date_referenced=date_referenced,
                date_extracted=date_extracted,
                user_id=user_id,
                project_id=project_id,
            )

        logger.debug(
            "Finding node created",
            finding_id=finding_id,
            domain=domain,
            type=finding_type,
        )

    except Exception as e:
        logger.error(
            "Failed to create Finding node",
            error=str(e),
            finding_id=finding_id,
        )
        raise Neo4jConnectionError(f"Failed to create Finding node: {e}") from e


def create_document_node(
    document_id: str,
    name: str,
    project_id: str,
    upload_date: str,
    doc_type: str,
) -> None:
    """
    Create or update a Document node in Neo4j.

    Args:
        document_id: UUID of the document
        name: Document filename
        project_id: Project/deal UUID
        upload_date: Upload timestamp (ISO format)
        doc_type: File extension (pdf, xlsx, docx, etc.)

    Raises:
        Neo4jConnectionError: If write fails

    Note:
        Uses MERGE for idempotency - safe to call multiple times.
    """
    driver = get_neo4j_driver()

    try:
        with driver.session() as session:
            session.run(
                """
                MERGE (d:Document {id: $id})
                SET d.name = $name,
                    d.project_id = $project_id,
                    d.upload_date = $upload_date,
                    d.doc_type = $doc_type
                """,
                id=document_id,
                name=name,
                project_id=project_id,
                upload_date=upload_date,
                doc_type=doc_type,
            )

        logger.debug(
            "Document node created",
            document_id=document_id,
            name=name,
        )

    except Exception as e:
        logger.error(
            "Failed to create Document node",
            error=str(e),
            document_id=document_id,
        )
        raise Neo4jConnectionError(f"Failed to create Document node: {e}") from e


def create_extracted_from_relationship(
    finding_id: str,
    document_id: str,
) -> None:
    """
    Create EXTRACTED_FROM relationship between Finding and Document.

    Args:
        finding_id: UUID of the finding
        document_id: UUID of the document

    Raises:
        Neo4jConnectionError: If write fails

    Note:
        Uses MERGE for idempotency - safe to call multiple times.
        Requires both nodes to exist (created by create_finding_node and create_document_node).
    """
    driver = get_neo4j_driver()

    try:
        with driver.session() as session:
            session.run(
                """
                MATCH (f:Finding {id: $finding_id})
                MATCH (d:Document {id: $document_id})
                MERGE (f)-[:EXTRACTED_FROM]->(d)
                """,
                finding_id=finding_id,
                document_id=document_id,
            )

        logger.debug(
            "EXTRACTED_FROM relationship created",
            finding_id=finding_id,
            document_id=document_id,
        )

    except Exception as e:
        logger.error(
            "Failed to create EXTRACTED_FROM relationship",
            error=str(e),
            finding_id=finding_id,
            document_id=document_id,
        )
        raise Neo4jConnectionError(f"Failed to create relationship: {e}") from e
