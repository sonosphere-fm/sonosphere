import { missing, type Viewer } from "../http";
import { isStaff } from "../site/roles";
import { findByName, type User } from "./repo";

export const requireUser = async (name: string | null): Promise<User> =>
  (await findByName(name || "")) ?? missing("userNotFound");

// Banned accounts are hidden from everyone but staff.
export async function requireVisibleUser(name: string | null, viewer: Viewer | null): Promise<User> {
  const u = await requireUser(name);
  return hiddenFrom(u, viewer) ? missing("userNotFound") : u;
}

export const hiddenFrom = (u: Pick<User, "banned">, viewer: Viewer | null): boolean => u.banned && !isStaff(viewer);

type Who = { id: number } | null;
export const canSee = (target: User, viewer: Who): boolean =>
  (!target.hideRecent && !target.privateListening) || viewer?.id === target.id;
export const canSeeCharts = (target: User, viewer: Who): boolean =>
  !target.privateListening || viewer?.id === target.id;
