import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { TextInput } from "@astryxdesign/core/TextInput";
import * as Flags from "country-flag-icons/react/3x2";
import { api, num } from "../lib";
import type { EventPlace, EventPlaces } from "../../shared/events";
import { COUNTRIES, COUNTRY_ALIASES, countryCode, countryName, countryNameOf } from "../../shared/countries";

type Row = { key: string; label: string; sub?: string; count: number; icon?: ReactNode; place?: EventPlace };

const FLAGS = Flags as unknown as Record<string, ComponentType<{ title?: string; className?: string }>>;

export function Flag({ code }: { code: string }) {
  const F = FLAGS[code];
  return F ? <F className="flag" /> : null;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

function Suggest({
  label,
  value,
  onText,
  onLeave,
  rows,
  onPick,
  icon,
  placeholder,
  required,
  maxLength,
}: {
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
      setHi((i) => (i + step) % rows.length);
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
    <div className="suggest">
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
        <ul className="suggest-list" role="listbox" id={id} ref={list} aria-label={label}>
          {rows.map((r, i) => (
            <li
              key={r.key}
              id={`${id}-${i}`}
              data-i={i}
              role="option"
              aria-selected={i === hi}
              className={i === hi ? "on" : undefined}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHi(i)}
              onClick={() => pick(r)}
            >
              {r.icon}
              <span className="suggest-name">
                {r.label}
                {r.sub && <small>{r.sub}</small>}
              </span>
              {r.count > 0 && (
                <span className="suggest-count" title={`${num(r.count)} ${r.count === 1 ? "event" : "events"}`}>
                  {num(r.count)}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function PlaceInput({
  field,
  value,
  onChange,
  onPick,
  required,
  maxLength,
}: {
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
      api<EventPlaces>(`/events/places?field=${field}&q=${encodeURIComponent(value.trim())}`).then(
        (r) => {
          if (live) setFound(r.items);
        },
        () => {}
      );
    };
    const t = setTimeout(load, 150);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [field, value]);
  const typed = value.trim().toLowerCase();
  const onlyMatchTyped = found.length === 1 && found[0]!.name.toLowerCase() === typed;
  const rows: Row[] = onlyMatchTyped
    ? []
    : found.map((p) => ({
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

export function CountryInput({
  value,
  onChange,
  eventCounts = true,
}: {
  value: string;
  onChange: (v: string) => void;
  eventCounts?: boolean;
}) {
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  useEffect(() => {
    if (!eventCounts) return;
    api<EventPlaces>("/events/places?field=country").then(
      (r) => {
        const m = new Map<string, number>();
        for (const p of r.items) {
          const c = countryCode(p.name);
          if (c) m.set(c, (m.get(c) ?? 0) + p.count);
        }
        setCounts(m);
      },
      () => {}
    );
  }, [eventCounts]);
  const code = countryCode(value);
  const [text, setText] = useState(code ? countryNameOf(code) : value);
  useEffect(() => {
    setText((t) => {
      if (t && countryCode(t) === code) return t;
      return code ? countryNameOf(code) : value;
    });
  }, [value, code]);
  const ranked = useMemo(() => {
    const events = (c: { code: string }) => counts.get(c.code) ?? 0;
    return [...COUNTRIES].sort((a, b) => events(b) - events(a) || a.name.localeCompare(b.name));
  }, [counts]);
  const q = fold(text.trim());
  const picked = !!code && countryCode(text) === code;
  const matches = (c: { code: string; name: string }) =>
    fold(c.name).includes(q) || Object.entries(COUNTRY_ALIASES).some(([a, k]) => k === c.code && a.startsWith(q));
  const rows: Row[] = ranked
    .filter((c) => !q || picked || matches(c))
    .map((c) => ({ key: c.code, label: c.name, count: counts.get(c.code) ?? 0, icon: <Flag code={c.code} /> }));
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
    const c = countryCode(text);
    if (c) {
      setText(countryNameOf(c));
      onChange(countryNameOf(c));
    } else if (text.trim()) {
      setText(code ? countryNameOf(code) : "");
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
