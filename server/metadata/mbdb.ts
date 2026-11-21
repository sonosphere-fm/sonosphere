import postgres from "postgres";
import type { ListedTrack, MbAlbum, MbArtist, MbTrack } from "./sources";

const url = process.env.MBDB_URL || "";
const g = globalThis as { __spinMbdb?: postgres.Sql };
const sql = url ? (g.__spinMbdb ??= postgres(url, { max: 4, idle_timeout: 120, connect_timeout: 5, prepare: false })) : null;

export const mbdbOn = !!sql;
const db = () => {
  if (!sql) throw new Error("MBDB_URL is not set");
  return sql;
};

// MusicBrainz spells with typographic hyphens and quotes ("Don’t", "Anti‐Hero"), scrobbles don't
const tidy = (v: string | null) =>
  (v ?? "")
    .replace(/[‐‑]/g, "-")
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...");

export async function artist(name: string): Promise<MbArtist | null> {
  // the name itself before an alias, then whoever has put out more
  const [r] = await db()<{ mbid: string; name: string; alias: string | null }[]>`
    WITH hits AS (SELECT id, 1.0 AS w, NULL::text AS alias FROM artist WHERE key = mbkey(${name}) AND mbkey(${name}) <> ''
                  UNION ALL SELECT artist, 0.25, name FROM artist_alias WHERE key = mbkey(${name}) AND mbkey(${name}) <> '')
    SELECT a.gid::text AS mbid, a.name, (array_agg(h.alias) FILTER (WHERE h.alias IS NOT NULL))[1] AS alias
    FROM hits h JOIN artist a ON a.id = h.id LEFT JOIN artist_rgs n ON n.artist = a.id
    GROUP BY a.id, a.gid, a.name, n.n
    ORDER BY max(h.w) * (coalesce(n.n, 0) + 1) DESC, max(h.w) DESC, a.id LIMIT 1`;
  return r ? { mbid: r.mbid, name: tidy(shownName(r.name, r.alias, name)) } : null;
}

const latin = (s: string) => /[a-z]/i.test(s);
// their own name, unless it's in a script the search wasn't (青葉市子 found by typing "ichiko aoba"): then the alias that matched
const shownName = (name: string, alias: string | null, typed: string) => (alias && latin(typed) && !latin(name) ? alias : name);

export type ArtistHit = { mbid: string; name: string; key: string; exact: boolean; viaAlias: boolean; releases: number; spotify: boolean };

/** Up to 60 prefix matches, best known first, for server/search/rank.ts to rerank. */
export async function searchArtists(term: string): Promise<ArtistHit[]> {
  // mbkey() leaves only letters, digits and spaces, so nothing in it is a LIKE wildcard; artist_top lets a
  // two-letter search still find the best known among thousands of names
  type Row = { id: number; mbid: string; name: string; key: string; alias: string | null; akey: string | null; releases: number; spotify: boolean; k: string };
  const rows = await db()<Row[]>`
    WITH hits AS (
      (SELECT id, NULL::text AS alias, NULL::text AS akey FROM artist_top WHERE key LIKE mbkey(${term}) || '%' AND length(mbkey(${term})) >= 2 ORDER BY n DESC LIMIT 150)
      UNION ALL
      (SELECT id, NULL, NULL FROM artist WHERE key LIKE mbkey(${term}) || '%' AND length(mbkey(${term})) >= 2 LIMIT 300)
      UNION ALL
      (SELECT artist, name, key FROM artist_alias WHERE key LIKE mbkey(${term}) || '%' AND length(mbkey(${term})) >= 2 LIMIT 200))
    SELECT DISTINCT ON (a.id) a.id, a.gid::text AS mbid, a.name, a.key, h.alias, h.akey, coalesce(n.n, 0) AS releases,
      EXISTS (SELECT 1 FROM artist_spotify s WHERE s.artist = a.id) AS spotify, mbkey(${term}) AS k
    FROM hits h JOIN artist a ON a.id = h.id LEFT JOIN artist_rgs n ON n.artist = a.id
    ORDER BY a.id, (h.alias IS NULL) DESC, (h.akey = mbkey(${term})) DESC`;
  const k = rows[0]?.k ?? "";
  return rows
    .sort((x, y) => y.releases - x.releases)
    .slice(0, 60)
    .map(r => {
      const viaAlias = !r.key.startsWith(k);
      const name = tidy(shownName(r.name, viaAlias || !latin(r.name) ? r.alias : null, term));
      const matchedKey = viaAlias ? r.akey : r.key;
      return {
        mbid: r.mbid,
        name,
        key: matchedKey ?? r.key,
        exact: matchedKey === k,
        viaAlias,
        releases: r.releases,
        spotify: r.spotify,
      };
    });
}

