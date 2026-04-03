"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CountryItem {
  country: string;
  country_code: string;
  click_count: number;
}

interface TopCountriesProps {
  data: CountryItem[];
  title?: string;
}

function getFlagEmoji(countryCode: string) {
  if (!countryCode || countryCode === "XX" || countryCode.length !== 2) return "🌐";
  try {
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  } catch {
    return "🌐";
  }
}

export default function TopCountries({ data, title = "Top Countries" }: TopCountriesProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out unknown/invalid entries at display time as final safety net
  const cleanData = [...(data || [])].map(d => ({
    ...d,
    country: d.country && !["unknown", "other", ""].includes(d.country.toLowerCase()) 
      ? d.country 
      : (d.country_code && d.country_code !== "XX" ? d.country_code : "Unknown Location")
  })).sort((a, b) => b.click_count - a.click_count);

  const total = cleanData.reduce((s, c) => s + c.click_count, 0) || 1;
  const initialLimit = 8;
  const displayedData = isExpanded ? cleanData : cleanData.slice(0, initialLimit);

  return (
    <div className="rounded-xl border border-border bg-card p-5 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-[10px] uppercase font-bold text-muted-foreground tracking-tighter opacity-70">
          Real Verification
        </span>
      </div>

      {cleanData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground flex-1">
          <Globe className="w-10 h-10 mb-3 opacity-20" />
          <p className="text-sm font-medium">No country data yet</p>
          <p className="text-xs mt-1 opacity-50 text-center">
            Traffic geographical data will appear here <br />
            once your links start getting clicks.
          </p>
        </div>
      ) : (
        <div className="space-y-4 flex-1">
          <AnimatePresence mode="popLayout">
            {displayedData.map((item, i) => {
              const pct = Math.round((item.click_count / total) * 100);
              return (
                <motion.div
                  key={`${item.country_code}-${i}`}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 group"
                >
                  <span className="text-xl leading-none w-7 flex-shrink-0 group-hover:scale-125 transition-transform duration-300">
                    {getFlagEmoji(item.country_code)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold truncate pr-2 text-foreground/90">
                        {["unknown", "other"].includes(item.country.toLowerCase()) ? "Other Location" : item.country}
                      </span>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-bold text-foreground">
                          {item.click_count.toLocaleString()}
                        </span>
                        <span className="text-[10px] font-medium text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden border border-border/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ delay: i * 0.03 + 0.1, duration: 0.8, ease: "circOut" }}
                        className="h-full rounded-full"
                        style={{
                          background: i === 0
                            ? "linear-gradient(90deg, #7C3AED, #A78BFA)"
                            : i === 1
                            ? "linear-gradient(90deg, #0EA5E9, #22D3EE)"
                            : i === 2
                            ? "linear-gradient(90deg, #10B981, #34D399)"
                            : `hsl(${260 - Math.min(i * 15, 100)}, 70%, 65%)`,
                          boxShadow: i < 3 ? "0 0 10px rgba(var(--primary-rgb), 0.2)" : "none"
                        }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {cleanData.length > initialLimit && (
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
                    Show {cleanData.length - initialLimit} more countries
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {cleanData.length > 0 && (
        <div className="mt-6 pt-3 border-t border-border/40 flex items-center gap-2">
          <div className="p-1 rounded bg-primary/10">
            <TrendingUp className="w-3 h-3 text-primary" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">
            {total.toLocaleString()} total verified clicks from {cleanData.length} locations
          </span>
        </div>
      )}
    </div>
  );
}
