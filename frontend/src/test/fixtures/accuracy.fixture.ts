import type {
  AccuracyHeatmapPoint,
  AccuracyResponse,
  HourOfDayError,
} from "../../contracts";

// Generate 31 days × 24 delivery hours = 744 heatmap points
function generateHeatmapPoints(): AccuracyHeatmapPoint[] {
  const points: AccuracyHeatmapPoint[] = [];

  for (let day = 1; day <= 31; day++) {
    const decisionDayStr = day.toString().padStart(2, "0");
    const decisionDate = `2026-01-${decisionDayStr}`;

    // Delivery is D + 1
    const deliveryDate =
      day === 31 ? "2026-02-01" : `2026-01-${(day + 1).toString().padStart(2, "0")}`;

    for (let hour = 0; hour < 24; hour++) {
      const hourStr = hour.toString().padStart(2, "0");
      const startTime = `${deliveryDate}T${hourStr}:00:00Z`;

      // Base pattern varying by hour and day
      let forecastMw = Math.round(
        7000 + 3000 * Math.sin((hour / 24) * Math.PI * 2) + ((day * 137) % 2500)
      );
      let actualMw = Math.round(
        forecastMw + (Math.sin(day + hour) * 800 + ((day * 71 + hour * 31) % 1100) - 500)
      );

      // Ensure exact match for empirical anchor: 2026-01-15 decision, hour 12
      if (day === 15 && hour === 12) {
        forecastMw = 7779.0;
        actualMw = 8781.0;
      }

      const errorMw = Math.round((forecastMw - actualMw) * 10) / 10;

      points.push({
        decision_date: decisionDate,
        delivery_date: deliveryDate,
        start_time: startTime,
        hour,
        forecast_mw: forecastMw,
        actual_mw: actualMw,
        error_mw: errorMw,
      });
    }
  }

  return points;
}

// 24 hours of day error summary
const hourOfDayError: HourOfDayError[] = Array.from({ length: 24 }, (_, hour) => ({
  hour,
  mae_mw: Math.round((600 + Math.sin(hour / 4) * 150) * 10) / 10,
  p90_abs_error_mw: Math.round((1250 + Math.sin(hour / 4) * 250) * 10) / 10,
}));

export const mockAccuracyResponse: AccuracyResponse = {
  period: {
    decision_date_from: "2026-01-01",
    decision_date_to: "2026-01-31",
    decision_cutoff_time: "09:20",
    market_timezone: "Europe/London",
  },
  metrics: {
    mae_mw: 720.4,
    rmse_mw: 941.8,
    bias_mw: 118.2,
    wape_percent: 8.7,
    p90_abs_error_mw: 1480.0,
    over_forecast_percent: 54.1,
    under_forecast_percent: 45.9,
    matched_points: 744,
  },
  heatmap: generateHeatmapPoints(),
  hour_of_day_error: hourOfDayError,
};
