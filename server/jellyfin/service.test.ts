import { afterAll, beforeAll, describe, expect, mock, test } from "bun:test";

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
  jellyfinUserId: string;
  deviceId: string;
  name: string;
  version: string;
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
const { auth, connect, disconnect, source, streamById } = await import("./service");

const PASSWORD = "s3cret";
const TOKEN = "jf-token";
const audio = Uint8Array.from({ length: 500 }, (_, i) => i % 256);
let deviceHeader = "";

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/Users/AuthenticateByName" && req.method === "POST") {
      deviceHeader = req.headers.get("authorization") || "";
      const body = (await req.json().catch(() => null)) as { Username?: string; Pw?: string } | null;
      if (body?.Username !== "listener" || body.Pw !== PASSWORD) return new Response("", { status: 401 });
      return Response.json({ AccessToken: TOKEN, User: { Id: "jf-user" } });
    }
    if (url.pathname === "/System/Info/Public") {
      return Response.json({ ServerName: "Home Jellyfin", Version: "10.10.0" });
    }
    const token = req.headers.get("x-emby-token") || url.searchParams.get("api_key");
    if (token !== TOKEN) return new Response("", { status: 401 });
    if (url.pathname === "/Items") {
      const term = url.searchParams.get("searchTerm") || "";
      if (term.includes("Silence")) return Response.json({ Items: [] });
      if (term.includes("Two")) {
        return Response.json({
          Items: [{ Id: "two", Name: "Song Two", AlbumId: "alb2", Artists: ["The Band"], Type: "Audio" }],
        });
      }
      return Response.json({
        Items: [
          { Id: "other", Name: "Something Else", AlbumId: "alb0", Artists: ["Nobody"], Type: "Audio" },
          { Id: "one", Name: "Song One", AlbumId: "alb1", Artists: ["The Band"], Type: "Audio" },
        ],
      });
    }
    if (url.pathname === "/Audio/one/stream") {
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
        headers: { "content-type": "audio/mpeg", "content-length": String(audio.length) },
      });
    }
    return new Response("missing", { status: 404 });
  },
});
const base = `http://127.0.0.1:${server.port}`;

beforeAll(async () => {
  await connect(1, { url: `${base}/`, username: "listener", password: PASSWORD });
  expect(link).toMatchObject({ url: base, username: "listener", jellyfinUserId: "jf-user", name: "Home Jellyfin" });
  expect(link?.deviceId).toHaveLength(16);
  expect(deviceHeader).toContain(`DeviceId="${link?.deviceId}"`);
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
  });
});

describe("browser auth", () => {
  test("hands out a token and the user id", async () => {
    const a = await auth(1);
    expect(a).toMatchObject({ kind: "jellyfin", base, userId: "jf-user", token: TOKEN, name: "Home Jellyfin" });
    // the same query the browser builds
    const reply = await fetch(`${base}/Items?userId=jf-user&searchTerm=Song&api_key=${a.token}`).then((r) => r.json());
    expect(reply.Items).toHaveLength(2);
  });

  test("points the browser at the proxy and the album", async () => {
    const s = await source(1, "The Band", "Song One");
    expect(s.proxy).toBe("/api/music/stream?id=one");
    expect(s.albumUrl).toBe(`${base}/web/index.html#!/details?id=alb1`);
  });

  test("reports tracks the server does not have", async () => {
    await expect(source(1, "The Band", "Song Silence")).rejects.toMatchObject({
      status: 404,
      key: "musicServerNoMatch",
    });
  });
});

describe("streamById", () => {
  test("proxies the audio and its range headers", async () => {
    const reply = await streamById(1, "one", "bytes=100-199");
    expect(reply.status).toBe(206);
    expect(reply.headers.get("content-type")).toBe("audio/mpeg");
    expect(reply.headers.get("content-range")).toBe("bytes 100-199/500");
    expect(reply.headers.get("accept-ranges")).toBe("bytes");
    expect(new Uint8Array(await reply.arrayBuffer())).toEqual(audio.slice(100, 200));
  });

  test("reports a missing song", async () => {
    await expect(streamById(1, "gone", null)).rejects.toMatchObject({ status: 404, key: "musicServerNoMatch" });
  });

  test("forgets the server on disconnect", async () => {
    await disconnect(1);
    await expect(auth(1)).rejects.toMatchObject({ status: 404, key: "musicServerNotConnected" });
  });
});
