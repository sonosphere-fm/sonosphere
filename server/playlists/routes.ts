import { confirmed, need } from "../guards";
import { bad, missing, Router, throttle } from "../http";
import { requireUser } from "../users/service";
import { clean } from "../util";
import * as repo from "./repo";
import { requireOwn, trackToAdd } from "./service";
import type { PlaylistCreated, PlaylistOk, PlaylistPage, UserPlaylists } from "../../shared/playlists";

export const router = new Router();

router.get<UserPlaylists>("/api/user/playlists", async c => {
  const u = await requireUser(c.q.get("name"));
  return { items: await repo.playlistsOf(u.id) };
});

router.get<PlaylistPage>("/api/playlist/:id", async c => {
  const p = (await repo.findPlaylist(Number(c.params[0]))) ?? missing("Playlist");
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    owner: p.owner,
    createdAt: p.createdAt,
    mine: c.user?.id === p.userId,
    tracks: await repo.tracksOn(p.id, c.user?.id),
  };
});

router.post<PlaylistCreated>("/api/playlists", async c => {
  const u = confirmed(need(c));
  const title = clean(c.body.title, 100) || bad("Give the playlist a title");
  await throttle(`playlist:${u.id}`, 30, 86_400, "You can make up to 30 playlists a day.");
  const description = String(c.body.description || "").trim().slice(0, 500);
  return { id: await repo.createPlaylist(u.id, title, description) };
});

router.patch<PlaylistOk>("/api/playlist/:id", async c => {
  const p = await requireOwn(Number(c.params[0]), confirmed(need(c)).id);
  const title = clean(c.body.title ?? p.title, 100) || p.title;
  const description = String(c.body.description ?? p.description).trim().slice(0, 500);
  await repo.updatePlaylist(p.id, title, description);
  return { ok: true };
});

router.delete<PlaylistOk>("/api/playlist/:id", async c => {
  const p = await requireOwn(Number(c.params[0]), need(c).id);
  await repo.deletePlaylist(p.id);
  return { ok: true };
});

router.post<PlaylistOk>("/api/playlist/:id/tracks", async c => {
  const p = await requireOwn(Number(c.params[0]), confirmed(need(c)).id);
  await repo.appendTrack(p.id, await trackToAdd(c.body));
  return { ok: true };
});

router.delete<PlaylistOk>("/api/playlist/:id/tracks/:entry", async c => {
  const p = await requireOwn(Number(c.params[0]), need(c).id);
  await repo.removeEntry(p.id, Number(c.params[1]));
  return { ok: true };
});