export type TitleHit = { title: string; artist: string; n: number; seconds: number };

// Exact titles always come back; a prefix of three letters or more adds the best known of a few thousand others.
const titleHits = (table: string, term: string) => db()`
  (SELECT id, n FROM ${db()(table)} WHERE key = mbkey(${term}) ORDER BY n DESC LIMIT 40)
  UNION
  (SELECT id, n FROM (SELECT id, n FROM ${db()(table)} WHERE key LIKE mbkey(${term}) || '%' AND length(mbkey(${term})) >= 3 LIMIT 3000) p
    ORDER BY n DESC LIMIT 40)`;

/** Songs titled like the search, each once per artist, with how many releases carry them. */
export async function searchTracks(term: string): Promise<TitleHit[]> {
  const rows = await db()<{ title: string; artist: string; n: number; length: number | null }[]>`
    WITH hits AS (${titleHits("recording_top", term)})
    SELECT r.name AS title, a.name AS artist, h.n, r.length
    FROM hits h JOIN recording r ON r.id = h.id
    JOIN artist_credit_name acn ON acn.artist_credit = r.artist_credit AND acn.position = 0
    JOIN artist a ON a.id = acn.artist
    ORDER BY h.n DESC`;
  return rows.map(r => ({ title: tidy(r.title), artist: tidy(r.artist), n: r.n, seconds: Math.round((r.length ?? 0) / 1000) }));
}

/** Albums, EPs and singles titled like the search, with how many releases each has had. */
export async function searchAlbums(term: string): Promise<TitleHit[]> {
  const rows = await db()<{ title: string; artist: string; n: number }[]>`
    WITH hits AS (
      (SELECT id FROM release_group WHERE key = mbkey(${term}) LIMIT 300)
      UNION
      (SELECT id FROM release_group WHERE key LIKE mbkey(${term}) || '%' AND length(mbkey(${term})) >= 3 LIMIT 3000))
    SELECT rg.name AS title, a.name AS artist, coalesce(m.release_count, 0) AS n
    FROM hits h JOIN release_group rg ON rg.id = h.id
    JOIN rg_type t ON t.id = rg.type AND t.name IN ('Album', 'EP', 'Single')
    JOIN artist_credit_name acn ON acn.artist_credit = rg.artist_credit AND acn.position = 0
    JOIN artist a ON a.id = acn.artist
    LEFT JOIN release_group_meta m ON m.id = rg.id
    ORDER BY rg.key = mbkey(${term}) DESC, n DESC
    LIMIT 60`;
  return rows.map(r => ({ title: tidy(r.title), artist: tidy(r.artist), n: r.n, seconds: 0 }));
}

export async function spotifyId(mbid: string): Promise<string | null> {
  const [r] = await db()`SELECT s.spotify FROM artist a JOIN artist_spotify s ON s.artist = a.id WHERE a.gid = ${mbid}::uuid LIMIT 1`;
  return r?.spotify ?? null;
}

// "plain": an album, EP or single that isn't a compilation, live recording, remix and the like, with an official release
const ALBUM = `
  SELECT rg.gid::text AS mbid, rg.name AS title, acn.name AS artist, m.date, coalesce(t.name, '') AS type,
    coalesce(t.name IN ('Album', 'EP', 'Single'), false) AND NOT EXISTS (SELECT 1 FROM rg_secondary s WHERE s.release_group = rg.id)
      AND EXISTS (SELECT 1 FROM release r JOIN release_status st ON st.id = r.status AND st.name = 'Official' WHERE r.release_group = rg.id) AS plain,
    coalesce(m.release_count, 0) AS releases
  FROM release_group rg
  JOIN artist_credit_name acn ON acn.artist_credit = rg.artist_credit AND acn.position = 0
  LEFT JOIN release_group_meta m ON m.id = rg.id
  LEFT JOIN rg_type t ON t.id = rg.type`;
type AlbumRow = { mbid: string; title: string; artist: string; date: string | null; type: string; plain: boolean; releases: number };
const albumOf = (r: AlbumRow): MbAlbum => ({
  mbid: r.mbid,
  title: tidy(r.title),
  artist: tidy(r.artist),
  date: r.date,
  type: r.type,
});

