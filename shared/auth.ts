import type { Role } from "./site";

export type DmCounts = { unread: number; requests: number };

export type Me = {
  id: number; username: string; email: string; realname: string; pronouns: string; about: string; country: string; website: string;
  image: string | null; hideRecent: boolean; privateListening: boolean; shoutsEnabled: boolean; registeredAt: number; admin: boolean; role: Role; suspended: boolean;
  openReports: number;
  unread: number;
  dm: DmCounts; dmPolicy: string;
  emailNotify: string; emailMuted: string[];
  theme: "light" | "system" | "dark";
  emailVerified: boolean;
  pendingEmail: string | null;
  hasPassword: boolean;
};

export type MeResponse = { user: Me | null };
export type Session = { user: Me };
export type AuthConfig = { turnstile: string | null; oauth: OAuthProvider[] };
export type OAuthProvider = { id: string; label: string };
export type Logins = { hasPassword: boolean; providers: (OAuthProvider & { connected: { name: string; since: number } | null })[] };
export type OAuthPending = { provider: string; username: string; email: string };
export type OAuthCreated = { user: Me; next: string };
export type Ok = { ok: true };
export const UNVERIFIED_DAYS = 14;
