// Who counts as staff. A moderator handles reports and content; an admin also manages accounts and the site.
import type { Role } from "../../shared/site";
import { metaValue, promote } from "./repo";
export { adminCount, setRole } from "./repo";
export type { Role };
type Account = { isAdmin: boolean; banned: boolean; role: string };

export const roleOf = (u: Account | null | undefined): Role => (!u || !u.isAdmin || u.banned ? "user" : u.role === "moderator" ? "moderator" : "admin");
export const isStaff = (u: Account | null | undefined) => roleOf(u) !== "user";
export const isAdmin = (u: Account | null | undefined) => roleOf(u) === "admin";

/** Usernames (lower case) that are admins by server configuration: ADMIN_USERS plus the account the dev import created. The portal can't change or remove them. */
export async function configAdmins(): Promise<string[]> {
  const names = (process.env.ADMIN_USERS || "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  try {
    const marker: unknown = JSON.parse((await metaValue("import")) || "{}");
    const owner = marker && typeof marker === "object" && "owner" in marker ? marker.owner : null;
    if (owner) names.push(String(owner).toLowerCase());
  } catch { /* no readable import marker */ }
  return names;
}
/** Makes sure every configured admin that has an account is flagged as staff. Run at startup and after sign-up. */
export const syncAdmins = async (): Promise<void> => promote(await configAdmins());
