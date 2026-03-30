"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar
} from "recharts";
import { BarChart2, Globe, Monitor, Smartphone, Link2 } from "lucide-react";
import { format, subDays } from "date-fns";
import Link from "next/link";

const COLORS = ["#7C3AED", "#0EA5E9", "#22D3EE", "#A78BFA", "#38BDF8", "#818CF8"];

function processClicksByDay(clicks: any[]) {
  const days = Array.from({ length: 30 }, (_, i) => {
    const date = subDays(new Date(), 29 - i);
    return { date: format(date, "MMM d"), count: 0, dateStr: format(date, "yyyy-MM-dd") };
  });
  clicks.forEach((click) => {
    const dateStr = click.clicked_at?.slice(0, 10);
    const day = days.find((d) => d.dateStr === dateStr);
    if (day) day.count++;
  });
  return days;
}

function processGrouped(clicks: any[], field: string) {
  const counts: Record<string, number> = {};
  clicks.forEach((c) => {
    const val = c[field] || "Unknown";
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, value]) => ({ name, value }));
}

export default function AnalyticsClient({ links, clicks, isAdmin }: { links: any[]; clicks: any[]; isAdmin: boolean }) {
  const clicksByDay = processClicksByDay(clicks);
  const byCountry = processGrouped(clicks, "country");
  const byDevice = processGrouped(clicks, "device_type");
  const byBrowser = processGrouped(clicks, "browser");
  const byOs = processGrouped(clicks, "os");

  const totalClicks = links.reduce((s, l) => s + (l.click_count || 0), 0);
  const activeLinks = links.filter((l) => l.status === "active").length;

  const topLinks = [...links]
    .sort((a, b) => (b.click_count || 0) - (a.click_count || 0))
    .slice(0, 5);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">Detailed insights across all your links.</p>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Clicks", value: totalClicks.toLocaleString(), color: "text-primary" },
          { label: "Active Links", value: activeLinks, color: "text-cyan-400" },
          { label: "Countries", value: new Set(clicks.map(c => c.country).filter(Boolean)).size, color: "text-green-400" },
          { label: "Unique Devices", value: new Set(clicks.map(c => c.device_type).filter(Boolean)).size, color: "text-amber-400" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4">
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* 30-day timeline */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart2 className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Clicks Over Time</h3>
          <span className="ml-auto text-xs text-muted-foreground">Last 30 days</span>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={clicksByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={4} />
            <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Area type="monotone" dataKey="count" name="Clicks" stroke="#7C3AED" strokeWidth={2} fill="url(#analyticsGrad)" dot={false} activeDot={{ r: 4, fill: "#7C3AED" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Countries */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Top Countries</h3>
          </div>
          {byCountry.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-2.5">
              {byCountry.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-24 truncate">{item.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-primary transition-all duration-700" style={{ width: `${(item.value / (byCountry[0]?.value || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Device Breakdown */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-sm">Device Types</h3>
          </div>
          {byDevice.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="flex items-center gap-4">
              <PieChart width={140} height={140}>
                <Pie data={byDevice} cx={65} cy={65} innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                  {byDevice.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
              </PieChart>
              <div className="space-y-2 flex-1">
                {byDevice.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground capitalize flex-1">{item.name}</span>
                    <span className="text-xs font-medium">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Browser */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Browsers</h3>
          {byBrowser.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={byBrowser} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="name" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                <Bar dataKey="value" name="Clicks" fill="#0EA5E9" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Links */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Link2 className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-sm">Top Performing Links</h3>
          </div>
          {topLinks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No links yet</p>
          ) : (
            <div className="space-y-2">
              {topLinks.map((link, i) => (
                <Link key={link.id} href={`/dashboard/links/${link.id}`} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-medium text-primary">/{link.short_code}</p>
                    {link.title && <p className="text-xs text-muted-foreground truncate">{link.title}</p>}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BarChart2 className="w-3 h-3" />
                    {(link.click_count || 0).toLocaleString()}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
