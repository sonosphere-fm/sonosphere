import { albumUrl, artistUrl, dec, tagUrl, trackUrl, userUrl } from "../shared/paths";
import { findItem } from "./catalog/repo";
import { requireAlbum, requireArtist, requireTag, requireTrack } from "./catalog/service";
import { listEvents } from "./events/repo";
import { HttpError } from "./http";
import { findJournal } from "./journals/repo";
import { SITE_URL } from "./mail";
import { findPlaylist } from "./playlists/repo";
import { findByName } from "./users/repo";
import { canSee } from "./users/service";

export const landing = {
  "/": [
    "Sonosphere - Track what you love",
    "Scrobble the music you play, explore your listening history, and discover artists through community charts and recommendations.",
  ],
  "/charts": ["Music Charts", "Explore the artists, albums, and tracks the Sonosphere community is listening to."],
  "/events": ["Concerts & Music Events", "Find upcoming concerts and festivals, browse lineups, and see who’s going."],
  "/help": [
    "Scrobbling Help",
    "Set up scrobbling to Sonosphere from Spotify, Pano Scrobbler, and other Last.fm-compatible players.",
  ],
  "/developers": [
    "Developer API Docs",
    "Build with the Sonosphere API. Find authentication, scrobbling, and Last.fm compatibility documentation.",
  ],
  "/terms": ["Terms of Service", "Read the terms for using Sonosphere."],
  "/privacy": [
    "Privacy Policy",
    "Learn what data Sonosphere collects and how it handles your account and listening history.",
  ],
  "/guidelines": ["Community Guidelines", "Read the guidelines for participating in the Sonosphere community."],
} as const;

const accountPages: Record<string, string> = {
  login: "Log In",
  join: "Join Sonosphere",
  forgot: "Recover Your Account",
  reset: "Reset Password",
  verify: "Verify Your Account",
  settings: "Settings",
  inbox: "Inbox",
  messages: "Messages",
  moderation: "Moderation",
  admin: "Moderation",
  recommended: "Recommendations",
  scrobble: "Scrobble Music",
  connect: "Connect a Music Player",
};
const artistTabs: Record<string, string> = {
  "+tracks": "Top Tracks",
  "+albums": "Albums",
  "+similar": "Similar Artists",
  "+wiki": "Biography",
  "+listeners": "Listeners",
  "+shoutbox": "Shoutbox",
  "+wall": "Shoutbox",
};
const userTabs: Record<string, string> = {
  library: "Music Library",
  "listening-report": "Listening Report",
  journal: "Journal",
  following: "Following",
  followers: "Followers",
  loved: "Loved Tracks",
  obsessions: "Obsessions",
  playlists: "Playlists",
  events: "Events",
  neighbours: "Neighbours",
  tags: "Tags",
  shoutbox: "Shoutbox",
};
const userAliases: Record<string, string> = { wall: "shoutbox", earworms: "obsessions", soundalikes: "neighbours" };
const own = (map: object, key: string) => Object.hasOwn(map, key);
const summary = (s: string) => Array.from(s.replace(/\s+/g, " ").trim()).slice(0, 180).join("");
const idOf = (s: string) => (/^\d+$/.test(s) && Number(s) > 0 && Number(s) <= 2147483647 ? Number(s) : 0);
export const absolute = (path: string) => `${SITE_URL}${path}`;
export const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

type Page = {
  title: string;
  description: string;
  path?: string;
  sharePath?: string;
  image?: string | null;
  artwork?: string;
  index?: boolean;
  status?: number;
  schema?: Record<string, unknown>;
};
const missing: Page = {
  title: "Page Not Found",
  description: "This page could not be found on Sonosphere.",
  status: 404,
};
const account = (title: string): Page => ({ title, description: "Log in to Sonosphere to use this feature." });
const musicGroup = (name: string) => ({ "@type": "MusicGroup", name, url: absolute(artistUrl(name)) });

