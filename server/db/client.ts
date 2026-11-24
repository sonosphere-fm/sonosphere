import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { applyMigrations, checkMigrations } from "./migrate";

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
if (process.env.MIGRATIONS === "check") await checkMigrations(databaseUrl);
else await applyMigrations(databaseUrl);

export const db = drizzle(pg, { schema });
type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Conn = Db | Tx;

export const transact = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> => db.transaction(fn);

// PostgreSQL asks for another run when it picks our transaction as a deadlock victim (40P01) or loses a
// serialization race (40001). Drizzle wraps the driver error, so the SQLSTATE may sit in a cause.
const RETRYABLE = new Set(["40P01", "40001"]);
function sqlState(e: unknown): string | undefined {
  let x: unknown = e;
  for (let depth = 0; depth < 5 && x && typeof x === "object"; depth++) {
    const code = (x as { code?: unknown }).code;
    if (typeof code === "string") return code;
    x = (x as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Runs a transaction again, with a short jitter, when PostgreSQL says the attempt may be retried. */
export async function transactRetry<T>(fn: (tx: Tx) => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await transact(fn);
    } catch (e) {
      const code = sqlState(e);
      if (attempt >= attempts || !code || !RETRYABLE.has(code)) throw e;
      await new Promise((r) => setTimeout(r, 50 * attempt + Math.random() * 50));
    }
  }
}

/** Retries an async database operation on retryable PostgreSQL errors (deadlock, serialization). */
export async function retrySql<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const code = sqlState(e);
      if (attempt >= attempts || !code || !RETRYABLE.has(code)) throw e;
      await new Promise((r) => setTimeout(r, 50 * attempt + Math.random() * 50));
    }
  }
}
