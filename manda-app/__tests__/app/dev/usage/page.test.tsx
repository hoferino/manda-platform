import { describe, it, expect, vi, beforeEach } from "vitest";
import { redirect } from "next/navigation";

// Mock dependencies before importing
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/auth/org-context", () => ({
  isSuperadmin: vi.fn(),
}));

describe("UsageDashboardPage Authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("redirects to /login when user is not authenticated", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
      },
    } as any);

    const { default: UsageDashboardPage } = await import(
      "@/app/dev/usage/page"
    );

    await expect(UsageDashboardPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects non-superadmin users to /projects", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { isSuperadmin } = await import("@/lib/auth/org-context");

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "user-123" } } }),
      },
    } as any);
    vi.mocked(isSuperadmin).mockResolvedValue(false);

    const { default: UsageDashboardPage } = await import(
      "@/app/dev/usage/page"
    );

    await expect(UsageDashboardPage()).rejects.toThrow("NEXT_REDIRECT");
    expect(redirect).toHaveBeenCalledWith("/projects");
  });

  it("allows superadmin users to access the page", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { isSuperadmin } = await import("@/lib/auth/org-context");

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: "superadmin-123" } } }),
      },
    } as any);
    vi.mocked(isSuperadmin).mockResolvedValue(true);

    const { default: UsageDashboardPage } = await import(
      "@/app/dev/usage/page"
    );

    // Should not throw - page renders successfully
    const result = await UsageDashboardPage();

    // Verify redirect was not called with /projects or /login
    expect(redirect).not.toHaveBeenCalledWith("/projects");
    expect(redirect).not.toHaveBeenCalledWith("/login");

    // Result should be a valid React element (the page content)
    expect(result).toBeDefined();
  });

  it("calls isSuperadmin with correct user id", async () => {
    const { createClient } = await import("@/lib/supabase/server");
    const { isSuperadmin } = await import("@/lib/auth/org-context");

    const testUserId = "test-user-id-456";

    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: testUserId } } }),
      },
    } as any);
    vi.mocked(isSuperadmin).mockResolvedValue(false);

    const { default: UsageDashboardPage } = await import(
      "@/app/dev/usage/page"
    );

    try {
      await UsageDashboardPage();
    } catch {
      // Expected redirect
    }

    expect(isSuperadmin).toHaveBeenCalledWith(testUserId);
  });
});

describe("UsageDashboardPage Metadata", () => {
  it("exports correct metadata", async () => {
    const { metadata } = await import("@/app/dev/usage/page");

    expect(metadata.title).toBe("Usage Dashboard | Manda Dev");
    expect(metadata.description).toBe(
      "Developer usage metrics and cost tracking"
    );
  });
});
