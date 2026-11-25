import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";

class TestHttpError extends Error {
  constructor(
    public status: number,
    public key: string
  ) {
    super(key);
  }
}

type StoredLink = {
  userId: number;
  url: string;
  username: string;
  password: string;
  name: string;
  version: string;
  openSubsonic: boolean;
  createdAt: number;
};
let link: StoredLink | null = null;

mock.module("../http", () => ({
  fail: (status: number, key: string) => {
    throw new TestHttpError(status, key);
  },
  bad: (key: string) => {
    throw new TestHttpError(400, key);
  },
  limit: async () => {},
}));
mock.module("./repo", () => ({
  findLink: async () => link,
  saveLink: async (userId: number, fields: Omit<StoredLink, "userId">) => {
    link = { userId, ...fields };
  },
  removeLink: async () => {
    link = null;
  },
}));
mock.module("../seal", () => ({
  seal: (plain: string) => `sealed:${plain}`,
  unseal: (sealed: string) => (sealed.startsWith("sealed:") ? sealed.slice(7) : null),
}));

process.env.MUSIC_SERVER_ALLOW_PRIVATE = "1";
const { auth, connect, disconnect, source, status, stream, streamById, verify } = await import("./service");

const PASSWORD = "hunter2";
const audio = Uint8Array.from({ length: 1000 }, (_, i) => i % 256);
let rejectToken = false;
const seen: URL[] = [];

const server = Bun.serve({
  port: 0,
  fetch(req) {
    const url = new URL(req.url);
    seen.push(url);
    const q = url.searchParams;
    const response = (body: unknown) =>
      Response.json({ "subsonic-response": body }, { headers: { "content-type": "application/json" } });

    const salt = q.get("s") || "";
    const tokenOk =
      !!q.get("t") &&
      q.get("t") ===
        createHash("md5")
          .update(PASSWORD + salt)
          .digest("hex");
    const passwordOk = q.get("p") === `enc:${Buffer.from(PASSWORD, "utf8").toString("hex")}`;
    const authed = (rejectToken ? false : tokenOk) || passwordOk;
    if (!authed) return response({ status: "failed", error: { code: 40, message: "Wrong username or password" } });

    if (url.pathname === "/rest/ping.view") {
      return response({ status: "ok", type: "navidrome", serverVersion: "0.54.0", openSubsonic: true });
    }
    if (url.pathname === "/rest/search3.view") {
      const query = q.get("query") || "";
      if (query.includes("Silence")) return response({ status: "ok", searchResult3: {} });
      if (query.includes("Two")) {
        return response({
          status: "ok",
          searchResult3: {
            song: [
              { id: "bad", title: "Song Two", artist: "The Band", albumId: "al2" },
              { id: "good", title: "Song Two", artist: "The Band", albumId: "al3" },
            ],
          },
        });
      }
      if (query.includes("Boom")) {
        return response({
          status: "ok",
          searchResult3: { song: [{ id: "boom", title: "Song Boom", artist: "The Band", albumId: "al4" }] },
        });
      }
      return response({
        status: "ok",
        searchResult3: {
          song: [
            { id: "other", title: "Something Else", artist: "Nobody", albumId: "al0" },
            { id: "one", title: "Song One", artist: "The Band", albumId: "al1" },
          ],
        },
      });
    }
    if (url.pathname === "/rest/stream.view") {
      const id = q.get("id");
      if (id === "bad") return response({ status: "failed", error: { code: 70, message: "Not found" } });
      if (id === "boom") return new Response("upstream is down", { status: 500 });
      if (id !== "one" && id !== "good") return new Response("missing", { status: 404 });
      const range = req.headers.get("range");
      const match = range ? /^bytes=(\d+)-(\d+)$/.exec(range) : null;
      if (match) {
        const from = Number(match[1]);
        const to = Number(match[2]);
        return new Response(audio.slice(from, to + 1), {
          status: 206,
          headers: {
            "content-type": "audio/mpeg",
            "content-range": `bytes ${from}-${to}/${audio.length}`,
            "content-length": String(to - from + 1),
          },
        });
      }
      return new Response(audio, {
        headers: { "content-type": "audio/mpeg", "content-length": String(audio.length), etag: '"a1"' },
      });
    }
    return new Response("not found", { status: 404 });
  },
});
const base = `http://127.0.0.1:${server.port}`;

beforeAll(async () => {
  const info = await verify(base, "listener", PASSWORD);
  expect(info).toEqual({ name: "navidrome", version: "0.54.0", openSubsonic: true, token: true });
});

afterAll(() => {
  server.stop(true);
  delete process.env.MUSIC_SERVER_ALLOW_PRIVATE;
});

