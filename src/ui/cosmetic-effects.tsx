import { useEffect, useRef } from "react";
import type { UserAppearance } from "../../shared/username-fonts";

/*
 * One canvas for page effects (sparkles, leaves, snow, fireflies, ripples,
 * bokeh) and the now-playing effects. Only mounted when something equipped
 * needs it.
 *
 * - One shared particle cap (80 desktop / 30 mobile) across everything.
 *   Click/heart bursts may exceed it by a small fixed allowance.
 * - The loop sleeps when nothing is spawning and nothing is alive.
 * - Effects rise from the Scrobbling now label while a track is playing.
 */

const BURST_ALLOWANCE = 30;

type Kind = "star" | "paper" | "heart" | "leaf" | "snow" | "glow" | "bokeh" | "ring" | "note" | "bubble" | "aurora";
interface Particle {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ay: number;
  age: number;
  life: number;
  size: number;
  rot: number;
  vr: number;
  color: string;
  phase: number;
  text?: string;
}

const SPARKLE = ["#f5d66e", "#ef9cc3", "#8ed6eb", "#c7b0ed"];
const CONFETTI = ["#f5d66e", "#ef7aa8", "#6fd0e8", "#a98be8", "#7fe0a0", "#ff9a5c"];
const LEAVES = ["#b06a34", "#8a7a37", "#a9552d", "#c79a3a", "#6e7d3a"];
const SNOW = ["#f4f8ff", "#dbe7ff", "#ffffff"];
const FIREFLY = ["#ffd666", "#ffe89a", "#f7c84b"];
const BOKEH = ["#ffcf33", "#5468ff", "#ff9ad5"];
const NOTES = ["#f2cd5c", "#8ed6eb", "#ef9cc3", "#c7b0ed"];
const STARS = ["#ffd257", "#ffe89a", "#fff3c4"];
const BUBBLES = ["#8ed6eb", "#c7b0ed", "#f5d66e"];
const SPARK = ["#ffd257", "#fff3c4", "#ffb04a"];
const HEART = "#d9688d";

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

function base(): Particle {
  return {
    kind: "star",
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    ay: 0,
    age: 0,
    life: 1,
    size: 2,
    rot: 0,
    vr: 0,
    color: "#fff",
    phase: Math.random() * 6.283,
  };
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2);
  ctx.quadraticCurveTo(x, y, x + r * 2, y);
  ctx.quadraticCurveTo(x, y, x, y + r * 2);
  ctx.quadraticCurveTo(x, y, x - r * 2, y);
  ctx.quadraticCurveTo(x, y, x, y - r * 2);
  ctx.fill();
}

interface Config {
  page?: string;
  scrobble?: string;
  nowPlaying: boolean;
  contained: boolean;
}

