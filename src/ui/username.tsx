import { Suspense, useEffect, type ComponentProps } from "react";
import { USERNAME_FONTS, type UserAppearance } from "../../shared/username-fonts";
import { useApi, useAuth } from "../lib";

type NamedUser = UserAppearance & { username: string | null };

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#$%&@?";

function scrambled(text: string) {
  let changed = 0;
  return Array.from(text)
    .map((char, i) => {
      if (changed >= 2 || i % 3 !== 1 || !/[a-z0-9]/i.test(char)) return char;
      changed += 1;
      return GLYPHS[(char.charCodeAt(0) + i * 7) % GLYPHS.length];
    })
    .join("");
}

function ResolvedUsername({ name }: { name: string }) {
  const appearance = useApi<UserAppearance>(`/user/appearance?name=${encodeURIComponent(name)}`);
  return <Username user={{ username: name, ...appearance.data }} font={appearance.data?.usernameFont ?? "default"} />;
}

export function Username({
  user,
  name,
  font,
  style,
  ...props
}: Omit<ComponentProps<"span">, "children"> & {
  user?: NamedUser;
  name?: string | null;
  font?: string | null;
}) {
  const text = name ?? user?.username;
  const { me } = useAuth();
  const known = font ?? user?.usernameFont ?? (text === me?.username ? me?.usernameFont : undefined);
  const selected = USERNAME_FONTS.find((entry) => entry.id === known);
  const family = selected?.family;
  useEffect(() => {
    if (!family || !selected) return;
    const id = `username-font-${selected.id}`;
    if (document.getElementById(id)) return;
    if ("url" in selected) {
      const style = document.createElement("style");
      style.id = id;
      style.textContent = `@font-face { font-family: '${family}'; src: url('${selected.url}') format('${selected.format}'); font-display: swap; }`;
      document.head.append(style);
      return;
    }
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://api.fonts.coollabs.io/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}&display=swap`;
    document.head.append(link);
  }, [family, selected]);
  const nameEffect = user?.cosmetics?.find((c) => c.slot === "name_fx");
  return (
    <span
      {...props}
      data-name-fx={nameEffect?.id.replace("name.", "")}
      data-name-palette={nameEffect?.options.color}
      style={family ? { ...style, fontFamily: `"${family}", var(--font-body, sans-serif)` } : style}
    >
      {(known === undefined || (font === undefined && user?.cosmetics === undefined)) && text ? (
        <Suspense fallback={text}>
          <ResolvedUsername name={text} />
        </Suspense>
      ) : (nameEffect?.id === "name.bounce" ||
          nameEffect?.id === "name.cascade" ||
          nameEffect?.id === "name.marquee") &&
        text ? (
        <>
          {Array.from(text).map((letter, i) => (
            <span key={i} style={{ "--letter": i } as import("react").CSSProperties}>
              {letter}
            </span>
          ))}
        </>
      ) : nameEffect?.id === "name.decrypt" && text ? (
        <>
          <span className="cos-decrypt-real">{text}</span>
          <span className="cos-decrypt-scramble" aria-hidden="true">
            {scrambled(text)}
          </span>
        </>
      ) : nameEffect?.id === "name.eq" ? (
        <>
          {text}
          <span className="cos-eq" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((bar) => (
              <i key={bar} style={{ "--bar-index": bar } as import("react").CSSProperties} />
            ))}
          </span>
        </>
      ) : (
        text
      )}
      {text && ["name.sparkle", "name.frost", "name.fire"].includes(nameEffect?.id ?? "") && (
        <span className="cos-name-particles" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <i key={i} style={{ "--particle": i } as import("react").CSSProperties} />
          ))}
        </span>
      )}
    </span>
  );
}
