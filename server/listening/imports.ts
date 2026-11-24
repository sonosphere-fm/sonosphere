import { and, asc, count, desc, eq, inArray, lt } from "drizzle-orm";
import { db } from "../db/client";
import { importChunks, importJobs } from "../db/schema";
import { need } from "../guards";
import { bad, fail, int, missing, Router, throttle } from "../http";
import { exclusive } from "../kv";
import { setLatestImport } from "../listenbrainz/repo";
import { lastfmCall } from "../metadata/sources";
import { clean, now } from "../util";
import * as Sentry from "@sentry/bun";
import { importListenBrainz, importLoved, scrobbleMany } from "./service";
import {
  IMPORT_CHUNK,
  IMPORT_MAX,
  type ImportJob,
  type ImportKind,
  type ImportRow,
  type ImportState,
} from "../../shared/imports";

const SLICE = 1000;
const ACTIVE = ["uploading", "queued", "running"];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type Row = ImportRow;
type Job = typeof importJobs.$inferSelect;

const shown = (j: Job): ImportJob => ({
  id: j.id,
  kind: j.kind as ImportKind,
  status: j.status as ImportJob["status"],
  lastfmUser: j.lastfmUser,
  phase: j.phase as ImportJob["phase"],
  total: j.total,
  done: j.done,
  accepted: j.accepted,
  error: j.error,
  createdAt: j.createdAt,
  updatedAt: j.updatedAt,
});

const save = (id: number, set: Partial<Job>) =>
  db
    .update(importJobs)
    .set({ ...set, updatedAt: now() })
    .where(eq(importJobs.id, id));

/** Saves progress, unless the import was cancelled meanwhile. */
const advance = (id: number, set: Partial<Job>) =>
  db
    .update(importJobs)
    .set({ ...set, updatedAt: now() })
    .where(and(eq(importJobs.id, id), inArray(importJobs.status, ["queued", "running"])));

async function latest(userId: number) {
  const rows = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.userId, userId))
    .orderBy(desc(importJobs.createdAt), desc(importJobs.id))
    .limit(1);
  return rows[0];
}

async function ownJob(userId: number, raw: string | undefined) {
  const id = int(raw);
  if (id === null) return missing("importNotFound");
  const [j] = await db
    .select()
    .from(importJobs)
    .where(and(eq(importJobs.id, id), eq(importJobs.userId, userId)));
  return j ?? missing("importNotFound");
}

async function startJob(userId: number, values: Pick<Job, "kind" | "status" | "total"> & Partial<Job>) {
  const busy = await latest(userId);
  if (busy && ACTIVE.includes(busy.status)) fail(409, "alreadyImportGoingWaitFinish");
  await throttle(`import:${userId}`, 10, 86_400, "tooManyImportsToday");
  const t = now();
  const [job] = await db
    .insert(importJobs)
    .values({ userId, ...values, createdAt: t, updatedAt: t })
    .returning();
  return job!;
}

