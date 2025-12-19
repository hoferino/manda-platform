"""
Analyze document job handler for LLM-based finding extraction.
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (Tiered Approach) (AC: #1, #4, #5)
Story: E3.8 - Implement Retry Logic for Failed Processing (AC: #2, #3, #4)
Story: E4.15 - Sync Findings to Neo4j Knowledge Graph (AC: #3)
Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI (AC: #2, #3)

This handler processes analyze-document jobs from the pg-boss queue:
1. Updates document status to 'analyzing'
2. Loads chunks from database
3. Selects appropriate model tier based on document type
4. Extracts findings using Pydantic AI agent (E11.5) or fallback GeminiClient
5. Stores findings in database
6. Syncs findings to Neo4j (E4.15)
7. Updates document status to 'analyzed'
8. Enqueues next job (extract_financials for xlsx, or marks complete)

Enhanced with E3.8:
- Stage tracking via last_completed_stage
- Error classification and retry decisions
- Structured error reporting

Enhanced with E4.15:
- Neo4j knowledge graph sync (best-effort, doesn't fail job)

Enhanced with E11.5:
- Type-safe Pydantic AI agent with structured output
- Dependency injection via RunContext[AnalysisDependencies]
- Model switching via config: PYDANTIC_AI_EXTRACTION_MODEL
"""

import time
import traceback
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import UUID

import structlog

from src.config import Settings, get_settings
from src.jobs.queue import Job, get_job_queue
from src.jobs.retry_manager import RetryManager, get_retry_manager
from src.llm.models import ModelTier, select_model_tier
from src.models.findings import FindingCreate, finding_from_dict
from src.storage.supabase_client import (
    SupabaseClient,
    DatabaseError,
    get_supabase_client,
)
from src.storage.neo4j_client import (
    create_finding_node,
    create_document_node,
    create_extracted_from_relationship,
    Neo4jConnectionError,
)
from src.observability.usage import log_feature_usage_to_db

logger = structlog.get_logger(__name__)


# Errors that should NOT trigger retry (permanent failures)
NON_RETRYABLE_ERRORS = (
    ValueError,  # Invalid input data
)

# MIME types that require financial extraction step
EXCEL_MIME_TYPES = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroenabled.12",
}

# PDF MIME types that may contain financial tables
PDF_MIME_TYPES = {
    "application/pdf",
}


def _create_gemini_client():
    """Create a Gemini client (lazy import to avoid import errors in tests)."""
    from src.llm.client import GeminiClient

    return GeminiClient()


def _create_pydantic_agent():
    """Create a Pydantic AI agent (lazy import to avoid import errors in tests)."""
    from src.llm.pydantic_agent import create_analysis_agent

    return create_analysis_agent()


