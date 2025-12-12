"""
Neo4j schema initialization.
Story: E4.15 - Sync Findings to Neo4j Knowledge Graph (AC: #2)

This module creates Neo4j constraints and indexes on worker startup:
- Constraints for uniqueness (finding_id, document_id, deal_id)
- Indexes for filtering (date_referenced, user_id, domain, project_id)
- Idempotent operations (IF NOT EXISTS)
"""

import structlog

from src.storage.neo4j_client import get_neo4j_driver, Neo4jConnectionError

logger = structlog.get_logger(__name__)


def initialize_neo4j_schema() -> None:
    """
    Initialize Neo4j schema with constraints and indexes.

    Creates:
        - Constraints: finding_id_unique, document_id_unique, deal_id_unique
        - Indexes: finding_date_referenced, finding_user_id, finding_domain, document_project_id

    Note:
        All operations use IF NOT EXISTS for idempotency.
        Safe to call on every worker startup.

    Raises:
        Neo4jConnectionError: If schema initialization fails
    """
    try:
        driver = get_neo4j_driver()

        with driver.session() as session:
            # Constraints (ensure uniqueness)
            logger.info("Creating Neo4j constraints...")

            session.run(
                """
                CREATE CONSTRAINT finding_id_unique IF NOT EXISTS
                FOR (f:Finding) REQUIRE f.id IS UNIQUE
                """
            )

            session.run(
                """
                CREATE CONSTRAINT document_id_unique IF NOT EXISTS
                FOR (d:Document) REQUIRE d.id IS UNIQUE
                """
            )

            session.run(
                """
                CREATE CONSTRAINT deal_id_unique IF NOT EXISTS
                FOR (d:Deal) REQUIRE d.id IS UNIQUE
                """
            )

            # Indexes (optimize queries)
            logger.info("Creating Neo4j indexes...")

            session.run(
                """
                CREATE INDEX finding_date_referenced IF NOT EXISTS
                FOR (f:Finding) ON (f.date_referenced)
                """
            )

            session.run(
                """
                CREATE INDEX finding_user_id IF NOT EXISTS
                FOR (f:Finding) ON (f.user_id)
                """
            )

            session.run(
                """
                CREATE INDEX finding_domain IF NOT EXISTS
                FOR (f:Finding) ON (f.domain)
                """
            )

            session.run(
                """
                CREATE INDEX document_project_id IF NOT EXISTS
                FOR (d:Document) ON (d.project_id)
                """
            )

        logger.info(
            "Neo4j schema initialized",
            constraints=["finding_id_unique", "document_id_unique", "deal_id_unique"],
            indexes=[
                "finding_date_referenced",
                "finding_user_id",
                "finding_domain",
                "document_project_id",
            ],
        )

    except Exception as e:
        logger.error("Failed to initialize Neo4j schema", error=str(e))
        raise Neo4jConnectionError(f"Schema initialization failed: {e}") from e
