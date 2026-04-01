"use client";

import React from "react";
import KpiStats from "./kpi-stats";
import ActivityFeed from "./activity-feed";
import TrendCharts from "./trend-charts";
import MemberLeaderboard from "./member-leaderboard";
import RecentLinks from "./recent-links";
import WorldHeatmap from "./world-heatmap";
import TopCountries from "./top-countries";
import { motion } from "framer-motion";

interface AdminDashboardProps {
  stats: {
    totalLinks: number;
    totalClicks: number;
    activeMembers: number;
    totalEarnings: number;
  };
  recentLinks: any[];
  recentClicks: any[];
  topMembers: any[];
  profile: any;
  heatmapData: Array<{ code: string; value: number }>;
  trendData?: Array<{ date: string; clicks: number; earnings: number }>;
  monthlyGoal?: number;
  topCountries?: Array<{ country: string; country_code: string; click_count: number }>;
}

export default function AdminDashboard({
  stats,
  recentLinks,
  recentClicks,
  topMembers,
  profile,
  heatmapData,
  trendData,
  monthlyGoal,
  topCountries = [],
}: AdminDashboardProps) {
  const displayName = profile?.display_name || profile?.full_name || "Admin";

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "Syne, sans-serif" }}>
          Welcome back, {displayName} 👋
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Here's what's happening across your platform today.</p>
      </motion.div>

      {/* KPI Stats */}
      <KpiStats stats={stats} isAdmin />

      {/* Charts + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TrendCharts data={trendData} />
        </div>
        <div>
          <ActivityFeed initialClicks={recentClicks} />
        </div>
      </div>

      {/* Geo distribution */}
      <WorldHeatmap data={heatmapData} />

      {/* Top Countries + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopCountries data={topCountries} title="Top Countries (Real Clicks)" />
        <MemberLeaderboard members={topMembers} />
      </div>

      {/* Recent Links */}
      <RecentLinks links={recentLinks} />
    </div>
  );
}
