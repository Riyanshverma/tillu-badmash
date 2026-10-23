import { z } from "zod";
import { AccuracyMetricsSchema } from "./accuracy";
import {
  hourSchema,
  isoDateSchema,
  isoDateTimeSchema,
  mwNonNegativeSchema,
  mwSchema,
} from "./common";

export const ComparisonPointSchema = z.object({
  start_time: isoDateTimeSchema,
  hour: hourSchema,
  forecast_mw: mwNonNegativeSchema,
  actual_mw: mwNonNegativeSchema,
  error_mw: mwSchema,
  absolute_error_mw: mwNonNegativeSchema,
});
export type ComparisonPoint = z.infer<typeof ComparisonPointSchema>;

export const ComparisonCompletenessSchema = z.object({
  expected_hours: z.number().int().min(0),
  matched_hours: z.number().int().min(0),
  missing_hours: z.number().int().min(0),
});
export type ComparisonCompleteness = z.infer<typeof ComparisonCompletenessSchema>;

export const ComparisonResponseSchema = z.object({
  decision_date: isoDateSchema,
  delivery_date: isoDateSchema,
  decision_cutoff: isoDateTimeSchema,
  completeness: ComparisonCompletenessSchema,
  metrics: AccuracyMetricsSchema,
  series: z.array(ComparisonPointSchema),
});
export type ComparisonResponse = z.infer<typeof ComparisonResponseSchema>;
