"use client";

import React from "react";
import { motion } from "framer-motion";
import { Globe, TrendingUp } from "lucide-react";

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
  // Filter out unknown/invalid entries at display time as final safety net
  const cleanData = data.filter(
    (d) => d.country && d.country.toLowerCase() !== "unknown" && d.country.toLowerCase() !== "xx"
  );
  const total = cleanData.reduce((s, c) => s + c.click_count, 0) || 1;
  const top = cleanData.slice(0, 8);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Globe className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">{title}</h3>
        <span className="ml-auto text-xs text-muted-foreground">real clicks only</span>
      </div>

      {top.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
          <Globe className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">No country data yet</p>
          <p className="text-xs mt-1 opacity-60">Start sharing your links to see traffic origins</p>
        </div>
      ) : (
        <div className="space-y-3">
          {top.map((item, i) => {
            const pct = Math.round((item.click_count / total) * 100);
            return (
              <motion.div
                key={`${item.country_code}-${i}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-3"
              >
                <span className="text-xl leading-none w-7 flex-shrink-0">
                  {getFlagEmoji(item.country_code)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate pr-2">
                      {item.country === "Unknown" ? "Unknown Location" : item.country}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs font-bold text-foreground">
                        {item.click_count.toLocaleString()}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        ({pct}%)
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: i * 0.04 + 0.2, duration: 0.5, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{
                        background: i === 0
                          ? "linear-gradient(90deg, #7C3AED, #A78BFA)"
                          : i === 1
                          ? "linear-gradient(90deg, #0EA5E9, #22D3EE)"
                          : `hsl(${260 - i * 20}, 70%, 60%)`,
                      }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}

          {cleanData.length > 8 && (
            <p className="text-xs text-muted-foreground text-center pt-1">
              +{cleanData.length - 8} more countries
            </p>
          )}
        </div>
      )}

      {top.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border/50 flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {total.toLocaleString()} total real clicks from {cleanData.length} countr{cleanData.length === 1 ? "y" : "ies"}
          </span>
        </div>
      )}
    </div>
  );
}
