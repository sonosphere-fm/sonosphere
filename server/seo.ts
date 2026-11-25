import en from "../shared/i18n/en";
import { type Block, catalogText, docPages, interpolate, isNested, type Item, type Span } from "../shared/docs";
import { albumUrl, artistUrl, dec, tagUrl, trackUrl, userUrl } from "../shared/paths";
import {
  ARTIST_TABS,
  artistTitle,
  fullTitle,
  journalTitle,
  releaseTitle,
  searchTitle,
  tagTitle,
  TITLES,
  USER_TABS,
  userTitle,
} from "../shared/titles";
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
    TITLES.guestHome,
    "Scrobble the music you play, explore your listening history, and discover artists through community charts and recommendations.",
  ],
  "/charts": [TITLES.charts, "Explore the artists, albums, and tracks the Sonosphere community is listening to."],
  "/charts/maker": [TITLES.chartMaker, "Make an album or artist chart from your Sonosphere listening history."],
  "/events": [TITLES.events, "Find upcoming concerts and festivals, browse lineups, and see who’s going."],
  "/help": [
    TITLES.help,
    "Set up scrobbling to Sonosphere from Spotify, Pano Scrobbler, and other Last.fm-compatible players.",
  ],
  "/developers": [
    TITLES.developers,
    "Build with the Sonosphere API. Find authentication, scrobbling, and Last.fm compatibility documentation.",
  ],
  "/terms": [TITLES.terms, "Read the terms for using Sonosphere."],
  "/changelog": [TITLES.changelog, "Read about the latest updates and fixes to Sonosphere."],
  "/privacy": [
    TITLES.privacy,
    "Learn what data Sonosphere collects and how it handles your account and listening history.",
  ],
  "/guidelines": [TITLES.guidelines, "Read the guidelines for participating in the Sonosphere community."],
} as const;