function runEngine(canvas: HTMLCanvasElement, root: HTMLElement, cfg: Config): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const mobile = matchMedia("(max-width: 600px)").matches;
  const cap = mobile ? 30 : 80;
  const ambient = ["fx.sparkles", "fx.leaves", "fx.snow", "fx.fireflies", "fx.bokeh"].includes(cfg.page ?? "");
  const ps: Particle[] = [];
  let accumulator = 0;
  const events: EventTarget = cfg.contained ? root : window;
  let W = 0,
    H = 0,
    dpr = 1,
    raf = 0,
    last = 0;
  let lastX = -999,
    lastY = -999;

  const add = (p: Particle, burst = false) => {
    if (ps.length < cap + (burst ? BURST_ALLOWANCE : 0)) ps.push(p);
  };
  const resize = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width;
    H = r.height;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
  };

  const spawnAmbient = (dt: number) => {
    if (cfg.page === "fx.sparkles") {
      accumulator += clamp((W * H) / 90000, 2, 9) * dt;
      while (accumulator >= 1) {
        accumulator -= 1;
        add({
          ...base(),
          x: rand(0, W),
          y: rand(0, H),
          vx: rand(-4, 4),
          vy: rand(-10, -2),
          life: rand(2.5, 5),
          size: rand(1.2, 3),
          color: pick(SPARKLE),
        });
      }
    } else if (cfg.page === "fx.leaves") {
      accumulator += (mobile ? 0.45 : 0.85) * dt;
      while (accumulator >= 1) {
        accumulator -= 1;
        add({
          ...base(),
          kind: "leaf",
          x: rand(0, W),
          y: -20,
          vx: rand(-8, 8),
          vy: rand(18, 42),
          life: rand(8, 12),
          size: rand(2.6, 4.4),
          rot: rand(0, 6.283),
          vr: rand(-1.4, 1.4),
          color: pick(LEAVES),
        });
      }
    } else if (cfg.page === "fx.snow") {
      accumulator += (mobile ? 1.1 : 2.2) * dt;
      while (accumulator >= 1) {
        accumulator -= 1;
        add({
          ...base(),
          kind: "snow",
          x: rand(0, W),
          y: -12,
          vx: rand(-4, 4),
          vy: rand(14, 34),
          life: rand(9, 14),
          size: rand(1.2, 2.8),
          color: pick(SNOW),
        });
      }
    } else if (cfg.page === "fx.fireflies") {
      accumulator += (mobile ? 0.8 : 1.4) * dt;
      while (accumulator >= 1) {
        accumulator -= 1;
        add({
          ...base(),
          kind: "glow",
          x: Math.random() < 0.5 ? rand(0, W * 0.25) : rand(W * 0.75, W),
          y: rand(H * 0.15, H * 0.85),
          vx: rand(-6, 6),
          vy: rand(-6, 6),
          life: rand(2.5, 5),
          size: rand(2, 4),
          color: pick(FIREFLY),
        });
      }
    } else if (cfg.page === "fx.bokeh") {
      accumulator += (mobile ? 0.35 : 0.55) * dt;
      while (accumulator >= 1) {
        accumulator -= 1;
        add({
          ...base(),
          kind: "bokeh",
          x: rand(0, W),
          y: H + rand(10, 60),
          vx: rand(-4, 4),
          vy: rand(-14, -4),
          life: rand(9, 15),
          size: rand(18, 46),
          color: pick(BOKEH),
        });
      }
    }
  };

  const frame = (time: number) => {
    raf = 0;
    const dt = Math.min((time - (last || time)) / 1000, 0.05);
    last = time;
    const cr = canvas.getBoundingClientRect();
    if (Math.abs(cr.width - W) > 1 || Math.abs(cr.height - H) > 1) resize();
    if (ambient) spawnAmbient(dt);

    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      if (p.kind === "paper") (p.vx *= 1 - 1.6 * dt), (p.vy *= 1 - 0.6 * dt);
      if (p.kind === "leaf" || p.kind === "snow") p.x += Math.sin(p.age * 1.4 + p.phase) * 16 * dt;
      if (p.kind === "glow") p.x += Math.sin(p.age * 1.2 + p.phase) * 4 * dt;
      if (p.kind === "bubble") p.x += Math.sin(p.age * 4 + p.phase) * 10 * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const margin = p.kind === "bokeh" ? 80 : 24;
      const outside = p.y > H + margin || p.y < -80 || p.x < -60 || p.x > W + 60;
      if (p.age >= p.life || outside) ps.splice(i, 1);
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const p of ps) {
      const t = p.age / p.life;
      const { x, y } = p;
      ctx.fillStyle = p.color;
      switch (p.kind) {
        case "star":
          ctx.globalAlpha = Math.sin(Math.PI * t) * 0.85;
          drawStar(ctx, x, y, p.size);
          break;
        case "paper":
          ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
          ctx.save();
          ctx.translate(x, y), ctx.rotate(p.rot), ctx.scale(1, Math.cos(p.age * 9 + p.phase));
          ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
          ctx.restore();
          break;
        case "heart":
          ctx.globalAlpha = 1 - t * t;
          ctx.font = `${p.size}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText("\u2665", x, y);
          break;
        case "leaf":
          ctx.globalAlpha = Math.sin(Math.PI * t) * 0.9;
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.ellipse(0, 0, p.size, p.size * 0.55, 0, 0, 6.283);
          ctx.fill();
          ctx.restore();
          break;
        case "snow":
          ctx.globalAlpha = Math.sin(Math.PI * t) * 0.9;
          ctx.beginPath();
          ctx.arc(x, y, p.size, 0, 6.283);
          ctx.fill();
          break;
        case "glow": {
          ctx.globalAlpha = Math.sin(Math.PI * t) * 0.75;
          const g = ctx.createRadialGradient(x, y, 0, x, y, p.size * 4);
          g.addColorStop(0, p.color);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, p.size * 4, 0, 6.283);
          ctx.fill();
          break;
        }
        case "bokeh": {
          ctx.globalAlpha = Math.sin(Math.PI * t) * 0.28;
          const g = ctx.createRadialGradient(x, y, 0, x, y, p.size);
          g.addColorStop(0, p.color);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, p.size, 0, 6.283);
          ctx.fill();
          break;
        }
        case "ring":
          ctx.globalAlpha = 1 - t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.arc(x, y, p.size + t * 40, 0, 6.283);
          ctx.stroke();
          break;
        case "note":
          ctx.globalAlpha = 1 - t * t;
          ctx.font = `${p.size}px system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(p.text ?? "\u266a", x, y);
          break;
        case "bubble":
          ctx.globalAlpha = (1 - t) * 0.75;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(x, y, p.size, 0, 6.283);
          ctx.stroke();
          break;
        case "aurora": {
          const g = ctx.createLinearGradient(x - p.size / 2, y, x + p.size / 2, y);
          g.addColorStop(0, "transparent");
          g.addColorStop(0.3, "#3ee6a0");
          g.addColorStop(0.65, "#b18bff");
          g.addColorStop(1, "transparent");
          ctx.globalAlpha = Math.sin(Math.PI * t) * 0.6;
          ctx.fillStyle = g;
          ctx.fillRect(x - p.size / 2, y - 9, p.size, 18);
          break;
        }
      }
    }
    ctx.globalAlpha = 1;

    if (ps.length || ambient) raf = requestAnimationFrame(frame);
    else (last = 0), ctx.clearRect(0, 0, W, H);
  };
  const wake = () => {
    if (!raf) (last = 0), (raf = requestAnimationFrame(frame));
  };

  const labelAt = () => {
    const el = root.querySelector<HTMLElement>(".now .np");
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    if (rect.bottom < cr.top || rect.top > cr.bottom || rect.right < cr.left || rect.left > cr.right) return null;
    return {
      x: rect.left + rect.width / 2 - cr.left,
      y: rect.top - cr.top,
      width: rect.width,
    };
  };

  const onMove = (e: Event) => {
    const m = e as PointerEvent;
    if (cfg.page !== "fx.cursor" || m.pointerType !== "mouse" || innerWidth <= 600) return;
    if (Math.hypot(m.clientX - lastX, m.clientY - lastY) < 12) return;
    (lastX = m.clientX), (lastY = m.clientY);
    const cr = canvas.getBoundingClientRect();
    add({
      ...base(),
      x: m.clientX - cr.left,
      y: m.clientY - cr.top,
      vx: rand(-14, 14),
      vy: rand(-10, 10),
      ay: 40,
      life: rand(0.7, 1.1),
      size: rand(1.5, 3),
      color: pick(SPARKLE),
    });
    wake();
  };
  const onClick = (e: Event) => {
    const m = e as MouseEvent;
    if (
      cfg.page !== "fx.confetti" ||
      !(m.target instanceof Element) ||
      !m.target.closest(".hero-art, .hero .cos-avatar, .cos-preview .cos-avatar")
    )
      return;
    const cr = canvas.getBoundingClientRect();
    for (let i = 0; i < 24; i++) {
      const a = rand(-Math.PI, 0),
        s = rand(80, 220);
      add(
        {
          ...base(),
          kind: "paper",
          x: m.clientX - cr.left,
          y: m.clientY - cr.top,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          ay: 420,
          life: rand(1.2, 2),
          size: rand(2.5, 4.5),
          rot: rand(0, 6.28),
          vr: rand(-6, 6),
          color: pick(CONFETTI),
        },
        true
      );
    }
    wake();
  };
  const onPress = (e: Event) => {
    const m = e as PointerEvent;
    if (cfg.page !== "fx.ripple" || !(m.target instanceof Element)) return;
    if (
      m.target.closest(
        "a,button,input,select,textarea,label,[role='button'],dialog,[role='dialog'],[contenteditable='true']"
      )
    )
      return;
    if (window.getSelection()?.toString()) return;
    const cr = canvas.getBoundingClientRect();
    add({
      ...base(),
      kind: "ring",
      x: m.clientX - cr.left,
      y: m.clientY - cr.top,
      life: 0.7,
      size: 6,
      color: "#ffcf33",
    });
    wake();
  };
  const burstHearts = () => {
    const r = labelAt();
    if (!r) return;
    for (let i = 0; i < 7; i++)
      add(
        {
          ...base(),
          kind: "heart",
          x: r.x + rand(-r.width * 0.3, r.width * 0.3),
          y: r.y,
          vx: rand(-22, 22),
          vy: rand(-90, -40),
          life: rand(0.8, 1.3),
          size: rand(10, 16),
          color: HEART,
        },
        true
      );
    wake();
  };
  const burstNotes = () => {
    const r = labelAt();
    if (!r) return;
    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++)
      add(
        {
          ...base(),
          kind: "note",
          x: r.x + rand(-r.width * 0.3, r.width * 0.3),
          y: r.y,
          vx: rand(-18, 18),
          vy: rand(-80, -48),
          life: rand(1.2, 2),
          size: rand(11, 17),
          color: pick(NOTES),
          text: Math.random() < 0.5 ? "\u266a" : "\u266b",
        },
        true
      );
    wake();
  };
  const burstStars = () => {
    const r = labelAt();
    if (!r) return;
    const count = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++)
      add(
        {
          ...base(),
          kind: "star",
          x: r.x + rand(-r.width * 0.4, r.width * 0.4),
          y: r.y,
          vx: rand(-16, 16),
          vy: rand(-60, -30),
          life: rand(1, 1.8),
          size: rand(1.6, 3.4),
          color: pick(STARS),
        },
        true
      );
    wake();
  };
  const burstBubbles = () => {
    const r = labelAt();
    if (!r) return;
    const count = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < count; i++)
      add(
        {
          ...base(),
          kind: "bubble",
          x: r.x + rand(-r.width * 0.35, r.width * 0.35),
          y: r.y + rand(0, 10),
          vx: rand(-8, 8),
          vy: rand(-48, -24),
          life: rand(1.5, 2.5),
          size: rand(5, 12),
          color: pick(BUBBLES),
        },
        true
      );
    wake();
  };
  const burstSpark = () => {
    const r = labelAt();
    if (!r) return;
    for (let i = 0; i < 18; i++) {
      const a = rand(-Math.PI, Math.PI),
        s = rand(30, 110);
      add(
        {
          ...base(),
          kind: "star",
          x: r.x,
          y: r.y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          life: rand(0.3, 0.55),
          size: rand(1.4, 3.2),
          color: pick(SPARK),
        },
        true
      );
    }
    wake();
  };
  const burstAurora = () => {
    const r = labelAt();
    if (!r) return;
    add(
      {
        ...base(),
        kind: "aurora",
        x: r.x,
        y: r.y - 8,
        vy: -6,
        life: 1.5,
        size: Math.max(90, r.width * 1.5),
        color: "#b18bff",
      },
      true
    );
    wake();
  };

  let track: string | null = null;
  const scrobbleTick = () => {
    const row = root.querySelector<HTMLElement>(".now");
    const link =
      row?.querySelector<HTMLAnchorElement>(".c-name a.strong") ?? row?.querySelector<HTMLAnchorElement>(".c-name a");
    const text = link?.getAttribute("href") ?? link?.textContent?.trim() ?? "";
    if (!row || !link || !text) {
      track = null;
      return;
    }
    if (cfg.scrobble === "scrob.spark" || cfg.scrobble === "scrob.aurora") {
      if (track === null) {
        track = text;
        return;
      }
      if (text === track) return;
      track = text;
      if (cfg.scrobble === "scrob.spark") burstSpark();
      else burstAurora();
      return;
    }
    if (cfg.scrobble === "scrob.heart") burstHearts();
    else if (cfg.scrobble === "scrob.notes") burstNotes();
    else if (cfg.scrobble === "scrob.stars") burstStars();
    else if (cfg.scrobble === "scrob.bubbles") burstBubbles();
  };

  resize();
  window.addEventListener("resize", resize);
  events.addEventListener("pointermove", onMove);
  events.addEventListener("click", onClick);
  events.addEventListener("pointerdown", onPress);
  const period =
    cfg.scrobble === "scrob.heart"
      ? 1000
      : cfg.scrobble === "scrob.notes"
        ? 1500
        : cfg.scrobble === "scrob.stars"
          ? 2000
          : cfg.scrobble === "scrob.bubbles"
            ? 450
            : cfg.scrobble === "scrob.spark" || cfg.scrobble === "scrob.aurora"
              ? 300
              : 0;
  const scrobbleTimer = cfg.nowPlaying && period ? window.setInterval(scrobbleTick, period) : undefined;
  if (cfg.nowPlaying && period) scrobbleTick();
  if (ambient) wake();
  return () => {
    cancelAnimationFrame(raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    window.removeEventListener("resize", resize);
    events.removeEventListener("pointermove", onMove);
    events.removeEventListener("click", onClick);
    events.removeEventListener("pointerdown", onPress);
    window.clearInterval(scrobbleTimer);
  };
}

export default function CosmeticEffects({
  user,
  active,
  contained = false,
  nowPlaying = false,
}: {
  user: UserAppearance;
  /** Visible, tab shown, motion allowed, cosmetics switched on. Decided by the parent. */
  active: boolean;
  /** Fill the nearest .profile-theme instead of the viewport (settings preview). */
  contained?: boolean;
  nowPlaying?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const items = user.cosmetics ?? [];
  const page = items.find((c) => c.slot === "page_fx")?.id;
  const scrobble = items.find((c) => c.slot === "scrobble_fx")?.id;
  const needed = Boolean(page || (scrobble && nowPlaying));

  useEffect(() => {
    const canvas = ref.current;
    const root = canvas?.closest<HTMLElement>(".profile-theme") ?? canvas?.parentElement;
    if (!canvas || !root || !active || !needed) return;
    return runEngine(canvas, root, { page, scrobble, nowPlaying, contained });
  }, [active, needed, page, scrobble, nowPlaying, contained]);

  return (
    <canvas
      ref={ref}
      className="cos-canvas"
      data-contained={contained ? "" : undefined}
      hidden={!needed || !active}
      aria-hidden="true"
    />
  );
}
