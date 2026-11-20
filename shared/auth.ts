// Types shared by the server and the browser for signing in and the signed-in account.
import type { Role } from "./site";

/** Unread direct messages: conversations in the inbox, and requests waiting for an answer. */
export type DmCounts = { unread: number; requests: number };

/** The signed-in account as the browser sees it. `image` is an image id; `admin` is true for any staff member. */
export type Me = {
  id: number; username: string; email: string; realname: string; about: string; country: string; website: string;
  image: number | null; hideRecent: boolean; shoutsEnabled: boolean; registeredAt: number; admin: boolean; role: Role; suspended: boolean;
  /** Reports waiting for staff (always 0 for everyone else). */
  openReports: number;
  /** Unread notifications. */
  unread: number;
  dm: DmCounts; dmPolicy: string;
};

/** GET /api/me: `user` is null when nobody is signed in. */
export type MeResponse = { user: Me | null };
/** Sign-up, log-in and profile edits answer with the account as it now stands. */
export type Session = { user: Me };
export type Ok = { ok: true };
