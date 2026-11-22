import { and, count, desc, eq } from "drizzle-orm";
import { db, transact, type Tx } from "../db/client";
import { journals, shouts } from "../db/schema";
import { first, now } from "../util";

export type Journal = typeof journals.$inferSelect;
export type JournalText = { title: string; body: string };

const total = async (rows: PromiseLike<{ c: number }[]>) => (await rows)[0]?.c ?? 0;

export const journalsOf = (userId: number, limit: number, offset: number): Promise<Journal[]> =>
  db
    .select()
    .from(journals)
    .where(eq(journals.userId, userId))
    .orderBy(desc(journals.createdAt), desc(journals.id))
    .limit(limit)
    .offset(offset);

export const journalCount = (userId: number): Promise<number> =>
  total(db.select({ c: count() }).from(journals).where(eq(journals.userId, userId)));

export const findJournal = (id: number): Promise<Journal | null> =>
  first(db.select().from(journals).where(eq(journals.id, id)).limit(1));

export const findOwnJournal = (id: number, userId: number): Promise<Journal | null> =>
  first(
    db
      .select()
      .from(journals)
      .where(and(eq(journals.id, id), eq(journals.userId, userId)))
      .limit(1)
  );

export const commentCount = (journalId: number): Promise<number> =>
  total(
    db
      .select({ c: count() })
      .from(shouts)
      .where(and(eq(shouts.targetType, "journal"), eq(shouts.targetId, journalId)))
  );

export async function createJournal(userId: number, text: JournalText): Promise<number> {
  const [row] = await db
    .insert(journals)
    .values({ userId, ...text, createdAt: now(), updatedAt: now() })
    .returning({ id: journals.id });
  if (!row) throw new Error("The post was not saved");
  return row.id;
}

export async function updateJournal(id: number, text: JournalText): Promise<void> {
  await db
    .update(journals)
    .set({ ...text, updatedAt: now() })
    .where(eq(journals.id, id));
}

export async function dropJournalTx(tx: Tx, id: number): Promise<void> {
  await tx.delete(shouts).where(and(eq(shouts.targetType, "journal"), eq(shouts.targetId, id)));
  await tx.delete(journals).where(eq(journals.id, id));
}

export async function dropJournal(id: number): Promise<void> {
  await transact((tx) => dropJournalTx(tx, id));
}
