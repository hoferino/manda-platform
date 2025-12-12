"""
Backfill Neo4j knowledge graph with existing findings from PostgreSQL.
Story: E4.15 - Sync Findings to Neo4j Knowledge Graph (AC: #5)

Usage:
    python3 -m src.scripts.backfill_neo4j

This script:
1. Queries all findings from PostgreSQL (Supabase)
2. For each finding:
   - Creates Finding node in Neo4j
   - Creates Document node (if not exists)
   - Creates EXTRACTED_FROM relationship
3. Progress logging with counts
4. Idempotent - safe to run multiple times (MERGE operations)
"""

import asyncio
import sys
from datetime import datetime, timezone
from typing import Any

import structlog

from src.config import get_settings
from src.storage.neo4j_client import (
    create_finding_node,
    create_document_node,
    create_extracted_from_relationship,
    get_neo4j_driver,
    Neo4jConnectionError,
)
from src.storage.neo4j_schema import initialize_neo4j_schema
from src.storage.supabase_client import get_supabase_client

# Configure logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.add_log_level,
        structlog.dev.ConsoleRenderer(),
    ]
)

logger = structlog.get_logger(__name__)


async def backfill_neo4j() -> None:
    """
    Backfill Neo4j with all findings from PostgreSQL.

    Raises:
        Neo4jConnectionError: If Neo4j connection fails
        Exception: If database query fails
    """
    logger.info("Starting Neo4j backfill")

    # Initialize Neo4j schema
    try:
        logger.info("Initializing Neo4j schema...")
        initialize_neo4j_schema()
        logger.info("Schema initialized")
    except Exception as e:
        logger.error("Failed to initialize Neo4j schema", error=str(e))
        raise

    # Get Supabase client
    db = get_supabase_client()

    # Get all findings from PostgreSQL
    logger.info("Querying findings from PostgreSQL...")

    try:
        # Query findings with document info using async method
        findings = await db.get_all_findings_with_documents()

        logger.info(f"Found {len(findings)} findings in PostgreSQL")

        if not findings:
            logger.info("No findings to backfill")
            return

    except Exception as e:
        logger.error("Failed to query findings from PostgreSQL", error=str(e))
        raise

    # Process each finding
    synced_count = 0
    failed_count = 0
    document_ids: set[str] = set()

    for i, finding in enumerate(findings):
        finding_id = finding["id"]
        document = finding.get("documents")

        if not document:
            logger.warning(
                "Skipping finding with no document reference",
                finding_id=finding_id,
            )
            failed_count += 1
            continue

        document_id = document["id"]
        document_ids.add(document_id)

        try:
            # Convert UUIDs to strings (asyncpg returns UUID objects)
            finding_id_str = str(finding_id)
            document_id_str = str(document_id)

            # Create document node (idempotent - only creates if not exists)
            create_document_node(
                document_id=document_id_str,
                name=document.get("name", "Unknown"),
                project_id=str(document.get("deal_id", "")),
                upload_date=str(document.get("created_at", datetime.now(timezone.utc).isoformat())),
                doc_type=document.get("file_type", "unknown"),
            )

            # Create finding node
            # Convert confidence from 0-1 (DB) to 0-1 (Neo4j) if needed
            confidence = finding.get("confidence", 0.0)
            if confidence > 1.0:
                confidence = confidence / 100.0  # Convert from 0-100 to 0-1

            # Parse metadata if it's a JSON string
            metadata = finding.get("metadata", {})
            if isinstance(metadata, str):
                import json
                try:
                    metadata = json.loads(metadata)
                except json.JSONDecodeError:
                    metadata = {}

            create_finding_node(
                finding_id=finding_id_str,
                content=finding.get("text", ""),
                finding_type=finding.get("finding_type", "fact"),
                confidence=confidence,
                domain=finding.get("domain", "operational"),
                date_referenced=metadata.get("date_referenced") if metadata else None,
                date_extracted=str(finding.get("created_at", datetime.now(timezone.utc).isoformat())),
                user_id=str(document.get("user_id", "")),
                project_id=str(document.get("deal_id", "")),
            )

            # Create EXTRACTED_FROM relationship
            create_extracted_from_relationship(
                finding_id=finding_id_str,
                document_id=document_id_str,
            )

            synced_count += 1

            # Progress logging every 10 findings
            if (i + 1) % 10 == 0 or i == len(findings) - 1:
                logger.info(
                    f"Progress: {i + 1}/{len(findings)} findings processed",
                    synced=synced_count,
                    failed=failed_count,
                )

        except Exception as e:
            logger.error(
                "Failed to sync finding",
                finding_id=finding_id,
                error=str(e),
            )
            failed_count += 1
            # Continue processing other findings

    # Final summary
    logger.info(
        "Backfill complete",
        total_findings=len(findings),
        synced=synced_count,
        failed=failed_count,
        unique_documents=len(document_ids),
    )

    # Verify counts in Neo4j
    try:
        driver = get_neo4j_driver()
        with driver.session() as session:
            # Count findings
            result = session.run("MATCH (f:Finding) RETURN count(f) as count")
            finding_count = result.single()["count"]

            # Count documents
            result = session.run("MATCH (d:Document) RETURN count(d) as count")
            document_count = result.single()["count"]

            # Count relationships
            result = session.run(
                "MATCH (f:Finding)-[:EXTRACTED_FROM]->(d:Document) RETURN count(f) as count"
            )
            relationship_count = result.single()["count"]

            logger.info(
                "Neo4j verification",
                finding_nodes=finding_count,
                document_nodes=document_count,
                extracted_from_relationships=relationship_count,
            )

    except Exception as e:
        logger.warning("Failed to verify Neo4j counts", error=str(e))


def main() -> None:
    """Main entry point for the backfill script."""
    try:
        asyncio.run(backfill_neo4j())
        sys.exit(0)
    except KeyboardInterrupt:
        logger.info("Backfill cancelled by user")
        sys.exit(1)
    except Exception as e:
        logger.error("Backfill failed", error=str(e), exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