// MusicBrainz files "Song (feat. Someone)" as "Song", with the guest in the credits
const unfeat = (title: string) =>
  title
    .replace(/\s*[([]\s*(feat\.?|ft\.?|featuring|with)\s[^)\]]*[)\]]\s*$/i, "")
    .replace(/\s+(feat\.?|ft\.?|featuring)\s.*$/i, "")
    .trim();

async function orUnfeat<T>(title: string, find: (title: string) => Promise<T | null>): Promise<T | null> {
  const r = await find(title);
  const bare = unfeat(title);
  return r ?? (bare && bare !== title ? find(bare) : null);
}

export const album = (artistName: string, title: string) => orUnfeat(title, t => albumAs(artistName, t));
async function albumAs(artistName: string, title: string): Promise<MbAlbum | null> {
  const rows = await db().unsafe<AlbumRow[]>(`${ALBUM}
    JOIN artist a ON a.id = acn.artist
    WHERE rg.key = mbkey($2) AND mbkey($2) <> '' AND (a.key = mbkey($1) OR mbkey(acn.name) = mbkey($1))
    ORDER BY plain DESC, (t.name = 'Album') DESC, releases DESC, m.date NULLS LAST LIMIT 1`, [artistName, title]);
  return rows[0] ? albumOf(rows[0]) : null;
}

export async function releaseGroupOf(releaseMbid: string): Promise<string | null> {
  const [r] = await db()<{ gid: string }[]>`
    SELECT rg.gid::text AS gid FROM release r JOIN release_group rg ON rg.id = r.release_group WHERE r.gid = ${releaseMbid}::uuid`;
  return r?.gid ?? null;
}

/** Albums and EPs, oldest first. */
export async function discography(mbid: string): Promise<MbAlbum[]> {
  const rows = await db().unsafe<AlbumRow[]>(`SELECT * FROM (${ALBUM}
    JOIN artist a ON a.id = acn.artist
    WHERE a.gid = $1::uuid AND t.name IN ('Album', 'EP')) x
    WHERE plain ORDER BY date NULLS LAST, title LIMIT 150`, [mbid]);
  return rows.map(albumOf).filter(a => a.title);
}

export const track = (artistName: string, title: string) => orUnfeat(title, t => trackAs(artistName, t));
async function trackAs(artistName: string, title: string): Promise<MbTrack | null> {
  type Rec = { id: number; name: string; length: number | null; comment: string; video: boolean; artist: string };
  const recs = await db()<Rec[]>`
    WITH k AS (SELECT mbkey(${artistName}) AS a, mbkey(${title}) AS t),
    who AS (SELECT id FROM artist, k WHERE key = k.a UNION SELECT artist FROM artist_alias, k WHERE key = k.a),
    credits AS (SELECT DISTINCT artist_credit FROM artist_credit_name WHERE position = 0 AND artist IN (SELECT id FROM who))
    SELECT r.id, r.name, r.length, coalesce(r.comment, '') AS comment, coalesce(r.video, false) AS video, acn.name AS artist
    FROM recording r CROSS JOIN k JOIN artist_credit_name acn ON acn.artist_credit = r.artist_credit AND acn.position = 0
    WHERE k.a <> '' AND k.t <> '' AND r.artist_credit IN (SELECT artist_credit FROM credits) AND r.key = k.t
    ORDER BY r.id LIMIT 1500`;
  if (!recs.length) return null;
  // live takes, remixes and the like carry a note ("live, 1994"); the original may too ("explicit", "clean")
  const studio = recs.filter(r => !r.video && !VARIANT.test(r.comment));
  type Appearance = { recording: number; mbid: string; title: string; type: string; date: string | null };
  const found = studio.length ? await db()<Appearance[]>`
    SELECT t.recording, rg.gid::text AS mbid, rg.name AS title, pt.name AS type, w.date
    FROM track t JOIN medium md ON md.id = t.medium JOIN release rl ON rl.id = md.release
    JOIN release_status st ON st.id = rl.status AND st.name = 'Official'
    JOIN release_group rg ON rg.id = rl.release_group JOIN rg_type pt ON pt.id = rg.type AND pt.name IN ('Album', 'EP', 'Single')
    LEFT JOIN release_when w ON w.release = rl.id
    WHERE t.recording IN ${db()(studio.map(r => r.id))}
      AND NOT EXISTS (SELECT 1 FROM rg_secondary s WHERE s.release_group = rg.id)` : [];
  // on official albums, EPs and singles: the first album it came out on, else the first EP, else the single; an
  // album only counts within two years of the song's first release (not a budget collection decades later)
  const rank = (type: string) => (type === "Album" ? 0 : type === "EP" ? 1 : 2);
  const dated = found.filter(f => f.date).map(f => ({ ...f, year: Number(f.date!.slice(0, 4)) }));
  const firstYear = Math.min(...dated.map(f => f.year));
  let best: (typeof dated)[number] | null = null;
  for (const f of dated) {
    if (rank(f.type) < 2 && f.year > firstYear + 2) continue;
    const better = !best || rank(f.type) < rank(best.type) || (rank(f.type) === rank(best.type) && f.date! < best.date!);
    if (better) best = f;
  }
  const rec = (best && studio.find(r => r.id === best.recording)) ?? studio[0] ?? recs[0]!;
  const seconds = Math.round((rec.length || studio.map(r => r.length || 0).find(n => n > 0) || 0) / 1000);
  const name = tidy(rec.artist);
  const album = best ? { mbid: best.mbid, title: tidy(best.title), artist: name, date: best.date, type: best.type } : null;
  return { title: tidy(rec.name), artist: name, seconds, album };
}

