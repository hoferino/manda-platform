"""
Usage logging service for LLM and feature tracking.
Story: E12.2 - Usage Logging Integration (AC: #1, #4, #5)

This module provides async functions to persist usage data to PostgreSQL
using asyncpg (following the established supabase_client.py pattern).
"""

import json
import asyncpg
import structlog
from typing import Any, Optional
from uuid import UUID

from src.storage.supabase_client import SupabaseClient

logger = structlog.get_logger(__name__)


async def log_llm_usage_to_db(
    db: SupabaseClient,
    *,
    organization_id: Optional[UUID] = None,
    deal_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    provider: str,
    model: str,
    feature: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: float,
    latency_ms: Optional[int] = None,
) -> Optional[str]:
    """
    Persist LLM usage to database using asyncpg.

    IMPORTANT: Uses asyncpg raw SQL pattern (NOT Supabase SDK).
    See supabase_client.py for reference pattern.

    Args:
        db: SupabaseClient instance (provides asyncpg pool)
        organization_id: Organization for multi-tenant isolation (E12.9)
        deal_id: Deal context for the LLM call
        user_id: User who initiated the call
        provider: LLM provider (google-gla, anthropic, voyage, openai)
        model: Model identifier (gemini-2.5-flash, claude-sonnet-4-0)
        feature: Feature using LLM (chat, document_analysis, extraction, etc.)
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        cost_usd: Calculated cost in USD
        latency_ms: Optional latency in milliseconds

    Returns:
        Created record ID as string, or None if insert failed
    """
    try:
        pool = await db._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO llm_usage (
                    organization_id, deal_id, user_id,
                    provider, model, feature,
                    input_tokens, output_tokens, cost_usd, latency_ms
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING id
                """,
                organization_id,
                deal_id,
                user_id,
                provider,
                model,
                feature,
                input_tokens,
                output_tokens,
                round(cost_usd, 6),
                latency_ms,
            )
            return str(row["id"]) if row else None

    except asyncpg.PostgresError as e:
        logger.error(
            "llm_usage_db_insert_failed",
            error=str(e),
            provider=provider,
            model=model,
            feature=feature,
        )
        return None
    except Exception as e:
        logger.error(
            "llm_usage_unexpected_error",
            error=str(e),
            provider=provider,
            model=model,
        )
        return None


async def log_feature_usage_to_db(
    db: SupabaseClient,
    *,
    organization_id: Optional[UUID] = None,
    deal_id: Optional[UUID] = None,
    user_id: Optional[UUID] = None,
    feature_name: str,
    status: str,
    duration_ms: Optional[int] = None,
    error_message: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Optional[str]:
    """
    Persist feature usage to database using asyncpg.

    IMPORTANT: Uses asyncpg raw SQL pattern (NOT Supabase SDK).

    Args:
        db: SupabaseClient instance (provides asyncpg pool)
        organization_id: Organization for multi-tenant isolation (E12.9)
        deal_id: Deal context for the feature execution
        user_id: User who initiated the feature
        feature_name: Name of feature (upload_document, chat, search, etc.)
        status: Execution status (success, error, timeout)
        duration_ms: Optional execution duration in milliseconds
        error_message: Error message if status is 'error'
        metadata: Optional additional context as JSON

    Returns:
        Created record ID as string, or None if insert failed
    """
    try:
        # Convert metadata dict to JSON string for JSONB column
        metadata_json = json.dumps(metadata) if metadata else None

        pool = await db._get_pool()
        async with pool.acquire() as conn:
            row = await conn.fetchrow(
                """
                INSERT INTO feature_usage (
                    organization_id, deal_id, user_id,
                    feature_name, status, duration_ms,
                    error_message, metadata
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
                RETURNING id
                """,
                organization_id,
                deal_id,
                user_id,
                feature_name,
                status,
                duration_ms,
                error_message,
                metadata_json,
            )
            return str(row["id"]) if row else None

    except asyncpg.PostgresError as e:
        logger.error(
            "feature_usage_db_insert_failed",
            error=str(e),
            feature_name=feature_name,
            status=status,
        )
        return None
    except Exception as e:
        logger.error(
            "feature_usage_unexpected_error",
            error=str(e),
            feature_name=feature_name,
        )
        return None
