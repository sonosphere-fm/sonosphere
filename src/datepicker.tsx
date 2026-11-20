// A calendar and time picker drawn in the site's own style, with no browser-native date control involved.
// Values are local wall-clock strings, the same shape <input type="date"> and "datetime-local" use: "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm".
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { Ico } from "./icons";

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const toLocal = (d: Date, time = true) => ymd(d) + (time ? `T${pad(d.getHours())}:${pad(d.getMinutes())}` : "");
const parse = (v?: string | null) => { const m = /^(\d{4})-(\d\d)-(\d\d)(?:T(\d\d):(\d\d))?/.exec(v || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0)) : null; };
const day0 = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => { const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0); return new Date(last.getFullYear(), last.getMonth(), Math.min(d.getDate(), last.getDate())); };
const same = (a: Date | null, b: Date | null) => !!a && !!b && ymd(a) === ymd(b);
// week start and 12/24-hour clock follow the reader's locale
// getWeekInfo() is the new name of the weekInfo getter; neither is in TypeScript's lib yet
type WeekInfo = { firstDay: number };
const FIRST = (() => { try { const l: Intl.Locale & { getWeekInfo?: () => WeekInfo; weekInfo?: WeekInfo } = new Intl.Locale(navigator.language); return ((l.getWeekInfo?.() ?? l.weekInfo)?.firstDay ?? 1) % 7; } catch { return 1; } })();
const H12 = (() => { try { return !!new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12; } catch { return false; } })();

type Bound = string | "now" | undefined;
const bound = (b: Bound) => (b === "now" ? new Date() : parse(b));

/** Two-digit number box: type it, or step with the arrow keys (it wraps round). */
function Num({ value, min, max, onChange, label, onEnter }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string; onEnter: () => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const step = (n: number) => { const span = max - min + 1; setDraft(null); onChange((((value - min + n) % span) + span) % span + min); };
  return (
    <input className="dp-num" inputMode="numeric" aria-label={label} value={draft ?? pad(value)} onFocus={e => e.target.select()} onBlur={() => setDraft(null)}
      onChange={e => { const t = e.target.value.replace(/\D/g, "").slice(-2); setDraft(t); if (t && +t >= min && +t <= max) onChange(+t); }}
      onKeyDown={e => { if (e.key === "ArrowUp") { e.preventDefault(); step(1); } else if (e.key === "ArrowDown") { e.preventDefault(); step(-1); } else if (e.key === "Enter") { e.preventDefault(); onEnter(); } }} />
  );
}

