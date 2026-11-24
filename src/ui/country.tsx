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
import { locale, t } from "../i18n";

type Row = { key: string; label: string; sub?: string; count: number; icon?: ReactNode; place?: EventPlace };

const FLAGS = Flags as unknown as Record<string, ComponentType<{ title?: string; className?: string }>>;

export function Flag({ code }: { code: string }) {
  const F = FLAGS[code];
  return F ? <F className="flag" /> : null;
}

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

const regionNames = () => new Intl.DisplayNames([locale()], { type: "region" });

function localCountry(name: string) {
  const code = countryCode(name);
  return code ? (regionNames().of(code) ?? name) : name;
}

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
                <span className="suggest-count" title={t("common.eventCount", { count: r.count })}>
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
    const timer = setTimeout(load, 150);
    return () => {
      live = false;
      clearTimeout(timer);
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
        sub: [p.city, p.country && localCountry(p.country)].filter(Boolean).join(", ") || undefined,
      }));
  const pick = (r: Row) => {
    onChange(r.label);
    if (r.place) onPick?.({ ...r.place, country: countryName(r.place.country || "") });
  };
  return (
    <Suggest
      label={field === "venue" ? t("common.venue") : t("common.city")}
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
  const lang = locale();
  const localized = useMemo(() => {
    const names = regionNames();
    return COUNTRIES.map((c) => ({ ...c, local: names.of(c.code) ?? c.name }));
  }, [lang]);
  const byLocal = useMemo(() => new Map(localized.map((c) => [c.local.toLowerCase(), c.code])), [localized]);
  const codeOf = (s: string) => countryCode(s) ?? byLocal.get(s.trim().toLowerCase());
  const localName = (c: string) => localized.find((x) => x.code === c)?.local ?? "";
  const code = countryCode(value);
  const [text, setText] = useState(code ? localName(code) : value);
  useEffect(() => {
    setText((current) => {
      if (current && codeOf(current) === code) return current;
      return code ? localName(code) : value;
    });
  }, [value, code]);
  const ranked = useMemo(() => {
    const events = (c: { code: string }) => counts.get(c.code) ?? 0;
    return [...localized].sort((a, b) => events(b) - events(a) || a.local.localeCompare(b.local, lang));
  }, [counts, localized, lang]);
  const q = fold(text.trim());
  const picked = !!code && codeOf(text) === code;
  const matches = (c: { code: string; name: string; local: string }) =>
    fold(c.local).includes(q) ||
    fold(c.name).includes(q) ||
    Object.entries(COUNTRY_ALIASES).some(([a, k]) => k === c.code && a.startsWith(q));
  const rows: Row[] = ranked
    .filter((c) => !q || picked || matches(c))
    .map((c) => ({ key: c.code, label: c.local, count: counts.get(c.code) ?? 0, icon: <Flag code={c.code} /> }));
  const type = (v: string) => {
    setText(v);
    if (!v.trim()) onChange("");
  };
  const pick = (r: Row) => {
    setText(r.label);
    onChange(countryNameOf(r.key));
  };
  // a typed name or alias snaps to its country; anything else goes back to what was picked
  const leave = () => {
    const c = codeOf(text);
    if (c) {
      setText(localName(c));
      onChange(countryNameOf(c));
    } else if (text.trim()) {
      setText(code ? localName(code) : "");
    }
  };
  return (
    <Suggest
      label={t("common.country")}
      value={text}
      placeholder={t("common.searchCountries")}
      icon={picked ? <Flag code={code} /> : undefined}
      rows={rows}
      onText={type}
      onPick={pick}
      onLeave={leave}
    />
  );
}
