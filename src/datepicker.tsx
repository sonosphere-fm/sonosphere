// Values are local wall-clock strings, the same shape <input type="date"> and "datetime-local" use:
// "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm".
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Ico } from "./icons";
import { cn } from "./ui/tw";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toLocal = (d: Date, time = true) => ymd(d) + (time ? `T${pad(d.getHours())}:${pad(d.getMinutes())}` : "");
const parse = (v?: string | null) => {
  const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(v || "");
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
};
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0);
  return new Date(last.getFullYear(), last.getMonth(), Math.min(d.getDate(), last.getDate()));
};
const same = (a: Date | null, b: Date | null) => !!a && !!b && ymd(a) === ymd(b);

// getWeekInfo() is the new name of the weekInfo getter; neither is in TypeScript's lib yet.
type WeekInfo = { firstDay: number };
type LocaleWithWeek = Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };
const FIRST = (() => {
  try {
    const l: LocaleWithWeek = new Intl.Locale(navigator.language);
    return ((l.getWeekInfo?.() ?? l.weekInfo)?.firstDay ?? 1) % 7;
  } catch {
    return 1;
  }
})();
const H12 = (() => {
  try {
    return !!new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;
  } catch {
    return false;
  }
})();

type Bound = string | "now" | undefined;
const bound = (b: Bound) => (b === "now" ? new Date() : parse(b));

type NumProps = { value: number; min: number; max: number; onChange: (n: number) => void; label: string; onEnter: () => void };

/** Two-digit number box: type it, or step with the arrow keys (it wraps round). */
function Num({ value, min, max, onChange, label, onEnter }: NumProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const step = (n: number) => {
    const span = max - min + 1;
    setDraft(null);
    onChange((((value - min + n) % span) + span) % span + min);
  };
  const type = (raw: string) => {
    const t = raw.replace(/\D/g, "").slice(-2);
    setDraft(t);
    if (t && +t >= min && +t <= max) onChange(+t);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
    }
  };
  return (
    <input
      className="w-[46px] h-[38px] p-0 text-center [font-family:inherit] text-[17px] tabular-nums border border-edge rounded-none bg-card max-sm:h-11"
      inputMode="numeric"
      aria-label={label}
      value={draft ?? pad(value)}
      onFocus={e => e.target.select()}
      onBlur={() => setDraft(null)}
      onChange={e => type(e.target.value)}
      onKeyDown={onKeyDown}
    />
  );
}

type DatePickerProps = {
  value: string;
  onChange: (v: string) => void;
  label: string;
  time?: boolean;
  min?: Bound;
  max?: Bound;
  placeholder?: string;
  /** Shortcuts shown beside the calendar. */
  presets?: [string, () => Date][];
  compact?: boolean;
  /** "HH:mm" used when a day is picked before any time; defaults to the current time. */
  defaultTime?: string;
};

