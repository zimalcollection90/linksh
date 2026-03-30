"use client";

import React from "react";
import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy } from "lucide-react";

interface Member {
  id: string;
  full_name?: string;
  display_name?: string;
  email?: string;
  avatar_url?: string;
  status?: string;
  totalClicks?: number;
  linkCount?: number;
}

interface MemberLeaderboardProps {
  members: Member[];
}

const rankColors = ["text-amber-400", "text-slate-400", "text-amber-700", "text-muted-foreground"];

export default function MemberLeaderboard({ members }: MemberLeaderboardProps) {
  const sorted = [...members].sort((a, b) => (b.totalClicks || 0) - (a.totalClicks || 0));
  const maxClicks = sorted[0]?.totalClicks || 1;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Trophy className="w-4 h-4 text-amber-400" />
        <h3 className="font-semibold text-sm">Member Leaderboard</h3>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <Trophy className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No members yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((member, i) => {
            const name = member.display_name || member.full_name || member.email?.split("@")[0] || "Unknown";
            const initials = name.slice(0, 2).toUpperCase();
            const progress = ((member.totalClicks || 0) / maxClicks) * 100;

            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <span className={`text-sm font-bold w-5 text-center ${rankColors[Math.min(i, 3)]}`}>
                  {i + 1}
                </span>
                <Avatar className="w-7 h-7">
                  <AvatarImage src={member.avatar_url} />
                  <AvatarFallback className="text-xs bg-primary/20 text-primary">{initials}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium truncate">{name}</p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 px-1.5 ml-2 flex-shrink-0 border-0 ${
                        member.status === "active"
                          ? "bg-green-500/10 text-green-400"
                          : "bg-red-500/10 text-red-400"
                      }`}
                    >
                      {member.status || "active"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Progress value={progress} className="h-1 flex-1 bg-muted" />
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {(member.totalClicks || 0).toLocaleString()} clicks
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
