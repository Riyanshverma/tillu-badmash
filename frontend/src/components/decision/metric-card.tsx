interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  description: string;
  accent?: "default" | "blue" | "teal";
}

export function MetricCard({
  label,
  value,
  subValue,
  description,
  accent = "default",
}: MetricCardProps) {
  return (
    <div className="bg-white border border-slate-200 rounded-[10px] p-4 flex flex-col justify-between shadow-[0_1px_2px_rgba(15,23,42,0.03)] hover:border-slate-300 transition-colors">
      <div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {label}
        </span>
        <div className="mt-1 flex items-baseline gap-2">
          <span
            className={`text-[26px] font-[650] tracking-[-0.02em] leading-tight ${
              accent === "blue"
                ? "text-blue-600"
                : accent === "teal"
                ? "text-teal-700"
                : "text-slate-900"
            }`}
          >
            {value}
          </span>
          {subValue && (
            <span className="text-xs text-slate-400 font-normal">
              ({subValue})
            </span>
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500 leading-normal border-t border-slate-100 pt-2">
        {description}
      </p>
    </div>
  );
}
