import { useQuery } from "@tanstack/react-query";
import {
  getAccuracy,
  getComparison,
  getDecision,
  getForecastEvolution,
} from "./api-client";

export function useDecision(decisionDate: string) {
  return useQuery({
    queryKey: ["decision", decisionDate],
    queryFn: () => getDecision(decisionDate),
    enabled: Boolean(decisionDate),
  });
}

export function useAccuracy() {
  return useQuery({
    queryKey: ["accuracy"],
    queryFn: () => getAccuracy(),
  });
}

export function useComparison(decisionDate: string) {
  return useQuery({
    queryKey: ["comparison", decisionDate],
    queryFn: () => getComparison(decisionDate),
    enabled: Boolean(decisionDate),
  });
}

export function useForecastEvolution(targetTime: string) {
  return useQuery({
    queryKey: ["forecast-evolution", targetTime],
    queryFn: () => getForecastEvolution(targetTime),
    enabled: Boolean(targetTime),
  });
}
