import { CalendarDays } from "lucide-react";

interface DecisionHeaderProps {
  selectedDate: string;
  onDateChange?: (date: string) => void;
}

export function DecisionHeader({ selectedDate }: DecisionHeaderProps) {
  // Generate January 2026 decision dates list (2026-01-01 to 2026-01-31)
  const janDays = Array.from({ length: 31 }, (_, i) => {
    const day = (i + 1).toString().padStart(2, "0");
    const date = `2026-01-${day}`;
    const nextDay = i + 1 === 31 ? "01 Feb" : `${(i + 2).toString().padStart(2, "0")} Jan`;
    return {
      date,
      label: `${day} Jan 2026 (Delivery: ${nextDay})`,
      isCurrentFixture: date === selectedDate,
    };
  });

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h1 className="text-[28px] font-[650] tracking-[-0.02em] text-slate-900 leading-tight">
          Day-Ahead Wind Decision
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Elexon forecast outturn reconstructed at 09:20 Europe/London gate closure for EPEX SPOT GB DAA 1.
        </p>
      </div>

      <div className="flex items-center gap-2 self-start sm:self-auto">
        <label
          htmlFor="decision-date-select"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap flex items-center gap-1.5"
        >
          <CalendarDays className="w-4 h-4 text-slate-500" />
          <span>Decision Date:</span>
        </label>
        <select
          id="decision-date-select"
          aria-label="Select Decision Date"
          value={selectedDate}
          disabled={false}
          className="h-9 px-3 py-1 bg-white border border-slate-200 rounded-[6px] text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent cursor-pointer shadow-sm"
          onChange={() => {
            // Static in Phase 2; full interactive data switching wired in Phase 4
          }}
        >
          {janDays.map((d) => (
            <option
              key={d.date}
              value={d.date}
              disabled={!d.isCurrentFixture}
            >
              {d.label} {d.isCurrentFixture ? "· Active Fixture" : "· (Phase 4)"}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
