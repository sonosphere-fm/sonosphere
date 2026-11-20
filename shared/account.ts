// Types shared by the server and the browser for account settings.
import type { Session } from "./auth";

/** PATCH /api/me: every field is optional; the ones left out keep their value. */
export type ProfileEdit = {
  realname?: string; about?: string; country?: string; website?: string; email?: string;
  hideRecent?: boolean; shoutsEnabled?: boolean; dmPolicy?: string;
};
export type ProfileSaved = Session;
/** POST /api/me/password */
export type PasswordChange = { current: string; next: string };
/** POST /api/me/delete and /api/me/clear-scrobbles ask for the password again. */
export type PasswordConfirm = { password: string };
/** POST /api/me/clear-scrobbles: how many plays were removed. */
export type ScrobblesCleared = { deleted: number };
