"""
Fast path chunk embedding job handler.
Story: E12.10 - Fast Path Document Retrieval (AC: #3, #5, #7)

This handler processes embed-chunks jobs from the pg-boss queue:
1. Loads document chunks from database
2. Generates Voyage embeddings in batches
3. Stores ChunkNodes in Neo4j with vector index
4. Does NOT wait for Graphiti extraction (parallel pipeline)

Pipeline trigger:
document-parse → [embed-chunks (fast path) | ingest-graphiti (deep path)]
                      ↓                              ↓
              Immediate query          Knowledge graph extraction
              (~5 seconds)             (~2-3 min/chunk)
"""

import time
from typing import Any, Optional
from uuid import UUID, uuid4

import structlog

from src.config import get_settings
from src.embeddings.voyage_client import get_voyage_client
from src.graphiti.client import GraphitiClient
from src.jobs.queue import Job
from src.storage.supabase_client import SupabaseClient, get_supabase_client
from src.observability.usage import log_feature_usage_to_db

logger = structlog.get_logger(__name__)


# Batch size for Voyage API (max 128 per API call)
EMBEDDING_BATCH_SIZE = 64


class EmbedChunksHandler:
    """
    Handler for embed-chunks jobs (fast path).

    Story: E12.10 - Fast Path Document Retrieval (AC: #3, #5, #7)

    Orchestrates chunk embedding and Neo4j storage:
    Load Chunks → Batch Embed → Store ChunkNodes → Log Success

    Target: Complete within 5 seconds for typical documents.
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
    ):
        self.db = db_client or get_supabase_client()
        self.settings = get_settings()

        logger.info("EmbedChunksHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an embed-chunks job.

        Args:
            job: The job to process

        Returns:
            Result dict with success status and metrics
        """
        start_time = time.perf_counter()
        job_data = job.data

        document_id = UUID(job_data["document_id"])
        deal_id = job_data.get("deal_id")
        organization_id = job_data.get("organization_id")
        user_id = job_data.get("user_id")

        logger.info(
            "Processing embed-chunks job (fast path)",
            job_id=job.id,
            document_id=str(document_id),
            deal_id=deal_id,
        )

        try:
            # Load chunks from database
            chunks = await self.db.get_chunks_by_document(document_id)

            if not chunks:
                logger.warning(
                    "No chunks found for document - skipping fast path",
                    document_id=str(document_id),
                )
                return {
                    "success": True,
                    "document_id": str(document_id),
                    "chunks_embedded": 0,
                    "reason": "no_chunks",
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                }

            # Fetch organization_id from deal if not in payload
            if not organization_id and deal_id:
                deal = await self.db.get_deal(UUID(deal_id))
                if deal:
                    organization_id = str(deal.get("organization_id", ""))

            if not organization_id:
                raise ValueError(
                    f"organization_id required for chunk embedding (deal_id={deal_id})"
                )

            # E12.9: Composite group_id for multi-tenant isolation
            group_id = f"{organization_id}_{deal_id}"

            # Extract content for embedding
            contents = [chunk["content"] for chunk in chunks]

            # Generate embeddings in batches
            embed_start = time.perf_counter()
            voyage_client = get_voyage_client()

            all_embeddings: list[list[float]] = []
            for i in range(0, len(contents), EMBEDDING_BATCH_SIZE):
                batch = contents[i : i + EMBEDDING_BATCH_SIZE]
                batch_embeddings = await voyage_client.embed_batch(
                    batch, input_type="document"
                )
                all_embeddings.extend(batch_embeddings)

            embed_time_ms = int((time.perf_counter() - embed_start) * 1000)

            # Store ChunkNodes in Neo4j
            store_start = time.perf_counter()
            await self._store_chunk_nodes(
                chunks=chunks,
                embeddings=all_embeddings,
                document_id=document_id,
                deal_id=deal_id,
                organization_id=organization_id,
                group_id=group_id,
            )
            store_time_ms = int((time.perf_counter() - store_start) * 1000)

            total_time_ms = int((time.perf_counter() - start_time) * 1000)

            # Log success
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id),
                deal_id=UUID(deal_id) if deal_id else None,
                user_id=UUID(user_id) if user_id else None,
                feature_name="fast_path_embedding",
                status="success",
                duration_ms=total_time_ms,
                metadata={
                    "document_id": str(document_id),
                    "chunks_embedded": len(chunks),
                    "embed_time_ms": embed_time_ms,
                    "store_time_ms": store_time_ms,
                },
            )

            result = {
                "success": True,
                "document_id": str(document_id),
                "chunks_embedded": len(chunks),
                "embed_time_ms": embed_time_ms,
                "store_time_ms": store_time_ms,
                "total_time_ms": total_time_ms,
            }

            logger.info(
                "embed-chunks job completed (fast path ready)",
                job_id=job.id,
                **result,
            )

            # Warn if exceeds 5 second target
            if total_time_ms > 5000:
                logger.warning(
                    "Fast path exceeded target latency",
                    total_time_ms=total_time_ms,
                    target_ms=5000,
                )

            return result

        except Exception as e:
            total_time_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error(
                "embed-chunks job failed",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                exc_info=True,
            )

            # Log failure
            try:
                await log_feature_usage_to_db(
                    self.db,
                    organization_id=UUID(organization_id) if organization_id else None,
                    deal_id=UUID(deal_id) if deal_id else None,
                    user_id=UUID(user_id) if user_id else None,
                    feature_name="fast_path_embedding",
                    status="error",
                    duration_ms=total_time_ms,
                    error_message=str(e),
                )
            except Exception as log_error:
                logger.warning("Failed to log error to feature_usage", error=str(log_error))

            raise

    async def _store_chunk_nodes(
        self,
        chunks: list[dict[str, Any]],
        embeddings: list[list[float]],
        document_id: UUID,
        deal_id: str,
        organization_id: str,
        group_id: str,
    ) -> None:
        """
        Store ChunkNodes in Neo4j with embeddings.

        Uses UNWIND for batch insert (single network call) and
        MERGE for idempotency on retry. Wrapped in transaction
        for atomicity - all chunks succeed or none do.
        """
        graphiti_client = await GraphitiClient.get_instance()
        driver = graphiti_client.driver

        # Prepare batch data for UNWIND
        batch_data = []
        for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
            chunk_id = chunk.get("id") or str(uuid4())
            batch_data.append({
                "id": str(chunk_id),
                "content": chunk["content"],
                "embedding": embedding,
                "document_id": str(document_id),
                "deal_id": deal_id,
                "organization_id": organization_id,
                "group_id": group_id,
                "chunk_index": chunk.get("chunk_index", i),
                "page_number": chunk.get("page_number"),
                "chunk_type": chunk.get("chunk_type", "text"),
                "token_count": chunk.get("token_count", len(chunk["content"]) // 4),
            })

        # Single batched insert with transaction for atomicity
        async with driver.session() as session:
            async with session.begin_transaction() as tx:
                await tx.run(
                    """
                    UNWIND $chunks AS chunk
                    MERGE (c:Chunk {id: chunk.id})
                    SET c.content = chunk.content,
                        c.embedding = chunk.embedding,
                        c.document_id = chunk.document_id,
                        c.deal_id = chunk.deal_id,
                        c.organization_id = chunk.organization_id,
                        c.group_id = chunk.group_id,
                        c.chunk_index = chunk.chunk_index,
                        c.page_number = chunk.page_number,
                        c.chunk_type = chunk.chunk_type,
                        c.token_count = chunk.token_count,
                        c.created_at = datetime()
                    """,
                    chunks=batch_data,
                )
                await tx.commit()


# Handler instance factory
_handler: Optional[EmbedChunksHandler] = None


def get_embed_chunks_handler() -> EmbedChunksHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = EmbedChunksHandler()
    return _handler


async def handle_embed_chunks(job: Job) -> dict[str, Any]:
    """Entry point for embed-chunks job handling."""
    handler = get_embed_chunks_handler()
    return await handler.handle(job)


__all__ = [
    "EmbedChunksHandler",
    "handle_embed_chunks",
    "get_embed_chunks_handler",
]
