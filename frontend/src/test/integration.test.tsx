import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { z } from "zod";
import {
  getDecision,
  getAccuracy,
  getComparison,
  getForecastEvolution,
  ApiError,
  ContractValidationError,
} from "../lib/api-client";
import { queryKeys } from "../lib/queries";
import { DecisionPage } from "../pages/decision-page";
import { AccuracyPage } from "../pages/accuracy-page";
import { AccuracyMetricsGrid } from "../components/accuracy/accuracy-metrics";
import { ErrorState } from "../components/common/error-state";
import {
  DecisionPageSkeleton,
  AccuracyPageSkeleton,
} from "../components/common/loading-skeletons";
import {
  mockDecisionResponse,
  mockAccuracyResponse,
  mockComparisonResponse,
  mockEvolutionResponse,
} from "./fixtures";
import { formatPercent } from "../lib/format";
import { createTestQueryClient, TestQueryWrapper } from "./test-utils";

describe("Phase 4: Backend Integration & Runtime Validation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("API Client & Zod Contract Validation", () => {
    it("getDecision parses valid response through DecisionResponseSchema", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockDecisionResponse,
      } as Response);

      const data = await getDecision("2026-01-15");
      expect(data.decision_date).toBe("2026-01-15");
      expect(data.delivery_date).toBe("2026-01-16");
      expect(data.series).toHaveLength(24);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/decisions/2026-01-15"),
        expect.any(Object)
      );
    });

    it("getAccuracy parses valid response including nullable WAPE", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockAccuracyResponse,
      } as Response);

      const data = await getAccuracy();
      expect(data.period.decision_date_from).toBe("2026-01-01");
      expect(data.metrics.matched_points).toBe(744);
      expect(data.heatmap).toHaveLength(744);
    });

    it("getComparison parses valid comparison response with corrected noon anchor", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockComparisonResponse,
      } as Response);

      const data = await getComparison("2026-01-15");
      expect(data.decision_date).toBe("2026-01-15");
      const noon = data.series.find((s) => s.hour === 12);
      expect(noon).toBeDefined();
      expect(noon?.forecast_mw).toBe(7779.0);
      expect(noon?.actual_mw).toBe(8766.5);
      expect(noon?.error_mw).toBe(-987.5);
    });

    it("getForecastEvolution parses valid evolution response with URL-encoded query", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => mockEvolutionResponse,
      } as Response);

      const target = "2026-01-16T12:00:00Z";
      const data = await getForecastEvolution(target);
      expect(data.target_time).toBe(target);
      expect(data.actual_mw).toBe(8766.5);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `/api/v1/forecast-evolution?target_time=${encodeURIComponent(target)}`
        ),
        expect.any(Object)
      );
    });

    it("throws ContractValidationError when response violates schema", async () => {
      const invalidData = {
        ...mockDecisionResponse,
        series: [{ invalid: "data" }], // Missing required fields
      };

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => invalidData,
      } as Response);

      await expect(getDecision("2026-01-15")).rejects.toThrow(
        ContractValidationError
      );
    });

    it("throws ApiError with status and parsed body on HTTP failure", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({ detail: "No decision-time forecasts available" }),
      } as Response);

      try {
        await getDecision("2026-01-15");
        expect.unreachable("Should have thrown ApiError");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        const apiErr = err as ApiError;
        expect(apiErr.status).toBe(404);
        expect(apiErr.body).toEqual({
          detail: "No decision-time forecasts available",
        });
      }
    });
  });

  describe("Query Keys & Date Switching", () => {
    it("generates stable query keys for all endpoints", () => {
      expect(queryKeys.decision("2026-01-15")).toEqual([
        "decision",
        "2026-01-15",
      ]);
      expect(queryKeys.accuracy()).toEqual(["accuracy"]);
      expect(queryKeys.comparison("2026-01-15")).toEqual([
        "comparison",
        "2026-01-15",
      ]);
      expect(queryKeys.forecastEvolution("2026-01-16T12:00:00Z")).toEqual([
        "forecast-evolution",
        "2026-01-16T12:00:00Z",
      ]);
    });

    it("DecisionPage switches query when selecting a different date", async () => {
      const jan31Decision = {
        ...mockDecisionResponse,
        decision_date: "2026-01-31",
        delivery_date: "2026-02-01",
        decision_cutoff: "2026-01-31T09:20:00Z",
      };

      vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
        if (String(url).includes("2026-01-31")) {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => jan31Decision,
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => mockDecisionResponse,
        } as Response;
      });

      const queryClient = createTestQueryClient();
      queryClient.setQueryData(
        queryKeys.decision("2026-01-15"),
        mockDecisionResponse
      );
      queryClient.setQueryData(queryKeys.decision("2026-01-31"), jan31Decision);

      render(
        <TestQueryWrapper client={queryClient}>
          <MemoryRouter>
            <DecisionPage />
          </MemoryRouter>
        </TestQueryWrapper>
      );

      // Initially renders 15 Jan
      expect(screen.getByText("15 Jan 2026 · 09:20 GMT")).toBeInTheDocument();
      expect(screen.getByText("16 Jan 2026")).toBeInTheDocument();

      // Change date to 31 Jan
      const select = screen.getByLabelText("Select Decision Date");
      fireEvent.change(select, { target: { value: "2026-01-31" } });

      // Verifies Jan 31 -> Feb 01 mapping
      await waitFor(() => {
        expect(screen.getByText("31 Jan 2026 · 09:20 GMT")).toBeInTheDocument();
        expect(screen.getByText("1 Feb 2026")).toBeInTheDocument();
      });
    });
  });

  describe("Nullable WAPE Presentation", () => {
    it("formatPercent returns '—' for null and undefined", () => {
      expect(formatPercent(null)).toBe("—");
      expect(formatPercent(undefined)).toBe("—");
      expect(formatPercent(NaN)).toBe("—");
      expect(formatPercent(Infinity)).toBe("—");
      expect(formatPercent(8.7)).toBe("8.7%");
      expect(formatPercent(140.5)).toBe("140.5%");
    });

    it("AccuracyMetricsGrid renders '—' and explanation when wape_percent is null", () => {
      const nullWapeMetrics = {
        ...mockAccuracyResponse.metrics,
        wape_percent: null,
      };

      render(<AccuracyMetricsGrid metrics={nullWapeMetrics} />);

      // Must display '—', never 0% or NaN%
      expect(screen.getByText("—")).toBeInTheDocument();
      expect(screen.queryByText("0%")).not.toBeInTheDocument();
      expect(screen.queryByText("NaN%")).not.toBeInTheDocument();
      expect(
        screen.getByText("Unavailable because total actual generation is zero")
      ).toBeInTheDocument();
    });

    it("AccuracyMetricsGrid renders numeric WAPE when available", () => {
      const highWapeMetrics = {
        ...mockAccuracyResponse.metrics,
        wape_percent: 18.1,
      };

      render(<AccuracyMetricsGrid metrics={highWapeMetrics} />);
      expect(screen.getByText("18.1%")).toBeInTheDocument();
      expect(
        screen.getByText("Weighted absolute percentage error")
      ).toBeInTheDocument();
    });
  });

  describe("Loading Skeletons & Error State Components", () => {
    it("renders DecisionPageSkeleton without layout jumps", () => {
      render(<DecisionPageSkeleton />);
      expect(
        screen.getByTestId("decision-loading-skeleton")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Loading 24-hour forecast...")
      ).toBeInTheDocument();
    });

    it("renders AccuracyPageSkeleton without layout jumps", () => {
      render(<AccuracyPageSkeleton />);
      expect(
        screen.getByTestId("accuracy-loading-skeleton")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Loading 31 × 24 heatmap...")
      ).toBeInTheDocument();
    });

    it("ErrorState renders clear missing data alert for 404 responses", () => {
      const api404 = new ApiError(404, "Not Found", {
        detail: "No decision-time forecasts available",
      });

      render(
        <ErrorState
          error={api404}
          onRetry={vi.fn()}
          entityName="decision forecasts"
        />
      );

      expect(
        screen.getByText("No January wind data is available yet.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("No decision-time forecasts available")
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    it("ErrorState renders contract failure message on ContractValidationError", () => {
      const parseRes = z.string().safeParse(123);
      const zodError = !parseRes.success ? parseRes.error : new z.ZodError([]);
      const contractError = new ContractValidationError(
        zodError,
        { invalid: true }
      );

      render(<ErrorState error={contractError} entityName="accuracy" />);
      expect(
        screen.getByText("The API returned data in an unexpected format.")
      ).toBeInTheDocument();
    });

    it("AccuracyPage renders populated analytical data when queries resolve", async () => {
      const queryClient = createTestQueryClient();
      queryClient.setQueryData(queryKeys.accuracy(), mockAccuracyResponse);
      queryClient.setQueryData(
        queryKeys.comparison("2026-01-15"),
        mockComparisonResponse
      );
      queryClient.setQueryData(
        queryKeys.forecastEvolution("2026-01-16T12:00:00Z"),
        mockEvolutionResponse
      );

      render(
        <TestQueryWrapper client={queryClient}>
          <MemoryRouter>
            <AccuracyPage />
          </MemoryRouter>
        </TestQueryWrapper>
      );

      expect(
        screen.getByText("Forecast Accuracy & Uncertainty")
      ).toBeInTheDocument();
      expect(
        screen.getByText("January Forecast Error Heatmap")
      ).toBeInTheDocument();
      expect(screen.getByText("Forecast vs Hourly Outturn")).toBeInTheDocument();
    });
  });
});
