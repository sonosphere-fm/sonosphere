export type ProfileLink = { label: string; url: string };

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
