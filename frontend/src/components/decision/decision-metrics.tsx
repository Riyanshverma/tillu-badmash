import type { DecisionSummary } from "../../contracts";
import { formatGw, formatMw } from "../../lib/format";
import { formatLondonTime } from "../../lib/dates";
import { MetricCard } from "./metric-card";

interface DecisionMetricsProps {
  summary: DecisionSummary;
}

export function DecisionMetrics({ summary }: DecisionMetricsProps) {
  const peakTimeStr = summary.peak_start_time
    ? formatLondonTime(summary.peak_start_time)
    : "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      <MetricCard
        label="Average Forecast"
        value={formatGw(summary.average_forecast_mw, 2)}
        subValue={formatMw(summary.average_forecast_mw, 0)}
        description="Mean expected 24h generation"
        accent="blue"
      />
      <MetricCard
        label="Peak Forecast"
        value={formatGw(summary.peak_forecast_mw, 2)}
        subValue={formatMw(summary.peak_forecast_mw, 0)}
        description="Maximum 24h generation expected"
        accent="blue"
      />
      <MetricCard
        label="Peak Delivery Hour"
        value={peakTimeStr.replace(" GMT", "")}
        subValue="GMT"
        description="Target hour of expected peak"
      />
      <MetricCard
        label="Historical MAE"
        value={formatMw(summary.historical_mae_mw, 0)}
        subValue={formatGw(summary.historical_mae_mw, 2)}
        description="Typical absolute hourly miss"
      />
      <MetricCard
        label="Historical P90 Error"
        value={formatMw(summary.historical_p90_abs_error_mw, 0)}
        subValue={formatGw(summary.historical_p90_abs_error_mw, 2)}
        description="90th percentile historical error"
      />
    </div>
  );
}
