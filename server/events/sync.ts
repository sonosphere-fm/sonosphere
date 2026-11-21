// Events from elsewhere, kept in step with the events table beside the ones people add here:
// - MusicBrainz (our copy, server/metadata/mbdb.ts): every concert and festival in the next 18 months, and those of the
//   past year with an artist we know on the bill. Once a day.
// - Ticketmaster (TICKETMASTER_KEY, optional): the upcoming shows of the artists played most here, one artist every
//   20 seconds (its free tier allows 5000 calls a day), each artist again after three days.
// Spotify's API has no concert listings, so there is nothing to pull from it.
import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { getOrCreateArtistTx } from "../catalog/repo";
import { db, transact, type Tx } from "../db/client";
import { artists, eventArtists, events, userArtists } from "../db/schema";
import { exclusive, getJson, setJson } from "../kv";
import * as mbdb from "../metadata/mbdb";
import { want } from "../metadata/wanted";
import { looseKey } from "../search/rank";
import { clean, now } from "../util";

type Act = { name: string; mbid?: string };
type Found = { source: "musicbrainz" | "ticketmaster"; sourceId: string; title: string; venue: string; city: string; country: string;
  startsAt: number; url: string; lat: number | null; lon: number | null; lineup: Act[] };

const countryName = (() => {
  const names = new Intl.DisplayNames(["en"], { type: "region" });
  return (code: string | null | undefined) => { if (!code) return ""; try { return names.of(code.toUpperCase()) ?? code; } catch { return code; } };
})();

/** An artist on a bill: the one we have with that MusicBrainz id, else by name (added if new, with the id noted). */
async function actTx(tx: Tx, a: Act): Promise<number> {
  if (a.mbid) {
    const [hit] = await tx.select({ id: artists.id }).from(artists).where(eq(artists.mbid, a.mbid)).limit(1);
    if (hit) return hit.id;
  }
  const id = await getOrCreateArtistTx(tx, a.name);
  if (a.mbid) await tx.update(artists).set({ mbid: a.mbid }).where(and(eq(artists.id, id), isNull(artists.mbid)));
  return id;
}

/** Adds or updates one event from elsewhere, with its line-up. Returns the artists on it. */
async function upsert(e: Found): Promise<number[]> {
  return transact(async tx => {
    const row = { title: clean(e.title, 200) || "Untitled event", venue: clean(e.venue, 120), city: clean(e.city, 80), country: clean(e.country, 80),
      startsAt: e.startsAt, url: e.url, lat: e.lat, lon: e.lon };
    const [{ id }] = await tx.insert(events).values({ ...row, source: e.source, sourceId: e.sourceId, createdAt: now() })
      .onConflictDoUpdate({ target: [events.source, events.sourceId], set: row }).returning({ id: events.id });
    await tx.delete(eventArtists).where(eq(eventArtists.eventId, id));
    const ids: number[] = [];
    for (const a of e.lineup.slice(0, 30)) {
      const artistId = await actTx(tx, a);
      if (ids.includes(artistId)) continue;
      ids.push(artistId);
      await tx.insert(eventArtists).values({ eventId: id, artistId, position: ids.length - 1 }).onConflictDoNothing();
    }
    return ids;
  });
}

/** Drops the events from a source that it no longer lists (called off, moved, deleted) among those starting after `from`. */
async function dropGone(source: Found["source"], from: number, kept: string[]) {
  const gone = await db.select({ id: events.id, sid: events.sourceId }).from(events).where(and(eq(events.source, source), gte(events.startsAt, from)));
  const keep = new Set(kept), drop = gone.filter(g => !keep.has(g.sid ?? "")).map(g => g.id);
  for (let i = 0; i < drop.length; i += 500) await db.delete(events).where(inArray(events.id, drop.slice(i, i + 500)));
  return drop.length;
}

// ---------- MusicBrainz ----------
const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);
/**
 * When an event starts. MusicBrainz gives the local date and time (if any) but no time zone, so the zone is guessed
 * from the venue's longitude (15° an hour), and a show without a time is taken to start at 8pm.
 */
function startOf(date: string, time: string | null, lon: number | null): number {
  const [h, m] = (time ?? "20:00").split(":").map(Number);
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000) + (h || 0) * 3600 + (m || 0) * 60 - Math.round((lon ?? 0) / 15) * 3600;
}
const fromMb = (e: mbdb.MbEvent): Found => ({
  source: "musicbrainz", sourceId: e.gid, title: e.name, venue: e.venue ?? "", city: e.city ?? "", country: countryName(e.country),
  startsAt: startOf(e.date, e.time, e.lon), url: `https://musicbrainz.org/event/${e.gid}`, lat: e.lat, lon: e.lon, lineup: e.lineup,
});

