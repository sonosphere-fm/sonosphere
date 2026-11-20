// Catalogue routes: the artist, album and track pages and the lists that hang off an artist.
import { paging, Router } from "../http";
import { range } from "../listening/period";
import { topTracks } from "../listening/repo";
import type { AlbumPage, ArtistAlbums, ArtistListeners, ArtistPage, ArtistSimilar, ArtistTracks, TrackPage } from "../../shared/catalog";
import { albumPage, artistPage, similarWithTags, trackPage } from "./pages";
import * as repo from "./repo";
import { requireAlbum, requireArtist, requireTrack } from "./service";

export const router = new Router();

router.get<ArtistPage>("/api/artist", async c => artistPage(await requireArtist(c.q.get("name")), c.user?.id));

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

router.get<AlbumPage>("/api/album", async c => albumPage(await requireAlbum(c.q.get("artist"), c.q.get("album")), c.user?.id ?? 0));

router.get<TrackPage>("/api/track", async c => trackPage(await requireTrack(c.q.get("artist"), c.q.get("track")), c.user?.id ?? 0));
