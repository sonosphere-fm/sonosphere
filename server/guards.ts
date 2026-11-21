// Who may call a route. Each guard returns the signed-in account or throws the matching HTTP error.
import { fail, type Ctx, type Viewer } from "./http";
import { isAdmin, isStaff } from "./site/roles";

export const need = (c: Ctx): Viewer => c.user ?? fail(401, "You need to log in to do that");
/** Signed in and allowed to publish (shouts, wikis, journals): suspended accounts can still listen and scrobble. */
export const poster = (c: Ctx): Viewer => { const u = need(c); return u.suspended ? fail(403, "Your account is suspended from posting") : u; };
/** A moderator or an admin. */
export const staff = (c: Ctx): Viewer => { const u = need(c); return isStaff(u) ? u : fail(403, "Staff only"); };
export const adminOnly = (c: Ctx): Viewer => { const u = staff(c); return isAdmin(u) ? u : fail(403, "Admins only"); };
/**
 * Refuses an account whose email is not confirmed yet. Used on what spammers and throwaway accounts would abuse:
 * public writing (wiki, shouts, journals, tags, events), messages, pictures and API keys. Staff are trusted.
 */
export const confirmed = (u: Viewer): Viewer =>
  u.emailVerifiedAt || isStaff(u) ? u : fail(403, "Confirm your email address first. Use the link we sent you, or send a new one from Settings, under Account.");
