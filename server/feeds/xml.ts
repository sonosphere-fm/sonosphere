export type FeedItem = { id: string; title: string; link: string; description: string; published?: number };
export type Feed = { title: string; link: string; self: string; description: string; items: FeedItem[] };

export const xml = (value: string) =>
  value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

export function rss(feed: Feed): string {
  const items = feed.items
    .map(
      (item) => `<item>
<title>${xml(item.title)}</title><link>${xml(item.link)}</link>
<guid isPermaLink="false">${xml(item.id)}</guid>
<description>${xml(xml(item.description))}</description>
${item.published === undefined ? "" : `<pubDate>${new Date(item.published * 1000).toUTCString()}</pubDate>`}
</item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel>
<title>${xml(feed.title)}</title><link>${xml(feed.link)}</link><description>${xml(feed.description)}</description>
<atom:link href="${xml(feed.self)}" rel="self" type="application/rss+xml"/>
<ttl>5</ttl>${items}</channel></rss>`;
}
