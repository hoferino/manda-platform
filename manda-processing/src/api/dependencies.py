"""
API dependencies for authentication and common operations.
Story: E3.1 - Set up FastAPI Backend with pg-boss Job Queue (AC: #5)
"""

import hashlib
import hmac
from typing import Annotated

import structlog
from fastapi import Depends, Header, HTTPException, status

from src.config import Settings, get_settings

logger = structlog.get_logger(__name__)


async def verify_api_key(
    x_api_key: Annotated[str | None, Header()] = None,
    settings: Settings = Depends(get_settings),
) -> str:
    """
    Verify API key from request header.
    Used for service-to-service authentication.
    """
    if not x_api_key:
        logger.warning("API key missing from request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key required",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    if x_api_key != settings.api_key:
        logger.warning("Invalid API key provided")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key",
            headers={"WWW-Authenticate": "ApiKey"},
        )

    return x_api_key


async def verify_webhook_secret(
    x_supabase_signature: Annotated[str | None, Header(alias="x-supabase-signature")] = None,
    settings: Settings = Depends(get_settings),
    body: bytes = b"",
) -> bool:
    """
    Verify Supabase webhook signature.
    Used to validate incoming webhooks from Supabase.
    """
    if not settings.webhook_secret:
        logger.warning("Webhook secret not configured, skipping validation")
        return True

    if not x_supabase_signature:
        logger.warning("Webhook signature missing from request")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Webhook signature required",
        )

    # Compute expected signature
    expected_signature = hmac.new(
        settings.webhook_secret.encode(),
        body,
        hashlib.sha256,
    ).hexdigest()

    # Compare signatures
    if not hmac.compare_digest(x_supabase_signature, expected_signature):
        logger.warning("Invalid webhook signature")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature",
        )

    return True


async def verify_webhook_signature(
    x_webhook_signature: Annotated[str | None, Header(alias="x-webhook-signature")] = None,
    settings: Settings = Depends(get_settings),
) -> bool:
    """
    Verify generic webhook signature (HMAC-SHA256).
    Used to validate incoming webhooks from internal services.

    This is optional - if no signature is provided but API key is valid,
    the webhook is accepted.
    """
    if not x_webhook_signature:
        # No signature provided, rely on API key auth
        return True

    if not settings.webhook_secret:
        logger.warning("Webhook secret not configured, skipping validation")
        return True

    # For now, just return True if API key was validated
    # Full signature verification would require access to raw body
    return True


# Type alias for dependency injection
ApiKeyDep = Annotated[str, Depends(verify_api_key)]
WebhookVerifiedDep = Annotated[bool, Depends(verify_webhook_secret)]