async function lookup(url: URL): Promise<Page> {
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const key = path.toLowerCase() === "/music" ? "/charts" : path.toLowerCase();
  if (own(landing, key)) {
    const [title, description] = landing[key as keyof typeof landing];
    return {
      title,
      description,
      path: key,
      index: true,
      schema: key === "/" ? { "@type": "WebSite", name: "Sonosphere" } : undefined,
    };
  }
  if (key === "/search") {
    const query = summary(url.searchParams.get("q") || "");
    return {
      title: query ? `Search for ${query}` : "Search Music",
      description: "Search for artists, albums, tracks, and listeners on Sonosphere.",
      path: query ? `/search?${new URLSearchParams({ q: query })}` : "/search",
    };
  }
  const [, section, first = "", second = "", third = "", fourth = "", ...rest] = path.split("/");
  const family = section.toLowerCase();
  const tab = second.toLowerCase();
  const extra = third.toLowerCase();
  if (
    family === "admin" ||
    (own(accountPages, family) &&
      (!first ||
        (family === "settings" && !second) ||
        (family === "join" && first.toLowerCase() === "oauth" && !second) ||
        (family === "messages" && !third && (!second || ["to", "g"].includes(first.toLowerCase())))))
  )
    return account(accountPages[family]);
  if (key === "/events/add") return account("Add a Music Event");
  if (!first || rest.length) return missing;

  if (family === "music") {
    // React Router decodes each segment before the catalog's legacy plus decoding.
    const name = (segment: string) => dec(decodeURIComponent(segment));
    if (second === "_" && third && (!fourth || fourth.toLowerCase() === "+wiki")) {
      const t = await requireTrack(name(first), name(third));
      const album = t.albumId ? await findItem("album", t.albumId) : null;
      const image = album?.imageId ?? (await findItem("artist", t.artistId))?.imageId;
      return {
        title: `${t.title} by ${t.artist}${fourth ? " - Wiki" : ""}`,
        description: `Discover “${t.title}” by ${t.artist}${album ? ` from ${album.title}` : ""}. See listening stats, tags, and similar tracks.`,
        path: trackUrl(t.artist, t.title),
        index: !fourth,
        image,
        artwork: album?.imageId ? `Cover art for ${album.title}` : `Image of ${t.artist}`,
        schema: {
          "@type": "MusicRecording",
          name: t.title,
          byArtist: musicGroup(t.artist),
          ...(album && {
            inAlbum: { "@type": "MusicAlbum", name: album.title, url: absolute(albumUrl(t.artist, album.title)) },
          }),
        },
      };
    }
    const artistTab = own(artistTabs, tab) ? artistTabs[tab] : undefined;
    if (!second || (artistTab && !third)) {
      const a = await requireArtist(name(first));
      const bio = tab === "+wiki";
      return {
        title: artistTab ? `${a.name} - ${artistTab}` : `${a.name} - Music, Albums & Tracks`,
        description: artistTab
          ? `Explore ${artistTab.toLowerCase()} for ${a.name} on Sonosphere.`
          : `Explore ${a.name}’s top tracks, albums, similar artists, and listening stats on Sonosphere.`,
        path: artistUrl(a.name) + (artistTab && !bio ? (tab === "+wall" ? "/+shoutbox" : `/${tab}`) : ""),
        index: !artistTab,
        image: a.imageId,
        artwork: `Image of ${a.name}`,
        schema: musicGroup(a.name),
      };
    }
    if (!fourth && (!third || extra === "+wiki")) {
      const a = await requireAlbum(name(first), name(second));
      return {
        title: `${a.title} by ${a.artist}${third ? " - Wiki" : ""}`,
        description: `Explore ${a.title} by ${a.artist}, including its tracklist, listening stats, and community tags.`,
        path: albumUrl(a.artist, a.title),
        index: !third,
        image: a.imageId ?? (await findItem("artist", a.artistId))?.imageId,
        artwork: a.imageId ? `Cover art for ${a.title}` : `Image of ${a.artist}`,
        schema: { "@type": "MusicAlbum", name: a.title, byArtist: musicGroup(a.artist) },
      };
    }
  }
  if (family === "tag" && (!second || (tab === "+wiki" && !third))) {
    const tag = await requireTag(dec(decodeURIComponent(first)));
    return {
      title: `${tag.name} Music${second ? " - Wiki" : ""}`,
      description: `Discover artists, albums, and tracks tagged ${tag.name} by Sonosphere listeners.`,
      path: tagUrl(tag.name),
      index: !second,
    };
  }
  if (family === "event" && !second) {
    const id = idOf(first);
    const [event] = id ? await listEvents({ id }, undefined, "asc", 1) : [];
    if (!event) return missing;
    const place = [event.venue, event.city, event.country].filter(Boolean).join(", ");
    const performer = event.artists.find((artist) => artist.image);
    const starts = new Date(event.startsAt * 1000);
    return {
      title: event.title,
      description: summary(event.description) || `See the lineup and event details for ${event.title} at ${place}.`,
      path: `/event/${event.id}`,
      index: true,
      image: performer?.image,
      artwork: performer ? `Image of ${performer.name}` : undefined,
      schema: Number.isFinite(starts.getTime())
        ? {
            "@type": "Event",
            name: event.title,
            startDate: starts.toISOString(),
            performer: event.artists.map((artist) => musicGroup(artist.name)),
            location: {
              "@type": "Place",
              name: event.venue,
              address: { "@type": "PostalAddress", addressLocality: event.city, addressCountry: event.country },
            },
          }
        : undefined,
    };
  }
  if (family === "playlist" && !second) {
    const id = idOf(first);
    const playlist = id ? await findPlaylist(id) : null;
    if (!playlist) return missing;
    return {
      title: playlist.title,
      description: summary(playlist.description) || "Explore this community playlist on Sonosphere.",
      path: `/playlist/${playlist.id}`,
      index: true,
      schema: { "@type": "MusicPlaylist", name: playlist.title },
    };
  }
  if (family === "user") {
    const canonicalTab = own(userAliases, tab) ? userAliases[tab] : tab;
    const libraryArtist = canonicalTab === "library" && extra === "music" && !!fourth;
    const journalPost = canonicalTab === "journal" && !!idOf(third);
    if (
      canonicalTab === "journal" &&
      ((extra === "new" && !fourth) || (journalPost && fourth.toLowerCase() === "edit"))
    )
      return account("Edit Journal");
    if (
      second &&
      (!own(userTabs, canonicalTab) ||
        !(
          libraryArtist ||
          (!fourth && (!third || canonicalTab === "library" || canonicalTab === "listening-report" || journalPost))
        ))
    )
      return missing;
    const user = await findByName(decodeURIComponent(first));
    if (!user) return missing;
    if (user.suspended || !canSee(user, null))
      return { title: "Listener Profile", description: "View this listener’s profile on Sonosphere." };
    const base = userUrl(user.username);
    if (journalPost) {
      const post = await findJournal(idOf(third));
      if (!post || post.userId !== user.id) return missing;
      return {
        title: `${post.title} - ${user.username}’s Journal`,
        description: summary(post.body),
        path: `${base}/journal/${post.id}`,
        index: true,
      };
    }
    const subpage = second ? userTabs[canonicalTab] : "Listener Profile";
    const suffix = third
      ? libraryArtist
        ? `/music/${fourth}`
        : `/${encodeURIComponent(decodeURIComponent(third))}`
      : "";
    return {
      title: `${user.username} - ${subpage}`,
      description: `Explore ${user.username}’s ${second ? subpage.toLowerCase() : "listening activity and music library"} on Sonosphere.`,
      path: second ? `${base}/${canonicalTab}${suffix}` : base,
      index: !second,
      image: user.imageId,
      artwork: `${user.username}’s profile picture`,
    };
  }
  return missing;
}

