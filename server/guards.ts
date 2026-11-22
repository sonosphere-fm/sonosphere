import { fail, type Ctx, type Viewer } from "./http";
import { isAdmin, isStaff } from "./site/roles";

export const need = (c: Ctx): Viewer => c.user ?? fail(401, "You need to log in to do that");

// suspended accounts can still listen and scrobble, just not publish
export const poster = (c: Ctx): Viewer => {
  const u = need(c);
  return u.suspended ? fail(403, "Your account is suspended from posting") : u;
};

export const staff = (c: Ctx): Viewer => {
  const u = need(c);
  return isStaff(u) ? u : fail(403, "Staff only");
};

export const adminOnly = (c: Ctx): Viewer => {
  const u = staff(c);
  return isAdmin(u) ? u : fail(403, "Admins only");
};

export const confirmed = (u: Viewer): Viewer =>
  u.emailVerifiedAt || isStaff(u)
    ? u
    : fail(
        403,
        "Please confirm your email address first. You should have received a verification email. If you didn't, you can resend it from Settings, under Account."
      );
