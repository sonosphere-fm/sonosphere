import { need, owner } from "../guards";
import { bad, limit, Router } from "../http";
import { clean } from "../util";
import * as subsonic from "./service";
import type { Ok } from "../../shared/auth";
import type { SubsonicAuth, SubsonicSource, SubsonicStatus } from "../../shared/subsonic";

export const router = new Router();

router.get<SubsonicStatus>("/api/subsonic", (c) => subsonic.status(need(c).id));

router.get<SubsonicAuth>("/api/subsonic/auth", (c) => subsonic.auth(owner(c).id));

router.post<SubsonicStatus>("/api/subsonic", async (c) => {
  const u = owner(c);
  await limit(`subsonic-connect:${u.id}`, 10, 3600);
  const password = typeof c.body.password === "string" ? c.body.password.slice(0, 500) : "";
  return subsonic.connect(u.id, {
    url: clean(c.body.url, 500),
    username: clean(c.body.username, 100),
    password,
  });
});

router.delete<Ok>("/api/subsonic", async (c) => {
  await subsonic.disconnect(owner(c).id);
  return { ok: true };
});

router.get<SubsonicSource>("/api/subsonic/source", (c) => {
  const u = need(c);
  const artist = clean(c.q.get("artist"), 300);
  const track = clean(c.q.get("track"), 300);
  if (!artist || !track) bad("subsonicNoMatch");
  return subsonic.source(u.id, artist, track);
});

router.get("/api/subsonic/stream", async (c) => {
  const u = need(c);
  const range = c.req.headers.get("range");
  const id = clean(c.q.get("id"), 200);
  if (id) return subsonic.streamById(u.id, id, range);
  const artist = clean(c.q.get("artist"), 300);
  const track = clean(c.q.get("track"), 300);
  if (!artist || !track) bad("subsonicNoMatch");
  return subsonic.stream(u.id, artist, track, range);
});
