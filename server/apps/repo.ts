// Data access for API applications: the apps people register, the sessions they grant them, and the short-lived
// tokens an app asks a user to approve.
import { and, desc, eq, gt } from "drizzle-orm";
import { db } from "../db/client";
import { apiApps, apiSessions, apiTokens, users } from "../db/schema";
import { first, now } from "../util";
import type { ApiApp, ApiSession, AppInfo } from "../../shared/apps";

/** The applications someone registered, newest first. */
export const appsOf = (userId: number): Promise<ApiApp[]> =>
  db.select({ id: apiApps.id, name: apiApps.name, description: apiApps.description, apiKey: apiApps.apiKey, secret: apiApps.secret, callbackUrl: apiApps.callbackUrl, createdAt: apiApps.createdAt })
    .from(apiApps).where(eq(apiApps.userId, userId)).orderBy(desc(apiApps.id));

/** The sessions someone has granted to applications, newest first. */
export const sessionsOf = (userId: number): Promise<ApiSession[]> =>
  db.select({ key: apiSessions.key, app: apiApps.name, createdAt: apiSessions.createdAt }).from(apiSessions)
    .innerJoin(apiApps, eq(apiApps.id, apiSessions.appId)).where(eq(apiSessions.userId, userId)).orderBy(desc(apiSessions.createdAt));

export async function createApp(app: { userId: number; name: string; description: string; apiKey: string; secret: string; callbackUrl: string }): Promise<void> {
  await db.insert(apiApps).values({ ...app, createdAt: now() });
}
/** Deletes an application if it belongs to this user. */
export async function deleteApp(id: number, userId: number): Promise<void> {
  await db.delete(apiApps).where(and(eq(apiApps.id, id), eq(apiApps.userId, userId)));
}
/** Changes an application's callback URL if it belongs to this user. */
export async function setCallback(id: number, userId: number, callbackUrl: string): Promise<void> {
  await db.update(apiApps).set({ callbackUrl }).where(and(eq(apiApps.id, id), eq(apiApps.userId, userId)));
}
/** Ends a session if it belongs to this user. */
export async function revokeSession(key: string, userId: number): Promise<void> {
  await db.delete(apiSessions).where(and(eq(apiSessions.key, key), eq(apiSessions.userId, userId)));
}

/** What anyone may know about the application with this API key. */
export const appByKey = (apiKey: string): Promise<AppInfo | null> =>
  first(db.select({ name: apiApps.name, description: apiApps.description, owner: users.username, callbackUrl: apiApps.callbackUrl }).from(apiApps)
    .innerJoin(users, eq(users.id, apiApps.userId)).where(eq(apiApps.apiKey, apiKey)).limit(1));

/** True when this token was issued to the application with this API key after `since`. */
export const tokenIssued = async (token: string, apiKey: string, since: number): Promise<boolean> =>
  !!(await first(db.select({ token: apiTokens.token }).from(apiTokens).innerJoin(apiApps, eq(apiApps.id, apiTokens.appId))
    .where(and(eq(apiTokens.token, token), eq(apiApps.apiKey, apiKey), gt(apiTokens.createdAt, since))).limit(1)));

/** The id of the application with this API key. */
export const appIdByKey = async (apiKey: string): Promise<number | null> =>
  (await first(db.select({ id: apiApps.id }).from(apiApps).where(eq(apiApps.apiKey, apiKey)).limit(1)))?.id ?? null;
/** A token issued and approved in one go: web sign-in, where the app never asked for one first. */
export async function createApprovedToken(token: string, appId: number, userId: number): Promise<void> {
  await db.insert(apiTokens).values({ token, appId, userId, createdAt: now() });
}
/** Records that a user approved a token, so the application can trade it for a session. */
export async function approveToken(token: string, userId: number): Promise<void> {
  await db.update(apiTokens).set({ userId }).where(eq(apiTokens.token, token));
}
