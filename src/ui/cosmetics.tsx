import { Suspense, useEffect, useId, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import type { UserAppearance } from "../../shared/username-fonts";
import { imageUrl, useApi } from "../lib";
import { ImageWithFallback } from "./image";

type Equipped = NonNullable<UserAppearance["cosmetics"]>[number];

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

interface Fur {
  base: string;
  inner: string;
  /** Fox ear tips. */
  tip?: string;
}

const FUR: Record<string, Fur> = {
  black: { base: "#2b2830", inner: "#7b5668" },
  white: { base: "#fbf3e6", inner: "#f0b7c4" },
  orange: { base: "#e98b38", inner: "#f6c0a0" },
  grey: { base: "#9aa0ab", inner: "#e3b9c3" },
  calico: { base: "#fbf3e6", inner: "#f0b7c4" },
  pink: { base: "#f2a6c7", inner: "#fbd5e4" },
  brown: { base: "#8a5a3c", inner: "#d9b196" },
  golden: { base: "#dcb365", inner: "#f3dca8" },
  spotted: { base: "#f1e3c8", inner: "#f1e3c8" },
  red: { base: "#de6a40", inner: "#fff0cb", tip: "#2b2830" },
  arctic: { base: "#eef6ff", inner: "#cfe0f3", tip: "#8394a8" },
  silver: { base: "#b9c6d4", inner: "#f1f5f9", tip: "#2b2830" },
  panda: { base: "#2d2c33", inner: "#8b8794" },
  polar: { base: "#fbf6ec", inner: "#d9b8b8" },
};
const HALO: Record<string, string> = {
  gold: "#f2cd5c",
  silver: "#d4dbe4",
  pink: "#f4a9c9",
};
const HORNS: Record<string, string> = {
  red: "#d8452f",
  purple: "#9b6be0",
  black: "#2b2830",
};
const PHONES: Record<string, { band: string; cup: string; pad: string }> = {
  black: { band: "#34313a", cup: "#2b2830", pad: "#5a5563" },
  white: { band: "#e9e1d3", cup: "#fbf3e6", pad: "#cfc4b2" },
  neon: { band: "#2fc8ad", cup: "#6af4db", pad: "#1d8f7c" },
};
const SOLID: Record<string, string> = {
  black: "#2b2830",
  charcoal: "#393640",
  cream: "#efe4c9",
  red: "#de6a40",
  cobalt: "#2438d6",
  mustard: "#d6a328",
  olive: "#7e8b4d",
  oak: "#8a6a3f",
  birch: "#d8c9ae",
  velvet: "#6e3b52",
  lime: "#7ed04c",
  rust: "#b65a34",
  teal: "#2f8f88",
  crimson: "#a52a3a",
  gold: "#f2cd5c",
  silver: "#b9c6d4",
  plaid: "#6b4a3f",
  wildflower: "#9a7fc9",
  rose: "#d76c8a",
  daisy: "#e9be3d",
  lavender: "#b7a0dd",
};
const FLOWERS: Record<string, { petals: string[]; center: string }> = {
  wildflower: { petals: ["#a78bd6", "#f0a6c0", "#f2d05a"], center: "#f6e6a8" },
  rose: { petals: ["#d76c8a", "#e78ba4", "#c95b78"], center: "#7b3b4e" },
  daisy: { petals: ["#f5efe0", "#f0e6cf", "#fff8e6"], center: "#e8b53a" },
  lavender: { petals: ["#b8a1df", "#c9b7ea", "#a58bd4"], center: "#6d5a94" },
};
const ANTLER: Record<string, { fill: string; line: string }> = {
  oak: { fill: "#8a6a3f", line: "#5c4529" },
  birch: { fill: "#d8c9ae", line: "#8f7a58" },
  velvet: { fill: "#8a4d63", line: "#5a2d3b" },
};

/** Swatch colours for the settings picker. */
export const COSMETIC_COLORS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(FUR).map(([k, v]) => [k, v.base])),
  purple: HORNS.purple,
  neon: PHONES.neon.cup,
  ...SOLID,
  gold: HALO.gold,
  wildflower: FLOWERS.wildflower.petals[0],
  rose: FLOWERS.rose.petals[0],
  daisy: FLOWERS.daisy.center,
  lavender: FLOWERS.lavender.petals[0],
};

const LINE = {
  stroke: "#2a2130",
  strokeOpacity: 0.6,
  strokeWidth: 1.3,
  strokeLinejoin: "round",
} as const;
const MIRROR = "translate(100 0) scale(-1 1)";

