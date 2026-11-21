// Runs on its own thread (started by worker.ts): reads everyone's artist play counts, learns taste vectors (als.ts),
// checks them against listening held back from training, and stores the vectors and how much they can be trusted.
// The site never waits on this; recommendations use whatever model was stored last.
import postgres from "postgres";
import { buildMatrix, evaluate, rng, train } from "./als";

declare const self: Worker;

// Caps that keep a training run's size bounded however large the site grows.
const MAX_ARTISTS = 50_000;  // the most widely heard artists; an artist needs two listeners to say anything
const MAX_PER_USER = 500;    // a user's most played artists
const MAX_EVAL = 1_000;      // users whose held-back artist is used to grade the model
const TOP_N = 20;            // "hit" = the held-back artist is in the top 20 suggestions

export type TrainResult = { at: number; users: number; artists: number; k: number; hitModel: number; hitPopular: number; evalUsers: number; quality: number; ms: number };

async function run(url: string): Promise<TrainResult> {
  const started = Date.now();
  const db = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const artistIds = (await db<{ id: number }[]>`SELECT artist_id AS id FROM user_artists GROUP BY artist_id HAVING COUNT(*) >= 2 ORDER BY COUNT(*) DESC, artist_id LIMIT ${MAX_ARTISTS}`).map(r => r.id);
    const itemOf = new Map(artistIds.map((id, i) => [id, i]));
    // Every user's kept artists, most played first, read in batches so memory stays flat.
    const rows = new Map<number, { item: number; plays: number }[]>();
    const all = db<{ u: number; a: number; p: number }[]>`SELECT user_id AS u, artist_id AS a, plays AS p FROM user_artists WHERE plays > 0 ORDER BY user_id, plays DESC`;
    for await (const batch of all.cursor(10_000)) for (const r of batch) {
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

    const vec = (mat: Float32Array, i: number) => Buffer.from(mat.buffer.slice(i * k * 4, (i + 1) * k * 4));
    const factors = [
      ...userIds.map((id, i) => ({ kind: "user", id, vec: vec(model.x, i) })),
      ...artistIds.map((id, i) => ({ kind: "artist", id, vec: vec(model.y, i) })),
    ];
    await db.begin(async tx => {
      await tx`DELETE FROM taste_factors`;
      for (let i = 0; i < factors.length; i += 5000) await tx`INSERT INTO taste_factors ${tx(factors.slice(i, i + 5000), "kind", "id", "vec")}`;
      result.ms = Date.now() - started;
      await tx`INSERT INTO meta (key, value) VALUES ('taste_model', ${JSON.stringify(result)}) ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
    });
    return result;
  } finally {
    await db.end();
  }
}

self.onmessage = async (ev: MessageEvent<{ url: string }>) => {
  try { postMessage({ ok: true, result: await run(ev.data.url) }); }
  catch (err) { postMessage({ ok: false, error: String(err instanceof Error ? err.stack : err) }); }
};
