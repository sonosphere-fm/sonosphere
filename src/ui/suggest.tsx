import { useEffect, useRef, useState, type ReactNode } from "react";
import { Input } from "../kit";

export function Suggest<T>({ value, onChange, onPick, search, text, row, placeholder, label, autoFocus }: {
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
    const t = setTimeout(() => search(term).then(show, () => {}), 160);
    return () => clearTimeout(t);
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
    <div className="suggest relative w-full font-normal" onKeyDown={key} onFocus={() => setOpen(true)} onBlur={blur}>
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
        <ul className="absolute z-30 left-0 right-0 top-[calc(100%+4px)] m-0 p-[4px_0] list-none max-h-[280px] overflow-y-auto bg-card border border-line shadow-[0_6px_18px_light-dark(rgba(0,0,0,.14),rgba(0,0,0,.5))] rounded-none [scrollbar-width:thin] [scrollbar-color:var(--scroll-thin)_transparent]" role="listbox" aria-label={`${label} suggestions`}>
          {items.map((it, i) => (
            <li
              key={i}
              role="option"
              aria-selected={i === hi}
              className={"flex items-center gap-2.5 px-3 py-[7px] cursor-pointer font-medium text-ink " + (i === hi ? "bg-accent-faint" : "")}
              onMouseEnter={() => setHi(i)}
              onMouseDown={e => {
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
