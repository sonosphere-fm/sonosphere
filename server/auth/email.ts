import { and, eq, gt, isNull, lt, notLike } from "drizzle-orm";
import { UNVERIFIED_DAYS } from "../../shared/auth";
import { db } from "../db/client";
import { emailTokens, users } from "../db/schema";
import { deleteAccount } from "../account/repo";
import { bad, fail } from "../http";
import { send } from "../mail";
import * as mail from "../mail/templates";
import { findById, type User } from "../users/repo";
import { digest, first, now, rid } from "../util";
import { deleteSessionsOf, emailTaken } from "./repo";

type Kind = "verify" | "change" | "reset";
const LIFE: Record<Kind, number> = { verify: 3 * 86400, change: 3 * 86400, reset: 3600 };

async function issue(userId: number, kind: Kind, email: string): Promise<string> {
  const token = rid(32);
  await db.transaction(async (tx) => {
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

async function take(token: unknown, kinds: Kind[]) {
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return null;
  const [row] = await db
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
      .where(and(eq(emailTokens.userId, userId), eq(emailTokens.kind, "change"), gt(emailTokens.expiresAt, now())))
      .limit(1)
  );
  return row?.email ?? null;
}

export async function sendVerification(u: User): Promise<void> {
  if (u.emailVerifiedAt) return;
  await send(mail.verifyMail(u.email, u.username, await issue(u.id, "verify", u.email)));
}

export async function startEmailChange(u: User, email: string): Promise<void> {
  if (await emailTaken(email, u.id)) bad("That email is already in use");
  await send(mail.changeMail(email, u.username, await issue(u.id, "change", email)));
}

export async function confirmEmail(token: unknown): Promise<User> {
  const t = (await take(token, ["verify", "change"])) ?? fail(400, "That link has expired or was already used");
  const u = (await findById(t.userId)) ?? fail(400, "That link has expired or was already used");
  if (t.kind === "verify") {
    if (u.email !== t.email) fail(400, "That link is for an address this account no longer uses");
    if (!u.emailVerifiedAt) {
      await db.update(users).set({ emailVerifiedAt: now() }).where(eq(users.id, u.id));
      await send(mail.welcomeMail(u.email, u.username));
    }
  } else {
    if (await emailTaken(t.email, u.id)) fail(400, "That email is already in use by another account");
    const old = u.email;
    await db.update(users).set({ email: t.email, emailVerifiedAt: now() }).where(eq(users.id, u.id));
    await db.delete(emailTokens).where(and(eq(emailTokens.userId, u.id), eq(emailTokens.kind, "verify")));
    if (old !== t.email) await send(mail.emailChangedMail(old, u.username, t.email));
  }
  return (await findById(u.id))!;
}

// Silent either way, so addresses cannot be probed.
export async function requestReset(email: string): Promise<void> {
  const u = await first(db.select().from(users).where(eq(users.email, email)).limit(1));
  if (!u || u.banned) return;
  await send(mail.resetMail(u.email, u.username, await issue(u.id, "reset", u.email)));
}

export async function resetPassword(token: unknown, passwordHash: string): Promise<User> {
  const t =
    (await take(token, ["reset"])) ?? fail(400, "That reset link has expired or was already used. Ask for a new one.");
  const u =
    (await findById(t.userId)) ?? fail(400, "That reset link has expired or was already used. Ask for a new one.");
  if (u.email !== t.email)
    fail(400, "That reset link was sent to an address this account no longer uses. Ask for a new one.");
  // the link reached the address, so it counts as confirmed
  await db
    .update(users)
    .set({ passwordHash, emailVerifiedAt: u.emailVerifiedAt ?? now() })
    .where(eq(users.id, u.id));
  await deleteSessionsOf(u.id);
  await send(mail.passwordChangedMail(u.email, u.username));
  return (await findById(u.id))!;
}

export const passwordChanged = (u: User) => send(mail.passwordChangedMail(u.email, u.username));
export const passwordSet = (u: User) => send(mail.passwordSetMail(u.email, u.username));

export async function dropExpiredEmailTokens(): Promise<void> {
  await db.delete(emailTokens).where(lt(emailTokens.expiresAt, now()));
}
// Imported profiles have placeholder addresses (@x.invalid) that can never be confirmed, so they are kept.
export async function purgeUnverified(): Promise<void> {
  const due = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(
      and(
        isNull(users.emailVerifiedAt),
        lt(users.registeredAt, now() - UNVERIFIED_DAYS * 86400),
        eq(users.isAdmin, false),
        notLike(users.email, "%.invalid")
      )
    )
    .limit(200);
  const purged: string[] = [];
  for (const u of due) {
    // the condition re-checks in case they confirmed just now
    if (await deleteAccount(u.id, isNull(users.emailVerifiedAt))) purged.push(u.username);
  }
  if (purged.length) console.log(`purged ${purged.length} unconfirmed account(s): ${purged.join(", ")}`);
}
