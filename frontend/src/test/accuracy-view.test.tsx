import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AccuracyPage } from "../pages/accuracy-page";
import { AccuracyMetricsGrid } from "../components/accuracy/accuracy-metrics";
import { ForecastVsActualChart } from "../components/charts/forecast-vs-actual-chart";
import { ForecastErrorChart } from "../components/charts/forecast-error-chart";
import { ErrorHeatmap } from "../components/charts/error-heatmap";
import { ForecastEvolutionChart } from "../components/charts/forecast-evolution-chart";
import {
  mockAccuracyResponse,
  mockComparisonResponse,
  mockEvolutionResponse,
  mockEvolutionHour17Response,
} from "./fixtures";
import { formatMw } from "../lib/format";
import { queryKeys } from "../lib/queries";
import { createTestQueryClient, TestQueryWrapper } from "./test-utils";

describe("Phase 3: Accuracy View & Components", () => {
  it("renders full AccuracyPage layout with fixtures", () => {
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

    // Header
    expect(screen.getByText("Forecast Accuracy & Uncertainty")).toBeInTheDocument();
    expect(
      screen.getByText(/Quantifying decision-time forecast accuracy against outturn across January 2026 purchase decisions\./)
    ).toBeInTheDocument();
    expect(screen.getByText("1 Jan 2026 – 31 Jan 2026")).toBeInTheDocument();
    expect(screen.getByText(/Cutoff: 09:20 GMT/)).toBeInTheDocument();
    expect(screen.getByText(/744 delivery hours/)).toBeInTheDocument();

    // Summary Metric Cards
    expect(screen.getByText("MAE")).toBeInTheDocument();
    expect(screen.getByText("RMSE")).toBeInTheDocument();
    expect(screen.getByText("Systematic Bias")).toBeInTheDocument();
    expect(screen.getByText("WAPE")).toBeInTheDocument();
    expect(screen.getByText("Historical P90")).toBeInTheDocument();
    expect(screen.getByText("Over-Forecast")).toBeInTheDocument();
    expect(screen.getByText("Under-Forecast")).toBeInTheDocument();

    // Daily Evaluation Charts
    expect(screen.getByText("Forecast vs Hourly Outturn")).toBeInTheDocument();
    expect(screen.getByText("Signed Forecast Error Profile")).toBeInTheDocument();

    // Error Heatmap
    expect(screen.getByText("January Forecast Error Heatmap")).toBeInTheDocument();

    // Evolution Section
    expect(screen.getByText("Forecast Evolution for Target Hour (12:00 GMT)")).toBeInTheDocument();

    // Methodology
    expect(
      screen.getByText("Accuracy Evaluation & Verification Methodology")
    ).toBeInTheDocument();
  });

  describe("AccuracyMetricsGrid", () => {
    it("renders all 7 core metrics and explicitly preserves signed bias", () => {
      render(<AccuracyMetricsGrid metrics={mockAccuracyResponse.metrics} />);

      // MAE: 720 MW (720.4 MW rounded for display)
      expect(
        screen.getByText(formatMw(mockAccuracyResponse.metrics.mae_mw, 0))
      ).toBeInTheDocument();

      // RMSE: 942 MW (941.8 MW rounded)
      expect(
        screen.getByText(formatMw(mockAccuracyResponse.metrics.rmse_mw, 0))
      ).toBeInTheDocument();

      // Signed bias: +118.2 MW (must preserve plus sign)
      expect(screen.getByText("+118.2 MW")).toBeInTheDocument();
      expect(screen.getByText("(Over-forecast)")).toBeInTheDocument();

      // WAPE: 8.7%
      expect(screen.getByText("8.7%")).toBeInTheDocument();

      // P90: 1,480 MW
      expect(screen.getByText("1,480 MW")).toBeInTheDocument();

      // Over/Under percentages: 54.1% and 45.9%
      expect(screen.getByText("54.1%")).toBeInTheDocument();
      expect(screen.getByText("45.9%")).toBeInTheDocument();
    });

    it("handles negative bias correctly with minus sign and under-forecast label", () => {
      const negativeBiasMetrics = {
        ...mockAccuracyResponse.metrics,
        bias_mw: -245.6,
      };

      render(<AccuracyMetricsGrid metrics={negativeBiasMetrics} />);
      expect(screen.getByText("-245.6 MW")).toBeInTheDocument();
      expect(screen.getByText("(Under-forecast)")).toBeInTheDocument();
    });
  });

  describe("Daily Comparison Charts", () => {
    it("renders ForecastVsActualChart with exactly 24 hourly points", () => {
      const { container } = render(
        <ForecastVsActualChart
          series={mockComparisonResponse.series}
          deliveryDate={mockComparisonResponse.delivery_date}
        />
      );

      expect(mockComparisonResponse.series).toHaveLength(24);
      expect(screen.getByText("Forecast vs Hourly Outturn")).toBeInTheDocument();
      expect(screen.getByText(/Delivery intervals: 24 points/)).toBeInTheDocument();
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("verifies mathematical identity error_mw = forecast_mw - actual_mw", () => {
      // Anchor: Hour 12 of delivery day 2026-01-16
      const pt12 = mockComparisonResponse.series.find((p) => p.hour === 12);
      expect(pt12).toBeDefined();
      expect(pt12?.forecast_mw).toBe(7779.0);
      expect(pt12?.actual_mw).toBe(8766.5);
      // 7779 - 8766.5 = -987.5 (under-forecast)
      expect(pt12?.error_mw).toBe(-987.5);
      expect(pt12!.forecast_mw - pt12!.actual_mw).toBe(pt12!.error_mw);
    });

    it("renders ForecastErrorChart with signed zero reference", () => {
      const { container } = render(
        <ForecastErrorChart
          series={mockComparisonResponse.series}
          deliveryDate={mockComparisonResponse.delivery_date}
        />
      );

      expect(screen.getByText("Signed Forecast Error Profile")).toBeInTheDocument();
      expect(screen.getByText(/Red = Over-forecast \| Teal = Under-forecast/)).toBeInTheDocument();
      expect(screen.getByText(/Over-forecast \(> 0 MW\)/)).toBeInTheDocument();
      expect(screen.getByText(/Under-forecast \(< 0 MW\)/)).toBeInTheDocument();
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });
  });

  describe("ErrorHeatmap", () => {
    it("renders exactly 744 cells (31 days x 24 hours)", () => {
      const { container } = render(
        <ErrorHeatmap heatmapData={mockAccuracyResponse.heatmap} />
      );

      expect(mockAccuracyResponse.heatmap).toHaveLength(744);
      expect(screen.getByText("January Forecast Error Heatmap")).toBeInTheDocument();
      expect(screen.getByText(/744 total intervals/)).toBeInTheDocument();

      // Find all cell buttons with aria-label containing Jan 2026
      const cells = container.querySelectorAll("button[aria-label*='Jan 2026']");
      expect(cells).toHaveLength(744);
    });

    it("displays color legend with all 5 bins", () => {
      render(<ErrorHeatmap heatmapData={mockAccuracyResponse.heatmap} />);

      expect(screen.getByText(/Under \(< -750 MW\)/)).toBeInTheDocument();
      expect(screen.getByText("Mild Under")).toBeInTheDocument();
      expect(screen.getByText("±200 MW")).toBeInTheDocument();
      expect(screen.getByText("Mild Over")).toBeInTheDocument();
      expect(screen.getByText(/Over \(> \+750 MW\)/)).toBeInTheDocument();
    });

    it("updates selected cell detail panel upon clicking a cell", () => {
      render(<ErrorHeatmap heatmapData={mockAccuracyResponse.heatmap} />);

      // Find a specific cell (15 Jan 2026, delivery 12:00, under-forecast by 988 MW)
      const cell15Hour12 = screen.getByRole("button", {
        name: /15 Jan 2026, delivery 12:00/,
      });
      expect(cell15Hour12).toBeInTheDocument();

      fireEvent.click(cell15Hour12);

      // Verify the details panel updates
      expect(screen.getByText("Selected Interval:")).toBeInTheDocument();
      expect(screen.getByText("-988 MW (Under-forecast)")).toBeInTheDocument();
      expect(screen.getByText("7,779 MW")).toBeInTheDocument();
      expect(screen.getByText("8,767 MW")).toBeInTheDocument();
    });
  });

  describe("ForecastEvolutionChart", () => {
    it("renders vintage points and dynamic captions for representative noon case", () => {
      const { container } = render(
        <ForecastEvolutionChart evolution={mockEvolutionResponse} />
      );

      expect(
        screen.getByText("Forecast Evolution for Target Hour (12:00 GMT)")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Target delivery: 16 Jan 2026 at 12:00 GMT · Progression of forecast vintages before and after 09:20 GMT cutoff/
        )
      ).toBeInTheDocument();

      // Check vintage points exist in the fixture series
      expect(mockEvolutionResponse.series).toHaveLength(8);

      // Selected vintage is 07:30Z
      const selected = mockEvolutionResponse.series.find(
        (v) => v.is_selected_at_decision
      );
      expect(selected).toBeDefined();
      expect(selected?.publish_time).toBe("2026-01-15T07:30:00Z");
      expect(selected?.forecast_mw).toBe(7779.0);
      expect(selected?.is_available_at_decision).toBe(true);

      // Post-cutoff vintage is 09:30Z
      const postCutoff = mockEvolutionResponse.series.find(
        (v) => v.publish_time === "2026-01-15T09:30:00Z"
      );
      expect(postCutoff).toBeDefined();
      expect(postCutoff?.is_available_at_decision).toBe(false);
      expect(postCutoff?.is_selected_at_decision).toBe(false);

      // Dynamic legend badges
      expect(screen.getByText("Selected Vintage (07:30 GMT)")).toBeInTheDocument();
      expect(screen.getByText("Actual Outturn (8,767 MW)")).toBeInTheDocument();
      expect(screen.getByText("09:20 GMT Decision Cutoff")).toBeInTheDocument();

      // Dynamic footer
      expect(
        screen.getByText(
          /Selected: 07:30 GMT vintage \(7,779 MW\) · Next vintage \(09:30 GMT\) is post-cutoff \(\+10m\)/
        )
      ).toBeInTheDocument();

      // Actual reference line
      expect(mockEvolutionResponse.actual_mw).toBe(8766.5);
      expect(
        container.querySelector(".recharts-responsive-container")
      ).toBeInTheDocument();
    });

    it("renders dynamic captions for alternate target hour (17:00 target)", () => {
      render(
        <ForecastEvolutionChart evolution={mockEvolutionHour17Response} />
      );

      // Title & subtitle must dynamically reflect 17:00 GMT and 30 Jan 2026
      expect(
        screen.getByText("Forecast Evolution for Target Hour (17:00 GMT)")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Target delivery: 30 Jan 2026 at 17:00 GMT · Progression of forecast vintages before and after 09:20 GMT cutoff/
        )
      ).toBeInTheDocument();

      // Badges must reflect 17:00 target's actual (16,352 MW) and selected vintage (07:30 GMT)
      expect(screen.getByText("Selected Vintage (07:30 GMT)")).toBeInTheDocument();
      expect(screen.getByText("Actual Outturn (16,352 MW)")).toBeInTheDocument();
      expect(screen.getByText("09:20 GMT Decision Cutoff")).toBeInTheDocument();

      // Footer must reflect 16,883 MW
      expect(
        screen.getByText(
          /Selected: 07:30 GMT vintage \(16,883 MW\) · Next vintage \(09:30 GMT\) is post-cutoff \(\+10m\)/
        )
      ).toBeInTheDocument();

      // Negative assertions: hard-coded noon values must NOT appear
      expect(screen.queryByText(/12:00 GMT/)).not.toBeInTheDocument();
      expect(screen.queryByText(/7,779 MW/)).not.toBeInTheDocument();
      expect(screen.queryByText(/8,767 MW/)).not.toBeInTheDocument();
    });

    it("positions cutoff marker separately from selected vintage publication", () => {
      // Selected publish time is 07:30Z; cutoff is 09:20Z; first post-cutoff is 09:30Z
      const selectedItem = mockEvolutionResponse.series.find(
        (v) => v.is_selected_at_decision
      )!;
      const firstPostCutoff = mockEvolutionResponse.series.find(
        (v) => !v.is_available_at_decision
      )!;

      const selectedTs = new Date(selectedItem.publish_time).getTime();
      const cutoffTs = new Date(mockEvolutionResponse.decision_cutoff).getTime();
      const postCutoffTs = new Date(firstPostCutoff.publish_time).getTime();

      // Strict ordering: selected < cutoff < postCutoff
      expect(selectedTs).toBeLessThan(cutoffTs);
      expect(cutoffTs).toBeLessThan(postCutoffTs);

      // Verify the cutoff timestamp is 110 minutes after selected publish time
      expect((cutoffTs - selectedTs) / 60000).toBe(110);
      // Verify first post-cutoff is 10 minutes after decision cutoff
      expect((postCutoffTs - cutoffTs) / 60000).toBe(10);
    });

    it("handles zero actual_mw outturn without displaying missing dash", () => {
      render(
        <ForecastEvolutionChart
          evolution={{
            ...mockEvolutionResponse,
            actual_mw: 0,
          }}
        />
      );

      // Outturn legend badge should show (0 MW), not (—)
      expect(screen.getByText("Actual Outturn (0 MW)")).toBeInTheDocument();
      expect(screen.queryByText("Actual Outturn (—)")).not.toBeInTheDocument();
    });
  });
});