export function DatePicker({ value, onChange, label, time, min, max, placeholder, presets, compact, defaultTime = "" }: DatePickerProps) {
  const sel = parse(value);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"days" | "months">("days");
  const [at, setAt] = useState<{ left: number; top: number; up: boolean } | null>(null);
  // keyboard cursor; the month on show is the cursor's month
  const [cur, setCur] = useState(() => day0(sel || new Date()));
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const moveFocus = useRef(false);

  const lo = bound(min);
  const hi = bound(max);
  const off = (d: Date) => (!!lo && day0(d) < day0(lo)) || (!!hi && day0(d) > day0(hi));
  const clampDay = (d: Date) => {
    if (lo && day0(d) < day0(lo)) return day0(lo);
    if (hi && day0(d) > day0(hi)) return day0(hi);
    return d;
  };
  const clamp = (d: Date) => {
    if (!time) return clampDay(d);
    if (lo && d < lo) return lo;
    if (hi && d > hi) return hi;
    return d;
  };
  const commit = (d: Date) => {
    const c = clamp(d);
    setCur(day0(c));
    onChange(toLocal(c, !!time));
  };
  const baseTime = () => {
    if (sel) return [sel.getHours(), sel.getMinutes()];
    const t = /^(\d\d):(\d\d)$/.exec(defaultTime);
    if (t) return [+t[1], +t[2]];
    const n = new Date();
    return [n.getHours(), n.getMinutes()];
  };

  // The calendar is portalled to <body> and placed in page coordinates so it scrolls with its field.
  const show = () => {
    const r = trigger.current!.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 440 && r.top > 520;
    const w = presets ? 452 : 316;
    if (window.innerWidth > 480) {
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + window.scrollX;
      const top = (up ? r.top - 6 : r.bottom + 6) + window.scrollY;
      setAt({ left, top, up });
    } else {
      setAt(null);
    }
    setCur(clampDay(day0(sel || new Date())));
    setMode("days");
    moveFocus.current = true;
    setOpen(true);
  };
  const inside = (n: Node | null) => !!n && (!!root.current?.contains(n) || !!pop.current?.contains(n));
  // focus stays inside the open calendar: Tab wraps round, Escape or Done hands it back to the field
  const trap = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const f = [...pop.current!.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input')];
    const i = f.findIndex(el => el === document.activeElement);
    if (e.shiftKey ? i <= 0 : i === f.length - 1) {
      e.preventDefault();
      f[e.shiftKey ? f.length - 1 : 0]?.focus();
    }
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) trigger.current?.focus();
  };
  useEffect(() => {
    if (!open) return;
    pop.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const down = (e: MouseEvent) => {
      if (!inside(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);
  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false;
    grid.current?.querySelector<HTMLElement>(mode === "days" ? `[data-d="${ymd(cur)}"]` : "[data-on]")?.focus();
  }, [open, cur, mode]);

  const pickDay = (d: Date) => {
    const [h, m] = time ? baseTime() : [0, 0];
    commit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m));
    if (!time) close();
  };
  const setTime = (h: number, m: number) => commit(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), h, m));
  const go = (d: Date, focus = false) => {
    moveFocus.current = focus && !same(d, cur);
    setCur(clampDay(d));
  };
  const keyTarget = (e: KeyboardEvent): Date | null => {
    const wd = (cur.getDay() - FIRST + 7) % 7;
    const months = mode === "months";
    const year = e.shiftKey || months;
    switch (e.key) {
      case "ArrowLeft": return months ? addMonths(cur, -1) : addDays(cur, -1);
      case "ArrowRight": return months ? addMonths(cur, 1) : addDays(cur, 1);
      case "ArrowUp": return months ? addMonths(cur, -3) : addDays(cur, -7);
      case "ArrowDown": return months ? addMonths(cur, 3) : addDays(cur, 7);
      case "Home": return addDays(cur, -wd);
      case "End": return addDays(cur, 6 - wd);
      case "PageUp": return addMonths(cur, year ? -12 : -1);
      case "PageDown": return addMonths(cur, year ? 12 : 1);
      default: return null;
    }
  };
  const gridKey = (e: KeyboardEvent) => {
    const n = keyTarget(e);
    if (!n) return;
    e.preventDefault();
    go(n, true);
  };
  const toggleMode = () => {
    moveFocus.current = true;
    setMode(mode === "days" ? "months" : "days");
  };
  const pickMonth = (d: Date) => {
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    moveFocus.current = true;
    setCur(clampDay(new Date(d.getFullYear(), d.getMonth(), Math.min(cur.getDate(), daysInMonth))));
    setMode("days");
  };

  const today = day0(new Date());
  const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const start = addDays(first, -((first.getDay() - FIRST + 7) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const noPrev = !!lo && (mode === "days" ? addDays(first, -1) < day0(lo) : cur.getFullYear() <= lo.getFullYear());
  const noNext = !!hi && (mode === "days" ? addMonths(first, 1) > day0(hi) : cur.getFullYear() >= hi.getFullYear());
  const [h, m] = baseTime();
  const pm = h >= 12;
  const shown = (() => {
    if (!sel) return "";
    const diff = Math.round((+day0(sel) - +today) / 864e5);
    let d: string;
    if (diff === 0) d = "Today";
    else if (diff === -1) d = "Yesterday";
    else if (diff === 1) d = "Tomorrow";
    else d = sel.toLocaleDateString(undefined, {
      weekday: compact ? undefined : "short",
      day: "numeric",
      month: "short",
      year: sel.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
    });
    return time ? `${d}, ${sel.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : d;
  })();
  const hint = placeholder ?? (time ? "Pick a date and time" : "Pick a date");
  // `at` is null on phones (480px and narrower), where the picker is a sheet along the bottom; elsewhere the
  // presets, if any, sit in a column beside the calendar
  const wide = !!(presets && at);
  const popClass = cn(
    "bg-card border border-[var(--art-glyph)] rounded-none text-[15px] text-ink [scroll-margin:16px]",
    // the old .dp button reset, kept below every button's own utilities
    "[:where(&)_button]:[font:inherit] [:where(&)_button]:text-inherit [:where(&)_button]:bg-transparent [:where(&)_button]:border-0 [:where(&)_button]:p-0 [:where(&)_button]:cursor-pointer [:where(&)_button:disabled]:cursor-not-allowed [:where(&)_button:focus-visible]:outline-2 [:where(&)_button:focus-visible]:outline-accent [:where(&)_button:focus-visible]:outline-offset-1",
    at
      ? "absolute z-[60] w-[316px] p-3"
      : "fixed z-[60] left-0 right-0 bottom-0 w-auto p-4 pb-[calc(16px+env(safe-area-inset-bottom))] border-0 border-t-[3px] border-t-accent shadow-[0_0_0_100vmax_rgba(0,0,0,.4)]",
    at?.up && "-translate-y-full",
    wide && "grid grid-cols-[132px_1fr] w-[452px] p-0",
  );
  const dayClass = (d: Date) => cn(
    "h-[38px] max-xs:h-11 rounded-none tabular-nums relative hover:bg-panel disabled:text-[light-dark(#d2d2d2,#3a4385)]",
    d.getMonth() !== cur.getMonth() && "text-[light-dark(#a3a3a3,#5e648f)]",
    same(d, today) && "font-bold text-link after:content-[''] after:absolute after:left-1/2 after:bottom-[5px] after:w-1 after:h-1 after:-ml-[2px] after:rounded-full after:bg-current",
    same(d, sel) && "bg-accent text-on-accent font-bold hover:bg-accent",
  );

  const popup = (
    <div className={popClass} ref={pop} role="dialog" aria-modal="true" aria-label={label} style={at ? { left: at.left, top: at.top } : undefined} onKeyDown={trap}>
      {presets && (
        <div className={cn("flex flex-wrap gap-1.5 pb-3 mb-2.5 border-b border-line max-xs:flex-nowrap max-xs:overflow-x-auto", wide && "flex-col flex-nowrap gap-0.5 px-2 py-3 m-0 border-b-0 border-r bg-card")}>
          {presets.map(([l, f]) => <button type="button" key={l} className={cn("px-2.5 py-1 rounded-none bg-panel text-sm font-medium hover:bg-line max-xs:flex-none max-xs:px-3 max-xs:py-2", wide && "bg-transparent text-left px-2.5 py-2 hover:bg-panel")} onClick={() => commit(f())}>{l}</button>)}
        </div>
      )}
      <div className={wide ? "p-3" : undefined}>
        <div className="flex items-center gap-1 mb-1.5">
          <button
            type="button"
            className="w-9 h-9 max-sm:w-11 max-sm:h-11 grid place-items-center rounded-none hover:bg-panel disabled:text-edge [&>svg]:w-5 [&>svg]:h-5"
            aria-label={mode === "days" ? "Previous month" : "Previous year"}
            disabled={noPrev}
            onClick={() => go(addMonths(cur, mode === "days" ? -1 : -12))}
          >
            <Ico.ChevLeft />
          </button>
          <button type="button" className="flex-1 inline-flex items-center justify-center gap-1 h-9 max-sm:h-11 rounded-none font-bold text-base hover:bg-panel [&>svg]:w-4 [&>svg]:h-4 text-muted" aria-live="polite" onClick={toggleMode}>
            {mode === "days" ? cur.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : cur.getFullYear()}
            <Ico.ChevDown />
          </button>
          <button
            type="button"
            className="w-9 h-9 max-sm:w-11 max-sm:h-11 grid place-items-center rounded-none hover:bg-panel disabled:text-edge [&>svg]:w-5 [&>svg]:h-5"
            aria-label={mode === "days" ? "Next month" : "Next year"}
            disabled={noNext}
            onClick={() => go(addMonths(cur, mode === "days" ? 1 : 12))}
          >
            <Ico.Chevron />
          </button>
        </div>
        {mode === "days" ? (
          <div className="grid grid-cols-7 gap-0.5" ref={grid} role="grid" onKeyDown={gridKey}>
            {days.slice(0, 7).map(d => (
              <span key={d.getDay()} className="text-center text-xs font-semibold uppercase tracking-[.04em] text-muted py-1 pb-1.5" aria-hidden>{d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</span>
            ))}
            {days.map(d => (
              <button
                type="button"
                key={ymd(d)}
                data-d={ymd(d)}
                disabled={off(d)}
                tabIndex={same(d, cur) ? 0 : -1}
                aria-pressed={same(d, sel)}
                aria-current={same(d, today) ? "date" : undefined}
                aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                className={dayClass(d)}
                onClick={() => pickDay(d)}
              >
                {d.getDate()}
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 py-1.5" ref={grid} onKeyDown={gridKey}>
            {Array.from({ length: 12 }, (_, i) => new Date(cur.getFullYear(), i, 1)).map(d => {
              const dead = (!!lo && addMonths(d, 1) <= day0(lo)) || (!!hi && d > day0(hi));
              const on = d.getMonth() === cur.getMonth();
              return (
                <button
                  type="button"
                  key={d.getMonth()}
                  disabled={dead}
                  tabIndex={on ? 0 : -1}
                  data-on={on ? "" : undefined}
                  className={cn("h-[52px] rounded-none font-medium hover:bg-panel disabled:text-[light-dark(#d2d2d2,#3a4385)]", on && "bg-accent text-on-accent font-bold hover:bg-accent")}
                  onClick={() => pickMonth(d)}
                >
                  {d.toLocaleDateString(undefined, { month: "short" })}
                </button>
              );
            })}
          </div>
        )}
        {time && (
          <div className="flex items-center gap-1.5 mt-2.5 pt-3 border-t border-line">
            <span className="font-semibold text-sm mr-auto">Time</span>
            <Num
              label="Hour"
              value={H12 ? h % 12 || 12 : h}
              min={H12 ? 1 : 0}
              max={H12 ? 12 : 23}
              onChange={n => setTime(H12 ? (n % 12) + (pm ? 12 : 0) : n, m)}
              onEnter={close}
            />
            <b>:</b>
            <Num label="Minute" value={m} min={0} max={59} onChange={n => setTime(h, n)} onEnter={close} />
            {H12 && (
              <span className="inline-flex ml-1.5 border border-edge rounded-none overflow-hidden" role="group" aria-label="AM or PM">
                <button type="button" className={cn("w-[42px] h-9 text-sm font-semibold text-ink-2", !pm && "bg-ink text-bg")} aria-pressed={!pm} onClick={() => pm && setTime(h - 12, m)}>AM</button>
                <button type="button" className={cn("w-[42px] h-9 text-sm font-semibold text-ink-2", pm && "bg-ink text-bg")} aria-pressed={pm} onClick={() => !pm && setTime(h + 12, m)}>PM</button>
              </span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3.5 mt-3 empty:hidden">
          {!off(today) && (
            <button type="button" className="text-link font-semibold text-sm hover:underline" onClick={() => (time ? commit(new Date()) : pickDay(today))}>
              {time ? "Now" : "Today"}
            </button>
          )}
          {time && <button type="button" className="ml-auto px-4.5 py-2 rounded-none bg-accent text-on-accent font-bold text-[13px] tracking-[.08em] uppercase hover:bg-accent-dark" onClick={() => close()}>Done</button>}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={cn("dp relative w-full font-normal [:where(&)_button]:[font:inherit] [:where(&)_button]:text-inherit [:where(&)_button]:bg-transparent [:where(&)_button]:border-0 [:where(&)_button]:p-0 [:where(&)_button]:cursor-pointer [:where(&)_button:disabled]:cursor-not-allowed [:where(&)_button:focus-visible]:outline-2 [:where(&)_button:focus-visible]:outline-accent [:where(&)_button:focus-visible]:outline-offset-1", compact && "inline-block w-auto")}
      ref={root}
      onKeyDown={e => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
      onBlur={e => { if (e.relatedTarget && !inside(e.relatedTarget)) setOpen(false); }}
    >
      <button
        type="button"
        ref={trigger}
        className={cn(
          "dp-trigger flex items-center gap-2.5 w-full max-w-full px-3 py-2.5 text-base text-left border border-edge rounded-none bg-card shadow-[inset_0_1px_3px_var(--inset)] [&_.ico]:size-[18px] [&_.ico]:text-muted",
          open && "border-accent shadow-[inset_0_1px_3px_var(--inset),0_0_0_3px_color-mix(in_srgb,var(--accent)_22%,transparent)]",
          compact && "px-2.5 py-1.5 text-[15px] gap-2",
        )}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${shown || hint}`}
        onClick={() => (open ? close() : show())}
      >
        <Ico.Calendar />
        <span className={shown ? "" : "text-muted"}>{shown || hint}</span>
      </button>
      {open && createPortal(popup, document.body)}
    </div>
  );
}
