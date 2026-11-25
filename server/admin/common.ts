import { bad, fail, paging as pageInput, type Ctx } from "../http";
import type { ErrorKey } from "../i18n";
import { configAdmins, isAdmin, isStaff } from "../site/roles";
import type { User } from "../users/repo";

export const note = (c: Ctx): string =>
  String(c.body.note ?? "")
    .trim()
    .slice(0, 1000);
export const paging = (q: URLSearchParams, def = 25) => pageInput(q, def, 100);
export const idList = (v: unknown, max: number): number[] =>
  (Array.isArray(v) ? v : []).map(Number).filter(Number.isFinite).slice(0, max);

type AccountAction = "suspend" | "ban" | "role" | "delete" | "sessions" | "mute" | "impersonate";
const OWN_ACCOUNT: Record<AccountAction, ErrorKey> = {
  suspend: "cantSuspendOwnAccount",
  ban: "cantBanOwnAccount",
  role: "cantChangeOwnRole",
  delete: "cantDeleteOwnAccount",
  sessions: "cantSignOutOwnAccount",
  mute: "cantMuteOwnAccount",
  impersonate: "cantImpersonateOwnAccount",
};

// `configured` is configAdmins(), passed in so this can run inside a transaction.
export function checkCanAct(actor: User, target: User, action: AccountAction, configured: string[]): void {
  if (target.id === actor.id) bad(OWN_ACCOUNT[action]);
  if (isStaff(target) && !isAdmin(actor)) fail(403, "onlyAdminsActStaffAccounts");
  if (action !== "sessions" && configured.includes(target.usernameNorm)) {
    bad("configuredAdmin", { username: target.username });
  }
  if (action !== "role" && action !== "sessions" && isStaff(target)) {
    bad("demoteStaffFirst", { username: target.username });
  }
}

export const canAct = async (actor: User, target: User, action: AccountAction): Promise<void> =>
  checkCanAct(actor, target, action, await configAdmins());
