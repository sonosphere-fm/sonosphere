// Types shared by the server and the browser for signing in and the signed-in account.
import type { Role } from "./site";

/** Unread direct messages: conversations in the inbox, and requests waiting for an answer. */
export type DmCounts = { unread: number; requests: number };

/** The signed-in account as the browser sees it. `image` is an image id; `admin` is true for any staff member. */
export type Me = {
  id: number; username: string; email: string; realname: string; about: string; country: string; website: string;
  image: string | null; hideRecent: boolean; privateListening: boolean; shoutsEnabled: boolean; registeredAt: number; admin: boolean; role: Role; suspended: boolean;
  /** Reports waiting for staff (always 0 for everyone else). */
  openReports: number;
  /** Unread notifications. */
  unread: number;
  dm: DmCounts; dmPolicy: string;
  /** Notification emails: how often, and the kinds turned off. */
  emailNotify: string; emailMuted: string[];
  /** Site theme: "light", "system" or "dark". */
  theme: "light" | "system" | "dark";
  /** Whether `email` was confirmed by following a link sent to it. */
  emailVerified: boolean;
  /** A new address waiting for its confirmation link to be followed. */
  pendingEmail: string | null;
  /** False for an account made through another site that has not set a password yet. */
  hasPassword: boolean;
};

/** GET /api/me: `user` is null when nobody is signed in. */
export type MeResponse = { user: Me | null };
/** Sign-up, log-in and profile edits answer with the account as it now stands. */
export type Session = { user: Me };
/** What the sign-up and log-in forms need: the Turnstile site key, or null when the robot check is off. */
export type AuthConfig = { turnstile: string | null; oauth: OAuthProvider[] };
/** Another site people can sign in with (server/auth/oauth/providers.ts). */
export type OAuthProvider = { id: string; label: string };
/** GET /api/me/logins: the ways into this account. `connected` is the handle at that site, or null. */
export type Logins = { hasPassword: boolean; providers: (OAuthProvider & { connected: { name: string; since: number } | null })[] };
/** GET /api/auth/oauth/pending: an account about to be made from another site's sign-in, waiting for a username. */
export type OAuthPending = { provider: string; username: string; email: string };
/** POST /api/auth/oauth/complete: the new account, and where to go next. */
export type OAuthCreated = { user: Me; next: string };
export type Ok = { ok: true };
/** An account whose email is still unconfirmed this many days after sign-up is deleted (staff and imported profiles excepted). */
export const UNVERIFIED_DAYS = 14;
