"use client";

import React from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { Copy, Check, ExternalLink, QrCode, BarChart2, MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface LinkItem {
  id: string;
  short_code: string;
  destination_url: string;
  title?: string;
  click_count?: number;
  status?: string;
  expires_at?: string;
  created_at: string;
}

interface RecentLinksProps {
  links: LinkItem[];
}

const statusColors: Record<string, string> = {
  active: "bg-cyan-500/10 text-cyan-400 border-0",
  expired: "bg-amber-500/10 text-amber-400 border-0",
  paused: "bg-slate-500/10 text-slate-400 border-0",
};

export default function RecentLinks({ links }: RecentLinksProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const handleCopy = (shortCode: string, id: string) => {
    navigator.clipboard.writeText(`${baseUrl}/${shortCode}`);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">Recent Links</h3>
        <Link href="/dashboard/links" className="text-xs text-primary hover:underline">View all</Link>
      </div>

      {links.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-muted-foreground">
          <ExternalLink className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No links yet. Create your first link!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {links.map((link, i) => (
            <motion.div
              key={link.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors group"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ExternalLink className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-xs font-medium text-foreground font-mono">/{link.short_code}</p>
                  <Badge className={`text-[10px] py-0 px-1.5 ${statusColors[link.status || "active"]}`}>
                    {link.status || "active"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{link.title || link.destination_url}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                <BarChart2 className="w-3 h-3" />
                {(link.click_count || 0).toLocaleString()}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleCopy(link.short_code, link.id)}
                  className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                >
                  {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
                <Link
                  href={`/dashboard/links/${link.id}`}
                  className="w-7 h-7 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
