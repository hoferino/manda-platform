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
