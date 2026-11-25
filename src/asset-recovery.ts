const STALE_BUILD =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .+ failed/i;
const RELOAD_KEY = "stale-build-reload";
const state = globalThis as typeof globalThis & { __spinAssetReload?: boolean };

export const isStaleBuild = (error: unknown) => STALE_BUILD.test(String(error));

/** A failed build asset belongs to a previous deploy: reload once to get the current one, at most every 30s. */
export function recoverAsset() {
  if (state.__spinAssetReload || !navigator.onLine) return;
  try {
    const last = sessionStorage.getItem(RELOAD_KEY);
    if (last !== null && Date.now() - Number(last) < 30_000) return;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return;
  }
  state.__spinAssetReload = true;
  // Let React finish handling the error before navigating away.
  setTimeout(() => location.reload(), 0);
}

/** Only same-origin build links qualify; other resource failures retain their normal reporting. */
export function isFailedBuildLink(error: unknown) {
  if (!(error instanceof Event) || error.type !== "error" || !(error.target instanceof HTMLLinkElement)) return false;
  const link = error.target;
  if (!link.relList.contains("stylesheet") && !link.relList.contains("modulepreload")) return false;
  const url = new URL(link.href, location.href);
  return url.origin === location.origin && url.pathname.startsWith("/assets/");
}
