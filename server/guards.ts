import { fail, type Ctx, type Viewer } from "./http";
import { isAdmin, isStaff } from "./site/roles";

export const need = (c: Ctx): Viewer => c.user ?? fail(401, "needLogin");

// suspended accounts can still listen and scrobble, just not publish
export const poster = (c: Ctx): Viewer => {
  const u = need(c);
  return u.suspended ? fail(403, "accountSuspendedFromPosting") : u;
};

export const staff = (c: Ctx): Viewer => {
  const u = need(c);
  return isStaff(u) ? u : fail(403, "staffOnly");
};

export const adminOnly = (c: Ctx): Viewer => {
  const u = staff(c);
  return isAdmin(u) ? u : fail(403, "adminsOnly");
};

export const confirmed = (u: Viewer): Viewer => (u.emailVerifiedAt || isStaff(u) ? u : fail(403, "confirmEmailFirst"));
