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
