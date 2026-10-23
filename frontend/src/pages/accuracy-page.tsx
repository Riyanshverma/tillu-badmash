import { useState } from "react";
import {
  useAccuracy,
  useComparison,
  useForecastEvolution,
} from "../lib/queries";
import { AccuracyHeader } from "../components/accuracy/accuracy-header";
import { AccuracyMetricsGrid } from "../components/accuracy/accuracy-metrics";
import { ForecastVsActualChart } from "../components/charts/forecast-vs-actual-chart";
import { ForecastErrorChart } from "../components/charts/forecast-error-chart";
import { ErrorHeatmap } from "../components/charts/error-heatmap";
import { ForecastEvolutionChart } from "../components/charts/forecast-evolution-chart";
import { AccuracyMethodology } from "../components/accuracy/accuracy-methodology";
import {
  AccuracyPageSkeleton,
  ChartCardSkeleton,
} from "../components/common/loading-skeletons";
import { ErrorState } from "../components/common/error-state";

export function AccuracyPage() {
  // Key state for drill-down and interactive comparison/evolution views
  const [comparisonDate, setComparisonDate] = useState("2026-01-15");
  const [evolutionTargetTime, setEvolutionTargetTime] = useState(
    "2026-01-16T12:00:00Z"
  );

  // Queries for analytical data
  const {
    data: accuracy,
    isLoading: isAccuracyLoading,
    isError: isAccuracyError,
    error: accuracyError,
    refetch: refetchAccuracy,
  } = useAccuracy();

  const {
    data: comparison,
    isLoading: isComparisonLoading,
    isError: isComparisonError,
    error: comparisonError,
    refetch: refetchComparison,
  } = useComparison(comparisonDate);

  const {
    data: evolution,
    isLoading: isEvolutionLoading,
    isError: isEvolutionError,
    error: evolutionError,
    refetch: refetchEvolution,
  } = useForecastEvolution(evolutionTargetTime);

  if (isAccuracyLoading) {
    return <AccuracyPageSkeleton />;
  }

  if (isAccuracyError) {
    return (
      <ErrorState
        title="Unable to load forecast accuracy evaluation"
        error={accuracyError}
        onRetry={() => refetchAccuracy()}
        entityName="accuracy analytics"
      />
    );
  }

  if (!accuracy) {
    return null;
  }

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
      {isComparisonLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCardSkeleton
            height="h-[280px]"
            title="Loading daily forecast vs outturn..."
          />
          <ChartCardSkeleton
            height="h-[280px]"
            title="Loading daily signed error..."
          />
        </div>
      ) : isComparisonError ? (
        <ErrorState
          title={`Unable to load delivery comparison for ${comparisonDate}`}
          error={comparisonError}
          onRetry={() => refetchComparison()}
          entityName="delivery comparison"
        />
      ) : comparison ? (
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
      ) : null}

      {/* 4. Complete January 2026 Error Heatmap */}
      <ErrorHeatmap
        heatmapData={accuracy.heatmap}
        onSelectPoint={(point) => {
          setComparisonDate(point.decision_date);
          setEvolutionTargetTime(point.start_time);
        }}
      />

      {/* 5. Intraday Forecast Evolution towards Target Delivery Hour */}
      {isEvolutionLoading ? (
        <ChartCardSkeleton
          height="h-[300px]"
          title="Loading vintage evolution..."
        />
      ) : isEvolutionError ? (
        <ErrorState
          title={`Unable to load forecast evolution for ${evolutionTargetTime}`}
          error={evolutionError}
          onRetry={() => refetchEvolution()}
          entityName="forecast evolution"
        />
      ) : evolution ? (
        <ForecastEvolutionChart evolution={evolution} />
      ) : null}

      {/* 6. Context & Methodology */}
      <AccuracyMethodology />
    </div>
  );
}
