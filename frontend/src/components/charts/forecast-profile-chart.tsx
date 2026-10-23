import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DecisionSeriesPoint } from "../../contracts";
import { formatGw, formatMw } from "../../lib/format";
import { formatHourLabel } from "../../lib/dates";

interface ForecastProfileChartProps {
  series: DecisionSeriesPoint[];
  selectedPublishTime?: string;
}

interface ChartRow {
  hour: number;
  hourLabel: string;
  forecast_mw: number;
  lower_mw: number;
  upper_mw: number;
  p90_abs_error_mw: number;
  band_base: number;
  band_height: number;
}

interface ProfileTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ChartRow;
    value?: number;
    name?: string;
  }>;
}

function ProfileTooltip({ active, payload }: ProfileTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload as ChartRow;

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] p-3 shadow-md text-xs space-y-1.5 min-w-[210px] pointer-events-none">
      <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
        <span>{data.hourLabel} delivery</span>
        <span className="text-[10px] text-slate-400 font-normal">
          Interval {data.hour}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600 inline-block" />
          Forecast:
        </span>
        <span className="font-semibold text-blue-700">
          {formatGw(data.forecast_mw, 2)}{" "}
          <span className="text-[10px] text-slate-400 font-normal">
            ({formatMw(data.forecast_mw, 0)})
          </span>
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-slate-500 flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-sm bg-blue-200 border border-blue-400 inline-block" />
          P90 Range:
        </span>
        <span className="font-medium text-slate-800">
          {formatGw(data.lower_mw, 2)} – {formatGw(data.upper_mw, 2)}
        </span>
      </div>
      <div className="text-[11px] text-slate-500 flex items-center justify-between pt-1 border-t border-slate-100">
        <span>Historical P90 error:</span>
        <span className="font-medium">±{formatMw(data.p90_abs_error_mw, 0)}</span>
      </div>
    </div>
  );
}

export function ForecastProfileChart({
  series,
  selectedPublishTime,
}: ForecastProfileChartProps) {
  // Transform 24 points directly without recomputing P90 band
  const chartData: ChartRow[] = series.map((pt) => ({
    hour: pt.hour,
    hourLabel: formatHourLabel(pt.hour),
    forecast_mw: pt.forecast_mw,
    lower_mw: pt.lower_mw,
    upper_mw: pt.upper_mw,
    p90_abs_error_mw: pt.p90_abs_error_mw,
    band_base: pt.lower_mw,
    band_height: Math.max(0, pt.upper_mw - pt.lower_mw),
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-[-0.01em]">
            24-Hour Wind Forecast Profile
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Hourly expected wind generation for delivery day with empirical historical P90 error band
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 rounded-full" />
            <span className="text-slate-600 font-medium">
              Forecast {selectedPublishTime ? `(${selectedPublishTime})` : ""}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-[#93C5FD]/40 border border-[#93C5FD] rounded-xs" />
            <span className="text-slate-600 font-medium">
              Historical P90 error band
            </span>
          </div>
        </div>
      </div>

      <div className="w-full h-[380px] pt-4" data-testid="forecast-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 24, left: 12, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
            />
            <XAxis
              dataKey="hour"
              ticks={[0, 3, 6, 9, 12, 15, 18, 21]}
              tickFormatter={(hour: number) =>
                `${hour.toString().padStart(2, "0")}:00`
              }
              tick={{ fill: "#64748B", fontSize: 12 }}
              stroke="#CBD5E1"
              axisLine={{ stroke: "#CBD5E1" }}
              tickLine={{ stroke: "#CBD5E1" }}
            />
            <YAxis
              tickFormatter={(mw: number) =>
                `${(mw / 1000).toFixed(1)} GW`
              }
              tick={{ fill: "#64748B", fontSize: 12 }}
              stroke="#CBD5E1"
              axisLine={{ stroke: "#CBD5E1" }}
              tickLine={{ stroke: "#CBD5E1" }}
              domain={["auto", "auto"]}
            />
            <Tooltip content={<ProfileTooltip />} />

            {/* Stacked transparent baseline to lift the band */}
            <Area
              type="monotone"
              dataKey="band_base"
              stackId="p90_band"
              fill="none"
              stroke="none"
              isAnimationActive={false}
            />

            {/* Historical P90 error band */}
            <Area
              type="monotone"
              dataKey="band_height"
              stackId="p90_band"
              fill="#93C5FD"
              fillOpacity={0.35}
              stroke="#93C5FD"
              strokeDasharray="3 3"
              strokeOpacity={0.7}
              isAnimationActive={false}
              name="Historical P90 error band"
            />

            {/* Decision-time forecast line */}
            <Line
              type="monotone"
              dataKey="forecast_mw"
              stroke="#2563EB"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: "#2563EB" }}
              activeDot={{
                r: 5,
                fill: "#2563EB",
                stroke: "#FFFFFF",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
              name="Forecast"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Delivery intervals: 24 points (00:00 – 23:00 UTC)</span>
        <span>Y-axis displayed in GW · Data points in MW</span>
      </div>
    </div>
  );
}
