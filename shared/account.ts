import type { Session } from "./auth";
import type { ProfileLink } from "./profile-links";

export type ProfileEdit = {
  realname?: string;
  pronouns?: string;
  about?: string;
  country?: string;
  website?: string;
  links?: ProfileLink[];
  email?: string;
  hideRecent?: boolean;
  privateListening?: boolean;
  shoutsEnabled?: boolean;
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
