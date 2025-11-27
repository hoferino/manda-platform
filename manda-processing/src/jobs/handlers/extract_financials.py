"""
Extract financials job handler for extracting metrics from Excel models.
Story: E3.9 - Financial Model Integration (AC: #1, #2, #3, #4, #6)

This handler processes extract-financials jobs from the pg-boss queue:
1. Updates document status to 'extracting_financials'
2. Loads parsed data (tables/formulas) from document chunks
3. Detects financial content using pattern matching
4. Extracts metrics with source attribution
5. Stores metrics in database
6. Updates document status to 'complete'

Triggered after analyze-document for Excel/spreadsheet files.
"""

import time
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.jobs.queue import Job, get_job_queue
from src.jobs.retry_manager import RetryManager, get_retry_manager
from src.financial.extractor import FinancialMetricExtractor, get_financial_extractor
from src.parsers import ParseResult, ChunkData, TableData, FormulaData
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)

logger = structlog.get_logger(__name__)


# Errors that should NOT trigger retry (permanent failures)
NON_RETRYABLE_ERRORS = (
    ValueError,  # Invalid input data
)


class ExtractFinancialsHandler:
    """
    Handler for extract-financials jobs.

    Orchestrates financial metric extraction from Excel documents:
    Load Chunks -> Reconstruct ParseResult -> Detect -> Extract -> Store -> Complete
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        extractor: Optional[FinancialMetricExtractor] = None,
        retry_manager: Optional[RetryManager] = None,
        config: Optional[Settings] = None,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            db_client: Database client for storage
            extractor: Financial metric extractor
            retry_manager: Retry manager for stage tracking
            config: Application settings
        """
        self.db = db_client or get_supabase_client()
        self.extractor = extractor or get_financial_extractor()
        self.retry_mgr = retry_manager or get_retry_manager()
        self.config = config or get_settings()

        logger.info("ExtractFinancialsHandler initialized")

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an extract-financials job.

        Args:
            job: The job to process

        Returns:
            Result dict with success status and metrics

        Raises:
            Exception: Re-raised if error should trigger retry
        """
        start_time = time.perf_counter()
        job_data = job.data

        # Extract required fields from job payload
        document_id = UUID(job_data["document_id"])
        deal_id = job_data.get("deal_id")
        user_id = job_data.get("user_id")
        is_retry = job_data.get("is_retry", False)

        logger.info(
            "Processing extract-financials job",
            job_id=job.id,
            document_id=str(document_id),
            retry_count=job.retry_count,
            is_retry=is_retry,
        )

        try:
            # Prepare for retry if needed
            if is_retry:
                await self.retry_mgr.prepare_stage_retry(document_id, "extracted_financials")
                # Clear previous financial metrics on retry
                await self.db.delete_financial_metrics(document_id)
            else:
                # Update status to extracting
                await self.db.update_document_status(document_id, "extracting_financials")

            # Clear any previous error on start
            await self.db.clear_processing_error(document_id)

            # Get document info
            doc = await self.db.get_document(document_id)
            if not doc:
                raise ValueError(f"Document not found: {document_id}")

            file_type = doc.get("mime_type", "")
            document_name = doc.get("name", "Unknown")

            logger.info(
                "Processing document for financial extraction",
                document_id=str(document_id),
                document_name=document_name,
                file_type=file_type,
            )

            # Load chunks from database to reconstruct ParseResult
            chunks = await self.db.get_chunks_by_document(document_id)

            if not chunks:
                logger.warning(
                    "No chunks found for document",
                    document_id=str(document_id),
                )
                # Mark as complete with no metrics
                await self.db.update_document_status(document_id, "complete")
                await self.retry_mgr.mark_stage_complete(document_id, "extracted_financials")

                return {
                    "success": True,
                    "document_id": str(document_id),
                    "metrics_count": 0,
                    "has_financial_data": False,
                    "detection_confidence": 0.0,
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                }

            # Reconstruct ParseResult from stored chunks
            parse_result = self._reconstruct_parse_result(chunks)

            logger.info(
                "Reconstructed parse result",
                document_id=str(document_id),
                chunk_count=len(parse_result.chunks),
                table_count=len(parse_result.tables),
                formula_count=len(parse_result.formulas),
            )

            # Extract financial metrics
            extraction_result = self.extractor.extract(
                document_id=document_id,
                parse_result=parse_result,
                file_type=file_type,
            )

            logger.info(
                "Financial extraction complete",
                document_id=str(document_id),
                has_financial_data=extraction_result.has_financial_data,
                metrics_count=extraction_result.metrics_count,
                detection_confidence=extraction_result.detection_confidence,
            )

            # Store metrics and update status
            if extraction_result.metrics:
                stored_count = await self.db.store_financial_metrics_and_update_status(
                    document_id=document_id,
                    metrics=extraction_result.metrics,
                    new_status="complete",
                )
            else:
                stored_count = 0
                await self.db.update_document_status(document_id, "complete")

            # Mark extraction stage as complete
            await self.retry_mgr.mark_stage_complete(document_id, "extracted_financials")

            # Calculate metrics
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            result = {
                "success": True,
                "document_id": str(document_id),
                "metrics_count": stored_count,
                "has_financial_data": extraction_result.has_financial_data,
                "detection_confidence": extraction_result.detection_confidence,
                "document_type": extraction_result.document_type,
                "processing_time_ms": extraction_result.processing_time_ms,
                "total_time_ms": elapsed_ms,
            }

            logger.info(
                "extract-financials job completed",
                job_id=job.id,
                **result,
            )

            return result

        except NON_RETRYABLE_ERRORS as e:
            logger.error(
                "extract-financials job failed permanently",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
            )

            # Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="extracting_financials",
                retry_count=job.retry_count,
            )
            raise

        except DatabaseError as e:
            logger.warning(
                "extract-financials job failed (may retry)",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
                retryable=e.retryable,
            )

            # Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="extracting_financials",
                retry_count=job.retry_count,
            )
            raise

        except Exception as e:
            error_type = type(e).__name__

            logger.error(
                "extract-financials job failed unexpectedly",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=error_type,
                exc_info=True,
            )

            # Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="extracting_financials",
                retry_count=job.retry_count,
            )
            raise

    def _reconstruct_parse_result(
        self,
        chunks: list[dict[str, Any]],
    ) -> ParseResult:
        """
        Reconstruct a ParseResult from stored chunks.

        This re-creates the structure needed by the financial extractor
        from the chunks stored in the database during parsing.

        Args:
            chunks: List of chunk records from database

        Returns:
            ParseResult with chunks, tables, and formulas
        """
        chunk_data: list[ChunkData] = []
        table_data: list[TableData] = []
        formula_data: list[FormulaData] = []

        for chunk in chunks:
            chunk_type = chunk.get("chunk_type", "text")
            content = chunk.get("content", "")
            metadata = chunk.get("metadata", {})

            if isinstance(metadata, str):
                import json
                try:
                    metadata = json.loads(metadata)
                except json.JSONDecodeError:
                    metadata = {}

            if chunk_type == "table":
                # Reconstruct TableData from metadata
                # Build markdown content if not present
                table_content = content
                if not table_content:
                    headers = metadata.get("headers", [])
                    data = metadata.get("data", [])
                    table_content = "| " + " | ".join(headers) + " |\n"
                    table_content += "| " + " | ".join(["---"] * len(headers)) + " |\n"
                    for row in data:
                        table_content += "| " + " | ".join(str(cell) for cell in row) + " |\n"

                table = TableData(
                    content=table_content,
                    headers=metadata.get("headers", []),
                    data=metadata.get("data", []),
                    rows=metadata.get("rows", 0),
                    cols=metadata.get("cols", 0),
                    sheet_name=chunk.get("sheet_name"),
                    page_number=chunk.get("page_number"),
                )
                table_data.append(table)
            elif chunk_type == "formula":
                # Reconstruct FormulaData from metadata
                # result_value must be a string
                result_val = metadata.get("result_value")
                if result_val is not None:
                    result_val = str(result_val)

                formula = FormulaData(
                    cell_reference=chunk.get("cell_reference", ""),
                    formula=content,
                    sheet_name=chunk.get("sheet_name", ""),
                    references=metadata.get("references", []),
                    result_value=result_val,
                )
                formula_data.append(formula)
            else:
                # Regular text chunk
                chunk_obj = ChunkData(
                    content=content,
                    chunk_index=chunk.get("chunk_index", 0),
                    chunk_type=chunk_type,
                    page_number=chunk.get("page_number"),
                    sheet_name=chunk.get("sheet_name"),
                    cell_reference=chunk.get("cell_reference"),
                    token_count=chunk.get("token_count"),
                    metadata=metadata,
                )
                chunk_data.append(chunk_obj)

        return ParseResult(
            chunks=chunk_data,
            tables=table_data,
            formulas=formula_data,
            page_count=0,  # Not needed for financial extraction
            total_tokens=sum(c.token_count or 0 for c in chunk_data),
        )


# Handler instance factory
_handler: Optional[ExtractFinancialsHandler] = None


def get_extract_financials_handler() -> ExtractFinancialsHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = ExtractFinancialsHandler()
    return _handler


async def handle_extract_financials(job: Job) -> dict[str, Any]:
    """
    Entry point for extract-financials job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_extract_financials_handler()
    return await handler.handle(job)


__all__ = [
    "ExtractFinancialsHandler",
    "handle_extract_financials",
    "get_extract_financials_handler",
]
