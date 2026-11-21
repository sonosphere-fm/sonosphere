// Imports of past listening, worked through in the background so a long one carries on after the page is closed:
// - a file (CSV or JSON, read in the browser) is uploaded in chunks of 20,000 rows, then filed 1,000 rows at a time;
// - a Last.fm profile is read page by page (its plays, then its loved tracks) straight from Last.fm.
// One import per person at a time, at most 3 million rows. One process works through them (exclusive()), a slice
// of each running import in turn, so a huge one doesn't hold up everyone else's.
import { and, asc, count, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../db/client";
import { importChunks, importJobs } from "../db/schema";
import { need } from "../guards";
import { bad, fail, int, missing, Router, throttle } from "../http";
import { exclusive } from "../kv";
import { clean, now } from "../util";
import { importLoved, scrobbleMany } from "./service";
import { IMPORT_CHUNK, IMPORT_MAX, type ImportJob, type ImportKind, type ImportState } from "../../shared/imports";

// The site's own Last.fm API key, for reading public profiles.
const LASTFM_KEY = "65fb65f79427db8ce5626269c0d7fa2b";
const SLICE = 1000;
const ACTIVE = ["uploading", "queued", "running"];

type Row = { artist: string; track: string; album: string; timestamp?: number };
type Job = typeof importJobs.$inferSelect;

const shown = (j: Job): ImportJob => ({
  id: j.id, kind: j.kind as ImportKind, status: j.status as ImportJob["status"], lastfmUser: j.lastfmUser, phase: j.phase as ImportJob["phase"],
  total: j.total, done: j.done, accepted: j.accepted, error: j.error, createdAt: j.createdAt, updatedAt: j.updatedAt,
});
const save = (id: number, set: Partial<Job>) => db.update(importJobs).set({ ...set, updatedAt: now() }).where(eq(importJobs.id, id));
/** Saves progress, unless the import was cancelled meanwhile. */
const advance = (id: number, set: Partial<Job>) =>
  db.update(importJobs).set({ ...set, updatedAt: now() }).where(and(eq(importJobs.id, id), inArray(importJobs.status, ["queued", "running"])));
const latest = async (userId: number) => (await db.select().from(importJobs).where(eq(importJobs.userId, userId)).orderBy(desc(importJobs.createdAt), desc(importJobs.id)).limit(1))[0];
async function ownJob(userId: number, raw: string | undefined) {
  const id = int(raw);
  const [j] = id === null ? [] : await db.select().from(importJobs).where(and(eq(importJobs.id, id), eq(importJobs.userId, userId)));
  return j ?? missing("Import");
}
async function startJob(userId: number, values: Pick<Job, "kind" | "status" | "total"> & Partial<Job>) {
  const busy = await latest(userId);
  if (busy && ACTIVE.includes(busy.status)) fail(409, "You already have an import going. Wait for it to finish, or cancel it.");
  await throttle(`import:${userId}`, 10, 86_400, "You can start up to 10 imports a day.");
  const t = now();
  return (await db.insert(importJobs).values({ userId, ...values, createdAt: t, updatedAt: t }).returning())[0]!;
}

/** One uploaded row, made safe: names as text of a sane length, a time as a number. */
function readRow(v: unknown): Row | null {
  const r = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const artist = clean(r.artist), track = clean(r.track);
  if (!artist || !track) return null;
  const ts = Number(r.timestamp);
  return { artist, track, album: clean(r.album), ...(Number.isFinite(ts) && ts > 0 ? { timestamp: Math.floor(ts) } : {}) };
}

// ---------- Last.fm ----------
type LfmText = string | { "#text"?: string; name?: string } | undefined;
type LfmTrack = { name?: string; artist?: LfmText; album?: LfmText; date?: { uts?: string }; "@attr"?: { nowplaying?: string } };
type LfmPage = { track?: LfmTrack[] | LfmTrack; "@attr"?: { totalPages?: string; total?: string } };
class LastfmError extends Error { constructor(msg: string, public lasting: boolean) { super(msg); } }

async function lastfm<T>(params: Record<string, string>): Promise<T> {
  const q = new URLSearchParams({ ...params, api_key: LASTFM_KEY, format: "json" });
  const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${q}`, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Sonosphere/1.0" } })
    .catch(() => null);
  const body = res ? await res.json().catch(() => null) as ({ error?: number; message?: string } & T) | null : null;
  if (body?.error === 6) throw new LastfmError("There is no Last.fm profile by that name.", true);
  if (body?.error === 17) throw new LastfmError("That Last.fm profile keeps its listening private. Turn off \"Hide recent listening\" in Last.fm's privacy settings, then try again.", true);
  if (!res?.ok || !body || body.error) throw new LastfmError(body?.message || `Last.fm didn't answer (${res?.status ?? "no connection"})`, false);
  return body;
}
const text = (v: LfmText) => (typeof v === "string" ? v : v?.["#text"] ?? v?.name ?? "");
const tracksOf = (p: LfmPage | undefined) => (p?.track ? (Array.isArray(p.track) ? p.track : [p.track]) : []);

/** Reads the next page of a Last.fm import and files it. */
async function lastfmStep(j: Job) {
  const user = j.lastfmUser!, page = String(j.cursor + 1);
  if (j.phase === "scrobbles") {
    const { recenttracks: p } = await lastfm<{ recenttracks?: LfmPage }>({ method: "user.getrecenttracks", user, limit: "200", page, to: String(j.lastfmTo ?? now()) });
    const rows = tracksOf(p).filter(t => t["@attr"]?.nowplaying !== "true" && t.date?.uts)
      .map(t => ({ artist: text(t.artist), track: t.name ?? "", album: text(t.album), timestamp: Number(t.date!.uts) }));
    const accepted = rows.length ? (await scrobbleMany(j.userId, rows, "import")).filter(r => r.accepted).length : 0;
    const pages = Number(p?.["@attr"]?.totalPages) || 0, total = Math.min(IMPORT_MAX, Number(p?.["@attr"]?.total) || j.total);
    const last = j.cursor + 1 >= pages || !rows.length || j.done + rows.length >= IMPORT_MAX;
    await advance(j.id, { status: "running", pages, total, done: j.done + rows.length, accepted: j.accepted + accepted, failures: 0,
      ...(last ? { phase: "loved", cursor: 0, total: j.done + rows.length } : { cursor: j.cursor + 1 }) });
  } else {
    const { lovedtracks: p } = await lastfm<{ lovedtracks?: LfmPage }>({ method: "user.getlovedtracks", user, limit: "500", page });
    const rows = tracksOf(p).map(t => ({ artist: text(t.artist), track: t.name ?? "", timestamp: Number(t.date?.uts) }));
    if (rows.length) await importLoved(j.userId, rows);
    const last = j.cursor + 1 >= (Number(p?.["@attr"]?.totalPages) || 0) || !rows.length;
    await advance(j.id, last ? { status: "done", failures: 0 } : { cursor: j.cursor + 1, failures: 0 });
  }
}

// ---------- files ----------
/** Files the next slice of an uploaded file. */
async function fileStep(j: Job) {
  const n = Math.floor(j.cursor / IMPORT_CHUNK), offset = j.cursor % IMPORT_CHUNK;
  const [chunk] = await db.select().from(importChunks).where(and(eq(importChunks.jobId, j.id), eq(importChunks.n, n)));
  if (!chunk) return advance(j.id, { status: "done" });
  const rows = JSON.parse(chunk.rows) as Row[], slice = rows.slice(offset, offset + SLICE);
  const accepted = j.kind === "loved" ? await importLoved(j.userId, slice) : (await scrobbleMany(j.userId, slice, "import")).filter(r => r.accepted).length;
  const end = offset + slice.length >= rows.length;
  if (end) await db.delete(importChunks).where(and(eq(importChunks.jobId, j.id), eq(importChunks.n, n)));
  await advance(j.id, { status: "running", cursor: end ? (n + 1) * IMPORT_CHUNK : j.cursor + slice.length, done: j.done + slice.length,
    accepted: j.accepted + accepted, failures: 0 });
}

// ---------- the worker ----------
async function step(j: Job) {
  try {
    await (j.kind === "lastfm" ? lastfmStep(j) : fileStep(j));
  } catch (e) {
    // a lasting problem ends it; anything else (Last.fm busy, a name added by another process meanwhile) is tried again
    const lasting = e instanceof LastfmError && e.lasting;
    if (!lasting) console.error(`import ${j.id}:`, e);
    const failures = j.failures + 1;
    await advance(j.id, lasting || failures >= 30
      ? { status: "failed", error: e instanceof LastfmError ? e.message : "Something went wrong partway through. What was imported so far stays." }
      : { failures });
  }
}
async function tick() {
  // uploads abandoned for a day are dropped
  const stale = await db.select({ id: importJobs.id }).from(importJobs).where(and(eq(importJobs.status, "uploading"), lt(importJobs.updatedAt, now() - 86_400)));
  if (stale.length) {
    const ids = stale.map(s => s.id);
    await db.delete(importChunks).where(inArray(importChunks.jobId, ids));
    await db.update(importJobs).set({ status: "cancelled", error: "The upload didn't finish." }).where(inArray(importJobs.id, ids));
  }
  // a slice of each of the three longest-waiting imports, then the next round
  const jobs = await db.select().from(importJobs).where(inArray(importJobs.status, ["queued", "running"])).orderBy(asc(importJobs.updatedAt)).limit(3);
  for (const j of jobs) await step(j);
}

/** Started once at boot (server/index.ts). */
export function startImports() {
  const g = globalThis as { __spinImports?: ReturnType<typeof setInterval> };
  clearInterval(g.__spinImports);
  // a round can take a while (a thousand plays filed per import); the lock keeps rounds from overlapping
  g.__spinImports = setInterval(() => { exclusive("imports", 5 * 60_000, tick).catch(e => console.error("imports:", e)); }, 2000);
}

// ---------- routes ----------
export const router = new Router();

router.get<ImportState>("/api/import", async c => {
  const j = await latest(need(c).id);
  return { job: j ? shown(j) : null };
});

/** Starts a file import: the rows follow in chunks (POST /api/import/:id/chunk), then POST /api/import/:id/start. */
router.post<ImportState>("/api/import", async c => {
  const u = need(c), kind = c.body.kind === "loved" ? "loved" : "scrobbles", total = int(c.body.total);
  if (total === null || total < 1) bad("Nothing to import");
  if (total! > IMPORT_MAX) bad(`An import can hold up to ${IMPORT_MAX.toLocaleString("en")} rows. Split the file and import it in parts.`);
  return { job: shown(await startJob(u.id, { kind, status: "uploading", total: total! })) };
});

router.post<{ ok: true }>("/api/import/:id/chunk", async c => {
  const j = await ownJob(need(c).id, c.params[0]), n = int(c.body.n), list: unknown[] = Array.isArray(c.body.rows) ? c.body.rows : [];
  if (j.status !== "uploading") bad("This import isn't taking uploads");
  const chunks = Math.ceil(j.total / IMPORT_CHUNK);
  if (n === null || n < 0 || n >= chunks) bad("Unexpected chunk");
  // every chunk is full but the last, so a row's place in the file says which chunk it is in
  const want = n === chunks - 1 ? j.total - n! * IMPORT_CHUNK : IMPORT_CHUNK;
  if (list.length !== want) bad(`Chunk ${n} should hold ${want} rows`);
  // rows that can't be read are kept as gaps, so the counts still line up; they are skipped when filed
  const rows = list.map(r => readRow(r) ?? { artist: "", track: "", album: "" });
  await db.insert(importChunks).values({ jobId: j.id, n: n!, rows: JSON.stringify(rows) }).onConflictDoNothing();
  await save(j.id, {});
  return { ok: true };
});

router.post<ImportState>("/api/import/:id/start", async c => {
  const j = await ownJob(need(c).id, c.params[0]);
  if (j.status !== "uploading") return { job: shown(j) };
  const [have] = await db.select({ c: count() }).from(importChunks).where(eq(importChunks.jobId, j.id));
  if ((have?.c ?? 0) < Math.ceil(j.total / IMPORT_CHUNK)) bad("Some of the file hasn't been uploaded yet");
  await save(j.id, { status: "queued" });
  return { job: shown((await latest(j.userId))!) };
});

router.post<ImportState>("/api/import/lastfm", async c => {
  const u = need(c), user = clean(c.body.user, 40);
  if (!/^[A-Za-z][\w-]{1,30}$/.test(user)) bad("That isn't a Last.fm username");
  let info: { user?: { name?: string; playcount?: string } };
  try { info = await lastfm({ method: "user.getinfo", user }); }
  catch (e) { return bad(e instanceof Error ? e.message : "Last.fm didn't answer"); }
  const total = Math.min(IMPORT_MAX, Number(info.user?.playcount) || 0);
  return { job: shown(await startJob(u.id, { kind: "lastfm", status: "queued", total, lastfmUser: info.user?.name || user, lastfmTo: now() })) };
});

router.delete<ImportState>("/api/import/:id", async c => {
  const j = await ownJob(need(c).id, c.params[0]);
  if (ACTIVE.includes(j.status)) {
    await db.delete(importChunks).where(eq(importChunks.jobId, j.id));
    await save(j.id, { status: "cancelled" });
  }
  return { job: shown((await latest(j.userId))!) };
});
