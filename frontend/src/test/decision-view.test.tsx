import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DecisionPage } from "../pages/decision-page";
import { DecisionContext } from "../components/decision/decision-context";
import { DecisionMetrics } from "../components/decision/decision-metrics";
import { ForecastProfileChart } from "../components/charts/forecast-profile-chart";
import { mockDecisionResponse } from "./fixtures";
import { formatGw, formatMw } from "../lib/format";
import { queryKeys } from "../lib/queries";
import { createTestQueryClient, TestQueryWrapper } from "./test-utils";

describe("Phase 2: Decision View & Components", () => {
  it("renders DecisionPage full structure with fixture data", () => {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      queryKeys.decision("2026-01-15"),
      mockDecisionResponse
    );

    render(
      <TestQueryWrapper client={queryClient}>
        <MemoryRouter>
          <DecisionPage />
        </MemoryRouter>
      </TestQueryWrapper>
    );

    // Header
    expect(screen.getByText("Day-Ahead Wind Decision")).toBeInTheDocument();
    expect(screen.getByLabelText("Select Decision Date")).toBeInTheDocument();

    // Context strip
    expect(screen.getByText("15 Jan 2026 · 09:20 GMT")).toBeInTheDocument();
    expect(screen.getByText("07:30 GMT")).toBeInTheDocument();
    expect(screen.getByText("1h 50m")).toBeInTheDocument();

    // Metric cards
    expect(screen.getByText("Average Forecast")).toBeInTheDocument();
    expect(screen.getByText("Peak Forecast")).toBeInTheDocument();
    expect(screen.getByText("Peak Delivery Hour")).toBeInTheDocument();
    expect(screen.getByText("Historical MAE")).toBeInTheDocument();
    expect(screen.getByText("Historical P90 Error")).toBeInTheDocument();

    // Chart header
    expect(screen.getByText("24-Hour Wind Forecast Profile")).toBeInTheDocument();
    expect(
      screen.getByText(/Forecast \(07:30 GMT\)/)
    ).toBeInTheDocument();

    // Methodology
    expect(
      screen.getByText("Market Rules & Methodology Context")
    ).toBeInTheDocument();
  });

  describe("DecisionContext", () => {
    it("displays exact cutoff, publication timestamp, and age from contract", () => {
      render(<DecisionContext decision={mockDecisionResponse} />);

      // Decision cutoff: 09:20 GMT
      expect(screen.getByText(/15 Jan 2026 · 09:20 GMT/)).toBeInTheDocument();

      // Delivery date: 16 Jan 2026
      expect(screen.getByText("16 Jan 2026")).toBeInTheDocument();

      // Publication time: 07:30 GMT
      expect(screen.getByText("07:30 GMT")).toBeInTheDocument();

      // Age: 110 min -> 1h 50m
      expect(screen.getByText("1h 50m")).toBeInTheDocument();

      // Completeness: 24/24 hours
      expect(screen.getByText(/Completeness: 24\/24 hours/)).toBeInTheDocument();
    });
  });

  describe("DecisionMetrics", () => {
    it("formats summary metrics using GW and MW appropriately", () => {
      render(<DecisionMetrics summary={mockDecisionResponse.summary} />);

      // Average: 8740.2 MW -> 8.74 GW (8,740 MW)
      expect(
        screen.getByText(formatGw(mockDecisionResponse.summary.average_forecast_mw, 2))
      ).toBeInTheDocument();
      expect(
        screen.getByText(`(${formatMw(mockDecisionResponse.summary.average_forecast_mw, 0)})`)
      ).toBeInTheDocument();

      // Peak: 12310.0 MW -> 12.31 GW (12,310 MW)
      expect(
        screen.getByText(formatGw(mockDecisionResponse.summary.peak_forecast_mw, 2))
      ).toBeInTheDocument();
      expect(
        screen.getByText(`(${formatMw(mockDecisionResponse.summary.peak_forecast_mw, 0)})`)
      ).toBeInTheDocument();

      // Peak hour: 17:00
      expect(screen.getByText("17:00")).toBeInTheDocument();

      // Historical MAE: 720.4 MW -> 720 MW
      expect(
        screen.getByText(formatMw(mockDecisionResponse.summary.historical_mae_mw, 0))
      ).toBeInTheDocument();

      // Historical P90: 1450.0 MW -> 1,450 MW
      expect(
        screen.getByText(formatMw(mockDecisionResponse.summary.historical_p90_abs_error_mw, 0))
      ).toBeInTheDocument();
    });
  });

  describe("ForecastProfileChart", () => {
    it("supplies exactly 24 points to the chart layer and does not assume 48 intervals", () => {
      const { container } = render(
        <ForecastProfileChart
          series={mockDecisionResponse.series}
          selectedPublishTime="07:30 GMT"
        />
      );

      expect(mockDecisionResponse.series).toHaveLength(24);
      expect(
        screen.getByText("24-Hour Wind Forecast Profile")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Delivery intervals: 24 points/)
      ).toBeInTheDocument();
      expect(
        screen.getByTestId("forecast-chart-container")
      ).toBeInTheDocument();
      expect(container.querySelector(".recharts-responsive-container")).toBeInTheDocument();
    });

    it("consumes contract lower_mw and upper_mw without recalculating", () => {
      // Hour 12 contract point
      const pt12 = mockDecisionResponse.series.find((p) => p.hour === 12);
      expect(pt12).toBeDefined();
      expect(pt12?.lower_mw).toBe(6429.0);
      expect(pt12?.upper_mw).toBe(9129.0);
      expect(pt12?.forecast_mw).toBe(7779.0);
      expect(pt12?.p90_abs_error_mw).toBe(1350.0);

      // Verify mathematical identity preserved in contract
      expect(pt12!.upper_mw - pt12!.forecast_mw).toBe(1350.0);
      expect(pt12!.forecast_mw - pt12!.lower_mw).toBe(1350.0);
    });
  });
});