/* ------------------------------------------------------------------ */
/* Accessories                                                         */
/* ------------------------------------------------------------------ */
/* The avatar is the circle (0,0)-(100,100) in this viewBox. Accessories
   are drawn for the left side only and mirrored for the right. */

interface EarShape {
  outer: string;
  inner?: string;
  tip?: string;
  /** Static outward lean in degrees. */
  tilt?: number;
}

const EAR_SHAPES: Record<string, EarShape> = {
  cat: {
    outer: "M12 26C9 10 11 -6 17 -18C19 -21.5 22.5 -20.5 25 -18C32 -10 39 -1 44 11Z",
    inner: "M18 22C16 10 17.5 -1 20.5 -9C21.5 -11 23 -10.5 24.5 -9C29 -4 33 2 36 11Z",
  },
  fox: {
    outer: "M10 26C8 6 12 -14 19 -30C21 -33.5 25 -32 27.5 -28C34 -15 41 -3 46 12Z",
    inner: "M17 22C15 8 18 -6 22 -18C23 -20.5 25 -20 26 -18C30 -10 35 -1 38 12Z",
    tip: "M12 -14L36 -14L36 -40L12 -40Z",
  },
  wolf: {
    outer: "M8 28C6 8 8 -8 12 -22L21 -15L24 -26C32 -17 40 -6 45 12Z",
    inner: "M16 22C14 10 16 -2 18 -10L23 -6L25 -14C30 -8 34 0 37 12Z",
    tilt: -4,
  },
  bunny: {
    outer: "M16 24C8 4 6 -22 14 -40C18 -49 28 -49 31 -40C37 -22 37 4 34 20Z",
    inner: "M20 16C15 0 14 -20 19 -34C21 -38 25 -38 27 -34C31 -20 31 -2 30 14Z",
    tilt: -7,
  },
  dog: {
    outer: "M32 6C20 -4 2 -2 -6 14C-12 30 -8 48 2 58C10 66 22 60 26 48C30 36 33 22 36 12Z",
  },
  bear: { outer: "" },
};

function Ears({ kind, color, uid }: { kind: string; color: string; uid: string }) {
  const fur = FUR[color] ?? FUR.black;
  const shape = EAR_SHAPES[kind] ?? EAR_SHAPES.cat;
  const bear = kind === "bear";
  const clip = `${uid}c`;
  const outline = bear ? <circle cx="20" cy="12" r="16" /> : <path d={shape.outer} />;

  const ear = (side: "l" | "r") => (
    <g transform={side === "r" ? MIRROR : undefined}>
      <g transform={shape.tilt ? `rotate(${shape.tilt} 26 20)` : undefined}>
        <g className={`cos-ear cos-ear-${side}`}>
          <g fill={fur.base}>{outline}</g>
          <g clipPath={`url(#${clip})`}>
            {color === "calico" && (
              <>
                <ellipse cx="22" cy="-6" rx="10" ry="14" fill="#e98b38" />
                <circle cx="38" cy="8" r="7" fill="#2b2830" />
              </>
            )}
            {color === "spotted" && kind === "dog" && <ellipse cx="4" cy="28" rx="9" ry="14" fill="#7a4f33" />}
          </g>
          {bear ? (
            <circle cx="20" cy="12" r="8" fill={fur.inner} />
          ) : (
            shape.inner && <path d={shape.inner} fill={fur.inner} />
          )}
          {kind === "fox" && shape.tip && <path d={shape.tip} fill={fur.tip ?? "#2b2830"} clipPath={`url(#${clip})`} />}
          <g fill="none" {...LINE}>
            {outline}
          </g>
        </g>
      </g>
    </g>
  );

  return (
    <>
      <defs>
        <clipPath id={clip}>{outline}</clipPath>
      </defs>
      {ear("l")}
      {ear("r")}
    </>
  );
}

const HORN = "M21 15C11 5 6 -9 14 -25C17 -14 24 -6 37 -1C33 5 29 11 27 16Z";
const HORN_SHINE = "M16 -2C16 -9 17 -14 18 -17C20 -11 24 -7 29 -4C24 -4 19 -3 16 -2Z";

