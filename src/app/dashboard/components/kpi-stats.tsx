"use client";

import React from "react";
import { motion } from "framer-motion";
import { Link2, MousePointerClick, Users, DollarSign, TrendingUp, TrendingDown, ShieldCheck, Bot, FilterX, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  trend?: number;
  color?: "purple" | "teal" | "green" | "amber";
  delay?: number;
}

const colorMap = {
  purple: {
    bg: "bg-purple-500/10",
    icon: "text-purple-400",
    border: "border-purple-500/20",
    glow: "hover:shadow-purple-500/20",
  },
  teal: {
    bg: "bg-cyan-500/10",
    icon: "text-cyan-400",
    border: "border-cyan-500/20",
    glow: "hover:shadow-cyan-500/20",
  },
  green: {
    bg: "bg-green-500/10",
    icon: "text-green-400",
    border: "border-green-500/20",
    glow: "hover:shadow-green-500/20",
  },
  amber: {
    bg: "bg-amber-500/10",
    icon: "text-amber-400",
    border: "border-amber-500/20",
    glow: "hover:shadow-amber-500/20",
  },
};

export function StatCard({ title, value, icon: Icon, trend, color = "purple", delay = 0 }: StatCardProps) {
  const colors = colorMap[color];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={cn(
        "relative p-5 rounded-xl border bg-card transition-all duration-300 cursor-default",
        "hover:scale-[1.02] hover:shadow-lg",
        colors.border,
        colors.glow
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", colors.bg)}>
          <Icon className={cn("w-5 h-5", colors.icon)} />
        </div>
        {trend !== undefined && (
          <div className={cn(
            "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
            trend >= 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
          )}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <AnimatedNumber value={typeof value === "string" ? parseFloat(value.replace(/[^0-9.]/g, "")) || 0 : value} prefix={typeof value === "string" && value.startsWith("$") ? "$" : ""} />
        <p className="text-sm text-muted-foreground mt-1">{title}</p>
      </div>
    </motion.div>
  );
}

function AnimatedNumber({ value, prefix = "" }: { value: number; prefix?: string }) {
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    let start = 0;
    const duration = 1000;
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      start = Math.floor(eased * value);
      setDisplay(start);
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  const formatted = prefix === "$"
    ? `$${display.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : display.toLocaleString();

  return (
    <p className="text-2xl font-bold text-foreground count-up">{formatted}</p>
  );
}

interface KpiStatsProps {
  stats: {
    totalLinks: number;
    totalClicks: number;
    activeMembers?: number;
    totalEarnings: number;
    realClicks?: number;
    uniqueUsers?: number;
    filteredClicks?: number;
    botExcluded?: number;
  };
  isAdmin?: boolean;
}

export default function KpiStats({ stats, isAdmin = false }: KpiStatsProps) {
  const hasRealClickData = stats.realClicks !== undefined;

  const cards = [
    {
      title: "Total Links",
      value: stats.totalLinks,
      icon: Link2,
      color: "purple" as const,
    },
    {
      title: "Total Clicks",
      value: stats.totalClicks,
      icon: MousePointerClick,
      color: "teal" as const,
    },
    ...(hasRealClickData
      ? [
          {
            title: "Real Clicks",
            value: stats.realClicks || 0,
            icon: ShieldCheck,
            color: "green" as const,
            trend: undefined as number | undefined,
          },
          {
            title: "Unique Users",
            value: stats.uniqueUsers || 0,
            icon: UserCheck,
            color: "teal" as const,
            trend: undefined as number | undefined,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            title: "Active Members",
            value: stats.activeMembers || 0,
            icon: Users,
            color: "green" as const,
          },
        ]
      : []),
    {
      title: isAdmin ? "Total Earnings" : "My Earnings",
      value: `$${(stats.totalEarnings || 0).toFixed(2)}`,
      icon: DollarSign,
      color: "amber" as const,
    },
  ];

  return (
    <div className="space-y-3">
      <div className={cn(
        "grid gap-4",
        cards.length >= 6 ? "grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" :
        cards.length >= 5 ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-5" :
        isAdmin ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2 lg:grid-cols-3"
      )}>
        {cards.map((card, i) => (
          <StatCard key={card.title} {...card} delay={i * 0.08} />
        ))}
      </div>
      {hasRealClickData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <RealClickMetric
            label="Filtered Out"
            value={stats.filteredClicks || 0}
            total={stats.totalClicks}
            color="amber"
            icon={FilterX}
            description="Duplicate IPs / self-clicks"
          />
          <RealClickMetric
            label="Bots Excluded"
            value={stats.botExcluded || 0}
            total={stats.totalClicks}
            color="red"
            icon={Bot}
            description="Automated traffic"
          />
          <RealClickMetric
            label="Real Traffic %"
            value={stats.totalClicks > 0 ? Math.round(((stats.realClicks || 0) / stats.totalClicks) * 100) : 100}
            total={100}
            color="green"
            icon={ShieldCheck}
            description="Quality score"
            suffix="%"
          />
          <RealClickMetric
            label="Unique Rate"
            value={stats.totalClicks > 0 ? Math.round(((stats.uniqueUsers || 0) / stats.totalClicks) * 100) : 100}
            total={100}
            color="teal"
            icon={UserCheck}
            description="Unique vs total"
            suffix="%"
          />
        </div>
      )}
    </div>
  );
}

function RealClickMetric({
  label,
  value,
  total,
  color,
  icon: Icon,
  description,
  suffix = "",
}: {
  label: string;
  value: number;
  total: number;
  color: "amber" | "red" | "green" | "teal";
  icon: React.ElementType;
  description: string;
  suffix?: string;
}) {
  const colorMap = {
    amber: { text: "text-amber-400", bg: "bg-amber-500/10", bar: "bg-amber-400" },
    red: { text: "text-red-400", bg: "bg-red-500/10", bar: "bg-red-400" },
    green: { text: "text-green-400", bg: "bg-green-500/10", bar: "bg-green-400" },
    teal: { text: "text-cyan-400", bg: "bg-cyan-500/10", bar: "bg-cyan-400" },
  };
  const c = colorMap[color];
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card/50 p-3"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className={cn("w-6 h-6 rounded flex items-center justify-center", c.bg)}>
          <Icon className={cn("w-3.5 h-3.5", c.text)} />
        </div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-lg font-bold", c.text)}>{value.toLocaleString()}{suffix}</p>
      <div className="mt-1.5 h-1 rounded-full bg-muted overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-700", c.bar)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{description}</p>
    </motion.div>
  );
}
