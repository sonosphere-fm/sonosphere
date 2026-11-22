import { useState } from "react";
import { date, num } from "../lib";
import type { TrendPoint } from "../../shared/catalog";

export function BarChart({ data, height = 160, unit = "scrobbles", every = 1 }: { data: { label: string; value: number; tip?: string }[]; height?: number; unit?: string; every?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <figure className="mb-2 relative" onMouseLeave={() => setHover(null)}>
      <div className="text-[11px] text-muted border-b border-dashed border-line text-right leading-[1.5]">{num(max)}</div>
      <div className="flex items-stretch gap-0.5 border-b border-edge" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className={"flex-1 min-w-0 flex items-end relative outline-offset-0" + (hover === i ? " bg-panel" : "")}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            aria-label={`${d.tip || d.label}: ${num(d.value)} ${unit}`}
          >
            <div className="w-full bg-accent rounded-t-[2px] min-h-px" style={{ height: `${(d.value / max) * 100}%`, ...(hover === i ? { background: "var(--accent-dark)" } : {}) }} />
            {hover === i && <div className={"absolute bottom-[calc(100%+4px)] bg-ink text-bg px-[9px] py-[5px] text-[13px] leading-[1.3] whitespace-nowrap z-5 pointer-events-none " + (i === 0 ? "left-0 translate-x-0" : i === data.length - 1 ? "left-auto right-0 translate-x-0" : "left-1/2 -translate-x-1/2")}><b className="not-italic">{num(d.value)}</b> {unit}<br /><span className="text-edge text-xs">{d.tip || d.label}</span></div>}
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 text-[11px] text-muted pt-[3px]">{data.map((d, i) => <span key={i} className="flex-1 min-w-0 text-center whitespace-nowrap overflow-visible">{i % every === 0 ? d.label : ""}</span>)}</div>
    </figure>
  );
}
export const weekTrend = (trend: TrendPoint[]) =>
  trend.map(t => ({
    label: date(t.start, { month: "short" }),
    value: t.count,
    tip: `Week of ${date(t.start, { day: "numeric", month: "short", year: "numeric" })}`,
  }));
