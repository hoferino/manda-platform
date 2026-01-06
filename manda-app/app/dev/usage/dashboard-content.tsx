"use client";

import { useState, useEffect, useTransition } from "react";
import { Download, Calendar, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DailyCostsChart,
  FeatureCostsChart,
  ModelCostsChart,
  TokenUsageChart,
} from "@/components/admin/usage-charts";
import type {
  DashboardData,
  DailyCost,
  DateRange,
  DateRangePreset,
  Granularity,
} from "@/lib/types/dashboard";
import { fetchDashboardData, exportToCSV } from "./actions";

function getDateRange(
  preset: DateRangePreset,
  customStart?: Date,
  customEnd?: Date
): DateRange {
  // Clone dates to avoid mutation
  const endDate = customEnd ? new Date(customEnd.getTime()) : new Date();
  const startDate = customStart ? new Date(customStart.getTime()) : new Date();

  if (preset !== "custom") {
    switch (preset) {
      case "7d":
        startDate.setDate(endDate.getDate() - 7);
        break;
      case "30d":
        startDate.setDate(endDate.getDate() - 30);
        break;
      case "90d":
        startDate.setDate(endDate.getDate() - 90);
        break;
    }
  }

  return { startDate, endDate, preset };
}

function aggregateByGranularity(
  data: DailyCost[],
  granularity: Granularity
): DailyCost[] {
  if (granularity === "day" || data.length === 0) return data;

  const grouped = new Map<string, DailyCost>();

  data.forEach((row) => {
    const date = new Date(row.date);
    let key: string;

    if (granularity === "week") {
      // Get Monday of the week
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(date.setDate(diff));
      key = monday.toISOString().split("T")[0] as string;
    } else {
      // Month: use first of month
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
    }

    const existing = grouped.get(key);
    if (existing) {
      existing.costUsd += row.costUsd;
      existing.inputTokens += row.inputTokens;
      existing.outputTokens += row.outputTokens;
      existing.callCount += row.callCount;
    } else {
      grouped.set(key, { ...row, date: key });
    }
  });

  return Array.from(grouped.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

export function DashboardContent() {
  const [datePreset, setDatePreset] = useState<DateRangePreset>("30d");
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [customStart, setCustomStart] = useState<Date | undefined>();
  const [customEnd, setCustomEnd] = useState<Date | undefined>();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadData = (isManualRefresh = false) => {
    if (isManualRefresh) setIsRefreshing(true);
    startTransition(async () => {
      setError(null);
      try {
        const dateRange = getDateRange(datePreset, customStart, customEnd);
        const result = await fetchDashboardData(dateRange);
        setData(result);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load dashboard data";
        console.error("[Dashboard] Error loading data:", err);
        setError(errorMessage);
      } finally {
        if (isManualRefresh) setIsRefreshing(false);
      }
    });
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, customStart, customEnd]);

  const handleExport = async () => {
    if (!data) return;
    const csv = await exportToCSV(data);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `manda-usage-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error}</p>
          <Button onClick={() => loadData()} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const showRefreshOverlay = isRefreshing && data;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Calendar className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <Select
            value={datePreset}
            onValueChange={(v) => setDatePreset(v as DateRangePreset)}
          >
            <SelectTrigger className="w-[180px]" aria-label="Select time period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={granularity}
            onValueChange={(v) => setGranularity(v as Granularity)}
          >
            <SelectTrigger className="w-[120px]" aria-label="Select data granularity">
              <SelectValue placeholder="Granularity" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Daily</SelectItem>
              <SelectItem value="week">Weekly</SelectItem>
              <SelectItem value="month">Monthly</SelectItem>
            </SelectContent>
          </Select>
          {datePreset === "custom" && (
            <div className="flex items-center gap-2 text-sm">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Select start date">
                    {customStart ? format(customStart, "PP") : "Start date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4">
                  <input
                    type="date"
                    className="border rounded p-2"
                    aria-label="Start date"
                    onChange={(e) => setCustomStart(new Date(e.target.value))}
                  />
                </PopoverContent>
              </Popover>
              <span>to</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" aria-label="Select end date">
                    {customEnd ? format(customEnd, "PP") : "End date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4">
                  <input
                    type="date"
                    className="border rounded p-2"
                    aria-label="End date"
                    onChange={(e) => setCustomEnd(new Date(e.target.value))}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
          <Button
            variant="outline"
            size="icon"
            onClick={() => loadData(true)}
            disabled={isPending || isRefreshing}
            aria-label="Refresh dashboard data"
          >
            <RefreshCw className={`h-4 w-4 ${isPending || isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <Button onClick={handleExport} disabled={!data} aria-label="Export data to CSV">
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          Export CSV
        </Button>
      </div>

      {isPending && !data ? (
        <DashboardSkeleton />
      ) : data ? (
        <div className="relative">
          {showRefreshOverlay && (
            <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center rounded-lg">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="Total Cost"
              value={`$${data.summary.totalCostUsd.toFixed(2)}`}
              description={`${data.summary.totalCalls.toLocaleString()} API calls`}
            />
            <SummaryCard
              title="Total Tokens"
              value={`${(data.summary.totalTokens / 1_000_000).toFixed(2)}M`}
              description="Input + Output tokens"
            />
            <SummaryCard
              title="Avg Latency"
              value={`${data.summary.avgLatencyMs.toFixed(0)}ms`}
              description="Per LLM call"
            />
            <SummaryCard
              title="Error Rate"
              value={`${data.summary.errorRate.toFixed(1)}%`}
              description={`${data.summary.errorCount} errors`}
              variant={data.summary.errorRate > 5 ? "destructive" : "default"}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 md:grid-cols-2">
            <DailyCostsChart data={aggregateByGranularity(data.dailyCosts, granularity)} />
            <FeatureCostsChart data={data.featureCosts} />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <ModelCostsChart data={data.modelCosts} />
            <TokenUsageChart data={aggregateByGranularity(data.dailyCosts, granularity)} />
          </div>

          {/* Deal Summary Table */}
          <Card>
            <CardHeader>
              <CardTitle>Cost by Deal</CardTitle>
              <CardDescription>Top deals by LLM cost</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Organization</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Conversations</TableHead>
                    <TableHead className="text-right">Documents</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.dealSummaries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-muted-foreground"
                      >
                        No deal data for this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.dealSummaries.map((deal) => (
                      <TableRow key={deal.dealId}>
                        <TableCell className="font-medium">
                          {deal.dealName}
                        </TableCell>
                        <TableCell>{deal.organizationName}</TableCell>
                        <TableCell className="text-right">
                          ${deal.totalCostUsd.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right">
                          {deal.conversationCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {deal.documentCount}
                        </TableCell>
                        <TableCell>
                          {deal.lastActivity
                            ? new Date(deal.lastActivity).toLocaleDateString()
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Error Log Table */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Errors</CardTitle>
              <CardDescription>Failed operations with context</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Feature</TableHead>
                    <TableHead>Deal</TableHead>
                    <TableHead>Error Message</TableHead>
                    <TableHead className="text-right">Duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentErrors.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-center text-muted-foreground"
                      >
                        No errors in this period
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.recentErrors.slice(0, 20).map((err) => (
                      <TableRow key={err.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(err.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{err.featureName}</Badge>
                        </TableCell>
                        <TableCell>{err.dealName}</TableCell>
                        <TableCell className="max-w-xs truncate text-sm">
                          {err.errorMessage || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {err.durationMs ? `${err.durationMs}ms` : "-"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  title,
  value,
  description,
  variant = "default",
}: {
  title: string;
  value: string;
  description: string;
  variant?: "default" | "destructive";
}) {
  return (
    <Card className={variant === "destructive" ? "border-destructive/50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={`text-2xl font-bold ${variant === "destructive" ? "text-destructive" : ""}`}
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-32 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-[348px] rounded-lg" />
        <Skeleton className="h-[348px] rounded-lg" />
      </div>
    </div>
  );
}
