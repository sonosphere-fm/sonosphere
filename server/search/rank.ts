// Ranks artist search results: ours and the ones only MusicBrainz knows (server/metadata/mbdb.ts), in one list.
// A name that is what was typed beats one that only starts with it; then how well known the artist is (listeners
// here, releases on MusicBrainz, a Spotify link) and how close the length is to what was typed.
import type { ArtistHit } from "../metadata/mbdb";
import type { FoundArtist } from "../../shared/search";

/** The loose form MusicBrainz names are compared in (as mbkey() in the copy). */
export const looseKey = (s: string) =>
  s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/&/g, "and").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/^the /, "");

function textScore(key: string, q: string): number {
  if (key === q) return 70;
  if (key.startsWith(q + " ")) return 55; // the whole first word(s): "aphex" in "aphex twin"
  if (key.startsWith(q)) return 40;
  if ((" " + key).includes(" " + q)) return 30; // a later word starts with it
  return 10;
}
const lengthPenalty = (key: string, q: string) => Math.min(15, Math.max(0, key.length - q.length) * 0.4);

export function rankArtists(ours: FoundArtist[], theirs: ArtistHit[], typed: string, limit: number): FoundArtist[] {
  const q = looseKey(typed);
  // several MusicBrainz artists can share a name: ours is taken to be the best known of them
  const known = new Map<string, ArtistHit>();
  for (const h of theirs) {
    const key = looseKey(h.name), had = known.get(key);
    if (!had || h.releases > had.releases) known.set(key, h);
  }
  const scored: { a: FoundArtist; score: number }[] = [];
  const seen = new Set<string>();
  for (const a of ours) {
    const key = looseKey(a.name), mb = known.get(key);
    seen.add(key);
    const score = textScore(key, q) - lengthPenalty(key, q) + 8 + 14 * Math.log10(1 + a.listeners) + (a.image ? 4 : 0)
      + (mb ? 10 * Math.log10(1 + mb.releases) + (mb.spotify ? 5 : 0) : 0);
    scored.push({ a, score });
  }
  for (const h of theirs) {
    const key = looseKey(h.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const score = textScore(h.key, q) - lengthPenalty(h.key, q) - (h.viaAlias ? 8 : 0) + 10 * Math.log10(1 + h.releases) + (h.spotify ? 5 : 0);
    scored.push({ a: { id: 0, name: h.name, image: null, listeners: 0 }, score });
  }
  scored.sort((x, y) => y.score - x.score);
  // artists only MusicBrainz knows have no id here: they carry a negative one (opening one files it, see server/metadata)
  return scored.slice(0, limit).map((s, i) => (s.a.id ? s.a : { ...s.a, id: -(i + 1) }));
}
