"""
Configuration management using Pydantic Settings.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #3)
Story: E11.6 - Model Configuration and Switching (AC: #1, #2)
"""

import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

import yaml
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

    # Pydantic AI Model Configuration (E11.5)
    # Model strings follow format: provider:model-name
    # Providers: google-gla (Gemini via AI Studio), google-vertex, anthropic, openai
    # Examples: 'google-gla:gemini-2.5-flash', 'anthropic:claude-sonnet-4-0'
    pydantic_ai_extraction_model: str = "google-gla:gemini-2.5-flash"
    pydantic_ai_analysis_model: str = "google-gla:gemini-2.5-pro"
    pydantic_ai_fallback_model: str = "anthropic:claude-sonnet-4-0"

    # Logfire Observability (E11.5 - Optional)
    # Set to enable Pydantic AI tracing via Logfire
    logfire_token: str = ""

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


# Model string validation pattern: provider:model-name
MODEL_STRING_PATTERN = re.compile(r"^[a-z][-a-z0-9]*:[a-zA-Z0-9][-a-zA-Z0-9_.]*$")


def validate_model_string(model_str: str) -> bool:
    """
    Validate that model string matches <provider>:<model> format.

    Args:
        model_str: Model string like 'google-gla:gemini-2.5-flash'

    Returns:
        True if valid, False otherwise

    Examples:
        validate_model_string('google-gla:gemini-2.5-flash')  # True
        validate_model_string('anthropic:claude-sonnet-4-0')  # True
        validate_model_string('invalid')  # False
        validate_model_string('provider:')  # False
    """
    return bool(MODEL_STRING_PATTERN.match(model_str))


@lru_cache
def load_model_config() -> dict[str, Any]:
    """
    Load model configuration from YAML, with graceful fallback to defaults.

    Story: E11.6 - Model Configuration and Switching (AC: #1, #2)

    The config file is located at: manda-processing/config/models.yaml
    If the file is missing or invalid, returns sensible defaults.

    Returns:
        Dictionary containing 'agents' and 'costs' configuration

    Raises:
        ValueError: If YAML exists but contains invalid model strings
    """
    # Config path relative to this file: src/config.py -> config/models.yaml
    config_path = Path(__file__).parent.parent / "config" / "models.yaml"

    default_config: dict[str, Any] = {
        "agents": {
            "extraction": {"primary": "google-gla:gemini-2.5-flash"},
            "analysis": {"primary": "google-gla:gemini-2.5-pro"},
        },
        "costs": {},
    }

    if not config_path.exists():
        return default_config

    with open(config_path) as f:
        config = yaml.safe_load(f)

    if not config or not isinstance(config, dict):
        return default_config

    # Validate model strings in agents section
    agents = config.get("agents", {})
    for agent_name, agent_config in agents.items():
        if isinstance(agent_config, dict):
            for key in ["primary", "fallback"]:
                model_str = agent_config.get(key)
                if model_str and not validate_model_string(model_str):
                    raise ValueError(
                        f"Invalid model string for agents.{agent_name}.{key}: "
                        f"'{model_str}' (expected format: 'provider:model-name')"
                    )

    return config


def get_agent_model_config(agent_type: str = "extraction") -> dict[str, Any]:
    """
    Get model configuration for a specific agent type.

    Checks environment variable override first, then falls back to YAML config.

    Args:
        agent_type: 'extraction', 'analysis', or custom agent type

    Returns:
        Dictionary with 'primary', 'fallback' (optional), and 'settings' (optional)
    """
    config = load_model_config()
    agent_config = config.get("agents", {}).get(agent_type, {})

    # Create a copy to avoid modifying cached config
    result = dict(agent_config)

    # Check env var override: PYDANTIC_AI_{AGENT_TYPE}_MODEL
    env_var = f"PYDANTIC_AI_{agent_type.upper()}_MODEL"
    env_override = os.getenv(env_var)
    if env_override:
        if not validate_model_string(env_override):
            raise ValueError(
                f"Invalid model string in {env_var}: '{env_override}' "
                f"(expected format: 'provider:model-name')"
            )
        result["primary"] = env_override

    # Fallback to settings if no config found
    if not result.get("primary"):
        settings = get_settings()
        if agent_type == "extraction":
            result["primary"] = settings.pydantic_ai_extraction_model
        elif agent_type == "analysis":
            result["primary"] = settings.pydantic_ai_analysis_model
        else:
            result["primary"] = settings.pydantic_ai_extraction_model

        # Use fallback from settings
        if not result.get("fallback"):
            result["fallback"] = settings.pydantic_ai_fallback_model

    return result


def get_model_costs(model_str: str) -> dict[str, float]:
    """
    Get cost rates for a specific model.

    Args:
        model_str: Model string like 'google-gla:gemini-2.5-flash'

    Returns:
        Dictionary with 'input' and 'output' costs per 1M tokens (USD)
        Returns {'input': 0, 'output': 0} if model not found in config
    """
    config = load_model_config()
    costs = config.get("costs", {})
    return costs.get(model_str, {"input": 0, "output": 0})
