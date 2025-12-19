import { describe, it, expect } from "vitest";
import type {
  DailyCost,
  FeatureCost,
  ModelCost,
  UsageSummary,
  DealCostSummary,
  ErrorLogEntry,
  DateRange,
  DashboardData,
} from "@/lib/types/dashboard";

describe("Dashboard Types", () => {
  it("DailyCost has expected shape", () => {
    const dailyCost: DailyCost = {
      date: "2025-12-19",
      costUsd: 1.23,
      inputTokens: 10000,
      outputTokens: 5000,
      callCount: 50,
    };
    expect(dailyCost.date).toBe("2025-12-19");
    expect(dailyCost.costUsd).toBe(1.23);
    expect(dailyCost.inputTokens).toBe(10000);
    expect(dailyCost.outputTokens).toBe(5000);
    expect(dailyCost.callCount).toBe(50);
  });

  it("FeatureCost has expected shape", () => {
    const featureCost: FeatureCost = {
      feature: "chat",
      costUsd: 5.67,
      callCount: 100,
      avgLatencyMs: 1234,
    };
    expect(featureCost.feature).toBe("chat");
    expect(featureCost.costUsd).toBe(5.67);
    expect(featureCost.callCount).toBe(100);
    expect(featureCost.avgLatencyMs).toBe(1234);
  });

  it("ModelCost has expected shape", () => {
    const modelCost: ModelCost = {
      provider: "anthropic",
      model: "claude-sonnet-4-0",
      costUsd: 12.34,
      callCount: 200,
      totalTokens: 500000,
    };
    expect(modelCost.provider).toBe("anthropic");
    expect(modelCost.model).toBe("claude-sonnet-4-0");
    expect(modelCost.costUsd).toBe(12.34);
    expect(modelCost.callCount).toBe(200);
    expect(modelCost.totalTokens).toBe(500000);
  });

  it("UsageSummary has expected shape", () => {
    const summary: UsageSummary = {
      totalCostUsd: 50,
      totalCalls: 1000,
      totalTokens: 5000000,
      avgLatencyMs: 800,
      errorCount: 5,
      errorRate: 0.5,
    };
    expect(summary.totalCostUsd).toBe(50);
    expect(summary.totalCalls).toBe(1000);
    expect(summary.totalTokens).toBe(5000000);
    expect(summary.avgLatencyMs).toBe(800);
    expect(summary.errorCount).toBe(5);
    expect(summary.errorRate).toBe(0.5);
  });

  it("DealCostSummary has expected shape", () => {
    const deal: DealCostSummary = {
      dealId: "deal-123",
      dealName: "Acme Corp Acquisition",
      organizationName: "Example Org",
      totalCostUsd: 25.50,
      conversationCount: 15,
      documentCount: 8,
      lastActivity: "2025-12-19T10:00:00Z",
    };
    expect(deal.dealId).toBe("deal-123");
    expect(deal.dealName).toBe("Acme Corp Acquisition");
    expect(deal.organizationName).toBe("Example Org");
    expect(deal.totalCostUsd).toBe(25.5);
    expect(deal.conversationCount).toBe(15);
    expect(deal.documentCount).toBe(8);
    expect(deal.lastActivity).toBe("2025-12-19T10:00:00Z");
  });

  it("DealCostSummary allows null lastActivity", () => {
    const deal: DealCostSummary = {
      dealId: "deal-456",
      dealName: "New Deal",
      organizationName: "Org",
      totalCostUsd: 0,
      conversationCount: 0,
      documentCount: 0,
      lastActivity: null,
    };
    expect(deal.lastActivity).toBeNull();
  });

  it("ErrorLogEntry has expected shape", () => {
    const error: ErrorLogEntry = {
      id: "err-123",
      featureName: "document_analysis",
      dealId: "deal-123",
      dealName: "Test Deal",
      errorMessage: "Rate limit exceeded",
      durationMs: 5000,
      metadata: { provider: "anthropic" },
      createdAt: "2025-12-19T09:00:00Z",
    };
    expect(error.id).toBe("err-123");
    expect(error.featureName).toBe("document_analysis");
    expect(error.dealId).toBe("deal-123");
    expect(error.errorMessage).toBe("Rate limit exceeded");
    expect(error.durationMs).toBe(5000);
    expect(error.metadata).toEqual({ provider: "anthropic" });
  });

  it("ErrorLogEntry allows null values", () => {
    const error: ErrorLogEntry = {
      id: "err-456",
      featureName: "chat",
      dealId: null,
      dealName: "Unknown",
      errorMessage: null,
      durationMs: null,
      metadata: null,
      createdAt: "2025-12-19T09:00:00Z",
    };
    expect(error.dealId).toBeNull();
    expect(error.errorMessage).toBeNull();
    expect(error.durationMs).toBeNull();
    expect(error.metadata).toBeNull();
  });

  it("DateRange has expected shape", () => {
    const dateRange: DateRange = {
      startDate: new Date("2025-12-01"),
      endDate: new Date("2025-12-19"),
      preset: "30d",
    };
    expect(dateRange.startDate).toBeInstanceOf(Date);
    expect(dateRange.endDate).toBeInstanceOf(Date);
    expect(dateRange.preset).toBe("30d");
  });

  it("DateRange supports all presets", () => {
    const presets: DateRange["preset"][] = ["7d", "30d", "90d", "custom"];
    presets.forEach((preset) => {
      const range: DateRange = {
        startDate: new Date(),
        endDate: new Date(),
        preset,
      };
      expect(range.preset).toBe(preset);
    });
  });

  it("DashboardData has expected structure", () => {
    const dashboardData: DashboardData = {
      summary: {
        totalCostUsd: 100,
        totalCalls: 500,
        totalTokens: 2000000,
        avgLatencyMs: 750,
        errorCount: 3,
        errorRate: 0.6,
      },
      dailyCosts: [
        { date: "2025-12-19", costUsd: 10, inputTokens: 5000, outputTokens: 2500, callCount: 25 },
      ],
      featureCosts: [{ feature: "chat", costUsd: 50, callCount: 200, avgLatencyMs: 800 }],
      modelCosts: [
        { provider: "anthropic", model: "claude-sonnet-4-0", costUsd: 75, callCount: 300, totalTokens: 1500000 },
      ],
      dealSummaries: [
        {
          dealId: "d1",
          dealName: "Deal 1",
          organizationName: "Org 1",
          totalCostUsd: 100,
          conversationCount: 10,
          documentCount: 5,
          lastActivity: "2025-12-19T10:00:00Z",
        },
      ],
      recentErrors: [],
      dateRange: {
        startDate: new Date("2025-12-01"),
        endDate: new Date("2025-12-19"),
        preset: "30d",
      },
    };

    expect(dashboardData.summary.totalCostUsd).toBe(100);
    expect(dashboardData.dailyCosts).toHaveLength(1);
    expect(dashboardData.featureCosts).toHaveLength(1);
    expect(dashboardData.modelCosts).toHaveLength(1);
    expect(dashboardData.dealSummaries).toHaveLength(1);
    expect(dashboardData.recentErrors).toHaveLength(0);
    expect(dashboardData.dateRange.preset).toBe("30d");
  });
});
