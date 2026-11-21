import type { Session } from "./auth";

export type ProfileEdit = {
  realname?: string; pronouns?: string; about?: string; country?: string; website?: string; email?: string;
  hideRecent?: boolean; privateListening?: boolean; shoutsEnabled?: boolean; dmPolicy?: string;
  emailNotify?: string; emailMuted?: string[]; theme?: string;
};
export type ProfileSaved = Session;
export type ScrobblesCleared = { deleted: number };