function Horns({ color, uid }: { color: string; uid: string }) {
  const fill = HORNS[color] ?? HORNS.red;
  const horn = (side: "l" | "r") => (
    <g transform={side === "r" ? MIRROR : undefined}>
      <circle className="cos-horn-glow" cx="27" cy="12" r="15" fill={`url(#${uid}g)`} />
      <path d={HORN} fill={fill} {...LINE} />
      <path d={HORN_SHINE} fill="#fff" fillOpacity="0.28" />
    </g>
  );
  return (
    <>
      <defs>
        <radialGradient id={`${uid}g`}>
          <stop offset="0" stopColor="#ffab55" stopOpacity="0.95" />
          <stop offset="1" stopColor="#ff6a2a" stopOpacity="0" />
        </radialGradient>
      </defs>
      {horn("l")}
      {horn("r")}
    </>
  );
}

function Halo({ color }: { color: string }) {
  const c = HALO[color] ?? HALO.gold;
  return (
    <g className="cos-halo" style={{ "--glow": c } as CSSProperties}>
      <ellipse cx="50" cy="-7" rx="25" ry="6.5" fill="none" stroke="#2a2130" strokeOpacity="0.35" strokeWidth="6.8" />
      <ellipse cx="50" cy="-7" rx="25" ry="6.5" fill="none" stroke={c} strokeWidth="4.6" />
      <path
        d="M31 -9C36 -13 44 -14.2 50 -14.2"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.55"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </g>
  );
}

function Headphones({ color }: { color: string }) {
  const t = PHONES[color] ?? PHONES.black;
  const band = "M5 47C5 8 25 -9 50 -9C75 -9 95 8 95 47";
  const cup = (side: "l" | "r") => (
    <g transform={side === "r" ? MIRROR : undefined}>
      <g className="cos-cup">
        <rect x="-5" y="33" width="15" height="30" rx="6" fill={t.cup} {...LINE} />
        <rect x="3" y="38" width="4.5" height="20" rx="2.2" fill={t.pad} />
      </g>
    </g>
  );
  return (
    <g className={color === "neon" ? "cos-phones cos-phones-neon" : "cos-phones"}>
      <path d={band} fill="none" stroke="#2a2130" strokeOpacity="0.5" strokeWidth="8.6" strokeLinecap="round" />
      <path d={band} fill="none" stroke={t.band} strokeWidth="6" strokeLinecap="round" />
      {cup("l")}
      {cup("r")}
    </g>
  );
}

const CROWN = "M31 3L27 -19L41 -8L50 -23L59 -8L73 -19L69 3Z";

function Crown({ uid }: { uid: string }) {
  return (
    <g transform="translate(0 4)">
      <defs>
        <clipPath id={`${uid}c`}>
          <path d={CROWN} />
        </clipPath>
      </defs>
      <path d={CROWN} fill="#efc452" stroke="#7e6020" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M31 3L32.2 -3H67.8L69 3Z" fill="#d9a92f" />
      <circle cx="50" cy="-9" r="2.6" fill="#e0475b" stroke="#7e6020" strokeWidth="0.8" />
      <circle cx="38" cy="-3" r="1.6" fill="#6ac1e8" />
      <circle cx="62" cy="-3" r="1.6" fill="#6ac1e8" />
      <g clipPath={`url(#${uid}c)`}>
        <g className="cos-glint">
          <rect x="-24" y="-30" width="9" height="44" fill="#fff" fillOpacity="0.65" transform="skewX(-20)" />
        </g>
      </g>
    </g>
  );
}

function Beret({ color }: { color: string }) {
  const c = SOLID[color] ?? SOLID.black;
  return (
    <g transform="rotate(-6 50 40)">
      <g className="cos-hat">
        <path d="M18 40C18 27 32 20 50 20C68 20 82 27 82 40C82 48 68 52 50 52C32 52 18 48 18 40Z" fill={c} {...LINE} />
        <path d="M20 40C24 47 35 51 50 51C65 51 76 47 80 40" fill="none" stroke="#fff" strokeOpacity="0.18" />
        <path d="M50 21C54 15 61 12 67 13" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" />
        <circle cx="68" cy="12" r="2.6" fill={c} {...LINE} />
      </g>
    </g>
  );
}

function Beanie({ color }: { color: string }) {
  const c = SOLID[color] ?? SOLID.charcoal;
  return (
    <g className="cos-hat">
      <path d="M20 46C20 28 32 17 50 17C68 17 80 28 80 46Z" fill={c} {...LINE} />
      <path d="M20 43C30 39 70 39 80 43L80 52C70 48 30 48 20 52Z" fill={c} {...LINE} />
      <path d="M24 44V51M32 42V50M40 41V49M50 40V48M60 41V49M68 42V50M76 44V51" stroke="#fff" strokeOpacity="0.2" />
      <path d="M50 17V8" stroke={c} strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="50" cy="7" r="4" fill={c} {...LINE} />
    </g>
  );
}

