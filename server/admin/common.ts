// Helpers every section of the staff API shares: reading the usual inputs, finding the account an action is aimed
// at, and the rank rules for acting on it. No database access here (see common.repo.ts for that).
import { bad, fail, paging as pageInput, type Ctx } from "../http";
import { configAdmins, isAdmin, isStaff } from "../site/roles";
import { requireUser } from "../users/service";
import type { User } from "../users/repo";

/** The reason a staff member typed for an action (`note` in the body). It goes into the audit log. */
export const note = (c: Ctx): string => String(c.body.note ?? "").trim().slice(0, 1000);
/** Page and page size for a staff list: at most 100 rows a page. */
export const paging = (q: URLSearchParams, def = 25) => pageInput(q, def, 100);
/** A list of numeric ids from a request body (`ids`), at most `max` of them. Anything that is not a number is dropped. */
export const idList = (v: unknown, max: number): number[] => (Array.isArray(v) ? v : []).map(Number).filter(Number.isFinite).slice(0, max);
/** The account named in the URL, or a 404. */
export const targetUser = (name: string): Promise<User> => requireUser(name);

/** What staff can do to an account. */
export type AccountAction = "suspend" | "ban" | "role" | "delete" | "sessions" | "mute";
const VERB: Record<AccountAction, string> = { suspend: "suspend", ban: "ban", role: "change the role of", delete: "delete", sessions: "sign out", mute: "turn off messaging for" };

/**
 * The rules every account action shares: never yourself, never staff unless you are an admin, never an admin set by
 * server configuration, and staff must be made ordinary users before they can be suspended, banned, muted or deleted.
 * Throws the matching HTTP error. `configured` is the result of configAdmins(), passed in so this can run inside a
 * transaction.
 */
export function checkCanAct(actor: User, target: User, action: AccountAction, configured: string[]): void {
  if (target.id === actor.id) bad(`You can't ${VERB[action]} your own account`);
  if (isStaff(target) && !isAdmin(actor)) fail(403, "Only admins can act on staff accounts");
  if (action !== "sessions" && configured.includes(target.usernameNorm)) bad(`${target.username} is an admin by server configuration (ADMIN_USERS); change it there`);
  if (action !== "role" && action !== "sessions" && isStaff(target)) bad(`${target.username} is staff: change their role to user first`);
}
/** checkCanAct for use outside a transaction. */
export const canAct = async (actor: User, target: User, action: AccountAction): Promise<void> => checkCanAct(actor, target, action, await configAdmins());
