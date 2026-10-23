import { useState } from "react";
import type { AccuracyHeatmapPoint } from "../../contracts";
import { formatMw, formatSignedErrorMw } from "../../lib/format";
import { formatHourLabel, formatLondonDate } from "../../lib/dates";

interface ErrorHeatmapProps {
  heatmapData: AccuracyHeatmapPoint[];
  onSelectPoint?: (point: AccuracyHeatmapPoint) => void;
}

function getHeatmapCellColor(errorMw: number): {
  bg: string;
  text: string;
  border: string;
} {
  // Near zero band (-200 to +200 MW)
  if (errorMw >= -200 && errorMw <= 200) {
    return { bg: "bg-[#F1F5F9]", text: "text-slate-700", border: "border-slate-200" };
  }

  // Positive error = Over-forecast (Red scale)
  if (errorMw > 200) {
    if (errorMw <= 750) {
      return { bg: "bg-[#FEE2E2]", text: "text-red-900", border: "border-red-200" };
    }
    if (errorMw <= 1500) {
      return { bg: "bg-[#F87171]", text: "text-white", border: "border-red-400" };
    }
    return { bg: "bg-[#DC2626]", text: "text-white", border: "border-red-700" };
  }

  // Negative error = Under-forecast (Teal scale)
  if (errorMw >= -750) {
    return { bg: "bg-[#CCFBF1]", text: "text-teal-900", border: "border-teal-200" };
  }
  if (errorMw >= -1500) {
    return { bg: "bg-[#2DD4BF]", text: "text-teal-950", border: "border-teal-400" };
  }
  return { bg: "bg-[#0F766E]", text: "text-white", border: "border-teal-700" };
}

export function ErrorHeatmap({ heatmapData, onSelectPoint }: ErrorHeatmapProps) {
  // Group by decision date (31 days)
  const days: { date: string; points: AccuracyHeatmapPoint[] }[] = [];
  const grouped = new Map<string, AccuracyHeatmapPoint[]>();

  for (const pt of heatmapData) {
    if (!grouped.has(pt.decision_date)) {
      grouped.set(pt.decision_date, []);
    }
    grouped.get(pt.decision_date)!.push(pt);
  }

  // Sort dates ascending
  const sortedDates = Array.from(grouped.keys()).sort();
  for (const date of sortedDates) {
    const points = grouped.get(date)!.sort((a, b) => a.hour - b.hour);
    days.push({ date, points });
  }

  // Selected cell for interactive detail inspection
  const [selectedPoint, setSelectedPoint] = useState<AccuracyHeatmapPoint | null>(
    // Default to the 2026-01-15 hour 12 verified anchor
    heatmapData.find((p) => p.decision_date === "2026-01-15" && p.hour === 12) ||
      heatmapData[0] ||
      null
  );

  const handleSelect = (pt: AccuracyHeatmapPoint) => {
    setSelectedPoint(pt);
    if (onSelectPoint) onSelectPoint(pt);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-[-0.01em]">
            January Forecast Error Heatmap
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            31 decision dates × 24 delivery hours (744 total intervals). Click or focus any cell to inspect details.
          </p>
        </div>

        {/* Heatmap Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#0F766E] border border-teal-700" />
            <span className="text-slate-600 font-medium">Under (&lt; -750 MW)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#CCFBF1] border border-teal-200" />
            <span className="text-slate-600 font-medium">Mild Under</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#F1F5F9] border border-slate-200" />
            <span className="text-slate-600 font-medium">±200 MW</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#FEE2E2] border border-red-200" />
            <span className="text-slate-600 font-medium">Mild Over</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded-xs bg-[#DC2626] border border-red-700" />
            <span className="text-slate-600 font-medium">Over (&gt; +750 MW)</span>
          </div>
        </div>
      </div>

      {/* Heatmap Scrollable Table Container */}
      <div className="overflow-x-auto pt-4 pb-2 -mx-1 px-1">
        <div className="min-w-[820px]">
          {/* Hour Columns Header */}
          <div className="grid grid-cols-[72px_repeat(24,1fr)] gap-1 mb-1 items-center">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider pl-1">
              Date
            </div>
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={`hdr-${h}`}
                className="text-[10px] font-medium text-slate-400 text-center"
              >
                {h % 3 === 0 ? h.toString().padStart(2, "0") : ""}
              </div>
            ))}
          </div>

          {/* Grid Rows: 31 Days */}
          <div className="space-y-1">
            {days.map(({ date, points }) => {
              const dayNum = date.split("-")[2];
              return (
                <div
                  key={date}
                  className="grid grid-cols-[72px_repeat(24,1fr)] gap-1 items-center"
                >
                  <div className="text-[11px] font-mono text-slate-500 whitespace-nowrap pl-1">
                    {dayNum} Jan
                  </div>

                  {points.map((pt) => {
                    const style = getHeatmapCellColor(pt.error_mw);
                    const isSelected =
                      selectedPoint?.decision_date === pt.decision_date &&
                      selectedPoint?.hour === pt.hour;
                    const errorAbs = Math.abs(pt.error_mw);
                    const dir =
                      pt.error_mw > 0
                        ? "over-forecast"
                        : pt.error_mw < 0
                        ? "under-forecast"
                        : "zero error";
                    const label = `${formatLondonDate(
                      `${pt.decision_date}T00:00:00Z`
                    )}, delivery ${formatHourLabel(
                      pt.hour
                    )}, ${dir} by ${errorAbs} MW`;

                    return (
                      <button
                        key={`${pt.decision_date}-${pt.hour}`}
                        type="button"
                        aria-label={label}
                        title={label}
                        onClick={() => handleSelect(pt)}
                        onFocus={() => handleSelect(pt)}
                        className={`h-5 w-full rounded-xs transition-all border ${style.bg} ${
                          style.border
                        } ${
                          isSelected
                            ? "ring-2 ring-blue-600 ring-offset-1 z-10 scale-105"
                            : "hover:scale-115 hover:z-10 focus:ring-2 focus:ring-blue-600"
                        }`}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Cell Detail Panel */}
      {selectedPoint && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs bg-slate-50 p-3 rounded-[8px] border border-slate-200">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">Selected Interval:</span>
            <span className="text-slate-700">
              Decision {formatLondonDate(`${selectedPoint.decision_date}T00:00:00Z`)} →
              Delivery {formatLondonDate(`${selectedPoint.delivery_date}T00:00:00Z`)} at{" "}
              {formatHourLabel(selectedPoint.hour)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div>
              <span className="text-slate-500">Forecast: </span>
              <span className="font-semibold text-slate-800">
                {formatMw(selectedPoint.forecast_mw, 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Actual: </span>
              <span className="font-semibold text-slate-800">
                {formatMw(selectedPoint.actual_mw, 0)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Error: </span>
              <span
                className={`font-semibold ${
                  selectedPoint.error_mw > 0
                    ? "text-[#DC2626]"
                    : selectedPoint.error_mw < 0
                    ? "text-[#0F766E]"
                    : "text-slate-800"
                }`}
              >
                {formatSignedErrorMw(selectedPoint.error_mw, 0)} (
                {selectedPoint.error_mw > 0
                  ? "Over-forecast"
                  : selectedPoint.error_mw < 0
                  ? "Under-forecast"
                  : "Zero error"}
                )
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
