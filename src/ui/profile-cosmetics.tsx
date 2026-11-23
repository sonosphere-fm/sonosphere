import { lazy, Suspense } from "react";
import type { UserAppearance } from "../../shared/username-fonts";
const Effects = lazy(() => import("./cosmetic-effects"));
export function ProfileCosmetics({ user }: { user: UserAppearance }) {
  return user.cosmetics?.length ? (
    <Suspense fallback={null}>
      <Effects user={user} />
    </Suspense>
  ) : null;
}
