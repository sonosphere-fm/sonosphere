// Catalogue routes: the artist, album and track pages and the lists that hang off an artist.
import { paging, Router } from "../http";
import { range } from "../listening/period";
import { topTracks } from "../listening/repo";
import type { AlbumPage, ArtistAlbums, ArtistListeners, ArtistPage, ArtistSimilar, ArtistTracks, TrackPage } from "../../shared/catalog";
import { albumPage, artistPage, similarWithTags, trackPage } from "./pages";
import * as repo from "./repo";
import { albumOrImport, artistOrImport, refresh, trackOrImport } from "../metadata/service";
import { requireAlbum, requireArtist, requireTrack } from "./service";

export const router = new Router();

// A page we have nothing for is looked up elsewhere when a confirmed account asks, and a page that was never filled in
// is filled in the background (server/metadata)
router.get<ArtistPage>("/api/artist", async c => {
  const name = c.q.get("name") || "";
  const a = await artistOrImport(name, c.user, () => requireArtist(name));
  refresh(c.user, "artist", a);
  return artistPage(a, c.user?.id);
});

router.get<ArtistTracks>("/api/artist/tracks", async c => {
  const a = await requireArtist(c.q.get("name")), [from, to] = range(c.q), pg = paging(c.q);
  return { ...(await topTracks({ artistId: a.id, from, to, viewerId: c.user?.id, global: true }, pg.limit, pg.offset)), ...pg };
});

router.get<ArtistAlbums>("/api/artist/albums", async c => {
  const a = await requireArtist(c.q.get("name")), pg = paging(c.q, 48);
  return { items: await repo.discography(a.id, pg.limit, pg.offset), total: await repo.albumCount(a.id), ...pg };
});

router.get<ArtistSimilar>("/api/artist/similar", async c => ({ items: await similarWithTags((await requireArtist(c.q.get("name"))).id) }));

router.get<ArtistListeners>("/api/artist/listeners", async c => ({ items: await repo.topListeners("artist", (await requireArtist(c.q.get("name"))).id, 50) }));

router.get<AlbumPage>("/api/album", async c => {
  const artist = c.q.get("artist") || "", title = c.q.get("album") || "";
  const al = await albumOrImport(artist, title, c.user, () => requireAlbum(artist, title));
  refresh(c.user, "album", al);
  return albumPage(al, c.user?.id ?? 0);
});

router.get<TrackPage>("/api/track", async c => {
  const artist = c.q.get("artist") || "", title = c.q.get("track") || "";
  const t = await trackOrImport(artist, title, c.user, () => requireTrack(artist, title));
  refresh(c.user, "track", t);
  return trackPage(t, c.user?.id ?? 0);
});
