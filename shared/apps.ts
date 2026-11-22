export type ApiApp = {
  id: number;
  name: string;
  description: string;
  apiKey: string;
  secret: string;
  callbackUrl: string;
  createdAt: number;
};
export type ApiSession = { key: string; app: string; createdAt: number; lastUsedAt: number };
export type Apps = { items: ApiApp[]; sessions: ApiSession[] };
export type AppInfo = { name: string; description: string; owner: string; callbackUrl: string };
export type AppAuthorized = { token: string; redirect: string | null };
export type AppOk = { ok: true };
