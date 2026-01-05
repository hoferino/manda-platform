"""
Supabase client for database operations.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #4)

This module provides async database operations for:
- Storing parsed document chunks
- Updating document processing status
- Transactional operations for data consistency
"""

import json
from typing import Any, Optional
from uuid import UUID

import asyncpg
import structlog

from src.config import Settings, get_settings
from src.jobs.queue import get_pool
from src.parsers import ChunkData, TableData, FormulaData
from src.models.financial_metrics import FinancialMetricCreate

logger = structlog.get_logger(__name__)


class DatabaseError(Exception):
    """Base exception for database errors."""

    def __init__(self, message: str, retryable: bool = True):
        self.message = message
        self.retryable = retryable
        super().__init__(message)


class SupabaseClient:
    """
    Supabase/PostgreSQL client for document storage operations.

    Uses asyncpg for direct database access, supporting:
    - Chunk storage with transactional guarantees
    - Document status updates
    - Batch operations
    """

    def __init__(self, config: Optional[Settings] = None):
        """
        Initialize the Supabase client.

        Args:
            config: Application settings (uses defaults if not provided)
        """
        self.config = config or get_settings()

        logger.info("SupabaseClient initialized")

    async def _get_pool(self) -> asyncpg.Pool:
        """Get the database connection pool."""
        return await get_pool()

    async def store_chunks(
        self,
        document_id: UUID,
        chunks: list[ChunkData],
        tables: Optional[list[TableData]] = None,
        formulas: Optional[list[FormulaData]] = None,
    ) -> int:
        """
        Store parsed chunks in the database with transactional guarantees.

        Args:
            document_id: UUID of the parent document
            chunks: List of ChunkData to store
            tables: Optional list of TableData (stored as chunks with type 'table')
            formulas: Optional list of FormulaData (stored as chunks with type 'formula')

        Returns:
            Number of chunks stored

        Raises:
            DatabaseError: If storage fails
        """
        pool = await self._get_pool()

        logger.info(
            "Storing document chunks",
            document_id=str(document_id),
            chunk_count=len(chunks),
            table_count=len(tables) if tables else 0,
            formula_count=len(formulas) if formulas else 0,
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    # Clear existing chunks for this document (upsert behavior)
                    await conn.execute(
                        """
                        DELETE FROM document_chunks WHERE document_id = $1
                        """,
                        document_id,
                    )

                    # Insert all chunks
                    stored_count = 0

                    for chunk in chunks:
                        await conn.execute(
                            """
                            INSERT INTO document_chunks (
                                document_id, chunk_index, content, chunk_type,
                                page_number, sheet_name, cell_reference,
                                token_count, metadata
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9
                            )
                            """,
                            document_id,
                            chunk.chunk_index,
                            chunk.content,
                            chunk.chunk_type,
                            chunk.page_number,
                            chunk.sheet_name,
                            chunk.cell_reference,
                            chunk.token_count,
                            json.dumps(chunk.metadata),
                        )
                        stored_count += 1

                    logger.info(
                        "Chunks stored successfully",
                        document_id=str(document_id),
                        stored_count=stored_count,
                    )

                    return stored_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error storing chunks",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to store chunks: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def update_document_status(
        self,
        document_id: UUID,
        processing_status: str,
        error_message: Optional[str] = None,
    ) -> bool:
        """
        Update the processing status of a document.

        Args:
            document_id: UUID of the document
            processing_status: New status (pending, processing, parsed, completed, failed)
            error_message: Optional error message for failed status

        Returns:
            True if update succeeded

        Raises:
            DatabaseError: If update fails
        """
        pool = await self._get_pool()

        logger.info(
            "Updating document status",
            document_id=str(document_id),
            status=processing_status,
        )

        try:
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """
                    UPDATE documents
                    SET processing_status = $2,
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    document_id,
                    processing_status,
                )

                # Check if update affected any rows
                rows_affected = int(result.split()[-1])
                if rows_affected == 0:
                    logger.warning(
                        "No document found to update",
                        document_id=str(document_id),
                    )
                    return False

                logger.info(
                    "Document status updated",
                    document_id=str(document_id),
                    status=processing_status,
                )

                return True

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error updating document status",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to update document status: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_document(self, document_id: UUID) -> Optional[dict[str, Any]]:
        """
        Get document details by ID.

        Args:
            document_id: UUID of the document

        Returns:
            Document record as dict, or None if not found
        """
        pool = await self._get_pool()

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, deal_id, user_id, name, file_path,
                           file_size, mime_type, upload_status, processing_status,
                           gcs_bucket, gcs_object_path, folder_path, created_at, updated_at
                    FROM documents
                    WHERE id = $1
                    """,
                    document_id,
                )

                if row:
                    return dict(row)
                return None

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error fetching document",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to fetch document: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_deal(self, deal_id: str) -> Optional[dict[str, Any]]:
        """
        Get deal details by ID.

        Story: E12.9 - Multi-Tenant Data Isolation

        Args:
            deal_id: UUID string of the deal

        Returns:
            Deal record as dict, or None if not found
        """
        pool = await self._get_pool()

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, user_id, organization_id, name, company_name,
                           industry, status, irl_template, metadata,
                           created_at, updated_at
                    FROM deals
                    WHERE id = $1
                    """,
                    UUID(deal_id),
                )

                if row:
                    return dict(row)
                return None

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error fetching deal",
                deal_id=deal_id,
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to fetch deal: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def store_chunks_and_update_status(
        self,
        document_id: UUID,
        chunks: list[ChunkData],
        tables: Optional[list[TableData]] = None,
        formulas: Optional[list[FormulaData]] = None,
        new_status: str = "parsed",
    ) -> int:
        """
        Store chunks and update document status in a single transaction.

        This ensures atomicity - either both operations succeed or neither does.

        Args:
            document_id: UUID of the parent document
            chunks: List of ChunkData to store
            tables: Optional list of TableData
            formulas: Optional list of FormulaData
            new_status: Status to set after successful storage

        Returns:
            Number of chunks stored

        Raises:
            DatabaseError: If any operation fails (transaction rolls back)
        """
        pool = await self._get_pool()

        logger.info(
            "Storing chunks and updating status (transactional)",
            document_id=str(document_id),
            chunk_count=len(chunks),
            new_status=new_status,
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    # Clear existing chunks
                    await conn.execute(
                        """
                        DELETE FROM document_chunks WHERE document_id = $1
                        """,
                        document_id,
                    )

                    # Insert all chunks
                    stored_count = 0

                    for chunk in chunks:
                        await conn.execute(
                            """
                            INSERT INTO document_chunks (
                                document_id, chunk_index, content, chunk_type,
                                page_number, sheet_name, cell_reference,
                                token_count, metadata
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9
                            )
                            """,
                            document_id,
                            chunk.chunk_index,
                            chunk.content,
                            chunk.chunk_type,
                            chunk.page_number,
                            chunk.sheet_name,
                            chunk.cell_reference,
                            chunk.token_count,
                            json.dumps(chunk.metadata),
                        )
                        stored_count += 1

                    # Update document status
                    await conn.execute(
                        """
                        UPDATE documents
                        SET processing_status = $2,
                            updated_at = NOW()
                        WHERE id = $1
                        """,
                        document_id,
                        new_status,
                    )

                    logger.info(
                        "Chunks stored and status updated",
                        document_id=str(document_id),
                        stored_count=stored_count,
                        new_status=new_status,
                    )

                    return stored_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error in transactional storage",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to store chunks and update status: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_chunks_by_document(
        self,
        document_id: UUID,
    ) -> list[dict[str, Any]]:
        """
        Get all chunks for a document.

        Story: E3.4 - Generate Embeddings for Semantic Search (AC: #1)

        Args:
            document_id: UUID of the document

        Returns:
            List of chunk records as dicts with id, content, chunk_index, etc.

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        logger.info(
            "Fetching chunks for document",
            document_id=str(document_id),
        )

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, document_id, chunk_index, content, chunk_type,
                           page_number, sheet_name, cell_reference, token_count,
                           metadata
                    FROM document_chunks
                    WHERE document_id = $1
                    ORDER BY chunk_index ASC
                    """,
                    document_id,
                )

                chunks = [dict(row) for row in rows]

                logger.info(
                    "Chunks fetched successfully",
                    document_id=str(document_id),
                    chunk_count=len(chunks),
                )

                return chunks

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error fetching chunks",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to fetch chunks: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def update_chunk_embeddings(
        self,
        document_id: UUID,
        chunk_ids: list[UUID],
        embeddings: list[list[float]],
    ) -> int:
        """
        Update embeddings for multiple chunks in a single transaction.

        Story: E3.4 - Generate Embeddings for Semantic Search (AC: #3)

        All embeddings for a document are updated together to ensure consistency.
        Uses pgvector format for embedding storage.

        Args:
            document_id: UUID of the document (for verification)
            chunk_ids: List of chunk UUIDs to update
            embeddings: List of embedding vectors (must match chunk_ids length)

        Returns:
            Number of chunks updated

        Raises:
            DatabaseError: If update fails (transaction rolls back)
            ValueError: If chunk_ids and embeddings lengths don't match
        """
        if len(chunk_ids) != len(embeddings):
            raise ValueError(
                f"chunk_ids and embeddings must have same length: "
                f"{len(chunk_ids)} vs {len(embeddings)}"
            )

        if not chunk_ids:
            return 0

        pool = await self._get_pool()

        logger.info(
            "Updating chunk embeddings",
            document_id=str(document_id),
            chunk_count=len(chunk_ids),
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    updated_count = 0

                    for chunk_id, embedding in zip(chunk_ids, embeddings):
                        # Skip empty embeddings (from failed batches)
                        if not embedding:
                            continue

                        # Convert list to pgvector format string
                        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

                        result = await conn.execute(
                            """
                            UPDATE document_chunks
                            SET embedding = $1::vector
                            WHERE id = $2 AND document_id = $3
                            """,
                            embedding_str,
                            chunk_id,
                            document_id,
                        )

                        rows_affected = int(result.split()[-1])
                        updated_count += rows_affected

                    logger.info(
                        "Chunk embeddings updated successfully",
                        document_id=str(document_id),
                        updated_count=updated_count,
                    )

                    return updated_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error updating embeddings",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to update embeddings: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def update_embeddings_and_status(
        self,
        document_id: UUID,
        chunk_ids: list[UUID],
        embeddings: list[list[float]],
        new_status: str = "embedded",
    ) -> int:
        """
        Update embeddings and document status in a single transaction.

        Story: E3.4 - Generate Embeddings for Semantic Search (AC: #3, #5)

        Ensures atomicity - either all embeddings are stored and status updated,
        or nothing changes.

        Args:
            document_id: UUID of the document
            chunk_ids: List of chunk UUIDs to update
            embeddings: List of embedding vectors
            new_status: New document status (default: "embedded")

        Returns:
            Number of chunks updated

        Raises:
            DatabaseError: If any operation fails (transaction rolls back)
        """
        if len(chunk_ids) != len(embeddings):
            raise ValueError(
                f"chunk_ids and embeddings must have same length: "
                f"{len(chunk_ids)} vs {len(embeddings)}"
            )

        pool = await self._get_pool()

        logger.info(
            "Updating embeddings and status (transactional)",
            document_id=str(document_id),
            chunk_count=len(chunk_ids),
            new_status=new_status,
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    updated_count = 0

                    for chunk_id, embedding in zip(chunk_ids, embeddings):
                        if not embedding:
                            continue

                        embedding_str = "[" + ",".join(str(x) for x in embedding) + "]"

                        result = await conn.execute(
                            """
                            UPDATE document_chunks
                            SET embedding = $1::vector
                            WHERE id = $2 AND document_id = $3
                            """,
                            embedding_str,
                            chunk_id,
                            document_id,
                        )

                        rows_affected = int(result.split()[-1])
                        updated_count += rows_affected

                    # Update document status
                    await conn.execute(
                        """
                        UPDATE documents
                        SET processing_status = $2,
                            updated_at = NOW()
                        WHERE id = $1
                        """,
                        document_id,
                        new_status,
                    )

                    logger.info(
                        "Embeddings and status updated",
                        document_id=str(document_id),
                        updated_count=updated_count,
                        new_status=new_status,
                    )

                    return updated_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error in transactional embedding update",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to update embeddings and status: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def search_similar_chunks(
        self,
        query_embedding: list[float],
        project_id: Optional[UUID] = None,
        document_id: Optional[UUID] = None,
        limit: int = 10,
    ) -> list[dict[str, Any]]:
        """
        Search for similar chunks using vector similarity.

        Story: E3.4 - Generate Embeddings for Semantic Search (AC: #4)

        Uses pgvector cosine distance operator (<=>)for similarity search.
        Similarity = 1 - distance (higher is more similar).

        Args:
            query_embedding: Query vector (3072 dimensions)
            project_id: Optional filter by project
            document_id: Optional filter by specific document
            limit: Maximum results to return (default: 10)

        Returns:
            List of chunks with similarity scores, ordered by similarity desc

        Raises:
            DatabaseError: If search fails
        """
        pool = await self._get_pool()

        # Convert embedding to pgvector format
        embedding_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

        logger.info(
            "Searching similar chunks",
            project_id=str(project_id) if project_id else None,
            document_id=str(document_id) if document_id else None,
            limit=limit,
        )

        try:
            async with pool.acquire() as conn:
                # Build query with optional filters
                query = """
                    SELECT
                        dc.id as chunk_id,
                        dc.document_id,
                        dc.content,
                        dc.chunk_type,
                        dc.page_number,
                        dc.chunk_index,
                        d.name as document_name,
                        d.deal_id as project_id,
                        1 - (dc.embedding <=> $1::vector) as similarity
                    FROM document_chunks dc
                    JOIN documents d ON dc.document_id = d.id
                    WHERE dc.embedding IS NOT NULL
                """

                params: list[Any] = [embedding_str]
                param_idx = 2

                if project_id:
                    query += f" AND d.deal_id = ${param_idx}"
                    params.append(project_id)
                    param_idx += 1

                if document_id:
                    query += f" AND dc.document_id = ${param_idx}"
                    params.append(document_id)
                    param_idx += 1

                query += f"""
                    ORDER BY dc.embedding <=> $1::vector
                    LIMIT ${param_idx}
                """
                params.append(limit)

                rows = await conn.fetch(query, *params)

                results = [dict(row) for row in rows]

                logger.info(
                    "Similar chunks found",
                    result_count=len(results),
                )

                return results

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error in similarity search",
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to search similar chunks: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_document_with_project(
        self,
        document_id: UUID,
    ) -> Optional[dict[str, Any]]:
        """
        Get document details including project_id (deal_id).

        Story: E3.5 - Implement LLM Analysis (AC: #4)

        Args:
            document_id: UUID of the document

        Returns:
            Document record as dict with project info, or None if not found
        """
        pool = await self._get_pool()

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT d.id, d.deal_id as project_id, d.user_id, d.name,
                           d.file_path, d.file_size, d.mime_type, d.upload_status,
                           d.processing_status, d.gcs_bucket, d.gcs_object_path,
                           d.folder_path, d.created_at, d.updated_at,
                           p.name as project_name
                    FROM documents d
                    LEFT JOIN deals p ON d.deal_id = p.id
                    WHERE d.id = $1
                    """,
                    document_id,
                )

                if row:
                    return dict(row)
                return None

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error fetching document with project",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to fetch document: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def store_findings(
        self,
        document_id: UUID,
        project_id: UUID,
        user_id: Optional[UUID],
        findings: list,
    ) -> int:
        """
        Store extracted findings in the database.

        Story: E3.5 - Implement LLM Analysis (AC: #4)

        Args:
            document_id: UUID of the source document
            project_id: UUID of the parent project (deal_id)
            user_id: UUID of the user who owns this (optional)
            findings: List of FindingCreate models to store

        Returns:
            Number of findings stored

        Raises:
            DatabaseError: If storage fails
        """
        if not findings:
            return 0

        pool = await self._get_pool()

        logger.info(
            "Storing findings",
            document_id=str(document_id),
            project_id=str(project_id),
            finding_count=len(findings),
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    stored_count = 0

                    for finding in findings:
                        # Convert Pydantic model to dict if needed
                        if hasattr(finding, "model_dump"):
                            finding_dict = finding.model_dump()
                        else:
                            finding_dict = finding

                        # Build source_reference JSON
                        source_ref = finding_dict.get("source_reference", {})
                        if hasattr(source_ref, "model_dump"):
                            source_ref = source_ref.model_dump()

                        await conn.execute(
                            """
                            INSERT INTO findings (
                                deal_id, document_id, user_id, text,
                                source_document, page_number, confidence,
                                chunk_id, finding_type, domain, metadata
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                            )
                            """,
                            project_id,
                            document_id,
                            user_id,
                            finding_dict.get("content", ""),
                            None,  # source_document - we use document_id FK instead
                            source_ref.get("page") if source_ref else None,
                            finding_dict.get("confidence_score", 70) / 100.0,  # Store as 0-1
                            finding_dict.get("chunk_id"),
                            finding_dict.get("finding_type", "fact"),
                            finding_dict.get("domain", "operational"),
                            json.dumps({
                                "source_reference": source_ref,
                                **finding_dict.get("metadata", {}),
                            }),
                        )
                        stored_count += 1

                    logger.info(
                        "Findings stored successfully",
                        document_id=str(document_id),
                        stored_count=stored_count,
                    )

                    return stored_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error storing findings",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to store findings: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def store_findings_and_update_status(
        self,
        document_id: UUID,
        project_id: UUID,
        user_id: Optional[UUID],
        findings: list,
        new_status: str = "analyzed",
    ) -> int:
        """
        Store findings and update document status in a single transaction.

        Story: E3.5 - Implement LLM Analysis (AC: #4)

        Ensures atomicity - either all findings stored and status updated,
        or nothing changes.

        Args:
            document_id: UUID of the source document
            project_id: UUID of the parent project
            user_id: UUID of the user
            findings: List of FindingCreate models to store
            new_status: New document status (default: "analyzed")

        Returns:
            Number of findings stored

        Raises:
            DatabaseError: If any operation fails (transaction rolls back)
        """
        pool = await self._get_pool()

        logger.info(
            "Storing findings and updating status (transactional)",
            document_id=str(document_id),
            finding_count=len(findings),
            new_status=new_status,
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    stored_count = 0

                    for finding in findings:
                        # Convert Pydantic model to dict if needed
                        if hasattr(finding, "model_dump"):
                            finding_dict = finding.model_dump()
                        else:
                            finding_dict = finding

                        # Build source_reference JSON
                        source_ref = finding_dict.get("source_reference", {})
                        if hasattr(source_ref, "model_dump"):
                            source_ref = source_ref.model_dump()

                        await conn.execute(
                            """
                            INSERT INTO findings (
                                deal_id, document_id, user_id, text,
                                source_document, page_number, confidence,
                                chunk_id, finding_type, domain, metadata
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
                            )
                            """,
                            project_id,
                            document_id,
                            user_id,
                            finding_dict.get("content", ""),
                            None,
                            source_ref.get("page") if source_ref else None,
                            finding_dict.get("confidence_score", 70) / 100.0,
                            finding_dict.get("chunk_id"),
                            finding_dict.get("finding_type", "fact"),
                            finding_dict.get("domain", "operational"),
                            json.dumps({
                                "source_reference": source_ref,
                                **finding_dict.get("metadata", {}),
                            }),
                        )
                        stored_count += 1

                    # Update document status
                    await conn.execute(
                        """
                        UPDATE documents
                        SET processing_status = $2,
                            updated_at = NOW()
                        WHERE id = $1
                        """,
                        document_id,
                        new_status,
                    )

                    logger.info(
                        "Findings stored and status updated",
                        document_id=str(document_id),
                        stored_count=stored_count,
                        new_status=new_status,
                    )

                    return stored_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error in transactional findings storage",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to store findings and update status: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    # ==========================================================================
    # Financial Metrics Methods (Story E3.9)
    # ==========================================================================

    async def store_financial_metrics(
        self,
        document_id: UUID,
        metrics: list[FinancialMetricCreate],
    ) -> int:
        """
        Store extracted financial metrics in the database.

        Story: E3.9 - Financial Model Integration (AC: #1, #3)

        Args:
            document_id: UUID of the source document
            metrics: List of FinancialMetricCreate models to store

        Returns:
            Number of metrics stored

        Raises:
            DatabaseError: If storage fails
        """
        if not metrics:
            return 0

        pool = await self._get_pool()

        logger.info(
            "Storing financial metrics",
            document_id=str(document_id),
            metrics_count=len(metrics),
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    stored_count = 0

                    for metric in metrics:
                        # Convert Pydantic model to dict
                        metric_dict = metric.model_dump() if hasattr(metric, "model_dump") else metric

                        await conn.execute(
                            """
                            INSERT INTO financial_metrics (
                                document_id, finding_id, metric_name, metric_category,
                                value, unit, period_type, period_start, period_end,
                                fiscal_year, fiscal_quarter, source_cell, source_sheet,
                                source_page, source_table_index, source_formula,
                                is_actual, confidence_score, notes, metadata
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
                            )
                            """,
                            document_id,
                            metric_dict.get("finding_id"),
                            metric_dict.get("metric_name"),
                            metric_dict.get("metric_category"),
                            metric_dict.get("value"),
                            metric_dict.get("unit"),
                            metric_dict.get("period_type"),
                            metric_dict.get("period_start"),
                            metric_dict.get("period_end"),
                            metric_dict.get("fiscal_year"),
                            metric_dict.get("fiscal_quarter"),
                            metric_dict.get("source_cell"),
                            metric_dict.get("source_sheet"),
                            metric_dict.get("source_page"),
                            metric_dict.get("source_table_index"),
                            metric_dict.get("source_formula"),
                            metric_dict.get("is_actual", True),
                            metric_dict.get("confidence_score"),
                            metric_dict.get("notes"),
                            json.dumps(metric_dict.get("metadata", {})),
                        )
                        stored_count += 1

                    logger.info(
                        "Financial metrics stored successfully",
                        document_id=str(document_id),
                        stored_count=stored_count,
                    )

                    return stored_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error storing financial metrics",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to store financial metrics: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def store_financial_metrics_and_update_status(
        self,
        document_id: UUID,
        metrics: list[FinancialMetricCreate],
        new_status: str = "complete",
    ) -> int:
        """
        Store financial metrics and update document status in a single transaction.

        Story: E3.9 - Financial Model Integration (AC: #6)

        Args:
            document_id: UUID of the source document
            metrics: List of FinancialMetricCreate models to store
            new_status: New document status (default: "complete")

        Returns:
            Number of metrics stored

        Raises:
            DatabaseError: If any operation fails (transaction rolls back)
        """
        pool = await self._get_pool()

        logger.info(
            "Storing financial metrics and updating status (transactional)",
            document_id=str(document_id),
            metrics_count=len(metrics),
            new_status=new_status,
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    stored_count = 0

                    for metric in metrics:
                        metric_dict = metric.model_dump() if hasattr(metric, "model_dump") else metric

                        await conn.execute(
                            """
                            INSERT INTO financial_metrics (
                                document_id, finding_id, metric_name, metric_category,
                                value, unit, period_type, period_start, period_end,
                                fiscal_year, fiscal_quarter, source_cell, source_sheet,
                                source_page, source_table_index, source_formula,
                                is_actual, confidence_score, notes, metadata
                            ) VALUES (
                                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                                $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
                            )
                            """,
                            document_id,
                            metric_dict.get("finding_id"),
                            metric_dict.get("metric_name"),
                            metric_dict.get("metric_category"),
                            metric_dict.get("value"),
                            metric_dict.get("unit"),
                            metric_dict.get("period_type"),
                            metric_dict.get("period_start"),
                            metric_dict.get("period_end"),
                            metric_dict.get("fiscal_year"),
                            metric_dict.get("fiscal_quarter"),
                            metric_dict.get("source_cell"),
                            metric_dict.get("source_sheet"),
                            metric_dict.get("source_page"),
                            metric_dict.get("source_table_index"),
                            metric_dict.get("source_formula"),
                            metric_dict.get("is_actual", True),
                            metric_dict.get("confidence_score"),
                            metric_dict.get("notes"),
                            json.dumps(metric_dict.get("metadata", {})),
                        )
                        stored_count += 1

                    # Update document status
                    await conn.execute(
                        """
                        UPDATE documents
                        SET processing_status = $2,
                            updated_at = NOW()
                        WHERE id = $1
                        """,
                        document_id,
                        new_status,
                    )

                    logger.info(
                        "Financial metrics stored and status updated",
                        document_id=str(document_id),
                        stored_count=stored_count,
                        new_status=new_status,
                    )

                    return stored_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error in transactional financial metrics storage",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to store financial metrics and update status: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_financial_metrics(
        self,
        document_id: UUID,
    ) -> list[dict[str, Any]]:
        """
        Get all financial metrics for a document.

        Story: E3.9 - Financial Model Integration (AC: #5)

        Args:
            document_id: UUID of the document

        Returns:
            List of financial metric records as dicts

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        logger.info(
            "Fetching financial metrics for document",
            document_id=str(document_id),
        )

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, document_id, finding_id, metric_name, metric_category,
                           value, unit, period_type, period_start, period_end,
                           fiscal_year, fiscal_quarter, source_cell, source_sheet,
                           source_page, source_table_index, source_formula,
                           is_actual, confidence_score, notes, metadata,
                           created_at, updated_at
                    FROM financial_metrics
                    WHERE document_id = $1
                    ORDER BY metric_category, metric_name, fiscal_year DESC
                    """,
                    document_id,
                )

                metrics = [dict(row) for row in rows]

                logger.info(
                    "Financial metrics fetched successfully",
                    document_id=str(document_id),
                    metrics_count=len(metrics),
                )

                return metrics

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error fetching financial metrics",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to fetch financial metrics: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def query_financial_metrics(
        self,
        project_id: Optional[UUID] = None,
        document_id: Optional[UUID] = None,
        metric_name: Optional[str] = None,
        metric_category: Optional[str] = None,
        fiscal_year: Optional[int] = None,
        is_actual: Optional[bool] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> tuple[list[dict[str, Any]], int]:
        """
        Query financial metrics with filters.

        Story: E3.9 - Financial Model Integration (AC: #5)

        Args:
            project_id: Optional filter by project
            document_id: Optional filter by document
            metric_name: Optional filter by metric name
            metric_category: Optional filter by category
            fiscal_year: Optional filter by fiscal year
            is_actual: Optional filter by actual vs projection
            limit: Maximum results (default 100)
            offset: Pagination offset (default 0)

        Returns:
            Tuple of (list of metrics, total count)

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        logger.info(
            "Querying financial metrics",
            project_id=str(project_id) if project_id else None,
            document_id=str(document_id) if document_id else None,
            metric_name=metric_name,
            metric_category=metric_category,
            fiscal_year=fiscal_year,
            is_actual=is_actual,
            limit=limit,
            offset=offset,
        )

        try:
            async with pool.acquire() as conn:
                # Build query with filters
                base_query = """
                    FROM financial_metrics fm
                    JOIN documents d ON fm.document_id = d.id
                    WHERE 1=1
                """
                params: list[Any] = []
                param_idx = 1

                if project_id:
                    base_query += f" AND d.deal_id = ${param_idx}"
                    params.append(project_id)
                    param_idx += 1

                if document_id:
                    base_query += f" AND fm.document_id = ${param_idx}"
                    params.append(document_id)
                    param_idx += 1

                if metric_name:
                    base_query += f" AND fm.metric_name ILIKE ${param_idx}"
                    params.append(f"%{metric_name}%")
                    param_idx += 1

                if metric_category:
                    base_query += f" AND fm.metric_category = ${param_idx}"
                    params.append(metric_category)
                    param_idx += 1

                if fiscal_year is not None:
                    base_query += f" AND fm.fiscal_year = ${param_idx}"
                    params.append(fiscal_year)
                    param_idx += 1

                if is_actual is not None:
                    base_query += f" AND fm.is_actual = ${param_idx}"
                    params.append(is_actual)
                    param_idx += 1

                # Get total count
                count_query = f"SELECT COUNT(*) {base_query}"
                total_count = await conn.fetchval(count_query, *params)

                # Get paginated results
                select_query = f"""
                    SELECT fm.id, fm.document_id, fm.finding_id, fm.metric_name,
                           fm.metric_category, fm.value, fm.unit, fm.period_type,
                           fm.period_start, fm.period_end, fm.fiscal_year,
                           fm.fiscal_quarter, fm.source_cell, fm.source_sheet,
                           fm.source_page, fm.source_formula, fm.is_actual,
                           fm.confidence_score, fm.notes, fm.created_at,
                           d.name as document_name, d.deal_id as project_id
                    {base_query}
                    ORDER BY fm.metric_category, fm.metric_name, fm.fiscal_year DESC
                    LIMIT ${param_idx} OFFSET ${param_idx + 1}
                """
                params.extend([limit, offset])

                rows = await conn.fetch(select_query, *params)
                metrics = [dict(row) for row in rows]

                logger.info(
                    "Financial metrics query completed",
                    result_count=len(metrics),
                    total_count=total_count,
                )

                return metrics, total_count

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error querying financial metrics",
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to query financial metrics: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def delete_financial_metrics(
        self,
        document_id: UUID,
    ) -> int:
        """
        Delete all financial metrics for a document.

        Used for retry/re-extraction scenarios.

        Args:
            document_id: UUID of the document

        Returns:
            Number of metrics deleted

        Raises:
            DatabaseError: If deletion fails
        """
        pool = await self._get_pool()

        logger.info(
            "Deleting financial metrics for document",
            document_id=str(document_id),
        )

        try:
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """
                    DELETE FROM financial_metrics WHERE document_id = $1
                    """,
                    document_id,
                )

                rows_affected = int(result.split()[-1])

                logger.info(
                    "Financial metrics deleted",
                    document_id=str(document_id),
                    deleted_count=rows_affected,
                )

                return rows_affected

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error deleting financial metrics",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to delete financial metrics: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    def _is_retryable_error(self, error: asyncpg.PostgresError) -> bool:
        """Check if a PostgreSQL error is retryable."""
        # Connection errors are retryable
        if isinstance(error, asyncpg.ConnectionDoesNotExistError):
            return True
        if isinstance(error, asyncpg.InterfaceError):
            return True

        # Serialization and deadlock errors are retryable
        error_code = getattr(error, "sqlstate", "")
        retryable_codes = {
            "40001",  # Serialization failure
            "40P01",  # Deadlock detected
            "08000",  # Connection exception
            "08003",  # Connection does not exist
            "08006",  # Connection failure
        }

        return error_code in retryable_codes

    async def update_document_stage(
        self,
        document_id: UUID,
        last_completed_stage: str,
        processing_status: Optional[str] = None,
    ) -> bool:
        """
        Update the last completed processing stage for a document.

        Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #2)

        Args:
            document_id: UUID of the document
            last_completed_stage: Stage that was just completed (parsed, embedded, analyzed, complete)
            processing_status: Optional new processing status

        Returns:
            True if update succeeded

        Raises:
            DatabaseError: If update fails
        """
        pool = await self._get_pool()

        logger.info(
            "Updating document stage",
            document_id=str(document_id),
            last_completed_stage=last_completed_stage,
            processing_status=processing_status,
        )

        try:
            async with pool.acquire() as conn:
                if processing_status:
                    result = await conn.execute(
                        """
                        UPDATE documents
                        SET last_completed_stage = $2,
                            processing_status = $3,
                            updated_at = NOW()
                        WHERE id = $1
                        """,
                        document_id,
                        last_completed_stage,
                        processing_status,
                    )
                else:
                    result = await conn.execute(
                        """
                        UPDATE documents
                        SET last_completed_stage = $2,
                            updated_at = NOW()
                        WHERE id = $1
                        """,
                        document_id,
                        last_completed_stage,
                    )

                rows_affected = int(result.split()[-1])
                if rows_affected == 0:
                    logger.warning(
                        "No document found to update stage",
                        document_id=str(document_id),
                    )
                    return False

                logger.info(
                    "Document stage updated",
                    document_id=str(document_id),
                    last_completed_stage=last_completed_stage,
                )

                return True

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error updating document stage",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to update document stage: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_document_stage(
        self,
        document_id: UUID,
    ) -> Optional[str]:
        """
        Get the last completed processing stage for a document.

        Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #2)

        Args:
            document_id: UUID of the document

        Returns:
            The last completed stage, or None if not set

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT last_completed_stage
                    FROM documents
                    WHERE id = $1
                    """,
                    document_id,
                )

                if row:
                    return row["last_completed_stage"]
                return None

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error getting document stage",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to get document stage: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def append_retry_history(
        self,
        document_id: UUID,
        retry_entry: dict,
        max_entries: int = 10,
    ) -> bool:
        """
        Append a retry attempt to the document's retry history.

        Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #4)

        Args:
            document_id: UUID of the document
            retry_entry: Dict with attempt, stage, error_type, message, timestamp
            max_entries: Maximum number of retry history entries to keep

        Returns:
            True if update succeeded

        Raises:
            DatabaseError: If update fails
        """
        pool = await self._get_pool()

        logger.info(
            "Appending retry history",
            document_id=str(document_id),
            retry_entry=retry_entry,
        )

        try:
            async with pool.acquire() as conn:
                # Append to retry_history and keep only the last max_entries
                result = await conn.execute(
                    """
                    UPDATE documents
                    SET retry_history = (
                        SELECT jsonb_agg(elem)
                        FROM (
                            SELECT elem
                            FROM jsonb_array_elements(
                                COALESCE(retry_history, '[]'::jsonb) || $2::jsonb
                            ) elem
                            ORDER BY elem->>'timestamp' DESC
                            LIMIT $3
                        ) sub
                    ),
                    updated_at = NOW()
                    WHERE id = $1
                    """,
                    document_id,
                    json.dumps([retry_entry]),
                    max_entries,
                )

                rows_affected = int(result.split()[-1])
                if rows_affected == 0:
                    logger.warning(
                        "No document found to append retry history",
                        document_id=str(document_id),
                    )
                    return False

                logger.info(
                    "Retry history appended",
                    document_id=str(document_id),
                )

                return True

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error appending retry history",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to append retry history: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def update_processing_error(
        self,
        document_id: UUID,
        error_info: dict,
    ) -> bool:
        """
        Update the structured processing error for a document.

        Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #4)

        Args:
            document_id: UUID of the document
            error_info: Structured error dict with error_type, category, message, etc.

        Returns:
            True if update succeeded

        Raises:
            DatabaseError: If update fails
        """
        pool = await self._get_pool()

        logger.info(
            "Updating processing error",
            document_id=str(document_id),
            error_type=error_info.get("error_type"),
            category=error_info.get("category"),
        )

        try:
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """
                    UPDATE documents
                    SET processing_error = $2,
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    document_id,
                    json.dumps(error_info),
                )

                rows_affected = int(result.split()[-1])
                if rows_affected == 0:
                    logger.warning(
                        "No document found to update processing error",
                        document_id=str(document_id),
                    )
                    return False

                logger.info(
                    "Processing error updated",
                    document_id=str(document_id),
                )

                return True

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error updating processing error",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to update processing error: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def clear_processing_error(
        self,
        document_id: UUID,
    ) -> bool:
        """
        Clear the processing error for a document (e.g., on successful retry).

        Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #4)

        Args:
            document_id: UUID of the document

        Returns:
            True if update succeeded

        Raises:
            DatabaseError: If update fails
        """
        pool = await self._get_pool()

        try:
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """
                    UPDATE documents
                    SET processing_error = NULL,
                        updated_at = NOW()
                    WHERE id = $1
                    """,
                    document_id,
                )

                rows_affected = int(result.split()[-1])
                return rows_affected > 0

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error clearing processing error",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to clear processing error: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_retry_history(
        self,
        document_id: UUID,
    ) -> list[dict]:
        """
        Get the retry history for a document.

        Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #4)

        Args:
            document_id: UUID of the document

        Returns:
            List of retry history entries

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT retry_history
                    FROM documents
                    WHERE id = $1
                    """,
                    document_id,
                )

                if row and row["retry_history"]:
                    return json.loads(row["retry_history"])
                return []

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error getting retry history",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to get retry history: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def clear_stage_data(
        self,
        document_id: UUID,
        stage: str,
    ) -> bool:
        """
        Clear data from a specific processing stage (for retry).

        Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #2)

        Args:
            document_id: UUID of the document
            stage: Stage to clear data for (parsed, embedded, analyzed)

        Returns:
            True if data was cleared

        Raises:
            DatabaseError: If operation fails
        """
        pool = await self._get_pool()

        logger.info(
            "Clearing stage data for retry",
            document_id=str(document_id),
            stage=stage,
        )

        try:
            async with pool.acquire() as conn:
                async with conn.transaction():
                    if stage == "parsed":
                        # Clear chunks (embeddings will be deleted by CASCADE)
                        await conn.execute(
                            """
                            DELETE FROM document_chunks WHERE document_id = $1
                            """,
                            document_id,
                        )
                        # Also clear findings since they depend on chunks
                        await conn.execute(
                            """
                            DELETE FROM findings WHERE document_id = $1
                            """,
                            document_id,
                        )
                        # Reset stage
                        await conn.execute(
                            """
                            UPDATE documents
                            SET last_completed_stage = NULL,
                                updated_at = NOW()
                            WHERE id = $1
                            """,
                            document_id,
                        )

                    elif stage == "embedded":
                        # Clear embeddings from chunks
                        await conn.execute(
                            """
                            UPDATE document_chunks
                            SET embedding = NULL
                            WHERE document_id = $1
                            """,
                            document_id,
                        )
                        # Clear findings
                        await conn.execute(
                            """
                            DELETE FROM findings WHERE document_id = $1
                            """,
                            document_id,
                        )
                        # Reset stage to parsed
                        await conn.execute(
                            """
                            UPDATE documents
                            SET last_completed_stage = 'parsed',
                                updated_at = NOW()
                            WHERE id = $1
                            """,
                            document_id,
                        )

                    elif stage == "analyzed":
                        # Clear findings only
                        await conn.execute(
                            """
                            DELETE FROM findings WHERE document_id = $1
                            """,
                            document_id,
                        )
                        # Reset stage to embedded
                        await conn.execute(
                            """
                            UPDATE documents
                            SET last_completed_stage = 'embedded',
                                updated_at = NOW()
                            WHERE id = $1
                            """,
                            document_id,
                        )

                    logger.info(
                        "Stage data cleared",
                        document_id=str(document_id),
                        stage=stage,
                    )

                    return True

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error clearing stage data",
                document_id=str(document_id),
                stage=stage,
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to clear stage data: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    # ==========================================================================
    # Contradiction Detection Methods (Story E4.7)
    # ==========================================================================

    async def get_findings_by_deal(
        self,
        deal_id: UUID,
    ) -> list[dict[str, Any]]:
        """
        Get all findings for a deal.

        Story: E4.7 - Detect Contradictions Using Neo4j (AC: #2)

        Args:
            deal_id: UUID of the deal/project

        Returns:
            List of finding records as dicts

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        logger.info(
            "Fetching findings for deal",
            deal_id=str(deal_id),
        )

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT f.id, f.deal_id, f.document_id, f.user_id,
                           f.text, f.source_document, f.page_number,
                           f.confidence, f.chunk_id, f.finding_type,
                           f.domain, f.status, f.metadata,
                           f.created_at, f.updated_at,
                           d.name as document_name
                    FROM findings f
                    LEFT JOIN documents d ON f.document_id = d.id
                    WHERE f.deal_id = $1
                    ORDER BY f.created_at DESC
                    """,
                    deal_id,
                )

                findings = [dict(row) for row in rows]

                logger.info(
                    "Findings fetched for deal",
                    deal_id=str(deal_id),
                    findings_count=len(findings),
                )

                return findings

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error fetching findings for deal",
                deal_id=str(deal_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to fetch findings for deal: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_findings_by_document(
        self,
        document_id: UUID,
    ) -> list[dict[str, Any]]:
        """
        Get all findings for a specific document.

        Story: E4.15 - Sync Findings to Neo4j Knowledge Graph (AC: #5)

        Args:
            document_id: UUID of the document

        Returns:
            List of finding records as dicts with id, text, finding_type, confidence, etc.

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        logger.info(
            "Fetching findings for document",
            document_id=str(document_id),
        )

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT id, deal_id, document_id, user_id,
                           text, page_number, confidence,
                           chunk_id, finding_type, domain,
                           status, metadata, created_at
                    FROM findings
                    WHERE document_id = $1
                    ORDER BY created_at ASC
                    """,
                    document_id,
                )

                findings = [dict(row) for row in rows]

                logger.info(
                    "Findings fetched for document",
                    document_id=str(document_id),
                    findings_count=len(findings),
                )

                return findings

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error fetching findings for document",
                document_id=str(document_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to fetch findings for document: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_all_findings_with_documents(self) -> list[dict[str, Any]]:
        """
        Get all findings with their associated document information.

        Story: E4.15 - Sync Findings to Neo4j Knowledge Graph (AC: #5)

        Returns:
            List of finding records with embedded document info

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        logger.info("Fetching all findings with document info")

        try:
            async with pool.acquire() as conn:
                rows = await conn.fetch(
                    """
                    SELECT f.id, f.deal_id, f.document_id, f.user_id,
                           f.text, f.page_number, f.confidence,
                           f.chunk_id, f.finding_type, f.domain,
                           f.status, f.metadata, f.created_at,
                           d.name as doc_name, d.mime_type as doc_file_type,
                           d.created_at as doc_created_at
                    FROM findings f
                    LEFT JOIN documents d ON f.document_id = d.id
                    ORDER BY f.created_at ASC
                    """
                )

                findings = []
                for row in rows:
                    row_dict = dict(row)
                    # Restructure to match expected format with nested documents
                    finding = {
                        "id": row_dict["id"],
                        "deal_id": row_dict["deal_id"],
                        "document_id": row_dict["document_id"],
                        "user_id": row_dict["user_id"],
                        "text": row_dict["text"],
                        "page_number": row_dict["page_number"],
                        "confidence": row_dict["confidence"],
                        "chunk_id": row_dict["chunk_id"],
                        "finding_type": row_dict["finding_type"],
                        "domain": row_dict["domain"],
                        "status": row_dict["status"],
                        "metadata": row_dict["metadata"],
                        "created_at": row_dict["created_at"],
                        "documents": {
                            "id": row_dict["document_id"],
                            "name": row_dict["doc_name"],
                            "file_type": row_dict["doc_file_type"],
                            "created_at": row_dict["doc_created_at"],
                            "deal_id": row_dict["deal_id"],
                            "user_id": row_dict["user_id"],
                        } if row_dict["doc_name"] else None,
                    }
                    findings.append(finding)

                logger.info(
                    "All findings fetched with documents",
                    findings_count=len(findings),
                )

                return findings

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error fetching all findings with documents",
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to fetch findings with documents: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def get_existing_contradiction(
        self,
        finding_a_id: UUID,
        finding_b_id: UUID,
    ) -> Optional[dict[str, Any]]:
        """
        Check if a contradiction already exists between two findings.

        Story: E4.7 - Detect Contradictions Using Neo4j (AC: #6)

        Checks both directions (A->B and B->A) for existing contradictions.

        Args:
            finding_a_id: UUID of first finding
            finding_b_id: UUID of second finding

        Returns:
            Existing contradiction record if found, None otherwise

        Raises:
            DatabaseError: If query fails
        """
        pool = await self._get_pool()

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    SELECT id, deal_id, finding_a_id, finding_b_id,
                           confidence, status, resolution, resolution_note,
                           detected_at, resolved_at, resolved_by, metadata
                    FROM contradictions
                    WHERE (finding_a_id = $1 AND finding_b_id = $2)
                       OR (finding_a_id = $2 AND finding_b_id = $1)
                    LIMIT 1
                    """,
                    finding_a_id,
                    finding_b_id,
                )

                if row:
                    return dict(row)
                return None

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error checking existing contradiction",
                finding_a_id=str(finding_a_id),
                finding_b_id=str(finding_b_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to check existing contradiction: {str(e)}",
                retryable=self._is_retryable_error(e),
            )

    async def store_contradiction(
        self,
        deal_id: UUID,
        finding_a_id: UUID,
        finding_b_id: UUID,
        confidence: float,
        reason: Optional[str] = None,
    ) -> UUID:
        """
        Store a detected contradiction in the contradictions table.

        Story: E4.7 - Detect Contradictions Using Neo4j (AC: #6)

        Args:
            deal_id: UUID of the deal/project
            finding_a_id: UUID of first finding
            finding_b_id: UUID of second finding
            confidence: Confidence score (0.0-1.0)
            reason: Explanation of the contradiction

        Returns:
            UUID of the created contradiction record

        Raises:
            DatabaseError: If insert fails
        """
        pool = await self._get_pool()

        logger.info(
            "Storing contradiction",
            deal_id=str(deal_id),
            finding_a_id=str(finding_a_id),
            finding_b_id=str(finding_b_id),
            confidence=confidence,
        )

        try:
            async with pool.acquire() as conn:
                row = await conn.fetchrow(
                    """
                    INSERT INTO contradictions (
                        deal_id, finding_a_id, finding_b_id,
                        confidence, status, detected_at, metadata
                    ) VALUES (
                        $1, $2, $3, $4, 'unresolved', NOW(),
                        $5::jsonb
                    )
                    RETURNING id
                    """,
                    deal_id,
                    finding_a_id,
                    finding_b_id,
                    confidence,
                    json.dumps({"reason": reason} if reason else {}),
                )

                contradiction_id = row["id"]

                logger.info(
                    "Contradiction stored",
                    contradiction_id=str(contradiction_id),
                    deal_id=str(deal_id),
                    finding_a_id=str(finding_a_id),
                    finding_b_id=str(finding_b_id),
                )

                return contradiction_id

        except asyncpg.PostgresError as e:
            logger.error(
                "Database error storing contradiction",
                deal_id=str(deal_id),
                finding_a_id=str(finding_a_id),
                finding_b_id=str(finding_b_id),
                error=str(e),
            )
            raise DatabaseError(
                f"Failed to store contradiction: {str(e)}",
                retryable=self._is_retryable_error(e),
            )


# Global client instance
_supabase_client: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    """Get or create the global Supabase client instance."""
    global _supabase_client
    if _supabase_client is None:
        _supabase_client = SupabaseClient()
    return _supabase_client


__all__ = [
    "SupabaseClient",
    "DatabaseError",
    "get_supabase_client",
]