function Cap({ color }: { color: string }) {
  const c = SOLID[color] ?? SOLID.black;
  return (
    <g className="cos-hat">
      <path d="M22 46C22 30 33 20 50 20C67 20 78 30 78 46Z" fill={c} {...LINE} />
      <path
        d="M24 45C40 41 62 41 79 45C88 46 93 51 91 56C82 53 72 51 62 52L34 52C24 51 14 54 8 56C7 51 14 46 24 45Z"
        fill={c}
        {...LINE}
      />
      <path d="M24 45C38 42 62 42 79 45" fill="none" stroke="#fff" strokeOpacity="0.16" />
      <circle cx="50" cy="19" r="2.6" fill={c} {...LINE} />
    </g>
  );
}

function Flower({
  x,
  y,
  petal,
  center,
  scale = 1,
}: {
  x: number;
  y: number;
  petal: string;
  center: string;
  scale?: number;
}) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="0" cy="-3.4" rx="2.1" ry="3.2" fill={petal} transform={`rotate(${a})`} />
      ))}
      <circle cx="0" cy="0" r="1.7" fill={center} />
    </g>
  );
}

function FlowerCrown({ color }: { color: string }) {
  const pal = FLOWERS[color] ?? FLOWERS.wildflower;
  return (
    <g className="cos-flowers">
      <path d="M18 34C28 18 72 18 82 34" fill="none" stroke="#5f7a4a" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M27 27C22 24 18 20 15 15M73 27C78 24 82 20 85 15" fill="none" stroke="#6f8a55" strokeWidth="2" />
      <ellipse cx="22" cy="26" rx="4.6" ry="2.2" fill="#6f8a55" transform="rotate(-40 22 26)" />
      <ellipse cx="78" cy="26" rx="4.6" ry="2.2" fill="#6f8a55" transform="rotate(40 78 26)" />
      <Flower x={27} y={24} petal={pal.petals[0]} center={pal.center} />
      <Flower x={40} y={18} petal={pal.petals[1]} center={pal.center} scale={0.9} />
      <Flower x={50} y={16} petal={pal.petals[2]} center={pal.center} />
      <Flower x={60} y={18} petal={pal.petals[0]} center={pal.center} scale={0.9} />
      <Flower x={73} y={24} petal={pal.petals[1]} center={pal.center} />
    </g>
  );
}

function Antlers({ color }: { color: string }) {
  const c = ANTLER[color] ?? ANTLER.oak;
  const branch = (side: "l" | "r") => (
    <g transform={side === "r" ? MIRROR : undefined}>
      <g className="cos-antler">
        <path
          d="M31 30C27 20 24 10 25 0M25 9C19 5 14 1 10 -5M25 9C30 6 34 2 37 -4M28 20C22 17 17 14 13 9"
          fill="none"
          stroke={c.line}
          strokeWidth="4.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M31 30C27 20 24 10 25 0M25 9C19 5 14 1 10 -5M25 9C30 6 34 2 37 -4M28 20C22 17 17 14 13 9"
          fill="none"
          stroke={c.fill}
          strokeWidth="3.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </g>
  );
  return (
    <>
      {branch("l")}
      {branch("r")}
    </>
  );
}

function Antennae({ color }: { color: string }) {
  const c = SOLID[color] ?? SOLID.lime;
  const stalk = (side: "l" | "r") => (
    <g transform={side === "r" ? MIRROR : undefined}>
      <g className="cos-antenna">
        <path d="M35 25C29 12 25 2 21 -9" fill="none" stroke={c} strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="20" cy="-11" r="4.6" fill={c} {...LINE} />
        <circle cx="18.4" cy="-12.6" r="1.4" fill="#fff" fillOpacity="0.55" />
      </g>
    </g>
  );
  return (
    <>
      {stalk("l")}
      {stalk("r")}
    </>
  );
}

function Scarf({ color }: { color: string }) {
  const c = SOLID[color] ?? SOLID.cobalt;
  return (
    <g>
      <path d="M18 77C31 71 69 71 82 77L78 90C64 84 36 84 22 90Z" fill={c} {...LINE} />
      <g className="cos-scarf-tail">
        <path d="M72 83C83 85 88 93 85 104L74 101C77 94 74 89 68 86Z" fill={c} {...LINE} />
      </g>
      {color === "plaid" && (
        <g stroke="#f2dca8" strokeOpacity="0.5" strokeWidth="1.4">
          <path d="M28 76L25 89M42 74L40 86M56 74L58 86M70 76L73 89" />
          <path d="M22 80C38 76 64 76 80 80" />
        </g>
      )}
    </g>
  );
}

