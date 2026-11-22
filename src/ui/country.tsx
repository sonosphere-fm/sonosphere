import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent, type ReactNode } from "react";
import { TextInput } from "@astryxdesign/core/TextInput";
import * as Flags from "country-flag-icons/react/3x2";
import { api, num } from "../lib";
import type { EventPlace, EventPlaces } from "../../shared/events";

type Row = { key: string; label: string; sub?: string; count: number; icon?: ReactNode; place?: EventPlace };

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
const FLAGS = Flags as unknown as Record<string, ComponentType<{ title?: string; className?: string }>>;
const NOT_COUNTRIES = ["AC", "EU", "IC", "TA"];
const COUNTRIES = Object.keys(FLAGS)
  .filter(code => /^[A-Z]{2}$/.test(code) && !NOT_COUNTRIES.includes(code))
  .map(code => ({ code, name: regionNames.of(code) ?? code }))
  .filter(c => c.name !== c.code);
const ALIASES: Record<string, string> = {
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  usa: "US",
  us: "US",
  "united states of america": "US",
  america: "US",
  "south korea": "KR",
  "north korea": "KP",
  russia: "RU",
  "czech republic": "CZ",
  holland: "NL",
};
const byName = new Map<string, string>([...COUNTRIES.map(c => [c.name.toLowerCase(), c.code] as const), ...Object.entries(ALIASES)]);
const codeOf = (name: string) => byName.get(name.trim().toLowerCase());
const nameOf = (code: string) => COUNTRIES.find(c => c.code === code)?.name ?? "";
export function countryName(s: string) {
  const c = codeOf(s);
  return c ? nameOf(c) : "";
}
export function Flag({ code }: { code: string }) {
  const F = FLAGS[code];
  return F ? <F className="w-[21px] h-[14px] flex-none block shadow-[0_0_0_1px_var(--inset)]" /> : null;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function Suggest({ label, value, onText, onLeave, rows, onPick, icon, placeholder, required, maxLength }: {
  label: string;
  value: string;
  onText: (v: string) => void;
  onLeave?: () => void;
  rows: Row[];
  onPick: (r: Row) => void;
  icon?: ReactNode;
  placeholder?: string;
  required?: boolean;
  maxLength?: number;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  useEffect(() => {
    setHi(0);
  }, [rows]);
  useEffect(() => {
    list.current?.querySelector(`[data-i="${hi}"]`)?.scrollIntoView({ block: "nearest" });
  }, [hi]);
  const shown = open && rows.length > 0;
  const pick = (r: Row) => {
    onPick(r);
    setOpen(false);
  };
  const keys = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!shown) {
        setOpen(true);
        return;
      }
      const step = e.key === "ArrowDown" ? 1 : rows.length - 1;
      setHi(i => (i + step) % rows.length);
    } else if (e.key === "Enter" && shown && rows[hi]) {
      e.preventDefault();
      pick(rows[hi]!);
    } else if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
    }
  };
  const type = (v: string) => {
    onText(maxLength ? v.slice(0, maxLength) : v);
    setOpen(true);
  };
  const leave = () => {
    setOpen(false);
    onLeave?.();
  };
  const combobox = {
    role: "combobox",
    "aria-expanded": shown,
    "aria-controls": id,
    "aria-autocomplete": "list" as const,
    "aria-activedescendant": shown ? `${id}-${hi}` : undefined,
    onFocus: () => setOpen(true),
    onBlur: leave,
  };
  return (
    <div className="suggest relative w-full font-normal">
      <TextInput
        label={label}
        isLabelHidden
        value={value}
        placeholder={placeholder}
        isRequired={required}
        startIcon={icon}
        containerClassName="field"
        autoComplete="off"
        onChange={type}
        onKeyDown={keys}
        {...combobox}
      />
      {shown && (
        <ul className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] m-0 p-[4px_0] list-none max-h-[280px] overflow-y-auto bg-card border border-line shadow-[0_6px_18px_light-dark(rgba(0,0,0,.14),rgba(0,0,0,.5))] rounded-none [scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent]" role="listbox" id={id} ref={list} aria-label={label}>
          {rows.map((r, i) => (
            <li
              key={r.key}
              id={`${id}-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === hi}
              className={"flex items-center gap-2.5 px-[12px] py-[7px] cursor-pointer font-medium text-ink " + (i === hi ? "bg-accent-faint" : "")}
              onMouseDown={e => e.preventDefault()}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(r)}
            >
              {r.icon}
              <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap">{r.label}{r.sub && <small className="ml-2 text-muted font-normal text-[13px]">{r.sub}</small>}</span>
              {r.count > 0 && (
                <span className="text-muted text-[13px] tabular-nums" title={`${num(r.count)} ${r.count === 1 ? "event" : "events"}`}>{num(r.count)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlaceInput({ field, value, onChange, onPick, required, maxLength }: {
  field: "venue" | "city";
  value: string;
  onChange: (v: string) => void;
  onPick?: (p: EventPlace) => void;
  required?: boolean;
  maxLength?: number;
}) {
  const [found, setFound] = useState<EventPlace[]>([]);
  useEffect(() => {
    let live = true;
    const load = () => {
      api<EventPlaces>(`/events/places?field=${field}&q=${encodeURIComponent(value.trim())}`).then(r => {
        if (live) setFound(r.items);
      }, () => {});
    };
    const t = setTimeout(load, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [field, value]);
  const typed = value.trim().toLowerCase();
  const onlyMatchTyped = found.length === 1 && found[0]!.name.toLowerCase() === typed;
  const rows: Row[] = onlyMatchTyped ? [] : found.map(p => ({
    key: p.name,
    label: p.name,
    count: p.count,
    place: p,
    sub: [p.city, p.country].filter(Boolean).join(", ") || undefined,
  }));
  const pick = (r: Row) => {
    onChange(r.label);
    if (r.place) onPick?.({ ...r.place, country: countryName(r.place.country || "") });
  };
  return (
    <Suggest
      label={field === "venue" ? "Venue" : "City"}
      value={value}
      onText={onChange}
      rows={rows}
      required={required}
      maxLength={maxLength}
      onPick={pick}
    />
  );
}

export function CountryInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    api<EventPlaces>("/events/places?field=country").then(r => {
      const m = new Map<string, number>();
      for (const p of r.items) {
        const c = codeOf(p.name);
        if (c) m.set(c, (m.get(c) ?? 0) + p.count);
      }
      setCounts(m);
    }, () => {});
  }, []);
  const code = codeOf(value);
  const [text, setText] = useState(code ? nameOf(code) : value);
  useEffect(() => {
    setText(t => {
      if (t && codeOf(t) === code) return t;
      return code ? nameOf(code) : value;
    });
  }, [value, code]);
  const ranked = useMemo(() => {
    const events = (c: { code: string }) => counts.get(c.code) ?? 0;
    return [...COUNTRIES].sort((a, b) => events(b) - events(a) || a.name.localeCompare(b.name));
  }, [counts]);
  const q = fold(text.trim());
  const picked = !!code && codeOf(text) === code;
  const matches = (c: { code: string; name: string }) =>
    fold(c.name).includes(q) || Object.entries(ALIASES).some(([a, k]) => k === c.code && a.startsWith(q));
  const rows: Row[] = ranked
    .filter(c => !q || picked || matches(c))
    .map(c => ({ key: c.code, label: c.name, count: counts.get(c.code) ?? 0, icon: <Flag code={c.code} /> }));
  const type = (t: string) => {
    setText(t);
    if (!t.trim()) onChange("");
  };
  const pick = (r: Row) => {
    setText(r.label);
    onChange(r.label);
  };
  // a typed name or alias snaps to its country; anything else goes back to what was picked
  const leave = () => {
    const c = codeOf(text);
    if (c) {
      setText(nameOf(c));
      onChange(nameOf(c));
    } else if (text.trim()) {
      setText(code ? nameOf(code) : "");
    }
  };
  return (
    <Suggest
      label="Country"
      value={text}
      placeholder="Search countries"
      icon={picked ? <Flag code={code} /> : undefined}
      rows={rows}
      onText={type}
      onPick={pick}
      onLeave={leave}
    />
  );
}
