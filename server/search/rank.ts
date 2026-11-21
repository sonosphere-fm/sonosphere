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

// names of uploads, fan pages and tribute acts rather than artists: "Radiohead - Topic", "Radiohead • Lossless"
const JUNK = /( - topic$|•|\||\blossless\b|\bvevo\b|\bofficial\b|\bfan ?(page|club|account)?\b|\bcover(s|ed)?\b|\btribute\b|\bkaraoke\b|\bsucks\b|\bunofficial\b|\bbootlegs?\b|\bleaks?\b|\barchive\b|\btopic$)/i;
const junkWords = /^(\d+|ii|iii|tribute|cover|covers|band|fans?|sucks|lossless|topic|official|vevo|archive|leaks?|brasil|brazil|br|mx)$/;

type Ranked = { a: FoundArtist; score: number; key: string; releases: number; mbOnly: boolean };

/**
 * Whether an artist only MusicBrainz knows is noise beside the ones kept above it: a placeholder ("[unknown]"), a
 * junk name, or a much better known artist's name with junk after it ("radiohead 3", "radiohead cover brasil",
 * "aphextwinsucks"; blink-182 stays, it is better known than Blink).
 */
function isJunk(s: Ranked, above: Ranked[]): boolean {
  if (/^\[.*\]$/.test(s.a.name) || JUNK.test(s.a.name)) return true;
  const flat = s.key.replace(/ /g, "");
  return above.some(b => {
    if (b.releases < 5 * (s.releases + 1)) return false;
    const base = s.key.startsWith(b.key + " ") ? b.key : flat.startsWith(b.key.replace(/ /g, "")) ? b.key.replace(/ /g, "") : null;
    if (base === null || base === (base === b.key ? s.key : flat)) return false;
    const rest = (base === b.key ? s.key : flat).slice(base.length).trim();
    return rest.split(" ").every(w => junkWords.test(w)) || /^(sucks|fan|tribute|cover)/.test(rest);
  });
}

export function rankArtists(ours: FoundArtist[], theirs: ArtistHit[], typed: string, limit: number): FoundArtist[] {
  const q = looseKey(typed);
  // several MusicBrainz artists can share a name: ours is taken to be the best known of them
  const known = new Map<string, ArtistHit>();
  for (const h of theirs) {
    const key = looseKey(h.name), had = known.get(key);
    if (!had || h.releases > had.releases) known.set(key, h);
  }
  const scored: Ranked[] = [];
  const seen = new Set<string>();
  for (const a of ours) {
    const key = looseKey(a.name), mb = known.get(key);
    seen.add(key);
    const score = textScore(key, q) - lengthPenalty(key, q) + 8 + 14 * Math.log10(1 + a.listeners) + (a.image ? 4 : 0)
      + (mb ? 10 * Math.log10(1 + mb.releases) + (mb.spotify ? 5 : 0) : 0);
    scored.push({ a, score, key, releases: mb?.releases ?? 0, mbOnly: false });
  }
  for (const h of theirs) {
    const key = looseKey(h.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const score = textScore(h.key, q) - lengthPenalty(h.key, q) - (h.viaAlias ? 8 : 0) + 10 * Math.log10(1 + h.releases) + (h.spotify ? 5 : 0);
    scored.push({ a: { id: 0, name: h.name, image: null, listeners: 0 }, score, key, releases: h.releases, mbOnly: true });
  }
  scored.sort((x, y) => y.score - x.score);
  const kept: Ranked[] = [];
  for (const s of scored) if (!s.mbOnly || !isJunk(s, kept)) kept.push(s);
  // artists only MusicBrainz knows have no id here: they carry a negative one (opening one files it, see server/metadata)
  return kept.slice(0, limit).map((s, i) => (s.a.id ? s.a : { ...s.a, id: -(i + 1) }));
}
