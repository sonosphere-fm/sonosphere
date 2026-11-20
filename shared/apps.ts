// Types shared by the server and the browser for API applications (the Last.fm-compatible scrobbling API).
/** An application the signed-in user registered, with its credentials. */
export type ApiApp = { id: number; name: string; description: string; apiKey: string; secret: string; createdAt: number };
/** A session key the user granted to an application. `app` is the application's name. */
export type ApiSession = { key: string; app: string; createdAt: number };
/** GET /api/apps */
export type Apps = { items: ApiApp[]; sessions: ApiSession[] };
/** GET /api/apps/lookup: what the consent page shows about an application. `owner` is a username. */
export type AppInfo = { name: string; description: string; owner: string };
/** Every write under /api/apps answers with this. */
export type AppOk = { ok: true };
