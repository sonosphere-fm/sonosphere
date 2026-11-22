import { beforeEach, expect, mock, test } from "bun:test";
import type { ChangelogPost, ChangelogText } from "../../shared/changelog";
import type { Viewer } from "../http";

let user: Viewer | null = null;
let actor: Viewer | null = null;
let saved: ChangelogPost[] = [];
let historyReads = 0;

mock.module("../auth/session", () => ({ viewerOf: async () => ({ user, actor }), tokenOf: () => "" }));
mock.module("../kv", () => ({ hits: async () => 0, attempt: async () => true }));
mock.module("../site/repo", () => ({
  metaValue: async () => null,
  promote: async () => {},
  adminCount: async () => 1,
  setRole: async () => {},
}));
mock.module("./history", () => ({
  getHistory: async () => {
    historyReads++;
    return [{ hash: "private-history" }];
  },
}));
mock.module("./repo", () => ({
  posts: async (limit: number, offset: number) => saved.slice(offset, offset + limit),
  postCount: async () => saved.length,
  findPost: async (id: number) => saved.find((post) => post.id === id) ?? null,
  savePost: async (by: { username: string }, text: ChangelogText, id?: number) => {
    const existing = saved.find((post) => post.id === id);
    if (id && !existing) return null;
    const post = {
      id: id ?? saved.length + 1,
      createdAt: 100,
      author: by.username,
      ...existing,
      ...text,
      editor: by.username,
      updatedAt: 200,
    };
    saved = [...saved.filter((item) => item.id !== post.id), post];
    return { id: post.id };
  },
}));

const { router } = await import("./routes");
const admin = { id: 1, username: "editor", isAdmin: true, role: "admin", banned: false } as Viewer;
const member = { ...admin, id: 2, username: "listener", isAdmin: false, role: "user" };
const text = { title: "Listening updates", body: "A clearer listening history." };
const request = (path: string, method = "GET", body?: unknown) =>
  router.handle(
    new Request(`http://localhost/api/${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  );

beforeEach(() => {
  user = null;
  actor = null;
  saved = [];
  historyReads = 0;
});

test("public changelog returns posts without reading commit history", async () => {
  expect(await (await request("changelog")).json()).toEqual({ items: [], total: 0, limit: 10 });
  expect(historyReads).toBe(0);
});

test("anonymous, member, moderator, and impersonated requests cannot read commits or publish", async () => {
  for (const viewer of [null, member, { ...admin, role: "moderator" }]) {
    user = viewer;
    actor = admin;
    const status = viewer ? 403 : 401;
    expect((await request("admin/changelog/commits")).status).toBe(status);
    expect((await request("admin/changelog", "POST", text)).status).toBe(status);
    expect((await request("admin/changelog/1", "PATCH", text)).status).toBe(status);
  }
  expect(historyReads).toBe(0);
  expect(saved).toHaveLength(0);
});

test("admins can publish and edit posts; invalid content and missing posts are refused", async () => {
  user = admin;
  actor = admin;
  expect((await request("admin/changelog/commits")).status).toBe(200);
  expect((await request("admin/changelog", "POST", { title: 12, body: text.body })).status).toBe(400);
  expect((await request("admin/changelog", "POST", { ...text, body: "short" })).status).toBe(400);
  expect((await request("admin/changelog", "POST", { ...text, title: "x".repeat(121) })).status).toBe(400);
  expect(await (await request("admin/changelog", "POST", text)).json()).toEqual({ id: 1 });
  expect((await request("admin/changelog/1", "PATCH", { ...text, title: "Updated" })).status).toBe(200);
  expect((await (await request("admin/changelog/1")).json()).title).toBe("Updated");
  expect((await request("admin/changelog/999", "PATCH", text)).status).toBe(404);
  expect((await request("admin/changelog/nope")).status).toBe(400);
  user = null;
  actor = null;
  const published = await (await request("changelog")).json();
  expect(published.items[0].title).toBe("Updated");
  expect(published.items[0].author).toBe("editor");
});