const VARIANT = /\b(live|demo|remix|mix|edit|acoustic|instrumental|karaoke|a ?cappella|unplugged|session|rehearsal|reprise|alternate|alt|take|cover|dub|sped|slowed|nightcore|orchestral|piano)\b/i;

/** The first official release's tracks, video discs left out. */
export async function trackList(rgid: string): Promise<ListedTrack[]> {
  const [rel] = await db()`
    SELECT rl.id FROM release_group rg JOIN release rl ON rl.release_group = rg.id
    JOIN release_status st ON st.id = rl.status AND st.name = 'Official'
    LEFT JOIN release_when w ON w.release = rl.id
    WHERE rg.gid = ${rgid}::uuid AND EXISTS (SELECT 1 FROM medium md JOIN track t ON t.medium = md.id WHERE md.release = rl.id)
    ORDER BY coalesce(w.date, '9999'), coalesce(w.pref, 2), rl.id LIMIT 1`;
  if (!rel) return [];
  const rows = await db()<{ name: string; length: number | null }[]>`
    SELECT t.name, coalesce(t.length, r.length) AS length
    FROM medium md LEFT JOIN medium_format f ON f.id = md.format JOIN track t ON t.medium = md.id JOIN recording r ON r.id = t.recording
    WHERE md.release = ${rel.id} AND coalesce(f.name, '') !~* 'dvd|blu-ray|video'
    ORDER BY md.position, t.position LIMIT 100`;
  return rows
    .map(r => ({ title: tidy(r.name), seconds: Math.round((r.length || 0) / 1000) }))
    .filter(t => t.title);
}

/** Lineup is headliners first. */
export type MbEvent = {
  gid: string;
  name: string;
  date: string;
  time: string | null;
  festival: boolean;
  venue: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lon: number | null;
  lineup: { mbid: string; name: string }[];
};

/** Concerts and festivals not called off, optionally only those with one of `onlyArtists` (MusicBrainz ids) playing. */
export async function events(from: string, to: string, onlyArtists?: string[]): Promise<MbEvent[]> {
  const byArtist = onlyArtists
    ? db()`AND e.id IN (SELECT x.event FROM event_artist_x x JOIN artist a ON a.id = x.artist WHERE a.gid = ANY(${onlyArtists}::uuid[]))`
    : db()``;
  const rows = await db()<(Omit<MbEvent, "lineup"> & { lineup: MbEvent["lineup"] | null })[]>`
    SELECT e.gid::text AS gid, e.name, e.date, e.time, e.type = 2 AS festival, e.venue, e.city, e.country, e.lat, e.lon,
      (SELECT json_agg(json_build_object('mbid', a.gid::text, 'name', a.name) ORDER BY x.role, x.ord, a.name)
       FROM event_artist_x x JOIN artist a ON a.id = x.artist WHERE x.event = e.id) AS lineup
    FROM event_x e
    WHERE e.date BETWEEN ${from} AND ${to} AND e.type IN (1, 2) AND NOT e.cancelled
      ${byArtist}`;
  return rows.map(r => ({
    ...r,
    name: tidy(r.name),
    venue: r.venue && tidy(r.venue),
    lineup: (r.lineup ?? []).map(a => ({ mbid: a.mbid, name: tidy(a.name) })),
  }));
}
