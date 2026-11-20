// The one place that opens the database. Everything else reaches it through `db` (a Drizzle handle).
// Only repo files (server/<domain>/repo.ts) should import this.
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import * as schema from "./schema";
import { applyMigrations } from "./migrate";

const path = process.env.DB_PATH || "data/needle.db";
mkdirSync(dirname(path), { recursive: true });
export const sqlite = new Database(path, { create: true });
// busy_timeout lets two server processes share the file for the few seconds a rolling deploy overlaps them.
sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA synchronous = NORMAL; PRAGMA busy_timeout = 5000;");
applyMigrations(sqlite);

export const db = drizzle(sqlite, { schema });
export type Db = typeof db;
/** A transaction handle: has the same query methods as `db`. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Either of the two, for repo functions that can run inside or outside a transaction. */
export type Conn = Db | Tx;

/**
 * Runs `fn` in a transaction. The SQLite driver is synchronous, so `fn` must not be async: inside it, finish each
 * query with .all(), .get() or .run() instead of awaiting it. (This is the one spot that would change on a move
 * to an async database such as Postgres, where the callback becomes async.)
 */
export const transact = <T>(fn: (tx: Tx) => T): T => db.transaction(fn);
