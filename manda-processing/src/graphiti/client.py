"""
Graphiti client for temporal knowledge graph operations.
Story: E10.1 - Graphiti Infrastructure Setup (AC: #1, #2, #3, #7, #8)
Story: E10.2 - Voyage Embedding Integration (AC: #1, #2, #3, #4, #5)
Story: E10.3 - Sell-Side Spine Schema (AC: #4, #5)
Story: E12.9 - Multi-Tenant Data Isolation (AC: #5)

This module provides:
- GraphitiClient: Singleton client with organization+deal isolation via group_id
- GraphitiConnectionError: Exception for connection failures

Follows the singleton pattern from storage/neo4j_client.py for consistency.

Note (E12.9): group_id uses composite format "{organization_id}:{deal_id}" to ensure
complete namespace isolation between organizations. This prevents cross-org access
even if an attacker knows a deal_id from another organization.
"""

from datetime import datetime, timezone
from typing import Optional

import structlog
from pydantic import BaseModel
from graphiti_core import Graphiti
from graphiti_core.cross_encoder.gemini_reranker_client import GeminiRerankerClient
from graphiti_core.embedder.gemini import GeminiEmbedder, GeminiEmbedderConfig
from graphiti_core.embedder.voyage import VoyageAIEmbedder, VoyageAIEmbedderConfig
from graphiti_core.graphiti import EpisodeType
from graphiti_core.llm_client import LLMConfig
from graphiti_core.llm_client.gemini_client import GeminiClient
from neo4j.exceptions import AuthError, ServiceUnavailable

from src.config import get_settings

logger = structlog.get_logger(__name__)


class GraphitiConnectionError(Exception):
    """Raised when Graphiti/Neo4j connection fails."""

    pass


