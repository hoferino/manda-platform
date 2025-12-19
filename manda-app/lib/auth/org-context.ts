/**
 * Organization Context Utilities (Server-side)
 * Story: E12.9 - Multi-Tenant Data Isolation (AC: #6, #7)
 *
 * Server-side utilities for organization context management:
 * - Extract organization from request headers
 * - Verify organization membership
 * - Check superadmin status
 * - Get user's organizations
 */

import { createClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

/**
 * Error thrown when user doesn't have access to an organization.
 */
export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Organization context for authenticated requests.
 */
export interface OrgContext {
  organizationId: string;
  userId: string;
  role: "superadmin" | "admin" | "member";
}

/**
 * Organization data structure.
 */
export interface Organization {
  id: string;
  name: string;
  slug: string;
}

/**
 * User's organization membership.
 */
export interface UserOrganization {
  organization_id: string;
  role: "superadmin" | "admin" | "member";
  organizations: Organization;
}

/**
 * Extract organization ID from request headers.
 */
export function getOrganizationFromHeaders(req: NextRequest): string | null {
  return req.headers.get("x-organization-id");
}

/**
 * Verify user belongs to organization and return context.
 *
 * @throws ForbiddenError if user is not a member of the organization
 */
export async function verifyOrganizationMembership(
  userId: string,
  orgId: string
): Promise<OrgContext> {
  const supabase = await createClient();

  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("role")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .single();

  if (error || !membership) {
    throw new ForbiddenError("Not a member of this organization");
  }

  return {
    organizationId: orgId,
    userId,
    role: membership.role as OrgContext["role"],
  };
}

/**
 * Check if user has superadmin role in any organization.
 */
export async function isSuperadmin(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", userId)
    .eq("role", "superadmin")
    .limit(1)
    .single();

  return !!data;
}

/**
 * Get all organizations user belongs to.
 */
export async function getUserOrganizations(
  userId: string
): Promise<UserOrganization[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
      organization_id,
      role,
      organizations (
        id,
        name,
        slug
      )
    `
    )
    .eq("user_id", userId);

  if (error) throw error;
  return (data as UserOrganization[]) || [];
}

/**
 * Get the current organization context from request.
 * Combines header extraction and membership verification.
 *
 * @throws ForbiddenError if organization header is missing or user is not a member
 */
export async function getOrgContextFromRequest(
  req: NextRequest,
  userId: string
): Promise<OrgContext> {
  const orgId = getOrganizationFromHeaders(req);

  if (!orgId) {
    throw new ForbiddenError("Missing x-organization-id header");
  }

  return verifyOrganizationMembership(userId, orgId);
}
