import { bad, fail, paging as pageInput, type Ctx } from "../http";
import { configAdmins, isAdmin, isStaff } from "../site/roles";
import { requireUser } from "../users/service";
import type { User } from "../users/repo";

export const note = (c: Ctx): string => String(c.body.note ?? "").trim().slice(0, 1000);
export const paging = (q: URLSearchParams, def = 25) => pageInput(q, def, 100);
export const idList = (v: unknown, max: number): number[] =>
  (Array.isArray(v) ? v : []).map(Number).filter(Number.isFinite).slice(0, max);
export const targetUser = (name: string): Promise<User> => requireUser(name);

type AccountAction = "suspend" | "ban" | "role" | "delete" | "sessions" | "mute" | "impersonate";
const VERB: Record<AccountAction, string> = {
  suspend: "suspend",
  ban: "ban",
  role: "change the role of",
  delete: "delete",
  sessions: "sign out",
  mute: "turn off messaging for",
  impersonate: "act as",
};

// `configured` is configAdmins(), passed in so this can run inside a transaction.
export function checkCanAct(actor: User, target: User, action: AccountAction, configured: string[]): void {
  if (target.id === actor.id) bad(`You can't ${VERB[action]} your own account`);
  if (isStaff(target) && !isAdmin(actor)) fail(403, "Only admins can act on staff accounts");
  if (action !== "sessions" && configured.includes(target.usernameNorm)) {
    bad(`${target.username} is an admin by server configuration (ADMIN_USERS); change it there`);
  }
  if (action !== "role" && action !== "sessions" && isStaff(target)) {
    bad(`${target.username} is staff: change their role to user first`);
  }
}

export const canAct = async (actor: User, target: User, action: AccountAction): Promise<void> =>
  checkCanAct(actor, target, action, await configAdmins());
