export default function MembersLoading() {
  return (
    <div className="space-y-6 max-w-[1400px] mx-auto animate-pulse">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-32 rounded-lg bg-muted shimmer-bg" />
          <div className="h-4 w-48 rounded-lg bg-muted shimmer-bg" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-muted shimmer-bg" />
          <div className="h-9 w-28 rounded-lg bg-muted shimmer-bg" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-muted shimmer-bg flex-shrink-0" />
            <div className="space-y-1.5">
              <div className="h-6 w-10 rounded bg-muted shimmer-bg" />
              <div className="h-3 w-20 rounded bg-muted shimmer-bg" />
            </div>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 max-w-xs rounded-lg bg-muted shimmer-bg" />
        <div className="h-10 w-40 rounded-lg bg-muted shimmer-bg" />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Table header */}
        <div className="border-b border-border bg-muted/30 px-4 py-3 flex gap-4">
          <div className="h-3 w-4 rounded bg-muted shimmer-bg" />
          <div className="h-3 w-20 rounded bg-muted shimmer-bg" />
          <div className="h-3 w-12 rounded bg-muted shimmer-bg" />
          <div className="h-3 w-14 rounded bg-muted shimmer-bg" />
          <div className="h-3 w-10 rounded bg-muted shimmer-bg ml-auto" />
        </div>
        {/* Rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="border-b border-border/50 px-4 py-3 flex items-center gap-4">
            <div className="h-4 w-4 rounded bg-muted shimmer-bg" />
            <div className="flex items-center gap-3 flex-1">
              <div className="w-8 h-8 rounded-full bg-muted shimmer-bg" />
              <div className="space-y-1.5">
                <div className="h-3 w-28 rounded bg-muted shimmer-bg" />
                <div className="h-2.5 w-36 rounded bg-muted shimmer-bg" />
              </div>
            </div>
            <div className="h-5 w-16 rounded-full bg-muted shimmer-bg hidden md:block" />
            <div className="h-5 w-16 rounded-full bg-muted shimmer-bg hidden md:block" />
            <div className="h-4 w-12 rounded bg-muted shimmer-bg ml-auto" />
          </div>
        ))}
      </div>
    </div>
  );
}
