import type { Session } from "./auth";
import type { ProfileLink } from "./profile-links";
import type { UsernameFont } from "./username-fonts";

export type ProfileEdit = {
  useProfileTheme?: boolean;
  usernameFont?: UsernameFont;
  profileAccent?: string | null;
  profileAccentEnd?: string | null;
  realname?: string;
  pronouns?: string;
  about?: string;
  country?: string;
  links?: ProfileLink[];
  email?: string;
  hideRecent?: boolean;
  privateListening?: boolean;
  shoutsEnabled?: boolean;
  notifyPopups?: boolean;
  dmPolicy?: string;
  emailNotify?: string;
  emailMuted?: string[];
  theme?: string;
};
export type ProfileSaved = Session;
export type ScrobblesCleared = { deleted: number };
export type UsernameStatus = {
  username: string;
  changeAfter: number;
  undo: { username: string; expiresAt: number } | null;
};
export type AdminUsernameStatus = UsernameStatus & {
  held: { username: string; expiresAt: number }[];
};
