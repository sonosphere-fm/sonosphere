import { and, eq, gt, gte, inArray, isNull, lt, lte, notLike, or, sql } from "drizzle-orm";
import { UNVERIFIED_DAYS } from "../../shared/auth";
import { db, type Conn } from "../db/client";
import { apiSessions, apiTokens, emailTokens, oauthAccounts, sessions, users } from "../db/schema";
import { recordChange } from "../account/history";
import { deleteAccount } from "../account/repo";
import { bad, fail } from "../http";
import { userLocale } from "../i18n";
import { isLocale, type Locale } from "../../shared/i18n/core";
import { send } from "../mail";
import * as mail from "../mail/templates";
import { findById, type User } from "../users/repo";
import { digest, first, now, rid } from "../util";
import { emailTaken } from "./repo";

type Kind = "verify" | "change-confirm" | "change-approve" | "reset";
const LIFE: Record<Kind, number> = {
  verify: 3 * 86400,
  "change-confirm": 3 * 86400,
  "change-approve": 3600,
  reset: 3600,
};

async function issue(userId: number, kind: Kind, email: string): Promise<string> {
  const token = rid(32);
  await db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
    if (!user || ((kind === "reset" || kind === "verify") && user.email !== email)) bad("credentialsChangedTryAgain");
    await tx.delete(emailTokens).where(and(eq(emailTokens.userId, userId), eq(emailTokens.kind, kind)));
    await tx.insert(emailTokens).values({
      hash: digest(token),
      userId,
      kind,
      email,
      createdAt: now(),
      expiresAt: now() + LIFE[kind],
    });
  });
  return token;
}

async function take(token: unknown, kinds: Kind[], conn: Conn = db) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const [row] = await conn
    .delete(emailTokens)
    .where(eq(emailTokens.hash, digest(token)))
    .returning();
  if (!row || row.expiresAt < now() || !kinds.includes(row.kind as Kind)) return null;
  return row as typeof row & { kind: Kind };
}

export async function pendingEmail(userId: number): Promise<string | null> {
  const row = await first(
    db
      .select({ email: emailTokens.email })
      .from(emailTokens)
      .where(
        and(
          eq(emailTokens.userId, userId),
          inArray(emailTokens.kind, ["change-confirm", "change-approve"]),
          gt(emailTokens.expiresAt, now())
        )
      )
      .limit(1)
  );
  return row?.email ?? null;
}

export async function sendVerification(u: User, fallback: Locale): Promise<void> {
  if (u.emailVerifiedAt) return;
  const locale = isLocale(u.locale) ? u.locale : fallback;
  await send(mail.verifyMail(locale, u.email, u.username, await issue(u.id, "verify", u.email)));
}

export async function startEmailChange(u: User, email: string): Promise<void> {
  if (await emailTaken(email, u.id)) bad("emailAlreadyUse");
  const token = rid(32);
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(users).where(eq(users.id, u.id)).for("update");
    if (!current || current.email !== u.email || current.passwordHash !== u.passwordHash)
      bad("credentialsChangedRefreshTryAgain");
    await tx
      .delete(emailTokens)
      .where(
        and(eq(emailTokens.userId, u.id), inArray(emailTokens.kind, ["change", "change-confirm", "change-approve"]))
      );
    await tx.insert(emailTokens).values({
      hash: digest(token),
      userId: u.id,
      kind: "change-approve",
      email,
      createdAt: now(),
      expiresAt: now() + LIFE["change-approve"],
    });
  });
  await send(mail.approveEmailChangeMail(userLocale(u), u.email, u.username, email, token));
}

export async function confirmEmail(token: unknown): Promise<{ user: User; approvalPending: boolean }> {
  const t = await db.transaction(async (tx) => {
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return fail(400, "linkExpiredWasAlreadyUsed");
    const [pending] = await tx
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.hash, digest(token)));
    if (!pending) return fail(400, "linkExpiredWasAlreadyUsed");
    const [before] = await tx.select().from(users).where(eq(users.id, pending.userId)).for("update");
    if (!before) return fail(400, "linkExpiredWasAlreadyUsed");
    const t =
      (await take(token, ["verify", "change-confirm", "change-approve"], tx)) ?? fail(400, "linkExpiredWasAlreadyUsed");
    if (t.kind === "change-approve") {
      // Rotate the secret: access to the new inbox alone cannot approve the change.
      const next = rid(32);
      await tx.insert(emailTokens).values({
        hash: digest(next),
        userId: t.userId,
        kind: "change-confirm",
        email: t.email,
        createdAt: now(),
        expiresAt: now() + LIFE["change-confirm"],
      });
      return { ...t, next, oldEmail: before.email };
    }
    if (t.kind === "verify") {
      if (before.email !== t.email) fail(400, "linkAddressAccountNoLonger");
      if (!before.emailVerifiedAt) await tx.update(users).set({ emailVerifiedAt: now() }).where(eq(users.id, t.userId));
    }
    if (t.kind === "change-confirm") {
      if (await emailTaken(t.email, t.userId)) fail(400, "emailAlreadyUseByAnother");
      await tx.update(users).set({ email: t.email, emailVerifiedAt: now() }).where(eq(users.id, t.userId));
      await tx.delete(emailTokens).where(eq(emailTokens.userId, t.userId));
      await tx.delete(sessions).where(eq(sessions.userId, t.userId));
      await tx.delete(apiSessions).where(eq(apiSessions.userId, t.userId));
      await tx.delete(apiTokens).where(eq(apiTokens.userId, t.userId));
      await recordChange(t.userId, "email", before.email, t.email, tx);
    }
    return { ...t, next: null, oldEmail: before.email };
  });
  const u = (await findById(t.userId)) ?? fail(400, "linkExpiredWasAlreadyUsed");
  if (t.kind === "change-approve" && t.next) {
    await send(mail.changeMail(userLocale(u), t.email, u.username, t.next));
    return { user: u, approvalPending: true };
  }
  if (t.kind === "verify") {
    await send(mail.welcomeMail(userLocale(u), u.email, u.username));
  } else {
    const old = t.oldEmail;
    if (old !== t.email) await send(mail.emailChangedMail(userLocale(u), old, u.username, t.email));
  }
  return { user: (await findById(u.id))!, approvalPending: false };
}

