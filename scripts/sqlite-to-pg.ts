// One-off move of a SQLite database (the format before Postgres) into the Postgres database in DATABASE_URL.
// Ids are kept, so links and sessions carry over. The target must be empty unless --replace is given.
// Usage: DATABASE_URL=postgres://... bun scripts/sqlite-to-pg.ts path/to/needle.db [--replace]
// Needs a role that may set session_replication_role (the database owner as superuser), so foreign keys and the
// play-count triggers stay quiet while rows arrive in table order; the copied totals are taken as they are.
import { Database } from "bun:sqlite";
import postgres from "postgres";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../server/db/schema";
import { applyMigrations } from "../server/db/migrate";

const [file, flag] = process.argv.slice(2);
const url = process.env.DATABASE_URL;
if (!file || !url) { console.error("usage: DATABASE_URL=... bun scripts/sqlite-to-pg.ts <sqlite file> [--replace]"); process.exit(1); }

await applyMigrations(url);
const lite = new Database(file, { readwrite: true, create: false }); // not read-only: a database in WAL mode needs its shared-memory file even to read
const pg = postgres(url, { max: 1, onnotice: () => {} });
const tables = Object.values(schema).filter((t): t is PgTable => t instanceof PgTable).map(t => getTableConfig(t));
const present = new Set(lite.query<{ name: string }, []>("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(r => r.name));

await pg.begin(async tx => {
  await tx`SET LOCAL session_replication_role = replica`;
  const names = tables.map(t => t.name);
  const [{ n }] = await tx<{ n: number }[]>`SELECT COALESCE(SUM(c), 0)::int AS n FROM (${tx.unsafe(names.map(t => `SELECT COUNT(*) AS c FROM "${t}"`).join(" UNION ALL "))}) x`;
  if (n > 0) {
    if (flag !== "--replace") throw new Error(`the target already holds ${n} rows; pass --replace to empty it first`);
    await tx.unsafe(`TRUNCATE ${names.map(t => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  }
  for (const t of tables) {
    if (!present.has(t.name)) { console.log(`${t.name}: not in the SQLite file, skipped`); continue; }
    const have = new Set(lite.query<{ name: string }, []>(`SELECT name FROM pragma_table_info('${t.name}')`).all().map(r => r.name));
    const cols = t.columns.filter(c => have.has(c.name));
    const bools = new Set(cols.filter(c => c.columnType === "PgBoolean").map(c => c.name));
    const bytes = new Set(cols.filter(c => c.getSQLType() === "bytea").map(c => c.name));
    const select = lite.query<Record<string, unknown>, []>(`SELECT ${cols.map(c => `"${c.name}"`).join(", ")} FROM "${t.name}"`);
    let batch: Record<string, unknown>[] = [], copied = 0, nul = 0;
    const flush = async () => {
      if (!batch.length) return;
      try { await tx`INSERT INTO ${tx(t.name)} ${tx(batch, cols.map(c => c.name))}`; }
      catch (e) { throw new Error(`${t.name}: ${e instanceof Error ? e.message : e}`); }
      copied += batch.length; batch = [];
    };
    for (const row of select.iterate()) {
      // video lookup keys used NUL between artist and track; they now use the unit separator
      if (t.name === "video_cache" && typeof row.key === "string") row.key = row.key.replaceAll("\0", "\u001f");
      for (const k in row) if (typeof row[k] === "string" && row[k].includes("\0")) { row[k] = (row[k] as string).replaceAll("\0", ""); nul++; }
      for (const k of bools) if (row[k] !== null) row[k] = !!row[k];
      for (const k of bytes) if (row[k] instanceof Uint8Array) row[k] = Buffer.from(row[k] as Uint8Array);
      batch.push(row);
      if (batch.length >= 2000) await flush();
    }
    await flush();
    // identity columns continue after the highest copied id
    for (const c of cols.filter(c => c.generatedIdentity)) {
      await tx.unsafe(`SELECT setval(pg_get_serial_sequence('"${t.name}"', '${c.name}'), GREATEST((SELECT MAX("${c.name}") FROM "${t.name}"), 1))`);
    }
    const source = lite.query<{ c: number }, []>(`SELECT COUNT(*) AS c FROM "${t.name}"`).get()!.c;
    if (source !== copied) throw new Error(`${t.name}: copied ${copied} of ${source} rows`);
    console.log(`${t.name}: ${copied}${nul ? ` (NUL characters removed from ${nul} values, which Postgres cannot store)` : ""}`);
  }
});
await pg.end();
lite.close();
console.log("done");
