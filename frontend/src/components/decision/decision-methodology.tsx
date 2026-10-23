import { Info } from "lucide-react";

export function DecisionMethodology() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 text-xs text-slate-600 leading-relaxed">
      <div className="flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <div className="font-semibold text-slate-800">
            Market Rules & Methodology Context
          </div>
          <p>
            <strong className="text-slate-700">Data Source:</strong> Official Elexon Insights Solution (raw WINDFOR forecast stream). No external weather or proprietary modeling is introduced.
          </p>
          <p>
            <strong className="text-slate-700">Decision Cutoff:</strong> Locked to 09:20 Europe/London (EPEX SPOT GB DAA 1 60&apos; auction gate closure). In accordance with the anti-lookahead rule, only forecast vintages published strictly before this cutoff are eligible. The next forecast vintage (09:30 GMT) is post-cutoff and discarded.
          </p>
          <p>
            <strong className="text-slate-700">Historical P90 Error Band:</strong> Represents the 90th percentile of absolute forecast misses observed across January 2026 by target hour of day. This is an empirical uncertainty band reflecting historical model drift, not a parametric probabilistic confidence interval.
          </p>
        </div>
      </div>
    </div>
  );
}
