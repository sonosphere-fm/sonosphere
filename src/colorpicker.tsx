import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Ico } from "./icons";

type Hsv = { h: number; s: number; v: number };
type EyeDropperApi = new () => { open: () => Promise<{ sRGBHex: string }> };

const HEX = /^#[0-9a-f]{6}$/i;
const SWATCHES = [
  "#2438d6",
  "#5b4fe0",
  "#8a3ffc",
  "#b43688",
  "#e0245e",
  "#e8512a",
  "#f2a900",
  "#2e9e5b",
  "#0f8b8d",
  "#1d9bd1",
  "#6b7280",
  "#111111",
];
const clamp = (n: number) => Math.min(1, Math.max(0, n));

function toHex({ h, s, v }: Hsv) {
  const channel = (n: number) => {
    const k = (n + h / 60) % 6;
    const value = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(5)}${channel(3)}${channel(1)}`;
}

function toHsv(hex: string): Hsv {
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const range = max - Math.min(r, g, b);
  let h = 0;
  if (range && max === r) h = ((g - b) / range + 6) % 6;
  else if (range && max === g) h = (b - r) / range + 2;
  else if (range) h = (r - g) / range + 4;
  return { h: h * 60, s: max ? range / max : 0, v: max };
}

export function ColorPicker({
  value,
  onChange,
  label,
}: {
  value: string;
  onChange: (hex: string) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [at, setAt] = useState<{ left: number; top: number; up: boolean } | null>(null);
  const [hsv, setHsv] = useState(() => toHsv(value));
  const [draft, setDraft] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const dropper = (window as { EyeDropper?: EyeDropperApi }).EyeDropper;

  useEffect(() => {
    if (value.toLowerCase() !== toHex(hsv)) setHsv(toHsv(value));
  }, [value]);

  const set = (next: Hsv) => {
    setHsv(next);
    setDraft(null);
    onChange(toHex(next));
  };
  const setHex = (hex: string) => {
    const lower = hex.toLowerCase();
    setHsv(toHsv(lower));
    onChange(lower);
  };

  const show = () => {
    const r = trigger.current!.getBoundingClientRect();
    const up = window.innerHeight - r.bottom < 400 && r.top > 420;
    const page = document.documentElement.clientWidth;
    if (page > 480) {
      const left = Math.max(8, Math.min(r.left, page - 284)) + window.scrollX;
      const top = (up ? r.top - 6 : r.bottom + 6) + window.scrollY;
      setAt({ left, top, up });
    } else {
      setAt(null);
    }
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    setDraft(null);
    if (refocus) trigger.current?.focus();
  };
  const inside = (n: Node | null) => !!n && (!!root.current?.contains(n) || !!pop.current?.contains(n));
  useEffect(() => {
    if (!open) return;
    area.current?.focus();
    pop.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const down = (e: MouseEvent) => {
      if (!inside(e.target as Node)) close(false);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open]);

  const trap = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = [...pop.current!.querySelectorAll<HTMLElement>("[tabindex='0'], button, input")];
    const i = focusable.findIndex((el) => el === document.activeElement);
    if (e.shiftKey ? i <= 0 : i === focusable.length - 1) {
      e.preventDefault();
      focusable[e.shiftKey ? focusable.length - 1 : 0]?.focus();
    }
  };

  const drag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.buttons !== 1) return;
    const box = area.current!.getBoundingClientRect();
    set({ h: hsv.h, s: clamp((e.clientX - box.left) / box.width), v: clamp(1 - (e.clientY - box.top) / box.height) });
  };
  const areaKey = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 0.1 : 0.01;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    set({ h: hsv.h, s: clamp(hsv.s + move[0]), v: clamp(hsv.v + move[1]) });
  };
  const typeHex = (raw: string) => {
    const text = raw.startsWith("#") ? raw : `#${raw}`;
    setDraft(text);
    if (HEX.test(text)) setHex(text);
  };
  const sample = async () => {
    const result = await new dropper!().open().catch(() => null);
    if (result) setHex(result.sRGBHex);
  };

  const hex = toHex(hsv);
  const hue = `hsl(${hsv.h} 100% 50%)`;
  const popup = (
    <div
      className={"dp dp-pop cp-pop" + (at?.up ? " up" : "")}
      ref={pop}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={at ? { left: at.left, top: at.top } : undefined}
      onKeyDown={trap}
    >
      <div
        className="cp-area"
        ref={area}
        tabIndex={0}
        role="slider"
        aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        style={{ backgroundColor: hue }}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drag(e);
        }}
        onPointerMove={drag}
        onKeyDown={areaKey}
      >
        <span className="cp-thumb" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <input
        className="cp-hue"
        type="range"
        min={0}
        max={359}
        aria-label="Hue"
        value={Math.round(hsv.h)}
        style={{ color: hue }}
        onChange={(e) => set({ ...hsv, h: +e.target.value })}
      />
      <div className="cp-row">
        <span className="cp-chip" style={{ background: hex }} aria-hidden />
        <input
          className="cp-hex"
          aria-label="Hex color"
          spellCheck={false}
          maxLength={7}
          value={draft ?? hex}
          onFocus={(e) => e.target.select()}
          onBlur={() => setDraft(null)}
          onChange={(e) => typeHex(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              close();
            }
          }}
        />
        {dropper && (
          <button type="button" className="dp-nav" aria-label="Pick a color from the screen" onClick={sample}>
            <Ico.Eyedropper />
          </button>
        )}
      </div>
      <div className="cp-swatches">
        {SWATCHES.map((swatch) => (
          <button
            type="button"
            key={swatch}
            className="cp-swatch"
            aria-label={swatch}
            aria-pressed={swatch === hex}
            style={{ background: swatch }}
            onClick={() => setHex(swatch)}
          />
        ))}
      </div>
      <div className="dp-foot">
        <button type="button" className="dp-done" onClick={() => close()}>
          Done
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="dp"
      ref={root}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        ref={trigger}
        className={"dp-trigger native-input" + (open ? " open" : "")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}: ${value}`}
        onClick={() => (open ? close() : show())}
      >
        <span className="cp-chip" style={{ background: value }} aria-hidden />
        <span>{value}</span>
      </button>
      {open && createPortal(popup, document.body)}
    </div>
  );
}
