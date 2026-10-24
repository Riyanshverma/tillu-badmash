export function ContextStripSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-white border border-slate-200 rounded-[10px] p-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="space-y-2">
          <div className="h-3 w-20 bg-slate-200 rounded" />
          <div className="h-5 w-32 bg-slate-300 rounded" />
          <div className="h-2.5 w-24 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

export function MetricCardsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 ${
        count === 7
          ? "lg:grid-cols-4 xl:grid-cols-7"
          : "lg:grid-cols-3 xl:grid-cols-5"
      } gap-3.5`}
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="bg-white border border-slate-200 rounded-[10px] p-4 space-y-3 animate-pulse"
        >
          <div className="h-3 w-16 bg-slate-200 rounded" />
          <div className="h-7 w-28 bg-slate-300 rounded" />
          <div className="h-3 w-36 bg-slate-100 rounded pt-2 border-t border-slate-100" />
        </div>
      ))}
    </div>
  );
}

export function ChartCardSkeleton({
  height = "h-[380px]",
  title = "Loading visual profile...",
}: {
  height?: string;
  title?: string;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] animate-pulse flex flex-col justify-between">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="space-y-1.5">
          <div className="h-4 w-44 bg-slate-300 rounded" />
          <div className="h-3 w-64 bg-slate-100 rounded" />
        </div>
        <div className="h-5 w-24 bg-slate-200 rounded-full" />
      </div>
      <div
        className={`w-full ${height} my-4 bg-slate-50 border border-dashed border-slate-200 rounded-[8px] flex items-center justify-center text-xs text-slate-400`}
      >
        <span>{title}</span>
      </div>
      <div className="h-3 w-48 bg-slate-100 rounded pt-2 border-t border-slate-100" />
    </div>
  );
}

export function DecisionPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-60 bg-slate-300 rounded" />
          <div className="h-4 w-96 bg-slate-200 rounded" />
        </div>
        <div className="h-10 w-44 bg-slate-200 rounded-md" />
      </div>
      <ContextStripSkeleton />
      <MetricCardsSkeleton count={5} />
      <ChartCardSkeleton height="h-[380px]" title="Loading 24-hour forecast..." />
    </div>
  );
}

export function AccuracyPageSkeleton() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5 animate-pulse">
        <div className="space-y-2">
          <div className="h-7 w-64 bg-slate-300 rounded" />
          <div className="h-4 w-80 bg-slate-200 rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-7 w-32 bg-slate-200 rounded" />
          <div className="h-7 w-28 bg-slate-200 rounded" />
        </div>
      </div>
      <MetricCardsSkeleton count={7} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCardSkeleton height="h-[280px]" title="Loading forecast vs outturn..." />
        <ChartCardSkeleton height="h-[280px]" title="Loading error profile..." />
      </div>
      <ChartCardSkeleton height="h-[320px]" title="Loading 31 × 24 heatmap..." />
      <ChartCardSkeleton height="h-[300px]" title="Loading forecast evolution..." />
    </div>
  );
}
