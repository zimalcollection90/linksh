"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Monitor, Smartphone, Activity } from "lucide-react";
import { createClient } from "../../../../supabase/client";
import { formatDistanceToNow } from "date-fns";

interface ClickEvent {
  id: string;
  country?: string;
  country_code?: string;
  device_type?: string;
  clicked_at: string;
  links?: { title?: string; short_code: string };
}

interface ActivityFeedProps {
  initialClicks: ClickEvent[];
}

const deviceIcon = (type?: string) => {
  if (type === "mobile") return <Smartphone className="w-3.5 h-3.5 text-cyan-400" />;
  return <Monitor className="w-3.5 h-3.5 text-purple-400" />;
};

const countryFlag = (code?: string) => {
  if (!code || code === "XX" || code.length !== 2) return "🌍";
  try {
    return code.toUpperCase().replace(/./g, (char) =>
      String.fromCodePoint(127397 + char.charCodeAt(0))
    );
  } catch {
    return "🌍";
  }
};

export default function ActivityFeed({ initialClicks }: ActivityFeedProps) {
  const [clicks, setClicks] = useState<ClickEvent[]>(initialClicks);
  const [mounted, setMounted] = useState(false);
  const supabase = createClient();
  
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel("click_events_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "click_events" },
        async (payload) => {
          const newClick = payload.new as any;
          // Filter out bots and non-unique clicks from real-time feed
          if (newClick.is_bot || newClick.is_filtered || !newClick.is_unique) return;

          if (newClick.links === undefined) {
            const { data: linkData } = await supabase
              .from("links")
              .select("title, short_code")
              .eq("id", (payload.new as any).link_id)
              .single();
            (newClick as any).links = linkData;
          }
          setClicks((prev) => [newClick, ...prev].slice(0, 20));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "click_events" },
        async (payload) => {
          const updatedClick = payload.new as ClickEvent;
          if (updatedClick.links === undefined) {
            const { data: linkData } = await supabase
              .from("links")
              .select("title, short_code")
              .eq("id", (payload.new as any).link_id)
              .single();
            (updatedClick as any).links = linkData;
          }

          setClicks((prev) => {
            const idx = prev.findIndex((c) => c.id === updatedClick.id);
            if (idx === -1) return [updatedClick, ...prev].slice(0, 20);
            const next = [...prev];
            next[idx] = updatedClick;
            return next.slice(0, 20);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Live Activity</h3>
        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse ml-auto" />
        <span className="text-xs text-muted-foreground">Real-time</span>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {clicks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Activity className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No clicks yet. Share your links!</p>
          </div>
        ) : (
          <AnimatePresence>
            {clicks.map((click, i) => (
              <motion.div
                key={click.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i === 0 ? 0 : 0 }}
                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40 hover:bg-muted/70 transition-colors"
              >
                <span className="text-lg leading-none">{countryFlag(click.country_code)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {click.links?.title || `/${click.links?.short_code || "link"}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {click.country && click.country !== "Unknown" ? click.country : (click.country_code && click.country_code !== "XX" ? click.country_code : "Unknown Origin")} · {mounted && click.clicked_at && !isNaN(new Date(click.clicked_at).getTime()) ? formatDistanceToNow(new Date(click.clicked_at), { addSuffix: true }) : "just now"}
                  </p>
                </div>
                {deviceIcon(click.device_type)}
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
