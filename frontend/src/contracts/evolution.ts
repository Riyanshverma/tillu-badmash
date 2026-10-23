import { z } from "zod";
import {
  hourSchema,
  isoDateSchema,
  isoDateTimeSchema,
  mwNonNegativeSchema,
} from "./common";

export const EvolutionSeriesPointSchema = z.object({
  publish_time: isoDateTimeSchema,
  forecast_mw: mwNonNegativeSchema,
  is_available_at_decision: z.boolean(),
  is_selected_at_decision: z.boolean(),
});
export type EvolutionSeriesPoint = z.infer<typeof EvolutionSeriesPointSchema>;

export const ForecastEvolutionResponseSchema = z.object({
  target_time: isoDateTimeSchema,
  hour: hourSchema,
  decision_date: isoDateSchema,
  decision_cutoff: isoDateTimeSchema,
  actual_mw: mwNonNegativeSchema.nullable(),
  selected_publish_time: isoDateTimeSchema,
  series: z.array(EvolutionSeriesPointSchema),
});
export type ForecastEvolutionResponse = z.infer<
  typeof ForecastEvolutionResponseSchema
>;
