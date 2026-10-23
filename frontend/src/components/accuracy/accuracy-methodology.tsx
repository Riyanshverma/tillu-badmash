import { Info } from "lucide-react";

export function AccuracyMethodology() {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 text-xs text-slate-600 leading-relaxed">
      <div className="flex items-start gap-2.5">
        <Info className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
        <div className="space-y-1.5">
          <div className="font-semibold text-slate-800 text-[13px]">
            Accuracy Evaluation & Verification Methodology
          </div>
          <p>
            <strong className="text-slate-700">Data Sources:</strong> Official Elexon Insights Solution datasets: National Wind Generation Forecast (<code>WINDFOR</code>) and Half-Hourly Actual Generation by Fuel Type (<code>FUELHH</code>, filtered to <code>fuelType == &apos;WIND&apos;</code>). No non-Elexon or external weather model data is used.
          </p>
          <p>
            <strong className="text-slate-700">Hourly Actual Alignment:</strong> Elexon reports actual generation in half-hourly settlement periods. In accordance with BMRS settlement accounting, the hourly actual generation is derived by the arithmetic mean of the two half-hour settlement periods comprising that clock hour: <span className="font-mono text-slate-700">(SP<sub>2n-1</sub> + SP<sub>2n</sub>) / 2</span>.
          </p>
          <p>
            <strong className="text-slate-700">Strict Decision Cutoff:</strong> Locked to 09:20 Europe/London (EPEX SPOT GB DAA 1 60&apos; day-ahead auction gate closure). Under strict anti-lookahead rules, only forecast vintages published strictly prior to 09:20 GMT on the decision date are eligible. Subsequent vintages (such as 09:30 GMT) are discarded for day-ahead purchasing decisions.
          </p>
          <p>
            <strong className="text-slate-700">Error Sign Convention:</strong> <span className="font-mono text-slate-700">error_mw = forecast_mw - actual_mw</span>. A positive error indicates an <em>over-forecast</em> (forecast exceeded delivered generation; rendered in coral-red). A negative error indicates an <em>under-forecast</em> (actual generation exceeded forecast; rendered in teal).
          </p>
          <p>
            <strong className="text-slate-700">P90 Absolute Error Band:</strong> Represents the empirical 90th percentile of absolute prediction errors (<span className="font-mono text-slate-700">|error_mw|</span>) across all 744 matched hours in January 2026. This metric measures tail forecast dispersion and is an empirical quantile, not a parametric Gaussian confidence interval.
          </p>
        </div>
      </div>
    </div>
  );
}
