// Types shared by the server and the browser for API applications (the Last.fm-compatible scrobbling API).
/** An application the signed-in user registered, with its credentials. */
export type ApiApp = { id: number; name: string; description: string; apiKey: string; secret: string; callbackUrl: string; createdAt: number };
/** A session key the user granted to an application. `app` is the application's name. */
/** An application someone signed in to. `key` identifies it for revoking; it is not the session key itself. */
export type ApiSession = { key: string; app: string; createdAt: number; lastUsedAt: number };
/** GET /api/apps */
export type Apps = { items: ApiApp[]; sessions: ApiSession[] };
/** GET /api/apps/lookup: what the consent page shows about an application. `owner` is a username. */
export type AppInfo = { name: string; description: string; owner: string; callbackUrl: string };
/** POST /api/apps/authorize: the approved token, and where to send the person next (null to stay on the page). */
export type AppAuthorized = { token: string; redirect: string | null };
/** Every other write under /api/apps answers with this. */
export type AppOk = { ok: true };
