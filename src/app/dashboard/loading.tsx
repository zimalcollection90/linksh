export default function DashboardLoading() {
  return (
    <div className="space-y-6 max-w-[1200px] mx-auto animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-lg bg-muted shimmer-bg" />
          <div className="h-4 w-64 rounded-lg bg-muted shimmer-bg" />
        </div>
        <div className="h-9 w-48 rounded-lg bg-muted shimmer-bg" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="h-4 w-20 rounded bg-muted shimmer-bg" />
            <div className="h-8 w-24 rounded bg-muted shimmer-bg" />
            <div className="h-3 w-16 rounded bg-muted shimmer-bg" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 rounded bg-muted shimmer-bg" />
          <div className="h-4 w-36 rounded bg-muted shimmer-bg" />
        </div>
        <div className="h-[220px] rounded-lg bg-muted shimmer-bg" />
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div className="h-4 w-32 rounded bg-muted shimmer-bg" />
            <div className="space-y-2.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted shimmer-bg flex-shrink-0" />
                  <div className="flex-1 h-3 rounded bg-muted shimmer-bg" />
                  <div className="h-3 w-12 rounded bg-muted shimmer-bg" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
