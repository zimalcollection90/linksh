"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, CartesianGrid
} from "recharts";
import { ArrowLeft, Copy, Check, ExternalLink, Globe, Monitor, AlertTriangle, Shield, ShieldCheck, Bot, FilterX, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import WorldHeatmap from "../../components/world-heatmap";
import { getCountryName } from "../../../../utils/geo";

const COLORS = ["#7C3AED", "#0EA5E9", "#22D3EE", "#A78BFA", "#38BDF8"];

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
  is_bot?: boolean;
  is_unique?: boolean;
  is_filtered?: boolean;
  filter_reason?: string;
}

interface LinkAnalyticsClientProps {
  link: any;
  clicks: ClickEvent[];
}

function processClicksByDay(clicks: ClickEvent[]) {
  const days = Array.from({ length: 14 }, (_, i) => {
    const date = subDays(new Date(), 13 - i);
    return { date: format(date, "MMM d"), count: 0, real: 0, dateStr: format(date, "yyyy-MM-dd") };
  });

  clicks.forEach((click) => {
    const dateStr = click.clicked_at.slice(0, 10);
    const day = days.find((d) => d.dateStr === dateStr);
    if (day) {
      day.count++;
      if (!click.is_bot && click.is_unique && !click.is_filtered) day.real++;
    }
  });

  return days;
}

function processGrouped(clicks: ClickEvent[], field: keyof ClickEvent) {
  const counts: Record<string, number> = {};
  clicks.forEach((c) => {
    const val = (c[field] as string) || "Other";
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));
}

function processCountryData(clicks: ClickEvent[]) {
  const counts: Record<string, { value: number; code: string; name: string }> = {};
  clicks
    .filter((c) => {
      // PERMISSIVE: Only exclude confirmed bots/filtered
      if (c.is_bot === true || c.is_filtered === true) return false;
      return true;
    })
    .forEach((c) => {
      const code = (c.country_code || "").toUpperCase();
      const name = c.country && !["unknown", "other", ""].includes(c.country.toLowerCase()) 
        ? c.country 
        : getCountryName(code);
      
      const validCode = code.length === 2 && code !== "XX" ? code : "";
      const key = validCode || name;
      if (!counts[key]) counts[key] = { value: 0, code: validCode, name };
      counts[key].value++;
    });
  return Object.values(counts)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);
}

function processHeatmapData(clicks: ClickEvent[]) {
  const counts: Record<string, number> = {};
  clicks
    .filter((c) => c.is_bot !== true && c.is_filtered !== true)
    .forEach((c) => {
      const code = (c.country_code || "").toUpperCase();
      if (code && code !== "XX" && code !== "UN" && code.length === 2) {
        counts[code] = (counts[code] || 0) + 1;
      }
    });
  return Object.entries(counts).map(([code, value]) => ({ code, value }));
}

