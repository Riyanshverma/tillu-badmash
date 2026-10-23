import { useQuery } from "@tanstack/react-query";
import {
  getAccuracy,
  getComparison,
  getDecision,
  getForecastEvolution,
} from "./api-client";

export const queryKeys = {
  decision: (decisionDate: string) => ["decision", decisionDate] as const,
  accuracy: () => ["accuracy"] as const,
  comparison: (decisionDate: string) => ["comparison", decisionDate] as const,
  forecastEvolution: (targetTime: string) =>
    ["forecast-evolution", targetTime] as const,
};

export function useDecision(decisionDate: string) {
  return useQuery({
    queryKey: queryKeys.decision(decisionDate),
    queryFn: () => getDecision(decisionDate),
    enabled: Boolean(decisionDate),
  });
}

export function useAccuracy() {
  return useQuery({
    queryKey: queryKeys.accuracy(),
    queryFn: () => getAccuracy(),
  });
}

export function useComparison(decisionDate: string) {
  return useQuery({
    queryKey: queryKeys.comparison(decisionDate),
    queryFn: () => getComparison(decisionDate),
    enabled: Boolean(decisionDate),
  });
}

export function useForecastEvolution(targetTime: string) {
  return useQuery({
    queryKey: queryKeys.forecastEvolution(targetTime),
    queryFn: () => getForecastEvolution(targetTime),
    enabled: Boolean(targetTime),
  });
}
