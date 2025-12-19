"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DailyCost, FeatureCost, ModelCost } from "@/lib/types/dashboard";

const COLORS = [
  "#8b5cf6",
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
];

interface DailyCostsChartProps {
  data: DailyCost[];
}

export function DailyCostsChart({ data }: DailyCostsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Costs</CardTitle>
        <CardDescription>LLM API costs over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
              className="text-muted-foreground text-xs"
            />
            <YAxis
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              className="text-muted-foreground text-xs"
            />
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
              labelFormatter={(l) => new Date(l).toLocaleDateString()}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="costUsd"
              name="Cost (USD)"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: "#8b5cf6" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface FeatureCostsChartProps {
  data: FeatureCost[];
}

export function FeatureCostsChart({ data }: FeatureCostsChartProps) {
  const formatted = data.map((item) => ({
    ...item,
    name: item.feature
      .replace(/_/g, " ")
      .replace(/\b\w/g, (l) => l.toUpperCase()),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost by Feature</CardTitle>
        <CardDescription>Breakdown of costs across features</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={formatted}
              dataKey="costUsd"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) =>
                `${name} (${(percent * 100).toFixed(0)}%)`
              }
              labelLine={false}
            >
              {formatted.map((_, i) => (
                <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: number) => [`$${v.toFixed(4)}`, "Cost"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface ModelCostsChartProps {
  data: ModelCost[];
}

export function ModelCostsChart({ data }: ModelCostsChartProps) {
  const formatted = data.map((item) => ({ ...item, displayName: item.model }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cost by Model</CardTitle>
        <CardDescription>Breakdown of costs across LLM models</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={formatted}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              type="number"
              tickFormatter={(v) => `$${v.toFixed(2)}`}
              className="text-muted-foreground text-xs"
            />
            <YAxis
              type="category"
              dataKey="displayName"
              className="text-muted-foreground text-xs"
              width={90}
            />
            <Tooltip
              formatter={(v: number, n: string) =>
                n === "costUsd"
                  ? [`$${v.toFixed(4)}`, "Cost"]
                  : [v.toLocaleString(), n]
              }
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Legend />
            <Bar
              dataKey="costUsd"
              name="Cost (USD)"
              fill="#06b6d4"
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

interface TokenUsageChartProps {
  data: DailyCost[];
}

export function TokenUsageChart({ data }: TokenUsageChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Usage</CardTitle>
        <CardDescription>Input vs Output tokens over time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="date"
              tickFormatter={(v) =>
                new Date(v).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                })
              }
              className="text-muted-foreground text-xs"
            />
            <YAxis
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              className="text-muted-foreground text-xs"
            />
            <Tooltip
              formatter={(v: number) => [v.toLocaleString(), "Tokens"]}
              labelFormatter={(l) => new Date(l).toLocaleDateString()}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
              }}
            />
            <Legend />
            <Bar
              dataKey="inputTokens"
              name="Input Tokens"
              fill="#8b5cf6"
              stackId="tokens"
            />
            <Bar
              dataKey="outputTokens"
              name="Output Tokens"
              fill="#06b6d4"
              stackId="tokens"
            />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
