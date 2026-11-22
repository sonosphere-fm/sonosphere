import { and, desc, eq, gt, sql } from "drizzle-orm";
import { db } from "../db/client";
import { apiApps, apiSessions, apiTokens, users } from "../db/schema";
import { digest, first, now } from "../util";
import type { ApiApp, ApiSession, AppInfo } from "../../shared/apps";

export const appsOf = (userId: number): Promise<ApiApp[]> =>
  db
    .select({
      id: apiApps.id,
      name: apiApps.name,
      description: apiApps.description,
      apiKey: apiApps.apiKey,
      secret: apiApps.secret,
      callbackUrl: apiApps.callbackUrl,
      createdAt: apiApps.createdAt,
    })
    .from(apiApps)
    .where(eq(apiApps.userId, userId))
    .orderBy(desc(apiApps.id));

export const sessionsOf = (userId: number): Promise<ApiSession[]> =>
  db
    .select({
      key: apiSessions.key,
      app: apiApps.name,
      createdAt: apiSessions.createdAt,
      lastUsedAt: apiSessions.lastUsedAt,
    })
    .from(apiSessions)
    .innerJoin(apiApps, eq(apiApps.id, apiSessions.appId))
    .where(eq(apiSessions.userId, userId))
    .orderBy(desc(apiSessions.createdAt));

export async function createApp(app: {
  userId: number;
  name: string;
  description: string;
  apiKey: string;
  secret: string;
  callbackUrl: string;
}): Promise<void> {
  await db.insert(apiApps).values({ ...app, createdAt: now() });
}
export async function deleteApp(id: number, userId: number): Promise<void> {
  await db.delete(apiApps).where(and(eq(apiApps.id, id), eq(apiApps.userId, userId)));
}
export async function setCallback(id: number, userId: number, callbackUrl: string): Promise<void> {
  await db
    .update(apiApps)
    .set({ callbackUrl })
    .where(and(eq(apiApps.id, id), eq(apiApps.userId, userId)));
}
// `key` is the id sessionsOf gave out: the stored digest, never the key itself.
export async function revokeSession(key: string, userId: number): Promise<void> {
  await db.delete(apiSessions).where(and(eq(apiSessions.key, key), eq(apiSessions.userId, userId)));
}

export const appByKey = (apiKey: string): Promise<AppInfo | null> =>
  first(
    db
      .select({
        name: apiApps.name,
        description: apiApps.description,
        owner: sql<string>`COALESCE(${users.username}, 'Sonosphere')`,
        callbackUrl: apiApps.callbackUrl,
      })
      .from(apiApps)
      .leftJoin(users, eq(users.id, apiApps.userId))
      .where(eq(apiApps.apiKey, apiKey))
      .limit(1)
  );

export async function tokenIssued(token: string, apiKey: string, since: number): Promise<boolean> {
  const row = await first(
    db
      .select({ token: apiTokens.token })
      .from(apiTokens)
      .innerJoin(apiApps, eq(apiApps.id, apiTokens.appId))
      .where(and(eq(apiTokens.token, digest(token)), eq(apiApps.apiKey, apiKey), gt(apiTokens.createdAt, since)))
      .limit(1)
  );
  return !!row;
}

export async function appIdByKey(apiKey: string): Promise<number | null> {
  const row = await first(db.select({ id: apiApps.id }).from(apiApps).where(eq(apiApps.apiKey, apiKey)).limit(1));
  return row?.id ?? null;
}

// Web sign-in, where the app never asked for a token first.
export async function createApprovedToken(token: string, appId: number, userId: number): Promise<void> {
  await db.insert(apiTokens).values({ token: digest(token), appId, userId, createdAt: now() });
}
export async function approveToken(token: string, userId: number): Promise<void> {
  await db
    .update(apiTokens)
    .set({ userId })
    .where(eq(apiTokens.token, digest(token)));
}
