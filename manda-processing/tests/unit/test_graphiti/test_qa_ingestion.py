"""
Unit tests for Q&A and Chat ingestion service.
Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #2, #4, #5)

Tests the GraphitiIngestionService Q&A and chat methods:
- ingest_qa_response() method
- ingest_chat_fact() method
- Confidence constants
- Source description generation
- IngestionResult metrics
"""

import pytest
from unittest.mock import AsyncMock, patch
from dataclasses import asdict

from src.graphiti.ingestion import (
    GraphitiIngestionService,
    IngestionResult,
    QA_CONFIDENCE,
    CHAT_CONFIDENCE,
    DOCUMENT_CONFIDENCE,
)


class TestConfidenceConstants:
    """Tests for confidence scoring constants (AC: #4)."""

    def test_qa_confidence_highest(self):
        """Q&A confidence (0.95) is highest."""
        assert QA_CONFIDENCE == 0.95
        assert QA_CONFIDENCE > CHAT_CONFIDENCE
        assert QA_CONFIDENCE > DOCUMENT_CONFIDENCE

    def test_chat_confidence_high(self):
        """Chat confidence (0.90) is higher than document."""
        assert CHAT_CONFIDENCE == 0.90
        assert CHAT_CONFIDENCE > DOCUMENT_CONFIDENCE

    def test_document_confidence_base(self):
        """Document confidence (0.85) is the base level."""
        assert DOCUMENT_CONFIDENCE == 0.85

    def test_confidence_hierarchy(self):
        """Confidence levels form correct hierarchy: QA > Chat > Document."""
        assert QA_CONFIDENCE > CHAT_CONFIDENCE > DOCUMENT_CONFIDENCE


class TestQASourceDescription:
    """Tests for Q&A source description generation (AC: #5)."""

    @pytest.fixture
    def service(self):
        """Create a GraphitiIngestionService instance."""
        return GraphitiIngestionService()

    def test_short_question(self, service):
        """Short question included fully in source description."""
        result = service._build_qa_source_description("What is the revenue?")
        assert "Q&A Response" in result
        assert "Question: What is the revenue?" in result

    def test_long_question_truncated(self, service):
        """Long question is truncated to 100 chars with ellipsis."""
        long_question = "A" * 150
        result = service._build_qa_source_description(long_question)
        assert "Q&A Response" in result
        assert "A" * 100 in result
        assert "..." in result
        assert "A" * 150 not in result

    def test_exactly_100_chars(self, service):
        """Question at exactly 100 chars is not truncated."""
        question = "A" * 100
        result = service._build_qa_source_description(question)
        assert "Q&A Response" in result
        assert question in result
        assert "..." not in result


class TestChatSourceDescription:
    """Tests for chat source description generation (AC: #5)."""

    @pytest.fixture
    def service(self):
        """Create a GraphitiIngestionService instance."""
        return GraphitiIngestionService()

    def test_short_context(self, service):
        """Short context included fully in source description."""
        result = service._build_chat_source_description("The CEO mentioned expansion plans.")
        assert "Analyst Chat" in result
        assert "Context: The CEO mentioned expansion plans." in result

    def test_long_context_truncated(self, service):
        """Long context is truncated to 80 chars with ellipsis."""
        long_context = "B" * 120
        result = service._build_chat_source_description(long_context)
        assert "Analyst Chat" in result
        assert "B" * 80 in result
        assert "..." in result
        assert "B" * 120 not in result


