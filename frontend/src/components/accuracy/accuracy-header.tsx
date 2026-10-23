import { ShieldCheck, Calendar, Clock } from "lucide-react";
import type { AccuracyPeriod } from "../../contracts";
import { formatLondonDate } from "../../lib/dates";

interface AccuracyHeaderProps {
  period: AccuracyPeriod;
  matchedPoints: number;
}

export function AccuracyHeader({ period, matchedPoints }: AccuracyHeaderProps) {
  const fromStr = formatLondonDate(`${period.decision_date_from}T00:00:00Z`);
  const toStr = formatLondonDate(`${period.decision_date_to}T00:00:00Z`);

  return (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h1 className="text-[28px] font-[650] tracking-[-0.02em] text-slate-900 leading-tight">
          Forecast Accuracy & Uncertainty
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Quantifying decision-time forecast accuracy against outturn across January 2026 purchase decisions.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 shadow-xs font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span>{fromStr} – {toStr}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-white border border-slate-200 shadow-xs font-medium">
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Cutoff: {period.decision_cutoff_time} GMT</span>
        </span>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-slate-100 border border-slate-200 font-semibold text-slate-800">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
          <span>{matchedPoints} delivery hours</span>
        </span>
      </div>
    </div>
  );
}