class AnalyzeDocumentHandler:
    """
    Handler for analyze-document jobs.

    Orchestrates the LLM analysis pipeline:
    Load Chunks -> Select Model -> Extract Findings -> Store -> Update Status -> Enqueue Next

    E3.8: Includes stage tracking and retry management.
    E11.5: Uses Pydantic AI agent for type-safe extraction with fallback to GeminiClient.
    """

    def __init__(
        self,
        db_client: Optional[SupabaseClient] = None,
        llm_client: Optional[Any] = None,
        pydantic_agent: Optional[Any] = None,
        retry_manager: Optional[RetryManager] = None,
        config: Optional[Settings] = None,
        use_pydantic_ai: bool = True,
    ):
        """
        Initialize the handler with its dependencies.

        Args:
            db_client: Database client for storage
            llm_client: Gemini LLM client (fallback when Pydantic AI unavailable)
            pydantic_agent: Pydantic AI agent for type-safe extraction (E11.5)
            retry_manager: Retry manager for stage tracking and error handling
            config: Application settings
            use_pydantic_ai: Whether to use Pydantic AI (default True, falls back if unavailable)
        """
        self.db = db_client or get_supabase_client()
        self.llm_client = llm_client or _create_gemini_client()
        self.retry_mgr = retry_manager or get_retry_manager()
        self.config = config or get_settings()
        self.use_pydantic_ai = use_pydantic_ai

        # E11.5: Initialize Pydantic AI agent (lazy, may fail if not configured)
        self._pydantic_agent = pydantic_agent
        self._pydantic_agent_initialized = pydantic_agent is not None

        logger.info(
            "AnalyzeDocumentHandler initialized",
            use_pydantic_ai=use_pydantic_ai,
        )

    def _get_pydantic_agent(self) -> Optional[Any]:
        """Get or create the Pydantic AI agent (lazy initialization)."""
        if not self.use_pydantic_ai:
            return None

        if not self._pydantic_agent_initialized:
            try:
                self._pydantic_agent = _create_pydantic_agent()
                self._pydantic_agent_initialized = True
                logger.debug("Pydantic AI agent initialized")
            except Exception as e:
                logger.warning(
                    "Failed to initialize Pydantic AI agent, will use fallback",
                    error=str(e),
                )
                self._pydantic_agent = None
                self._pydantic_agent_initialized = True

        return self._pydantic_agent

    async def handle(self, job: Job) -> dict[str, Any]:
        """
        Handle an analyze-document job.

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

        # E12.9: Get organization_id from job payload (will fetch from deal if not present)
        organization_id = job_data.get("organization_id")

        logger.info(
            "Processing analyze-document job",
            job_id=job.id,
            document_id=str(document_id),
            organization_id=organization_id,
            retry_count=job.retry_count,
            is_retry=is_retry,
        )

        try:
            # E3.8: Prepare for retry if needed
            if is_retry:
                await self.retry_mgr.prepare_stage_retry(document_id, "analyzed")
            else:
                # Update status to analyzing
                await self.db.update_document_status(document_id, "analyzing")

            # Clear any previous error on start
            await self.db.clear_processing_error(document_id)

            # Get document info for model selection and context
            doc = await self.db.get_document(document_id)
            if not doc:
                raise ValueError(f"Document not found: {document_id}")

            file_type = doc.get("mime_type", "")
            document_name = doc.get("name", "Unknown")
            project_id = doc.get("deal_id")  # deal_id is the project_id

            if not project_id:
                raise ValueError(f"Document has no project_id: {document_id}")

            # E12.9: Fetch organization_id from deal if not in job payload
            if not organization_id and deal_id:
                deal = await self.db.get_deal(deal_id)
                if deal:
                    organization_id = deal.get("organization_id")
                    logger.debug(
                        "Fetched organization_id from deal",
                        deal_id=deal_id,
                        organization_id=organization_id,
                    )

            # Select model tier based on document type
            model_tier = select_model_tier(file_type)

            logger.info(
                "Selected model tier",
                document_id=str(document_id),
                file_type=file_type,
                model_tier=model_tier.value,
            )

            # Load chunks from database
            chunks = await self.db.get_chunks_by_document(document_id)

            if not chunks:
                logger.warning(
                    "No chunks found for document",
                    document_id=str(document_id),
                )
                # Still mark as analyzed (empty document case)
                await self.db.update_document_status(document_id, "analyzed")
                # E3.8: Mark stage complete
                await self.retry_mgr.mark_stage_complete(document_id, "analyzed")

                # Determine next job - Excel files still get financial extraction attempt
                # (even if empty, the extractor will handle gracefully)
                if file_type in EXCEL_MIME_TYPES:
                    next_job_id = await self._enqueue_next_job(
                        "extract-financials", document_id, deal_id, user_id
                    )
                else:
                    # No chunks means no tables, so PDFs go straight to complete
                    await self.db.update_document_status(document_id, "complete")
                    next_job_id = None

                return {
                    "success": True,
                    "document_id": str(document_id),
                    "findings_count": 0,
                    "chunks_analyzed": 0,
                    "model_tier": model_tier.value,
                    "total_time_ms": int((time.perf_counter() - start_time) * 1000),
                    "next_job_id": next_job_id,
                }

            # Prepare context for analysis
            context = {
                "document_name": document_name,
                "project_name": "",  # Could fetch project name if needed
                "document_id": str(document_id),
                "project_id": str(project_id),
            }

            # Convert chunks to format expected by LLM client
            chunk_data = [
                {
                    "id": str(chunk["id"]),
                    "content": chunk["content"],
                    "page_number": chunk.get("page_number"),
                    "chunk_type": chunk.get("chunk_type", "text"),
                    "chunk_index": chunk.get("chunk_index", 0),
                }
                for chunk in chunks
            ]

            # E11.5: Try Pydantic AI agent first, fallback to GeminiClient
            pydantic_agent = self._get_pydantic_agent()
            findings_to_store: list[FindingCreate] = []
            total_input_tokens = 0
            total_output_tokens = 0

            if pydantic_agent is not None:
                # Use Pydantic AI agent for type-safe extraction
                analysis_result = await self._analyze_with_pydantic_ai(
                    pydantic_agent=pydantic_agent,
                    chunks=chunk_data,
                    document_id=document_id,
                    deal_id=str(project_id),
                    document_name=document_name,
                )
                findings_to_store = analysis_result["findings"]
                total_input_tokens = analysis_result["input_tokens"]
                total_output_tokens = analysis_result["output_tokens"]

                logger.info(
                    "Pydantic AI analysis complete",
                    document_id=str(document_id),
                    findings_count=len(findings_to_store),
                    input_tokens=total_input_tokens,
                    output_tokens=total_output_tokens,
                )
            else:
                # Fallback to GeminiClient batch analysis
                batch_size = self.config.llm_analysis_batch_size
                analysis_result = await self.llm_client.analyze_batch(
                    chunks=chunk_data,
                    context=context,
                    model_tier=model_tier,
                    batch_size=batch_size,
                )

                logger.info(
                    "LLM analysis complete (fallback)",
                    document_id=str(document_id),
                    findings_count=analysis_result.finding_count,
                    input_tokens=analysis_result.total_input_tokens,
                    output_tokens=analysis_result.total_output_tokens,
                )

                total_input_tokens = analysis_result.total_input_tokens
                total_output_tokens = analysis_result.total_output_tokens

                # Convert raw findings to FindingCreate models
                for finding_data in analysis_result.findings:
                    try:
                        # Get chunk_id from finding data
                        chunk_id = None
                        if finding_data.get("chunk_id"):
                            try:
                                chunk_id = UUID(finding_data["chunk_id"])
                            except (ValueError, TypeError):
                                pass

                        finding = finding_from_dict(
                            data=finding_data,
                            project_id=UUID(str(project_id)),
                            document_id=document_id,
                            chunk_id=chunk_id,
                        )
                        findings_to_store.append(finding)
                    except Exception as e:
                        logger.warning(
                            "Failed to convert finding",
                            error=str(e),
                            finding_preview=str(finding_data)[:100],
                        )

            # Store findings and update status atomically
            if findings_to_store:
                stored_count = await self.db.store_findings_and_update_status(
                    document_id=document_id,
                    project_id=UUID(str(project_id)),
                    user_id=UUID(user_id) if user_id else None,
                    findings=findings_to_store,
                    new_status="analyzed",
                )
            else:
                stored_count = 0
                await self.db.update_document_status(document_id, "analyzed")

            # E4.15: Sync findings to Neo4j knowledge graph (best-effort, don't fail job)
            if stored_count > 0:
                await self._sync_findings_to_neo4j(
                    document_id=document_id,
                    document=doc,
                )

            # E3.8: Mark analysis stage as complete
            await self.retry_mgr.mark_stage_complete(document_id, "analyzed")

            # Check if document has tables (for PDF financial extraction)
            has_tables = any(
                chunk.get("chunk_type") == "table" for chunk in chunks
            )

            # Enqueue next job based on file type
            # E3.9: Excel files always get financial extraction
            # E3.9: PDFs with tables also get financial extraction
            next_job_id = None
            if file_type in EXCEL_MIME_TYPES:
                next_job_id = await self._enqueue_next_job(
                    "extract-financials", document_id, deal_id, user_id
                )
            elif file_type in PDF_MIME_TYPES and has_tables:
                # PDF with financial tables - attempt extraction
                logger.info(
                    "PDF has tables, enqueuing financial extraction",
                    document_id=str(document_id),
                    table_count=sum(1 for c in chunks if c.get("chunk_type") == "table"),
                )
                next_job_id = await self._enqueue_next_job(
                    "extract-financials", document_id, deal_id, user_id
                )
            else:
                # Non-Excel files without tables are complete after analysis
                await self.db.update_document_status(document_id, "complete")

            # E4.7: Enqueue contradiction detection for all documents (after any extraction)
            # This runs deal-level analysis to find contradictions between findings
            if deal_id:
                try:
                    await self._enqueue_next_job(
                        "detect-contradictions", document_id, deal_id, user_id
                    )
                    logger.info(
                        "Enqueued detect-contradictions job",
                        document_id=str(document_id),
                        deal_id=deal_id,
                    )
                except Exception as e:
                    # Don't fail the document if contradiction detection fails to enqueue
                    logger.warning(
                        "Failed to enqueue detect-contradictions job",
                        document_id=str(document_id),
                        deal_id=deal_id,
                        error=str(e),
                    )

            # Calculate metrics
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)

            # E11.5: Calculate estimated cost (simplified - actual cost varies by provider)
            # Using Gemini Flash pricing as baseline: $0.30/1M input, $1.20/1M output
            estimated_cost_usd = (total_input_tokens * 0.0000003) + (total_output_tokens * 0.0000012)

            result = {
                "success": True,
                "document_id": str(document_id),
                "findings_count": stored_count,
                "chunks_analyzed": len(chunks),
                "model_tier": model_tier.value,
                "input_tokens": total_input_tokens,
                "output_tokens": total_output_tokens,
                "estimated_cost_usd": estimated_cost_usd,
                "total_time_ms": elapsed_ms,
                "next_job_id": next_job_id,
            }

            # E12.2: Log feature usage to database
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,  # E12.9
                deal_id=UUID(str(project_id)) if project_id else None,
                user_id=UUID(user_id) if user_id else None,
                feature_name="document_analysis",
                status="success",
                duration_ms=elapsed_ms,
                metadata={
                    "document_id": str(document_id),
                    "findings_count": stored_count,
                    "chunks_analyzed": len(chunks),
                    "model_tier": model_tier.value,
                },
            )

            logger.info(
                "analyze-document job completed",
                job_id=job.id,
                **result,
            )

            return result

        except NON_RETRYABLE_ERRORS as e:
            # Permanent failures - use retry manager
            elapsed_ms = int((time.perf_counter() - start_time) * 1000)
            logger.error(
                "analyze-document job failed permanently",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
            )

            # E12.2: Log failed feature usage
            await log_feature_usage_to_db(
                self.db,
                organization_id=UUID(organization_id) if organization_id else None,  # E12.9
                deal_id=UUID(deal_id) if deal_id else None,
                user_id=UUID(user_id) if user_id else None,
                feature_name="document_analysis",
                status="error",
                duration_ms=elapsed_ms,
                error_message=str(e),
                metadata={"stack": traceback.format_exc(), "document_id": str(document_id)},
            )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="analyzing",
                retry_count=job.retry_count,
            )
            raise

        except DatabaseError as e:
            # Potentially retryable database errors
            logger.warning(
                "analyze-document job failed (may retry)",
                job_id=job.id,
                document_id=str(document_id),
                error=str(e),
                error_type=type(e).__name__,
                retryable=e.retryable,
            )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="analyzing",
                retry_count=job.retry_count,
            )
            raise

        except Exception as e:
            # Check if it's an LLM error
            error_type = type(e).__name__

            # Import here to avoid circular imports
            from src.llm.client import GeminiError

            if isinstance(e, GeminiError):
                if not e.retryable:
                    logger.error(
                        "analyze-document job failed permanently (LLM error)",
                        job_id=job.id,
                        document_id=str(document_id),
                        error=str(e),
                    )
                else:
                    logger.warning(
                        "analyze-document job failed (LLM error, may retry)",
                        job_id=job.id,
                        document_id=str(document_id),
                        error=str(e),
                    )
            else:
                # Unexpected errors - log
                logger.error(
                    "analyze-document job failed unexpectedly",
                    job_id=job.id,
                    document_id=str(document_id),
                    error=str(e),
                    error_type=error_type,
                    exc_info=True,
                )

            # E3.8: Classify error and store structured error info
            await self.retry_mgr.handle_job_failure(
                document_id=document_id,
                error=e,
                current_stage="analyzing",
                retry_count=job.retry_count,
            )
            raise

    async def _analyze_with_pydantic_ai(
        self,
        pydantic_agent: Any,
        chunks: list[dict[str, Any]],
        document_id: UUID,
        deal_id: str,
        document_name: str,
    ) -> dict[str, Any]:
        """
        Analyze document chunks using Pydantic AI agent.

        Story: E11.5 - Type-Safe Tool Definitions with Pydantic AI (AC: #2, #3)

        Args:
            pydantic_agent: The Pydantic AI agent instance
            chunks: List of chunk dicts with id, content, page_number, etc.
            document_id: UUID of the document being analyzed
            deal_id: Deal/project ID for dependency injection
            document_name: Document name for context

        Returns:
            Dict with findings (list[FindingCreate]), input_tokens, output_tokens
        """
        from src.llm.pydantic_agent import AnalysisDependencies
        from src.graphiti.client import GraphitiClient

        # Get Graphiti client if Neo4j is configured
        graphiti = None
        if self.config.neo4j_password:
            try:
                graphiti = await GraphitiClient.get_instance()
            except Exception as e:
                logger.warning(
                    "Graphiti unavailable for Pydantic AI dependencies",
                    error=str(e),
                )

        # Create type-safe dependencies
        deps = AnalysisDependencies(
            db=self.db,
            graphiti=graphiti,
            deal_id=deal_id,
            document_id=str(document_id),
            document_name=document_name,
        )

        # Combine all chunk content for batch analysis
        combined_content = "\n\n---\n\n".join(
            f"[Chunk {i+1}] (Page {chunk.get('page_number', 'N/A')}, Type: {chunk.get('chunk_type', 'text')})\n{chunk['content']}"
            for i, chunk in enumerate(chunks)
        )

        # Run agent with structured output
        prompt = f"""Analyze the following document content and extract all relevant findings.

Document: {document_name}
Total Chunks: {len(chunks)}

Content:
{combined_content}

Extract structured findings with:
- content: the actual finding text
- finding_type: one of [fact, metric, risk, opportunity, assumption]
- confidence: 0.0-1.0 based on source clarity
- source_reference: include page_number if available"""

        result = await pydantic_agent.run(prompt, deps=deps)

        # Extract token usage (Pydantic AI 1.x uses result.usage() method)
        usage = result.usage()
        input_tokens = usage.request_tokens if usage else 0
        output_tokens = usage.response_tokens if usage else 0

        # Convert FindingResult models to FindingCreate models
        findings_to_store: list[FindingCreate] = []
        for finding in result.data:
            try:
                finding_create = FindingCreate(
                    project_id=UUID(deal_id),
                    document_id=document_id,
                    chunk_id=None,  # Pydantic AI doesn't track individual chunk IDs
                    text=finding.content,
                    finding_type=finding.finding_type,
                    confidence=finding.confidence,
                    domain="operational",  # Default domain
                    metadata=finding.source_reference,
                )
                findings_to_store.append(finding_create)
            except Exception as e:
                logger.warning(
                    "Failed to convert Pydantic AI finding",
                    error=str(e),
                    finding_content=finding.content[:100] if finding.content else "",
                )

        return {
            "findings": findings_to_store,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
        }

    async def _sync_findings_to_neo4j(
        self,
        document_id: UUID,
        document: dict[str, Any],
    ) -> None:
        """
        Sync findings to Neo4j knowledge graph.

        Story: E4.15 - Sync Findings to Neo4j Knowledge Graph (AC: #3)

        Args:
            document_id: UUID of the document whose findings to sync
            document: Document metadata dict from database

        Note:
            Best-effort sync - logs errors but doesn't fail the job.
            PostgreSQL is source of truth, Neo4j is derived data.
            Queries findings from database to get IDs (assigned during insert).
        """
        doc_id_str = str(document_id)
        document_name = document.get("name", "Unknown")
        project_id = str(document.get("deal_id", ""))
        upload_date = document.get("created_at", datetime.now(timezone.utc).isoformat())
        doc_type = document.get("file_type") or document.get("mime_type", "").split("/")[-1]
        user_id = str(document.get("user_id", ""))

        try:
            # Query findings from database to get IDs
            findings = await self.db.get_findings_by_document(document_id)

            if not findings:
                logger.warning(
                    "No findings found for document in database",
                    document_id=doc_id_str,
                )
                return

            logger.info(
                "Syncing findings to Neo4j",
                document_id=doc_id_str,
                finding_count=len(findings),
            )

            # Create document node (idempotent)
            create_document_node(
                document_id=doc_id_str,
                name=document_name,
                project_id=project_id,
                upload_date=upload_date,
                doc_type=doc_type,
            )

            # Create finding nodes and relationships
            for finding in findings:
                finding_id = str(finding["id"])

                # Convert confidence from 0-1 (DB) to 0-1 (Neo4j)
                confidence = finding.get("confidence", 0.0)

                # Extract date_referenced from metadata if present
                metadata = finding.get("metadata", {})
                date_referenced = metadata.get("date_referenced") if metadata else None

                create_finding_node(
                    finding_id=finding_id,
                    content=finding.get("text", ""),
                    finding_type=finding.get("finding_type", "fact"),
                    confidence=confidence,
                    domain=finding.get("domain", "operational"),
                    date_referenced=date_referenced,
                    date_extracted=finding.get("created_at", datetime.now(timezone.utc).isoformat()),
                    user_id=user_id,
                    project_id=project_id,
                )

                create_extracted_from_relationship(
                    finding_id=finding_id,
                    document_id=doc_id_str,
                )

            logger.info(
                "Neo4j sync complete",
                document_id=doc_id_str,
                finding_count=len(findings),
            )

        except Neo4jConnectionError as e:
            # Log error but don't fail the job - PostgreSQL is source of truth
            logger.error(
                "Neo4j sync failed",
                error=str(e),
                document_id=doc_id_str,
            )
        except Exception as e:
            # Catch any unexpected errors to prevent job failure
            logger.error(
                "Unexpected error during Neo4j sync",
                error=str(e),
                error_type=type(e).__name__,
                document_id=doc_id_str,
                exc_info=True,
            )

    async def _enqueue_next_job(
        self,
        job_name: str,
        document_id: UUID,
        deal_id: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Enqueue the next job in the pipeline.

        Args:
            job_name: Name of job to enqueue
            document_id: UUID of the processed document
            deal_id: Parent deal/project ID
            user_id: User who uploaded

        Returns:
            The enqueued job ID
        """
        queue = await get_job_queue()

        job_data = {
            "document_id": str(document_id),
        }

        if deal_id:
            job_data["deal_id"] = deal_id
        if user_id:
            job_data["user_id"] = user_id

        job_id = await queue.enqueue(job_name, job_data)

        logger.info(
            f"Enqueued {job_name} job",
            document_id=str(document_id),
            next_job_id=job_id,
        )

        return job_id


# Handler instance factory
_handler: Optional[AnalyzeDocumentHandler] = None


def get_analyze_document_handler() -> AnalyzeDocumentHandler:
    """Get or create the global handler instance."""
    global _handler
    if _handler is None:
        _handler = AnalyzeDocumentHandler()
    return _handler


async def handle_analyze_document(job: Job) -> dict[str, Any]:
    """
    Entry point for analyze-document job handling.

    This function matches the JobHandler signature expected by Worker.

    Args:
        job: The job to process

    Returns:
        Result dict with success status and metrics
    """
    handler = get_analyze_document_handler()
    return await handler.handle(job)


__all__ = [
    "AnalyzeDocumentHandler",
    "handle_analyze_document",
    "get_analyze_document_handler",
]
