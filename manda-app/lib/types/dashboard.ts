/**
 * Dashboard types for E12.3 Developer Usage Dashboard.
 */

export interface DailyCost {
  date: string;
  costUsd: number;
  inputTokens: number;
  outputTokens: number;
  callCount: number;
}

export interface FeatureCost {
  feature: string;
  costUsd: number;
  callCount: number;
  avgLatencyMs: number;
}

export interface ModelCost {
  provider: string;
  model: string;
  costUsd: number;
  callCount: number;
  totalTokens: number;
}

export interface DealCostSummary {
  dealId: string;
  dealName: string;
  organizationName: string;
  totalCostUsd: number;
  conversationCount: number;
  documentCount: number;
  lastActivity: string | null;
}

export interface ErrorLogEntry {
  id: string;
  featureName: string;
  dealId: string | null;
  dealName: string;
  errorMessage: string | null;
  durationMs: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface UsageSummary {
  totalCostUsd: number;
  totalCalls: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorCount: number;
  errorRate: number;
}

export type DateRangePreset = "7d" | "30d" | "90d" | "custom";

export type Granularity = "day" | "week" | "month";

export interface DateRange {
  startDate: Date;
  endDate: Date;
  preset: DateRangePreset;
}

export interface DashboardData {
  summary: UsageSummary;
  dailyCosts: DailyCost[];
  featureCosts: FeatureCost[];
  modelCosts: ModelCost[];
  dealSummaries: DealCostSummary[];
  recentErrors: ErrorLogEntry[];
  dateRange: DateRange;
}
