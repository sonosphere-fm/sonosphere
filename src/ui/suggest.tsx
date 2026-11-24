import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "../kit";
import { t } from "../i18n";

export function Suggest<T>({
  value,
  onChange,
  onPick,
  search,
  text,
  row,
  placeholder,
  label,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onPick: (item: T) => void;
  search: (term: string) => Promise<T[]>;
  text: (item: T) => string;
  row: (item: T) => ReactNode;
  placeholder?: string;
  label: string;
  autoFocus?: boolean;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const seq = useRef(0);
  const picked = useRef("");
  useEffect(() => {
    const term = value.trim();
    const n = ++seq.current;
    if (term.length < 2 || value === picked.current) {
      setItems([]);
      return;
    }
    const show = (r: T[]) => {
      if (n !== seq.current) return;
      setItems(r);
      setHi(-1);
    };
    const timer = setTimeout(() => search(term).then(show, () => {}), 160);
    return () => clearTimeout(timer);
  }, [value]);
  const pick = (it: T) => {
    picked.current = text(it);
    setItems([]);
    setOpen(false);
    onPick(it);
  };
  const key = (e: React.KeyboardEvent) => {
    if (!open || !items.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHi((hi + 1) % items.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHi((hi <= 0 ? items.length : hi) - 1);
    } else if (e.key === "Enter" && hi >= 0) {
      e.preventDefault();
      pick(items[hi]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };
  const blur = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
  };
  const type = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    setOpen(true);
  };
  return (
    <div className="suggest" onKeyDown={key} onFocus={() => setOpen(true)} onBlur={blur}>
      <Input
        value={value}
        onChange={type}
        placeholder={placeholder}
        aria-label={label}
        autoFocus={autoFocus}
        autoComplete="off"
        maxLength={255}
      />
      {open && items.length > 0 && (
        <ul className="suggest-list" role="listbox" aria-label={t("common.suggestions", { label })}>
          {items.map((it, i) => (
            <li
              key={i}
              role="option"
              aria-selected={i === hi}
              className={i === hi ? "on" : ""}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(it);
              }}
            >
              {row(it)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
