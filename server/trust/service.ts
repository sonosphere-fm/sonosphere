// New accounts start on probation with tighter limits. Nothing about it is shown to them: the limits
// they hit read exactly like everyone else's. They leave it after MIN_AGE once their score reaches NEEDED.
import { throttle } from "../http";
import type { ErrorKey } from "../i18n";
import { isStaff } from "../site/roles";
import { now } from "../util";
import { findById, type User } from "../users/repo";
import * as repo from "./repo";
import type { StaffTrust } from "../../shared/admin";

const DAY = 86400;
export const PROBATION = {
  MIN_AGE: 3 * DAY,
  NEEDED: 40,
  DIVISOR: 3,
  DM_PER_MINUTE: 6,
  DM_PER_DAY: 120,
  NEW_THREADS_PER_DAY: 3,
  NEW_GROUPS_PER_DAY: 2,
  COPIES: 2,
};

type Point = StaffTrust["points"][number];

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function score(u: User, s: repo.Signals): Point[] {
  const points: Point[] = [
    { label: "Confirmed email", points: u.emailVerifiedAt ? 10 : 0 },
    { label: `Listened on ${plural(s.listeningDays, "day")} since joining`, points: Math.min(30, s.listeningDays * 3) },
    {
      label: `Followed by ${plural(s.trustedFollowers, "trusted member")}`,
      points: Math.min(40, s.trustedFollowers * 8),
    },
    {
      label: `${plural(s.acceptedRequests, "message request")} accepted by trusted members`,
      points: Math.min(32, s.acceptedRequests * 8),
    },
    { label: `Messaged first by ${plural(s.reachedOut, "trusted member")}`, points: Math.min(20, s.reachedOut * 5) },
    { label: plural(s.loved, "loved track"), points: Math.min(10, Math.floor(s.loved / 5)) },
    { label: `${plural(s.declined, "message request")} declined`, points: -5 * s.declined },
    { label: `Blocked by ${plural(s.blockedBy, "member")}`, points: -15 * s.blockedBy },
    { label: plural(s.reported, "report"), points: -10 * s.reported },
    { label: plural(s.flagged, "spam flag"), points: -10 * s.flagged },
  ];
  return points.filter((p) => p.points !== 0);
}

export const total = (points: Point[]) => points.reduce((sum, p) => sum + p.points, 0);

export async function onProbation(u: User): Promise<boolean> {
  if (isStaff(u)) return false;
  return !(await repo.trustOf(u.id))?.clearedAt;
}

// The same throttle as everyone else's, with a smaller allowance while on probation.
export async function limit(u: User, key: string, max: number, seconds: number, msg?: ErrorKey): Promise<void> {
  const allowed = (await onProbation(u)) ? Math.max(1, Math.ceil(max / PROBATION.DIVISOR)) : max;
  await throttle(key, allowed, seconds, msg);
}

export async function standing(u: User): Promise<StaffTrust> {
  const row = await repo.trustOf(u.id);
  const points = score(u, await repo.signals(u));
  const by = row?.clearedBy ? await findById(row.clearedBy) : null;
  return {
    staff: isStaff(u),
    probation: await onProbation(u),
    held: row?.held ?? false,
    score: total(points),
    needed: PROBATION.NEEDED,
    eligibleAt: u.registeredAt + PROBATION.MIN_AGE,
    checkedAt: row?.checkedAt ?? null,
    clearedAt: row?.clearedAt ?? null,
    clearedBy: by?.username ?? null,
    points,
  };
}

// Staff can end probation early, or put an account back on it; a held account isn't released automatically.
export async function setProbation(u: User, on: boolean, by: User): Promise<void> {
  if (on) await repo.saveTrust(u.id, { clearedAt: null, clearedBy: null, held: true });
  else await repo.saveTrust(u.id, { clearedAt: now(), clearedBy: by.id, held: false });
}

export async function reviewProbation(): Promise<void> {
  const t = now();
  for (const u of await repo.probationDue(t - PROBATION.MIN_AGE, 200)) {
    const sum = total(score(u, await repo.signals(u)));
    await repo.saveTrust(u.id, { score: sum, checkedAt: t, ...(sum >= PROBATION.NEEDED ? { clearedAt: t } : {}) });
  }
}
