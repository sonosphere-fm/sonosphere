import { isProfileAccent } from "../../shared/profile-accent";
import { bad } from "../http";

export function profileColors(profileAccent: unknown, profileAccentEnd: unknown) {
  if (profileAccent !== null && !isProfileAccent(profileAccent)) return bad("Use a six-digit hex accent, like #2438d6");
  if (profileAccentEnd !== null && !isProfileAccent(profileAccentEnd))
    return bad("Use a six-digit hex second color, or null");
  if (profileAccent === null && profileAccentEnd !== null) return bad("Choose an accent before adding a second color");
  return {
    profileAccent: profileAccent?.toLowerCase() ?? null,
    profileAccentEnd: profileAccentEnd?.toLowerCase() ?? null,
  };
}
