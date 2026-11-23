import { and, asc, eq, inArray } from "drizzle-orm";
import { db, transact } from "../db/client";
import { dmGroupReactions, dmReactions } from "../db/schema";
import { fail } from "../http";
import { attempt } from "../kv";
import { now } from "../util";
import { DM_REACTIONS, type DmReaction } from "../../shared/dm";

const tables = { dm: dmReactions, group: dmGroupReactions };
type Kind = keyof typeof tables;

export async function reactionsOf(kind: Kind, ids: number[]): Promise<Map<number, DmReaction[]>> {
  const out = new Map<number, DmReaction[]>();
  if (!ids.length) return out;
  const t = tables[kind];
  const rows = await db
    .select({ messageId: t.messageId, userId: t.userId, emoji: t.emoji })
    .from(t)
    .where(inArray(t.messageId, ids))
    .orderBy(asc(t.createdAt));
  for (const r of rows) {
    const list = out.get(r.messageId) ?? [];
    const found = list.find((x) => x.emoji === r.emoji);
    if (found) found.users.push(r.userId);
    else list.push({ emoji: r.emoji, users: [r.userId] });
    out.set(r.messageId, list);
  }
  return out;
}

export async function checkReaction(userId: number, emoji: unknown): Promise<string> {
  const picked = DM_REACTIONS.find((e) => e === emoji) ?? fail(400, "Pick one of the reactions");
  if (!(await attempt(`dm-react:${userId}`, 60, 60_000))) fail(429, "You're reacting too quickly");
  return picked;
}

// Adds the reaction, or takes it away if it was already there.
export async function toggle(kind: Kind, messageId: number, userId: number, emoji: string): Promise<DmReaction[]> {
  const t = tables[kind];
  await transact(async (tx) => {
    const mine = and(eq(t.messageId, messageId), eq(t.userId, userId), eq(t.emoji, emoji));
    const gone = await tx.delete(t).where(mine).returning({ emoji: t.emoji });
    if (!gone.length) {
      await tx.insert(t).values({ messageId, userId, emoji, createdAt: now() }).onConflictDoNothing();
    }
  });
  return (await reactionsOf(kind, [messageId])).get(messageId) ?? [];
}
