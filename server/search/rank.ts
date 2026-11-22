import type { ArtistHit, TitleHit } from "../metadata/mbdb";
import type { FoundArtist } from "../../shared/search";

// Must match mbkey() in the MusicBrainz copy.
export const looseKey = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/^the /, "");

function textScore(key: string, q: string): number {
  if (key === q) return 70;
  if (key.startsWith(q + " ")) return 55; // the whole first word(s): "aphex" in "aphex twin"
  if (key.startsWith(q)) return 40;
  if ((" " + key).includes(" " + q)) return 30; // a later word starts with it
  return 10;
}

const lengthPenalty = (key: string, q: string) => Math.min(15, Math.max(0, key.length - q.length) * 0.4);

// names of uploads, fan pages and tribute acts rather than artists: "Radiohead - Topic", "Radiohead • Lossless"
const JUNK =
  /( - topic$|•|\||\blossless\b|\bvevo\b|\bofficial\b|\bfan ?(page|club|account)?\b|\bcover(s|ed)?\b|\btribute\b|\bkaraoke\b|\bsucks\b|\bunofficial\b|\bbootlegs?\b|\bleaks?\b|\barchive\b|\btopic$)/i;
const junkWords =
  /^(\d+|ii|iii|tribute|cover|covers|band|fans?|sucks|lossless|topic|official|vevo|archive|leaks?|brasil|brazil|br|mx)$/;

type Ranked = { a: FoundArtist; score: number; key: string; releases: number; mbOnly: boolean };

// A placeholder ("[unknown]"), a junk name, or a much better known artist's name with junk after it
// ("radiohead 3", "radiohead cover brasil", "aphextwinsucks"; blink-182 stays, it is better known than Blink).
function isJunk(s: Ranked, above: Ranked[]): boolean {
  if (/^\[.*\]$/.test(s.a.name) || JUNK.test(s.a.name)) return true;
  const flat = s.key.replace(/ /g, "");
  return above.some((b) => {
    if (b.releases < 5 * (s.releases + 1)) return false;
    const bFlat = b.key.replace(/ /g, "");
    let base: string;
    if (s.key.startsWith(b.key + " ")) base = b.key;
    else if (flat.startsWith(bFlat)) base = bFlat;
    else return false;
    const subject = base === b.key ? s.key : flat;
    if (base === subject) return false;
    const rest = subject.slice(base.length).trim();
    return rest.split(" ").every((w) => junkWords.test(w)) || /^(sucks|fan|tribute|cover)/.test(rest);
  });
}

export function rankArtists(ours: FoundArtist[], theirs: ArtistHit[], typed: string, limit: number): FoundArtist[] {
  const q = looseKey(typed);
  // several MusicBrainz artists can share a name: ours is taken to be the best known of them
  const known = new Map<string, ArtistHit>();
  for (const h of theirs) {
    const key = looseKey(h.name);
    const had = known.get(key);
    if (!had || h.releases > had.releases) known.set(key, h);
  }
  const scored: Ranked[] = [];
  const seen = new Set<string>();
  for (const a of ours) {
    const key = looseKey(a.name);
    const mb = known.get(key);
    seen.add(key);
    const text = textScore(key, q) - lengthPenalty(key, q) + 8;
    const ourFame = 14 * Math.log10(1 + a.listeners) + (a.image ? 4 : 0);
    const mbFame = mb ? 10 * Math.log10(1 + mb.releases) + (mb.spotify ? 5 : 0) : 0;
    const score = text + ourFame + mbFame;
    scored.push({ a, score, key, releases: mb?.releases ?? 0, mbOnly: false });
  }
  for (const h of theirs) {
    const key = looseKey(h.name);
    if (seen.has(key)) continue;
    seen.add(key);
    const text = textScore(h.key, q) - lengthPenalty(h.key, q) - (h.viaAlias ? 8 : 0);
    const fame = 10 * Math.log10(1 + h.releases) + (h.spotify ? 5 : 0);
    const a = { id: 0, name: h.name, image: null, listeners: 0 };
    scored.push({ a, score: text + fame, key, releases: h.releases, mbOnly: true });
  }
  scored.sort((x, y) => y.score - x.score);
  const kept: Ranked[] = [];
  for (const s of scored) {
    if (!s.mbOnly || !isJunk(s, kept)) kept.push(s);
  }
  // artists only MusicBrainz knows have no id here: they carry a negative one (opening one files it, see server/metadata)
  return kept.slice(0, limit).map((s, i) => (s.a.id ? s.a : { ...s.a, id: -(i + 1) }));
}

type Titled = { id: number; title: string; artist: string; image: string | null; listeners: number };

/** Ours and MusicBrainz's albums or tracks in one list; ones only MusicBrainz knows get negative ids like artists. */
export function rankTitles<T extends Titled>(
  ours: T[],
  theirs: TitleHit[],
  typed: string,
  limit: number,
  stub: (h: TitleHit) => T
): T[] {
  const q = looseKey(typed);
  const both = (title: string, artist: string) => `${looseKey(title)}\n${looseKey(artist)}`;
  const known = new Map<string, TitleHit>();
  for (const h of theirs) {
    const k = both(h.title, h.artist);
    if (!known.has(k)) known.set(k, h);
  }
  const text = (title: string) => {
    const key = looseKey(title);
    return textScore(key, q) - lengthPenalty(key, q);
  };
  const fame = (h: TitleHit | undefined) => (h ? 10 * Math.log10(1 + h.n) : 0);
  const scored = ours.map((t) => {
    const k = both(t.title, t.artist);
    const mb = known.get(k);
    known.delete(k);
    return { t, score: text(t.title) + 8 + 14 * Math.log10(1 + t.listeners) + (t.image ? 4 : 0) + fame(mb) };
  });
  for (const h of known.values()) scored.push({ t: stub(h), score: text(h.title) + fame(h) });
  scored.sort((x, y) => y.score - x.score);
  return scored.slice(0, limit).map((s, i) => (s.t.id ? s.t : { ...s.t, id: -(i + 1) }));
}
