"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from "recharts";
import { ArrowLeft, Copy, Check, ExternalLink, Globe, Monitor, AlertTriangle, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

const COLORS = ["#7C3AED", "#0EA5E9", "#22D3EE", "#A78BFA", "#38BDF8"];

interface ClickEvent {
  id: string;
  country?: string;
  country_code?: string;
  device_type?: string;
  browser?: string;
  os?: string;
  referrer?: string;
  quality_score?: number;
  clicked_at: string;
}

interface LinkAnalyticsClientProps {
  link: any;
  clicks: ClickEvent[];
}

function processClicksByDay(clicks: ClickEvent[]) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    return { date: format(date, "MMM d"), count: 0, dateStr: format(date, "yyyy-MM-dd") };
  });

  clicks.forEach((click) => {
    const dateStr = click.clicked_at.slice(0, 10);
    const day = days.find((d) => d.dateStr === dateStr);
    if (day) day.count++;
  });

  return days;
}

function processGrouped(clicks: ClickEvent[], field: keyof ClickEvent) {
  const counts: Record<string, number> = {};
  clicks.forEach((c) => {
    const val = (c[field] as string) || "Unknown";
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
}

export default function LinkAnalyticsClient({ link, clicks }: LinkAnalyticsClientProps) {
  const [copied, setCopied] = React.useState(false);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const shortUrl = `${baseUrl}/${link.short_code}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shortUrl);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const clicksByDay = processClicksByDay(clicks);
  const byCountry = processGrouped(clicks, "country");
  const byDevice = processGrouped(clicks, "device_type");
  const byBrowser = processGrouped(clicks, "browser");
  const byReferrer = processGrouped(clicks, "referrer");

  const avgQuality = clicks.length > 0
    ? Math.round(clicks.reduce((s, c) => s + (c.quality_score || 100), 0) / clicks.length)
    : 100;

  const isFraudFlagged = link.is_fraud_flagged || avgQuality < 50;

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/dashboard/links" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
              {link.title || `/${link.short_code}`}
            </h1>
            <Badge variant="outline" className={`text-xs ${link.status === "active" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-muted text-muted-foreground"}`}>
              {link.status}
            </Badge>
            {isFraudFlagged && (
              <Badge variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 text-xs gap-1">
                <AlertTriangle className="w-3 h-3" />
                Fraud Flagged
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{link.destination_url}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-sm font-mono text-primary hidden sm:block">{shortUrl}</span>
          <button onClick={handleCopy} className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all">
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <a href={link.destination_url} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all">
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* Fraud Warning */}
      {isFraudFlagged && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Suspicious Activity Detected</p>
            <p className="text-xs text-muted-foreground mt-1">
              This link has a click quality score of {avgQuality}/100. This may indicate bot traffic or click fraud.
              Review referrer patterns and consider adding this to your IP exclusion list.
            </p>
          </div>
        </motion.div>
      )}

      {/* Quality Score + Total */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Clicks", value: link.click_count || clicks.length, color: "text-primary" },
          { label: "Unique Clicks", value: clicks.filter(c => c.country).length, color: "text-cyan-400" },
          { label: "Countries", value: new Set(clicks.map(c => c.country).filter(Boolean)).size, color: "text-green-400" },
          { label: "Quality Score", value: `${avgQuality}%`, color: avgQuality >= 70 ? "text-green-400" : avgQuality >= 40 ? "text-amber-400" : "text-red-400" },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Click Timeline */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">Click Timeline</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={clicksByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Area type="monotone" dataKey="count" stroke="#7C3AED" strokeWidth={2} fill="url(#clickGradient)" dot={false} activeDot={{ r: 4, fill: "#7C3AED" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Countries</h3>
          </div>
          {byCountry.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-2">
              {byCountry.map((item, i) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="text-sm w-28 text-muted-foreground truncate">{item.name}</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-primary transition-all duration-500"
                      style={{ width: `${(item.value / (byCountry[0]?.value || 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-8 text-right">{item.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Device */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Monitor className="w-4 h-4 text-cyan-400" />
            <h3 className="font-semibold text-sm">Devices</h3>
          </div>
          {byDevice.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="flex items-center justify-center">
              <PieChart width={160} height={160}>
                <Pie data={byDevice} cx={75} cy={75} innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {byDevice.map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
              </PieChart>
              <div className="space-y-2">
                {byDevice.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-muted-foreground">{item.name}</span>
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
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={byBrowser} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Bar dataKey="value" fill="#0EA5E9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Referrers */}
        <div className="rounded-xl border border-border bg-card p-5">
          <h3 className="font-semibold text-sm mb-4">Top Referrers</h3>
          {byReferrer.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-2">
              {byReferrer.map((item) => (
                <div key={item.name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <span className="text-xs text-muted-foreground truncate flex-1">{item.name}</span>
                  <span className="text-xs font-medium ml-2 flex-shrink-0">{item.value} clicks</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
