import type { AccuracyMetrics } from "../../contracts";
import { formatGw, formatMw, formatPercent, formatSignedErrorMw } from "../../lib/format";
import { MetricCard } from "../decision/metric-card";

interface AccuracyMetricsProps {
  metrics: AccuracyMetrics;
}

export function AccuracyMetricsGrid({ metrics }: AccuracyMetricsProps) {
  const isPositiveBias = metrics.bias_mw > 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
      <MetricCard
        label="MAE"
        value={formatMw(metrics.mae_mw, 0)}
        subValue={formatGw(metrics.mae_mw, 2)}
        description="Typical absolute hourly error"
      />
      <MetricCard
        label="RMSE"
        value={formatMw(metrics.rmse_mw, 0)}
        subValue={formatGw(metrics.rmse_mw, 2)}
        description="Penalizes larger forecast errors"
      />
      <MetricCard
        label="Systematic Bias"
        value={formatSignedErrorMw(metrics.bias_mw, 1)}
        subValue={isPositiveBias ? "Over-forecast" : "Under-forecast"}
        description="Mean directional error (forecast - actual)"
        accent={isPositiveBias ? "default" : "teal"}
      />
      <MetricCard
        label="WAPE"
        value={formatPercent(metrics.wape_percent, 1)}
        description={
          metrics.wape_percent === null
            ? "Unavailable because total actual generation is zero"
            : "Weighted absolute percentage error"
        }
        accent="blue"
      />
      <MetricCard
        label="Historical P90"
        value={formatMw(metrics.p90_abs_error_mw, 0)}
        subValue={formatGw(metrics.p90_abs_error_mw, 2)}
        description="90th percentile absolute error"
      />
      <MetricCard
        label="Over-Forecast"
        value={formatPercent(metrics.over_forecast_percent, 1)}
        description="Points where forecast > actual"
      />
      <MetricCard
        label="Under-Forecast"
        value={formatPercent(metrics.under_forecast_percent, 1)}
        description="Points where forecast < actual"
        accent="teal"
      />
    </div>
  );
}
