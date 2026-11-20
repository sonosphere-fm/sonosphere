// Rules for accounts signing up, logging in and out, and the shape of the signed-in account sent to the browser.
import { dmCounts } from "../dm/service";
import { bad, fail } from "../http";
import { configAdmins, roleOf, syncAdmins } from "../site/roles";
import { setting } from "../site/settings";
import { findById, type User } from "../users/repo";
import { norm, rid } from "../util";
import * as repo from "./repo";
import { sessionCookie } from "./session";
import type { Me } from "../../shared/auth";

/** The signed-in account as the browser sees it. */
export async function me(u: User): Promise<Me> {
  return {
    id: u.id, username: u.username, email: u.email, realname: u.realname, about: u.about, country: u.country, website: u.website,
    image: u.imageId, hideRecent: u.hideRecent, shoutsEnabled: u.shoutsEnabled, registeredAt: u.registeredAt, admin: u.isAdmin, role: roleOf(u), suspended: u.suspended,
    openReports: u.isAdmin ? await repo.openReportCount() : 0,
    unread: await repo.unreadCount(u.id),
    dm: await dmCounts(u.id), dmPolicy: u.dmPolicy || "requests",
  };
}

// ---------- passwords ----------
export const MIN_PASSWORD = 8;
export const hashPassword = (password: string): Promise<string> => Bun.password.hash(password, { algorithm: "bcrypt", cost: 10 });
export const passwordMatches = (u: User, password: string): Promise<boolean> => Bun.password.verify(password, u.passwordHash);
export const validEmail = (email: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);

// ---------- sessions ----------
/** Signs an account in: stores a new session and sets its cookie on the response. */
export async function startSession(headers: Headers, userId: number): Promise<void> {
  const token = rid(24);
  await repo.createSession(token, userId);
  headers.append("Set-Cookie", sessionCookie(token));
}
/** Forgets the session behind a token (if any) and clears the cookie on the response. */
export async function endSession(headers: Headers, token = ""): Promise<void> {
  if (token) await repo.deleteSession(token);
  headers.append("Set-Cookie", sessionCookie("", 0));
}

// ---------- sign-up and log-in ----------
/** Creates an account after checking everything about it, and returns the stored row. */
export async function signUp(username: string, email: string, password: string): Promise<User> {
  if (!(await setting("registrationsOpen")) && !(await configAdmins()).includes(norm(username))) fail(403, "Registrations are closed at the moment");
  if (!/^[a-zA-Z][a-zA-Z0-9_-]{1,14}$/.test(username)) bad("Usernames are 2–15 characters: letters, numbers, - and _, starting with a letter");
  if (!validEmail(email)) bad("Enter a valid email address");
  if (password.length < MIN_PASSWORD) bad("Passwords need at least 8 characters");
  if (await repo.usernameTaken(username)) bad("That username is taken");
  if (await repo.emailTaken(email)) bad("An account with that email already exists");
  const id = await repo.createUser(username, email, await hashPassword(password));
  await syncAdmins(); // an account named in ADMIN_USERS becomes staff the moment it exists
  return (await findById(id)) ?? fail(500, "Something went wrong");
}

/** The account these credentials belong to. `ident` is a username or an email address. */
export async function logIn(ident: string, password: string): Promise<User> {
  const u = await repo.findByLogin(norm(ident));
  if (!u || !(await passwordMatches(u, password))) return fail(401, "Wrong username or password");
  if (u.banned) return fail(403, "This account has been banned");
  return u;
}
