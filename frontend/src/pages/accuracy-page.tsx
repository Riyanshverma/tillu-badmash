import { useState } from "react";
import {
  mockAccuracyResponse,
  mockComparisonResponse,
  mockEvolutionResponse,
} from "../test/fixtures";
import { AccuracyHeader } from "../components/accuracy/accuracy-header";
import { AccuracyMetricsGrid } from "../components/accuracy/accuracy-metrics";
import { ForecastVsActualChart } from "../components/charts/forecast-vs-actual-chart";
import { ForecastErrorChart } from "../components/charts/forecast-error-chart";
import { ErrorHeatmap } from "../components/charts/error-heatmap";
import { ForecastEvolutionChart } from "../components/charts/forecast-evolution-chart";
import { AccuracyMethodology } from "../components/accuracy/accuracy-methodology";

export function AccuracyPage() {
  // Static fixture state for Phase 3; API fetching wired in Phase 4
  const [accuracy] = useState(mockAccuracyResponse);
  const [comparison] = useState(mockComparisonResponse);
  const [evolution] = useState(mockEvolutionResponse);

  return (
    <div className="space-y-8">
      {/* 1. Header with Period Context */}
      <AccuracyHeader
        period={accuracy.period}
        matchedPoints={accuracy.metrics.matched_points}
      />

      {/* 2. Key Accuracy Metrics Grid */}
      <AccuracyMetricsGrid metrics={accuracy.metrics} />

      {/* 3. Daily Evaluation: Forecast vs Actual and Signed Error Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ForecastVsActualChart
          series={comparison.series}
          deliveryDate={comparison.delivery_date}
        />
        <ForecastErrorChart
          series={comparison.series}
          deliveryDate={comparison.delivery_date}
        />
      </div>

      {/* 4. Complete January 2026 31 x 24 Error Heatmap */}
      <ErrorHeatmap heatmapData={accuracy.heatmap} />

      {/* 5. Intraday Forecast Evolution towards Target Delivery Hour */}
      <ForecastEvolutionChart evolution={evolution} />

      {/* 6. Context & Methodology */}
      <AccuracyMethodology />
    </div>
  );
}
