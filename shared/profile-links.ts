const SITES = {
  bandcamp: ["bandcamp.com"],
  discord: ["discord.gg", "discord.com"],
  spotify: ["spotify.com", "spotify.link"],
  lastfm: ["last.fm"],
  soundcloud: ["soundcloud.com"],
  youtube: ["youtube.com", "youtu.be"],
  apple: ["apple.com"],
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  twitch: ["twitch.tv"],
  github: ["github.com"],
  linktree: ["linktr.ee"],
  x: ["x.com", "twitter.com"],
  bluesky: ["bsky.app"],
};
export type ProfileLinkIcon = keyof typeof SITES | "link";
export type ProfileLink = { label: string; url: string };

export function profileLinkIcon(url: string): ProfileLinkIcon {
  const host = URL.parse(url)?.hostname.toLowerCase() ?? "";
  for (const [icon, domains] of Object.entries(SITES)) {
    if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return icon as ProfileLinkIcon;
  }
  return "link";
}

export function profileLinks(value: unknown): ProfileLink[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const links: ProfileLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.label !== "string" || typeof item.url !== "string")
      return null;
    const label = item.label.trim();
    const url = item.url.trim();
    if (label.length > 60 || url.length > 500) return null;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    } catch {
      return null;
    }
    links.push({ label, url });
  }
  return links;
}

export function storedProfileLinks(value: string): ProfileLink[] {
  try {
    return profileLinks(JSON.parse(value)) ?? [];
  } catch {
    return [];
  }
}
