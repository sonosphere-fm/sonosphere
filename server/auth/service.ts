import { dmCounts } from "../dm/service";
import { bad, fail } from "../http";
import { configAdmins, roleOf, syncAdmins } from "../site/roles";
import { setting } from "../site/settings";
import { findById, type User } from "../users/repo";
import { norm, rid } from "../util";
import { pendingEmail } from "./email";
import * as repo from "./repo";
import { sessionCookie } from "./session";
import type { Me } from "../../shared/auth";

export async function me(u: User): Promise<Me> {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    realname: u.realname,
    pronouns: u.pronouns,
    about: u.about,
    country: u.country,
    website: u.website,
    image: u.imageId,
    banner: u.bannerId,
    hideRecent: u.hideRecent,
    privateListening: u.privateListening,
    shoutsEnabled: u.shoutsEnabled,
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
    emailVerified: !!u.emailVerifiedAt,
    pendingEmail: await pendingEmail(u.id),
    hasPassword: !!u.passwordHash,
  };
}

export const MIN_PASSWORD = 8;
export const hashPassword = (password: string): Promise<string> => Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
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
}
export async function endSession(headers: Headers, token = ""): Promise<void> {
  if (token) await repo.deleteSession(token);
  headers.append("Set-Cookie", sessionCookie("", 0));
}

export const USERNAME = /^[a-zA-Z][a-zA-Z0-9_-]{1,14}$/;
export async function checkNewAccount(username: string, email: string): Promise<void> {
  const open = await setting("registrationsOpen");
  if (!open && !(await configAdmins()).includes(norm(username))) fail(403, "Registrations are closed at the moment");
  if (!USERNAME.test(username)) bad("Usernames are 2–15 characters: letters, numbers, - and _, starting with a letter");
  if (!validEmail(email)) bad("Enter a valid email address");
  if (await repo.usernameTaken(username)) bad("That username is taken");
  if (await repo.emailTaken(email)) bad("An account with that email already exists");
}
// An empty passwordHash makes an account that signs in only through OAuth until a password is set.
export async function createAccount(username: string, email: string, passwordHash: string, emailVerified = false): Promise<User> {
  const id = await repo.createUser(username, email, passwordHash, emailVerified);
  // an account named in ADMIN_USERS becomes staff the moment it exists
  await syncAdmins();
  return (await findById(id)) ?? fail(500, "Something went wrong");
}

export async function signUp(username: string, email: string, password: string): Promise<User> {
  if (password.length < MIN_PASSWORD) bad("Passwords need at least 8 characters");
  await checkNewAccount(username, email);
  return createAccount(username, email, await hashPassword(password));
}

export async function logIn(ident: string, password: string): Promise<User> {
  const u = await repo.findByLogin(norm(ident));
  if (!u || !(await passwordMatches(u, password))) return fail(401, "Wrong username or password");
  if (u.banned) return fail(403, "This account has been banned");
  return u;
}
