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
import WorldHeatmap from "../components/world-heatmap";
import { getCountryName } from "../../../utils/geo";
import { ComposableMap } from "react-simple-maps";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COLORS = ["#7C3AED", "#0EA5E9", "#22D3EE", "#A78BFA", "#38BDF8", "#818CF8"];

function getFlagEmoji(countryCode: string) {
  if (!countryCode || ["unknown", "other", "xx"].includes(countryCode.toLowerCase()) || countryCode.length !== 2) return "🌐";
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

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

function processCountryData(clicks: any[]) {
  const counts: Record<string, { value: number; code: string; name: string }> = {};
  clicks
    .filter((c) => {
      // Human-only and UNIQUE clicks only
      if (c.is_bot === true) return false;
      if (c.is_filtered === true) return false;
      if (c.is_unique !== true) return false;
      return true;
    })
    .forEach((c) => {
      const code = (c.country_code || "").toUpperCase();
      const rawName = c.country && !["unknown", "other", ""].includes(c.country.toLowerCase()) 
        ? c.country 
        : getCountryName(code);
      
      const name = rawName || "Unknown Location";
      const validCode = code.length === 2 && code !== "XX" && code !== "UN" ? code : "";
      
      // Group by name to ensure "Unknown Location" stays together regardless of code
      const key = name;
      if (!counts[key]) counts[key] = { value: 0, code: validCode, name };
      counts[key].value++;
    });
  return Object.values(counts)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function processHeatmapData(clicks: any[]) {
  const counts: Record<string, number> = {};
  clicks
    .filter((c) => c.is_bot !== true && c.is_filtered !== true && c.is_unique === true)
    .forEach((c) => {
      const code = (c.country_code || "").toUpperCase();
      if (code && code !== "XX" && code !== "UN" && code.length === 2) {
        counts[code] = (counts[code] || 0) + 1;
      }
    });
  return Object.entries(counts).map(([code, value]) => ({ code, value }));
}

function processGrouped(clicks: any[], field: string) {
  const counts: Record<string, number> = {};
  const botIdentifiers = ["facebook scraper", "googlebot", "bingbot", "ahrefsbot", "twitterbot", "bot", "crawler", "spider"];
  
  clicks.forEach((c) => {
    const val = (c[field] as string) || "Other";
    // Filter out bots and non-unique from grouped data
    const lowVal = val.toLowerCase();
    if (botIdentifiers.some(bot => lowVal.includes(bot))) return;
    if (c.is_unique !== true) return;
    
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
}

function processClicksByMonth(clicks: any[]) {
  const counts: Record<string, number> = {};
  clicks.forEach((c) => {
    if (!c.clicked_at) return;
    const key = c.clicked_at.slice(0, 7);
    counts[key] = (counts[key] || 0) + 1;
  });
  return Object.keys(counts)
    .sort()
    .slice(-6)
    .map((k) => {
      const d = new Date(`${k}-01T00:00:00Z`);
      return {
        month: !isNaN(d.getTime()) ? format(d, "MMM yyyy") : k,
        clicks: counts[k],
      };
    });
}

import RangeSelector from "../components/range-selector";

export default function AnalyticsClient({
  links,
  clicks,
  isAdmin,
  members = [],
  stats,
  geoStats = [],
  currentRange = "30d",
  view = "own",
}: {
  links: any[];
  clicks: any[];
  isAdmin: boolean;
  members?: any[];
  stats?: any;
  geoStats?: any[];
  currentRange?: string;
  view?: "own" | "all";
}) {
  const [hasMounted, setHasMounted] = React.useState(false);
  const [isRepairing, setIsRepairing] = React.useState(false);

  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  const handleRepair = async () => {
    setIsRepairing(true);
    try {
      const res = await fetch("/api/admin/repair-geo", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Repaired ${data.repaired || 0} records out of ${data.totalChecked || 0} checked.`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error(data.error || "Repair failed.");
      }
    } catch (e) {
      toast.error("An error occurred during repair.");
    } finally {
      setIsRepairing(false);
    }
  };

  const rangeLabel = {
    today: "today",
    "7d": "last 7 days",
    "30d": "last 30 days",
    "90d": "last 90 days",
    all: "all time",
  }[currentRange || "30d"] || "last 30 days";

  const clicksByDay = processClicksByDay(clicks);
  const clicksByMonth = processClicksByMonth(clicks);
  
  // Use server-provided geoStats if available, otherwise fallback to processing the clicks array (for local filtering/re-repair)
  const byCountry = geoStats && geoStats.length > 0 
    ? geoStats.map(gs => ({ 
        name: gs.country || "Unknown Location", 
        code: gs.country_code, 
        value: Number(gs.click_count) 
      }))
    : processCountryData(clicks);

  const heatmapData = processHeatmapData(clicks);
  const byDevice = processGrouped(clicks, "device_type");
  const byBrowser = processGrouped(clicks, "browser");
  const byOs = processGrouped(clicks, "os");

  if (!hasMounted) return null;

  const totalClicksCount = stats ? Number(stats.total_clicks) : clicks.filter((c) => c.is_bot !== true && c.is_filtered !== true && c.is_unique === true).length;
  
  const knownCountries = byCountry.length;
  const activeLinks = links.filter((l) => l.status === "active").length;

  const topLinks = [...links]
    .sort((a, b) => (b.click_count || 0) - (a.click_count || 0))
    .slice(0, 5);

  const memberRows = isAdmin
    ? (members || []).map((m: any) => {
        // Members already has stats from get_members_with_stats_v3
        return {
          id: m.id,
          name: m.display_name || m.full_name || m.email || "Member",
          role: m.role || "member",
          status: m.status || "pending",
          links: m.link_count || 0,
          totalClicks: m.total_clicks || 0,
          realClicks: m.real_clicks || 0,
        };
      })
    : [];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
              {view === "all" ? "Platform Analytics" : "My Analytics"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {view === "all" ? "Broad platform insights across all members" : "Personal performance metrics for your links"} {rangeLabel}.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RangeSelector />
            {isAdmin && (
              <button 
                onClick={handleRepair}
                disabled={isRepairing}
                className="px-4 py-2 bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              >
                {isRepairing ? "Repairing..." : "Repair Geo"}
              </button>
            )}
          </div>
        </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Clicks", value: totalClicksCount.toLocaleString(), color: "text-primary" },
          { label: "Countries", value: knownCountries, color: "text-cyan-400" },
          { label: "Active Links", value: activeLinks, color: "text-amber-400" },
          { label: "Earnings", value: `$${stats?.total_earnings || 0}`, color: "text-emerald-400" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4">
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-semibold">{stat.label}</p>
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

      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Monthly Click Trends</h3>
          {clicksByMonth.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No monthly data yet</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={clicksByMonth} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
                <Bar dataKey="clicks" fill="#7C3AED" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* World Map Heatmap */}
      <WorldHeatmap data={heatmapData} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Countries */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Top Countries</h3>
          </div>
          {byCountry.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No clicks recorded yet</p>
          ) : (
            <div className="space-y-2.5">
              {byCountry.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="text-lg leading-none">{getFlagEmoji(item.code)}</span>
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
                  {byDevice.map((_: any, index: number) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "11px" }} />
              </PieChart>
              <div className="space-y-2 flex-1">
                {byDevice.map((item: any, i: number) => (
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

      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Member Performance Details</h3>
          {memberRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No members found</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60">
                    <th className="text-left text-xs text-muted-foreground pb-2">Member</th>
                    <th className="text-left text-xs text-muted-foreground pb-2">Role</th>
                    <th className="text-left text-xs text-muted-foreground pb-2">Status</th>
                    <th className="text-left text-xs text-muted-foreground pb-2 text-right">Links</th>
                    <th className="text-left text-xs text-muted-foreground pb-2 text-right">Clicks</th>
                  </tr>
                </thead>
                <tbody>
                  {memberRows
                    .sort((a: any, b: any) => b.totalClicks - a.totalClicks)
                    .map((row: any) => (
                      <tr key={row.id} className="border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="py-3 text-sm font-medium">{row.name}</td>
                        <td className="py-3 text-xs text-muted-foreground">{row.role}</td>
                        <td className="py-3 text-xs">
                          <span className={cn("px-2 py-0.5 rounded-full", row.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400")}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-3 text-sm text-right font-mono">{row.links}</td>
                        <td className="py-3 text-sm text-right font-mono font-bold text-primary">{row.totalClicks.toLocaleString()}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
