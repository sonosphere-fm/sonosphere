import type { Server, ServerWebSocket } from "bun";
import { HttpError, ipOf } from "../http";
import { hits } from "../kv";
import { onListeningChange, type SocketData } from "../realtime";
import { findById, findByName, type User } from "../users/repo";
import { canSee } from "../users/service";
import { nowPlaying } from "./repo";
import type { PublicNowPlaying } from "../../shared/live";
import * as Sentry from "@sentry/bun";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Last-Event-ID, Content-Type",
  "Access-Control-Expose-Headers": "Retry-After",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};
const MAX_PER_IP = 6;
type Connection = {
  userId: number; ip: string; origin: string;
  send: (text: string, event: "nowplaying" | "unavailable" | "heartbeat") => void;
  close: () => void;
  last?: string; busy?: boolean; dirty?: boolean; closed?: boolean;
};
const connections = new Map<number, Set<Connection>>();
const socketConnections = new Map<ServerWebSocket<SocketData>, Connection>();

function errorResponse(error: unknown) {
  if (!(error instanceof HttpError)) { console.error("public now playing:", error); Sentry.captureException(error); }
  return Response.json({ error: error instanceof HttpError ? error.message : "Something went wrong" }, {
    status: error instanceof HttpError ? error.status : 500,
    headers: { ...CORS, ...(error instanceof HttpError && error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) },
  });
}

function publicUser(user: User | null): User {
  if (!user || user.banned) throw new HttpError(404, "User not found");
  // This API always uses public visibility, even if the request carries the owner's session cookie.
  if (!canSee(user, null)) throw new HttpError(403, "This user keeps their listening private");
  return user;
}

async function requestUser(req: Request): Promise<User> {
  const wait = await hits(`public-nowplaying:${ipOf(req)}`, 60, 60);
  if (wait) throw new HttpError(429, "Too many requests. Try again shortly.", wait);
  const name = new URL(req.url).searchParams.get("name");
  if (!name || name.length > 60) throw new HttpError(400, "name is required (at most 60 characters)");
  return publicUser(await findByName(name));
}

function checkCapacity(ip: string) {
  let count = 0;
  for (const set of connections.values()) for (const c of set) if (c.ip === ip) count++;
  if (count >= MAX_PER_IP) throw new HttpError(429, "Too many live connections", 30);
}

function originOf(req: Request) {
  const url = new URL(req.url);
  if (req.headers.get("x-forwarded-proto") === "https") url.protocol = "https:";
  return url.origin;
}

async function snapshot(userId: number, origin: string): Promise<PublicNowPlaying> {
  const user = publicUser(await findById(userId));
  const track = await nowPlaying(user.id);
  return {
    t: "nowplaying",
    user: { username: user.username },
    nowPlaying: track ? {
      trackId: track.trackId, title: track.title, artist: track.artist, album: track.album,
      duration: track.duration, startedAt: track.startedAt,
      imageUrl: track.image ? `${origin}/api/image/${encodeURIComponent(track.image)}` : null,
    } : null,
  };
}

function remove(c: Connection) {
  if (c.closed) return;
  c.closed = true;
  const set = connections.get(c.userId);
  set?.delete(c);
  if (!set?.size) connections.delete(c.userId);
}

function attach(c: Connection) {
  checkCapacity(c.ip);
  const set = connections.get(c.userId) ?? new Set<Connection>();
  set.add(c);
  connections.set(c.userId, set);
  void refresh(c);
}

async function refresh(c: Connection) {
  if (c.closed) return;
  if (c.busy) { c.dirty = true; return; }
  c.busy = true;
  try {
    const text = JSON.stringify(await snapshot(c.userId, c.origin));
    if (!c.closed && text !== c.last) {
      c.send(text, "nowplaying");
      c.last = text;
    }
  } catch (e) {
    if (!c.closed) {
      try {
        if (e instanceof HttpError && (e.status === 403 || e.status === 404)) c.send(JSON.stringify({ t: "unavailable" }), "unavailable");
      } catch {
        // The client may have disconnected while the snapshot was loading.
      } finally {
        remove(c);
        c.close();
      }
    }
    if (!(e instanceof HttpError)) { console.error("public now playing stream:", e); Sentry.captureException(e); }
  } finally {
    c.busy = false;
    if (c.dirty) { c.dirty = false; void refresh(c); }
  }
}

