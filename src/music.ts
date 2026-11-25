import { jellyfinAlbumUrl } from "../shared/jellyfin";
import type { MusicAuth } from "../shared/music";
import type { MusicMatch } from "../shared/music-match";
import { albumWebUrl } from "../shared/subsonic";
import { directMatches as jellyfinMatches, directStreamUrl as jellyfinStream } from "./jellyfin";
import { directMatches as subsonicMatches, directStreamUrl as subsonicStream } from "./subsonic";

export const musicDirectAllowed = (auth: MusicAuth): boolean => (auth.kind === "subsonic" ? auth.direct : true);

export function musicMatches(auth: MusicAuth, artist: string, track: string): Promise<MusicMatch[] | null> {
  return auth.kind === "subsonic" ? subsonicMatches(auth, artist, track) : jellyfinMatches(auth, artist, track);
}

export function musicStreamUrl(auth: MusicAuth, id: string): string {
  return auth.kind === "subsonic" ? subsonicStream(auth, id) : jellyfinStream(auth, id);
}

export function musicAlbumUrl(auth: MusicAuth, albumId: string | null): string {
  return auth.kind === "subsonic" ? albumWebUrl(auth.base, auth.name, albumId) : jellyfinAlbumUrl(auth.base, albumId);
}