function BowTie({ color }: { color: string }) {
  const c = SOLID[color] ?? SOLID.black;
  return (
    <g className="cos-bowtie">
      <path d="M50 84L35 75L35 93Z" fill={c} {...LINE} />
      <path d="M50 84L65 75L65 93Z" fill={c} {...LINE} />
      <rect x="46" y="80" width="8" height="8" fill={c} {...LINE} />
    </g>
  );
}

function Earring({ color }: { color: string }) {
  const c = SOLID[color] ?? SOLID.gold;
  return (
    <g className="cos-earring-hoop">
      <circle cx="14" cy="66" r="2.8" fill={c} {...LINE} />
      <circle cx="14" cy="77" r="8" fill="none" stroke={c} strokeWidth="2.3" />
    </g>
  );
}

function Pin({ color }: { color: string }) {
  const c = SOLID[color] ?? SOLID.gold;
  return (
    <g>
      <circle cx="82" cy="66" r="7.4" fill={c} {...LINE} />
      <path
        d="M82 60V72M82 72C78.5 72 76.4 70 76.4 67.2"
        fill="none"
        stroke="#2a2130"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <rect
        className="cos-pin-shine"
        x="79"
        y="61"
        width="1.8"
        height="10"
        fill="#fff"
        fillOpacity="0.55"
        transform="rotate(20 80 66)"
      />
    </g>
  );
}

