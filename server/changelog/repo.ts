import { count, desc, eq } from "drizzle-orm";
import type { ChangelogPost, ChangelogText } from "../../shared/changelog";
import { db, transact } from "../db/client";
import { changelogPosts } from "../db/schema";
import { auditTx } from "../site/audit";
import { first, now } from "../util";

export const posts = (limit: number, offset: number): Promise<ChangelogPost[]> =>
  db
    .select()
    .from(changelogPosts)
    .orderBy(desc(changelogPosts.createdAt), desc(changelogPosts.id))
    .limit(limit)
    .offset(offset);

export const postCount = async () => (await db.select({ n: count() }).from(changelogPosts))[0]?.n ?? 0;

export const findPost = (id: number): Promise<ChangelogPost | null> =>
  first(db.select().from(changelogPosts).where(eq(changelogPosts.id, id)).limit(1));

export async function savePost(actor: { id: number; username: string }, text: ChangelogText, id?: number) {
  return transact(async (tx) => {
    const at = now();
    const values = { ...text, editor: actor.username, updatedAt: at };
    const rows = id
      ? await tx
          .update(changelogPosts)
          .set(values)
          .where(eq(changelogPosts.id, id))
          .returning({ id: changelogPosts.id })
      : await tx
          .insert(changelogPosts)
          .values({ ...values, author: actor.username, createdAt: at })
          .returning({ id: changelogPosts.id });
    const saved = rows[0];
    if (!saved) return null;
    await auditTx(tx, actor, {
      action: id ? "changelog.update" : "changelog.create",
      targetType: "changelog",
      targetId: saved.id,
      label: text.title,
    });
    return saved;
  });
}
