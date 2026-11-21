import { sql, type AnyColumn, type SQL } from "drizzle-orm";

export type Bucket = "hour" | "day" | "week" | "month";

/** Hour of day (0-23), "YYYY-MM-DD", "YYYY-MM", or a Monday-based week number, on the reader's clock. */
export function timeBucket(seconds: AnyColumn, bucket: Bucket, offsetSeconds = 0): SQL<string | number> {
  const local = sql`to_timestamp(${seconds} + ${offsetSeconds}::integer) AT TIME ZONE 'UTC'`;
  if (bucket === "hour") return sql<number>`EXTRACT(HOUR FROM ${local})::integer`;
  if (bucket === "day") return sql`to_char(${local}, 'YYYY-MM-DD')`;
  if (bucket === "month") return sql`to_char(${local}, 'YYYY-MM')`;
  // the epoch fell on a Thursday, so three days are added before dividing into whole weeks
  return sql<number>`((${seconds} + ${offsetSeconds}::integer + 259200) / 604800)`;
}

export const flag = (condition: SQL): SQL<number> => sql<number>`(CASE WHEN ${condition} THEN 1 ELSE 0 END)`;

export const jsonField = (column: AnyColumn, key: string): SQL<string | null> => sql<string | null>`(${column}::jsonb ->> ${key})`;

/** `pattern` comes from like() in server/util.ts. */
export const matches = (column: AnyColumn | SQL, pattern: string): SQL => sql`${column} ILIKE ${pattern} ESCAPE '\\'`;

export const randomOrder = (): SQL => sql`RANDOM()`;
