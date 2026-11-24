// Values are local wall-clock strings, the same shape <input type="date"> and "datetime-local" use:
// "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm".
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Ico } from "./icons";
import { locale, t } from "./i18n";

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
const regional = () => (locale() === "en" ? navigator.language : locale());

type WeekInfo = { firstDay: number };
type LocaleWithWeek = Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo };
function firstDay() {
  try {
    const l: LocaleWithWeek = new Intl.Locale(regional());
    return ((l.getWeekInfo?.() ?? l.weekInfo)?.firstDay ?? 1) % 7;
  } catch {
    return 1;
  }
}
function hour12() {
  try {
    return !!new Intl.DateTimeFormat(regional(), { hour: "numeric" }).resolvedOptions().hour12;
  } catch {
    return false;
  }
}

type Bound = string | "now" | undefined;
const bound = (b: Bound) => (b === "now" ? new Date() : parse(b));

type NumProps = {
  value: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
  label: string;
  onEnter: () => void;
};

/** Two-digit number box: type it, or step with the arrow keys (it wraps round). */
function Num({ value, min, max, onChange, label, onEnter }: NumProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const step = (n: number) => {
    const span = max - min + 1;
    setDraft(null);
    onChange(((((value - min + n) % span) + span) % span) + min);
  };
  const type = (raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(-2);
    setDraft(digits);
    if (digits && +digits >= min && +digits <= max) onChange(+digits);
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
      className="dp-num"
      inputMode="numeric"
      aria-label={label}
      value={draft ?? pad(value)}
      onFocus={(e) => e.target.select()}
      onBlur={() => setDraft(null)}
      onChange={(e) => type(e.target.value)}
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

export function DatePicker({
  value,
  onChange,
  label,
  time,
  min,
  max,
  placeholder,
  presets,
  compact,
  defaultTime = "",
}: DatePickerProps) {
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
  const weekStart = firstDay();
  const h12 = hour12();

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
    const hm = /^(\d\d):(\d\d)$/.exec(defaultTime);
    if (hm) return [+hm[1], +hm[2]];
    const n = new Date();
    return [n.getHours(), n.getMinutes()];
  };

  // The calendar is portalled to <body> and placed in page coordinates so it scrolls with its field.
  const show = () => {
    const r = trigger.current!.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 440 && r.top > 520;
    const w = presets ? 452 : 316;
    const page = document.documentElement.clientWidth;
    if (page > 480) {
      const left = Math.max(8, Math.min(r.left, page - w - 8)) + window.scrollX;
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
    const i = f.findIndex((el) => el === document.activeElement);
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
    const wd = (cur.getDay() - weekStart + 7) % 7;
    const months = mode === "months";
    const year = e.shiftKey || months;
    switch (e.key) {
      case "ArrowLeft":
        return months ? addMonths(cur, -1) : addDays(cur, -1);
      case "ArrowRight":
        return months ? addMonths(cur, 1) : addDays(cur, 1);
      case "ArrowUp":
        return months ? addMonths(cur, -3) : addDays(cur, -7);
      case "ArrowDown":
        return months ? addMonths(cur, 3) : addDays(cur, 7);
      case "Home":
        return addDays(cur, -wd);
      case "End":
        return addDays(cur, 6 - wd);
      case "PageUp":
        return addMonths(cur, year ? -12 : -1);
      case "PageDown":
        return addMonths(cur, year ? 12 : 1);
      default:
        return null;
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
  const start = addDays(first, -((first.getDay() - weekStart + 7) % 7));
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const noPrev = !!lo && (mode === "days" ? addDays(first, -1) < day0(lo) : cur.getFullYear() <= lo.getFullYear());
  const noNext = !!hi && (mode === "days" ? addMonths(first, 1) > day0(hi) : cur.getFullYear() >= hi.getFullYear());
  const [h, m] = baseTime();
  const pm = h >= 12;
  const shown = (() => {
    if (!sel) return "";
    const diff = Math.round((+day0(sel) - +today) / 864e5);
    let d: string;
    if (diff === 0) d = t("common.today");
    else if (diff === -1) d = t("common.yesterday");
    else if (diff === 1) d = t("common.tomorrow");
    else
      d = sel.toLocaleDateString(locale(), {
        weekday: compact ? undefined : "short",
        day: "numeric",
        month: "short",
        year: sel.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
      });
    if (!time) return d;
    return t("common.dateAndTime", {
      date: d,
      time: sel.toLocaleTimeString(regional(), { hour: "numeric", minute: "2-digit" }),
    });
  })();
  const hint = placeholder ?? (time ? t("common.pickDateTime") : t("common.pickDate"));
  const popClass = "dp dp-pop" + (at?.up ? " up" : "") + (presets ? " with-presets" : "");
  const dayClass = (d: Date) =>
    "dp-day" +
    (d.getMonth() !== cur.getMonth() ? " out" : "") +
    (same(d, today) ? " today" : "") +
    (same(d, sel) ? " sel" : "");

  const popup = (
    <div
      className={popClass}
      ref={pop}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={at ? { left: at.left, top: at.top } : undefined}
      onKeyDown={trap}
    >
      {presets && (
        <div className="dp-presets">
          {presets.map(([l, f]) => (
            <button type="button" key={l} onClick={() => commit(f())}>
              {l}
            </button>
          ))}
        </div>
      )}
      <div className="dp-main">
        <div className="dp-head">
          <button
            type="button"
            className="dp-nav"
            aria-label={mode === "days" ? t("common.previousMonth") : t("common.previousYear")}
            disabled={noPrev}
            onClick={() => go(addMonths(cur, mode === "days" ? -1 : -12))}
          >
            <Ico.ChevLeft />
          </button>
          <button type="button" className="dp-title" aria-live="polite" onClick={toggleMode}>
            {mode === "days" ? cur.toLocaleDateString(locale(), { month: "long", year: "numeric" }) : cur.getFullYear()}
            <Ico.ChevDown />
          </button>
          <button
            type="button"
            className="dp-nav"
            aria-label={mode === "days" ? t("common.nextMonth") : t("common.nextYear")}
            disabled={noNext}
            onClick={() => go(addMonths(cur, mode === "days" ? 1 : 12))}
          >
            <Ico.Chevron />
          </button>
        </div>
        {mode === "days" ? (
          <div className="dp-grid" ref={grid} role="grid" onKeyDown={gridKey}>
            {days.slice(0, 7).map((d) => (
              <span key={d.getDay()} className="dp-wd" aria-hidden>
                {d.toLocaleDateString(locale(), { weekday: "short" }).slice(0, 2)}
              </span>
            ))}
            {days.map((d) => (
              <button
                type="button"
                key={ymd(d)}
                data-d={ymd(d)}
                disabled={off(d)}
                tabIndex={same(d, cur) ? 0 : -1}
                aria-pressed={same(d, sel)}
                aria-current={same(d, today) ? "date" : undefined}
                aria-label={d.toLocaleDateString(locale(), {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
                className={dayClass(d)}
                onClick={() => pickDay(d)}
              >
                {d.getDate()}
              </button>
            ))}
          </div>
        ) : (
          <div className="dp-months" ref={grid} onKeyDown={gridKey}>
            {Array.from({ length: 12 }, (_, i) => new Date(cur.getFullYear(), i, 1)).map((d) => {
              const dead = (!!lo && addMonths(d, 1) <= day0(lo)) || (!!hi && d > day0(hi));
              const on = d.getMonth() === cur.getMonth();
              return (
                <button
                  type="button"
                  key={d.getMonth()}
                  disabled={dead}
                  tabIndex={on ? 0 : -1}
                  data-on={on ? "" : undefined}
                  className={"dp-month" + (on ? " sel" : "")}
                  onClick={() => pickMonth(d)}
                >
                  {d.toLocaleDateString(locale(), { month: "short" })}
                </button>
              );
            })}
          </div>
        )}
        {time && (
          <div className="dp-time">
            <span className="dp-time-label">{t("common.time")}</span>
            <Num
              label={t("common.hour")}
              value={h12 ? h % 12 || 12 : h}
              min={h12 ? 1 : 0}
              max={h12 ? 12 : 23}
              onChange={(n) => setTime(h12 ? (n % 12) + (pm ? 12 : 0) : n, m)}
              onEnter={close}
            />
            <b>:</b>
            <Num
              label={t("common.minute")}
              value={m}
              min={0}
              max={59}
              onChange={(n) => setTime(h, n)}
              onEnter={close}
            />
            {h12 && (
              <span className="dp-ampm" role="group" aria-label={t("common.amOrPm")}>
                <button type="button" aria-pressed={!pm} onClick={() => pm && setTime(h - 12, m)}>
                  {t("common.am")}
                </button>
                <button type="button" aria-pressed={pm} onClick={() => !pm && setTime(h + 12, m)}>
                  {t("common.pm")}
                </button>
              </span>
            )}
          </div>
        )}
        <div className="dp-foot">
          {!off(today) && (
            <button type="button" className="dp-link" onClick={() => (time ? commit(new Date()) : pickDay(today))}>
              {time ? t("common.now") : t("common.today")}
            </button>
          )}
          {time && (
            <button type="button" className="dp-done" onClick={() => close()}>
              {t("common.done")}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div
      className={"dp" + (compact ? " compact" : "")}
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
      onBlur={(e) => {
        if (e.relatedTarget && !inside(e.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        ref={trigger}
        className={"dp-trigger native-input" + (open ? " open" : "")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("common.fieldValue", { label, value: shown || hint })}
        onClick={() => (open ? close() : show())}
      >
        <Ico.Calendar />
        <span className={shown ? "" : "ph"}>{shown || hint}</span>
      </button>
      {open && createPortal(popup, document.body)}
    </div>
  );
}
