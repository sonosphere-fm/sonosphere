// The SQL that is particular to Postgres lives here, so repos can build everything else from the query builder and
// standard SQL.
import { sql, type AnyColumn, type SQL } from "drizzle-orm";

export type Bucket = "hour" | "day" | "week" | "month";

/**
 * Groups a Unix-seconds column into local-time buckets: hour of day (0-23), "YYYY-MM-DD", "YYYY-MM", or a week
 * number (weeks start on Monday). `offsetSeconds` shifts UTC to the reader's clock.
 */
export function timeBucket(seconds: AnyColumn, bucket: Bucket, offsetSeconds = 0): SQL<string | number> {
  const local = sql`to_timestamp(${seconds} + ${offsetSeconds}::integer) AT TIME ZONE 'UTC'`;
  if (bucket === "hour") return sql<number>`EXTRACT(HOUR FROM ${local})::integer`;
  if (bucket === "day") return sql`to_char(${local}, 'YYYY-MM-DD')`;
  if (bucket === "month") return sql`to_char(${local}, 'YYYY-MM')`;
  // the epoch fell on a Thursday, so three days are added before dividing into whole weeks
  return sql<number>`((${seconds} + ${offsetSeconds}::integer + 259200) / 604800)`;
}

/** A yes/no condition as a selected value: 1 or 0, the shape the API has always reported. */
export const flag = (condition: SQL): SQL<number> => sql<number>`(CASE WHEN ${condition} THEN 1 ELSE 0 END)`;

/** One value out of a column holding JSON text, by key (e.g. the `author` of a report's snapshot). Null when absent. */
export const jsonField = (column: AnyColumn, key: string): SQL<string | null> => sql<string | null>`(${column}::jsonb ->> ${key})`;

/**
 * True when the column contains the search term, ignoring case. `pattern` comes from `like()` in server/util.ts,
 * which escapes the wildcards in what was typed with a backslash.
 */
export const matches = (column: AnyColumn | SQL, pattern: string): SQL => sql`${column} ILIKE ${pattern} ESCAPE '\\'`;

/** A sort key that puts rows in random order. */
export const randomOrder = (): SQL => sql`RANDOM()`;