export async function syncMusicBrainz(): Promise<{ upcoming: number; past: number; dropped: number }> {
  const t = now(), soon = t - 2 * 86400;
  const upcoming = await mbdb.events(day(soon), day(t + 548 * 86400));
  // the past year only for artists we know (by MusicBrainz id), so the catalogue doesn't fill with strangers
  const known = (await db.select({ mbid: artists.mbid }).from(artists).where(sql`${artists.mbid} IS NOT NULL`)).map(r => r.mbid!);
  const past = known.length ? await mbdb.events(day(t - 365 * 86400), day(soon - 86400), known) : [];
  const added: number[] = [];
  for (const e of [...upcoming, ...past]) if (e.lineup.length) added.push(...(await upsert(fromMb(e))));
  const dropped = await dropGone("musicbrainz", soon, upcoming.filter(e => e.lineup.length).map(e => e.gid));
  want("artist", [...new Set(added)]); // their pictures and details, with spare time
  return { upcoming: upcoming.length, past: past.length, dropped };
}

// ---------- Ticketmaster ----------
const TM_KEY = process.env.TICKETMASTER_KEY || "";
type TmEvent = {
  id: string; name: string; url?: string; dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string }; status?: { code?: string } };
  _embedded?: { venues?: { name?: string; city?: { name?: string }; country?: { countryCode?: string }; location?: { latitude?: string; longitude?: string } }[];
    attractions?: { name: string }[] };
};

/** Upcoming music events on Ticketmaster with this artist on the bill (matched by name), or null if it couldn't be asked. */
async function ticketmaster(name: string): Promise<Found[] | null> {
  const q = new URLSearchParams({ apikey: TM_KEY, keyword: name, classificationName: "music", size: "100", sort: "date,asc" });
  const res = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?${q}`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null) as { _embedded?: { events?: TmEvent[] } } | null;
  const key = looseKey(name), out: Found[] = [];
  for (const e of body?._embedded?.events ?? []) {
    const acts = e._embedded?.attractions ?? [], v = e._embedded?.venues?.[0], start = e.dates?.start;
    if (!acts.some(a => looseKey(a.name) === key) || e.dates?.status?.code === "cancelled" || !start?.localDate) continue;
    const lat = Number(v?.location?.latitude), lon = Number(v?.location?.longitude), has = Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon);
    out.push({
      source: "ticketmaster", sourceId: e.id, title: e.name, venue: v?.name ?? "", city: v?.city?.name ?? "", country: countryName(v?.country?.countryCode),
      startsAt: start.dateTime ? Math.floor(Date.parse(start.dateTime) / 1000) : startOf(start.localDate, start.localTime ?? null, has ? lon : null),
      url: e.url ?? "", lat: has ? lat : null, lon: has ? lon : null, lineup: acts.map(a => ({ name: a.name })),
    });
  }
  return out;
}

/** Asks Ticketmaster about the most played artist it hasn't been asked about in three days. */
async function ticketmasterTick() {
  const asked = (await getJson<Record<string, number>>("tm-asked")) ?? {};
  const t = now(), fresh = Object.keys(asked).filter(k => asked[k]! > t - 3 * 86400).map(Number);
  const plays = sql<number>`sum(${userArtists.plays})`;
  const [next] = await db.select({ id: artists.id, name: artists.name }).from(userArtists).innerJoin(artists, eq(artists.id, userArtists.artistId))
    .where(fresh.length ? sql`${artists.id} NOT IN ${fresh}` : undefined).groupBy(artists.id).orderBy(desc(plays)).limit(1);
  if (!next) return;
  const found = await ticketmaster(next.name);
  if (!found) return; // rate limited or down: try the same artist next time
  const kept = Object.fromEntries(Object.entries(asked).filter(([, at]) => at > t - 3 * 86400));
  await setJson("tm-asked", { ...kept, [next.id]: t }, 4 * 86400_000);
  const added: number[] = [];
  for (const e of found) added.push(...(await upsert(e)));
  // shows of this artist that Ticketmaster no longer lists
  const theirs = await db.select({ id: events.id, sid: events.sourceId }).from(events).innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(and(eq(events.source, "ticketmaster"), eq(eventArtists.artistId, next.id), gte(events.startsAt, t)));
  const ids = new Set(found.map(f => f.sourceId)), gone = theirs.filter(r => !ids.has(r.sid ?? "")).map(r => r.id);
  if (gone.length) await db.delete(events).where(inArray(events.id, gone));
  want("artist", [...new Set(added)]);
}

/** Started once at boot (server/index.ts). */
export function startEventSync() {
  const g = globalThis as { __spinEvents?: ReturnType<typeof setInterval>[] };
  for (const h of g.__spinEvents ?? []) clearInterval(h);
  const daily = async () => {
    if (!mbdb.mbdbOn || (await getJson<number>("events-mb-at"))) return;
    await exclusive("events-mb", 30 * 60_000, async () => {
      const r = await syncMusicBrainz();
      await setJson("events-mb-at", now(), 23 * 3600_000);
      console.log("events: musicbrainz", JSON.stringify(r));
    });
  };
  const quiet = (e: unknown) => console.error("events:", e);
  g.__spinEvents = [setInterval(() => { daily().catch(quiet); }, 15 * 60_000)];
  setTimeout(() => { daily().catch(quiet); }, 60_000);
  if (TM_KEY) g.__spinEvents.push(setInterval(() => { exclusive("events-tm", 60_000, ticketmasterTick).catch(quiet); }, 20_000));
}
