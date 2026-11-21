// The one place that opens the database. Everything else reaches it through `db` (a Drizzle handle).
// Only repo files (server/<domain>/repo.ts) should import this.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { applyMigrations } from "./migrate";

export const databaseUrl = process.env.DATABASE_URL || "postgres://localhost/sonosphere";

// Postgres sends 64-bit integers and exact decimals (SUM, AVG, big catalogue totals) as text, so they are read back as
// plain numbers here; nothing the site counts comes near 2^53.
const asNumber = { to: 0, from: [20, 1700], serialize: (v: number) => String(v), parse: (v: string) => Number(v) };
export const pg = postgres(databaseUrl, {
  max: Number(process.env.DB_POOL) || 10,
  onnotice: () => {},
  types: { asNumber },
});
await applyMigrations(databaseUrl);

export const db = drizzle(pg, { schema });
export type Db = typeof db;
/** A transaction handle: has the same query methods as `db`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either of the two, for repo functions that can run inside or outside a transaction. */
export type Conn = Db | Tx;

/** Runs `fn` in a transaction: every query inside goes through `tx`, and all of them commit or none do. */
export const transact = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => db.transaction(fn);
