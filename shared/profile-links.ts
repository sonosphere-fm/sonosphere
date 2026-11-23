export const PROFILE_LINK_ICONS = [
  ["link", "Link"],
  ["globe", "Website"],
  ["bandcamp", "Bandcamp"],
  ["discord", "Discord"],
  ["spotify", "Spotify"],
  ["lastfm", "Last.fm"],
  ["soundcloud", "SoundCloud"],
  ["youtube", "YouTube"],
  ["apple", "Apple Music"],
  ["instagram", "Instagram"],
  ["tiktok", "TikTok"],
  ["twitch", "Twitch"],
  ["github", "GitHub"],
  ["linktree", "Linktree"],
  ["music", "Music"],
  ["heart", "Heart"],
  ["star", "Star"],
] as const;
export type ProfileLinkIcon = (typeof PROFILE_LINK_ICONS)[number][0];
export type ProfileLink = { label: string; url: string; icon?: ProfileLinkIcon };

export function profileLinks(value: unknown): ProfileLink[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const links: ProfileLink[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || typeof item.label !== "string" || typeof item.url !== "string")
      return null;
    const label = item.label.trim();
    const url = item.url.trim();
    const icon = "icon" in item ? item.icon : "link";
    if (!PROFILE_LINK_ICONS.some(([id]) => id === icon)) return null;
    if (label.length > 60 || url.length > 500) return null;
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) return null;
    } catch {
      return null;
    }
    links.push({ label, url, icon: icon as ProfileLinkIcon });
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
