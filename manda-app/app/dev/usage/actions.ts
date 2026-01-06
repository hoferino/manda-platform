"use server";

/**
 * Server actions for dashboard data fetching.
 * Uses server-side Supabase client for security.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  DailyCost,
  FeatureCost,
  ModelCost,
  DealCostSummary,
  ErrorLogEntry,
  UsageSummary,
  DashboardData,
  DateRange,
} from "@/lib/types/dashboard";
import { isSuperadmin } from "@/lib/auth/org-context";

interface RpcRow {
  [key: string]: unknown;
}

export async function fetchDashboardData(
  dateRange: DateRange
): Promise<DashboardData> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isSuperadmin(user.id))) {
    throw new Error("Unauthorized: Superadmin access required");
  }

  const startDate = dateRange.startDate.toISOString().split("T")[0] as string;
  const endDate = dateRange.endDate.toISOString().split("T")[0] as string;

  // Fetch all data in parallel with error handling per query
  const results = await Promise.allSettled([
    supabase.rpc("get_usage_summary", {
      p_start_date: startDate,
      p_end_date: endDate,
    }),
    supabase.rpc("get_daily_costs", {
      p_start_date: startDate,
      p_end_date: endDate,
    }),
    supabase.rpc("get_costs_by_feature", {
      p_start_date: startDate,
      p_end_date: endDate,
    }),
    supabase.rpc("get_costs_by_model", {
      p_start_date: startDate,
      p_end_date: endDate,
    }),
    supabase.rpc("get_deal_cost_summary", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_limit: 50,
    }),
    supabase.rpc("get_recent_errors", {
      p_start_date: startDate,
      p_end_date: endDate,
      p_limit: 100,
    }),
  ]);

  // Extract data with fallbacks for failed queries
  const [summaryRes, dailyRes, featureRes, modelRes, dealRes, errorRes] =
    results;

  const summaryData =
    summaryRes.status === "fulfilled" ? summaryRes.value.data?.[0] : null;
  const summary: UsageSummary = summaryData
    ? {
        totalCostUsd: summaryData.total_cost_usd ?? 0,
        totalCalls: summaryData.total_calls ?? 0,
        totalTokens: summaryData.total_tokens ?? 0,
        avgLatencyMs: summaryData.avg_latency_ms ?? 0,
        errorCount: summaryData.error_count ?? 0,
        errorRate: summaryData.error_rate ?? 0,
      }
    : {
        totalCostUsd: 0,
        totalCalls: 0,
        totalTokens: 0,
        avgLatencyMs: 0,
        errorCount: 0,
        errorRate: 0,
      };

  const dailyCosts: DailyCost[] =
    (dailyRes.status === "fulfilled" ? dailyRes.value.data : [])?.map(
      (row: RpcRow) => ({
        date: row.date as string,
        costUsd: (row.cost_usd as number) ?? 0,
        inputTokens: (row.input_tokens as number) ?? 0,
        outputTokens: (row.output_tokens as number) ?? 0,
        callCount: (row.call_count as number) ?? 0,
      })
    ) ?? [];

  const featureCosts: FeatureCost[] =
    (featureRes.status === "fulfilled" ? featureRes.value.data : [])?.map(
      (row: RpcRow) => ({
        feature: row.feature as string,
        costUsd: (row.cost_usd as number) ?? 0,
        callCount: (row.call_count as number) ?? 0,
        avgLatencyMs: (row.avg_latency_ms as number) ?? 0,
      })
    ) ?? [];

  const modelCosts: ModelCost[] =
    (modelRes.status === "fulfilled" ? modelRes.value.data : [])?.map(
      (row: RpcRow) => ({
        provider: row.provider as string,
        model: row.model as string,
        costUsd: (row.cost_usd as number) ?? 0,
        callCount: (row.call_count as number) ?? 0,
        totalTokens: (row.total_tokens as number) ?? 0,
      })
    ) ?? [];

  const dealSummaries: DealCostSummary[] =
    (dealRes.status === "fulfilled" ? dealRes.value.data : [])?.map(
      (row: RpcRow) => ({
        dealId: row.deal_id as string,
        dealName: row.deal_name as string,
        organizationName: row.organization_name as string,
        totalCostUsd: (row.total_cost_usd as number) ?? 0,
        conversationCount: (row.conversation_count as number) ?? 0,
        documentCount: (row.document_count as number) ?? 0,
        lastActivity: row.last_activity as string | null,
      })
    ) ?? [];

  const recentErrors: ErrorLogEntry[] =
    (errorRes.status === "fulfilled" ? errorRes.value.data : [])?.map(
      (row: RpcRow) => ({
        id: row.id as string,
        featureName: row.feature_name as string,
        dealId: row.deal_id as string | null,
        dealName: row.deal_name as string,
        errorMessage: row.error_message as string | null,
        durationMs: row.duration_ms as number | null,
        metadata: row.metadata as Record<string, unknown> | null,
        createdAt: row.created_at as string,
      })
    ) ?? [];

  return {
    summary,
    dailyCosts,
    featureCosts,
    modelCosts,
    dealSummaries,
    recentErrors,
    dateRange,
  };
}

export async function exportToCSV(data: DashboardData): Promise<string> {
  const lines: string[] = [];

  lines.push("# Usage Summary");
  lines.push("Metric,Value");
  lines.push(`Total Cost (USD),${data.summary.totalCostUsd.toFixed(4)}`);
  lines.push(`Total API Calls,${data.summary.totalCalls}`);
  lines.push(`Total Tokens,${data.summary.totalTokens}`);
  lines.push(`Avg Latency (ms),${data.summary.avgLatencyMs.toFixed(0)}`);
  lines.push(`Error Count,${data.summary.errorCount}`);
  lines.push(`Error Rate (%),${data.summary.errorRate.toFixed(2)}`);
  lines.push("");

  lines.push("# Daily Costs");
  lines.push("Date,Cost (USD),Input Tokens,Output Tokens,Call Count");
  data.dailyCosts.forEach((row) => {
    lines.push(
      `${row.date},${row.costUsd.toFixed(6)},${row.inputTokens},${row.outputTokens},${row.callCount}`
    );
  });
  lines.push("");

  lines.push("# Cost by Feature");
  lines.push("Feature,Cost (USD),Call Count,Avg Latency (ms)");
  data.featureCosts.forEach((row) => {
    lines.push(
      `${row.feature},${row.costUsd.toFixed(6)},${row.callCount},${row.avgLatencyMs.toFixed(0)}`
    );
  });
  lines.push("");

  lines.push("# Cost by Model");
  lines.push("Provider,Model,Cost (USD),Call Count,Total Tokens");
  data.modelCosts.forEach((row) => {
    lines.push(
      `${row.provider},${row.model},${row.costUsd.toFixed(6)},${row.callCount},${row.totalTokens}`
    );
  });
  lines.push("");

  lines.push("# Deal Cost Summary");
  lines.push(
    "Deal Name,Organization,Total Cost (USD),Conversations,Documents,Last Activity"
  );
  data.dealSummaries.forEach((row) => {
    lines.push(
      `"${row.dealName}","${row.organizationName}",${row.totalCostUsd.toFixed(4)},${row.conversationCount},${row.documentCount},${row.lastActivity || ""}`
    );
  });
  lines.push("");

  lines.push("# Recent Errors");
  lines.push("Timestamp,Feature,Deal,Error Message");
  data.recentErrors.forEach((row) => {
    const msg = (row.errorMessage || "").replace(/"/g, '""');
    lines.push(`${row.createdAt},${row.featureName},"${row.dealName}","${msg}"`);
  });

  return lines.join("\n");
}
