import { useState } from "react";
import { mockDecisionResponse } from "../test/fixtures";
import { formatLondonTime } from "../lib/dates";
import { DecisionHeader } from "../components/decision/decision-header";
import { DecisionContext } from "../components/decision/decision-context";
import { DecisionMetrics } from "../components/decision/decision-metrics";
import { ForecastProfileChart } from "../components/charts/forecast-profile-chart";
import { DecisionMethodology } from "../components/decision/decision-methodology";

export function DecisionPage() {
  // Static fixture data for Phase 2; API fetching wired in Phase 4
  const [decision] = useState(mockDecisionResponse);

  return (
    <div className="space-y-6">
      <DecisionHeader selectedDate={decision.decision_date} />
      <DecisionContext decision={decision} />
      <DecisionMetrics summary={decision.summary} />
      <ForecastProfileChart
        series={decision.series}
        selectedPublishTime={formatLondonTime(decision.selected_forecast_publish_time)}
      />
      <DecisionMethodology />
    </div>
  );
}