class GraphitiClient:
    """
    Singleton Graphiti client with organization+deal isolation via group_id.

    Follows existing pattern from storage/neo4j_client.py for consistency.

    Usage:
        # Get instance (creates connection on first call)
        client = await GraphitiClient.get_instance()

        # Add episode with organization+deal isolation (E12.9)
        await GraphitiClient.add_episode(
            deal_id="deal-123",
            organization_id="org-456",  # Required for multi-tenant isolation
            content="Revenue increased 15%...",
            source="financial-report.pdf",
            source_description="Annual financial report"
        )

        # Cleanup on shutdown
        await GraphitiClient.close()

    Note:
        - Graphiti is fully async - all methods must be awaited
        - Episodes within a group_id must be processed sequentially
        - build_indices_and_constraints() is called only on first init
        - group_id = "{organization_id}:{deal_id}" for multi-tenant isolation (E12.9)
    """

    _instance: Optional[Graphiti] = None
    _initialized: bool = False
    _embedding_provider: str = "unknown"  # E10.2: Track which embedder is used

    @classmethod
    async def get_instance(cls) -> Graphiti:
        """
        Get or create Graphiti singleton instance.

        Returns:
            Graphiti: Initialized Graphiti instance

        Raises:
            GraphitiConnectionError: If connection fails

        Note:
            Creates Neo4j driver with 10 connection pool.
            Calls build_indices_and_constraints() on first init.
        """
        if cls._instance is None:
            settings = get_settings()

            # Validate required settings
            if not settings.neo4j_password:
                raise GraphitiConnectionError("NEO4J_PASSWORD not set")
            if not settings.google_api_key:
                raise GraphitiConnectionError(
                    "GOOGLE_API_KEY not set (required for Graphiti LLM entity extraction)"
                )

            try:
                # Configure LLM client for entity extraction (REQUIRED)
                # Graphiti uses LLM to extract entities from episode content
                llm_config = LLMConfig(
                    api_key=settings.google_api_key,
                    model=settings.gemini_flash_model,  # "gemini-2.5-flash"
                )
                llm_client = GeminiClient(config=llm_config)

                # Configure embedder for semantic search (REQUIRED)
                # E10.2: Use VoyageAI embeddings (1024d) for semantic search
                # voyage-3.5: Best general-purpose model, outperforms domain-specific models
                # Falls back to Gemini text-embedding-004 (768d) if Voyage unavailable
                try:
                    if not settings.voyage_api_key:
                        raise ValueError("VOYAGE_API_KEY not set")

                    embedder_config = VoyageAIEmbedderConfig(
                        api_key=settings.voyage_api_key,
                        embedding_model=settings.voyage_embedding_model,
                    )
                    embedder = VoyageAIEmbedder(config=embedder_config)
                    cls._embedding_provider = "voyage"
                    logger.info(
                        "Graphiti embedder initialized",
                        provider="voyage",
                        model=settings.voyage_embedding_model,
                        dimensions=settings.voyage_embedding_dimensions,
                    )
                except Exception as voyage_error:
                    logger.warning(
                        "Voyage embedder unavailable, falling back to Gemini",
                        error=str(voyage_error),
                    )
                    embedder_config = GeminiEmbedderConfig(
                        api_key=settings.google_api_key,
                        embedding_model="text-embedding-004",
                    )
                    embedder = GeminiEmbedder(config=embedder_config)
                    cls._embedding_provider = "gemini_fallback"
                    logger.info(
                        "Graphiti embedder initialized",
                        provider="gemini_fallback",
                        model="text-embedding-004",
                        dimensions=768,
                    )

                # Configure cross-encoder/reranker for search results (REQUIRED)
                # Uses Gemini reranker instead of OpenAI default
                cross_encoder_config = LLMConfig(
                    api_key=settings.google_api_key,
                    model=settings.gemini_flash_model,
                )
                cross_encoder = GeminiRerankerClient(config=cross_encoder_config)

                # Initialize Graphiti with Neo4j credentials
                # Graphiti handles Neo4j driver creation internally
                cls._instance = Graphiti(
                    uri=settings.neo4j_uri,
                    user=settings.neo4j_user,
                    password=settings.neo4j_password,
                    llm_client=llm_client,
                    embedder=embedder,
                    cross_encoder=cross_encoder,
                    max_coroutines=settings.graphiti_semaphore_limit,
                    store_raw_episode_content=True,
                )

                # CRITICAL: Build indices ONCE on first init
                # Note: May fail if indices already exist (idempotent operation)
                if not cls._initialized:
                    try:
                        await cls._instance.build_indices_and_constraints()
                        logger.info("Graphiti indices and constraints created")
                    except Exception as idx_error:
                        # Indices may already exist from previous runs - this is OK
                        if "EquivalentSchemaRuleAlreadyExists" in str(idx_error):
                            logger.info("Graphiti indices already exist, skipping creation")
                        else:
                            raise
                    cls._initialized = True

                logger.info(
                    "Graphiti client initialized",
                    uri=settings.neo4j_uri,
                    user=settings.neo4j_user,
                    semaphore_limit=settings.graphiti_semaphore_limit,
                )

            except ServiceUnavailable as e:
                logger.error("Neo4j service unavailable", error=str(e))
                raise GraphitiConnectionError(
                    f"Neo4j not reachable at {settings.neo4j_uri}: {e}"
                ) from e
            except AuthError as e:
                logger.error("Neo4j authentication failed", error=str(e))
                raise GraphitiConnectionError(f"Neo4j auth failed: {e}") from e
            except Exception as e:
                logger.error("Failed to initialize Graphiti", error=str(e))
                raise GraphitiConnectionError(f"Graphiti init failed: {e}") from e

        return cls._instance

    @classmethod
    async def close(cls) -> None:
        """
        Cleanup resources on shutdown.

        Safe to call multiple times. Resets singleton state.
        """
        if cls._instance:
            try:
                await cls._instance.close()
                logger.info("Graphiti client closed")
            except Exception as e:
                logger.warning("Error closing Graphiti client", error=str(e))
            finally:
                cls._instance = None
                cls._initialized = False

    @classmethod
    async def add_episode(
        cls,
        deal_id: str,
        organization_id: str,  # E12.9: Required for multi-tenant isolation
        content: str,
        name: str,
        source_description: str,
        reference_time: Optional[datetime] = None,
        episode_type: EpisodeType = EpisodeType.text,
        entity_types: Optional[dict[str, type[BaseModel]]] = None,
        edge_types: Optional[dict[str, type[BaseModel]]] = None,
        edge_type_map: Optional[dict[tuple[str, str], list[str]]] = None,
    ) -> None:
        """
        Add an episode with organization+deal isolation and custom entity/edge extraction.

        Args:
            deal_id: Deal UUID for scoping within organization
            organization_id: Organization UUID for namespace isolation (E12.9)
            content: Episode text content (document chunk, Q&A, etc.)
            name: Episode name/identifier (e.g., "financial-report.pdf")
            source_description: Human-readable description of the source
            reference_time: Optional timestamp for the episode (defaults to now)
            episode_type: Type of episode (text, message, json). Defaults to text.
            entity_types: Dict mapping type names to Pydantic models for guided extraction.
                          Defaults to M&A schema (Company, Person, FinancialMetric, etc.)
            edge_types: Dict mapping edge names to Pydantic models for typed relationships.
                        Defaults to M&A schema (WorksFor, SupersedesEdge, etc.)
            edge_type_map: Dict mapping (source_type, target_type) tuples to allowed edges.
                           Defaults to M&A schema edge type map.

        Raises:
            GraphitiConnectionError: If write fails

        Note:
            group_id = "{organization_id}:{deal_id}" ensures:
            - Organization A's data is isolated from Organization B
            - Even if attacker knows deal_id, wrong org_id = no results
            Episodes within a group_id are processed sequentially.
            Entity/edge types enable guided extraction while still allowing
            dynamic discovery of novel entities (AC: #5).
        """
        # Import schema helpers (lazy import to avoid circular dependency)
        from src.graphiti.schema import get_edge_type_map, get_edge_types, get_entity_types

        client = await cls.get_instance()

        # Default reference time to now if not provided
        if reference_time is None:
            reference_time = datetime.now(timezone.utc)

        # Default to M&A schema helpers if not provided (AC: #5 - dynamic discovery still works)
        entity_types = entity_types or get_entity_types()
        edge_types = edge_types or get_edge_types()
        edge_type_map = edge_type_map or get_edge_type_map()

        # E12.9: Composite group_id for organization + deal isolation
        composite_group_id = f"{organization_id}:{deal_id}"

        try:
            await client.add_episode(
                name=name,
                episode_body=content,
                source_description=source_description,
                reference_time=reference_time,
                source=episode_type,  # EpisodeType enum
                group_id=composite_group_id,  # E12.9: Org+deal isolation
                entity_types=entity_types,  # E10.3: Guided extraction
                edge_types=edge_types,  # E10.3: Typed relationships
                edge_type_map=edge_type_map,  # E10.3: Entity pair mappings
            )

            # E10.2: Cost tracking - estimate tokens and cost for embeddings
            # Note: Graphiti batches internally, this is a rough estimate
            settings = get_settings()
            estimated_tokens = len(content) // 4  # ~4 chars per token (rough estimate)
            if cls._embedding_provider == "voyage":
                # voyage-3.5 pricing: $0.06 per 1M tokens
                estimated_cost_usd = estimated_tokens * 0.00000006
                dimensions = settings.voyage_embedding_dimensions
                model = settings.voyage_embedding_model
            else:
                # Gemini text-embedding-004 - generally free tier
                estimated_cost_usd = 0.0
                dimensions = 768
                model = "text-embedding-004"

            logger.info(
                "Graphiti embedding generated",
                provider=cls._embedding_provider,
                model=model,
                texts_count=1,  # Single episode per call
                dimensions=dimensions,
                content_length=len(content),
                estimated_tokens=estimated_tokens,
                estimated_cost_usd=f"${estimated_cost_usd:.6f}",
            )

            logger.debug(
                "Episode added to Graphiti",
                organization_id=organization_id,
                deal_id=deal_id,
                group_id=composite_group_id,
                name=name,
                content_length=len(content),
            )

        except ServiceUnavailable as e:
            logger.error(
                "Neo4j unavailable while adding episode",
                error=str(e),
                deal_id=deal_id,
                name=name,
            )
            raise GraphitiConnectionError(f"Neo4j unavailable: {e}") from e
        except Exception as e:
            logger.error(
                "Failed to add episode",
                error=str(e),
                deal_id=deal_id,
                name=name,
            )
            raise GraphitiConnectionError(f"Failed to add episode: {e}") from e

    @classmethod
    async def search(
        cls,
        deal_id: str,
        organization_id: str,  # E12.9: Required for multi-tenant isolation
        query: str,
        num_results: int = 10,
    ) -> list:
        """
        Search the knowledge graph for a deal with organization scoping.

        Args:
            deal_id: Deal UUID for scoping within organization
            organization_id: Organization UUID for namespace isolation (E12.9)
            query: Natural language search query
            num_results: Maximum number of results to return

        Returns:
            List of search results (entities, facts, relationships)

        Raises:
            GraphitiConnectionError: If search fails

        Note:
            Search is scoped to "{organization_id}:{deal_id}" group_id.
            This ensures cross-organization access is blocked even if
            an attacker knows a deal_id from another organization.
        """
        client = await cls.get_instance()

        # E12.9: Composite group_id for organization + deal isolation
        composite_group_id = f"{organization_id}:{deal_id}"

        try:
            results = await client.search(
                query=query,
                group_ids=[composite_group_id],  # E12.9: Org+deal scoped search
                num_results=num_results,
            )

            # E10.2: Cost tracking for search query embedding
            settings = get_settings()
            estimated_tokens = len(query) // 4
            if cls._embedding_provider == "voyage":
                # voyage-3.5 pricing: $0.06 per 1M tokens
                estimated_cost_usd = estimated_tokens * 0.00000006
                model = settings.voyage_embedding_model
            else:
                estimated_cost_usd = 0.0
                model = "text-embedding-004"

            logger.info(
                "Graphiti search embedding",
                provider=cls._embedding_provider,
                model=model,
                texts_count=1,  # Single query per search
                query_length=len(query),
                estimated_tokens=estimated_tokens,
                estimated_cost_usd=f"${estimated_cost_usd:.6f}",
            )

            logger.debug(
                "Graphiti search completed",
                organization_id=organization_id,
                deal_id=deal_id,
                group_id=composite_group_id,
                query=query[:50],
                num_results=len(results) if results else 0,
            )

            return results if results else []

        except Exception as e:
            logger.error(
                "Graphiti search failed",
                error=str(e),
                deal_id=deal_id,
                query=query[:50],
            )
            raise GraphitiConnectionError(f"Search failed: {e}") from e

    @classmethod
    def reset_for_testing(cls) -> None:
        """
        Reset singleton state for testing.

        WARNING: Only use in tests. Does not properly close connections.
        """
        cls._instance = None
        cls._initialized = False
        cls._embedding_provider = "unknown"
