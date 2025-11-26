"""
Job handlers for background processing tasks.
Story: E3.3 - Implement Document Parsing Job Handler (AC: #1)

This module contains handlers for various job types processed by the worker.
Each handler is registered with the Worker class for automatic invocation.
"""


def get_handle_parse_document():
    """Get the parse_document handler (lazy import)."""
    from src.jobs.handlers.parse_document import handle_parse_document
    return handle_parse_document


# For backwards compatibility, expose the function directly
# This will import parse_document module, but not docling
def handle_parse_document(job):
    """Handle a parse_document job (lazy wrapper)."""
    from src.jobs.handlers.parse_document import handle_parse_document as _handler
    return _handler(job)


__all__ = [
    "handle_parse_document",
    "get_handle_parse_document",
]
