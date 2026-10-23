import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ForecastEvolutionResponse } from "../../contracts";
import { formatGw, formatMw } from "../../lib/format";
import { formatLondonDate, formatLondonTime } from "../../lib/dates";

interface ForecastEvolutionChartProps {
  evolution: ForecastEvolutionResponse;
}

interface EvolutionRow {
  publishTimeRaw: string;
  publishTimeLabel: string;
  forecast_mw: number;
  is_available: boolean;
  is_selected: boolean;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: EvolutionRow;
  }>;
}

function EvolutionTooltip({
  active,
  payload,
  actualMw,
}: CustomTooltipProps & { actualMw: number | null }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const diffToActual = actualMw !== null ? data.forecast_mw - actualMw : null;

  return (
    <div className="bg-white border border-slate-200 rounded-[8px] p-3 shadow-md text-xs space-y-1.5 min-w-[230px] pointer-events-none">
      <div className="font-semibold text-slate-800 border-b border-slate-100 pb-1 flex items-center justify-between">
        <span>Published {data.publishTimeLabel}</span>
        <span
          className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
            data.is_selected
              ? "bg-blue-100 text-blue-800 border border-blue-300"
              : data.is_available
              ? "bg-slate-100 text-slate-700"
              : "bg-amber-50 text-amber-800 border border-amber-200"
          }`}
        >
          {data.is_selected
            ? "Selected at Cutoff"
            : data.is_available
            ? "Pre-cutoff"
            : "Post-cutoff (Lookahead)"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-slate-500">Forecast vintage:</span>
        <span className="font-semibold text-blue-700">
          {formatGw(data.forecast_mw, 2)}{" "}
          <span className="text-[10px] text-slate-400 font-normal">
            ({formatMw(data.forecast_mw, 0)})
          </span>
        </span>
      </div>

      {actualMw !== null && diffToActual !== null && (
        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between">
          <span className="text-slate-500">Variance to Actual:</span>
          <span
            className={`font-medium ${
              diffToActual > 0
                ? "text-red-600"
                : diffToActual < 0
                ? "text-teal-700"
                : "text-slate-700"
            }`}
          >
            {diffToActual > 0 ? "+" : ""}
            {formatMw(diffToActual, 0)}
          </span>
        </div>
      )}

      <div className="text-[10px] text-slate-400 pt-1">
        {data.is_selected
          ? "This vintage was locked at the 09:20 auction cutoff."
          : data.is_available
          ? "Published prior to gate closure, but superseded by 07:30 vintage."
          : "Published after 09:20 cutoff; unavailable for auction bidding."}
      </div>
    </div>
  );
}

export function ForecastEvolutionChart({
  evolution,
}: ForecastEvolutionChartProps) {
  const chartData: EvolutionRow[] = evolution.series.map((v) => ({
    publishTimeRaw: v.publish_time,
    publishTimeLabel: formatLondonTime(v.publish_time),
    forecast_mw: v.forecast_mw,
    is_available: v.is_available_at_decision,
    is_selected: v.is_selected_at_decision,
  }));

  const targetDateStr = formatLondonDate(evolution.target_time);

  return (
    <div className="bg-white border border-slate-200 rounded-[12px] p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h2 className="text-base font-semibold text-slate-900 tracking-[-0.01em]">
            Forecast Evolution for Target Hour (12:00 GMT)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Target delivery: {targetDateStr} at 12:00 GMT · Progression of forecast vintages before and after 09:20 cutoff
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 ring-2 ring-emerald-500" />
            <span className="text-slate-700 font-semibold">
              Selected Vintage (07:30Z)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-slate-900 border border-dashed border-slate-900" />
            <span className="text-slate-700 font-medium">
              Actual Outturn ({evolution.actual_mw ? formatMw(evolution.actual_mw, 0) : "—"})
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-amber-500 border border-dashed border-amber-500" />
            <span className="text-slate-700 font-medium">09:20 Decision Cutoff</span>
          </div>
        </div>
      </div>

      <div className="w-full h-[300px] pt-4" data-testid="evolution-chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 16, right: 32, left: 12, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke="#E2E8F0"
            />
            <XAxis
              dataKey="publishTimeLabel"
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
            <Tooltip
              content={
                <EvolutionTooltip actualMw={evolution.actual_mw} />
              }
            />

            {/* Actual Outturn reference line */}
            {evolution.actual_mw !== null && (
              <ReferenceLine
                y={evolution.actual_mw}
                stroke="#0F172A"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                label={{
                  value: `Actual: ${formatGw(evolution.actual_mw, 2)}`,
                  fill: "#0F172A",
                  fontSize: 11,
                  position: "right",
                }}
              />
            )}

            {/* Cutoff Reference between 07:30 and 09:30 */}
            <ReferenceLine
              x="07:30 GMT"
              stroke="#D97706"
              strokeWidth={1.5}
              strokeDasharray="4 4"
              label={{
                value: "09:20 Cutoff (07:30 selected)",
                fill: "#B45309",
                fontSize: 11,
                position: "insideTopLeft",
              }}
            />

            <Line
              type="monotone"
              dataKey="forecast_mw"
              stroke="#2563EB"
              strokeWidth={2}
              dot={(props) => {
                const { cx, cy, payload } = props;
                if (!payload) return null;
                const isSel = payload.is_selected;
                const isAvail = payload.is_available;

                if (isSel) {
                  return (
                    <g key={`dot-${payload.publishTimeRaw}`}>
                      <circle
                        cx={cx}
                        cy={cy}
                        r={7}
                        fill="#2563EB"
                        stroke="#10B981"
                        strokeWidth={3}
                      />
                    </g>
                  );
                }
                return (
                  <circle
                    key={`dot-${payload.publishTimeRaw}`}
                    cx={cx}
                    cy={cy}
                    r={3.5}
                    fill={isAvail ? "#2563EB" : "#94A3B8"}
                    stroke="#FFFFFF"
                    strokeWidth={1}
                  />
                );
              }}
              activeDot={{
                r: 6,
                fill: "#2563EB",
                stroke: "#FFFFFF",
                strokeWidth: 2,
              }}
              isAnimationActive={false}
              name="Forecast Vintage"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>
          Selected: 07:30 GMT vintage ({formatMw(7779, 0)}) · Next vintage (09:30 GMT) is post-cutoff (+10m)
        </span>
        <span>Later vintages provided for retrospective volatility tracking only</span>
      </div>
    </div>
  );
}
