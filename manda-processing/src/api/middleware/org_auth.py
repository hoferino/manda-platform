"""
Organization authentication middleware for FastAPI.
Story: E12.9 - Multi-Tenant Data Isolation (AC: #6, #7)

This module provides FastAPI dependencies for:
- Extracting and validating organization context from request headers
- Verifying user membership in organizations
- Checking superadmin privileges
"""

from typing import Annotated
from uuid import UUID

import structlog
from fastapi import Depends, Header, HTTPException
from pydantic import BaseModel
from supabase import create_client, Client

from src.config import Settings, get_settings

logger = structlog.get_logger(__name__)


class OrgContext(BaseModel):
    """Validated organization context from request."""

    organization_id: UUID
    user_id: UUID
    role: str

    def is_superadmin(self) -> bool:
        """Check if user has superadmin role."""
        return self.role == "superadmin"

    def is_admin_or_above(self) -> bool:
        """Check if user has admin or superadmin role."""
        return self.role in ("superadmin", "admin")


def get_supabase_admin_client(settings: Settings = Depends(get_settings)) -> Client:
    """
    Get Supabase admin client using service role key.
    This bypasses RLS for organization membership verification.
    """
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


async def get_current_user_id(
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    settings: Settings = Depends(get_settings),
) -> str:
    """
    Extract and validate user ID from Supabase JWT token.

    The Authorization header should contain: Bearer <jwt_token>
    """
    if not authorization:
        logger.warning("Authorization header missing")
        raise HTTPException(
            status_code=401,
            detail="Authorization header required",
        )

    if not authorization.startswith("Bearer "):
        logger.warning("Invalid authorization header format")
        raise HTTPException(
            status_code=401,
            detail="Invalid authorization header format",
        )

    token = authorization.replace("Bearer ", "")

    # Create Supabase client to verify token
    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    try:
        # Verify JWT and get user
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return str(user_response.user.id)
    except Exception as e:
        logger.warning("Token validation failed", error=str(e))
        raise HTTPException(status_code=401, detail=f"Token validation failed: {e}")


async def verify_org_membership(
    x_organization_id: Annotated[str | None, Header()] = None,
    user_id: str = Depends(get_current_user_id),
    settings: Settings = Depends(get_settings),
) -> OrgContext:
    """
    Verify user belongs to organization, return context.

    Requires x-organization-id header to be present.
    Uses service role key to query organization_members table (bypasses RLS).

    Args:
        x_organization_id: Organization ID from request header
        user_id: User ID from validated JWT token
        settings: Application settings

    Returns:
        OrgContext with organization_id, user_id, and role

    Raises:
        HTTPException 400: Missing x-organization-id header
        HTTPException 403: User not a member of organization
    """
    if not x_organization_id:
        logger.warning("Missing x-organization-id header", user_id=user_id)
        raise HTTPException(
            status_code=400,
            detail="Missing x-organization-id header",
        )

    # Use service role to bypass RLS and verify membership
    supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)

    try:
        result = (
            supabase.table("organization_members")
            .select("role")
            .eq("user_id", user_id)
            .eq("organization_id", x_organization_id)
            .single()
            .execute()
        )

        if not result.data:
            logger.warning(
                "User not a member of organization",
                user_id=user_id,
                organization_id=x_organization_id,
            )
            raise HTTPException(
                status_code=403,
                detail="Not a member of this organization",
            )

        logger.debug(
            "Organization membership verified",
            user_id=user_id,
            organization_id=x_organization_id,
            role=result.data["role"],
        )

        return OrgContext(
            organization_id=UUID(x_organization_id),
            user_id=UUID(user_id),
            role=result.data["role"],
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Failed to verify organization membership",
            user_id=user_id,
            organization_id=x_organization_id,
            error=str(e),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to verify organization membership: {e}",
        )


async def get_optional_org_context(
    x_organization_id: Annotated[str | None, Header()] = None,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
    settings: Settings = Depends(get_settings),
) -> OrgContext | None:
    """
    Get organization context if headers are present, otherwise return None.

    Useful for routes that can work with or without organization context.
    """
    if not authorization or not x_organization_id:
        return None

    try:
        user_id = await get_current_user_id(authorization, settings)
        return await verify_org_membership(x_organization_id, user_id, settings)
    except HTTPException:
        return None


# Type alias for cleaner route definitions
OrgAuth = Annotated[OrgContext, Depends(verify_org_membership)]
OptionalOrgAuth = Annotated[OrgContext | None, Depends(get_optional_org_context)]
