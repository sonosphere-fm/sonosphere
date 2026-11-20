// The SQL that only SQLite understands lives here, so a move to another database starts with this file.
// Repos build everything else from the query builder and standard SQL.
import { sql, type AnyColumn, type SQL } from "drizzle-orm";

export type Bucket = "hour" | "day" | "week" | "month";

/**
 * Groups a Unix-seconds column into local-time buckets: hour of day (0-23), "YYYY-MM-DD", "YYYY-MM", or a week
 * number (weeks start on Monday). `offsetSeconds` shifts UTC to the reader's clock.
 */
export function timeBucket(seconds: AnyColumn, bucket: Bucket, offsetSeconds = 0): SQL<string | number> {
  const local = sql`(${seconds} + ${offsetSeconds})`;
  if (bucket === "hour") return sql`CAST(strftime('%H', ${local}, 'unixepoch') AS INTEGER)`;
  if (bucket === "day") return sql`strftime('%Y-%m-%d', ${local}, 'unixepoch')`;
  if (bucket === "month") return sql`strftime('%Y-%m', ${local}, 'unixepoch')`;
  // the epoch fell on a Thursday, so three days are added before dividing into whole weeks
  return sql`(${local} + 259200) / 604800`;
}

/** A yes/no condition as a selected value: 1 or 0, which is how SQLite reports a boolean expression. */
export const flag = (condition: SQL): SQL<number> => sql<number>`(${condition})`;

/** One value out of a column holding JSON text, by key (e.g. the `author` of a report's snapshot). Null when absent. */
export const jsonField = (column: AnyColumn, key: string): SQL<string | null> => sql<string | null>`json_extract(${column}, ${"$." + key})`;

/**
 * True when the column contains the search term. `pattern` comes from `like()` in server/util.ts, which escapes
 * the wildcards in what was typed with a backslash. SQLite's LIKE ignores ASCII case; other databases need ILIKE here.
 */
export const matches = (column: AnyColumn | SQL, pattern: string): SQL => sql`${column} LIKE ${pattern} ESCAPE '\\'`;

/** A sort key that puts rows in random order. */
export const randomOrder = (): SQL => sql`RANDOM()`;
