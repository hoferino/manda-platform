"""
Configuration management using Pydantic Settings.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #3)
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "manda-processing"
    app_env: Literal["development", "staging", "production"] = "development"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # Database (Supabase PostgreSQL)
    database_url: str
    supabase_url: str
    supabase_service_role_key: str

    # Neo4j Graph Database (E4.15)
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    neo4j_database: str = "neo4j"  # E10.1: Custom database name for Graphiti

    # Graphiti Configuration (E10.1)
    graphiti_semaphore_limit: int = 10  # Concurrency limit to prevent rate limits

    # pg-boss configuration
    pgboss_schema: str = "pgboss"

    # API Security
    api_key: str
    webhook_secret: str = ""

    # Google Cloud Storage
    gcs_bucket: str = "manda-documents-dev"
    gcs_project_id: str = ""
    google_application_credentials: str = ""

    # Logging
    log_level: str = "INFO"
    log_format: Literal["json", "console"] = "console"

    # Document parsing (E3.2)
    parser_temp_dir: str = "/tmp/manda-processing"
    parser_ocr_enabled: bool = True
    parser_max_file_size_mb: int = 100
    chunk_min_tokens: int = 512
    chunk_max_tokens: int = 1024
    chunk_overlap_tokens: int = 50

    # Embeddings (E3.4)
    openai_api_key: str = ""
    embedding_model: str = "text-embedding-3-large"
    embedding_dimensions: int = 3072
    embedding_batch_size: int = 100  # OpenAI max per request

    # LLM Analysis (E3.5 - Gemini)
    google_api_key: str = ""  # Google API key for Gemini
    gemini_flash_model: str = "gemini-2.5-flash"  # Default for standard docs
    gemini_pro_model: str = "gemini-2.5-pro"  # For financial/deep analysis
    gemini_lite_model: str = "gemini-2.5-flash-lite"  # For batch processing
    llm_analysis_batch_size: int = 5  # Chunks per LLM call

    # Voyage AI Embeddings (E10.2, updated E10 retrospective)
    # voyage-3.5 outperforms voyage-finance-2 on finance AND all other domains
    # while being 50% cheaper ($0.06 vs $0.12 per 1M tokens)
    # See: https://blog.voyageai.com/2025/05/20/voyage-3-5/
    voyage_api_key: str = ""
    voyage_embedding_model: str = "voyage-3.5"
    voyage_embedding_dimensions: int = 1024  # voyage-3.5 supports 256-2048, keeping 1024 for compatibility

    # Voyage AI Reranking (E10.7)
    voyage_rerank_model: str = "rerank-2.5"
    voyage_rerank_top_k: int = 10

    # Retrieval Configuration (E10.7)
    retrieval_num_candidates: int = 50

    @property
    def is_development(self) -> bool:
        """Check if running in development mode."""
        return self.app_env == "development"

    @property
    def is_production(self) -> bool:
        """Check if running in production mode."""
        return self.app_env == "production"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
