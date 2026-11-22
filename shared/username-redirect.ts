import { userUrl } from "./paths";

export function usernameRedirect(url: URL, current: string): string | null {
  const match = /^\/user\/([^/]+)(\/.*)?$/.exec(url.pathname);
  if (!match) return null;
  let previous: string;
  try {
    previous = decodeURIComponent(match[1]!);
  } catch {
    return null;
  }
  if (previous === current) return null;
  return userUrl(current) + (match[2] ?? "") + url.search + url.hash;
}
