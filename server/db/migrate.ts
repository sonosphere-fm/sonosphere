import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { join } from "node:path";

const migrationsFolder = join(import.meta.dir, "migrations");
const ROLLBACK = new Error("rollback");

export async function applyMigrations(url: string) {
  const one = postgres(url, { max: 1, onnotice: () => {} });
  try {
    // two processes starting together must not both migrate
    await one`SELECT pg_advisory_lock(727001)`;
    await migrate(drizzle(one), { migrationsFolder });
  } finally {
    await one.end();
  }
}

// Deploy preflight: prove pending migrations apply, then roll back so the live release keeps its schema.
export async function checkMigrations(url: string) {
  const one = postgres(url, { max: 1, onnotice: () => {} });
  try {
    await one.begin(async (tx) => {
      const [table] = await tx`SELECT to_regclass('drizzle.__drizzle_migrations') AS t`;
      const [last] = table?.t ? await tx`SELECT max(created_at) AS at FROM drizzle.__drizzle_migrations` : [];
      for (const m of readMigrationFiles({ migrationsFolder })) {
        if (Number(last?.at ?? 0) >= m.folderMillis) continue;
        for (const statement of m.sql) await tx.unsafe(statement);
      }
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  } finally {
    await one.end();
  }
}
