import { describe, expect, it } from "vitest";
import {
  formatMw,
  formatGw,
  formatSignedErrorMw,
  formatPercent,
} from "../lib/format";
import {
  formatLondonDateTime,
  formatLondonDate,
  formatLondonTime,
  formatLondonShortDateTime,
  formatHourLabel,
  formatForecastAge,
} from "../lib/dates";

describe("Formatting & Presentation Utilities (Phase 5 Quality)", () => {
  describe("Power Formatting (MW and GW)", () => {
    it("formats power in MW with thousand separators", () => {
      expect(formatMw(7779)).toBe("7,779 MW");
      expect(formatMw(0)).toBe("0 MW");
      expect(formatMw(12857.4, 1)).toBe("12,857.4 MW");
    });

    it("formats power in GW correctly (mw / 1000)", () => {
      expect(formatGw(7779)).toBe("7.78 GW");
      expect(formatGw(0)).toBe("0.00 GW");
      expect(formatGw(12857, 1)).toBe("12.9 GW");
    });

    it("handles non-finite power gracefully", () => {
      expect(formatMw(NaN)).toBe("—");
      expect(formatMw(Infinity)).toBe("—");
      expect(formatGw(NaN)).toBe("—");
      expect(formatGw(Infinity)).toBe("—");
    });
  });

  describe("Signed Error Formatting", () => {
    it("formats positive error (over-forecast) with explicit + sign", () => {
      expect(formatSignedErrorMw(340)).toBe("+340 MW");
      expect(formatSignedErrorMw(120.5, 1)).toBe("+120.5 MW");
    });

    it("formats negative error (under-forecast) with explicit - sign", () => {
      expect(formatSignedErrorMw(-987.5, 1)).toBe("-987.5 MW");
      expect(formatSignedErrorMw(-1002)).toBe("-1,002 MW");
    });

    it("formats zero error without sign", () => {
      expect(formatSignedErrorMw(0)).toBe("0 MW");
    });

    it("handles non-finite values gracefully", () => {
      expect(formatSignedErrorMw(NaN)).toBe("—");
      expect(formatSignedErrorMw(-Infinity)).toBe("—");
    });
  });

  describe("Percentage Formatting", () => {
    it("formats percentages with 1 decimal by default", () => {
      expect(formatPercent(11.2)).toBe("11.2%");
      expect(formatPercent(84.95, 2)).toBe("84.95%");
    });

    it("handles unbounded WAPE percentage exceeding 100%", () => {
      expect(formatPercent(142.8)).toBe("142.8%");
    });

    it("returns '—' for null, undefined, and non-finite percentage", () => {
      expect(formatPercent(null)).toBe("—");
      expect(formatPercent(undefined)).toBe("—");
      expect(formatPercent(NaN)).toBe("—");
      expect(formatPercent(Infinity)).toBe("—");
    });
  });

  describe("Europe/London Date & Time Formatting", () => {
    it("formats ISO datetime explicitly in Europe/London", () => {
      // 09:20 UTC in January is 09:20 GMT
      const formatted = formatLondonDateTime("2026-01-15T09:20:00Z");
      expect(formatted).toBe("15 Jan 2026, 09:20 GMT");
    });

    it("formats ISO date explicitly in Europe/London", () => {
      expect(formatLondonDate("2026-01-15T00:00:00Z")).toBe("15 Jan 2026");
      expect(formatLondonDate("2026-01-31T00:00:00Z")).toBe("31 Jan 2026");
      expect(formatLondonDate("2026-02-01T00:00:00Z")).toBe("1 Feb 2026");
    });

    it("formats ISO time explicitly in Europe/London", () => {
      expect(formatLondonTime("2026-01-15T07:30:00Z")).toBe("07:30 GMT");
      expect(formatLondonTime("2026-01-15T09:20:00Z")).toBe("09:20 GMT");
    });

    it("formats ISO datetime or timestamp to short London datetime (day, month, time)", () => {
      expect(formatLondonShortDateTime("2026-01-15T07:30:00Z")).toBe("15 Jan, 07:30");
      expect(formatLondonShortDateTime("2026-01-15T09:20:00Z")).toBe("15 Jan, 09:20");
      const epochMs = new Date("2026-01-15T07:30:00Z").getTime();
      expect(formatLondonShortDateTime(epochMs)).toBe("15 Jan, 07:30");
    });

    it("formats delivery hour label 0..23", () => {
      expect(formatHourLabel(0)).toBe("00:00");
      expect(formatHourLabel(12)).toBe("12:00");
      expect(formatHourLabel(23)).toBe("23:00");
    });

    it("formats forecast age in minutes", () => {
      expect(formatForecastAge(0)).toBe("0m");
      expect(formatForecastAge(50)).toBe("50m");
      expect(formatForecastAge(110)).toBe("1h 50m");
      expect(formatForecastAge(180)).toBe("3h 0m");
      expect(formatForecastAge(-5)).toBe("0m");
    });

    it("handles invalid date strings gracefully", () => {
      expect(formatLondonDateTime("not-a-date")).toBe("Invalid date");
      expect(formatLondonDate("not-a-date")).toBe("Invalid date");
      expect(formatLondonTime("not-a-date")).toBe("Invalid time");
    });
  });
});
