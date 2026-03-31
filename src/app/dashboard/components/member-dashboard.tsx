"use client";

import React from "react";
import KpiStats from "./kpi-stats";
import RecentLinks from "./recent-links";
import TrendCharts from "./trend-charts";
import { motion } from "framer-motion";
import { Progress } from "@/components/ui/progress";
import { Target } from "lucide-react";

interface MemberDashboardProps {
  stats: {
    totalLinks: number;
    totalClicks: number;
    totalEarnings: number;
    activeMembers?: number;
  };
  recentLinks: any[];
  profile: any;
  trendData?: Array<{ date: string; clicks: number; earnings: number }>;
  monthlyGoal?: number;
  monthlyClicks?: number;
}

export default function MemberDashboard({ stats, recentLinks, profile, trendData, monthlyGoal = 1000, monthlyClicks = 0 }: MemberDashboardProps) {
  const displayName = profile?.display_name || profile?.full_name || "there";
  const goalClicks = monthlyGoal;
  const progress = Math.min((monthlyClicks / goalClicks) * 100, 100);

  return (
    <div className="space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Welcome back, {displayName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Track your link performance and earnings.</p>
      </motion.div>

      {/* KPI Stats */}
      <KpiStats stats={stats} isAdmin={false} />

      {/* Goal Progress */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm">Monthly Goal</h3>
          <span className="ml-auto text-xs text-muted-foreground">{monthlyClicks.toLocaleString()} / {goalClicks.toLocaleString()} clicks</span>
        </div>
        <Progress value={progress} className="h-2 bg-muted" />
        <p className="text-xs text-muted-foreground mt-2">
          {progress >= 100
            ? "🎉 Goal achieved! Keep it up!"
            : `${(goalClicks - monthlyClicks).toLocaleString()} more clicks to reach your goal`}
        </p>
      </motion.div>

      {/* Charts + Links */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendCharts data={trendData} />
        <RecentLinks links={recentLinks} />
      </div>
    </div>
  );
}
