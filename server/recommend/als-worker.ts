import postgres from "postgres";
import { buildMatrix, evaluate, rng, train } from "./als";
import { dislikeWeight } from "./dislikes";

declare const self: Worker;

// an artist needs two listeners to say anything
const MAX_ARTISTS = 50_000;
const MAX_PER_USER = 500;
// users whose held-back artist is used to grade the model
const MAX_EVAL = 1_000;
const TOP_N = 20;

export type TrainResult = {
  at: number;
  users: number;
  artists: number;
  k: number;
  hitModel: number;
  hitPopular: number;
  evalUsers: number;
  quality: number;
  ms: number;
};

async function run(url: string): Promise<TrainResult> {
  const started = Date.now();
  const db = postgres(url, { max: 1, onnotice: () => {} });
  try {
    const artistRows = await db<{ id: number }[]>`
      SELECT artist_id AS id FROM user_artists
      GROUP BY artist_id HAVING COUNT(*) >= 2
      ORDER BY COUNT(*) DESC, artist_id LIMIT ${MAX_ARTISTS}`;
    const artistIds = artistRows.map((r) => r.id);
    const itemOf = new Map(artistIds.map((id, i) => [id, i]));

    // every user's kept artists, most played first
    const rows = new Map<number, { item: number; plays: number }[]>();
    const all = db<{ u: number; a: number; p: number }[]>`
      SELECT user_id AS u, artist_id AS a, plays AS p FROM user_artists
      WHERE plays > 0 ORDER BY user_id, plays DESC`;
    for await (const batch of all.cursor(10_000)) {
      for (const r of batch) {
        const item = itemOf.get(r.a);
        if (item === undefined) continue;
        let list = rows.get(r.u);
        if (!list) {
          list = [];
          rows.set(r.u, list);
        }
        if (list.length < MAX_PER_USER) list.push({ item, plays: r.p });
      }
    }
    const userIds = [...rows.keys()].filter((u) => rows.get(u)!.length >= 2);
    const userOf = new Map(userIds.map((u, i) => [u, i]));

    // dismissals of artists the user has not played, summed per artist
    const dismissed = new Map<string, { user: number; item: number; w: number }>();
    const at = Math.floor(Date.now() / 1000);
    const dislikes = await db<{ u: number; a: number; kind: string; at: number }[]>`
      SELECT user_id AS u, artist_id AS a, kind, created_at AS at FROM rec_dislikes`;
    for (const r of dislikes) {
      const user = userOf.get(r.u);
      const item = itemOf.get(r.a);
      if (user === undefined || item === undefined) continue;
      if (rows.get(r.u)!.some((p) => p.item === item)) continue;
      const key = `${user}:${item}`;
      const d = dismissed.get(key) ?? { user, item, w: 0 };
      d.w = Math.min(1, d.w + dislikeWeight(r.kind, r.at, at));
      dismissed.set(key, d);
    }

    // hold back one artist from a sample of users with enough history, to grade the model on
    const rand = rng(userIds.length * 7919 + artistIds.length);
    const candidates = userIds.map((u, i) => [u, i] as const).filter(([u]) => rows.get(u)!.length >= 5);
    const keepOdds = Math.min(1, MAX_EVAL / Math.max(1, candidates.length));
    const heldBack = new Map<number, number>(); // user index -> position in their list
    for (const [u, i] of candidates) {
      if (rand() < keepOdds) heldBack.set(i, Math.floor(rand() * rows.get(u)!.length));
    }

    let n = 0;
    for (const u of userIds) n += rows.get(u)!.length;
    n -= heldBack.size;
    n += dismissed.size;
    const eu = new Int32Array(n);
    const ei = new Int32Array(n);
    const ep = new Float32Array(n);
    const held: { user: number; item: number }[] = [];
    let e = 0;
    userIds.forEach((u, ui) => {
      const skip = heldBack.get(ui);
      rows.get(u)!.forEach((r, pos) => {
        if (pos === skip) {
          held.push({ user: ui, item: r.item });
          return;
        }
        eu[e] = ui;
        ei[e] = r.item;
        ep[e] = r.plays;
        e++;
      });
    });
    for (const d of dismissed.values()) {
      eu[e] = d.user;
      ei[e] = d.item;
      ep[e] = -d.w;
      e++;
    }

    let k = 48;
    if (userIds.length < 200) k = 16;
    else if (userIds.length < 5000) k = 32;
    const m = buildMatrix(userIds.length, artistIds.length, eu, ei, ep);
    const model = train(m, { k, iterations: 12, lambda: 2, alpha: 4, seed: 1 });
    const grade = evaluate(m, model, held, TOP_N);
    // trust is the edge over plain popularity, discounted while there are few users to judge by
    const edge = grade.model > 0 ? Math.max(0, (grade.model - grade.popular) / grade.model) : 0;
    const quality = grade.users < 20 ? 0 : edge * Math.min(1, grade.users / 100);
    const result: TrainResult = {
      at: Math.floor(Date.now() / 1000),
      users: userIds.length,
      artists: artistIds.length,
      k,
      hitModel: grade.model,
      hitPopular: grade.popular,
      evalUsers: grade.users,
      quality,
      ms: 0,
    };

    const vec = (mat: Float32Array, i: number) => Buffer.from(mat.buffer.slice(i * k * 4, (i + 1) * k * 4));
    const factors = [
      ...userIds.map((id, i) => ({ kind: "user", id, vec: vec(model.x, i) })),
      ...artistIds.map((id, i) => ({ kind: "artist", id, vec: vec(model.y, i) })),
    ];
    await db.begin(async (tx) => {
      await tx`DELETE FROM taste_factors`;
      for (let i = 0; i < factors.length; i += 5000) {
        await tx`INSERT INTO taste_factors ${tx(factors.slice(i, i + 5000), "kind", "id", "vec")}`;
      }
      result.ms = Date.now() - started;
      await tx`
        INSERT INTO meta (key, value) VALUES ('taste_model', ${JSON.stringify(result)})
        ON CONFLICT (key) DO UPDATE SET value = excluded.value`;
    });
    return result;
  } finally {
    await db.end();
  }
}

self.onmessage = async (ev: MessageEvent<{ url: string }>) => {
  try {
    postMessage({ ok: true, result: await run(ev.data.url) });
  } catch (err) {
    postMessage({ ok: false, error: String(err instanceof Error ? err.stack : err) });
  }
};
