import { isIP } from "node:net";
import { and, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { db, type Conn } from "../db/client";
import { banMarks, userIps, users } from "../db/schema";
import { fail } from "../http";
import { isStaff } from "../site/roles";
import { now } from "../util";
import type { User } from "../users/repo";
import type { StaffUserIp } from "../../shared/admin";

const DAY = 86_400;
const NOTE_EVERY = 3600;
const KEEP = 365 * DAY;
const BAN_LOOKBACK = 30 * DAY;
const MAX_NOTED = 50_000;

function hextets(ip: string): string[] {
  const [head, tail = ""] = ip.toLowerCase().split("::");
  const a = head ? head.split(":") : [];
  const b = tail ? tail.split(":") : [];
  const fill = ip.includes("::") ? Array<string>(8 - a.length - b.length).fill("0") : [];
  return [...a, ...fill, ...b].map((h) => h.replace(/^0+(?=.)/, ""));
}

const mappedV4 = (ip: string) => /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];

function clean(ip: string): string | null {
  const v4 = mappedV4(ip) ?? ip;
  const family = isIP(v4);
  if (family === 4) return v4;
  if (family === 6) return hextets(v4).join(":");
  return null;
}

// One address stands for a whole IPv6 /64, since a single connection usually gets one.
function netOf(ip: string): string {
  return isIP(ip) === 6 ? `${hextets(ip).slice(0, 4).join(":")}::/64` : ip;
}

function mask(ip: string): string {
  if (isIP(ip) === 4) return ip.split(".").slice(0, 2).concat("x", "x").join(".");
  return `${hextets(ip).slice(0, 3).join(":")}::x`;
}

// Dots and +tags are dropped for every provider, not only those that ignore them.
export function canonicalEmail(email: string): string {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at).toLowerCase().split("+")[0]!.replace(/\./g, "");
  const domain = email.slice(at + 1).toLowerCase();
  return `${local}@${domain === "googlemail.com" ? "gmail.com" : domain}`;
}

const noted = new Map<string, number>();

export function noteIp(u: User, raw: string) {
  const ip = clean(raw);
  if (!ip) return;
  const key = `${u.id}|${ip}`;
  const t = now();
  if ((noted.get(key) ?? 0) > t - NOTE_EVERY) return;
  if (noted.size >= MAX_NOTED) noted.clear();
  noted.set(key, t);
  db.insert(userIps)
    .values({ userId: u.id, ip, firstAt: t, lastAt: t })
    .onConflictDoUpdate({ target: [userIps.userId, userIps.ip], set: { lastAt: t } })
    .catch((e) => console.error(e));
}

export async function markBan(tx: Conn, u: User) {
  const t = now();
  const ips = await tx
    .select({ ip: userIps.ip })
    .from(userIps)
    .where(and(eq(userIps.userId, u.id), gte(userIps.lastAt, t - BAN_LOOKBACK)));
  const marks: (typeof banMarks.$inferInsert)[] = [...new Set(ips.map((r) => netOf(r.ip)))].map((value) => ({
    userId: u.id,
    kind: "ip",
    value,
    createdAt: t,
  }));
  if (!u.email.endsWith(".invalid"))
    marks.push({ userId: u.id, kind: "email", value: canonicalEmail(u.email), createdAt: t });
  if (marks.length) await tx.insert(banMarks).values(marks).onConflictDoNothing();
}

export async function unmarkBan(tx: Conn, userId: number) {
  await tx.delete(banMarks).where(eq(banMarks.userId, userId));
}

async function bannedSince(kind: "email" | "ip", value: string): Promise<number | null> {
  const [row] = await db
    .select({ at: sql<number>`min(${banMarks.createdAt})` })
    .from(banMarks)
    .where(and(eq(banMarks.kind, kind), eq(banMarks.value, value)));
  return row?.at ?? null;
}

const ipBannedSince = (raw: string) => {
  const ip = clean(raw);
  return ip ? bannedSince("ip", netOf(ip)) : Promise.resolve(null);
};

export const emailBanned = async (email: string) => (await bannedSince("email", canonicalEmail(email))) !== null;

export async function refuseBannedEmail(email: string) {
  if (await emailBanned(email)) fail(403, "bannedFromService");
}

export async function refuseBannedSignup(email: string, ip: string) {
  await refuseBannedEmail(email);
  if ((await ipBannedSince(ip)) !== null) fail(403, "bannedFromService");
}

// Accounts made before the ban keep working from that network, since it may be shared.
export async function loginBanned(u: User, ip: string): Promise<boolean> {
  if (isStaff(u)) return false;
  const since = await ipBannedSince(ip);
  return since !== null && u.registeredAt >= since;
}

export async function ipsOf(userId: number): Promise<StaffUserIp[]> {
  const rows = await db
    .select()
    .from(userIps)
    .where(eq(userIps.userId, userId))
    .orderBy(desc(userIps.lastAt))
    .limit(20);
  if (!rows.length) return [];
  const nets = new Set(rows.map((r) => netOf(r.ip)));
  const marked = await db
    .select({ value: banMarks.value })
    .from(banMarks)
    .where(and(eq(banMarks.kind, "ip"), inArray(banMarks.value, [...nets])));
  const others = await db
    .select({ ip: userIps.ip, username: users.username })
    .from(userIps)
    .innerJoin(users, eq(users.id, userIps.userId))
    .where(
      and(
        ne(userIps.userId, userId),
        inArray(
          userIps.ip,
          rows.map((r) => r.ip)
        )
      )
    )
    .orderBy(desc(userIps.lastAt))
    .limit(100);
  const bannedNets = new Set(marked.map((m) => m.value));
  return rows.map((r) => ({
    masked: mask(r.ip),
    firstAt: r.firstAt,
    lastAt: r.lastAt,
    banned: bannedNets.has(netOf(r.ip)),
    shared: [...new Set(others.filter((o) => o.ip === r.ip).map((o) => o.username))],
  }));
}

export async function dropOldIps() {
  await db.delete(userIps).where(lt(userIps.lastAt, now() - KEEP));
}
