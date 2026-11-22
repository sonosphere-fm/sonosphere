import { db, type Conn } from "../db/client";
import { accountHistory } from "../db/schema";
import { now } from "../util";

export async function recordChange(userId: number, field: string, previous: string, next: string, conn: Conn = db) {
  if (previous === next) return;
  await conn.insert(accountHistory).values({ userId, field, previous, next, createdAt: now() });
}
