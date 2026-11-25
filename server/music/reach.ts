import { fail } from "../http";
import { checkHost } from "./url";

/** Refuses addresses the site is not allowed to call, before any credentials go to them. */
export async function requireReachable(url: string): Promise<void> {
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return fail(400, "invalidMusicServerUrl");
  }
  const state = await checkHost(host);
  if (state === "private") return fail(400, "musicServerPrivateAddress");
  if (state === "unreachable") return fail(502, "musicServerUnreachable");
}
