import { useEffect, useRef, useState } from "react";
import type { UserAppearance } from "../../shared/username-fonts";

/** One canvas coordinates header particles and page effects, including event bursts. */
export default function CosmeticEffects({ user }: { user: UserAppearance }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(false);
  const header = user.cosmetics?.find((c) => c.slot === "header_bg")?.id;
  const page = user.cosmetics?.find((c) => c.slot === "page_fx")?.id;
  useEffect(() => {
    const root = ref.current?.closest(".profile-theme");
    if (!root) return;
    let visible = false;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => {
      const active = visible && !document.hidden && !media.matches && user.showCosmetics !== false;
      setRunning(active);
      root.setAttribute("data-effects-active", active ? "on" : "off");
    };
    const observer = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      update();
    });
    observer.observe(root);
    document.addEventListener("visibilitychange", update);
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      media.removeEventListener("change", update);
    };
  }, [user.showCosmetics]);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !running) return;
    const hasParticles = user.cosmetics?.some(
      (c) =>
        c.slot === "page_fx" ||
        c.slot === "scrobble_fx" ||
        ["bg.stars", "bg.sakura", "bg.rain", "bg.fireflies"].includes(c.id)
    );
    if (!hasParticles) return;
    const cap = matchMedia("(max-width: 600px)").matches ? 30 : 80;
    const colors = ["#f5d66e", "#ef9cc3", "#8ed6eb", "#c7b0ed"];
    type Particle = {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      color: string;
      size: number;
      header: boolean;
    };
    const particles: Particle[] = [];
    let width = innerWidth,
      height = innerHeight,
      frame = 0,
      last = 0;
    const particleHeader = header && ["bg.stars", "bg.sakura", "bg.rain", "bg.fireflies"].includes(header);
    const spawn = (x: number, y: number, burst: boolean, isHeader = false) => {
      if (particles.length >= cap) return;
      particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (burst ? 160 : 10),
        vy: burst ? -Math.random() * 180 : header === "bg.rain" && isHeader ? 160 : 10 + Math.random() * 18,
        life: burst ? 1 : 6 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 1 + Math.random() * 3,
        header: isHeader,
      });
    };
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      canvas.width = width;
      canvas.height = height;
    };
    const move = (e: PointerEvent) => {
      if (page === "fx.cursor" && e.pointerType === "mouse" && width > 600) spawn(e.clientX, e.clientY, true);
    };
    const click = (e: MouseEvent) => {
      if (page !== "fx.confetti" || !(e.target instanceof Element) || !e.target.closest(".hero-art")) return;
      for (let i = 0; i < Math.min(cap, 24); i++) spawn(e.clientX, e.clientY, true);
    };
    const heart = (e: Event) => {
      const p = (e as CustomEvent<{ x: number; y: number }>).detail;
      if (!user.cosmetics?.some((c) => c.id === "scrob.heart")) return;
      for (let i = 0; i < 8; i++) {
        spawn(p.x, p.y, true);
        if (particles.length) particles[particles.length - 1].color = "heart";
      }
    };
    const draw = (time: number) => {
      const dt = Math.min((time - (last || time)) / 1000, 0.05);
      last = time;
      ctx.clearRect(0, 0, width, height);
      const bounds = canvas.closest(".profile-theme")?.querySelector(".hero")?.getBoundingClientRect();
      if (particleHeader && bounds && bounds.bottom > 0 && Math.random() < 0.3)
        spawn(Math.random() * width, Math.max(0, bounds.top), false, true);
      if (page === "fx.sparkles" && Math.random() < 0.12) spawn(Math.random() * width, Math.random() * height, false);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.life <= 0 || p.y > height || (p.header && (!bounds || p.y > bounds.bottom))) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.min(1, p.life) * 0.65;
        ctx.fillStyle = p.color === "heart" ? "#d9688d" : p.color;
        if (p.color === "heart") {
          ctx.font = "14px sans-serif";
          ctx.fillText("♥", p.x, p.y);
        } else if (p.header && header === "bg.rain") ctx.fillRect(p.x, p.y, 1, 13);
        else if (p.header && header === "bg.sakura") {
          ctx.beginPath();
          ctx.ellipse(p.x, p.y, p.size * 2, p.size, time / 2000, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      frame = requestAnimationFrame(draw);
    };
    resize();
    frame = requestAnimationFrame(draw);
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", move);
    window.addEventListener("click", click);
    window.addEventListener("cosmetic-heart", heart);
    return () => {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, width, height);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("click", click);
      window.removeEventListener("cosmetic-heart", heart);
    };
  }, [running, header, page]);
  return <canvas ref={ref} className="cos-canvas" aria-hidden="true" />;
}
