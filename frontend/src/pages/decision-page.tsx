import { useState } from "react";
import { useDecision } from "../lib/queries";
import { formatLondonTime } from "../lib/dates";
import { DecisionHeader } from "../components/decision/decision-header";
import { DecisionContext } from "../components/decision/decision-context";
import { DecisionMetrics } from "../components/decision/decision-metrics";
import { ForecastProfileChart } from "../components/charts/forecast-profile-chart";
import { DecisionMethodology } from "../components/decision/decision-methodology";
import { DecisionPageSkeleton } from "../components/common/loading-skeletons";
import { ErrorState } from "../components/common/error-state";

export function DecisionPage() {
  const [selectedDate, setSelectedDate] = useState("2026-01-15");
  const { data: decision, isLoading, isError, error, refetch, isFetching } =
    useDecision(selectedDate);

  return (
    <div className="space-y-6">
      <DecisionHeader
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        isLoading={isFetching}
      />

      {isLoading ? (
        <DecisionPageSkeleton />
      ) : isError ? (
        <ErrorState
          title={`Unable to load decision data for ${selectedDate}`}
          error={error}
          onRetry={() => refetch()}
          entityName="decision forecasts"
        />
      ) : decision ? (
        <>
          <DecisionContext decision={decision} />
          <DecisionMetrics summary={decision.summary} />
          <ForecastProfileChart
            series={decision.series}
            selectedPublishTime={formatLondonTime(
              decision.selected_forecast_publish_time
            )}
          />
          <DecisionMethodology />
        </>
      ) : null}
    </div>
  );
}
