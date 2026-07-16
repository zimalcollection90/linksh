"use client";

import React from "react";
import KpiStats from "./kpi-stats";
import RecentLinks from "./recent-links";
import TopCountries from "./top-countries";
import RangeSelector from "./range-selector";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Target, Sparkles } from "lucide-react";

const TrendCharts = dynamic(() => import("./trend-charts"), { 
  ssr: false, 
  loading: () => <div className="h-[200px] w-full bg-muted/20 animate-pulse rounded-xl" /> 
});

const WorldHeatmap = dynamic(() => import("./world-heatmap"), { 
  ssr: false, 
  loading: () => <div className="h-[300px] sm:h-[400px] w-full bg-muted/20 animate-pulse rounded-xl" /> 
});

interface MemberDashboardProps {
  stats: {
    totalLinks: number;
    totalClicks: number;
    totalEarnings: number;
    activeMembers?: number;
    realClicks?: number;
    uniqueUsers?: number;
    filteredClicks?: number;
    botExcluded?: number;
    facebookScrapers?: number;
  };
  recentLinks: any[];
  profile: any;
  trendData?: Array<{ date: string; clicks: number; earnings: number }>;
  personalGoal: number;
  personalClicks: number;
  globalGoal: number;
  overallClicks: number;
  topCountries?: Array<{ country: string; country_code: string; click_count: number }>;
  currentRange?: string;
  heatmapData?: Array<{ code: string; value: number }>;
}

export default function MemberDashboard({
  stats,
  recentLinks,
  profile,
  trendData,
  personalGoal = 1000,
  personalClicks = 0,
  globalGoal = 10000,
  overallClicks = 0,
  topCountries = [],
  currentRange = "today",
  heatmapData = [],
}: MemberDashboardProps) {
  const displayName = profile?.display_name || profile?.full_name || "there";
  const personalProgress = Math.min((personalClicks / (personalGoal || 1)) * 100, 100);
  const globalProgress = Math.min((overallClicks / (globalGoal || 1)) * 100, 100);

  const rangeLabel = {
    today: "today",
    "7d": "last 7 days",
    "30d": "last 30 days",
    "90d": "last 90 days",
    all: "all time",
  }[currentRange] || "last 30 days";

  // Use topCountries for heatmap if heatmapData is empty (fallback)
  const mapData = heatmapData.length > 0 
    ? heatmapData 
    : topCountries.map(c => ({ code: c.country_code, value: c.click_count }));

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-10">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
              Welcome back, {displayName}
            </h1>
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary animate-pulse" />
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-medium">
            You're performing great {rangeLabel}. Here's your overview.
          </p>
        </div>
        <div className="flex items-center gap-3 self-start lg:self-end">
          <RangeSelector />
        </div>
      </motion.div>

      {/* KPI Stats */}
      <KpiStats stats={stats} isAdmin={false} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Charts & Map */}
        <div className="lg:col-span-2 space-y-6">
          <TrendCharts data={trendData} label={rangeLabel} />
          <WorldHeatmap data={mapData} />
        </div>

        {/* Right Column: Goal, Links, Countries */}
        <div className="space-y-6">
          {/* Goal Progress */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl border border-primary/20 bg-primary/5 p-6 relative overflow-hidden group"
          >
            <div className="absolute -right-4 -top-4 w-16 h-16 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-700" />
            
            <div className="flex items-center gap-2 mb-4">
              <div className="p-1.5 rounded-lg bg-primary/20 text-primary">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm">Monthly Goal Progress</h3>
            </div>

            <div className="space-y-5">
              {/* Personal Goal */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-foreground">My Personal Target</span>
                  <span className="text-[11px] font-bold text-primary">
                    {personalProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-base font-black tabular-nums text-foreground">
                  <span>
                    {personalClicks.toLocaleString()}
                    <span className="text-xs font-normal text-muted-foreground ml-1">/ {personalGoal.toLocaleString()}</span>
                  </span>
                </div>
                <div className="relative h-2 w-full bg-primary/15 rounded-full overflow-hidden border border-primary/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${personalProgress}%` }}
                    transition={{ duration: 1.5, ease: "circOut", delay: 0.5 }}
                    className="h-full bg-primary relative"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" />
                  </motion.div>
                </div>
                <p className="text-[10px] text-muted-foreground font-medium italic">
                  {personalProgress >= 100
                    ? "🔥 Incredible! You've smashed your monthly target!"
                    : `You need ${(personalGoal - personalClicks).toLocaleString()} more clicks to hit your goal.`}
                </p>
              </div>

              {/* Divider */}
              <div className="h-px bg-border/40" />

              {/* Global Platform Effort */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[11px] font-bold text-muted-foreground">Global Platform Effort</span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {globalProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs font-bold tabular-nums text-foreground/80">
                  <span>
                    {overallClicks.toLocaleString()}
                    <span className="text-[10px] font-normal text-muted-foreground/60 ml-1">/ {globalGoal.toLocaleString()}</span>
                  </span>
                </div>
                <div className="relative h-1.5 w-full bg-primary/10 rounded-full overflow-hidden border border-primary/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${globalProgress}%` }}
                    transition={{ duration: 1.5, ease: "circOut", delay: 0.7 }}
                    className="h-full bg-emerald-500 relative"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.3)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" />
                  </motion.div>
                </div>
              </div>
            </div>
          </motion.div>

          <RecentLinks links={recentLinks} />
          <TopCountries data={topCountries} title="Top Traffic Sources" />
        </div>
      </div>
    </div>
  );
}
