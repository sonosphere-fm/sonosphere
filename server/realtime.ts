import type { Server, ServerWebSocket } from "bun";
import { sessionUser, viewerOf } from "./auth/session";
import { ipOf, tokenOf } from "./http";
import { hits, publish, subscribe } from "./kv";
import { findById, findByName } from "./users/repo";
import { canSee } from "./users/service";
import type { ListeningEvent } from "../shared/live";
import * as Sentry from "@sentry/bun";

export type SocketData = {
  userId: number;
  actorId: number;
  token: string;
  ip: string;
  listening: Set<number>;
  listenVersion: number;
  typedAt: number;
  msgs: number;
  windowAt: number;
  publicUserId?: number;
  publicOrigin?: string;
};
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
  const { user, actor } = await viewerOf(req);
  if (token && !actor) return new Response("Unauthorized", { status: 401 });
  const ip = ipOf(req);
  const connections = user
    ? (sockets.get(user.id)?.size ?? 0)
    : [...(sockets.get(0) ?? [])].filter((ws) => ws.data.ip === ip).length;
  if (connections >= MAX_PER_USER) return new Response("Too many connections", { status: 429 });
  const data: SocketData = {
    userId: user?.id ?? 0,
    actorId: actor?.id ?? 0,
    token,
    ip,
    listening: new Set(),
    listenVersion: 0,
    typedAt: 0,
    msgs: 0,
    windowAt: Date.now(),
  };
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
    if (msg.t === "listen") {
      if (
        !Array.isArray(msg.names) ||
        msg.names.length > 8 ||
        msg.names.some((n) => typeof n !== "string" || n.length > 60)
      )
        return;
      const version = ++d.listenVersion;
      d.listening.clear();
      Promise.all(msg.names.map((name) => findByName(name as string)))
        .then((users) => {
          if (version !== d.listenVersion) return;
          d.listening = new Set(users.filter((u) => u && !u.banned).map((u) => u!.id));
          // Refresh after subscribing as well, closing the gap between the initial GET and subscription.
          for (const id of d.listening)
            deliverListening(ws, id, "scrobbles").catch((e) => {
              console.error("live listening:", e);
              Sentry.captureException(e);
            });
        })
        .catch((e) => {
          console.error("live subscriptions:", e);
          Sentry.captureException(e);
        });
      return;
    }
    if (!d.userId) return;
    if (msg.t === "typing") {
      if (t - d.typedAt < 1500) return;
      d.typedAt = t;
    }
    try {
      onClient(d.userId, msg);
    } catch (e) {
      console.error(e);
      Sentry.captureException(e);
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
type Fanout = { u: number; e?: object; bye?: true } | { listening: number; change: ListeningEvent["change"] };
const listeningSubscribers = new Set<(userId: number) => void>();
export function onListeningChange(fn: (userId: number) => void) {
  listeningSubscribers.add(fn);
  return () => {
    listeningSubscribers.delete(fn);
  };
}
subscribe("live", (raw) => {
  let m: Fanout;
  try {
    m = JSON.parse(raw) as Fanout;
  } catch {
    return;
  }
  if ("listening" in m) {
    for (const fn of listeningSubscribers) fn(m.listening);
    for (const set of sockets.values())
      for (const ws of set) {
        if (ws.data.listening.has(m.listening))
          deliverListening(ws, m.listening, m.change).catch((e) => {
            console.error("live listening:", e);
            Sentry.captureException(e);
          });
      }
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
  publish("live", JSON.stringify(m)).catch((e) => {
    console.error("live update:", e);
    Sentry.captureException(e);
  });
};

export function push(userId: number, event: object) {
  send({ u: userId, e: event });
}

async function deliverListening(ws: Sock, userId: number, change: ListeningEvent["change"]) {
  const [target, viewer] = await Promise.all([findById(userId), ws.data.userId ? findById(ws.data.userId) : null]);
  if (
    !target ||
    target.banned ||
    (ws.data.userId && viewer?.id !== ws.data.userId) ||
    !canSee(target, viewer) ||
    !ws.data.listening.has(userId)
  )
    return;
  const event: ListeningEvent = { t: "listening", userId, name: target.username, change };
  try {
    ws.send(JSON.stringify(event));
  } catch {}
}

export function listeningChanged(userId: number, change: ListeningEvent["change"]) {
  send({ listening: userId, change });
}

export function disconnect(userId: number) {
  send({ u: userId, bye: true });
}

const sweep = globalThis as { __spinSocketSweep?: ReturnType<typeof setInterval> };
clearInterval(sweep.__spinSocketSweep);
sweep.__spinSocketSweep = setInterval(async () => {
  for (const set of [...sockets.values()]) {
    for (const ws of [...set]) {
      if (!ws.data.userId) continue;
      const user = await sessionUser(ws.data.token).catch(() => null);
      if (user?.id !== ws.data.actorId) closeQuietly(ws, "Session ended");
    }
  }
}, 60_000);
