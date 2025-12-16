"""
Graphiti-specific configuration.
Story: E10.1 - Graphiti Infrastructure Setup (AC: #1, #3)

Configuration for Graphiti temporal knowledge graph integration.
Main settings are in src/config.py - this module provides
Graphiti-specific defaults and validation.
"""

# Default values for Graphiti configuration
GRAPHITI_DEFAULTS = {
    "neo4j_database": "neo4j",  # Default Neo4j database name
    "semaphore_limit": 10,  # Concurrency limit to prevent rate limiting
    "store_raw_content": True,  # Store raw episode content in graph
}

# Gemini model recommendations for Graphiti
# Graphiti uses LLM for entity extraction during episode ingestion
GEMINI_MODELS = {
    "extraction": "gemini-2.5-flash",  # Fast extraction for standard docs
    "deep_analysis": "gemini-2.5-pro",  # Detailed analysis for financial docs
}
