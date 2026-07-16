"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="max-w-md w-full mx-auto rounded-2xl border border-red-500/20 bg-red-500/5 p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-lg font-bold" style={{ fontFamily: "Syne, sans-serif" }}>
          Failed to load Analytics
        </h2>
        <p className="text-sm text-muted-foreground">
          {error.message || "Something went wrong loading your analytics data."}
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 text-sm font-semibold transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
