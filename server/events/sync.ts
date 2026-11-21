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
type Found = {
  source: "musicbrainz" | "ticketmaster";
  sourceId: string;
  title: string;
  venue: string;
  city: string;
  country: string;
  startsAt: number;
  url: string;
  lat: number | null;
  lon: number | null;
  lineup: Act[];
};

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string | null | undefined) {
  if (!code) return "";
  try {
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** By MusicBrainz id first, else by name (added if new, with the id noted). */
async function actTx(tx: Tx, a: Act): Promise<number> {
  if (a.mbid) {
    const [hit] = await tx.select({ id: artists.id }).from(artists).where(eq(artists.mbid, a.mbid)).limit(1);
    if (hit) return hit.id;
  }
  const id = await getOrCreateArtistTx(tx, a.name);
  if (a.mbid) await tx.update(artists).set({ mbid: a.mbid }).where(and(eq(artists.id, id), isNull(artists.mbid)));
  return id;
}

/** Returns the artists on the bill. */
async function upsert(e: Found): Promise<number[]> {
  return transact(async tx => {
    const row = {
      title: clean(e.title, 200) || "Untitled event",
      venue: clean(e.venue, 120),
      city: clean(e.city, 80),
      country: clean(e.country, 80),
      startsAt: e.startsAt,
      url: e.url,
      lat: e.lat,
      lon: e.lon,
    };
    const [{ id }] = await tx.insert(events)
      .values({ ...row, source: e.source, sourceId: e.sourceId, createdAt: now() })
      .onConflictDoUpdate({ target: [events.source, events.sourceId], set: row })
      .returning({ id: events.id });
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

/** Drops events starting after `from` that the source no longer lists. */
async function dropGone(source: Found["source"], from: number, kept: string[]) {
  const listed = await db.select({ id: events.id, sid: events.sourceId }).from(events)
    .where(and(eq(events.source, source), gte(events.startsAt, from)));
  const keep = new Set(kept);
  const drop = listed.filter(g => !keep.has(g.sid ?? "")).map(g => g.id);
  for (let i = 0; i < drop.length; i += 500) {
    await db.delete(events).where(inArray(events.id, drop.slice(i, i + 500)));
  }
  return drop.length;
}

const day = (t: number) => new Date(t * 1000).toISOString().slice(0, 10);

// local date and time with no zone: the zone is guessed from longitude (15° an hour); no time means 8pm
function startOf(date: string, time: string | null, lon: number | null): number {
  const [h, m] = (time ?? "20:00").split(":").map(Number);
  const midnight = Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
  const zone = Math.round((lon ?? 0) / 15) * 3600;
  return midnight + (h || 0) * 3600 + (m || 0) * 60 - zone;
}

const fromMb = (e: mbdb.MbEvent): Found => ({
  source: "musicbrainz",
  sourceId: e.gid,
  title: e.name,
  venue: e.venue ?? "",
  city: e.city ?? "",
  country: countryName(e.country),
  startsAt: startOf(e.date, e.time, e.lon),
  url: `https://musicbrainz.org/event/${e.gid}`,
  lat: e.lat,
  lon: e.lon,
  lineup: e.lineup,
});

async function syncMusicBrainz(): Promise<{ upcoming: number; past: number; dropped: number }> {
  const t = now();
  const soon = t - 2 * 86400;
  const upcoming = await mbdb.events(day(soon), day(t + 548 * 86400));
  // the past year only for artists we know, so the catalogue doesn't fill with strangers
  const knownRows = await db.select({ mbid: artists.mbid }).from(artists).where(sql`${artists.mbid} IS NOT NULL`);
  const known = knownRows.map(r => r.mbid!);
  const past = known.length ? await mbdb.events(day(t - 365 * 86400), day(soon - 86400), known) : [];
  const added: number[] = [];
  for (const e of [...upcoming, ...past]) {
    if (e.lineup.length) added.push(...(await upsert(fromMb(e))));
  }
  const listed = upcoming.filter(e => e.lineup.length).map(e => e.gid);
  const dropped = await dropGone("musicbrainz", soon, listed);
  want("artist", [...new Set(added)]);
  return { upcoming: upcoming.length, past: past.length, dropped };
}

const TM_KEY = process.env.TICKETMASTER_KEY || "";
type TmVenue = {
  name?: string;
  city?: { name?: string };
  country?: { countryCode?: string };
  location?: { latitude?: string; longitude?: string };
};
type TmEvent = {
  id: string;
  name: string;
  url?: string;
  dates?: { start?: { localDate?: string; localTime?: string; dateTime?: string }; status?: { code?: string } };
  _embedded?: { venues?: TmVenue[]; attractions?: { name: string }[] };
};

/** Null if Ticketmaster couldn't be asked. */
async function ticketmaster(name: string): Promise<Found[] | null> {
  const q = new URLSearchParams({ apikey: TM_KEY, keyword: name, classificationName: "music", size: "100", sort: "date,asc" });
  const url = `https://app.ticketmaster.com/discovery/v2/events.json?${q}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return null;
  const body = await res.json().catch(() => null) as { _embedded?: { events?: TmEvent[] } } | null;
  const key = looseKey(name);
  const out: Found[] = [];
  for (const e of body?._embedded?.events ?? []) {
    const acts = e._embedded?.attractions ?? [];
    const v = e._embedded?.venues?.[0];
    const start = e.dates?.start;
    if (!acts.some(a => looseKey(a.name) === key)) continue;
    if (e.dates?.status?.code === "cancelled" || !start?.localDate) continue;
    const lat = Number(v?.location?.latitude);
    const lon = Number(v?.location?.longitude);
    const has = Number.isFinite(lat) && Number.isFinite(lon) && (lat || lon);
    const startsAt = start.dateTime
      ? Math.floor(Date.parse(start.dateTime) / 1000)
      : startOf(start.localDate, start.localTime ?? null, has ? lon : null);
    out.push({
      source: "ticketmaster",
      sourceId: e.id,
      title: e.name,
      venue: v?.name ?? "",
      city: v?.city?.name ?? "",
      country: countryName(v?.country?.countryCode),
      startsAt,
      url: e.url ?? "",
      lat: has ? lat : null,
      lon: has ? lon : null,
      lineup: acts.map(a => ({ name: a.name })),
    });
  }
  return out;
}

/** Asks about the most played artist not asked about in three days. */
async function ticketmasterTick() {
  const asked = (await getJson<Record<string, number>>("tm-asked")) ?? {};
  const t = now();
  const fresh = Object.keys(asked).filter(k => asked[k]! > t - 3 * 86400).map(Number);
  const plays = sql<number>`sum(${userArtists.plays})`;
  const [next] = await db.select({ id: artists.id, name: artists.name })
    .from(userArtists)
    .innerJoin(artists, eq(artists.id, userArtists.artistId))
    .where(fresh.length ? sql`${artists.id} NOT IN ${fresh}` : undefined)
    .groupBy(artists.id)
    .orderBy(desc(plays))
    .limit(1);
  if (!next) return;
  const found = await ticketmaster(next.name);
  // rate limited or down: try the same artist next time
  if (!found) return;
  const kept = Object.fromEntries(Object.entries(asked).filter(([, at]) => at > t - 3 * 86400));
  await setJson("tm-asked", { ...kept, [next.id]: t }, 4 * 86400_000);
  const added: number[] = [];
  for (const e of found) added.push(...(await upsert(e)));
  const theirs = await db.select({ id: events.id, sid: events.sourceId })
    .from(events)
    .innerJoin(eventArtists, eq(eventArtists.eventId, events.id))
    .where(and(eq(events.source, "ticketmaster"), eq(eventArtists.artistId, next.id), gte(events.startsAt, t)));
  const ids = new Set(found.map(f => f.sourceId));
  const gone = theirs.filter(r => !ids.has(r.sid ?? "")).map(r => r.id);
  if (gone.length) await db.delete(events).where(inArray(events.id, gone));
  want("artist", [...new Set(added)]);
}

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
  const runDaily = () => {
    daily().catch(quiet);
  };
  g.__spinEvents = [setInterval(runDaily, 15 * 60_000)];
  setTimeout(runDaily, 60_000);
  if (TM_KEY) {
    const tick = () => {
      exclusive("events-tm", 60_000, ticketmasterTick).catch(quiet);
    };
    g.__spinEvents.push(setInterval(tick, 20_000));
  }
}
