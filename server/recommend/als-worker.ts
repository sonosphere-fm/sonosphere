// Runs on its own thread (started by worker.ts): reads everyone's artist play counts, learns taste vectors (als.ts),
// checks them against listening held back from training, and stores the vectors and how much they can be trusted.
// The site never waits on this; recommendations use whatever model was stored last.
import { Database } from "bun:sqlite";
import { buildMatrix, evaluate, rng, train } from "./als";

declare const self: Worker;

// Caps that keep a training run's size bounded however large the site grows.
const MAX_ARTISTS = 50_000;  // the most widely heard artists; an artist needs two listeners to say anything
const MAX_PER_USER = 500;    // a user's most played artists
const MAX_EVAL = 1_000;      // users whose held-back artist is used to grade the model
const TOP_N = 20;            // "hit" = the held-back artist is in the top 20 suggestions

export type TrainResult = { at: number; users: number; artists: number; k: number; hitModel: number; hitPopular: number; evalUsers: number; quality: number; ms: number };

function run(path: string): TrainResult {
  const started = Date.now();
  const db = new Database(path);
  db.exec("PRAGMA busy_timeout = 5000;");
  try {
    const artistIds = db.query<{ id: number }, []>(`SELECT artist_id AS id FROM user_artists GROUP BY artist_id HAVING COUNT(*) >= 2 ORDER BY COUNT(*) DESC, artist_id LIMIT ${MAX_ARTISTS}`).all().map(r => r.id);
    const itemOf = new Map(artistIds.map((id, i) => [id, i]));
    // Every user's kept artists, most played first.
    const rows = new Map<number, { item: number; plays: number }[]>();
    for (const r of db.query<{ u: number; a: number; p: number }, []>("SELECT user_id AS u, artist_id AS a, plays AS p FROM user_artists WHERE plays > 0 ORDER BY user_id, plays DESC").iterate()) {
      const item = itemOf.get(r.a);
      if (item === undefined) continue;
      let list = rows.get(r.u);
      if (!list) rows.set(r.u, (list = []));
      if (list.length < MAX_PER_USER) list.push({ item, plays: r.p });
    }
    const userIds = [...rows.keys()].filter(u => (rows.get(u)?.length ?? 0) >= 2);
    // Hold back one artist from a sample of users with enough history, to grade the model on.
    const rand = rng(userIds.length * 7919 + artistIds.length);
    const candidates = userIds.map((u, i) => [u, i] as const).filter(([u]) => (rows.get(u)?.length ?? 0) >= 5);
    const keepOdds = Math.min(1, MAX_EVAL / Math.max(1, candidates.length));
    const heldBack = new Map<number, number>(); // user index -> position in their list
    for (const [u, i] of candidates) if (rand() < keepOdds) heldBack.set(i, Math.floor(rand() * (rows.get(u)?.length ?? 1)));
    let n = 0;
    for (const u of userIds) n += rows.get(u)?.length ?? 0;
    n -= heldBack.size;
    const eu = new Int32Array(n), ei = new Int32Array(n), ep = new Float32Array(n), held: { user: number; item: number }[] = [];
    let e = 0;
    userIds.forEach((u, ui) => {
      const skip = heldBack.get(ui);
      rows.get(u)?.forEach((r, pos) => {
        if (pos === skip) { held.push({ user: ui, item: r.item }); return; }
        eu[e] = ui; ei[e] = r.item; ep[e] = r.plays; e++;
      });
    });
    const k = userIds.length < 200 ? 16 : userIds.length < 5000 ? 32 : 48;
    const m = buildMatrix(userIds.length, artistIds.length, eu, ei, ep);
    const model = train(m, { k, iterations: 12, lambda: 2, alpha: 4, seed: 1 });
    const grade = evaluate(m, model, held, TOP_N);
    // How far to trust it: its edge over plain popularity, discounted while there are few users to judge by.
    const edge = grade.model > 0 ? Math.max(0, (grade.model - grade.popular) / grade.model) : 0;
    const quality = grade.users < 20 ? 0 : edge * Math.min(1, grade.users / 100);
    const result: TrainResult = { at: Math.floor(Date.now() / 1000), users: userIds.length, artists: artistIds.length, k, hitModel: grade.model, hitPopular: grade.popular, evalUsers: grade.users, quality, ms: 0 };

    const put = db.prepare("INSERT INTO taste_factors (kind, id, vec) VALUES (?, ?, ?)");
    const row = (mat: Float32Array, i: number) => new Uint8Array(mat.buffer.slice(i * k * 4, (i + 1) * k * 4));
    db.transaction(() => {
      db.run("DELETE FROM taste_factors");
      userIds.forEach((id, i) => put.run("user", id, row(model.x, i)));
      artistIds.forEach((id, i) => put.run("artist", id, row(model.y, i)));
      result.ms = Date.now() - started;
      db.run("INSERT INTO meta (key, value) VALUES ('taste_model', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [JSON.stringify(result)]);
    })();
    return result;
  } finally {
    db.close();
  }
}

self.onmessage = (ev: MessageEvent<{ path: string }>) => {
  try { postMessage({ ok: true, result: run(ev.data.path) }); }
  catch (err) { postMessage({ ok: false, error: String(err instanceof Error ? err.stack : err) }); }
};