export default function LinkAnalyticsClient({ link, clicks }: LinkAnalyticsClientProps) {
  const [hasMounted, setHasMounted] = React.useState(false);
  React.useEffect(() => {
    setHasMounted(true);
  }, []);
  
  const [copied, setCopied] = React.useState(false);
  const [view, setView] = React.useState<"all" | "real">("real");
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  if (!hasMounted) return null;

  const shortUrl = origin ? `${origin}/${link.short_code}` : `/${link.short_code}`;

  const handleCopy = () => {
    const fullUrl = `${window.location.origin}/${link.short_code}`;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const realClicks = clicks.filter(c => !c.is_bot && c.is_unique && !c.is_filtered);
  const botClicks = clicks.filter(c => c.is_bot);
  const filteredClicks = clicks.filter(c => c.is_filtered && !c.is_bot);
  const displayClicks = view === "real" ? realClicks : clicks;

  const clicksByDay = processClicksByDay(clicks);
  const byCountry = processCountryData(displayClicks);
  const heatmapData = processHeatmapData(displayClicks);
  const byDevice = processGrouped(displayClicks, "device_type");
  const byBrowser = processGrouped(displayClicks, "browser");
  const byReferrer = processGrouped(displayClicks, "referrer");

  const avgQuality = clicks.length > 0
    ? Math.round(clicks.reduce((s, c) => s + (c.quality_score || 100), 0) / clicks.length)
    : 100;

  const isFraudFlagged = link.is_fraud_flagged || avgQuality < 50;
  // Unique countries as a proxy for unique users (ip_address not in select query)
  const uniqueVisitors = new Set(realClicks.map(c => c.country).filter(c => c && !["unknown", "other"].includes(c.toLowerCase()))).size;

  const filterReasons = filteredClicks.reduce((acc: Record<string, number>, c) => {
    const r = c.filter_reason || "other";
    acc[r] = (acc[r] || 0) + 1;
    return acc;
  }, {});

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
              Review referrer patterns and consider adding suspicious IPs to your exclusion list.
            </p>
          </div>
        </motion.div>
      )}

      {/* Real Click Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Clicks", value: clicks.length, color: "text-muted-foreground", icon: null },
          { label: "Real Clicks", value: realClicks.length, color: "text-green-400", icon: ShieldCheck },
          { label: "Unique Visitors", value: uniqueVisitors, color: "text-cyan-400", icon: UserCheck },
          { label: "Quality Score", value: `${avgQuality}%`, color: avgQuality >= 70 ? "text-green-400" : avgQuality >= 40 ? "text-amber-400" : "text-red-400", icon: Shield },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-center gap-1.5 mb-1">
              {stat.icon && <stat.icon className={cn("w-3.5 h-3.5", stat.color)} />}
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </div>
            <p className={`text-2xl font-bold ${stat.color}`}>{typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filter Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-border bg-card/50 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <Bot className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-red-400">{botClicks.length}</p>
            <p className="text-xs text-muted-foreground">Bots Excluded</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <FilterX className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-amber-400">{filteredClicks.length}</p>
            <p className="text-xs text-muted-foreground">Filtered Clicks</p>
            {Object.keys(filterReasons).length > 0 && (
              <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                {Object.entries(filterReasons).map(([r, n]) => `${r.replace(/_/g, " ")}: ${n}`).join(" · ")}
              </p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card/50 p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <p className="text-lg font-bold text-green-400">{realClicks.length}</p>
            <p className="text-xs text-muted-foreground">Real Verified Clicks</p>
            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
              {clicks.length > 0 ? Math.round((realClicks.length / clicks.length) * 100) : 100}% of total
            </p>
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Show analytics for:</span>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setView("real")}
            className={cn("px-3 py-1.5 text-xs font-medium transition-colors", view === "real" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
          >
            Real Clicks Only
          </button>
          <button
            onClick={() => setView("all")}
            className={cn("px-3 py-1.5 text-xs font-medium transition-colors", view === "all" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted")}
          >
            All Clicks
          </button>
        </div>
      </div>

      {/* Click Timeline */}
      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold text-sm mb-4">Click Timeline (14 days)</h3>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={clicksByDay} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="clickGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#7C3AED" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="realGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22D3EE" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#22D3EE" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} interval={2} />
            <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Area type="monotone" dataKey="count" name="Total" stroke="#7C3AED" strokeWidth={1.5} fill="url(#clickGradient)" dot={false} activeDot={{ r: 4, fill: "#7C3AED" }} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="real" name="Real Clicks" stroke="#22D3EE" strokeWidth={2} fill="url(#realGradient)" dot={false} activeDot={{ r: 4, fill: "#22D3EE" }} />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 inline-block opacity-50" style={{ borderTop: "2px dashed #7C3AED" }}></span>Total Clicks</span>
          <span className="flex items-center gap-1.5"><span className="w-4 h-0.5 bg-cyan-400 inline-block"></span>Real Clicks</span>
        </div>
      </div>

      {/* World Map Heatmap */}
      <WorldHeatmap data={heatmapData} />

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Country */}
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Countries</h3>
            <span className="ml-auto text-xs text-muted-foreground">{view === "real" ? "Real clicks" : "All clicks"}</span>
          </div>
          {byCountry.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No clicks recorded yet</p>
          ) : (
            <div className="space-y-2">
              {byCountry.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <span className="text-lg leading-none">{getFlagEmoji(item.code)}</span>
                  <span className="text-sm w-20 text-muted-foreground truncate">{item.name}</span>
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
            <div className="flex items-center justify-center gap-4">
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
