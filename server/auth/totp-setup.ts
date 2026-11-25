import { seal, unseal } from "../seal";
import { digest, now } from "../util";

type Setup = {
  purpose: "totp-setup";
  userId: number;
  session: string;
  passwordHash: string;
  secret: string;
  expiresAt: number;
};

export function setupTicket(userId: number, session: string, passwordHash: string, secret: string): string {
  const setup: Setup = {
    purpose: "totp-setup",
    userId,
    session: digest(session),
    passwordHash,
    secret,
    expiresAt: now() + 10 * 60,
  };
  return seal(JSON.stringify(setup));
}

export function setupSecret(ticket: unknown, userId: number, session: string, passwordHash: string): string | null {
  if (typeof ticket !== "string" || ticket.length > 4096 || !session) return null;
  const plain = unseal(ticket);
  if (!plain) return null;
  try {
    const setup: unknown = JSON.parse(plain);
    if (!setup || typeof setup !== "object") return null;
    const value = setup as Partial<Setup>;
    if (
      value.purpose !== "totp-setup" ||
      value.userId !== userId ||
      value.session !== digest(session) ||
      value.passwordHash !== passwordHash ||
      typeof value.expiresAt !== "number" ||
      value.expiresAt <= now() ||
      typeof value.secret !== "string" ||
      !/^[A-Z2-7]{32}$/.test(value.secret)
    )
      return null;
    return value.secret;
  } catch {
    return null;
  }
}
