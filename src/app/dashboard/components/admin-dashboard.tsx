"use client";

import React from "react";
import KpiStats from "./kpi-stats";
import ActivityFeed from "./activity-feed";
import dynamic from "next/dynamic";
import MemberLeaderboard from "./member-leaderboard";
import RecentLinks from "./recent-links";
import TopCountries from "./top-countries";
import RangeSelector from "./range-selector";

const TrendCharts = dynamic(() => import("./trend-charts"), { 
  ssr: false, 
  loading: () => <div className="h-[200px] w-full bg-muted/20 animate-pulse rounded-xl" /> 
});

const WorldHeatmap = dynamic(() => import("./world-heatmap"), { 
  ssr: false, 
  loading: () => <div className="h-[300px] sm:h-[400px] w-full bg-muted/20 animate-pulse rounded-xl" /> 
});

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Activity, BarChart3, Users } from "lucide-react";

interface AdminDashboardProps {
  stats: {
    totalLinks: number;
    totalClicks: number;
    activeMembers: number;
    totalEarnings: number;
    realClicks?: number;
    uniqueUsers?: number;
    filteredClicks?: number;
    botExcluded?: number;
    facebookScrapers?: number;
  };
  recentLinks: any[];
  recentClicks: any[];
  topMembers: any[];
  profile: any;
  heatmapData: Array<{ code: string; value: number }>;
  trendData?: Array<{ date: string; clicks: number; earnings: number }>;
  globalGoal: number;
  overallClicks: number;
  personalGoal: number;
  personalClicks: number;
  monthlyMembers: any[];
  topCountries?: Array<{ country: string; country_code: string; click_count: number }>;
  currentRange?: string;
}

export default function AdminDashboard({
  stats,
  recentLinks,
  recentClicks,
  topMembers,
  profile,
  heatmapData,
  trendData,
  globalGoal = 10000,
  overallClicks = 0,
  personalGoal = 1000,
  personalClicks = 0,
  monthlyMembers = [],
  topCountries = [],
  currentRange = "today",
}: AdminDashboardProps) {
  const displayName = profile?.display_name || profile?.full_name || "Admin";

  const rangeLabel = {
    today: "today",
    "7d": "last 7 days",
    "30d": "last 30 days",
    "90d": "last 90 days",
    all: "all time",
  }[currentRange] || "last 30 days";

  const globalProgress = Math.min((overallClicks / (globalGoal || 1)) * 100, 100);
  const personalProgress = Math.min((personalClicks / (personalGoal || 1)) * 100, 100);

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto pb-12">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"
      >
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-foreground tracking-tight leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
            LinkFlux <span className="text-primary italic">Analytics</span>
          </h1>
        </div>
        <p className="text-muted-foreground text-xs sm:text-sm font-medium ml-1">
          Welcome back, <span className="text-foreground font-bold">{displayName}</span>. Here's your platform performance {rangeLabel}.
        </p>
      </div>
      <div className="flex items-center gap-4 bg-card border border-border/50 p-1 rounded-xl sm:rounded-2xl shadow-sm self-start lg:self-end">
        <RangeSelector />
      </div>
      </motion.div>
 
      {/* KPI Section */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <KpiStats stats={stats} isAdmin />
        </div>
        
        {/* Progress Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="relative group p-6 rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent overflow-hidden"
        >
          <div className="absolute top-0 right-0 -translate-y-1/4 translate-x-1/4 w-32 h-32 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-1000" />
          
          <div className="relative flex flex-col h-full justify-between gap-5">
            <div className="flex items-center justify-between">
              <div className="p-2 rounded-xl bg-primary/20 text-primary">
                <BarChart3 className="w-5 h-5" />
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold uppercase tracking-wider">
                Monthly Targets
              </Badge>
            </div>

            <div className="space-y-4">
              {/* Global Goal */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black text-foreground uppercase tracking-wider">Global Goal</span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {globalProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs font-semibold tabular-nums text-foreground/90">
                  <span>{overallClicks.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">/ {globalGoal.toLocaleString()}</span></span>
                  <span className="text-[10px] text-muted-foreground font-medium italic">
                    {overallClicks >= globalGoal ? "Target Met! 🎉" : `${(globalGoal - overallClicks).toLocaleString()} left`}
                  </span>
                </div>
                <div className="relative h-2 w-full bg-primary/15 rounded-full overflow-hidden border border-primary/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${globalProgress}%` }}
                    transition={{ duration: 1.5, ease: "circOut", delay: 0.6 }}
                    className="h-full bg-primary relative"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" />
                  </motion.div>
                </div>
              </div>

              {/* Personal Goal */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-black text-foreground uppercase tracking-wider">My Goal</span>
                  <span className="text-[10px] font-bold text-muted-foreground">
                    {personalProgress.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-baseline justify-between text-xs font-semibold tabular-nums text-foreground/90">
                  <span>{personalClicks.toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">/ {personalGoal.toLocaleString()}</span></span>
                  <span className="text-[10px] text-muted-foreground font-medium italic">
                    {personalClicks >= personalGoal ? "Goal Met! 🔥" : `${(personalGoal - personalClicks).toLocaleString()} left`}
                  </span>
                </div>
                <div className="relative h-2 w-full bg-primary/15 rounded-full overflow-hidden border border-primary/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${personalProgress}%` }}
                    transition={{ duration: 1.5, ease: "circOut", delay: 0.8 }}
                    className="h-full bg-emerald-500 relative"
                  >
                    <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.4)_50%,transparent_100%)] animate-[shimmer_2s_infinite]" />
                  </motion.div>
                </div>
              </div>
            </div>
            
            <p className="text-[9px] leading-relaxed text-muted-foreground/60 font-medium italic">
              Monthly stats automatically reset at the start of each month.
            </p>
          </div>
        </motion.div>
      </div>

      {/* Main Insights Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Charts & Map */}
        <div className="lg:col-span-8 space-y-6">
          <TrendCharts data={trendData} label={rangeLabel} />
          <WorldHeatmap data={heatmapData} />
        </div>

        {/* Live Feed */}
        <div className="lg:col-span-4 lg:h-full">
          <ActivityFeed initialClicks={recentClicks} />
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pb-4">
        <TopCountries data={topCountries} title="Geographic Click Performance" />
        <MemberLeaderboard members={topMembers} monthlyMembers={monthlyMembers} />
      </div>

      {/* Bottom Full-width Row */}
      <div className="pt-2 border-t border-border/40">
        <RecentLinks links={recentLinks} />
      </div>
    </div>
  );
}