const accountPages: Record<string, string> = {
  login: TITLES.login,
  join: TITLES.join,
  forgot: TITLES.forgot,
  reset: TITLES.reset,
  verify: TITLES.verify,
  settings: TITLES.settings,
  inbox: TITLES.inbox,
  messages: TITLES.messages,
  moderation: TITLES.moderation,
  admin: TITLES.moderation,
  recommended: TITLES.recommended,
  scrobble: TITLES.scrobble,
  import: TITLES.import,
  connect: TITLES.connect,
  welcome: TITLES.welcome,
};
const artistTabs: Record<string, string> = {
  "+tracks": "tracks",
  "+albums": "albums",
  "+similar": "similar",
  "+images": "images",
  "+wiki": "wiki",
  "+listeners": "listeners",
  "+shoutbox": "shoutbox",
  "+wall": "shoutbox",
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
  title: TITLES.notFound,
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
      title: searchTitle(query),
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
  if (key === "/events/add") return account(TITLES.addEvent);
  if (!first || rest.length) return missing;

  if (family === "music") {
    // React Router decodes each segment before the catalog's legacy plus decoding.
    const name = (segment: string) => dec(decodeURIComponent(segment));
    if (second === "_" && third && (!fourth || fourth.toLowerCase() === "+wiki")) {
      const t = await requireTrack(name(first), name(third));
      const album = t.albumId ? await findItem("album", t.albumId) : null;
      const image = album?.imageId ?? (await findItem("artist", t.artistId))?.imageId;
      return {
        title: releaseTitle(t.title, t.artist, !!fourth),
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
    const artistPhoto = artistTab === "images" && !!third && !fourth;
    if (!second || (artistTab && !third) || artistPhoto) {
      const a = await requireArtist(name(first));
      const bio = tab === "+wiki";
      return {
        title: artistTitle(a.name, artistTab),
        description: artistTab
          ? `Explore ${ARTIST_TABS[artistTab]!.toLowerCase()} for ${a.name} on Sonosphere.`
          : `Explore ${a.name}’s top tracks, albums, similar artists, and listening stats on Sonosphere.`,
        path: artistPhoto
          ? `${artistUrl(a.name)}/+images/${third}`
          : artistUrl(a.name) + (artistTab && !bio ? (tab === "+wall" ? "/+shoutbox" : `/${tab}`) : ""),
        index: !artistTab,
        image: a.imageId,
        artwork: `Image of ${a.name}`,
        schema: musicGroup(a.name),
      };
    }
    const albumPhoto = extra === "+images" && !!fourth;
    if ((!fourth && (!third || extra === "+wiki" || extra === "+images")) || (albumPhoto && !rest.length)) {
      const a = await requireAlbum(name(first), name(second));
      return {
        title: releaseTitle(a.title, a.artist, extra === "+wiki"),
        description: `Explore ${a.title} by ${a.artist}, including its tracklist, listening stats, and community tags.`,
        path: albumPhoto ? `${albumUrl(a.artist, a.title)}/+images/${fourth}` : albumUrl(a.artist, a.title),
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
      title: tagTitle(tag.name, !!second),
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
      return account(TITLES.editJournal);
    if (
      second &&
      (!own(USER_TABS, canonicalTab) ||
        !(
          libraryArtist ||
          (!fourth && (!third || canonicalTab === "library" || canonicalTab === "listening-report" || journalPost))
        ))
    )
      return missing;
    const user = await findByName(decodeURIComponent(first));
    if (!user || user.banned) return missing;
    if (user.suspended || !canSee(user, null))
      return { title: TITLES.profile, description: "View this listener’s profile on Sonosphere." };
    const base = userUrl(user.username);
    if (journalPost) {
      const post = await findJournal(idOf(third));
      if (!post || post.userId !== user.id) return missing;
      return {
        title: journalTitle(post.title, user.username),
        description: summary(post.body),
        path: `${base}/journal/${post.id}`,
        index: true,
      };
    }
    const subpage = second ? USER_TABS[canonicalTab]! : TITLES.profile;
    const suffix = third
      ? libraryArtist
        ? `/music/${fourth}`
        : `/${encodeURIComponent(decodeURIComponent(third))}`
      : "";
    return {
      title: userTitle(user.username, second ? canonicalTab : ""),
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

export function seoHead(page: Page): string {
  const title = fullTitle(page.title);
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
    docPage(page) && `<link rel="alternate" type="text/markdown" href="${escape(`${url}.md`)}" data-seo>`,
    ...Object.entries(og).flatMap(([key, value]) => (value ? [meta("property", `og:${key}`, value)] : [])),
    ...Object.entries(twitter).map(([key, value]) => meta("name", `twitter:${key}`, value)),
    page.index &&
      page.schema &&
      `<script type="application/ld+json" data-seo>${JSON.stringify({ "@context": "https://schema.org", ...page.schema, url, description, ...(customImage && { image }) }).replace(/</g, "\\u003c")}</script>`,
  ]
    .filter(Boolean)
    .join("\n");
}

const docPage = (page: Page) => docPages(SITE_URL).find((doc) => doc.path === page.path);
const english = catalogText("en", en);

function inlineHtml(span: Span): string {
  if (typeof span === "string") return escape(span);
  if (Array.isArray(span)) return span.map(inlineHtml).join("");
  if ("t" in span) return inlineHtml(interpolate(english(span.t), span.with));
  if ("code" in span) return `<code>${escape(span.code)}</code>`;
  if ("b" in span) return `<b>${inlineHtml(span.b)}</b>`;
  if ("to" in span) return `<a href="${escape(span.to)}">${inlineHtml(span.label)}</a>`;
  if ("href" in span) return `<a href="${escape(span.href)}">${inlineHtml(span.label)}</a>`;
  return " &gt; ";
}

function itemHtml(item: Item): string {
  if (!isNested(item)) return `<li>${inlineHtml(item)}</li>`;
  return `<li>${inlineHtml(item.text)}<ul>${item.list.map(itemHtml).join("")}</ul></li>`;
}

function blockHtml(block: Block): string {
  if ("h2" in block) return `<h2${block.id ? ` id="${block.id}"` : ""}>${inlineHtml(block.h2)}</h2>`;
  if ("p" in block) return `<p>${inlineHtml(block.p)}</p>`;
  if ("pre" in block) return `<pre><code>${escape(block.pre)}</code></pre>`;
  if ("ul" in block) return `<ul>${block.ul.map(itemHtml).join("")}</ul>`;
  return `<ol>${block.ol.map(itemHtml).join("")}</ol>`;
}

export function seoContent(page: Page): string {
  if (!page.index) return "";
  const doc = docPage(page);
  if (doc) {
    const blocks = [...doc.body, ...doc.reference].map(blockHtml).join("");
    const markdown = `<p><a href="${doc.path}.md" type="text/markdown">Markdown version</a></p>`;
    return `<main class="seo-content"><article><h1>${escape(english(doc.title))}</h1>${blocks}${markdown}</article></main>`;
  }
  const links = [
    ["/", "Sonosphere"],
    ["/charts", "Music charts"],
    ["/events", "Concerts and events"],
    ["/developers", "Developer API"],
  ];
  return `<main class="seo-content"><h1>${escape(page.title)}</h1><p>${escape(page.description)}</p><nav aria-label="Explore Sonosphere">${links.map(([path, name]) => `<p><a href="${path}">${name}</a></p>`).join("")}</nav></main>`;
}
