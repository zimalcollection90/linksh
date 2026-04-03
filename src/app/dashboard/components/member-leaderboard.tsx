"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Trophy, ShieldCheck, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Member {
  id: string;
  full_name?: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  status?: string;
  totalClicks?: number;
  linkCount?: number;
  realClicks?: number;
}

interface MemberLeaderboardProps {
  members: Member[];
}

const rankColors = ["text-amber-400", "text-slate-400", "text-amber-700", "text-muted-foreground"];

export default function MemberLeaderboard({ members }: MemberLeaderboardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const sorted = [...(members || [])].sort((a, b) => (b.realClicks ?? b.totalClicks ?? 0) - (a.realClicks ?? a.totalClicks ?? 0));
  const maxClicks = sorted[0]?.realClicks ?? sorted[0]?.totalClicks ?? 1;

  const initialLimit = 8;
  const displayedMembers = isExpanded ? sorted : sorted.slice(0, initialLimit);

  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="p-1.5 rounded-lg bg-amber-400/10">
          <Trophy className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="font-semibold text-sm leading-none">Member Leaderboard</h3>
          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-green-400" /> Ranked by verified human clicks
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground flex-1">
          <Trophy className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No members yet</p>
          <p className="text-xs mt-1 opacity-50 px-8 text-center">
            When members join and start sharing links, they will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          <AnimatePresence mode="popLayout">
            {displayedMembers.map((member, i) => {
              const name = member.display_name || member.full_name || member.email?.split("@")[0] || "Unknown";
              const initials = name.slice(0, 2).toUpperCase();
              const realClickCount = member.realClicks ?? 0;
              const totalClickCount = member.totalClicks ?? 0;
              const progress = (realClickCount / maxClicks) * 100;
              const qualityPct = totalClickCount > 0 ? Math.round((realClickCount / totalClickCount) * 100) : 100;

              return (
                <motion.div
                  key={member.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-muted/40 transition-all group border border-transparent hover:border-border/50"
                >
                  <div className="relative flex-shrink-0">
                    <span className={cn(
                      "absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background flex items-center justify-center text-[9px] font-bold shadow-sm border border-border/50",
                      rankColors[Math.min(i, 3)]
                    )}>
                      {i + 1}
                    </span>
                    <Avatar className="w-9 h-9 border border-border/50">
                      <AvatarImage src={member.avatar_url} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-bold truncate text-foreground/90">{name}</p>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[8px] uppercase tracking-widest py-0 px-1.5 border-0 font-extrabold",
                            member.status === "active"
                              ? "bg-green-500/10 text-green-400"
                              : member.status === "pending"
                              ? "bg-slate-500/10 text-slate-400"
                              : "bg-red-500/10 text-red-400"
                          )}
                        >
                          {member.status || "active"}
                        </Badge>
                        <Link href={`/dashboard/members/${member.id}`} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary">
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-green-400 font-bold">
                          {realClickCount.toLocaleString()} <span className="font-normal opacity-70">verified</span>
                        </span>
                        <span className="text-muted-foreground/60">
                          {qualityPct}% quality
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ delay: i * 0.03 + 0.1, duration: 0.8, ease: "circOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.3)]"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {sorted.length > initialLimit && (
            <div className="pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full text-xs text-muted-foreground hover:text-primary hover:bg-primary/5 h-8 gap-1.5 group"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 group-hover:-translate-y-0.5 transition-transform" />
                    Show Less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 group-hover:translate-y-0.5 transition-transform" />
                    Show {sorted.length - initialLimit} more members
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
