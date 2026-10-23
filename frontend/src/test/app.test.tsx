import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/app-shell";
import { DecisionPage } from "../pages/decision-page";
import { AccuracyPage } from "../pages/accuracy-page";
import { NotFoundPage } from "../pages/not-found-page";
import {
  formatForecastAge,
  formatHourLabel,
  formatLondonDate,
  formatLondonDateTime,
  formatLondonTime,
} from "../lib/dates";
import {
  formatGw,
  formatMw,
  formatPercent,
  formatSignedErrorMw,
} from "../lib/format";

describe("Phase 1: App Shell & Routing", () => {
  it("renders AppShell top navigation with title and links", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route index element={<DecisionPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Wind Decision Console")).toBeInTheDocument();
    expect(screen.getByText("Decision")).toBeInTheDocument();
    expect(screen.getByText("Accuracy")).toBeInTheDocument();
    expect(screen.getByText("Elexon data")).toBeInTheDocument();
    expect(
      screen.getByText("Day-Ahead Wind Decision")
    ).toBeInTheDocument();
  });

  it("renders AccuracyPage placeholder when navigating to /accuracy", () => {
    render(
      <MemoryRouter initialEntries={["/accuracy"]}>
        <Routes>
          <Route path="/" element={<AppShell />}>
            <Route path="accuracy" element={<AccuracyPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(
      screen.getByText("Forecast Accuracy & Uncertainty")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Systematic Bias")
    ).toBeInTheDocument();
  });

  it("renders NotFoundPage on unknown route", () => {
    render(
      <MemoryRouter initialEntries={["/some-random-route"]}>
        <Routes>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Page Not Found")).toBeInTheDocument();
    expect(screen.getByText("Back to Decision Console")).toBeInTheDocument();
  });
});

describe("Phase 1: Date & Time Helpers (Europe/London)", () => {
  it("formats Europe/London date-time accurately regardless of system locale", () => {
    const formatted = formatLondonDateTime("2026-01-15T09:20:00Z");
    expect(formatted).toBe("15 Jan 2026, 09:20 GMT");
  });

  it("formats Europe/London date and time separately", () => {
    expect(formatLondonDate("2026-01-15T07:30:00Z")).toBe("15 Jan 2026");
    expect(formatLondonTime("2026-01-15T07:30:00Z")).toBe("07:30 GMT");
  });

  it("formats hour label to 24h format", () => {
    expect(formatHourLabel(0)).toBe("00:00");
    expect(formatHourLabel(12)).toBe("12:00");
    expect(formatHourLabel(23)).toBe("23:00");
  });

  it("formats forecast age in minutes", () => {
    expect(formatForecastAge(110)).toBe("1h 50m");
    expect(formatForecastAge(45)).toBe("45m");
    expect(formatForecastAge(120)).toBe("2h 0m");
  });
});

describe("Phase 1: Numerical & Power Formatters", () => {
  it("formats power in MW and GW", () => {
    expect(formatMw(7779)).toBe("7,779 MW");
    expect(formatGw(7779)).toBe("7.78 GW");
  });

  it("formats signed error with explicit sign and MW unit", () => {
    expect(formatSignedErrorMw(-1002)).toBe("-1,002 MW");
    expect(formatSignedErrorMw(340)).toBe("+340 MW");
    expect(formatSignedErrorMw(0)).toBe("0 MW");
  });

  it("formats percentages accurately", () => {
    expect(formatPercent(8.7)).toBe("8.7%");
    expect(formatPercent(54.12, 1)).toBe("54.1%");
  });
});
