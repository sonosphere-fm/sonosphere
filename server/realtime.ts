import type { Server, ServerWebSocket } from "bun";
import { sessionUser } from "./auth/session";
import { ipOf, tokenOf } from "./http";
import { hits, publish, subscribe } from "./kv";

export type SocketData = { userId: number; token: string; typedAt: number; msgs: number; windowAt: number };
type Sock = ServerWebSocket<SocketData>;
const sockets = new Map<number, Set<Sock>>();
const MAX_PER_USER = 6;
/** Handlers must check every field other than `t`. */
export type ClientMessage = { t: string; [key: string]: unknown };
let onClient: (userId: number, msg: ClientMessage) => void = () => {};
export const onClientMessage = (fn: typeof onClient) => {
  onClient = fn;
};

// browsers attach cookies to cross-site WebSocket handshakes, so this is what stops another site opening a socket as the visitor
function sameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function upgrade(req: Request, server: Server<SocketData>): Promise<Response | undefined> {
  if (!sameOrigin(req)) return new Response("Forbidden", { status: 403 });
  const wait = await hits(`ws:${ipOf(req)}`, 30, 60);
  if (wait) return new Response("Too many connections", { status: 429, headers: { "Retry-After": String(wait) } });
  const token = tokenOf(req);
  const user = await sessionUser(token);
  if (!user) return new Response("Unauthorized", { status: 401 });
  if ((sockets.get(user.id)?.size ?? 0) >= MAX_PER_USER) return new Response("Too many connections", { status: 429 });
  const data: SocketData = { userId: user.id, token, typedAt: 0, msgs: 0, windowAt: Date.now() };
  return server.upgrade(req, { data }) ? undefined : new Response("Expected a WebSocket", { status: 426 });
}

const closeQuietly = (ws: Sock, reason: string) => {
  try {
    ws.close(1008, reason);
  } catch {}
};

export const websocket = {
  maxPayloadLength: 1024,
  idleTimeout: 120,
  open(ws: Sock) {
    let set = sockets.get(ws.data.userId);
    if (!set) {
      set = new Set();
      sockets.set(ws.data.userId, set);
    }
    set.add(ws);
  },
  message(ws: Sock, raw: string | Buffer) {
    const d = ws.data;
    const t = Date.now();
    if (t - d.windowAt > 10_000) {
      d.windowAt = t;
      d.msgs = 0;
    }
    if (++d.msgs > 40) {
      ws.close(1008, "Too many messages");
      return;
    }
    if (typeof raw !== "string") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    if (!parsed || typeof parsed !== "object" || !("t" in parsed) || typeof parsed.t !== "string") return;
    const msg: ClientMessage = { ...parsed, t: parsed.t };
    if (msg.t === "ping") {
      ws.send('{"t":"pong"}');
      return;
    }
    if (msg.t === "typing") {
      if (t - d.typedAt < 1500) return;
      d.typedAt = t;
    }
    try {
      onClient(d.userId, msg);
    } catch (e) {
      console.error(e);
    }
  },
  close(ws: Sock) {
    const set = sockets.get(ws.data.userId);
    if (!set) return;
    set.delete(ws);
    if (!set.size) sockets.delete(ws.data.userId);
  },
};

// a user's tabs may be connected to different processes, so events fan out through Valkey
type Fanout = { u: number; e?: object; bye?: true };
subscribe("live", raw => {
  let m: Fanout;
  try {
    m = JSON.parse(raw) as Fanout;
  } catch {
    return;
  }
  const set = sockets.get(m.u);
  if (!set) return;
  if (m.bye) {
    for (const ws of set) closeQuietly(ws, "Signed out");
    return;
  }
  const text = JSON.stringify(m.e);
  for (const ws of set) {
    try {
      ws.send(text);
    } catch {}
  }
});
const send = (m: Fanout) => {
  publish("live", JSON.stringify(m)).catch(e => console.error("live update:", e));
};

export function push(userId: number, event: object) {
  send({ u: userId, e: event });
}

export function disconnect(userId: number) {
  send({ u: userId, bye: true });
}

const sweep = globalThis as { __spinSocketSweep?: ReturnType<typeof setInterval> };
clearInterval(sweep.__spinSocketSweep);
sweep.__spinSocketSweep = setInterval(async () => {
  for (const set of [...sockets.values()]) {
    for (const ws of [...set]) {
      const user = await sessionUser(ws.data.token).catch(() => null);
      if (user?.id !== ws.data.userId) closeQuietly(ws, "Session ended");
    }
  }
}, 60_000);
