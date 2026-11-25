import { need, owner } from "../guards";
import { bad, limit, Router } from "../http";
import { clean } from "../util";
import * as music from "./service";
import type { Ok } from "../../shared/auth";
import type { MusicAuth, MusicConnectBody, MusicSource, MusicStatus } from "../../shared/music";

export const router = new Router();

router.get<MusicStatus>("/api/music", (c) => music.status(need(c).id));

router.get<MusicAuth>("/api/music/auth", (c) => music.auth(owner(c).id));

router.post<MusicStatus>("/api/music", async (c) => {
  const u = owner(c);
  await limit(`music-connect:${u.id}`, 10, 3600);
  const password = typeof c.body.password === "string" ? c.body.password.slice(0, 500) : "";
  const body: MusicConnectBody = {
    kind: c.body.kind as MusicConnectBody["kind"],
    url: clean(c.body.url, 500),
    username: clean(c.body.username, 100),
    password,
  };
  return music.connect(u.id, body);
});

router.delete<Ok>("/api/music", async (c) => {
  await music.disconnect(owner(c).id);
  return { ok: true };
});

router.get<MusicSource>("/api/music/source", (c) => {
  const u = need(c);
  const artist = clean(c.q.get("artist"), 300);
  const track = clean(c.q.get("track"), 300);
  if (!artist || !track) bad("musicServerNoMatch");
  return music.source(u.id, artist, track);
});

router.get("/api/music/stream", async (c) => {
  const u = need(c);
  const id = clean(c.q.get("id"), 200);
  if (!id) bad("musicServerNoMatch");
  return music.streamById(u.id, id, c.req.headers.get("range"));
});
