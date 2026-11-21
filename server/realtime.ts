// Live updates over WebSocket, served by the same Bun process as everything else (see server/index.ts).
// The socket is a one-way feed of events for the signed-in user; the only thing a client may send is "typing".
// Security: the upgrade is refused unless the session cookie is valid AND the Origin header is this site
// (browsers attach cookies to cross-site WebSocket handshakes, so the origin check is what stops another
// site from opening a socket as the visitor). Sessions are re-checked while the socket is open.
// With several site processes a user's tabs may be connected to different ones, so events go out through Valkey
// (server/kv.ts) and every process delivers them to the sockets it holds.
import type { Server, ServerWebSocket } from "bun";
import { sessionUser } from "./auth/session";
import { ipOf, tokenOf } from "./http";
import { hits, publish, subscribe } from "./kv";

/** What each open socket remembers about itself. */
export type SocketData = { userId: number; token: string; typedAt: number; msgs: number; windowAt: number };
type Data = SocketData;
type Sock = ServerWebSocket<Data>;
const sockets = new Map<number, Set<Sock>>();
const MAX_PER_USER = 6;
/** What a browser may send: a small JSON object with a type. Handlers must check every other field. */
export type ClientMessage = { t: string; [key: string]: unknown };
let onClient: (userId: number, msg: ClientMessage) => void = () => {};
/** Lets the messaging code handle the few things a client may say, without this file importing it. */
export const onClientMessage = (fn: typeof onClient) => { onClient = fn; };

function sameOrigin(req: Request) {
  const origin = req.headers.get("origin"), host = req.headers.get("host");
  if (!origin || !host) return false;
  try { return new URL(origin).host === host; } catch { return false; }
}

/** GET /api/ws */
export async function upgrade(req: Request, server: Server<Data>): Promise<Response | undefined> {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  // a page reconnects after network blips, never dozens of times a minute
  const wait = await hits(`ws:${ipOf(req)}`, 30, 60);
  if (wait) return new Response("Too many connections", { status: 429, headers: { "Retry-After": String(wait) } });
  const token = tokenOf(req), user = await sessionUser(token);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if ((sockets.get(user.id)?.size ?? 0) >= MAX_PER_USER) return new Response("Too many connections", { status: 429 });
  const data: Data = { userId: user.id, token, typedAt: 0, msgs: 0, windowAt: Date.now() };
  return server.upgrade(req, { data }) ? undefined : new Response("Expected a WebSocket", { status: 426 });
}

export const websocket = {
  maxPayloadLength: 1024, // clients only ever send tiny control messages
  idleTimeout: 120,
  open(ws: Sock) {
    let set = sockets.get(ws.data.userId);
    if (!set) sockets.set(ws.data.userId, (set = new Set()));
    set.add(ws);
  },
  message(ws: Sock, raw: string | Buffer) {
    const d = ws.data, t = Date.now();
    if (t - d.windowAt > 10_000) { d.windowAt = t; d.msgs = 0; }
    if (++d.msgs > 40) { ws.close(1008, "Too many messages"); return; } // a flood: drop the connection
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return; }
    if (!parsed || typeof parsed !== "object" || !("t" in parsed) || typeof parsed.t !== "string") return;
    const msg: ClientMessage = { ...parsed, t: parsed.t };
    if (msg.t === "ping") { ws.send('{"t":"pong"}'); return; }
    if (msg.t === "typing") { if (t - d.typedAt < 1500) return; d.typedAt = t; }
    try { onClient(d.userId, msg); } catch (e) { console.error(e); }
  },
  close(ws: Sock) {
    const set = sockets.get(ws.data.userId);
    if (set) { set.delete(ws); if (!set.size) sockets.delete(ws.data.userId); }
  },
};

type Fanout = { u: number; e?: object; bye?: true };
subscribe("live", raw => {
  let m: Fanout;
  try { m = JSON.parse(raw) as Fanout; } catch { return; }
  const set = sockets.get(m.u);
  if (!set) return;
  if (m.bye) { for (const ws of set) { try { ws.close(1008, "Signed out"); } catch { /* already closed */ } } return; }
  const text = JSON.stringify(m.e);
  for (const ws of set) { try { ws.send(text); } catch { /* socket closed mid-send */ } }
});
const send = (m: Fanout) => { publish("live", JSON.stringify(m)).catch(e => console.error("live update:", e)); };

/** Send an event to every tab the user has open, whichever process holds it. */
export function push(userId: number, event: object) { send({ u: userId, e: event }); }
/** Close a user's sockets in every process (logged out, banned, password changed). */
export function disconnect(userId: number) { send({ u: userId, bye: true }); }

// A socket outlives the request that opened it, so check every minute that its session still exists.
const sweep = globalThis as { __spinSocketSweep?: ReturnType<typeof setInterval> };
clearInterval(sweep.__spinSocketSweep);
sweep.__spinSocketSweep = setInterval(async () => {
  for (const set of [...sockets.values()]) for (const ws of [...set]) {
    const user = await sessionUser(ws.data.token).catch(() => null);
    if (user?.id !== ws.data.userId) { try { ws.close(1008, "Session ended"); } catch { /* already closed */ } }
  }
}, 60_000);
