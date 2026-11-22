import { isUsernameFont, type UserAppearance } from "../../shared/username-fonts";
import { users } from "../db/schema";

export const appearanceCols = {
  usernameFont: users.usernameFont,
  profileAccent: users.profileAccent,
  profileAccentEnd: users.profileAccentEnd,
};

export function userAppearance(u: {
  usernameFont?: string | null;
  profileAccent?: string | null;
  profileAccentEnd?: string | null;
}): UserAppearance {
  return {
    usernameFont: isUsernameFont(u.usernameFont) ? u.usernameFont : "default",
    profileAccent: u.profileAccent ?? null,
    profileAccentEnd: u.profileAccentEnd ?? null,
  };
}
