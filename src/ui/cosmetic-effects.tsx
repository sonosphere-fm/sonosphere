import { useEffect, useRef } from "react";
import type { UserAppearance } from "../../shared/username-fonts";

/*
 * One canvas for page effects (sparkles, cursor stardust, confetti) and
 * the heart burst. Only mounted when something equipped needs it.
 *
 * - One shared particle cap (80 desktop / 30 mobile) across everything.
 *   Click/heart bursts may exceed it by a small fixed allowance.
 * - The loop sleeps when nothing is spawning and nothing is alive.
 * - Heart bursts rise from the Scrobbling now label while a track is playing.
 */

const BURST_ALLOWANCE = 30;

type Kind = "star" | "paper" | "heart";
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
}

const SPARKLE = ["#f5d66e", "#ef9cc3", "#8ed6eb", "#c7b0ed"];
const CONFETTI = ["#f5d66e", "#ef7aa8", "#6fd0e8", "#a98be8", "#7fe0a0", "#ff9a5c"];

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
  hearts: boolean;
  contained: boolean;
}

function runEngine(canvas: HTMLCanvasElement, root: HTMLElement, cfg: Config): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};
  const cap = matchMedia("(max-width: 600px)").matches ? 30 : 80;
  const ambient = cfg.page === "fx.sparkles";
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

  const frame = (time: number) => {
    raf = 0;
    const dt = Math.min((time - (last || time)) / 1000, 0.05);
    last = time;
    const cr = canvas.getBoundingClientRect();
    if (Math.abs(cr.width - W) > 1 || Math.abs(cr.height - H) > 1) resize();
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
    }

    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      p.vy += p.ay * dt;
      p.x += p.vx * dt;
      if (p.kind === "paper") (p.vx *= 1 - 1.6 * dt), (p.vy *= 1 - 0.6 * dt);
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      const outside = p.y > H + 24 || p.y < -40 || p.x < -40 || p.x > W + 40;
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
      }
    }
    ctx.globalAlpha = 1;

    if (ps.length || ambient) raf = requestAnimationFrame(frame);
    else (last = 0), ctx.clearRect(0, 0, W, H);
  };
  const wake = () => {
    if (!raf) (last = 0), (raf = requestAnimationFrame(frame));
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
  const burstHearts = () => {
    const label = root.querySelector(".now .np");
    if (!label) return;
    const rect = label.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    if (rect.bottom < cr.top || rect.top > cr.bottom || rect.right < cr.left || rect.left > cr.right) return;
    for (let i = 0; i < 7; i++)
      add(
        {
          ...base(),
          kind: "heart",
          x: rect.left + rect.width / 2 - cr.left + rand(-rect.width * 0.3, rect.width * 0.3),
          y: rect.top - cr.top,
          vx: rand(-22, 22),
          vy: rand(-90, -40),
          life: rand(0.8, 1.3),
          size: rand(10, 16),
          color: "#d9688d",
        },
        true
      );
    wake();
  };

  resize();
  window.addEventListener("resize", resize);
  events.addEventListener("pointermove", onMove);
  events.addEventListener("click", onClick);
  const heartTimer = cfg.hearts ? window.setInterval(burstHearts, 1000) : undefined;
  if (cfg.hearts) burstHearts();
  if (ambient) wake();
  return () => {
    cancelAnimationFrame(raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    window.removeEventListener("resize", resize);
    events.removeEventListener("pointermove", onMove);
    events.removeEventListener("click", onClick);
    window.clearInterval(heartTimer);
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
  const hearts = nowPlaying && items.some((c) => c.id === "scrob.heart");
  const needed = Boolean(page || hearts);

  useEffect(() => {
    const canvas = ref.current;
    const root = canvas?.closest<HTMLElement>(".profile-theme") ?? canvas?.parentElement;
    if (!canvas || !root || !active || !needed) return;
    return runEngine(canvas, root, { page, hearts, contained });
  }, [active, needed, page, hearts, contained]);

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
