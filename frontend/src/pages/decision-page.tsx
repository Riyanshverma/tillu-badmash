export function DecisionPage() {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-5">
        <h1 className="text-[28px] font-[650] tracking-[-0.02em] text-slate-900 leading-tight">
          Day-Ahead Wind Decision
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          EPEX SPOT GB DAA 1 (60&apos;) · Fixed decision cutoff at 09:20 Europe/London
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-[12px] p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-3 text-slate-700">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse" />
          <span className="text-sm font-semibold">
            Phase 1 Foundation Ready — Decision View
          </span>
        </div>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          Foundation shell and verified contracts are locked. The 24-point hourly forecast profile,
          historical P90 error band, and decision metrics will be mounted in Phase 2.
        </p>
      </div>
    </div>
  );
}
