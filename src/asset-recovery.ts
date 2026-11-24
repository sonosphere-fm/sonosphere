const STALE_BUILD =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Loading chunk .+ failed/i;
const RELOAD_KEY = "stale-build-reload";
const state = globalThis as typeof globalThis & { __spinAssetReload?: boolean };

export const isStaleBuild = (error: unknown) => STALE_BUILD.test(String(error));

/** A failed build asset may belong to a previous deploy. Recover once, then report persistent failures. */
export function recoverAsset(): boolean {
  if (state.__spinAssetReload) return true;
  if (!navigator.onLine) return false;
  try {
    const last = sessionStorage.getItem(RELOAD_KEY);
    if (last !== null && Date.now() - Number(last) < 30_000) return false;
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    return false;
  }
  state.__spinAssetReload = true;
  // Let React finish handling the error before navigating away.
  setTimeout(() => location.reload(), 0);
  return true;
}

/** Only same-origin build links qualify; other resource failures retain their normal reporting. */
export function failedBuildLink(error: unknown): string | undefined {
  if (!(error instanceof Event) || error.type !== "error" || !(error.target instanceof HTMLLinkElement)) return;
  const link = error.target;
  if (!link.relList.contains("stylesheet") && !link.relList.contains("modulepreload")) return;
  const url = new URL(link.href, location.href);
  if (url.origin === location.origin && url.pathname.startsWith("/assets/")) return url.href;
}
