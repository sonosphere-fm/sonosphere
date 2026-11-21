// Types shared by the server and the browser for account settings.
import type { Session } from "./auth";

/** PATCH /api/me: every field is optional; the ones left out keep their value. */
export type ProfileEdit = {
  realname?: string; pronouns?: string; about?: string; country?: string; website?: string; email?: string;
  hideRecent?: boolean; privateListening?: boolean; shoutsEnabled?: boolean; dmPolicy?: string;
  emailNotify?: string; emailMuted?: string[]; theme?: string;
};
export type ProfileSaved = Session;
/** POST /api/me/clear-scrobbles: how many plays were removed. */
export type ScrobblesCleared = { deleted: number };
