"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Calendar } from "lucide-react";

const RANGES = [
  { label: "Today", value: "today" },
  { label: "7D", value: "7d" },
  { label: "30D", value: "30d" },
  { label: "90D", value: "90d" },
  { label: "All", value: "all" },
];

export default function RangeSelector({ className }: { className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentRange = searchParams.get("range") || "today";

  const handleRangeChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`?${params.toString()}`);
  };

  return (
    <div className={cn("flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg border border-border/50", className)}>
      <div className="flex items-center px-2 mr-1 border-r border-border/50 text-muted-foreground">
        <Calendar className="w-3.5 h-3.5" />
      </div>
      {RANGES.map((range) => (
        <button
          key={range.value}
          onClick={() => handleRangeChange(range.value)}
          className={cn(
            "px-3 py-1 text-[11px] font-semibold rounded-md transition-all duration-200",
            currentRange === range.value
              ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          )}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
