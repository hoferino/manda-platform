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
                           metadata, embedding IS NOT NULL as has_embedding
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
