// Applies the migrations in server/db/migrations (generated from schema.ts by `bun run db:generate`).
// A lock makes sure that when two processes start together (a rolling deploy) only one of them migrates.
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { join } from "node:path";

export async function applyMigrations(url: string) {
  const one = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await one`SELECT pg_advisory_lock(727001)`;
    await migrate(drizzle(one), { migrationsFolder: join(import.meta.dir, "migrations") });
  } finally {
    await one.end();
  }
}
