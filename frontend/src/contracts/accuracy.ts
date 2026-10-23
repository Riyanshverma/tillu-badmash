import { z } from "zod";
import {
  hourSchema,
  isoDateSchema,
  isoDateTimeSchema,
  mwNonNegativeSchema,
  mwSchema,
  percentSchema,
  wapeSchema,
} from "./common";

export const AccuracyPeriodSchema = z.object({
  decision_date_from: isoDateSchema,
  decision_date_to: isoDateSchema,
  decision_cutoff_time: z.string(),
  market_timezone: z.string(),
});
export type AccuracyPeriod = z.infer<typeof AccuracyPeriodSchema>;

export const AccuracyMetricsSchema = z.object({
  mae_mw: mwNonNegativeSchema,
  rmse_mw: mwNonNegativeSchema,
  bias_mw: mwSchema,
  wape_percent: wapeSchema,
  p90_abs_error_mw: mwNonNegativeSchema,
  over_forecast_percent: percentSchema,
  under_forecast_percent: percentSchema,
  matched_points: z.number().int().min(0),
});
export type AccuracyMetrics = z.infer<typeof AccuracyMetricsSchema>;

export const AccuracyHeatmapPointSchema = z.object({
  decision_date: isoDateSchema,
  delivery_date: isoDateSchema,
  start_time: isoDateTimeSchema,
  hour: hourSchema,
  forecast_mw: mwNonNegativeSchema,
  actual_mw: mwNonNegativeSchema,
  error_mw: mwSchema,
});
export type AccuracyHeatmapPoint = z.infer<typeof AccuracyHeatmapPointSchema>;

export const HourOfDayErrorSchema = z.object({
  hour: hourSchema,
  mae_mw: mwNonNegativeSchema,
  p90_abs_error_mw: mwNonNegativeSchema,
});
export type HourOfDayError = z.infer<typeof HourOfDayErrorSchema>;

export const AccuracyResponseSchema = z.object({
  period: AccuracyPeriodSchema,
  metrics: AccuracyMetricsSchema,
  heatmap: z.array(AccuracyHeatmapPointSchema),
  hour_of_day_error: z.array(HourOfDayErrorSchema),
});
export type AccuracyResponse = z.infer<typeof AccuracyResponseSchema>;
