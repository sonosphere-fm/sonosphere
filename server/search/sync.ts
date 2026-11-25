import * as Sentry from "@sentry/bun";
import { pg } from "../db/client";
import { exclusive, getJson, setAdd, setJson, setTake } from "../kv";
import { now } from "../util";
import { es, esOn, putTemplate } from "./es";

// Every insert, rename and delete of an artist, album or track is announced by a trigger (migration 0050) as
// "tracks:123"; each process queues what it hears in one shared set and one of them writes the queue out every few
// seconds. A daily sweep rewrites everything, refreshing how well known each one is and dropping what the queue missed.
type Kind = "artists" | "albums" | "tracks";
type Doc = { id: number; name: string; artist: string | null; pop: number };

const QUEUE = "search:dirty";
const QUEUE_CAP = 200_000;
const SWEPT = "search:swept";
const DAY = 86_400;

const SELECT: Record<Kind, string> = {
  artists: `SELECT x.id, x.name, NULL AS artist,
      x.base_listeners + (SELECT count(*) FROM user_artists u WHERE u.artist_id = x.id) AS pop
    FROM artists x`,
  albums: `SELECT x.id, x.title AS name, a.name AS artist,
      x.base_listeners + (SELECT count(*) FROM user_albums u WHERE u.album_id = x.id) AS pop
    FROM albums x JOIN artists a ON a.id = x.artist_id`,
  tracks: `SELECT x.id, x.title AS name, a.name AS artist,
      x.base_listeners + (SELECT count(*) FROM user_tracks u WHERE u.track_id = x.id) AS pop
    FROM tracks x JOIN artists a ON a.id = x.artist_id`,
};
const KINDS = Object.keys(SELECT) as Kind[];

const byIds = (kind: Kind, ids: number[]) => pg.unsafe<Doc[]>(`${SELECT[kind]} WHERE x.id = ANY($1::int[])`, [ids]);
const after = (kind: Kind, id: number, n: number) =>
  pg.unsafe<Doc[]>(`${SELECT[kind]} WHERE x.id > $1 ORDER BY x.id LIMIT $2`, [id, n]);

let templated = false;

async function write(kind: Kind, docs: Doc[], gone: number[]) {
  if (!templated) {
    await putTemplate();
    templated = true;
  }
  const _index = `ours_${kind}`;
  const seen = now();
  const lines = [
    ...docs.flatMap((d) => [
      { index: { _index, _id: String(d.id) } },
      { name: d.name, artist: d.artist ?? undefined, pop: Number(d.pop), seen },
    ]),
    ...gone.map((id) => ({ delete: { _index, _id: String(id) } })),
  ];
  if (!lines.length) return;
  const r = await es<{ errors: boolean; items?: unknown[] }>(
    "POST",
    "/_bulk?filter_path=errors,items.*.error",
    lines,
    60_000
  );
  if (r.errors) throw new Error(`search index: ${JSON.stringify(r.items).slice(0, 300)}`);
}

async function flush() {
  for (;;) {
    const taken = await setTake(QUEUE, 2000);
    if (!taken.length) return;
    try {
      for (const kind of KINDS) {
        const ids = taken.filter((t) => t.startsWith(`${kind}:`)).map((t) => Number(t.slice(kind.length + 1)));
        if (!ids.length) continue;
        const docs = await byIds(kind, ids);
        const found = new Set(docs.map((d) => d.id));
        await write(
          kind,
          docs,
          ids.filter((id) => !found.has(id))
        );
      }
    } catch (e) {
      await setAdd(QUEUE, taken, QUEUE_CAP);
      throw e;
    }
  }
}

async function sweep() {
  const started = now();
  for (const kind of KINDS) {
    let last = 0;
    for (;;) {
      const docs = await after(kind, last, 5000);
      if (!docs.length) break;
      await write(kind, docs, []);
      last = docs.at(-1)!.id;
    }
    await es(
      "POST",
      `/ours_${kind}/_delete_by_query?conflicts=proceed`,
      { query: { range: { seen: { lt: started } } } },
      600_000
    );
  }
  await setJson(SWEPT, started, 3 * DAY * 1000);
  console.log(`search index: swept in ${now() - started}s`);
}

async function sweepIfDue() {
  const at = await getJson<number>(SWEPT);
  if (!at || at < now() - DAY) await exclusive("search-sweep", 10 * 60_000, sweep);
}

const report = (e: unknown) => {
  console.error("search index:", e);
  Sentry.captureException(e);
};

const g = globalThis as {
  __spinSearchFlush?: ReturnType<typeof setInterval>;
  __spinSearchSweep?: ReturnType<typeof setInterval>;
  __spinSearchFirst?: ReturnType<typeof setTimeout>;
  __spinSearchListen?: Promise<{ unlisten: () => Promise<void> }>;
};

export function startSearchSync() {
  if (!esOn) return;
  g.__spinSearchListen?.then((l) => l.unlisten()).catch(report);
  g.__spinSearchListen = pg.listen("search", (msg) => {
    setAdd(QUEUE, [msg], QUEUE_CAP).catch(report);
  });
  g.__spinSearchListen.catch(report);
  clearInterval(g.__spinSearchFlush);
  clearInterval(g.__spinSearchSweep);
  clearTimeout(g.__spinSearchFirst);
  g.__spinSearchFlush = setInterval(() => exclusive("search-flush", 60_000, flush).catch(report), 3000);
  g.__spinSearchSweep = setInterval(() => sweepIfDue().catch(report), 15 * 60_000);
  g.__spinSearchFirst = setTimeout(() => sweepIfDue().catch(report), 30_000);
}
