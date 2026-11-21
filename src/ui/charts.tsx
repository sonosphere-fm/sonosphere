import { useState } from "react";
import { date, num } from "../lib";
import type { TrendPoint } from "../../shared/catalog";

export function BarChart({ data, height = 160, unit = "scrobbles", every = 1 }: { data: { label: string; value: number; tip?: string }[]; height?: number; unit?: string; every?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map(d => d.value));
  return (
    <figure className="barchart" onMouseLeave={() => setHover(null)}>
      <div className="barchart-max">{num(max)}</div>
      <div className="barchart-plot" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className={"barchart-col" + (hover === i ? " on" : "")}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            aria-label={`${d.tip || d.label}: ${num(d.value)} ${unit}`}
          >
            <div className="barchart-bar" style={{ height: `${(d.value / max) * 100}%` }} />
            {hover === i && <div className="tooltip"><b>{num(d.value)}</b> {unit}<br /><span>{d.tip || d.label}</span></div>}
          </div>
        ))}
      </div>
      <div className="barchart-axis">{data.map((d, i) => <span key={i}>{i % every === 0 ? d.label : ""}</span>)}</div>
    </figure>
  );
}
export const weekTrend = (trend: TrendPoint[]) =>
  trend.map(t => ({
    label: date(t.start, { month: "short" }),
    value: t.count,
    tip: `Week of ${date(t.start, { day: "numeric", month: "short", year: "numeric" })}`,
  }));
