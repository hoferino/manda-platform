import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportToCSV, fetchDashboardData } from "@/app/dev/usage/actions";
import type { DashboardData, DateRange } from "@/lib/types/dashboard";

// Mock Supabase client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// Mock auth check
vi.mock("@/lib/auth/org-context", () => ({
  isSuperadmin: vi.fn(),
}));

describe("Dashboard Actions", () => {
  describe("exportToCSV", () => {
    it("generates valid CSV with all sections", () => {
      const mockData: DashboardData = {
        summary: {
          totalCostUsd: 100.5,
          totalCalls: 1000,
          totalTokens: 5000000,
          avgLatencyMs: 800,
          errorCount: 5,
          errorRate: 0.5,
        },
        dailyCosts: [
          {
            date: "2025-12-19",
            costUsd: 50.25,
            inputTokens: 2000000,
            outputTokens: 1000000,
            callCount: 500,
          },
        ],
        featureCosts: [
          { feature: "chat", costUsd: 75.0, callCount: 700, avgLatencyMs: 1000 },
        ],
        modelCosts: [
          {
            provider: "anthropic",
            model: "claude-sonnet-4-0",
            costUsd: 80.0,
            callCount: 600,
            totalTokens: 4000000,
          },
        ],
        dealSummaries: [
          {
            dealId: "deal-1",
            dealName: "Test Deal",
            organizationName: "Test Org",
            totalCostUsd: 100.5,
            conversationCount: 10,
            documentCount: 5,
            lastActivity: "2025-12-19T10:00:00Z",
          },
        ],
        recentErrors: [
          {
            id: "err-1",
            featureName: "chat",
            dealId: "deal-1",
            dealName: "Test Deal",
            errorMessage: "Rate limit",
            durationMs: 5000,
            metadata: null,
            createdAt: "2025-12-19T09:00:00Z",
          },
        ],
        dateRange: {
          startDate: new Date("2025-12-01"),
          endDate: new Date("2025-12-19"),
          preset: "30d",
        },
      };

      const csv = exportToCSV(mockData);

      // Check all sections exist
      expect(csv).toContain("# Usage Summary");
      expect(csv).toContain("# Daily Costs");
      expect(csv).toContain("# Cost by Feature");
      expect(csv).toContain("# Cost by Model");
      expect(csv).toContain("# Deal Cost Summary");
      expect(csv).toContain("# Recent Errors");

      // Check summary values
      expect(csv).toContain("Total Cost (USD),100.5000");
      expect(csv).toContain("Total API Calls,1000");
      expect(csv).toContain("Total Tokens,5000000");
      expect(csv).toContain("Avg Latency (ms),800");
      expect(csv).toContain("Error Count,5");
      expect(csv).toContain("Error Rate (%),0.50");

      // Check data values
      expect(csv).toContain("chat");
      expect(csv).toContain("claude-sonnet-4-0");
      expect(csv).toContain("Test Deal");
      expect(csv).toContain("Test Org");
      expect(csv).toContain("Rate limit");
    });

    it("handles empty data gracefully", () => {
      const emptyData: DashboardData = {
        summary: {
          totalCostUsd: 0,
          totalCalls: 0,
          totalTokens: 0,
          avgLatencyMs: 0,
          errorCount: 0,
          errorRate: 0,
        },
        dailyCosts: [],
        featureCosts: [],
        modelCosts: [],
        dealSummaries: [],
        recentErrors: [],
        dateRange: {
          startDate: new Date(),
          endDate: new Date(),
          preset: "7d",
        },
      };

      const csv = exportToCSV(emptyData);

      expect(csv).toContain("Total Cost (USD),0.0000");
      expect(csv).toContain("Total API Calls,0");
      expect(csv).toContain("Error Rate (%),0.00");
      // Sections should still exist even if empty
      expect(csv).toContain("# Daily Costs");
      expect(csv).toContain("# Cost by Feature");
    });

    it("escapes quotes in error messages", () => {
      const dataWithQuotes: DashboardData = {
        summary: {
          totalCostUsd: 0,
          totalCalls: 0,
          totalTokens: 0,
          avgLatencyMs: 0,
          errorCount: 1,
          errorRate: 100,
        },
        dailyCosts: [],
        featureCosts: [],
        modelCosts: [],
        dealSummaries: [],
        recentErrors: [
          {
            id: "err-1",
            featureName: "test",
            dealId: null,
            dealName: "Deal",
            errorMessage: 'Error with "quotes" inside',
            durationMs: 100,
            metadata: null,
            createdAt: "2025-12-19T10:00:00Z",
          },
        ],
        dateRange: {
          startDate: new Date(),
          endDate: new Date(),
          preset: "7d",
        },
      };

      const csv = exportToCSV(dataWithQuotes);
      // CSV escaping doubles the quotes
      expect(csv).toContain('""quotes""');
    });

    it("handles null error messages", () => {
      const dataWithNullError: DashboardData = {
        summary: {
          totalCostUsd: 0,
          totalCalls: 0,
          totalTokens: 0,
          avgLatencyMs: 0,
          errorCount: 1,
          errorRate: 100,
        },
        dailyCosts: [],
        featureCosts: [],
        modelCosts: [],
        dealSummaries: [],
        recentErrors: [
          {
            id: "err-1",
            featureName: "test",
            dealId: null,
            dealName: "Deal",
            errorMessage: null,
            durationMs: null,
            metadata: null,
            createdAt: "2025-12-19T10:00:00Z",
          },
        ],
        dateRange: {
          startDate: new Date(),
          endDate: new Date(),
          preset: "7d",
        },
      };

      const csv = exportToCSV(dataWithNullError);
      // Should not throw and should include empty string for null
      expect(csv).toContain("# Recent Errors");
      expect(csv).toContain('test,"Deal",""');
    });

    it("formats numbers correctly", () => {
      const data: DashboardData = {
        summary: {
          totalCostUsd: 123.456789,
          totalCalls: 999,
          totalTokens: 1234567,
          avgLatencyMs: 123.7,
          errorCount: 0,
          errorRate: 0,
        },
        dailyCosts: [
          {
            date: "2025-12-19",
            costUsd: 0.000123,
            inputTokens: 100,
            outputTokens: 50,
            callCount: 1,
          },
        ],
        featureCosts: [
          { feature: "test", costUsd: 12.3456, callCount: 10, avgLatencyMs: 567.89 },
        ],
        modelCosts: [],
        dealSummaries: [],
        recentErrors: [],
        dateRange: {
          startDate: new Date(),
          endDate: new Date(),
          preset: "7d",
        },
      };

      const csv = exportToCSV(data);

      // Summary should have 4 decimal places
      expect(csv).toContain("Total Cost (USD),123.4568");
      // Latency should be rounded to integer
      expect(csv).toContain("Avg Latency (ms),124");
      // Daily cost should have 6 decimal places
      expect(csv).toContain("0.000123");
    });

    it("handles deal names with commas", () => {
      const data: DashboardData = {
        summary: {
          totalCostUsd: 0,
          totalCalls: 0,
          totalTokens: 0,
          avgLatencyMs: 0,
          errorCount: 0,
          errorRate: 0,
        },
        dailyCosts: [],
        featureCosts: [],
        modelCosts: [],
        dealSummaries: [
          {
            dealId: "d1",
            dealName: "Acme, Inc. Acquisition",
            organizationName: "Tech Corp, LLC",
            totalCostUsd: 50,
            conversationCount: 5,
            documentCount: 3,
            lastActivity: "2025-12-19T10:00:00Z",
          },
        ],
        recentErrors: [],
        dateRange: {
          startDate: new Date(),
          endDate: new Date(),
          preset: "7d",
        },
      };

      const csv = exportToCSV(data);
      // Deal names should be quoted to handle commas
      expect(csv).toContain('"Acme, Inc. Acquisition"');
      expect(csv).toContain('"Tech Corp, LLC"');
    });
  });

  describe("fetchDashboardData", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
    });

    it("throws error when user is not authenticated", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);

      const dateRange: DateRange = {
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-19"),
        preset: "30d",
      };

      await expect(fetchDashboardData(dateRange)).rejects.toThrow(
        "Unauthorized: Superadmin access required"
      );
    });

    it("throws error when user is not a superadmin", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { isSuperadmin } = await import("@/lib/auth/org-context");

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: "user-123" } } }),
        },
      } as unknown as Awaited<ReturnType<typeof createClient>>);
      vi.mocked(isSuperadmin).mockResolvedValue(false);

      const dateRange: DateRange = {
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-19"),
        preset: "30d",
      };

      await expect(fetchDashboardData(dateRange)).rejects.toThrow(
        "Unauthorized: Superadmin access required"
      );
    });

    it("returns dashboard data for superadmin user", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { isSuperadmin } = await import("@/lib/auth/org-context");

      const mockRpc = vi.fn().mockImplementation((funcName: string) => {
        switch (funcName) {
          case "get_usage_summary":
            return Promise.resolve({
              data: [
                {
                  total_cost_usd: 100.5,
                  total_calls: 1000,
                  total_tokens: 5000000,
                  avg_latency_ms: 800,
                  error_count: 5,
                  error_rate: 0.5,
                },
              ],
              error: null,
            });
          case "get_daily_costs":
            return Promise.resolve({
              data: [
                {
                  date: "2025-12-19",
                  cost_usd: 50.25,
                  input_tokens: 2000000,
                  output_tokens: 1000000,
                  call_count: 500,
                },
              ],
              error: null,
            });
          case "get_costs_by_feature":
            return Promise.resolve({
              data: [
                { feature: "chat", cost_usd: 75.0, call_count: 700, avg_latency_ms: 1000 },
              ],
              error: null,
            });
          case "get_costs_by_model":
            return Promise.resolve({
              data: [
                {
                  provider: "anthropic",
                  model: "claude-sonnet-4-0",
                  cost_usd: 80.0,
                  call_count: 600,
                  total_tokens: 4000000,
                },
              ],
              error: null,
            });
          case "get_deal_cost_summary":
            return Promise.resolve({
              data: [
                {
                  deal_id: "deal-1",
                  deal_name: "Test Deal",
                  organization_name: "Test Org",
                  total_cost_usd: 100.5,
                  conversation_count: 10,
                  document_count: 5,
                  last_activity: "2025-12-19T10:00:00Z",
                },
              ],
              error: null,
            });
          case "get_recent_errors":
            return Promise.resolve({
              data: [
                {
                  id: "err-1",
                  feature_name: "chat",
                  deal_id: "deal-1",
                  deal_name: "Test Deal",
                  error_message: "Rate limit",
                  duration_ms: 5000,
                  metadata: null,
                  created_at: "2025-12-19T09:00:00Z",
                },
              ],
              error: null,
            });
          default:
            return Promise.resolve({ data: [], error: null });
        }
      });

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: "superadmin-123" } } }),
        },
        rpc: mockRpc,
      } as unknown as Awaited<ReturnType<typeof createClient>>);
      vi.mocked(isSuperadmin).mockResolvedValue(true);

      const dateRange: DateRange = {
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-19"),
        preset: "30d",
      };

      const result = await fetchDashboardData(dateRange);

      expect(result.summary.totalCostUsd).toBe(100.5);
      expect(result.summary.totalCalls).toBe(1000);
      expect(result.dailyCosts).toHaveLength(1);
      expect(result.dailyCosts[0]?.costUsd).toBe(50.25);
      expect(result.featureCosts).toHaveLength(1);
      expect(result.featureCosts[0]?.feature).toBe("chat");
      expect(result.modelCosts).toHaveLength(1);
      expect(result.modelCosts[0]?.provider).toBe("anthropic");
      expect(result.dealSummaries).toHaveLength(1);
      expect(result.dealSummaries[0]?.dealName).toBe("Test Deal");
      expect(result.recentErrors).toHaveLength(1);
      expect(result.recentErrors[0]?.errorMessage).toBe("Rate limit");
    });

    it("handles partial RPC failures gracefully", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { isSuperadmin } = await import("@/lib/auth/org-context");

      const mockRpc = vi.fn().mockImplementation((funcName: string) => {
        if (funcName === "get_usage_summary") {
          return Promise.resolve({
            data: [
              {
                total_cost_usd: 50,
                total_calls: 500,
                total_tokens: 2500000,
                avg_latency_ms: 700,
                error_count: 0,
                error_rate: 0,
              },
            ],
            error: null,
          });
        }
        // Simulate failure for other RPC calls
        return Promise.reject(new Error("RPC failed"));
      });

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: "superadmin-123" } } }),
        },
        rpc: mockRpc,
      } as unknown as Awaited<ReturnType<typeof createClient>>);
      vi.mocked(isSuperadmin).mockResolvedValue(true);

      const dateRange: DateRange = {
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-19"),
        preset: "30d",
      };

      const result = await fetchDashboardData(dateRange);

      // Summary should be populated
      expect(result.summary.totalCostUsd).toBe(50);
      // Other fields should be empty arrays due to failures
      expect(result.dailyCosts).toHaveLength(0);
      expect(result.featureCosts).toHaveLength(0);
      expect(result.modelCosts).toHaveLength(0);
      expect(result.dealSummaries).toHaveLength(0);
      expect(result.recentErrors).toHaveLength(0);
    });

    it("returns default summary when summary RPC fails", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { isSuperadmin } = await import("@/lib/auth/org-context");

      const mockRpc = vi.fn().mockImplementation((funcName: string) => {
        if (funcName === "get_usage_summary") {
          return Promise.resolve({ data: null, error: { message: "Failed" } });
        }
        return Promise.resolve({ data: [], error: null });
      });

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: "superadmin-123" } } }),
        },
        rpc: mockRpc,
      } as unknown as Awaited<ReturnType<typeof createClient>>);
      vi.mocked(isSuperadmin).mockResolvedValue(true);

      const dateRange: DateRange = {
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-19"),
        preset: "30d",
      };

      const result = await fetchDashboardData(dateRange);

      // Should return default summary values
      expect(result.summary.totalCostUsd).toBe(0);
      expect(result.summary.totalCalls).toBe(0);
      expect(result.summary.totalTokens).toBe(0);
      expect(result.summary.avgLatencyMs).toBe(0);
      expect(result.summary.errorCount).toBe(0);
      expect(result.summary.errorRate).toBe(0);
    });

    it("correctly formats date range for RPC calls", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { isSuperadmin } = await import("@/lib/auth/org-context");

      const mockRpc = vi.fn().mockResolvedValue({ data: [], error: null });

      vi.mocked(createClient).mockResolvedValue({
        auth: {
          getUser: vi
            .fn()
            .mockResolvedValue({ data: { user: { id: "superadmin-123" } } }),
        },
        rpc: mockRpc,
      } as unknown as Awaited<ReturnType<typeof createClient>>);
      vi.mocked(isSuperadmin).mockResolvedValue(true);

      const dateRange: DateRange = {
        startDate: new Date("2025-12-01T12:30:00Z"),
        endDate: new Date("2025-12-19T15:45:00Z"),
        preset: "custom",
      };

      await fetchDashboardData(dateRange);

      // Verify date formatting - should only include date part
      expect(mockRpc).toHaveBeenCalledWith("get_usage_summary", {
        p_start_date: "2025-12-01",
        p_end_date: "2025-12-19",
      });
    });
  });
});
