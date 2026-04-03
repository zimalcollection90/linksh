"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Copy, Check, ExternalLink, BarChart2, ChevronDown, ChevronUp, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const initialLimit = 8;
  const displayedLinks = isExpanded ? links : links.slice(0, initialLimit);

  const handleCopy = (shortCode: string, id: string) => {
    navigator.clipboard.writeText(`${baseUrl}/${shortCode}`);
    setCopiedId(id);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Link2 className="w-4 h-4 text-primary" />
          </div>
          <h3 className="font-semibold text-sm">Recent Links</h3>
        </div>
        <Link 
          href="/dashboard/links" 
          className="text-[11px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
        >
          View all
        </Link>
      </div>

      {links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground flex-1">
          <div className="p-4 rounded-full bg-muted/20 mb-4">
            <ExternalLink className="w-10 h-10 opacity-20" />
          </div>
          <p className="text-sm font-medium text-foreground">No links yet</p>
          <p className="text-xs mt-1 opacity-50 mb-6">Start sharing your content today!</p>
          <Button asChild size="sm" variant="outline" className="rounded-full px-6">
            <Link href="/dashboard/links/new">Create First Link</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-2 flex-1">
          <AnimatePresence mode="popLayout">
            {displayedLinks.map((link, i) => (
              <motion.div
                key={link.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  "flex items-center gap-4 p-3 rounded-xl border border-transparent transition-all group",
                  "bg-muted/20 hover:bg-muted/40 hover:border-border/50"
                )}
              >
                <div className="w-10 h-10 rounded-xl bg-background border border-border/50 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <ExternalLink className="w-4 h-4 text-primary" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[13px] font-bold text-foreground font-mono leading-none tracking-tight">
                      /{link.short_code}
                    </p>
                    <Badge className={cn("text-[8px] uppercase font-extrabold tracking-widest py-0 px-1.5 h-4", statusColors[link.status || "active"])}>
                      {link.status || "active"}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate opacity-70 group-hover:opacity-100 transition-opacity">
                    {link.title || link.destination_url}
                  </p>
                </div>

                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-1 text-[13px] font-bold text-foreground">
                      {(link.click_count || 0).toLocaleString()}
                      <BarChart2 className="w-3 h-3 text-muted-foreground/50" />
                    </div>
                    <span className="text-[10px] text-muted-foreground/40 font-medium uppercase tracking-tighter">Clicks</span>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => handleCopy(link.short_code, link.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-background border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/20 transition-all"
                      title="Copy short link"
                    >
                      {copiedId === link.id ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <Link
                      href={`/dashboard/links/${link.id}`}
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-background border border-border/50 text-muted-foreground hover:text-primary hover:border-primary/20 transition-all"
                      title="View analytics"
                    >
                      <BarChart2 className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {links.length > initialLimit && (
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
                    Show {links.length - initialLimit} more links
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