function readRow(v: unknown): Row | null {
  const r = (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
  const raw = String(r.recordingMbid ?? "").toLowerCase();
  const recordingMbid = UUID.test(raw) ? raw : undefined;
  const ts = Number(r.timestamp);
  const timestamp = Number.isFinite(ts) && ts > 0 ? Math.floor(ts) : undefined;
  const score = Number(r.score);
  if (score === 1 || score === -1) {
    return recordingMbid
      ? { artist: "", track: "", album: "", recordingMbid, score, ...(timestamp ? { timestamp } : {}) }
      : null;
  }
  const artist = clean(r.artist);
  const track = clean(r.track);
  if (!artist || !track) return null;
  return {
    artist,
    track,
    album: clean(r.album),
    ...(timestamp ? { timestamp } : {}),
    ...(recordingMbid ? { recordingMbid } : {}),
  };
}

type LfmText = string | { "#text"?: string; name?: string } | undefined;
type LfmTrack = {
  name?: string;
  artist?: LfmText;
  album?: LfmText;
  date?: { uts?: string };
  "@attr"?: { nowplaying?: string };
};
type LfmPage = { track?: LfmTrack[] | LfmTrack; "@attr"?: { totalPages?: string; total?: string } };

class LastfmError extends Error {
  constructor(
    msg: string,
    public lasting: boolean
  ) {
    super(msg);
  }
}

async function lastfm<T>(params: Record<string, string>): Promise<T> {
  const r = await lastfmCall(params, 20_000);
  if (!r) throw new LastfmError("Last.fm isn't answering right now. The import will keep trying.", false);
  const body = r.body as ({ error?: number; message?: string } & T) | null;
  if (body?.error === 6) throw new LastfmError("There is no Last.fm profile by that name.", true);
  if (body?.error === 17) {
    throw new LastfmError(
      'That Last.fm profile keeps its listening private. Turn off "Hide recent listening" in Last.fm\'s privacy settings, then try again.',
      true
    );
  }
  if (r.status >= 400 || !body || body.error)
    throw new LastfmError(body?.message || `Last.fm didn't answer (${r.status})`, false);
  return body;
}

const text = (v: LfmText) => (typeof v === "string" ? v : (v?.["#text"] ?? v?.name ?? ""));

function tracksOf(p: LfmPage | undefined) {
  if (!p?.track) return [];
  return Array.isArray(p.track) ? p.track : [p.track];
}

async function lastfmStep(j: Job) {
  const user = j.lastfmUser!;
  const page = String(j.cursor + 1);
  if (j.phase === "scrobbles") {
    const params = { method: "user.getrecenttracks", user, limit: "200", page, to: String(j.lastfmTo ?? now()) };
    const { recenttracks: p } = await lastfm<{ recenttracks?: LfmPage }>(params);
    const rows = tracksOf(p)
      .filter((t) => t["@attr"]?.nowplaying !== "true" && t.date?.uts)
      .map((t) => ({
        artist: text(t.artist),
        track: t.name ?? "",
        album: text(t.album),
        timestamp: Number(t.date!.uts),
      }));
    const accepted = rows.length ? (await scrobbleMany(j.userId, rows, "import")).filter((r) => r.accepted).length : 0;
    const pages = Number(p?.["@attr"]?.totalPages) || 0;
    const total = Math.min(IMPORT_MAX, Number(p?.["@attr"]?.total) || j.total);
    const done = j.done + rows.length;
    const last = j.cursor + 1 >= pages || !rows.length || done >= IMPORT_MAX;
    const next = last ? { phase: "loved", cursor: 0, total: done } : { cursor: j.cursor + 1 };
    await advance(j.id, {
      status: "running",
      pages,
      total,
      done,
      accepted: j.accepted + accepted,
      failures: 0,
      ...next,
    });
    return;
  }
  const { lovedtracks: p } = await lastfm<{ lovedtracks?: LfmPage }>({
    method: "user.getlovedtracks",
    user,
    limit: "500",
    page,
  });
  const rows = tracksOf(p).map((t) => ({
    artist: text(t.artist),
    track: t.name ?? "",
    timestamp: Number(t.date?.uts),
  }));
  if (rows.length) await importLoved(j.userId, rows);
  const last = j.cursor + 1 >= (Number(p?.["@attr"]?.totalPages) || 0) || !rows.length;
  await advance(j.id, last ? { status: "done", failures: 0 } : { cursor: j.cursor + 1, failures: 0 });
}

async function fileStep(j: Job) {
  const n = Math.floor(j.cursor / IMPORT_CHUNK);
  const offset = j.cursor % IMPORT_CHUNK;
  const thisChunk = and(eq(importChunks.jobId, j.id), eq(importChunks.n, n));
  const [chunk] = await db.select().from(importChunks).where(thisChunk);
  if (!chunk) return advance(j.id, { status: "done" });
  const rows = JSON.parse(chunk.rows) as Row[];
  const slice = rows.slice(offset, offset + SLICE);
  let accepted: number;
  if (j.kind === "loved") accepted = await importLoved(j.userId, slice);
  else if (j.kind === "listenbrainz") accepted = await importListenBrainz(j.userId, slice);
  else accepted = (await scrobbleMany(j.userId, slice, "import")).filter((r) => r.accepted).length;
  const end = offset + slice.length >= rows.length;
  if (end && j.kind === "listenbrainz") {
    const latest = slice.reduce((m, r) => Math.max(m, r.score ? 0 : (r.timestamp ?? 0)), 0);
    if (latest) await setLatestImport(j.userId, "listenbrainz", latest);
  }
  if (end) await db.delete(importChunks).where(thisChunk);
  await advance(j.id, {
    status: "running",
    cursor: end ? (n + 1) * IMPORT_CHUNK : j.cursor + slice.length,
    done: j.done + slice.length,
    accepted: j.accepted + accepted,
    failures: 0,
  });
}

async function step(j: Job) {
  try {
    await (j.kind === "lastfm" ? lastfmStep(j) : fileStep(j));
  } catch (e) {
    // a lasting problem ends it; anything else (Last.fm busy, a name added by another process meanwhile) is tried again
    const lasting = e instanceof LastfmError && e.lasting;
    if (!lasting) {
      console.error(`import ${j.id}:`, e);
      Sentry.captureException(e);
    }
    const failures = j.failures + 1;
    if (!lasting && failures < 30) {
      await advance(j.id, { failures });
      return;
    }
    const error =
      e instanceof LastfmError ? e.message : "Something went wrong partway through. What was imported so far stays.";
    await advance(j.id, { status: "failed", error });
  }
}

async function tick() {
  const abandoned = and(eq(importJobs.status, "uploading"), lt(importJobs.updatedAt, now() - 86_400));
  const stale = await db.select({ id: importJobs.id }).from(importJobs).where(abandoned);
  if (stale.length) {
    const ids = stale.map((s) => s.id);
    await db.delete(importChunks).where(inArray(importChunks.jobId, ids));
    await db
      .update(importJobs)
      .set({ status: "cancelled", error: "The upload didn't finish." })
      .where(inArray(importJobs.id, ids));
  }
  // Keep successful file imports moving instead of sleeping two seconds after every slice.
  // Reload progress/cancellation between slices; cap the round well below the lock lease.
  const until = Date.now() + 10_000;
  do {
    const jobs = await db
      .select()
      .from(importJobs)
      .where(inArray(importJobs.status, ["queued", "running"]))
      .orderBy(asc(importJobs.updatedAt), asc(importJobs.id))
      .limit(3);
    if (!jobs.length) return;
    for (const j of jobs) await step(j);
    // Preserve retry pacing and Last.fm request pacing; only drain healthy local-file work.
    if (jobs.some((j) => j.kind === "lastfm" || j.failures > 0)) return;
  } while (Date.now() < until);
}

export function startImports() {
  const g = globalThis as { __spinImports?: ReturnType<typeof setInterval> };
  clearInterval(g.__spinImports);
  // a round can take a while; the lock keeps rounds from overlapping, across processes too
  g.__spinImports = setInterval(() => {
    exclusive("imports", 5 * 60_000, tick).catch((e) => {
      console.error("imports:", e);
      Sentry.captureException(e);
    });
  }, 2000);
}

export const router = new Router();

router.get<ImportState>("/api/import", async (c) => {
  const j = await latest(need(c).id);
  return { job: j ? shown(j) : null };
});

/** Starts a file import: the rows follow in chunks (POST /api/import/:id/chunk), then POST /api/import/:id/start. */
router.post<ImportState>("/api/import", async (c) => {
  const u = need(c);
  const kind: ImportKind =
    c.body.kind === "loved" ? "loved" : c.body.kind === "listenbrainz" ? "listenbrainz" : "scrobbles";
  const lastfmUser = c.body.lastfmUser === undefined ? null : clean(c.body.lastfmUser, 40);
  if (lastfmUser !== null && !/^[A-Za-z][\w-]{1,30}$/.test(lastfmUser)) bad("isntLastFmUsername");
  const total = int(c.body.total);
  if (total === null || total < 1) bad("nothingImport");
  if (total! > IMPORT_MAX) bad("importTooBig", { count: IMPORT_MAX });
  return { job: shown(await startJob(u.id, { kind, status: "uploading", total: total!, lastfmUser })) };
});

router.post<{ ok: true }>("/api/import/:id/chunk", async (c) => {
  const j = await ownJob(need(c).id, c.params[0]);
  const n = int(c.body.n);
  const list: unknown[] = Array.isArray(c.body.rows) ? c.body.rows : [];
  if (j.status !== "uploading") bad("importIsntTakingUploads");
  const chunks = Math.ceil(j.total / IMPORT_CHUNK);
  if (n === null || n < 0 || n >= chunks) bad("unexpectedChunk");
  // every chunk is full but the last, so a row's place in the file says which chunk it is in
  const want = n === chunks - 1 ? j.total - n! * IMPORT_CHUNK : IMPORT_CHUNK;
  if (list.length !== want) bad("chunkWrongSize", { n: String(n), want });
  // unreadable rows stay as gaps so the counts still line up; they are skipped when filed
  const rows = list.map((r) => readRow(r) ?? { artist: "", track: "", album: "" });
  await db
    .insert(importChunks)
    .values({ jobId: j.id, n: n!, rows: JSON.stringify(rows) })
    .onConflictDoNothing();
  await save(j.id, {});
  return { ok: true };
});

router.post<ImportState>("/api/import/:id/start", async (c) => {
  const j = await ownJob(need(c).id, c.params[0]);
  if (j.status !== "uploading") return { job: shown(j) };
  const [have] = await db.select({ c: count() }).from(importChunks).where(eq(importChunks.jobId, j.id));
  if ((have?.c ?? 0) < Math.ceil(j.total / IMPORT_CHUNK)) bad("fileNotFullyUploaded");
  const [started] = await db
    .update(importJobs)
    .set({ status: "queued", updatedAt: now() })
    .where(and(eq(importJobs.id, j.id), eq(importJobs.status, "uploading")))
    .returning();
  return { job: shown(started ?? (await ownJob(j.userId, c.params[0]))) };
});

router.delete<ImportState>("/api/import/:id", async (c) => {
  const j = await ownJob(need(c).id, c.params[0]);
  if (ACTIVE.includes(j.status)) {
    await db.delete(importChunks).where(eq(importChunks.jobId, j.id));
    await save(j.id, { status: "cancelled" });
  }
  return { job: shown((await latest(j.userId))!) };
});
