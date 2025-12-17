"""
Job handlers for background processing tasks.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #1)
Story: E3.4 - Generate Embeddings for Semantic Search (AC: #1)
Story: E3.5 - Implement LLM Analysis with Gemini 2.5 (AC: #1)
Story: E3.9 - Financial Model Integration (AC: #1)
Story: E4.7 - Detect Contradictions Using Neo4j (AC: #1)
Story: E10.4 - Document Ingestion Pipeline (AC: #1)
Story: E10.5 - Q&A and Chat Ingestion (AC: #1, #2)

This module contains handlers for various job types processed by the worker.
Each handler is registered with the Worker class for automatic invocation.
"""


def get_handle_parse_document():
    """Get the parse_document handler (lazy import)."""
    from src.jobs.handlers.parse_document import handle_parse_document
    return handle_parse_document


def get_handle_generate_embeddings():
    """Get the generate_embeddings handler (lazy import)."""
    from src.jobs.handlers.generate_embeddings import handle_generate_embeddings
    return handle_generate_embeddings


def get_handle_analyze_document():
    """Get the analyze_document handler (lazy import)."""
    from src.jobs.handlers.analyze_document import handle_analyze_document
    return handle_analyze_document


def get_handle_extract_financials():
    """Get the extract_financials handler (lazy import)."""
    from src.jobs.handlers.extract_financials import handle_extract_financials
    return handle_extract_financials


def get_handle_detect_contradictions():
    """Get the detect_contradictions handler (lazy import)."""
    from src.jobs.handlers.detect_contradictions import handle_detect_contradictions
    return handle_detect_contradictions


# For backwards compatibility, expose the function directly
# This will import parse_document module, but not docling
def handle_parse_document(job):
    """Handle a parse_document job (lazy wrapper)."""
    from src.jobs.handlers.parse_document import handle_parse_document as _handler
    return _handler(job)


def handle_generate_embeddings(job):
    """Handle a generate_embeddings job (lazy wrapper)."""
    from src.jobs.handlers.generate_embeddings import handle_generate_embeddings as _handler
    return _handler(job)


def handle_analyze_document(job):
    """Handle an analyze-document job (lazy wrapper)."""
    from src.jobs.handlers.analyze_document import handle_analyze_document as _handler
    return _handler(job)


def handle_extract_financials(job):
    """Handle an extract-financials job (lazy wrapper)."""
    from src.jobs.handlers.extract_financials import handle_extract_financials as _handler
    return _handler(job)


def handle_detect_contradictions(job):
    """Handle a detect-contradictions job (lazy wrapper)."""
    from src.jobs.handlers.detect_contradictions import handle_detect_contradictions as _handler
    return _handler(job)


def get_handle_analyze_feedback():
    """Get the analyze_feedback handler (lazy import)."""
    from src.jobs.handlers.analyze_feedback import handle_analyze_feedback
    return handle_analyze_feedback


def get_handle_analyze_feedback_all():
    """Get the analyze_feedback_all handler (lazy import)."""
    from src.jobs.handlers.analyze_feedback import handle_analyze_feedback_all
    return handle_analyze_feedback_all


def handle_analyze_feedback(job):
    """Handle an analyze-feedback job (lazy wrapper)."""
    from src.jobs.handlers.analyze_feedback import handle_analyze_feedback as _handler
    return _handler(job)


def handle_analyze_feedback_all(job):
    """Handle an analyze-feedback-all job (lazy wrapper)."""
    from src.jobs.handlers.analyze_feedback import handle_analyze_feedback_all as _handler
    return _handler(job)


def get_handle_ingest_graphiti():
    """Get the ingest_graphiti handler (lazy import)."""
    from src.jobs.handlers.ingest_graphiti import handle_ingest_graphiti
    return handle_ingest_graphiti


def handle_ingest_graphiti(job):
    """Handle an ingest-graphiti job (lazy wrapper)."""
    from src.jobs.handlers.ingest_graphiti import handle_ingest_graphiti as _handler
    return _handler(job)


# E10.5: Q&A response ingestion handler
def get_handle_ingest_qa_response():
    """Get the ingest_qa_response handler (lazy import)."""
    from src.jobs.handlers.ingest_qa_response import handle_ingest_qa_response
    return handle_ingest_qa_response


def handle_ingest_qa_response(job):
    """Handle an ingest-qa-response job (lazy wrapper)."""
    from src.jobs.handlers.ingest_qa_response import handle_ingest_qa_response as _handler
    return _handler(job)


# E10.5: Chat fact ingestion handler
def get_handle_ingest_chat_fact():
    """Get the ingest_chat_fact handler (lazy import)."""
    from src.jobs.handlers.ingest_chat_fact import handle_ingest_chat_fact
    return handle_ingest_chat_fact


def handle_ingest_chat_fact(job):
    """Handle an ingest-chat-fact job (lazy wrapper)."""
    from src.jobs.handlers.ingest_chat_fact import handle_ingest_chat_fact as _handler
    return _handler(job)


__all__ = [
    "handle_parse_document",
    "get_handle_parse_document",
    "handle_generate_embeddings",
    "get_handle_generate_embeddings",
    "handle_analyze_document",
    "get_handle_analyze_document",
    "handle_extract_financials",
    "get_handle_extract_financials",
    "handle_detect_contradictions",
    "get_handle_detect_contradictions",
    "handle_analyze_feedback",
    "get_handle_analyze_feedback",
    "handle_analyze_feedback_all",
    "get_handle_analyze_feedback_all",
    "handle_ingest_graphiti",
    "get_handle_ingest_graphiti",
    # E10.5: Q&A and Chat ingestion
    "handle_ingest_qa_response",
    "get_handle_ingest_qa_response",
    "handle_ingest_chat_fact",
    "get_handle_ingest_chat_fact",
]
