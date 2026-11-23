import { Suspense, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { UserAppearance } from "../../shared/username-fonts";
import { useApi, imageUrl } from "../lib";
import { ImageWithFallback } from "./image";

const COLORS: Record<string, string> = {
  black: "#252329",
  white: "#fff8ed",
  orange: "#e98b38",
  grey: "#969ba5",
  calico: "#d8a36e",
  pink: "#f2a6c7",
  brown: "#875b3d",
  golden: "#dab365",
  spotted: "#e9d8ba",
  red: "#de6a40",
  arctic: "#eaf4ff",
  silver: "#b9c6d4",
  panda: "#303039",
  polar: "#fff8ed",
  gold: "#efc452",
  purple: "#a875e0",
  neon: "#6af4db",
};
function Decoration({ appearance }: { appearance: UserAppearance }) {
  const accessory = appearance.cosmetics?.find((c) => c.slot === "accessory");
  const frame = appearance.cosmetics?.find((c) => c.slot === "frame");
  const id = accessory?.id;
  const color = COLORS[accessory?.options.color ?? "black"] ?? COLORS.black;
  return (
    <>
      {frame && <span aria-hidden="true" className={`cos-frame cos-${frame.id.replace(".", "-")}`} />}
      {id && (
        <svg
          className={`cos-accessory cos-${id.replace(".", "-")}`}
          viewBox="0 0 100 100"
          aria-hidden="true"
          style={{ "--ear-outer": color, "--ear-inner": id === "ears.fox" ? "#fff0cb" : "#efb2bd" } as CSSProperties}
        >
          {id.startsWith("ears.") && (
            <g fill="var(--ear-outer)" stroke="#30272f" strokeWidth="1.5">
              {id === "ears.bear" ? (
                <>
                  <circle cx="18" cy="12" r="14" />
                  <circle cx="82" cy="12" r="14" />
                  <circle cx="18" cy="12" r="7" fill="var(--ear-inner)" />
                  <circle cx="82" cy="12" r="7" fill="var(--ear-inner)" />
                </>
              ) : id === "ears.dog" ? (
                <>
                  <ellipse cx="8" cy="28" rx="12" ry="28" transform="rotate(18 8 28)" />
                  <ellipse cx="92" cy="28" rx="12" ry="28" transform="rotate(-18 92 28)" />
                </>
              ) : id === "ears.bunny" ? (
                <>
                  <ellipse cx="27" cy="-2" rx="10" ry="31" />
                  <ellipse cx="73" cy="-2" rx="10" ry="31" />
                  <ellipse cx="27" cy="-3" rx="4" ry="23" fill="var(--ear-inner)" />
                  <ellipse cx="73" cy="-3" rx="4" ry="23" fill="var(--ear-inner)" />
                </>
              ) : (
                <>
                  <path
                    d={
                      id === "ears.wolf"
                        ? "M6 33 7 1 12 5 15 -10 34 10 40 18Z M60 18 66 10 85 -10 88 5 93 1 94 33Z"
                        : "M8 33 9 -9 38 15Z M62 15 91 -9 92 33Z"
                    }
                  />
                  <path d="M15 20 15 0 29 13Z M71 13 85 0 85 20Z" fill="var(--ear-inner)" />
                  {id === "ears.fox" && <path d="m9 -9 1 12 8 -5Z m82 0-1 12-8-5Z" fill="#30272f" />}
                </>
              )}
            </g>
          )}
          {accessory?.options.color === "calico" && <path d="m10 4 6 14 8 -7Z m67 9 17 7-1-12Z" fill="#30272f" />}
          {accessory?.options.color === "spotted" && (
            <g fill="#30272f">
              <ellipse cx="5" cy="24" rx="5" ry="8" />
              <ellipse cx="96" cy="37" rx="5" ry="8" />
            </g>
          )}
          {id === "acc.halo" && <ellipse cx="50" cy="-8" rx="29" ry="7" fill="none" stroke={color} strokeWidth="5" />}
          {id === "acc.horns" && (
            <g fill={color}>
              <path d="M10 20Q-1 -8 21 -17Q8 2 33 12Z M67 12Q92 2 79 -17Q101 -8 90 20Z" />
            </g>
          )}
          {id === "acc.crown" && (
            <path d="m25 2-4-24 19 12 10-19 11 19 18-12-4 24Z" fill={color} stroke="#806226" strokeWidth="2" />
          )}
          {id === "acc.headphones" && (
            <g fill={color} stroke={color}>
              <path d="M4 50V35a46 46 0 0 1 92 0v15" fill="none" strokeWidth="7" />
              <rect x="-3" y="35" width="15" height="29" rx="4" />
              <rect x="88" y="35" width="15" height="29" rx="4" />
            </g>
          )}
        </svg>
      )}
    </>
  );
}
function LoadedDecoration({ name }: { name: string }) {
  const q = useApi<UserAppearance>(`/user/appearance?name=${encodeURIComponent(name)}`);
  return q.data ? (
    <span className="cos-decoration" data-motion={q.data.showCosmetics === false ? "off" : "on"}>
      <Decoration appearance={q.data} />
    </span>
  ) : null;
}
export function CosmeticAvatar({
  name,
  image,
  size = 40,
  appearance,
  children,
}: {
  name: string;
  image?: string | null;
  size?: number;
  appearance?: UserAppearance;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let visible = false;
    const update = () => setActive(visible && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <span
      ref={ref}
      className="cos-avatar"
      data-motion={active && appearance?.showCosmetics !== false ? "on" : "off"}
      style={{ width: size, height: size, "--avatar-size": `${size}px` } as CSSProperties}
    >
      {children ?? (
        <ImageWithFallback className="art art-user art-none" src={image ? imageUrl(image, "small") : null} alt="" />
      )}
      {appearance?.cosmetics ? (
        <Decoration appearance={appearance} />
      ) : (
        <Suspense fallback={null}>
          <LoadedDecoration name={name} />
        </Suspense>
      )}
    </span>
  );
}
