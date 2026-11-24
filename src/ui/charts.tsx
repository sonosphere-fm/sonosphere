import { useState } from "react";
import { t, tx } from "../i18n";
import { date, num } from "../lib";
import type { TrendPoint } from "../../shared/catalog";

const col = "flex-1 min-w-0 flex items-end relative outline-offset-0";
const bar = "w-full rounded-t-[2px] min-h-px";
const axisLabel = "flex-1 min-w-0 text-center whitespace-nowrap overflow-visible";
const tooltip =
  "absolute bottom-[calc(100%+4px)] bg-site-ink text-site-bg px-[9px] py-[5px] text-[13px] leading-[1.3] " +
  "whitespace-nowrap z-5 pointer-events-none";
const tooltipPlace = (i: number, count: number) => {
  if (i === count - 1) return "right-0";
  if (i === 0) return "left-0";
  return "left-1/2 -translate-x-1/2";
};

export function BarChart({
  data,
  height = 160,
  unit = t("music.scrobblesUnit"),
  every = 1,
}: {
  data: { label: string; value: number; tip?: string }[];
  height?: number;
  unit?: string;
  every?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure dir="ltr" className="m-0 mb-2 relative" onMouseLeave={() => setHover(null)}>
      <div className="text-[11px] text-site-muted [border-bottom:1px_dashed_var(--line)] text-right leading-[1.5]">
        {num(max)}
      </div>
      <div className="flex items-stretch gap-0.5 border-b border-b-(--edge)" style={{ height }}>
        {data.map((d, i) => (
          <div
            key={i}
            className={`${col} ${hover === i ? "bg-site-panel" : ""}`}
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            aria-label={t("music.barValue", { label: d.tip || d.label, value: num(d.value), unit })}
          >
            <div
              className={`${bar} ${hover === i ? "bg-site-accent-dark" : "bg-site-accent"}`}
              style={{ height: `${(d.value / max) * 100}%` }}
            />
            {hover === i && (
              <div className={`${tooltip} ${tooltipPlace(i, data.length)}`}>
                {tx("music.barTooltip", { value: <b>{num(d.value)}</b>, unit })}
                <br />
                <span className="text-(--edge) text-[12px]">{d.tip || d.label}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-0.5 text-[11px] text-site-muted pt-[3px]">
        {data.map((d, i) => (
          <span key={i} className={axisLabel}>
            {i % every === 0 ? d.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
export const weekTrend = (trend: TrendPoint[]) =>
  trend.map((point) => ({
    label: date(point.start, { month: "short" }),
    value: point.count,
    tip: t("music.weekOf", { date: date(point.start, { day: "numeric", month: "short", year: "numeric" }) }),
  }));
