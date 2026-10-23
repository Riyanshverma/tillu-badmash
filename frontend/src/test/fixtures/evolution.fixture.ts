import type { ForecastEvolutionResponse } from "../../contracts";

export const mockEvolutionResponse: ForecastEvolutionResponse = {
  target_time: "2026-01-16T12:00:00Z",
  hour: 12,
  decision_date: "2026-01-15",
  decision_cutoff: "2026-01-15T09:20:00Z",
  actual_mw: 8766.5,
  selected_publish_time: "2026-01-15T07:30:00Z",
  series: [
    {
      publish_time: "2026-01-15T02:30:00Z",
      forecast_mw: 9020.0,
      is_available_at_decision: true,
      is_selected_at_decision: false,
    },
    {
      publish_time: "2026-01-15T04:30:00Z",
      forecast_mw: 7903.0,
      is_available_at_decision: true,
      is_selected_at_decision: false,
    },
    {
      publish_time: "2026-01-15T07:30:00Z",
      forecast_mw: 7779.0,
      is_available_at_decision: true,
      is_selected_at_decision: true,
    },
    {
      publish_time: "2026-01-15T09:30:00Z",
      forecast_mw: 7802.0,
      is_available_at_decision: false,
      is_selected_at_decision: false,
    },
    {
      publish_time: "2026-01-15T12:25:00Z",
      forecast_mw: 7673.0,
      is_available_at_decision: false,
      is_selected_at_decision: false,
    },
    {
      publish_time: "2026-01-15T15:30:00Z",
      forecast_mw: 7831.0,
      is_available_at_decision: false,
      is_selected_at_decision: false,
    },
    {
      publish_time: "2026-01-15T18:30:00Z",
      forecast_mw: 7656.0,
      is_available_at_decision: false,
      is_selected_at_decision: false,
    },
    {
      publish_time: "2026-01-15T22:30:00Z",
      forecast_mw: 7371.0,
      is_available_at_decision: false,
      is_selected_at_decision: false,
    },
  ],
};
