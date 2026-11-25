import { dmCounts } from "../dm/service";
import { bad, fail } from "../http";
import { configAdmins, roleOf, syncAdmins } from "../site/roles";
import { setting } from "../site/settings";
import { findById, type User } from "../users/repo";
import { norm, rid } from "../util";
import { pendingEmail } from "./email";
import * as repo from "./repo";
import { clearActAsCookie, sessionCookie } from "./session";
import type { Me } from "../../shared/auth";
import { isLocale, type Locale } from "../../shared/i18n/core";
import { storedProfileLinks } from "../../shared/profile-links";
import { USERNAME } from "../account/username-policy";
import { usernameUnavailable } from "../account/usernames";
import { appearanceFor } from "../users/appearance";
export { USERNAME } from "../account/username-policy";

export async function me(u: User, actor?: User | null): Promise<Me> {
  return {
    ...(await appearanceFor(u.id)),
    id: u.id,
    username: u.username,
    email: u.email,
    realname: u.realname,
    pronouns: u.pronouns,
    about: u.about,
    country: u.country,
    links: storedProfileLinks(u.profileLinks),
    image: u.imageId,
    banner: u.bannerId,
    hideRecent: u.hideRecent,
    privateListening: u.privateListening,
    shoutsEnabled: u.shoutsEnabled,
    notifyPopups: u.notifyPopups,
    registeredAt: u.registeredAt,
    admin: u.isAdmin,
    role: roleOf(u),
    suspended: u.suspended,
    openReports: u.isAdmin ? await repo.openReportCount() : 0,
    unread: await repo.unreadCount(u.id),
    dm: await dmCounts(u.id),
    dmPolicy: u.dmPolicy || "requests",
    emailNotify: u.emailNotify,
    emailMuted: u.emailMuted.split(",").filter(Boolean),
    theme: u.theme === "dark" || u.theme === "system" ? u.theme : "light",
    locale: isLocale(u.locale) ? u.locale : "",
    useProfileTheme: u.useProfileTheme,
    emailVerified: !!u.emailVerifiedAt,
    pendingEmail: await pendingEmail(u.id),
    hasPassword: !!u.passwordHash,
    impersonating: actor && actor.id !== u.id ? { by: actor.username } : null,
  };
}

export const MIN_PASSWORD = 8;
export const hashPassword = (password: string): Promise<string> =>
  Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
// per account and address, so a stranger elsewhere can't lock the owner out
export const loginKey = (ip: string, ident: string, account: User | null) =>
  `login-id:${account ? account.id : `as:${norm(ident)}`}:${ip}`;
export const passwordMatches = async (u: User, password: string): Promise<boolean> =>
  !!u.passwordHash && !!password && Bun.password.verify(password, u.passwordHash);

// Accounts without a password (signed up through another site) confirm by typing their username.
export const confirmedBy = (u: User, input: string): Promise<boolean> =>
  u.passwordHash ? passwordMatches(u, input) : Promise.resolve(norm(input) === u.usernameNorm);
export const validEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

export async function startSession(headers: Headers, userId: number): Promise<void> {
  const token = rid(24);
  await repo.createSession(token, userId);
  headers.append("Set-Cookie", sessionCookie(token));
  headers.append("Set-Cookie", clearActAsCookie());
}
export async function endSession(headers: Headers, token = ""): Promise<void> {
  if (token) await repo.deleteSession(token);
  headers.append("Set-Cookie", sessionCookie("", 0));
  headers.append("Set-Cookie", clearActAsCookie());
}

export async function checkNewAccount(username: string, email: string): Promise<void> {
  const open = await setting("registrationsOpen");
  if (!open && !(await configAdmins()).includes(norm(username))) fail(403, "registrationsClosedMoment");
  if (!USERNAME.test(username)) bad("invalidUsername");
  if (!validEmail(email)) bad("enterValidEmailAddress");
  if (await usernameUnavailable(username)) bad("usernameTaken");
  if (await repo.emailTaken(email)) bad("accountEmailAlreadyExists");
}
// An empty passwordHash makes an account that signs in only through OAuth until a password is set.
export async function createAccount(
  username: string,
  email: string,
  passwordHash: string,
  locale: Locale,
  emailVerified = false
): Promise<User> {
  const id = await repo.createUser(username, email, passwordHash, locale, emailVerified);
  // an account named in ADMIN_USERS becomes staff the moment it exists
  await syncAdmins();
  return (await findById(id)) ?? fail(500, "somethingWentWrong");
}

export async function signUp(username: string, email: string, password: string, locale: Locale): Promise<User> {
  if (password.length < MIN_PASSWORD) bad("passwordsNeedLeast8Characters");
  await checkNewAccount(username, email);
  return createAccount(username, email, await hashPassword(password), locale);
}

export async function logIn(ident: string, password: string): Promise<User> {
  const u = await repo.findByLogin(norm(ident));
  if (!u || !(await passwordMatches(u, password))) return fail(401, "wrongUsernamePassword");
  if (u.banned) return fail(403, "accountBanned");
  return u;
}