function Accessory({ item }: { item: Equipped }) {
  const uid = useId().replace(/\W/g, "");
  const [group, kind] = item.id.split(".");
  const color = item.options?.color ?? "";
  let body: ReactNode = null;
  let layer: "back" | "front" = "back";
  if (group === "ears") body = <Ears kind={kind} color={color} uid={uid} />;
  else if (item.id === "acc.horns") body = <Horns color={color} uid={uid} />;
  else if (item.id === "acc.halo") body = <Halo color={color} />;
  else if (item.id === "acc.headphones") (body = <Headphones color={color} />), (layer = "front");
  else if (item.id === "acc.crown") (body = <Crown uid={uid} />), (layer = "front");
  else if (item.id === "acc.beret") (body = <Beret color={color} />), (layer = "front");
  else if (item.id === "acc.beanie") (body = <Beanie color={color} />), (layer = "front");
  else if (item.id === "acc.cap") (body = <Cap color={color} />), (layer = "front");
  else if (item.id === "acc.flowercrown") (body = <FlowerCrown color={color} />), (layer = "front");
  else if (item.id === "acc.antlers") body = <Antlers color={color} />;
  else if (item.id === "acc.antenna") body = <Antennae color={color} />;
  else if (item.id === "acc.scarf") (body = <Scarf color={color} />), (layer = "front");
  else if (item.id === "acc.bowtie") (body = <BowTie color={color} />), (layer = "front");
  else if (item.id === "acc.earring") (body = <Earring color={color} />), (layer = "front");
  else if (item.id === "acc.pin") (body = <Pin color={color} />), (layer = "front");
  if (!body) return null;
  return (
    <svg
      className={`cos-accessory cos-acc-${group}-${kind} cos-layer-${layer}`}
      viewBox="0 0 100 100"
      aria-hidden="true"
      focusable="false"
    >
      {body}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Frames                                                              */
/* ------------------------------------------------------------------ */

function Laurel() {
  const angles = Array.from({ length: 7 }, (_, i) => 172 - i * 10.5);
  const leaf = (a: number, lean: number, key: string) => {
    const x = 50 + 45 * Math.cos((a * Math.PI) / 180);
    const y = 50 + 45 * Math.sin((a * Math.PI) / 180);
    return (
      <ellipse
        key={key}
        cx="7"
        rx="7.5"
        ry="2.8"
        transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(a + 90 + lean).toFixed(1)})`}
        fill="#e2bb4e"
        stroke="#8a6a1f"
        strokeWidth="0.7"
      />
    );
  };
  const branch = (
    <g>
      <path
        d="M32.6 92.3A45 45 0 0 1 5.2 56"
        fill="none"
        stroke="#8a6a1f"
        strokeWidth="1.2"
        strokeLinecap="round"
        transform="translate(0 0)"
      />
      {angles.flatMap((a, i) => [leaf(a, -34, `o${i}`), leaf(a, 34, `i${i}`)])}
    </g>
  );
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="cos-laurel">
      {branch}
      <g transform={MIRROR}>{branch}</g>
    </svg>
  );
}

function Garden() {
  const leaves = Array.from({ length: 12 }, (_, i) => {
    const a = i * 30;
    const x = 50 + 40 * Math.cos((a * Math.PI) / 180);
    const y = 50 + 40 * Math.sin((a * Math.PI) / 180);
    return (
      <ellipse
        key={a}
        cx={x.toFixed(2)}
        cy={y.toFixed(2)}
        rx="5.2"
        ry="2.1"
        fill={i % 3 === 0 ? "#7ca36a" : "#5f8a5b"}
        stroke="#3f5d3e"
        strokeWidth="0.6"
        transform={`rotate(${a + 90} ${x.toFixed(2)} ${y.toFixed(2)})`}
      />
    );
  });
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false" className="cos-garden">
      <g className="cos-garden-leaves">{leaves}</g>
      <Flower x={50} y={10} petal="#e8b53a" center="#7a5a1e" scale={1.15} />
    </svg>
  );
}

function Frame({ id }: { id: string }) {
  const kind = id.slice(id.indexOf(".") + 1);
  return (
    <span aria-hidden="true" className={`cos-frame cos-frame-${kind}`}>
      {kind === "laurel" && <Laurel />}
      {kind === "garden" && <Garden />}
      {kind === "tape" && (
        <span className="cos-frame-reels">
          <i />
          <i />
        </span>
      )}
      {(kind === "orbit" || kind === "arcade") && (
        <span className="cos-frame-arm">
          <i />
        </span>
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Decoration + avatar                                                 */
/* ------------------------------------------------------------------ */

export function CosmeticDecoration({ appearance }: { appearance: UserAppearance }) {
  const list = appearance.cosmetics ?? [];
  const frame = list.find((c) => c.slot === "frame");
  const accessory = list.find((c) => c.slot === "accessory");
  if (!frame && !accessory) return null;
  return (
    <span className="cos-decoration" data-motion={appearance.showCosmetics === false ? "off" : "on"}>
      {frame && <Frame id={frame.id} />}
      {accessory && <Accessory item={accessory} />}
    </span>
  );
}

function LoadedDecoration({ name }: { name: string }) {
  const q = useApi<UserAppearance>(`/user/appearance?name=${encodeURIComponent(name)}`);
  return q.data ? <CosmeticDecoration appearance={q.data} /> : null;
}

/* One shared observer for every avatar on the page: pauses ambient frame
   animation off-screen and while the tab is hidden. */
let io: IntersectionObserver | undefined;
function watchOffscreen(el: Element) {
  if (typeof IntersectionObserver === "undefined") return () => {};
  io ??= new IntersectionObserver((entries) => {
    for (const e of entries) (e.target as HTMLElement).toggleAttribute("data-offscreen", !e.isIntersecting);
  });
  io.observe(el);
  return () => io?.unobserve(el);
}
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    document.documentElement.toggleAttribute("data-cos-hidden", document.hidden);
  });
}

export function CosmeticAvatar({
  name,
  image,
  size = 40,
  appearance,
  nowPlaying = false,
  children,
}: {
  name: string;
  image?: string | null;
  size?: number;
  appearance?: UserAppearance;
  /** Spins the vinyl frame while the user is scrobbling. */
  nowPlaying?: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => (ref.current ? watchOffscreen(ref.current) : undefined), []);
  const holo = appearance?.cosmetics?.some((c) => c.id === "frame.holo");
  const onHolo = (e: PointerEvent<HTMLSpanElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const a = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2));
    e.currentTarget.style.setProperty("--holo-angle", `${Math.round((a * 180) / Math.PI + 90)}deg`);
  };
  return (
    <span
      ref={ref}
      className="cos-avatar"
      data-now-playing={nowPlaying ? "on" : "off"}
      style={{ width: size, height: size, "--avatar-size": `${size}px` } as CSSProperties}
      onPointerMove={holo ? onHolo : undefined}
    >
      <span className="cos-media">
        {children ?? (
          <ImageWithFallback className="art art-user art-none" src={image ? imageUrl(image, "small") : null} alt="" />
        )}
      </span>
      {appearance?.cosmetics ? (
        <CosmeticDecoration appearance={appearance} />
      ) : (
        <Suspense fallback={null}>
          <LoadedDecoration name={name} />
        </Suspense>
      )}
    </span>
  );
}
