import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { userTotp } from "../db/schema";
import { owner } from "../guards";
import { bad, fail, ipOf, limit, Router, tokenOf } from "../http";
import { findById } from "../users/repo";
import { setupSecret, setupTicket } from "./totp-setup";
import { loginBanned } from "./ips";
import { confirmedBy, me, startSession } from "./service";
import { consumeLogin, enableFactor, factorOf, newRecovery, pendingLogin, requireFactor, useFactor } from "./totp";
import { authenticatorUri, newTotpSecret, totpStep } from "./totp-code";
import type { Ok, Session } from "../../shared/auth";
import type { TotpRecovery, TotpSetup, TotpStatus } from "../../shared/totp";

export const router = new Router({ jsonOnly: true });

router.get<TotpStatus>("/api/me/totp", async (c) => {
  const factor = await factorOf(owner(c).id);
  return { enabled: !!factor, recoveryRemaining: factor ? (JSON.parse(factor.recovery) as string[]).length : 0 };
});

router.post<TotpSetup>("/api/me/totp/setup", async (c) => {
  const u = owner(c);
  await limit(`totp-manage:${u.id}`, 10, 300);
  if (!(await confirmedBy(u, typeof c.body.password === "string" ? c.body.password : ""))) bad("passwordIncorrect");
  if (await factorOf(u.id)) bad("twoFactorAlreadyEnabled");
  const secret = newTotpSecret();
  const ticket = setupTicket(u.id, tokenOf(c.req), u.passwordHash, secret);
  return { secret, uri: authenticatorUri(secret, u.username), ticket };
});

router.post<TotpRecovery>("/api/me/totp/enable", async (c) => {
  const u = owner(c);
  await limit(`totp-manage:${u.id}`, 10, 300);
  const secret = setupSecret(c.body.ticket, u.id, tokenOf(c.req), u.passwordHash);
  const step = secret ? totpStep(secret, c.body.code) : null;
  if (!secret || step === null) return bad("invalidTwoFactorCode");
  return enableFactor(u.id, secret, step, tokenOf(c.req));
});

router.post<Ok>("/api/me/totp/disable", async (c) => {
  const u = owner(c);
  await limit(`totp-manage:${u.id}`, 10, 300);
  const factor = await requireFactor(u.id, c.body.code);
  await db.delete(userTotp).where(and(eq(userTotp.userId, factor.userId), eq(userTotp.secret, factor.secret)));
  return { ok: true };
});

router.post<TotpRecovery>("/api/me/totp/recovery", async (c) => {
  const u = owner(c);
  await limit(`totp-manage:${u.id}`, 10, 300);
  const factor = await requireFactor(u.id, c.body.code);
  const { codes, hashes } = newRecovery();
  const changed = await db
    .update(userTotp)
    .set({ recovery: hashes })
    .where(and(eq(userTotp.userId, u.id), eq(userTotp.secret, factor.secret)))
    .returning({ id: userTotp.userId });
  if (!changed.length) bad("invalidTwoFactorCode");
  return { codes };
});

router.post<Session & { next: string }>("/api/auth/totp", async (c) => {
  await limit(`totp-login-ip:${ipOf(c.req)}`, 20, 300);
  const pending = await pendingLogin(c.req);
  if (!pending) return fail(401, "twoFactorExpired");
  await limit(`totp-login:${pending.userId}`, 10, 300);
  const u = await findById(pending.userId);
  if (!u || u.banned || (await loginBanned(u, ipOf(c.req)))) return fail(401, "twoFactorExpired");
  const factor = await factorOf(u.id);
  if (!factor || factor.secret !== pending.secret || u.passwordHash !== pending.passwordHash)
    fail(401, "twoFactorExpired");
  if (!(await useFactor(factor, c.body.code))) bad("invalidTwoFactorCode");
  if (!(await consumeLogin(c))) fail(401, "twoFactorExpired");
  await startSession(c.headers, u.id, c.req);
  return { user: await me(u), next: pending.next };
});
