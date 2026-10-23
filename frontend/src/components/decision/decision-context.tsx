import { Calendar, Clock, Radio, ShieldCheck } from "lucide-react";
import type { DecisionResponse } from "../../contracts";
import {
  formatForecastAge,
  formatLondonDate,
  formatLondonTime,
} from "../../lib/dates";

interface DecisionContextProps {
  decision: DecisionResponse;
}

export function DecisionContext({ decision }: DecisionContextProps) {
  const decisionDateStr = formatLondonDate(decision.decision_cutoff);
  const decisionTimeStr = formatLondonTime(decision.decision_cutoff);
  const deliveryDateStr = formatLondonDate(
    `${decision.delivery_date}T00:00:00Z`
  );
  const publishTimeStr = formatLondonTime(
    decision.selected_forecast_publish_time
  );
  const ageStr = formatForecastAge(decision.forecast_age_minutes);

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
            <Clock className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Decision Cutoff
            </div>
            <div className="mt-0.5 text-sm font-[650] text-slate-900">
              {decisionDateStr} · {decisionTimeStr}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Gate closure ({decision.market_reference})
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 sm:pl-4 pt-3 sm:pt-0">
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
            <Calendar className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Delivery Date
            </div>
            <div className="mt-0.5 text-sm font-[650] text-slate-900">
              {deliveryDateStr}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              24 hourly delivery intervals (00–23)
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 sm:pl-4 pt-3 sm:pt-0">
          <div className="p-2 rounded-md bg-blue-50 border border-blue-200 text-blue-700">
            <Radio className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-blue-700">
              Selected Forecast
            </div>
            <div className="mt-0.5 text-sm font-[650] text-slate-900">
              {publishTimeStr}
            </div>
            <div className="text-[11px] text-emerald-700 font-medium mt-0.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Latest available pre-cutoff
            </div>
          </div>
        </div>

        <div className="flex items-start gap-3 sm:pl-4 pt-3 sm:pt-0">
          <div className="p-2 rounded-md bg-slate-50 border border-slate-200 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Forecast Age at Cutoff
            </div>
            <div className="mt-0.5 text-sm font-[650] text-slate-900">
              {ageStr}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Completeness: {decision.completeness.forecast_hours}/
              {decision.completeness.expected_hours} hours
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
