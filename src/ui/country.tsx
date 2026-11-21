// Text fields that suggest places events are already held at, most used first, with how many. Venue and city stay free
// text; the country field is a searchable picker in the field itself, with flags, and only keeps a real country.
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import { TextInput } from "@astryxdesign/core/TextInput";
import * as Flags from "country-flag-icons/react/3x2";
import { api, num } from "../lib";
import type { EventPlace, EventPlaces } from "../../shared/events";

type Row = { key: string; label: string; sub?: string; count: number; icon?: ReactNode; place?: EventPlace };

// ---------- the countries ----------
const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const FLAGS = Flags as unknown as Record<string, ComponentType<{ title?: string; className?: string }>>;
const COUNTRIES = Object.keys(FLAGS).filter(code => /^[A-Z]{2}$/.test(code) && code !== "AC" && code !== "EU" && code !== "IC" && code !== "TA")
  .map(code => ({ code, name: regionNames.of(code) ?? code })).filter(c => c.name !== c.code);
// names people (and older events) use for a few of them
const ALIASES: Record<string, string> = { uk: "GB", "great britain": "GB", england: "GB", scotland: "GB", wales: "GB", usa: "US", us: "US", "united states of america": "US", america: "US", "south korea": "KR", "north korea": "KP", russia: "RU", "czech republic": "CZ", holland: "NL" };
const byName = new Map<string, string>([...COUNTRIES.map(c => [c.name.toLowerCase(), c.code] as const), ...Object.entries(ALIASES)]);
const codeOf = (name: string) => byName.get(name.trim().toLowerCase());
const nameOf = (code: string) => COUNTRIES.find(c => c.code === code)?.name ?? "";
/** A country name as the picker would keep it, or "" when it is not one. */
export const countryName = (s: string) => { const c = codeOf(s); return c ? nameOf(c) : ""; };
export function Flag({ code }: { code: string }) { const F = FLAGS[code]; return F ? <F className="flag" /> : null; }

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

// ---------- the shared field ----------
function Suggest({ label, value, onText, onLeave, rows, onPick, icon, placeholder, required, maxLength }: {
  label: string; value: string; onText: (v: string) => void; onLeave?: () => void; rows: Row[]; onPick: (r: Row) => void;
  icon?: ReactNode; placeholder?: string; required?: boolean; maxLength?: number;
}) {
  const [open, setOpen] = useState(false), [hi, setHi] = useState(0), list = useRef<HTMLUListElement>(null), id = useId();
  useEffect(() => { setHi(0); }, [rows]);
  useEffect(() => { list.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" }); }, [hi]);
  const shown = open && rows.length > 0;
  const pick = (r: Row) => { onPick(r); setOpen(false); };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!shown) { setOpen(true); return; } setHi(i => (i + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length); }
    else if (e.key === "Enter" && shown && rows[hi]) { e.preventDefault(); pick(rows[hi]!); }
    else if (e.key === "Escape" && shown) { e.preventDefault(); setOpen(false); }
  };
  return (
    <div className="suggest">
      <TextInput label={label} isLabelHidden value={value} placeholder={placeholder} isRequired={required} startIcon={icon} containerClassName="field" autoComplete="off"
        onChange={(v: string) => { onText(maxLength ? v.slice(0, maxLength) : v); setOpen(true); }} onKeyDown={keys}
        {...{ role: "combobox", "aria-expanded": shown, "aria-controls": id, "aria-autocomplete": "list", "aria-activedescendant": shown ? `${id}-${hi}` : undefined,
          onFocus: () => setOpen(true), onBlur: () => { setOpen(false); onLeave?.(); } }} />
      {shown && (
        <ul className="suggest-list" role="listbox" id={id} ref={list} aria-label={label}>
          {rows.map((r, i) => (
            <li key={r.key} id={`${id}-${i}`} data-i={i} role="option" aria-selected={i === hi} className={i === hi ? "on" : undefined}
              onMouseDown={e => e.preventDefault()} onMouseEnter={() => setHi(i)} onClick={() => pick(r)}>
              {r.icon}<span className="suggest-name">{r.label}{r.sub && <small>{r.sub}</small>}</span>
              {r.count > 0 && <span className="suggest-count" title={`${num(r.count)} ${r.count === 1 ? "event" : "events"}`}>{num(r.count)}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Venue or city: anything goes, with the places already used offered as you type. A pick can fill in where it is. */
export function PlaceInput({ field, value, onChange, onPick, required, maxLength }: {
  field: "venue" | "city"; value: string; onChange: (v: string) => void; onPick?: (p: EventPlace) => void; required?: boolean; maxLength?: number;
}) {
  const [found, setFound] = useState<EventPlace[]>([]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(() => { api<EventPlaces>(`/events/places?field=${field}&q=${encodeURIComponent(value.trim())}`).then(r => { if (live) setFound(r.items); }, () => {}); }, 150);
    return () => { live = false; clearTimeout(t); };
  }, [field, value]);
  const typed = value.trim().toLowerCase();
  // nothing to offer once the field already says exactly the one suggestion
  const rows: Row[] = found.length === 1 && found[0]!.name.toLowerCase() === typed ? [] : found.map(p => ({
    key: p.name, label: p.name, count: p.count, place: p, sub: [p.city, p.country].filter(Boolean).join(", ") || undefined,
  }));
  return <Suggest label={field === "venue" ? "Venue" : "City"} value={value} onText={onChange} rows={rows} required={required} maxLength={maxLength}
    onPick={r => { onChange(r.label); if (r.place) onPick?.({ ...r.place, country: countryName(r.place.country || "") }); }} />;
}

/** The country, searched and picked in the field itself. Countries with the most events come first. */
export function CountryInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    api<EventPlaces>("/events/places?field=country").then(r => {
      const m = new Map<string, number>();
      for (const p of r.items) { const c = codeOf(p.name); if (c) m.set(c, (m.get(c) ?? 0) + p.count); }
      setCounts(m);
    }, () => {});
  }, []);
  const code = codeOf(value);
  const [text, setText] = useState(code ? nameOf(code) : value);
  useEffect(() => { setText(t => (codeOf(t) === code && t ? t : code ? nameOf(code) : value)); }, [value, code]);
  const ranked = useMemo(() => [...COUNTRIES].sort((a, b) => (counts.get(b.code) ?? 0) - (counts.get(a.code) ?? 0) || a.name.localeCompare(b.name)), [counts]);
  const q = fold(text.trim()), showAll = !q || codeOf(text) === code && !!code;
  const rows: Row[] = ranked.filter(c => showAll || fold(c.name).includes(q) || Object.entries(ALIASES).some(([a, k]) => k === c.code && a.startsWith(q)))
    .map(c => ({ key: c.code, label: c.name, count: counts.get(c.code) ?? 0, icon: <Flag code={c.code} /> }));
  return <Suggest label="Country" value={text} placeholder="Search countries" icon={code && codeOf(text) === code ? <Flag code={code} /> : undefined}
    rows={rows} onText={t => { setText(t); if (!t.trim()) onChange(""); }}
    onPick={r => { setText(r.label); onChange(r.label); }}
    // leaving the field keeps only a real country: a typed name or alias snaps to it, anything else goes back to what was picked
    onLeave={() => { const c = codeOf(text); if (c) { setText(nameOf(c)); onChange(nameOf(c)); } else if (text.trim()) setText(code ? nameOf(code) : ""); }} />;
}