export function DatePicker({ value, onChange, label, time, min, max, placeholder, presets, clearable, compact, defaultTime = "" }: {
  value: string; onChange: (v: string) => void; label: string; time?: boolean; min?: Bound; max?: Bound; placeholder?: string;
  /** Shortcuts shown above the calendar. */ presets?: [string, () => Date][]; clearable?: boolean; compact?: boolean;
  /** "HH:mm" used when a day is picked before any time; defaults to the current time. */ defaultTime?: string;
}) {
  const sel = parse(value);
  const [open, setOpen] = useState(false), [mode, setMode] = useState<"days" | "months">("days"), [at, setAt] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const [cur, setCur] = useState(() => day0(sel || new Date())); // keyboard cursor; the month on show is the cursor's month
  const root = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null), grid = useRef<HTMLDivElement>(null), pop = useRef<HTMLDivElement>(null), moveFocus = useRef(false);

  const lo = bound(min), hi = bound(max);
  const off = (d: Date) => (!!lo && day0(d) < day0(lo)) || (!!hi && day0(d) > day0(hi));
  const clampDay = (d: Date) => (lo && day0(d) < day0(lo) ? day0(lo) : hi && day0(d) > day0(hi) ? day0(hi) : d);
  const clamp = (d: Date) => (!time ? clampDay(d) : lo && d < lo ? lo : hi && d > hi ? hi : d);
  const commit = (d: Date) => { const c = clamp(d); setCur(day0(c)); onChange(toLocal(c, !!time)); };
  const baseTime = () => { if (sel) return [sel.getHours(), sel.getMinutes()]; const t = /^(\d\d):(\d\d)$/.exec(defaultTime), n = new Date(); return t ? [+t[1], +t[2]] : [n.getHours(), n.getMinutes()]; };

  const show = () => {
    const r = trigger.current!.getBoundingClientRect();
    // The calendar is drawn on <body>, above everything else on the page, and placed in page coordinates so it scrolls with its field.
    const up = window.innerHeight - r.bottom < 440 && r.top > 520, w = presets ? 452 : 316;
    setAt(window.innerWidth > 480 ? { left: Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + window.scrollX, top: (up ? r.top - 6 : r.bottom + 6) + window.scrollY, up } : null);
    setCur(clampDay(day0(sel || new Date()))); setMode("days"); moveFocus.current = true; setOpen(true);
  };
  const inside = (n: Node | null) => !!n && (!!root.current?.contains(n) || !!pop.current?.contains(n));
  // focus stays inside the open calendar: Tab wraps round, Escape or Done hands it back to the field
  const trap = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;
    const f = [...pop.current!.querySelectorAll<HTMLElement>('button:not(:disabled):not([tabindex="-1"]), input')], i = f.findIndex(el => el === document.activeElement);
    if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0]?.focus(); }
  };
  const close = (refocus = true) => { setOpen(false); if (refocus) trigger.current?.focus(); };
  useEffect(() => {
    if (!open) return;
    pop.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const down = (e: MouseEvent) => { if (!inside(e.target as Node)) setOpen(false); }; // a mousedown always lands on a DOM node
    document.addEventListener("mousedown", down); return () => document.removeEventListener("mousedown", down);
  }, [open]);
  useEffect(() => {
    if (!open || !moveFocus.current) return;
    moveFocus.current = false; grid.current?.querySelector<HTMLElement>(mode === "days" ? `[data-d="${ymd(cur)}"]` : "[data-on]")?.focus();
  }, [open, cur, mode]);

  const pickDay = (d: Date) => { const [h, m] = time ? baseTime() : [0, 0]; commit(new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m)); if (!time) close(); };
  const setTime = (h: number, m: number) => commit(new Date(cur.getFullYear(), cur.getMonth(), cur.getDate(), h, m));
  const go = (d: Date, focus = false) => { moveFocus.current = focus && !same(d, cur); setCur(clampDay(d)); };
  const gridKey = (e: KeyboardEvent) => {
    const wd = (cur.getDay() - FIRST + 7) % 7, months = mode === "months";
    const n = e.key === "ArrowLeft" ? (months ? addMonths(cur, -1) : addDays(cur, -1)) : e.key === "ArrowRight" ? (months ? addMonths(cur, 1) : addDays(cur, 1))
      : e.key === "ArrowUp" ? (months ? addMonths(cur, -3) : addDays(cur, -7)) : e.key === "ArrowDown" ? (months ? addMonths(cur, 3) : addDays(cur, 7))
      : e.key === "Home" ? addDays(cur, -wd) : e.key === "End" ? addDays(cur, 6 - wd)
      : e.key === "PageUp" ? addMonths(cur, e.shiftKey || months ? -12 : -1) : e.key === "PageDown" ? addMonths(cur, e.shiftKey || months ? 12 : 1) : null;
    if (n) { e.preventDefault(); go(n, true); }
  };

  const today = day0(new Date()), first = new Date(cur.getFullYear(), cur.getMonth(), 1);
  const start = addDays(first, -((first.getDay() - FIRST + 7) % 7)), days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const noPrev = !!lo && (mode === "days" ? addDays(first, -1) < day0(lo) : cur.getFullYear() <= lo.getFullYear());
  const noNext = !!hi && (mode === "days" ? addMonths(first, 1) > day0(hi) : cur.getFullYear() >= hi.getFullYear());
  const [h, m] = baseTime(), pm = h >= 12;
  const shown = (() => {
    if (!sel) return "";
    const diff = Math.round((+day0(sel) - +today) / 864e5);
    const d = diff === 0 ? "Today" : diff === -1 ? "Yesterday" : diff === 1 ? "Tomorrow"
      : sel.toLocaleDateString(undefined, { weekday: compact ? undefined : "short", day: "numeric", month: "short", year: sel.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
    return time ? `${d}, ${sel.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : d;
  })();
  const hint = placeholder ?? (time ? "Pick a date and time" : "Pick a date");

  return (
    <div className={"dp" + (compact ? " compact" : "")} ref={root}
      onKeyDown={e => { if (e.key === "Escape" && open) { e.stopPropagation(); close(); } }}
      onBlur={e => { if (e.relatedTarget && !inside(e.relatedTarget)) setOpen(false); }}>
      <button type="button" ref={trigger} className={"dp-trigger native-input" + (open ? " open" : "")} aria-haspopup="dialog" aria-expanded={open} aria-label={`${label}: ${shown || hint}`} onClick={() => (open ? close() : show())}>
        <Ico.Calendar /><span className={shown ? "" : "ph"}>{shown || hint}</span>
      </button>
      {open && createPortal(
        <div className={"dp dp-pop" + (at?.up ? " up" : "") + (presets ? " with-presets" : "")} ref={pop} role="dialog" aria-modal="true" aria-label={label} style={at ? { left: at.left, top: at.top } : undefined} onKeyDown={trap}>
          {presets && <div className="dp-presets">{presets.map(([l, f]) => <button type="button" key={l} onClick={() => commit(f())}>{l}</button>)}</div>}
          <div className="dp-main">
          <div className="dp-head">
            <button type="button" className="dp-nav" aria-label={mode === "days" ? "Previous month" : "Previous year"} disabled={noPrev} onClick={() => go(addMonths(cur, mode === "days" ? -1 : -12))}><Ico.ChevLeft /></button>
            <button type="button" className="dp-title" aria-live="polite" onClick={() => { moveFocus.current = true; setMode(mode === "days" ? "months" : "days"); }}>
              {mode === "days" ? cur.toLocaleDateString(undefined, { month: "long", year: "numeric" }) : cur.getFullYear()}<Ico.ChevDown />
            </button>
            <button type="button" className="dp-nav" aria-label={mode === "days" ? "Next month" : "Next year"} disabled={noNext} onClick={() => go(addMonths(cur, mode === "days" ? 1 : 12))}><Ico.Chevron /></button>
          </div>
          {mode === "days" ? (
            <div className="dp-grid" ref={grid} role="grid" onKeyDown={gridKey}>
              {days.slice(0, 7).map(d => <span key={d.getDay()} className="dp-wd" aria-hidden>{d.toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2)}</span>)}
              {days.map(d => (
                <button type="button" key={ymd(d)} data-d={ymd(d)} disabled={off(d)} tabIndex={same(d, cur) ? 0 : -1} aria-pressed={same(d, sel)} aria-current={same(d, today) ? "date" : undefined}
                  aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  className={"dp-day" + (d.getMonth() !== cur.getMonth() ? " out" : "") + (same(d, today) ? " today" : "") + (same(d, sel) ? " sel" : "")} onClick={() => pickDay(d)}>{d.getDate()}</button>
              ))}
            </div>
          ) : (
            <div className="dp-months" ref={grid} onKeyDown={gridKey}>
              {Array.from({ length: 12 }, (_, i) => new Date(cur.getFullYear(), i, 1)).map(d => {
                const dead = (!!lo && addMonths(d, 1) <= day0(lo)) || (!!hi && d > day0(hi)), on = d.getMonth() === cur.getMonth();
                return <button type="button" key={d.getMonth()} disabled={dead} tabIndex={on ? 0 : -1} data-on={on ? "" : undefined} className={"dp-month" + (on ? " sel" : "")}
                  onClick={() => { moveFocus.current = true; setCur(clampDay(new Date(d.getFullYear(), d.getMonth(), Math.min(cur.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())))); setMode("days"); }}>{d.toLocaleDateString(undefined, { month: "short" })}</button>;
              })}
            </div>
          )}
          {time && (
            <div className="dp-time">
              <span className="dp-time-label">Time</span>
              <Num label="Hour" value={H12 ? h % 12 || 12 : h} min={H12 ? 1 : 0} max={H12 ? 12 : 23} onChange={n => setTime(H12 ? (n % 12) + (pm ? 12 : 0) : n, m)} onEnter={close} />
              <b>:</b>
              <Num label="Minute" value={m} min={0} max={59} onChange={n => setTime(h, n)} onEnter={close} />
              {H12 && <span className="dp-ampm" role="group" aria-label="AM or PM">
                <button type="button" aria-pressed={!pm} onClick={() => pm && setTime(h - 12, m)}>AM</button><button type="button" aria-pressed={pm} onClick={() => !pm && setTime(h + 12, m)}>PM</button>
              </span>}
            </div>
          )}
          <div className="dp-foot">
            {!off(today) && <button type="button" className="dp-link" onClick={() => { time ? commit(new Date()) : pickDay(today); }}>{time ? "Now" : "Today"}</button>}
            {clearable && value && <button type="button" className="dp-link" onClick={() => { onChange(""); close(); }}>Clear</button>}
            {time && <button type="button" className="dp-done" onClick={() => close()}>Done</button>}
          </div>
          </div>
        </div>, document.body
      )}
    </div>
  );
}
