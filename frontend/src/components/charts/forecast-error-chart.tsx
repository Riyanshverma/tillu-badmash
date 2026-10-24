import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparisonPoint } from "../../contracts";
import { formatMw, formatSignedErrorMw } from "../../lib/format";
import { formatHourLabel } from "../../lib/dates";

interface ForecastErrorChartProps {
  series: ComparisonPoint[];
  deliveryDate?: string;
}

interface ErrorRow {
  hour: number;
  hourLabel: string;
  error_mw: number;
  forecast_mw: number;
  actual_mw: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: ErrorRow;
  }>;
}

function ErrorTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const isOver = data.error_mw > 0;
  const isZero = data.error_mw === 0;

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] p-3 shadow-md text-xs space-y-1.5 min-w-[220px] pointer-events-none">
      <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
        <span>{data.hourLabel} delivery</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            isZero
              ? "bg-slate-100 text-slate-700"
              : isOver
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-teal-50 text-teal-700 border border-teal-200"
          }`}
        >
          {isZero ? "Zero error" : isOver ? "Over-forecast" : "Under-forecast"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-500">Forecast error:</span>
        <span
          className={`font-semibold text-sm ${
            isZero
              ? "text-slate-800"
              : isOver
              ? "text-[#DC2626]"
              : "text-[#0F766E]"
          }`}
        >
          {formatSignedErrorMw(data.error_mw, 0)}
        </span>
      </div>

      <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[11px] text-slate-500">
        <div>
          <span>Forecast:</span>
          <div className="font-medium text-slate-800">
            {formatMw(data.forecast_mw, 0)}
          </div>
        </div>
        <div>
          <span>Actual:</span>
          <div className="font-medium text-slate-800">
            {formatMw(data.actual_mw, 0)}
          </div>
        </div>
      </div>

      <div className="text-[10px] text-slate-400 leading-tight pt-1">
        {isOver
          ? `Wind was over-forecast by ${formatMw(Math.abs(data.error_mw), 0)} (thermal replacement risk)`
          : isZero
          ? "Forecast matched actual outturn exactly."
          : `Wind was under-forecast by ${formatMw(Math.abs(data.error_mw), 0)} (surplus wind available)`}
      </div>
    </div>
  );
}

export function ForecastErrorChart({
  series,
  deliveryDate = "16 Jan 2026",
}: ForecastErrorChartProps) {
  const chartData: ErrorRow[] = series.map((pt) => ({
    hour: pt.hour,
    hourLabel: formatHourLabel(pt.hour),
    error_mw: pt.error_mw,
    forecast_mw: pt.forecast_mw,
    actual_mw: pt.actual_mw,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-[-0.01em]">
            Signed Forecast Error Profile
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Delivery day {deliveryDate} · Signed difference around zero (forecast_mw - actual_mw)
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#DC2626] rounded-xs" />
            <span className="text-slate-700 font-medium">Over-forecast (&gt; 0 MW)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-[#0F766E] rounded-xs" />
            <span className="text-slate-700 font-medium">Under-forecast (&lt; 0 MW)</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[280px] pt-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
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
                `${mw > 0 ? "+" : ""}${formatMw(mw, 0)}`
              }
              tick={{ fill: "#64748B", fontSize: 12 }}
              stroke="#CBD5E1"
            />
            <Tooltip content={<ErrorTooltip />} />
            <ReferenceLine y={0} stroke="#94A3B8" strokeWidth={1.5} />

            <Bar dataKey="error_mw" isAnimationActive={false}>
              {chartData.map((entry) => (
                <Cell
                  key={`cell-${entry.hour}`}
                  fill={entry.error_mw >= 0 ? "#DC2626" : "#0F766E"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Delivery intervals: 24 points (00:00 – 23:00 UTC)</span>
        <span>Red = Over-forecast | Teal = Under-forecast</span>
      </div>
    </div>
  );
}
