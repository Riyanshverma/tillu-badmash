import { z } from "zod";
import {
  hourSchema,
  isoDateSchema,
  isoDateTimeSchema,
  mwNonNegativeSchema,
} from "./common";

export const DecisionSeriesPointSchema = z.object({
  start_time: isoDateTimeSchema,
  hour: hourSchema,
  forecast_mw: mwNonNegativeSchema,
  publish_time: isoDateTimeSchema,
  p90_abs_error_mw: mwNonNegativeSchema,
  lower_mw: mwNonNegativeSchema,
  upper_mw: mwNonNegativeSchema,
});
export type DecisionSeriesPoint = z.infer<typeof DecisionSeriesPointSchema>;

export const DecisionCompletenessSchema = z.object({
  expected_hours: z.number().int().min(0),
  forecast_hours: z.number().int().min(0),
  missing_hours: z.number().int().min(0),
});
export type DecisionCompleteness = z.infer<typeof DecisionCompletenessSchema>;

export const DecisionSummarySchema = z.object({
  average_forecast_mw: mwNonNegativeSchema,
  peak_forecast_mw: mwNonNegativeSchema,
  peak_start_time: isoDateTimeSchema,
  historical_mae_mw: mwNonNegativeSchema,
  historical_p90_abs_error_mw: mwNonNegativeSchema,
});
export type DecisionSummary = z.infer<typeof DecisionSummarySchema>;

export const DecisionResponseSchema = z.object({
  decision_date: isoDateSchema,
  delivery_date: isoDateSchema,
  decision_cutoff: isoDateTimeSchema,
  market_timezone: z.string(),
  market_reference: z.string(),
  selected_forecast_publish_time: isoDateTimeSchema,
  forecast_age_minutes: z.number().int().min(0),
  completeness: DecisionCompletenessSchema,
  summary: DecisionSummarySchema,
  series: z.array(DecisionSeriesPointSchema),
});
export type DecisionResponse = z.infer<typeof DecisionResponseSchema>;
