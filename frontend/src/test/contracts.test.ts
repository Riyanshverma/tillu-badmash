import { describe, expect, it } from "vitest";
import {
  AccuracyResponseSchema,
  ComparisonResponseSchema,
  DecisionResponseSchema,
  ForecastEvolutionResponseSchema,
  HealthResponseSchema,
} from "../contracts";
import {
  mockAccuracyResponse,
  mockComparisonResponse,
  mockDecisionResponse,
  mockEvolutionResponse,
} from "./fixtures";

describe("Frontend Public Contracts & Typed Fixtures (Phase 0)", () => {
  describe("Health Contract", () => {
    it("parses valid health response", () => {
      const parsed = HealthResponseSchema.parse({ status: "ok" });
      expect(parsed.status).toBe("ok");
    });

    it("rejects invalid status", () => {
      expect(() => HealthResponseSchema.parse({ status: "degraded" })).toThrow();
    });
  });

  describe("Decision Contract & Fixture", () => {
    it("parses valid decision fixture", () => {
      const parsed = DecisionResponseSchema.parse(mockDecisionResponse);
      expect(parsed.decision_date).toBe("2026-01-15");
      expect(parsed.delivery_date).toBe("2026-01-16");
      expect(parsed.decision_cutoff).toBe("2026-01-15T09:20:00Z");
      expect(parsed.selected_forecast_publish_time).toBe("2026-01-15T07:30:00Z");
      expect(parsed.forecast_age_minutes).toBe(110);
      expect(parsed.completeness.expected_hours).toBe(24);
      expect(parsed.completeness.forecast_hours).toBe(24);
      expect(parsed.completeness.missing_hours).toBe(0);
    });

    it("ensures decision series has exactly 24 hourly points", () => {
      expect(mockDecisionResponse.series).toHaveLength(24);
      mockDecisionResponse.series.forEach((pt, index) => {
        expect(pt.hour).toBe(index);
        expect(pt.forecast_mw).toBeGreaterThanOrEqual(0);
        expect(pt.lower_mw).toBeLessThanOrEqual(pt.forecast_mw);
        expect(pt.upper_mw).toBeGreaterThanOrEqual(pt.forecast_mw);
      });
    });

    it("rejects invalid decision series (e.g. negative generation or out of range hour)", () => {
      const invalid = {
        ...mockDecisionResponse,
        series: [
          {
            ...mockDecisionResponse.series[0],
            forecast_mw: -100, // Negative power not allowed
          },
        ],
      };
      expect(() => DecisionResponseSchema.parse(invalid)).toThrow();
    });

    it("rejects malformed dates or cutoff timestamps", () => {
      const invalidDate = {
        ...mockDecisionResponse,
        decision_date: "15-01-2026", // Invalid format
      };
      expect(() => DecisionResponseSchema.parse(invalidDate)).toThrow();

      const invalidCutoff = {
        ...mockDecisionResponse,
        decision_cutoff: "not-a-timestamp",
      };
      expect(() => DecisionResponseSchema.parse(invalidCutoff)).toThrow();
    });
  });

  describe("Comparison Contract & Fixture", () => {
    it("parses valid comparison fixture", () => {
      const parsed = ComparisonResponseSchema.parse(mockComparisonResponse);
      expect(parsed.decision_date).toBe("2026-01-15");
      expect(parsed.delivery_date).toBe("2026-01-16");
      expect(parsed.metrics.matched_points).toBe(24);
      expect(parsed.completeness.matched_hours).toBe(24);
    });

    it("ensures comparison series has exactly 24 hourly points and respects error sign", () => {
      expect(mockComparisonResponse.series).toHaveLength(24);
      mockComparisonResponse.series.forEach((pt, index) => {
        expect(pt.hour).toBe(index);
        // Error definition: error_mw = forecast_mw - actual_mw
        const expectedError = Math.round((pt.forecast_mw - pt.actual_mw) * 10) / 10;
        expect(pt.error_mw).toBeCloseTo(expectedError, 1);
        expect(pt.absolute_error_mw).toBeCloseTo(Math.abs(expectedError), 1);
      });
    });

    it("verifies hour 12 empirical anchor", () => {
      const hour12 = mockComparisonResponse.series.find((pt) => pt.hour === 12);
      expect(hour12).toBeDefined();
      expect(hour12?.forecast_mw).toBe(7779.0);
      expect(hour12?.actual_mw).toBe(8781.0);
      expect(hour12?.error_mw).toBe(-1002.0); // Under-forecast
    });

    it("rejects comparison with missing actual_mw or invalid hour", () => {
      const invalid = {
        ...mockComparisonResponse,
        series: [
          {
            start_time: "2026-01-16T00:00:00Z",
            hour: 25, // Invalid hour
            forecast_mw: 8000,
            actual_mw: 8500,
            error_mw: -500,
            absolute_error_mw: 500,
          },
        ],
      };
      expect(() => ComparisonResponseSchema.parse(invalid)).toThrow();
    });
  });

  describe("Accuracy Contract & Fixture", () => {
    it("parses valid accuracy fixture", () => {
      const parsed = AccuracyResponseSchema.parse(mockAccuracyResponse);
      expect(parsed.period.decision_date_from).toBe("2026-01-01");
      expect(parsed.period.decision_date_to).toBe("2026-01-31");
      expect(parsed.metrics.matched_points).toBe(744);
    });

    it("contains exactly 744 heatmap points (31 days × 24 delivery hours)", () => {
      expect(mockAccuracyResponse.heatmap).toHaveLength(744);
    });

    it("verifies January 31 decision maps to February 1 delivery in heatmap", () => {
      const jan31Points = mockAccuracyResponse.heatmap.filter(
        (pt) => pt.decision_date === "2026-01-31"
      );
      expect(jan31Points).toHaveLength(24);
      jan31Points.forEach((pt) => {
        expect(pt.delivery_date).toBe("2026-02-01");
        expect(pt.start_time.startsWith("2026-02-01")).toBe(true);
      });
    });

    it("contains 24 hourly error distribution points", () => {
      expect(mockAccuracyResponse.hour_of_day_error).toHaveLength(24);
      mockAccuracyResponse.hour_of_day_error.forEach((h, index) => {
        expect(h.hour).toBe(index);
        expect(h.mae_mw).toBeGreaterThanOrEqual(0);
        expect(h.p90_abs_error_mw).toBeGreaterThanOrEqual(0);
      });
    });

    it("rejects invalid percentages in metrics (e.g. > 100%)", () => {
      const invalid = {
        ...mockAccuracyResponse,
        metrics: {
          ...mockAccuracyResponse.metrics,
          over_forecast_percent: 150, // Out of bounds
        },
      };
      expect(() => AccuracyResponseSchema.parse(invalid)).toThrow();
    });
  });

  describe("Forecast Evolution Contract & Fixture", () => {
    it("parses valid evolution fixture", () => {
      const parsed = ForecastEvolutionResponseSchema.parse(mockEvolutionResponse);
      expect(parsed.target_time).toBe("2026-01-16T12:00:00Z");
      expect(parsed.hour).toBe(12);
      expect(parsed.selected_publish_time).toBe("2026-01-15T07:30:00Z");
    });

    it("verifies 07:30Z is marked as selected decision vintage", () => {
      const selected = mockEvolutionResponse.series.find(
        (v) => v.publish_time === "2026-01-15T07:30:00Z"
      );
      expect(selected).toBeDefined();
      expect(selected?.is_available_at_decision).toBe(true);
      expect(selected?.is_selected_at_decision).toBe(true);
      expect(selected?.forecast_mw).toBe(7779.0);
    });

    it("verifies 09:30Z is marked post-cutoff and not available at decision", () => {
      const postCutoff = mockEvolutionResponse.series.find(
        (v) => v.publish_time === "2026-01-15T09:30:00Z"
      );
      expect(postCutoff).toBeDefined();
      expect(postCutoff?.is_available_at_decision).toBe(false);
      expect(postCutoff?.is_selected_at_decision).toBe(false);
    });

    it("rejects evolution point with missing boolean flags or negative forecast", () => {
      const invalid = {
        ...mockEvolutionResponse,
        series: [
          {
            publish_time: "2026-01-15T02:30:00Z",
            forecast_mw: -50, // Invalid
            is_available_at_decision: true,
            is_selected_at_decision: false,
          },
        ],
      };
      expect(() => ForecastEvolutionResponseSchema.parse(invalid)).toThrow();
    });
  });
});
