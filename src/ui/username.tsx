import { Suspense, useEffect, type ComponentProps } from "react";
import { USERNAME_FONTS, type UserAppearance } from "../../shared/username-fonts";
import { useApi, useAuth } from "../lib";

type NamedUser = UserAppearance & { username: string | null };

function ResolvedUsername({ name }: { name: string }) {
  const appearance = useApi<UserAppearance>(`/user/appearance?name=${encodeURIComponent(name)}`);
  return <Username name={name} font={appearance.data?.usernameFont ?? "default"} />;
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
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replaceAll("%20", "+")}&display=swap`;
    document.head.append(link);
  }, [family, selected]);
  return (
    <span {...props} style={family ? { ...style, fontFamily: `"${family}", var(--font-body, sans-serif)` } : style}>
      {known === undefined && text ? (
        <Suspense fallback={text}>
          <ResolvedUsername name={text} />
        </Suspense>
      ) : (
        text
      )}
    </span>
  );
}
