"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid, Legend
} from "recharts";
import {
  ArrowLeft, ShieldCheck, Bot, FilterX, UserCheck, Globe, Monitor,
  Link2, MousePointerClick, DollarSign, Activity, TrendingUp, ExternalLink
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import WorldHeatmap from "../../components/world-heatmap";

const COLORS = ["#7C3AED", "#0EA5E9", "#22D3EE", "#A78BFA", "#38BDF8", "#F59E0B"];

function getFlagEmoji(countryCode?: string) {
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

interface MemberAnalyticsClientProps {
  member: any;
  clickStats: {
    totalClicks: number;
    realClicks: number;
    uniqueUsers: number;
    filteredClicks: number;
    botExcluded: number;
  };
  dailyClicks: Array<{ day: string; total: number; real: number; unique: number; bots: number }>;
  links: any[];
  countryData: Array<{ name: string; value: number; code?: string }>;
  deviceData: Array<{ name: string; value: number }>;
  browserData: Array<{ name: string; value: number }>;
  earnings: any[];
  totalEarnings: number;
}

export default function MemberAnalyticsClient({
  member,
  clickStats,
  dailyClicks,
  links,
  countryData,
  deviceData,
  browserData,
  earnings,
  totalEarnings,
}: MemberAnalyticsClientProps) {
  const [hasMounted, setHasMounted] = useState(false);
  React.useEffect(() => {
    setHasMounted(true);
  }, []);

  const [activeTab, setActiveTab] = useState<"overview" | "links" | "geo" | "activity">("overview");

  const name = member.display_name || member.full_name || member.email?.split("@")[0] || "Member";
  const initials = name.slice(0, 2).toUpperCase();
  const status = member.membership_status || member.status || "pending";
  const role = member.role || "member";

  if (!hasMounted) return null;

  const statusColors: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    suspended: "bg-red-500/10 text-red-400 border-red-500/20",
    pending: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  const qualityScore = clickStats.totalClicks > 0
    ? Math.round((clickStats.realClicks / clickStats.totalClicks) * 100)
    : 100;

  // Format daily clicks for chart
  const chartData = dailyClicks.map(d => ({
    date: d.day && !isNaN(new Date(d.day).getTime()) ? format(new Date(d.day), "MMM d") : (d.day || "Other"),
    Total: d.total,
    Real: d.real,
    Unique: d.unique,
    Bots: d.bots,
  }));

  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "links", label: `Links (${links.length})` },
    { id: "geo", label: "Geo & Device" },
    { id: "activity", label: "Activity" },
  ];

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/members"
          className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="w-10 h-10">
            <AvatarImage src={member.avatar_url} />
            <AvatarFallback className="bg-primary/20 text-primary font-semibold">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>{name}</h1>
              <Badge variant="outline" className={cn("text-xs", statusColors[status])}>{status}</Badge>
              <Badge variant="outline" className={`text-xs ${role === "admin" ? "bg-primary/10 text-primary border-primary/20" : "bg-muted text-muted-foreground"}`}>
                {role}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{member.email}</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-xs text-muted-foreground">Joined</p>
          <p className="text-sm font-medium">
            {member.created_at && !isNaN(new Date(member.created_at).getTime()) ? formatDistanceToNow(new Date(member.created_at), { addSuffix: true }) : "—"}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Clicks", value: clickStats.totalClicks.toLocaleString(), icon: MousePointerClick, color: "text-muted-foreground", bg: "bg-muted/50" },
          { label: "Real Clicks", value: clickStats.realClicks.toLocaleString(), icon: ShieldCheck, color: "text-green-400", bg: "bg-green-500/10" },
          { label: "Unique Users", value: clickStats.uniqueUsers.toLocaleString(), icon: UserCheck, color: "text-cyan-400", bg: "bg-cyan-500/10" },
          { label: "Bots Excluded", value: clickStats.botExcluded.toLocaleString(), icon: Bot, color: "text-red-400", bg: "bg-red-500/10" },
          { label: "Filtered Out", value: clickStats.filteredClicks.toLocaleString(), icon: FilterX, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Links Created", value: links.length.toLocaleString(), icon: Link2, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-3"
          >
            <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center mb-2", stat.bg)}>
              <stat.icon className={cn("w-4 h-4", stat.color)} />
            </div>
            <p className={cn("text-xl font-bold", stat.color)}>{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Quality score + earnings bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium">Traffic Quality Score</span>
            </div>
            <span className={cn("text-xl font-bold", qualityScore >= 70 ? "text-green-400" : qualityScore >= 40 ? "text-amber-400" : "text-red-400")}>
              {qualityScore}%
            </span>
          </div>
          <div className="h-2.5 rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-700", qualityScore >= 70 ? "bg-green-400" : qualityScore >= 40 ? "bg-amber-400" : "bg-red-400")}
              style={{ width: `${qualityScore}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {clickStats.realClicks} real clicks out of {clickStats.totalClicks} total
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium">Total Earnings</span>
          </div>
          <p className="text-2xl font-bold text-amber-400">${totalEarnings.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Rate: ${(member.earnings_rate || 0).toFixed(4)} per click
            {(member.earnings_rate || 0) === 0 && (
              <span className="ml-1.5 text-amber-400/60">(monetization disabled)</span>
            )}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 rounded-xl border border-border overflow-hidden bg-card w-fit">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors",
              activeTab === tab.id ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {/* Daily clicks chart */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Click Activity (Last 30 Days)
            </h3>
            {chartData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-12">No activity in the last 30 days</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="totalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                  <Area type="monotone" dataKey="Total" stroke="#7C3AED" strokeWidth={1.5} fill="url(#totalGrad)" dot={false} strokeDasharray="4 2" />
                  <Area type="monotone" dataKey="Real" stroke="#22D3EE" strokeWidth={2} fill="url(#realGrad)" dot={false} />
                  <Area type="monotone" dataKey="Bots" stroke="#EF4444" strokeWidth={1} fill="none" dot={false} strokeDasharray="2 2" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top performing links */}
          {links.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Top Performing Links
              </h3>
              <div className="space-y-2">
                {links.slice(0, 5).map((link, i) => (
                  <div key={link.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors">
                    <span className="text-xs text-muted-foreground w-5 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{link.title || `/${link.short_code}`}</p>
                      <p className="text-xs text-muted-foreground truncate">{link.destination_url}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-primary">{(link.click_count || 0).toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">clicks</p>
                    </div>
                    <div className="flex-1 max-w-[100px] bg-muted rounded-full h-1.5">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${((link.click_count || 0) / Math.max(links[0]?.click_count || 1, 1)) * 100}%` }}
                      />
                    </div>
                    <Link href={`/dashboard/links/${link.id}`} className="text-muted-foreground hover:text-foreground">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "links" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Link</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">Destination</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3">Clicks</th>
                  <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">Created</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                      No links created yet
                    </td>
                  </tr>
                ) : (
                  links.map((link, i) => (
                    <motion.tr
                      key={link.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm font-medium">{link.title || `/${link.short_code}`}</p>
                        <p className="text-xs text-muted-foreground font-mono">{link.short_code}</p>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <p className="text-xs text-muted-foreground truncate max-w-[150px]">{link.destination_url}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={`text-xs ${link.status === "active" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : link.status === "expired" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-muted text-muted-foreground"}`}>
                          {link.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-primary">{(link.click_count || 0).toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className="text-xs text-muted-foreground">
                          {link.created_at && !isNaN(new Date(link.created_at).getTime()) ? formatDistanceToNow(new Date(link.created_at), { addSuffix: true }) : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/dashboard/links/${link.id}`} className="text-xs text-primary hover:underline flex items-center gap-1 justify-end">
                          Analytics <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === "geo" && (
        <div className="space-y-4">
          <WorldHeatmap data={countryData as any[]} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Countries */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Countries (Real Clicks)</h3>
            </div>
            {countryData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No clicks recorded yet</p>
            ) : (
              <div className="space-y-2">
                {countryData
                  .filter(item => item.name && !["unknown", "other"].includes(item.name.toLowerCase()))
                  .map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <span className="text-lg leading-none">{getFlagEmoji(item.code)}</span>
                    <span className="text-sm w-20 text-muted-foreground truncate">{item.name}</span>
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className="h-2 rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${(item.value / (countryData[0]?.value || 1)) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-8 text-right">{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Devices */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Monitor className="w-4 h-4 text-cyan-400" />
              <h3 className="font-semibold text-sm">Device Types</h3>
            </div>
            {deviceData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No device data yet</p>
            ) : (
              <div className="flex items-center justify-center gap-4">
                <PieChart width={140} height={140}>
                  <Pie data={deviceData} cx={65} cy={65} innerRadius={40} outerRadius={60} paddingAngle={3} dataKey="value">
                    {deviceData.map((_, index) => (
                      <Cell key={index} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
                <div className="space-y-2">
                  {deviceData.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-xs text-muted-foreground capitalize">{item.name || "Other"}</span>
                      <span className="text-xs font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Browsers */}
          <div className="rounded-xl border border-border bg-card p-5 md:col-span-2">
            <h3 className="font-semibold text-sm mb-4">Browser Breakdown</h3>
            {browserData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No browser data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={browserData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                  <Bar dataKey="value" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
          </div>
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-4">
          {/* Weekly summary */}
          <div className="grid grid-cols-3 gap-4">
            {["daily", "weekly", "monthly"].map((period) => {
              const now = new Date();
              const cutoff = new Date(now);
              if (period === "daily") cutoff.setDate(cutoff.getDate() - 1);
              else if (period === "weekly") cutoff.setDate(cutoff.getDate() - 7);
              else cutoff.setMonth(cutoff.getMonth() - 1);
              const periodClicks = dailyClicks.filter(d => new Date(d.day) >= cutoff);
              const total = periodClicks.reduce((s, d) => s + d.total, 0);
              const real = periodClicks.reduce((s, d) => s + d.real, 0);
              return (
                <div key={period} className="rounded-xl border border-border bg-card p-4">
                  <p className="text-xs text-muted-foreground capitalize mb-1">{period}</p>
                  <p className="text-xl font-bold text-primary">{total.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{real.toLocaleString()} real clicks</p>
                </div>
              );
            })}
          </div>

          {/* Daily breakdown */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h3 className="font-semibold text-sm mb-4">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">Date</th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-2">Total</th>
                    <th className="text-right text-xs font-medium text-green-400 pb-2">Real</th>
                    <th className="text-right text-xs font-medium text-cyan-400 pb-2">Unique</th>
                    <th className="text-right text-xs font-medium text-red-400 pb-2">Bots</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyClicks.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-muted-foreground py-8 text-xs">No data available</td>
                    </tr>
                  ) : (
                    [...dailyClicks].reverse().slice(0, 14).map((d) => (
                      <tr key={d.day} className="border-b border-border/50 last:border-0">
                        <td className="py-2 text-xs text-muted-foreground">
                          {d.day && !isNaN(new Date(d.day).getTime()) ? format(new Date(d.day), "EEE, MMM d") : (d.day || "Other")}
                        </td>
                        <td className="py-2 text-right text-xs">{d.total}</td>
                        <td className="py-2 text-right text-xs text-green-400">{d.real}</td>
                        <td className="py-2 text-right text-xs text-cyan-400">{d.unique}</td>
                        <td className="py-2 text-right text-xs text-red-400">{d.bots}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
