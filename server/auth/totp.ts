import { and, eq, lt, ne } from "drizzle-orm";
import { db, transact } from "../db/client";
import { sessions, userTotp } from "../db/schema";
import { fail, type Ctx } from "../http";
import { getJson, setJson, takeJson } from "../kv";
import { seal, unseal } from "../seal";
import { digest, rid } from "../util";
import type { User } from "../users/repo";
import { SECURE, hexCookie } from "./session";
import { me, startSession } from "./service";
import { recoveryCodes, totpStep } from "./totp-code";
import type { LoginResult } from "../../shared/totp";

type Factor = typeof userTotp.$inferSelect;
type Challenge = { userId: number; passwordHash: string; secret: string; next: string };
const LIFE = 5 * 60;
const cookie = (token: string, age = LIFE) =>
  `two_factor=${token}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=${age}${SECURE}`;
const keyOf = (token: string) => `totp:login:${digest(token)}`;

export const factorOf = async (userId: number) =>
  (await db.select().from(userTotp).where(eq(userTotp.userId, userId)))[0] ?? null;

export async function finishLogin(c: Ctx, u: User, next = "/"): Promise<LoginResult> {
  const factor = await factorOf(u.id);
  if (factor) {
    const token = rid(24);
    await setJson(
      keyOf(token),
      { userId: u.id, passwordHash: u.passwordHash, secret: factor.secret, next },
      LIFE * 1000
    );
    c.headers.append("Set-Cookie", cookie(token));
    return { twoFactor: true };
  }
  await startSession(c.headers, u.id);
  return { user: await me(u) };
}

export async function pendingLogin(req: Request): Promise<Challenge | null> {
  const token = hexCookie(req, "two_factor");
  return token ? getJson<Challenge>(keyOf(token)) : null;
}

export async function consumeLogin(c: Ctx): Promise<boolean> {
  const token = hexCookie(c.req, "two_factor");
  const taken = token ? await takeJson<Challenge>(keyOf(token)) : null;
  if (!taken) return false;
  c.headers.append("Set-Cookie", cookie("", 0));
  return true;
}

export async function useFactor(factor: Factor, input: unknown): Promise<boolean> {
  if (typeof input !== "string") return false;
  const secret = unseal(factor.secret);
  const step = secret ? totpStep(secret, input) : null;
  if (step !== null) {
    const changed = await db
      .update(userTotp)
      .set({ lastStep: step })
      .where(and(eq(userTotp.userId, factor.userId), eq(userTotp.secret, factor.secret), lt(userTotp.lastStep, step)))
      .returning({ id: userTotp.userId });
    return changed.length === 1;
  }
  if (!/^[a-f0-9]{16}$/.test(input)) return false;
  const hashes = JSON.parse(factor.recovery) as string[];
  const hash = digest(input);
  if (!hashes.includes(hash)) return false;
  const changed = await db
    .update(userTotp)
    .set({ recovery: JSON.stringify(hashes.filter((h) => h !== hash)) })
    .where(
      and(
        eq(userTotp.userId, factor.userId),
        eq(userTotp.secret, factor.secret),
        eq(userTotp.recovery, factor.recovery)
      )
    )
    .returning({ id: userTotp.userId });
  return changed.length === 1;
}

export async function requireFactor(userId: number, code: unknown): Promise<Factor> {
  const factor = await factorOf(userId);
  if (!factor || !(await useFactor(factor, code))) fail(401, "invalidTwoFactorCode");
  return factor;
}

export const newRecovery = () => {
  const codes = recoveryCodes();
  return { codes, hashes: JSON.stringify(codes.map(digest)) };
};

export async function enableFactor(userId: number, secret: string, step: number, session: string) {
  const { codes, hashes } = newRecovery();
  await transact(async (tx) => {
    const inserted = await tx
      .insert(userTotp)
      .values({ userId, secret: seal(secret), lastStep: step, recovery: hashes })
      .onConflictDoNothing()
      .returning({ id: userTotp.userId });
    if (!inserted.length) fail(400, "twoFactorAlreadyEnabled");
    // Keep only the browser that proved possession of the authenticator.
    await tx.delete(sessions).where(and(eq(sessions.userId, userId), ne(sessions.token, digest(session))));
  });
  return { codes };
}
