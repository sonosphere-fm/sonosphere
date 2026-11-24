import { isProfileAccent } from "../../shared/profile-accent";
import { bad } from "../http";

export function profileColors(profileAccent: unknown, profileAccentEnd: unknown) {
  if (profileAccent !== null && !isProfileAccent(profileAccent)) return bad("invalidAccent");
  if (profileAccentEnd !== null && !isProfileAccent(profileAccentEnd)) return bad("invalidSecondAccent");
  if (profileAccent === null && profileAccentEnd !== null) return bad("chooseAccentBeforeAddingSecond");
  return {
    profileAccent: profileAccent?.toLowerCase() ?? null,
    profileAccentEnd: profileAccentEnd?.toLowerCase() ?? null,
  };
}
