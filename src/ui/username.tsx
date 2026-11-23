import { Suspense, useEffect, type ComponentProps } from "react";
import { USERNAME_FONTS, type UserAppearance } from "../../shared/username-fonts";
import { useApi, useAuth } from "../lib";

type NamedUser = UserAppearance & { username: string | null };

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
  return (
    <span
      {...props}
      data-name-fx={user?.cosmetics?.find((c) => c.slot === "name_fx")?.id.replace("name.", "")}
      style={family ? { ...style, fontFamily: `"${family}", var(--font-body, sans-serif)` } : style}
    >
      {(known === undefined || (font === undefined && user?.cosmetics === undefined)) && text ? (
        <Suspense fallback={text}>
          <ResolvedUsername name={text} />
        </Suspense>
      ) : user?.cosmetics?.some((c) => c.id === "name.bounce") && text ? (
        <>
          {Array.from(text).map((letter, i) => (
            <span key={i} style={{ "--letter": i } as import("react").CSSProperties}>
              {letter}
            </span>
          ))}
        </>
      ) : user?.cosmetics?.some((c) => c.id === "name.eq") ? (
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
    </span>
  );
}
