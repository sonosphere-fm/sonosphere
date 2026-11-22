import type { Role } from "../../shared/site";
import { metaValue, promote } from "./repo";
export { adminCount, setRole } from "./repo";

type Account = { isAdmin: boolean; banned: boolean; role: string };

export function roleOf(u: Account | null | undefined): Role {
  if (!u || !u.isAdmin || u.banned) return "user";
  return u.role === "moderator" ? "moderator" : "admin";
}

export const isStaff = (u: Account | null | undefined) => roleOf(u) !== "user";
export const isAdmin = (u: Account | null | undefined) => roleOf(u) === "admin";

// ADMIN_USERS plus the account the dev import created. The portal can't change or remove them.
export async function configAdmins(): Promise<string[]> {
  const names = (process.env.ADMIN_USERS || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  try {
    const marker: unknown = JSON.parse((await metaValue("import")) || "{}");
    const owner = marker && typeof marker === "object" && "owner" in marker ? marker.owner : null;
    if (owner) names.push(String(owner).toLowerCase());
  } catch {}
  return names;
}

export const syncAdmins = async (): Promise<void> => promote(await configAdmins());