class TestIngestQAResponse:
    """Tests for ingest_qa_response method (AC: #1, #4, #5)."""

    @pytest.fixture
    def service(self):
        """Create a GraphitiIngestionService instance."""
        return GraphitiIngestionService()

    @pytest.mark.asyncio
    async def test_basic_qa_ingestion(self, service):
        """Q&A response is ingested with correct parameters."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            result = await service.ingest_qa_response(
                qa_item_id="qa-12345678-abcd-1234",
                deal_id="deal-456",
                question="What is the company revenue?",
                answer="The company revenue is $5.2M.",
            )

            assert result.episode_count == 1
            assert result.elapsed_ms >= 0
            assert result.estimated_cost_usd >= 0

            mock_add_episode.assert_called_once()
            call_kwargs = mock_add_episode.call_args.kwargs

            assert call_kwargs["deal_id"] == "deal-456"
            assert "Q: What is the company revenue?" in call_kwargs["content"]
            assert "A: The company revenue is $5.2M." in call_kwargs["content"]
            assert call_kwargs["name"] == "qa-response-qa-12345"
            assert "Q&A Response" in call_kwargs["source_description"]

    @pytest.mark.asyncio
    async def test_qa_episode_name_uses_truncated_id(self, service):
        """Episode name uses first 8 chars of qa_item_id."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            await service.ingest_qa_response(
                qa_item_id="abc12345-9999-8888-7777",
                deal_id="deal-456",
                question="Test question?",
                answer="Test answer.",
            )

            call_kwargs = mock_add_episode.call_args.kwargs
            assert call_kwargs["name"] == "qa-response-abc12345"

    @pytest.mark.asyncio
    async def test_qa_content_format(self, service):
        """Content combines question and answer with Q:/A: format."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            await service.ingest_qa_response(
                qa_item_id="qa-123",
                deal_id="deal-456",
                question="What is EBITDA?",
                answer="EBITDA is $2.5M with 25% margin.",
            )

            call_kwargs = mock_add_episode.call_args.kwargs
            expected_content = "Q: What is EBITDA?\n\nA: EBITDA is $2.5M with 25% margin."
            assert call_kwargs["content"] == expected_content

    @pytest.mark.asyncio
    async def test_qa_uses_schema_types(self, service):
        """Q&A ingestion uses M&A schema types."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            await service.ingest_qa_response(
                qa_item_id="qa-123",
                deal_id="deal-456",
                question="Q",
                answer="A",
            )

            call_kwargs = mock_add_episode.call_args.kwargs

            assert "entity_types" in call_kwargs
            assert "edge_types" in call_kwargs
            assert "edge_type_map" in call_kwargs
            assert "Company" in call_kwargs["entity_types"]

    @pytest.mark.asyncio
    async def test_qa_cost_estimation(self, service):
        """Cost is estimated from content length."""
        # Create content with known length
        question = "Q" * 100  # 100 chars
        answer = "A" * 300  # 300 chars
        # Total content = "Q: " + question + "\n\nA: " + answer = 3 + 100 + 4 + 300 = 407 chars
        # With actual format = ~407 chars / 4 = ~101 tokens
        # Cost = 101 * 0.00000006 ≈ 0.000006 (voyage-3.5 pricing)

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ):
            result = await service.ingest_qa_response(
                qa_item_id="qa-123",
                deal_id="deal-456",
                question=question,
                answer=answer,
            )

            # Cost should be reasonable estimate based on content
            assert result.estimated_cost_usd > 0
            assert result.estimated_cost_usd < 0.001  # Should be very small

    @pytest.mark.asyncio
    async def test_qa_graphiti_error_propagates(self, service):
        """GraphitiConnectionError from add_episode propagates."""
        from src.graphiti.client import GraphitiConnectionError

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
            side_effect=GraphitiConnectionError("Neo4j unavailable"),
        ):
            with pytest.raises(GraphitiConnectionError) as exc_info:
                await service.ingest_qa_response(
                    qa_item_id="qa-123",
                    deal_id="deal-456",
                    question="Q",
                    answer="A",
                )

            assert "Neo4j unavailable" in str(exc_info.value)