onListeningChange(userId => {
  for (const c of connections.get(userId) ?? []) void refresh(c);
});

// Heartbeats keep proxies from buffering idle streams; snapshots also catch privacy changes and expiry.
const timers = globalThis as { __spinPublicPlaying?: ReturnType<typeof setInterval> };
clearInterval(timers.__spinPublicPlaying);
timers.__spinPublicPlaying = setInterval(() => {
  for (const set of connections.values()) for (const c of set) {
    try { c.send("", "heartbeat"); } catch { remove(c); c.close(); continue; }
    void refresh(c);
  }
}, 15_000);

/** Public, credential-free GET/OPTIONS endpoints. Deliberately bypasses session-based API routing. */
export async function publicNowPlaying(req: Request, server?: Server<SocketData>): Promise<Response | undefined> {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "GET") return Response.json({ error: "Use GET" }, { status: 405, headers: { ...CORS, Allow: "GET, OPTIONS" } });
  try {
    const user = await requestUser(req);
    const url = new URL(req.url);
    if (url.pathname.endsWith("/ws")) {
      checkCapacity(ipOf(req));
      const data: SocketData = {
        userId: 0, actorId: 0, token: "", ip: ipOf(req), listening: new Set(), listenVersion: 0, typedAt: 0, msgs: 0, windowAt: Date.now(),
        publicUserId: user.id, publicOrigin: originOf(req),
      };
      if (server?.upgrade(req, { data })) return;
      return Response.json({ error: "Expected a WebSocket" }, { status: 426, headers: CORS });
    }
    if (!url.pathname.endsWith("/stream")) return Response.json(await snapshot(user.id, originOf(req)), { headers: CORS });
    checkCapacity(ipOf(req));
    let connection: Connection | undefined;
    let dispose = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const close = () => {
          if (connection) remove(connection);
          req.signal.removeEventListener("abort", dispose);
          try { controller.close(); } catch {}
        };
        connection = {
          userId: user.id, ip: ipOf(req), origin: originOf(req), close,
          send(text, event) {
            if ((controller.desiredSize ?? 1) <= 0) throw new Error("Stream consumer is too slow");
            controller.enqueue(encoder.encode(event === "heartbeat" ? ": keepalive\n\n" : `event: ${event}\ndata: ${text}\n\n`));
          },
        };
        dispose = close;
        req.signal.addEventListener("abort", dispose, { once: true });
        if (req.signal.aborted) { close(); return; }
        attach(connection);
      },
      cancel() { dispose(); },
    }, { highWaterMark: 4 });
    // Disable Bun's request idle timeout: SSE has its own 15-second keepalive.
    server?.timeout(req, 0);
    return new Response(stream, { headers: { ...CORS, "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-store, no-transform", "X-Accel-Buffering": "no" } });
  } catch (e) { return errorResponse(e); }
}

export const publicPlayingWebsocket = {
  open(ws: ServerWebSocket<SocketData>) {
    const c: Connection = {
      userId: ws.data.publicUserId!, ip: ws.data.ip, origin: ws.data.publicOrigin!,
      send(text, event) {
        const sent = ws.send(event === "heartbeat" ? '{"t":"ping"}' : text);
        if (sent === -1 || sent === 0) throw new Error("WebSocket consumer is unavailable");
      },
      close: () => { socketConnections.delete(ws); ws.close(1008, "Public stream ended"); },
    };
    try { attach(c); socketConnections.set(ws, c); } catch { ws.close(1013, "Too many live connections"); }
  },
  message(_ws: ServerWebSocket<SocketData>, _raw: string | Buffer) {
    // Receive-only: cookies, messaging commands and subscription messages have no effect here.
  },
  close(ws: ServerWebSocket<SocketData>) {
    const c = socketConnections.get(ws);
    if (c) remove(c);
    socketConnections.delete(ws);
  },
};
