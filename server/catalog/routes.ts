import { ipOf, paging, Router, throttle } from "../http";
import { range } from "../listening/period";
import { topTracks } from "../listening/repo";
import type {
  AlbumPage,
  ArtistAlbums,
  ArtistListeners,
  ArtistPage,
  ArtistSimilar,
  ArtistTracks,
  TrackLinks,
  TrackPage,
} from "../../shared/catalog";
import { resolveTrackLinks } from "./track-links";
import { albumPage, artistPage, similarWithTags, trackPage } from "./pages";
import * as repo from "./repo";
import { albumOrImport, artistOrImport, refresh, trackOrImport } from "../metadata/service";
import { requireAlbum, requireArtist, requireTrack } from "./service";
import { wantBare } from "../metadata/wanted";

export const router = new Router();

router.get<ArtistPage>("/api/artist", async (c) => {
  const name = c.q.get("name") || "";
  const a = await artistOrImport(name, c.user, () => requireArtist(name));
  refresh(c.user, "artist", a);
  return artistPage(a, c.user?.id);
});

router.get<ArtistTracks>("/api/artist/tracks", async (c) => {
  const a = await requireArtist(c.q.get("name"));
  const [from, to] = range(c.q);
  const pg = paging(c.q);
  const page = await topTracks({ artistId: a.id, from, to, viewerId: c.user?.id, global: true }, pg.limit, pg.offset);
  return { ...page, ...pg };
});

router.get<ArtistAlbums>("/api/artist/albums", async (c) => {
  const a = await requireArtist(c.q.get("name"));
  const pg = paging(c.q, 48);
  const singles = c.q.get("type") === "singles";
  const items = wantBare("album", await repo.discography(a.id, singles, pg.limit, pg.offset), (r) => r.id);
  return { items, total: await repo.albumCount(a.id, singles), ...pg };
});

router.get<ArtistSimilar>("/api/artist/similar", async (c) => {
  const a = await requireArtist(c.q.get("name"));
  return { items: await similarWithTags(a.id) };
});

router.get<ArtistListeners>("/api/artist/listeners", async (c) => {
  const a = await requireArtist(c.q.get("name"));
  return { items: await repo.topListeners("artist", a.id, 50) };
});

router.get<AlbumPage>("/api/album", async (c) => {
  const artist = c.q.get("artist") || "";
  const title = c.q.get("album") || "";
  const al = await albumOrImport(artist, title, c.user, () => requireAlbum(artist, title));
  refresh(c.user, "album", al);
  return albumPage(al, c.user?.id ?? 0);
});

router.get<TrackPage>("/api/track", async (c) => {
  const artist = c.q.get("artist") || "";
  const title = c.q.get("track") || "";
  const t = await trackOrImport(artist, title, c.user, () => requireTrack(artist, title));
  refresh(c.user, "track", t);
  return trackPage(t, c.user?.id ?? 0);
});

router.get<TrackLinks>("/api/track/links", async (c) => {
  await throttle(`track-links:${c.user?.id ?? ipOf(c.req)}`, 20, 60);
  const track = await requireTrack(c.q.get("artist"), c.q.get("track"));
  const album = track.albumId ? await repo.findItem("album", track.albumId) : null;
  return resolveTrackLinks({ ...track, album: album?.title });
});
