"use client";

import React from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TrendingUp } from "lucide-react";

// Generate mock trend data for demo/fallback
function generateTrendData() {
  const now = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date(now);
    date.setDate(date.getDate() - (13 - i));
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      clicks: Math.floor(Math.random() * 200) + 50,
      earnings: parseFloat((Math.random() * 20 + 5).toFixed(2)),
    };
  });
}

type TrendPoint = {
  date: string;
  clicks: number;
  earnings: number;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((entry: any) => (
          <p key={entry.name} className="text-sm font-medium" style={{ color: entry.color }}>
            {entry.name === "earnings" ? `$${entry.value}` : entry.value} {entry.name}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function TrendCharts({ data, label }: { data?: TrendPoint[]; label?: string }) {
  const chartData = data || generateTrendData();
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Click Trends</h3>
        <span className="ml-auto text-xs text-muted-foreground capitalize">{label || "Last 14 days"}</span>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorClicks" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
            interval={3}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="clicks"
            stroke="#7C3AED"
            strokeWidth={2}
            fill="url(#colorClicks)"
            dot={false}
            activeDot={{ r: 4, fill: "#7C3AED", stroke: "#fff", strokeWidth: 2 }}
          />
          <Area
            type="monotone"
            dataKey="earnings"
            stroke="#0EA5E9"
            strokeWidth={2}
            fill="url(#colorEarnings)"
            dot={false}
            activeDot={{ r: 4, fill: "#0EA5E9", stroke: "#fff", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 mt-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded-full bg-purple-500" />
          <span className="text-xs text-muted-foreground">Clicks</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 rounded-full bg-cyan-500" />
          <span className="text-xs text-muted-foreground">Earnings</span>
        </div>
      </div>
    </div>
  );
}
