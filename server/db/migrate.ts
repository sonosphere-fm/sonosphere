// Applies the migrations in server/db/migrations (generated from schema.ts by `bun run db:generate`).
import type { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const folder = join(import.meta.dir, "migrations");

export function applyMigrations(sqlite: Database) {
  adoptExisting(sqlite);
  migrate(drizzle(sqlite), { migrationsFolder: folder });
}

/**
 * Databases created before migrations existed already contain every table in the baseline, so the baseline is
 * recorded as applied instead of being run against them.
 */
function adoptExisting(sqlite: Database) {
  const has = (table: string) => !!sqlite.query("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  if (has("__drizzle_migrations") || !has("users")) return;
  if (!has("dm_flags") || !has("video_cache")) throw new Error("This database predates the migration baseline: start the previous release once to bring it up to date, then try again.");
  const journal = JSON.parse(readFileSync(join(folder, "meta/_journal.json"), "utf8")) as { entries: { tag: string; when: number }[] };
  const baseline = journal.entries[0]!;
  const hash = new Bun.CryptoHasher("sha256").update(readFileSync(join(folder, `${baseline.tag}.sql`), "utf8")).digest("hex");
  sqlite.exec("CREATE TABLE IF NOT EXISTS __drizzle_migrations (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at numeric)");
  sqlite.query("INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)").run(hash, baseline.when);
}