class TestIngestChatFact:
    """Tests for ingest_chat_fact method (AC: #2, #4, #5)."""

    @pytest.fixture
    def service(self):
        """Create a GraphitiIngestionService instance."""
        return GraphitiIngestionService()

    @pytest.mark.asyncio
    async def test_basic_chat_ingestion(self, service):
        """Chat fact is ingested with correct parameters."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            result = await service.ingest_chat_fact(
                message_id="msg-12345678-abcd",
                deal_id="deal-456",
                fact_content="The CEO confirmed expansion to Europe in Q3.",
                message_context="Full chat message with more context here.",
            )

            assert result.episode_count == 1
            assert result.elapsed_ms >= 0

            mock_add_episode.assert_called_once()
            call_kwargs = mock_add_episode.call_args.kwargs

            assert call_kwargs["deal_id"] == "deal-456"
            assert call_kwargs["content"] == "The CEO confirmed expansion to Europe in Q3."
            assert call_kwargs["name"] == "chat-fact-msg-1234"
            assert "Analyst Chat" in call_kwargs["source_description"]

    @pytest.mark.asyncio
    async def test_chat_episode_name_uses_truncated_id(self, service):
        """Episode name uses first 8 chars of message_id."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            await service.ingest_chat_fact(
                message_id="xyz98765-aaaa-bbbb",
                deal_id="deal-456",
                fact_content="Test fact.",
                message_context="Context.",
            )

            call_kwargs = mock_add_episode.call_args.kwargs
            assert call_kwargs["name"] == "chat-fact-xyz98765"

    @pytest.mark.asyncio
    async def test_chat_uses_schema_types(self, service):
        """Chat ingestion uses M&A schema types."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            await service.ingest_chat_fact(
                message_id="msg-123",
                deal_id="deal-456",
                fact_content="Fact",
                message_context="Context",
            )

            call_kwargs = mock_add_episode.call_args.kwargs

            assert "entity_types" in call_kwargs
            assert "edge_types" in call_kwargs
            assert "edge_type_map" in call_kwargs

    @pytest.mark.asyncio
    async def test_chat_fact_content_used_directly(self, service):
        """Fact content (not context) is used as episode content."""
        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
        ) as mock_add_episode:
            await service.ingest_chat_fact(
                message_id="msg-123",
                deal_id="deal-456",
                fact_content="Revenue is $10M.",
                message_context="The analyst said a lot of things including revenue info.",
            )

            call_kwargs = mock_add_episode.call_args.kwargs
            # Content should be the extracted fact, not full context
            assert call_kwargs["content"] == "Revenue is $10M."

    @pytest.mark.asyncio
    async def test_chat_graphiti_error_propagates(self, service):
        """GraphitiConnectionError from add_episode propagates."""
        from src.graphiti.client import GraphitiConnectionError

        with patch(
            "src.graphiti.ingestion.GraphitiClient.add_episode",
            new_callable=AsyncMock,
            side_effect=GraphitiConnectionError("Connection lost"),
        ):
            with pytest.raises(GraphitiConnectionError) as exc_info:
                await service.ingest_chat_fact(
                    message_id="msg-123",
                    deal_id="deal-456",
                    fact_content="Fact",
                    message_context="Context",
                )

            assert "Connection lost" in str(exc_info.value)


class TestIngestQAResponseHandler:
    """Tests for the Q&A response job handler."""

    @pytest.mark.asyncio
    async def test_handler_basic_execution(self):
        """Handler processes job and returns success result."""
        from datetime import datetime
        from src.jobs.handlers.ingest_qa_response import IngestQAResponseHandler
        from src.jobs.queue import Job, JobState

        mock_ingestion = AsyncMock()
        mock_ingestion.ingest_qa_response.return_value = IngestionResult(
            episode_count=1,
            elapsed_ms=150,
            estimated_cost_usd=0.00001,
        )

        handler = IngestQAResponseHandler(ingestion_service=mock_ingestion)

        job = Job(
            id="job-123",
            name="ingest-qa-response",
            data={
                "qa_item_id": "qa-456",
                "deal_id": "deal-789",
                "question": "What is revenue?",
                "answer": "Revenue is $5M.",
            },
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            retry_count=0,
        )

        result = await handler.handle(job)

        assert result["success"] is True
        assert result["qa_item_id"] == "qa-456"
        assert result["episodes_created"] == 1
        assert "ingestion_time_ms" in result
        assert "total_time_ms" in result

        mock_ingestion.ingest_qa_response.assert_called_once_with(
            qa_item_id="qa-456",
            deal_id="deal-789",
            question="What is revenue?",
            answer="Revenue is $5M.",
        )

    @pytest.mark.asyncio
    async def test_handler_missing_field_raises(self):
        """Handler raises KeyError if required field missing."""
        from datetime import datetime
        from src.jobs.handlers.ingest_qa_response import IngestQAResponseHandler
        from src.jobs.queue import Job, JobState

        handler = IngestQAResponseHandler()

        job = Job(
            id="job-123",
            name="ingest-qa-response",
            data={
                "qa_item_id": "qa-456",
                # Missing deal_id, question, answer
            },
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            retry_count=0,
        )

        with pytest.raises(KeyError):
            await handler.handle(job)


class TestIngestChatFactHandler:
    """Tests for the chat fact job handler."""

    @pytest.mark.asyncio
    async def test_handler_basic_execution(self):
        """Handler processes job and returns success result."""
        from datetime import datetime
        from src.jobs.handlers.ingest_chat_fact import IngestChatFactHandler
        from src.jobs.queue import Job, JobState

        mock_ingestion = AsyncMock()
        mock_ingestion.ingest_chat_fact.return_value = IngestionResult(
            episode_count=1,
            elapsed_ms=100,
            estimated_cost_usd=0.000005,
        )

        handler = IngestChatFactHandler(ingestion_service=mock_ingestion)

        job = Job(
            id="job-123",
            name="ingest-chat-fact",
            data={
                "message_id": "msg-456",
                "deal_id": "deal-789",
                "fact_content": "Revenue increased 15%.",
                "message_context": "The analyst mentioned revenue figures.",
            },
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            retry_count=0,
        )

        result = await handler.handle(job)

        assert result["success"] is True
        assert result["message_id"] == "msg-456"
        assert result["episodes_created"] == 1

        mock_ingestion.ingest_chat_fact.assert_called_once_with(
            message_id="msg-456",
            deal_id="deal-789",
            fact_content="Revenue increased 15%.",
            message_context="The analyst mentioned revenue figures.",
        )

    @pytest.mark.asyncio
    async def test_handler_uses_fact_as_context_fallback(self):
        """Handler uses fact_content as context if message_context missing."""
        from datetime import datetime
        from src.jobs.handlers.ingest_chat_fact import IngestChatFactHandler
        from src.jobs.queue import Job, JobState

        mock_ingestion = AsyncMock()
        mock_ingestion.ingest_chat_fact.return_value = IngestionResult(
            episode_count=1,
            elapsed_ms=50,
            estimated_cost_usd=0.000001,
        )

        handler = IngestChatFactHandler(ingestion_service=mock_ingestion)

        job = Job(
            id="job-123",
            name="ingest-chat-fact",
            data={
                "message_id": "msg-456",
                "deal_id": "deal-789",
                "fact_content": "EBITDA is $2M.",
                # No message_context provided
            },
            state=JobState.ACTIVE,
            created_on=datetime.now(),
            retry_count=0,
        )

        result = await handler.handle(job)

        assert result["success"] is True

        # Should use fact_content as fallback for context
        call_kwargs = mock_ingestion.ingest_chat_fact.call_args.kwargs
        assert call_kwargs["message_context"] == "EBITDA is $2M."
