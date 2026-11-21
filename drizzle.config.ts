import { defineConfig } from "drizzle-kit";

// Used by `bun run db:generate` to turn changes in server/db/schema.ts into a migration file.
export default defineConfig({ dialect: "postgresql", schema: "./server/db/schema.ts", out: "./server/db/migrations" });
