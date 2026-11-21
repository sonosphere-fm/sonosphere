import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { applyMigrations } from "./migrate";

export const databaseUrl = process.env.DATABASE_URL || "postgres://localhost/sonosphere";

// Postgres sends bigint and numeric (SUM, AVG) as text; nothing the site counts comes near 2^53
const asNumber = { to: 0, from: [20, 1700], serialize: (v: number) => String(v), parse: (v: string) => Number(v) };
const g = globalThis as { __spinPg?: ReturnType<typeof postgres<{ asNumber: typeof asNumber }>> };
export const pg = (g.__spinPg ??= postgres(databaseUrl, {
  max: Number(process.env.DB_POOL) || 10,
  idle_timeout: 60,
  onnotice: () => {},
  types: { asNumber },
}));
await applyMigrations(databaseUrl);

export const db = drizzle(pg, { schema });
type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Conn = Db | Tx;

export const transact = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => db.transaction(fn);