export async function pageSeo(url: URL): Promise<Page> {
  try {
    const page = await lookup(url);
    if (!page.index && page.path && /\/\+wiki\/*$/i.test(url.pathname)) page.sharePath = `${page.path}/+wiki`;
    return page;
  } catch (error) {
    if (error instanceof URIError || (error instanceof HttpError && error.status === 404)) return missing;
    console.error("Could not resolve page metadata", error);
    return { title: "Sonosphere", description: landing["/"][1] };
  }
}

const titleOf = (page: Page) => (page.title.startsWith("Sonosphere") ? page.title : `${page.title} | Sonosphere`);
export function seoHead(page: Page): string {
  const title = titleOf(page);
  const description = summary(page.description);
  const url = page.path ? absolute(page.path) : undefined;
  const customImage = page.image && /^[a-f0-9]{32}$/.test(page.image);
  const image = absolute(customImage ? `/api/image/${page.image}` : "/assets/social-card.png");
  const alt = customImage ? page.artwork || page.title : "Sonosphere - Track what you love";
  const og = {
    title,
    description,
    type: "website",
    site_name: "Sonosphere",
    locale: "en_US",
    url: page.sharePath ? absolute(page.sharePath) : url,
    image,
    "image:alt": alt,
    ...(!customImage && { "image:type": "image/png", "image:width": "1200", "image:height": "630" }),
  };
  const twitter = {
    card: customImage ? "summary" : "summary_large_image",
    title,
    description,
    image,
    "image:alt": alt,
  };
  const meta = (attr: "name" | "property", name: string, content: string) =>
    `<meta ${attr}="${name}" content="${escape(content)}" data-seo>`;
  return [
    `<title>${escape(title)}</title>`,
    meta("name", "description", description),
    meta("name", "robots", page.index ? "index, follow, max-image-preview:large" : "noindex, follow"),
    url && `<link rel="canonical" href="${escape(url)}" data-seo>`,
    ...Object.entries(og).flatMap(([key, value]) => (value ? [meta("property", `og:${key}`, value)] : [])),
    ...Object.entries(twitter).map(([key, value]) => meta("name", `twitter:${key}`, value)),
    page.index &&
      page.schema &&
      `<script type="application/ld+json" data-seo>${JSON.stringify({ "@context": "https://schema.org", ...page.schema, url, description, ...(customImage && { image }) }).replace(/</g, "\\u003c")}</script>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function seoContent(page: Page): string {
  if (!page.index) return "";
  const links = [
    ["/", "Sonosphere"],
    ["/charts", "Music charts"],
    ["/events", "Concerts and events"],
    ["/developers", "Developer API"],
  ];
  return `<main class="wrap"><h1>${escape(page.title)}</h1><p>${escape(page.description)}</p><nav aria-label="Explore Sonosphere">${links.map(([path, name]) => `<p><a href="${path}">${name}</a></p>`).join("")}</nav></main>`;
}
