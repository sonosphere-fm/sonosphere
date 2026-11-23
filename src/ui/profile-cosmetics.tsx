import { lazy, Suspense, useEffect, useRef, useState } from "react";
import type { UserAppearance } from "../../shared/username-fonts";
const Effects = lazy(() => import("./cosmetic-effects"));
export function ProfileCosmetics({
  user,
  contained = false,
  nowPlaying = false,
}: {
  user: UserAppearance;
  contained?: boolean;
  nowPlaying?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const root = ref.current?.closest<HTMLElement>(".profile-theme");
    if (!root) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let visible = false;
    const update = () => {
      const enabled = visible && !document.hidden && !motion.matches && user.showCosmetics !== false;
      root.dataset.effectsActive = enabled ? "on" : "off";
      setActive(enabled);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    observer.observe(root);
    document.addEventListener("visibilitychange", update);
    motion.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      motion.removeEventListener("change", update);
      delete root.dataset.effectsActive;
    };
  }, [user.showCosmetics]);

  return (
    <span ref={ref} className="cos-effects" aria-hidden="true">
      {!!user.cosmetics?.length && (
        <Suspense fallback={null}>
          <Effects user={user} active={active} contained={contained} nowPlaying={nowPlaying} />
        </Suspense>
      )}
    </span>
  );
}