describe("connect", () => {
  test("refuses addresses that are not a server", async () => {
    await expect(connect(1, { url: "ftp://music.example.com", username: "a", password: "b" })).rejects.toMatchObject({
      status: 400,
      key: "invalidMusicServerUrl",
    });
    await expect(connect(1, { url: base, username: "", password: "b" })).rejects.toMatchObject({
      status: 400,
      key: "musicServerCredentialsRequired",
    });
  });

  test("refuses credentials the server does not accept", async () => {
    await expect(connect(1, { url: base, username: "listener", password: "wrong" })).rejects.toMatchObject({
      status: 400,
      key: "musicServerAuthFailed",
    });
    expect(link).toBeNull();
  });

  test("saves the server once it answers", async () => {
    const saved = await connect(1, { url: `${base}/rest`, username: "listener", password: PASSWORD });
    expect(saved).toMatchObject({ connected: true, url: base, username: "listener", name: "navidrome" });
    expect(link?.password).toBe(`sealed:${PASSWORD}`);
    expect(await status(1)).toMatchObject({ connected: true });
  });

  test("forgets the server on disconnect", async () => {
    await disconnect(1);
    expect(await status(1)).toEqual({ connected: false });
  });
});

describe("stream", () => {
  test("says when nothing is connected", async () => {
    await expect(stream(1, "The Band", "Song One", null)).rejects.toMatchObject({
      status: 404,
      key: "musicServerNotConnected",
    });
  });

  test("proxies the audio and its range headers", async () => {
    await connect(1, { url: base, username: "listener", password: PASSWORD });
    const reply = await stream(1, "The Band", "Song One", "bytes=100-199");
    expect(reply.status).toBe(206);
    expect(reply.headers.get("content-type")).toBe("audio/mpeg");
    expect(reply.headers.get("content-range")).toBe("bytes 100-199/1000");
    expect(reply.headers.get("accept-ranges")).toBe("bytes");
    expect(new Uint8Array(await reply.arrayBuffer())).toEqual(audio.slice(100, 200));
  });

  test("falls through songs the server will not stream", async () => {
    await connect(1, { url: base, username: "listener", password: PASSWORD });
    const reply = await stream(1, "The Band", "Song Two", null);
    const sent = seen.filter((u) => u.pathname === "/rest/stream.view").map((u) => u.searchParams.get("id"));
    expect(sent).toContain("bad");
    expect(sent).toContain("good");
    expect(reply.status).toBe(200);
    expect((await reply.arrayBuffer()).byteLength).toBe(audio.length);
  });

  test("falls back to the encoded password when tokens are refused", async () => {
    rejectToken = true;
    const saved = await connect(1, { url: base, username: "listener", password: PASSWORD });
    expect(saved).toMatchObject({ connected: true });
    const reply = await stream(1, "The Band", "Song One", null);
    expect(reply.status).toBe(200);
    rejectToken = false;
  });

  test("reports tracks the server does not have", async () => {
    await expect(stream(1, "The Band", "Song Silence", null)).rejects.toMatchObject({
      status: 404,
      key: "musicServerNoMatch",
    });
    await expect(stream(1, "Nobody", "Unknown", null)).rejects.toMatchObject({
      status: 404,
      key: "musicServerNoMatch",
    });
  });

  test("reports a server that breaks rather than a missing track", async () => {
    await expect(stream(1, "The Band", "Song Boom", null)).rejects.toMatchObject({
      status: 502,
      key: "musicServerRequestFailed",
    });
  });

  test("keeps the server address and credentials out of the reply", async () => {
    const reply = await stream(1, "The Band", "Song One", null);
    for (const [, value] of reply.headers) {
      expect(value).not.toContain(PASSWORD);
      expect(value).not.toContain("listener");
    }
  });
});

describe("browser auth", () => {
  test("hands out token auth and the album's web address", async () => {
    rejectToken = false;
    await connect(1, { url: base, username: "listener", password: PASSWORD });
    const a = await auth(1);
    expect(a).toMatchObject({ base, username: "listener", name: "navidrome", direct: true });
    expect(a.token).toBe(
      createHash("md5")
        .update(PASSWORD + a.salt)
        .digest("hex")
    );
    // the same query the browser builds
    const reply = await fetch(
      `${a.base}/rest/search3.view?u=${encodeURIComponent(a.username)}&v=1.16.1&c=Sonosphere&f=json&t=${a.token}&s=${a.salt}&query=The+Band+Song+One`
    ).then((r) => r.json());
    expect(reply["subsonic-response"].status).toBe("ok");
    const s = await source(1, "The Band", "Song One");
    expect(s.proxy).toBe("/api/music/stream?id=one");
    expect(s.albumUrl).toBe(`${base}/app/#/album/al1/show`);
  });

  test("says direct is not worth trying when the server refuses tokens", async () => {
    rejectToken = true;
    await connect(1, { url: base, username: "listener", password: PASSWORD });
    expect(await auth(1)).toMatchObject({ direct: false });
    rejectToken = false;
  });

  test("streams a resolved song by id", async () => {
    const reply = await streamById(1, "one", "bytes=0-9");
    expect(reply.status).toBe(206);
    expect(reply.headers.get("content-range")).toBe("bytes 0-9/1000");
    expect((await reply.arrayBuffer()).byteLength).toBe(10);
  });
});