// Silent either way, so addresses cannot be probed.
export async function requestReset(email: string): Promise<void> {
  const u = await first(db.select().from(users).where(eq(users.email, email)).limit(1));
  if (!u || u.banned) return;
  await send(mail.resetMail(userLocale(u), u.email, u.username, await issue(u.id, "reset", u.email)));
}

export async function resetPassword(token: unknown, passwordHash: string): Promise<User> {
  const expired = () => fail(400, "resetLinkExpiredWasAlready");
  const u = await db.transaction(async (tx) => {
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return expired();
    const [pending] = await tx
      .select()
      .from(emailTokens)
      .where(eq(emailTokens.hash, digest(token)));
    if (!pending) return expired();
    const [user] = await tx.select().from(users).where(eq(users.id, pending.userId)).for("update");
    const t = (await take(token, ["reset"], tx)) ?? expired();
    if (!user || user.banned || user.email !== t.email) return expired();
    await tx
      .update(users)
      .set({ passwordHash, emailVerifiedAt: user.emailVerifiedAt ?? now() })
      .where(eq(users.id, user.id));
    await tx.delete(emailTokens).where(eq(emailTokens.userId, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(apiSessions).where(eq(apiSessions.userId, user.id));
    await tx.delete(apiTokens).where(eq(apiTokens.userId, user.id));
    // whoever signed up before the owner proved the address may have left a way back in
    if (!user.emailVerifiedAt) await tx.delete(oauthAccounts).where(eq(oauthAccounts.userId, user.id));
    return user;
  });
  await send(mail.passwordChangedMail(userLocale(u), u.email, u.username));
  return (await findById(u.id))!;
}

export const passwordChanged = (u: User) => send(mail.passwordChangedMail(userLocale(u), u.email, u.username));
export const passwordSet = (u: User) => send(mail.passwordSetMail(userLocale(u), u.email, u.username));

export async function dropExpiredEmailTokens(): Promise<void> {
  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, now()));
}
const DAY = 86400;
const WARN_DAYS = [7, 3, 1];
const FINAL_WARNING = (UNVERIFIED_DAYS - 1) * DAY;
const unconfirmed = () =>
  and(isNull(users.emailVerifiedAt), eq(users.isAdmin, false), notLike(users.email, "%.invalid"));

const warningsBy = (at: number, deadline: number) => WARN_DAYS.filter((d) => at >= deadline - d * DAY).length;

export async function warnUnverified(): Promise<void> {
  const due = await db
    .select()
    .from(users)
    .where(
      and(
        unconfirmed(),
        lt(users.registeredAt, now() - (UNVERIFIED_DAYS - WARN_DAYS[0]!) * DAY),
        or(isNull(users.purgeWarnedAt), lt(users.purgeWarnedAt, sql`${users.registeredAt} + ${FINAL_WARNING}`))
      )
    )
    .limit(200);
  for (const u of due) {
    const deadline = u.registeredAt + UNVERIFIED_DAYS * DAY;
    const sent = u.purgeWarnedAt ? warningsBy(u.purgeWarnedAt, deadline) : 0;
    if (warningsBy(now(), deadline) <= sent) continue;
    const [claimed] = await db
      .update(users)
      .set({ purgeWarnedAt: now() })
      .where(
        and(
          eq(users.id, u.id),
          isNull(users.emailVerifiedAt),
          u.purgeWarnedAt ? eq(users.purgeWarnedAt, u.purgeWarnedAt) : isNull(users.purgeWarnedAt)
        )
      )
      .returning({ id: users.id });
    if (!claimed) continue;
    const days = Math.max(1, Math.ceil((deadline - now()) / DAY));
    await send(mail.purgeWarningMail(userLocale(u), u.email, u.username, days, await issue(u.id, "verify", u.email)));
  }
}

// Imported profiles have placeholder addresses (@x.invalid) that can never be confirmed, so they are kept.
// Nobody is deleted until a day after their last warning.
export async function purgeUnverified(): Promise<void> {
  const due = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        unconfirmed(),
        lt(users.registeredAt, now() - UNVERIFIED_DAYS * DAY),
        gte(users.purgeWarnedAt, sql`${users.registeredAt} + ${FINAL_WARNING}`),
        lte(users.purgeWarnedAt, now() - DAY)
      )
    )
    .limit(200);
  let purged = 0;
  for (const u of due) {
    // the condition re-checks in case they confirmed just now
    if (await deleteAccount(u.id, isNull(users.emailVerifiedAt))) purged++;
  }
  if (purged) console.log(`purged ${purged} unconfirmed account(s)`);
}
