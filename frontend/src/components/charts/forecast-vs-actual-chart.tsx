import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonPoint } from "../../contracts";
import { formatGw, formatMw, formatSignedErrorMw } from "../../lib/format";
import { formatHourLabel } from "../../lib/dates";

interface ForecastVsActualChartProps {
  series: ComparisonPoint[];
  deliveryDate?: string;
}

interface RowData {
  hour: number;
  hourLabel: string;
  forecast_mw: number;
  actual_mw: number;
  error_mw: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: RowData;
  }>;
}

function ComparisonTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const isOver = data.error_mw > 0;
  const isZero = data.error_mw === 0;

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
          <span className="w-2 h-2 rounded-full bg-slate-900 inline-block" />
          Actual:
        </span>
        <span className="font-semibold text-slate-900">
          {formatGw(data.actual_mw, 2)}{" "}
          <span className="text-[10px] text-slate-400 font-normal">
            ({formatMw(data.actual_mw, 0)})
          </span>
        </span>
      </div>

      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-slate-500">Error (Forecast - Actual):</span>
        <span
          className={`font-semibold ${
            isZero
              ? "text-slate-700"
              : isOver
              ? "text-[#DC2626]"
              : "text-[#0F766E]"
          }`}
        >
          {formatSignedErrorMw(data.error_mw, 0)}
        </span>
      </div>
      <div className="text-[10px] text-slate-400 text-right">
        {isZero ? "Exact match" : isOver ? "Over-forecast" : "Under-forecast"}
      </div>
    </div>
  );
}

export function ForecastVsActualChart({
  series,
  deliveryDate = "16 Jan 2026",
}: ForecastVsActualChartProps) {
  const chartData: RowData[] = series.map((pt) => ({
    hour: pt.hour,
    hourLabel: formatHourLabel(pt.hour),
    forecast_mw: pt.forecast_mw,
    actual_mw: pt.actual_mw,
    error_mw: pt.error_mw,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-[-0.01em]">
            Forecast vs Hourly Outturn
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Delivery day {deliveryDate} · 24 hourly decision-time forecasts (blue) vs derived FUELHH actuals (charcoal)
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-blue-600 rounded-full" />
            <span className="text-slate-700 font-medium">Decision Forecast</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-900 rounded-full" />
            <span className="text-slate-700 font-medium">Derived Actual</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[320px] pt-4" data-testid="forecast-vs-actual-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
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
            />
            <YAxis
              tickFormatter={(mw: number) =>
                `${(mw / 1000).toFixed(1)} GW`
              }
              tick={{ fill: "#64748B", fontSize: 12 }}
              stroke="#CBD5E1"
              domain={["auto", "auto"]}
            />
            <Tooltip content={<ComparisonTooltip />} />

            <Line
              type="monotone"
              dataKey="actual_mw"
              stroke="#0F172A"
              strokeWidth={2.5}
              dot={{ r: 2.5, fill: "#0F172A" }}
              activeDot={{
                r: 5,
                fill: "#0F172A",
                stroke: "#FFFFFF",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
              name="Derived Actual"
            />

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
              name="Decision Forecast"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Delivery intervals: 24 points (00:00 – 23:00 UTC)</span>
        <span>Hourly actual = (FUELHH at H:00 + FUELHH at H:30) / 2</span>
      </div>
    </div>
  );
}
