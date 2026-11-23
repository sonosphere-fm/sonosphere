import { count, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { mailLog } from "../db/schema";
import { Router } from "../http";
import { now } from "../util";
import { SITE_URL } from ".";

export const router = new Router();

const logo = await Bun.file(new URL("./logo.png", import.meta.url)).bytes();
const valid = (token: string) => /^[0-9a-f]{32}$/.test(token);

router.get("/api/mail/:token/logo.png", async (c) => {
  const token = c.params[0]!;
  if (valid(token)) {
    await db
      .update(mailLog)
      .set({ openedAt: sql`coalesce(${mailLog.openedAt}, ${now()})`, opens: sql`${mailLog.opens} + 1` })
      .where(eq(mailLog.token, token));
  }
  return new Response(logo, { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
});

router.get("/api/mail/:token/go", async (c) => {
  const token = c.params[0]!;
  if (valid(token)) {
    const t = now();
    await db
      .update(mailLog)
      .set({
        openedAt: sql`coalesce(${mailLog.openedAt}, ${t})`,
        clickedAt: sql`coalesce(${mailLog.clickedAt}, ${t})`,
      })
      .where(eq(mailLog.token, token));
  }
  return new Response(null, { status: 302, headers: { Location: SITE_URL, "Cache-Control": "no-store" } });
});

export async function mailStats(from: number) {
  const [r] = await db
    .select({ sent: count(), opened: count(mailLog.openedAt), clicked: count(mailLog.clickedAt) })
    .from(mailLog)
    .where(gte(mailLog.sentAt, from));
  return { sent: r?.sent ?? 0, opened: r?.opened ?? 0, clicked: r?.clicked ?? 0 };
}

export async function dropOldMailLog(): Promise<void> {
  await db.delete(mailLog).where(lt(mailLog.sentAt, now() - 180 * 86400));
}
